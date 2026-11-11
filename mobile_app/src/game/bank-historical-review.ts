import type { GameState } from '../../../src/game/types.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { contextFor, equal, Rejected, ENGINE_VERSION } from './bank-historical-contract.ts'
import type { Session, Verifier, Context, ReviewDTO } from './bank-historical-contract.ts'

import { captureIntegrity } from './bank-historical-integrity.ts'
import type { SnapshotExecutor } from './bank-historical-worker-contract.ts'
import { SCENARIO } from '../../../src/what-if-explanation/contracts.ts'
import type { ExplanationFacts, ExplanationLease } from '../../../src/what-if-explanation/contracts.ts'
import { assertFacts } from '../../../src/what-if-explanation/claims.ts'

// Authority is private to this module. A caller-created supported DTO/duck-typed lease is not issued here.
const issuedLeases = new WeakSet<object>()
export function isHistoricalExplanationLease(value: unknown): value is ExplanationLease {
  return !!value && typeof value === 'object' && issuedLeases.has(value)
}

type Ticket = { session: Session; snapshot: ReturnType<Session['getSnapshot']>; epoch: number; revision: number;
  ordinal: number; integrity: ReturnType<typeof captureIntegrity>; context?: Context; abort: AbortController }

function publicDTO(result: ReviewDTO): ReviewDTO {
  if (result.status === 'blocked') return { status: 'blocked', reason: result.reason }
  if (result.status === 'known') return { status: 'known', principal: result.principal, cashNow: result.cashNow,
    cashIfDeposit: result.cashIfDeposit, rate: result.rate, term: result.term, lockedUntilLap: result.lockedUntilLap }
  return { status: 'supported', principal: result.principal, actualCash: result.actualCash, alternativeCash: result.alternativeCash,
    difference: result.difference, actualLiquidBuffer: result.actualLiquidBuffer, alternativeLiquidBuffer: result.alternativeLiquidBuffer,
    fees: result.fees, debt: result.debt, obligations: result.obligations, checkpointLap: result.checkpointLap, checkpointTurn: result.checkpointTurn }
}
/** Feature-owned transient controller. Consumers must call read() at render time. */
export function createBinding(verify?: Verifier, execute?: SnapshotExecutor) {
  let active: Session | null = null, epoch = 0, revision = 0, ordinal = 0
  let lifecycle = 'initial'
  let unsubscribe: (() => void) | undefined
  let latest: Ticket | undefined
  let published: { ticket: Ticket; result: ReviewDTO } | undefined
  let revoking = 0
  const leaseRevokers = new Set<(defer?: boolean) => void>()
  const retireLeases = (defer = false) => { const old = [...leaseRevokers]; leaseRevokers.clear(); old.forEach(fn => fn(defer)) }
  const revoke = () => {
    revoking++
    try {
      const previous = latest
      latest = undefined; published = undefined; ordinal++
      retireLeases(); previous?.abort.abort()
    } finally { revoking-- }
  }
  const current = (ticket: Ticket) => {
    if (active !== ticket.session || epoch !== ticket.epoch || revision !== ticket.revision
      || ordinal !== ticket.ordinal || latest !== ticket || active.getSnapshot() !== ticket.snapshot) return false
    // Also catches silent in-place changes to decision prefixes/config/history.
    return ticket.integrity.valid()
  }
  return {
    activate(session: Session | null, reason: string) {
      unsubscribe?.(); unsubscribe = undefined; revoke(); epoch++; revision++; active = session; lifecycle = reason
      if (session) unsubscribe = session.subscribe(() => { revision++; revoke() })
    },
    async request(sequence: number): Promise<'published' | 'discarded'> {
      if (revoking) return 'discarded'
      revoke()
      if (!active) return 'discarded'
      const session = active, snapshot = session.getSnapshot()
      let integrity: ReturnType<typeof captureIntegrity>
      try { integrity = captureIntegrity(snapshot) } catch { return 'discarded' }
      const ticket: Ticket = { session, snapshot, integrity, epoch, revision, ordinal, abort: new AbortController() }
      latest = ticket
      try {
        let envelope
        if (execute) {
          const result = await execute(snapshot, sequence, ticket.abort.signal, integrity.environment)
          ticket.context = result.context; envelope = result.envelope
        } else {
          // Legacy injectable seam for regression tests; App always uses the worker executor.
          const text = serializeLog(snapshot)
          ticket.context = await contextFor(text, sequence)
          if (!current(ticket)) return 'discarded'
          if (!verify) throw new Rejected('verifier-unavailable')
          envelope = await verify(text, sequence, ticket.abort.signal)
        }
        if (!current(ticket) || ticket.context.engine !== ENGINE_VERSION || ticket.context.decision.sequence !== sequence
          || !equal(ticket.context, envelope.context)
          || (envelope.result.status === 'supported' && (!ticket.context.checkpoint
            || envelope.result.checkpointLap !== ticket.context.checkpoint.lap
            || envelope.result.checkpointTurn !== ticket.context.checkpoint.turn))) return 'discarded'
        // No await or callback between this identity check and private publication.
        published = { ticket, result: publicDTO(envelope.result) }
        return 'published'
      } catch (error) {
        if (!current(ticket)) return 'discarded'
        published = { ticket, result: { status: 'blocked', reason: error instanceof Rejected ? error.message : 'verification-failed' } }
        return 'published'
      }
    },
    acquireExplanationLease(): ExplanationLease | null {
      const pair = published, result = pair?.result, context = pair?.ticket.context
      if (revoking || !pair || result?.status !== 'supported' || !context?.checkpoint || !current(pair.ticket)
        || context.engine !== ENGINE_VERSION || leaseRevokers.size >= 16) return null
      // Private context comparison stays here; no hashes, snapshot or raw history reach the consumer.
      const capturedContext = structuredClone(context)
      let released = false
      const listeners = new Set<() => void>()
      const invalidate = (defer = false) => {
        if (released) return
        released = true; leaseRevokers.delete(invalidate)
        const callbacks = [...listeners]; listeners.clear()
        const notify = () => callbacks.forEach(fn => { try { fn() } catch { /* Consumer cannot block invalidation. */ } })
        if (defer) queueMicrotask(notify); else notify()
      }
      const read = (): ExplanationFacts | null => {
        if (released) return null
        if (published !== pair || pair.result !== result || !current(pair.ticket) || !equal(pair.ticket.context, capturedContext)) {
          invalidate(true); return null
        }
        const d = capturedContext.decision, c = capturedContext.checkpoint!
        const facts: ExplanationFacts = {
          scenario: SCENARIO,
          decision: { sequence:d.sequence, turn:d.turn, lap:d.lap, tileId:d.tileId, eventId:d.eventId, decisionId:d.decisionId },
          checkpoint: { sequence:c.sequence, lap:c.lap, turn:c.turn },
          assumption: { term:1, budgetMeaning:'analysis-assumption-not-recorded-intent' },
          horizon:'recorded-next-completed-start', liquidity:'principal-locked-until-comparison-start',
          result: structuredClone(result),
        }
        try { assertFacts(facts) } catch { invalidate(true); return null }
        // Freeze only detached feature facts, never the shared live game graph.
        Object.freeze(facts.decision); Object.freeze(facts.checkpoint); Object.freeze(facts.assumption); Object.freeze(facts.result)
        return Object.freeze(facts)
      }
      const lease: ExplanationLease = Object.freeze({ read,
        onInvalidated(fn: () => void) {
          if (released) { try { fn() } catch { /* Isolated consumer. */ }; return () => {} }
          if (listeners.size >= 16) throw new Error('lease-listener-limit')
          listeners.add(fn); return () => { listeners.delete(fn) }
        },
        release: () => invalidate(),
      })
      if (!read()) return null
      issuedLeases.add(lease); leaseRevokers.add(invalidate)
      return lease
    },
    read(): ReviewDTO | null {
      if (!published || !current(published.ticket)) { published = undefined; retireLeases(true); return null }
      // Copies prevent callers from changing the controller's retained result.
      return structuredClone(published.result)
    },
    dispose() { unsubscribe?.(); unsubscribe = undefined; revoke(); active = null; epoch++; revision++ },
    debug() { return { epoch, revision, ordinal, lifecycle, active: !!active, pending: !!latest, hasResult: !!published } },
  }
}

/** Presentation eligibility only; verifier still reconstructs and proves every field. */
export function findBankDecision(game: GameState): number | null {
  if (game.gameplayProfile !== 'core-mvp-b18-multi-course-v1' || game.phase !== 'summary'
    || game.pendingPayment || game.settlement || game.termination) return null
  const decision = [...game.log].reverse().find(e => e.kind === 'decision' && e.eventId === 'bank'
    && e.decisionId === 'skip' && e.tileId === 17 && e.lap === game.lap)
  if (!decision) return null
  return game.log.some(e => e.kind === 'settlement' && e.sequence > decision.sequence
    && e.lap === decision.lap && e.after.turn === decision.before.turn + 1) ? decision.sequence : null
}
