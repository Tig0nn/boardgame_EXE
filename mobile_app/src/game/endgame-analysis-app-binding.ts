import { serializeLog } from '../../../src/game/log.ts'
import type { GameState } from '../../../src/game/types.ts'
import { newEnvelope, TRANSPORT_LIMITS } from './endgame-analysis-protocol.ts'
import type { RequestKind, Response } from './endgame-analysis-protocol.ts'
import type { SourceInput } from './endgame-analysis-source.ts'
import { completedFour } from './endgame-whatif-comparison.ts'
import type { GoldResumeInput, GoldSelection } from './endgame-whatif-gold-contract.ts'
import { digest } from './endgame-whatif-identity.ts'
import { captureDataIntegrity } from './endgame-whatif-integrity.ts'
import { ENDGAME_ANALYSIS_BETA } from './endgame-analysis-feature.ts'

type Transport = 'T' | 'S'
type WorkerBinding = ReturnType<typeof import('./endgame-analysis-binding.ts').createAnalysisBinding>
export type EndgameSessionOrigin = 'fresh' | 'saved' | 'restored-state'

type ObservedSession = {
  getSnapshot(): GameState
  subscribe(listener: () => void): () => void
}
type Attachment = {
  session: ObservedSession
  origin: EndgameSessionOrigin
  incarnation: string
  epoch: number
  unsubscribe?: () => void
  snapshot?: GameState
  terminalAt?: number
}
type Capture = {
  attachment: Attachment
  snapshot: GameState
  envelope: ReturnType<typeof newEnvelope>
  transport?: WorkerBinding
  witness: () => boolean
  busy: boolean
}
type Observation = { stage: string; start: number; elapsedMs: number }
export type EndgameAppBinding = ReturnType<typeof createAppAnalysisBinding>
export type EndgameAppQaDriver = {
  transport: Transport
  connect(binding: EndgameAppBinding): (() => void) | undefined
}

const integrityGap = 'CAPTURE_INTEGRITY_GAP'
const performanceGap = 'CAPTURE_PERFORMANCE_GAP'
const captureBudgetMs = 100
const loadWorkerBinding = import.meta.env?.DEV || ENDGAME_ANALYSIS_BETA
  ? () => import('./endgame-analysis-binding.ts')
  : null

