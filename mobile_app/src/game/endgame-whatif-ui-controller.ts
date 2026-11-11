import { money, signedMoney } from '../../../src/game/format.ts'
import type { EndgameAppBinding } from './endgame-analysis-app-binding.ts'
import { validateResponse } from './endgame-analysis-protocol.ts'
import type { Envelope, FinalCore, Response } from './endgame-analysis-protocol.ts'
import type { SourceIdentity } from './endgame-analysis-source.ts'
import type { GoldBlocker, GoldContinuationIdentity, GoldSelection } from './endgame-whatif-gold-contract.ts'
import { equalData } from './endgame-whatif-identity.ts'

export type SessionWatch = (listener: () => void) => () => void
type Inspection = Pick<ReturnType<EndgameAppBinding['inspect']>,
  'terminal' | 'reason' | 'controllerIncarnation' | 'sessionIncarnation' | 'sessionEpoch' | 'captureId' | 'captureRevision'>
type Binding = Pick<EndgameAppBinding, 'prepare' | 'list' | 'create' | 'followUp' | 'read' | 'cancel'> & {
  inspect(): Inspection
}

const ownerFields = ['controllerIncarnation', 'sessionIncarnation', 'sessionEpoch'] as const
const captureFields = [...ownerFields, 'captureId', 'captureRevision'] as const
type Lease = {
  owner: Inspection
  capture?: Inspection
  source?: Pick<SourceIdentity, 'sourceHash' | 'configHash'>
  generation?: string
  catalog?: GoldSelection[]
  pending?: { continuation: GoldContinuationIdentity; blocker: GoldBlocker }
  final?: { envelope: Envelope; continuation: GoldContinuationIdentity }
}

type DecisionView = { sequence: number; lap: number; turn: number; amount: string }
type ComparisonRow = { key: string; label: string; actual: string; alternative: string; delta: string; direction: string }
type Failure = 'blocked' | 'limited' | 'unavailable' | 'revoked' | 'timeout' | 'cancelled'
export type EndgameView =
  | { kind: 'ineligible' | 'closed' | 'verifying' | 'verified' | 'creating' | 'resuming' | 'final-read' | Failure }
  | { kind: 'catalog'; decisions: DecisionView[] }
  | { kind: 'followup'; sequence: number; lap: number; turn: number; hasNoGold: boolean }
  | { kind: 'final'; rows: ComparisonRow[]; combined: boolean; lap: number; turn: number; goalTarget: string }

export function isEndgameDevQuery(search: string) {
  const params = new URLSearchParams(search)
  const flags = params.getAll('endgameWhatIf')
  return flags.length === 1 && flags[0] === '1' && ![
    'whatIfDemo', 'whatIf', 'historicalWhatIf', 'goldHistoricalWhatIf', 'repairAi', 'universalAi',
  ].some(name => params.has(name))
}

const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const signedPoints = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })
const direction = (value: number) => value > 0 ? 'Tăng' : value < 0 ? 'Giảm' : 'Không đổi'
const moneyKeys = [
  ['cash', 'Tiền mặt'], ['totalWorth', 'Tổng tài sản ròng'],
  ['liquidatableFunds', 'Tiền có thể thu về'], ['debt', 'Nợ'], ['obligations', 'Nghĩa vụ phải trả'],
  ['goalRemaining', 'Còn thiếu để đạt mục tiêu'],
] as const

function projectFinal(body: Pick<FinalCore, 'actual' | 'alternative' | 'delta' | 'attribution' | 'endings'>): EndgameView {
  const { actual, alternative, delta, attribution, endings } = body
  const rows: ComparisonRow[] = []
  for (const [key, label] of moneyKeys) {
    if ((key === 'debt' || key === 'obligations') && actual[key] === 0 && alternative[key] === 0) continue
    rows.push({
      key, label, actual: money(actual[key]), alternative: money(alternative[key]),
      delta: signedMoney(delta[key]), direction: direction(delta[key]),
    })
  }
  const points = delta.goalPercent
  rows.push({
    key: 'goalPercent', label: 'Tiến độ mục tiêu',
    actual: percent.format(actual.goalPercent) + '%', alternative: percent.format(alternative.goalPercent) + '%',
    delta: points !== 0 && Math.abs(points) < 0.01
      ? (points > 0 ? '+' : '−') + '<0,01 điểm %' : signedPoints.format(points) + ' điểm %',
    direction: direction(points),
  })
  return { kind: 'final', rows, combined: attribution.combinedConsequences,
    lap: endings.actual.lap, turn: endings.actual.turn, goalTarget: money(actual.goalTarget) }
}