/** App ownership and live-state guards. All continuation work stays in the existing Worker. */
export function createAppAnalysisBinding({ transport }: { transport: Transport }) {
  let disposed = false
  let controllerIncarnation: string | null = null
  let epoch = 0
  let revision = 0
  let attachment: Attachment | undefined
  let capture: Capture | undefined
  let reason: string | null = null
  const observations: Observation[] = []

  function measure<T>(stage: string, work: () => T): T {
    const start = performance.now()
    try {
      return work()
    } finally {
      observations.push({ stage, start, elapsedMs: performance.now() - start })
      if (observations.length > 128) observations.shift()
    }
  }

  function releaseCapture(cause: string | null, cancel = false) {
    const old = capture
    capture = undefined
    reason = cause
    try {
      if (old) measure(cancel ? 'cancel' : 'dispose-capture', () => {
        if (cancel) old.transport?.cancel()
        else old.transport?.dispose()
      })
    } catch {
      // Authority is already revoked. A transport fault cannot escape into React.
    }
  }

  function detach(cause: string | null) {
    const old = attachment
    attachment = undefined
    releaseCapture(cause)
    try {
      old?.unsubscribe?.()
    } catch {
      // A stale listener still has no attachment authority.
    }
  }

  function observe(owner: Attachment) {
    if (attachment !== owner) return
    releaseCapture(null)
    owner.snapshot = undefined
    owner.terminalAt = undefined
    try {
      const snapshot = measure('session-read', () => owner.session.getSnapshot())
      if (completedFour(snapshot) && snapshot.log.length > 0) {
        owner.snapshot = snapshot
        owner.terminalAt = performance.now()
      }
    } catch {
      reason = integrityGap
    }
  }

  function replaceSession(session: ObservedSession, origin: EndgameSessionOrigin) {
    detach(null)
    if (disposed) return
    try {
      controllerIncarnation ??= crypto.randomUUID()
      if (!Number.isSafeInteger(epoch + 1)) throw Error('session epoch exhausted')
      const owner = { session, origin, incarnation: crypto.randomUUID(), epoch: ++epoch } as Attachment
      attachment = owner
      owner.unsubscribe = session.subscribe(() => observe(owner))
      observe(owner)
    } catch {
      detach(integrityGap)
    }
  }

  function valid(active: Capture, stage: string): boolean {
    if (capture !== active || attachment !== active.attachment || disposed) return false
    try {
      const start = performance.now()
      const current = measure(stage, () =>
        active.attachment.session.getSnapshot() === active.snapshot && active.witness())
      if (!current) releaseCapture(integrityGap)
      else if (performance.now() - start >= captureBudgetMs) releaseCapture(performanceGap)
      else return capture === active && attachment === active.attachment
    } catch {
      if (capture === active) releaseCapture(integrityGap)
    }
    return false
  }

  async function send(active: Capture, kind: RequestKind, body: Record<string, unknown>) {
    const response = await active.transport?.request(kind, body) ?? null
    if (!valid(active, 'publication-witness')) return null
    if (!response || response.kind === 'CANCELLED' || response.kind === 'ERROR' || response.kind === 'BLOCKED') {
      releaseCapture(typeof response?.body.reason === 'string' ? response.body.reason : integrityGap)
    }
    return response
  }

  async function prepare(): Promise<Response | null> {
    const owner = attachment
    if (!owner?.snapshot || !controllerIncarnation || capture || disposed) return null
    const snapshot = owner.snapshot
    let active: Capture | undefined
    try {
      const start = performance.now()
      if (measure('capture-session-read', () => owner.session.getSnapshot()) !== snapshot || !completedFour(snapshot) || snapshot.log.length === 0) {
        releaseCapture(integrityGap)
        return null
      }
      const witness = measure('capture-witness', () => captureDataIntegrity(snapshot))
      if (!Number.isSafeInteger(revision + 1)) throw Error('capture revision exhausted')
      active = {
        attachment: owner, snapshot, witness, busy: true,
        envelope: { ...newEnvelope(), controllerIncarnation, sessionIncarnation: owner.incarnation,
          sessionEpoch: owner.epoch, captureRevision: ++revision },
      }
      capture = active
      let source: SourceInput
      if (transport === 'T') {
        const text = measure('serialize-text', () => serializeLog(snapshot))
        if (text.length > TRANSPORT_LIMITS.wireBytes) {
          releaseCapture('transport-source-wire-cap')
          return null
        }
        if (performance.now() - start >= captureBudgetMs) {
          releaseCapture(performanceGap)
          return null
        }
        source = { kind: 'text', text }
        // Let the browser paint between serialization, hashing, and transport.
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        if (capture !== active || attachment !== owner) return null
        const hashStart = performance.now()
        const hashing = measure('text-hash-submit', () => digest(text))
        const hashSubmitMs = performance.now() - hashStart
        active.envelope.sourceHash = await hashing
        observations.push({ stage: 'text-hash-wall', start: hashStart, elapsedMs: performance.now() - hashStart })
        if (hashSubmitMs >= captureBudgetMs) {
          if (capture === active) releaseCapture(performanceGap)
          return null
        }
      } else if (transport === 'S') {
        source = { kind: 'snapshot', snapshot: measure('snapshot-clone', () => structuredClone(snapshot)) }
        if (performance.now() - start >= captureBudgetMs) {
          releaseCapture(performanceGap)
          return null
        }
      } else {
        releaseCapture('transport-unsupported')
        return null
      }
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      const workerModule = loadWorkerBinding ? await loadWorkerBinding() : null
      if (!valid(active, 'post-capture-witness')) return null
      if (!workerModule) {
        releaseCapture('transport-feature-disabled')
        return null
      }
      active.transport = workerModule.createAnalysisBinding()
      active.transport.activate(active.envelope)
      return await send(active, 'PREPARE_SOURCE', { source })
    } catch {
      if ((active && capture === active) || (!active && attachment === owner)) releaseCapture(integrityGap)
      return null
    } finally {
      if (active && capture === active) active.busy = false
    }
  }

  async function request(kind: RequestKind, body: Record<string, unknown>) {
    const active = capture
    if (!active || active.busy || !valid(active, 'request-witness')) return null
    active.busy = true
    try {
      return await send(active, kind, body)
    } catch {
      if (capture === active) releaseCapture(integrityGap)
      return null
    } finally {
      if (capture === active) active.busy = false
    }
  }

  return {
    replaceSession,
    prepare,
    list: () => request('LIST_ELIGIBLE_DECISIONS', {}),
    create: (selection: GoldSelection) => request('CREATE_ANALYSIS', { selection, alternative: 'skip' }),
    followUp: (input: GoldResumeInput) => request('FOLLOWUP_SELECTION', input),
    replayText() {
      const active = capture
      if (!active || active.busy || !valid(active, 'decision-source-witness') || !active.transport?.read()) return null
      try {
        const text = measure('decision-source-serialize', () => serializeLog(active.snapshot))
        return text.length <= TRANSPORT_LIMITS.wireBytes && valid(active, 'decision-source-publication') ? text : null
      } catch { releaseCapture(integrityGap); return null }
    },
    read() {
      const active = capture
      if (!active || active.busy || !valid(active, 'read-witness')) return null
      try {
        return active.transport?.read() ?? null
      } catch {
        releaseCapture(integrityGap)
        return null
      }
    },
    cancel() { releaseCapture('cancelled', true) },
    revoke(cause: 'home') { detach(cause) },
    dispose() {
      if (disposed) return
      disposed = true
      detach('disposed')
    },
    inspect() {
      return {
        controllerIncarnation, sessionIncarnation: attachment?.incarnation ?? null,
        sessionEpoch: epoch, origin: attachment?.origin ?? null, terminal: !!attachment?.snapshot,
        terminalAt: attachment?.terminalAt ?? null, captureId: capture?.envelope.captureId ?? null,
        captureRevision: capture?.envelope.captureRevision ?? null, reason,
        worker: capture?.transport?.debug().client ?? null,
        observations: observations.map(item => ({ ...item })),
      }
    },
  }
}