function failure(reason: string | null, kind?: Response['kind']): Failure {
  if (reason === 'transport-timeout-unknown-commit') return 'timeout'
  if (reason === 'CAPTURE_INTEGRITY_GAP') return 'revoked'
  if (kind === 'LIMITED' || reason === 'CAPTURE_PERFORMANCE_GAP' || reason?.endsWith('-cap') && reason !== 'transport-worker-cap') return 'limited'
  if (kind === 'CANCELLED' && (reason === 'cancelled' || reason === 'transport-cancelled')) return 'cancelled'
  if (kind === 'ERROR' || reason === 'transport-request-invalid' || reason === 'transport-feature-disabled'
    || reason === 'transport-worker-cap' || reason?.endsWith('-unknown-commit')) return 'unavailable'
  return reason || kind === 'BLOCKED' ? 'blocked' : 'revoked'
}

/** All financial display authority stays tied to one active App capture and one panel opening. */
export function createEndgameUiController(binding: Binding) {
  let view: EndgameView = { kind: 'ineligible' }
  let lease: Lease | undefined
  let mounted: object | undefined
  const listeners = new Set<() => void>()

  function publish(next: EndgameView) {
    view = next
    listeners.forEach(listener => listener())
  }
  const sameOwner = (active: Lease, status: Inspection) =>
    status.terminal && ownerFields.every(field => status[field] === active.owner[field])
  const sameCapture = (active: Lease, status: Inspection | Envelope) => {
    const capture = active.capture
    return !!capture && captureFields.every(field => status[field] === capture[field])
  }

  function retire(next: EndgameView) {
    const old = lease
    lease = undefined
    // Drop view authority synchronously, including while cancel ACK is pending.
    publish(next)
    if (old && sameCapture(old, binding.inspect())) binding.cancel()
  }

  function observe() {
    const current = binding.inspect()
    retire({ kind: lease ? 'revoked' : current.terminal ? 'closed' : 'ineligible' })
  }

  async function request(active: Lease, work: () => Promise<Response | null>, onSuccess: (result: Response) => void) {
    try {
      const before = binding.inspect()
      if (lease !== active) return
      if (!sameOwner(active, before) || (active.capture ? !sameCapture(active, before) : !!before.captureId)) {
        retire({ kind: 'revoked' })
        return
      }
      const pending = work()
      // App prepare allocates the capture synchronously before yielding to the Worker.
      if (!active.capture) {
        const current = binding.inspect()
        if (sameOwner(active, current) && current.captureId && current.captureRevision !== null) {
          active.capture = current
        }
      }
      const response = await pending
      if (lease !== active) return
      const current = binding.inspect()
      if (!sameOwner(active, current)) { retire({ kind: 'revoked' }); return }
      if (!response || ['LIMITED', 'BLOCKED', 'ERROR', 'CANCELLED'].includes(response.kind)) {
        const reason = typeof response?.body.reason === 'string' ? response.body.reason : current.reason
        retire({ kind: failure(reason, response?.kind) })
        return
      }
      validateResponse(response)
      const e = response.envelope
      if (!sameCapture(active, current) || !sameCapture(active, e) ||
        (active.generation && e.workerGeneration !== active.generation) ||
        (active.source && (e.sourceHash !== active.source.sourceHash || e.configHash !== active.source.configHash))) {
        retire({ kind: 'revoked' })
        return
      }
      onSuccess(response)
    } catch {
      if (lease === active) retire({ kind: 'blocked' })
    }
  }

  function acceptBranch(active: Lease, result: Response, selection: GoldSelection, prior?: GoldContinuationIdentity) {
    if (result.kind !== 'NEEDS_FOLLOWUP' && result.kind !== 'SUPPORTED_FINAL') {
      retire({ kind: 'blocked' })
      return
    }
    const continuation = result.body.continuation as GoldContinuationIdentity
    if (!equalData(continuation.selection, selection) || !equalData(result.envelope.decision, selection.decision)
      || (prior ? prior.branchId !== continuation.branchId || prior.revision + 1 !== continuation.revision : continuation.revision !== 0)) {
      retire({ kind: 'revoked' })
      return
    }
    if (result.kind === 'SUPPORTED_FINAL') {
      active.final = { envelope: result.envelope, continuation }
      active.pending = undefined
      publish({ kind: 'final-read' })
      return
    }
    const blocker = result.body.blocker as GoldBlocker
    if (!blocker.choices.length || !blocker.actualSaleLegal || !blocker.externalEqual || blocker.commandApplied) {
      retire({ kind: 'limited' })
      return
    }
    active.pending = { continuation, blocker }
    const { sequence, lap, turn } = blocker.command
    publish({ kind: 'followup', sequence, lap, turn, hasNoGold: blocker.alternativeGoldUnits === 0 })
  }

  return {
    mount(watch: SessionWatch) {
      const registration = {}
      mounted = registration
      const unsubscribe = watch(() => { if (mounted === registration) observe() })
      observe()
      return () => {
        unsubscribe()
        if (mounted !== registration) return
        mounted = undefined
        retire({ kind: 'ineligible' })
      }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => view,
    async open() {
      if (!mounted || view.kind !== 'closed') return
      const owner = binding.inspect()
      if (!owner.terminal || !owner.controllerIncarnation || !owner.sessionIncarnation) {
        publish({ kind: 'ineligible' })
        return
      }
      if (owner.captureId) { publish({ kind: 'unavailable' }); return }
      const active: Lease = { owner }
      lease = active
      publish({ kind: 'verifying' })
      await request(active, binding.prepare, source => {
        if (source.kind !== 'SOURCE_VERIFIED') { retire({ kind: 'blocked' }); return }
        const { sourceHash, configHash } = source.body.identity as SourceIdentity
        active.source = { sourceHash, configHash }
        active.generation = source.envelope.workerGeneration
        publish({ kind: 'verified' })
      })
      if (lease !== active || !active.source) return
      await request(active, binding.list, result => {
        if (result.kind !== 'DECISIONS_READY') { retire({ kind: 'blocked' }); return }
        const catalog = result.body.decisions as GoldSelection[]
        if (!catalog.length) { retire({ kind: 'limited' }); return }
        if (catalog.some(d => d.sourceHash !== active.source?.sourceHash || d.configHash !== active.source?.configHash)) {
          retire({ kind: 'revoked' })
          return
        }
        active.catalog = catalog
        publish({ kind: 'catalog', decisions: catalog.map(({ decision }) => ({
          sequence: decision.sequence, lap: decision.lap, turn: decision.turn, amount: money(decision.action!.amount),
        })) })
      })
    },
    async create(sequence: number, alternative: 'skip' | null) {
      const active = lease
      const selection = active?.catalog?.find(candidate => candidate.decision.sequence === sequence)
      if (!active || view.kind !== 'catalog' || !selection || alternative !== 'skip') return
      publish({ kind: 'creating' })
      await request(active, () => binding.create(selection), result => acceptBranch(active, result, selection))
    },
    async followUp() {
      const active = lease
      const pending = active?.pending
      const choice = pending?.blocker.choices[0]?.action
      if (!active || view.kind !== 'followup' || !pending || !choice) return
      publish({ kind: 'resuming' })
      await request(active, () => binding.followUp({ ...pending, choice }),
        result => acceptBranch(active, result, pending.continuation.selection, pending.continuation))
    },
    readFinal() {
      const active = lease
      const expected = active?.final
      if (!active || !expected || (view.kind !== 'final-read' && view.kind !== 'final')) return
      const current = binding.inspect()
      if (!sameOwner(active, current) || !sameCapture(active, current)) { retire({ kind: 'revoked' }); return }
      const result = binding.read()
      if (lease !== active) return
      if (!result || result.kind !== 'SUPPORTED_FINAL' || !equalData(result.envelope, expected.envelope)
        || !equalData(result.body.continuation, expected.continuation) || !sameCapture(active, binding.inspect())) {
        retire({ kind: 'revoked' })
        return
      }
      try {
        validateResponse(result)
        if (view.kind === 'final-read') {
          publish(projectFinal(result.body as Pick<FinalCore, 'actual' | 'alternative' | 'delta' | 'attribution' | 'endings'>))
        }
      } catch {
        retire({ kind: 'revoked' })
      }
    },
    close() {
      retire({ kind: mounted && binding.inspect().terminal ? 'closed' : 'ineligible' })
    },
  }
}
