import { ApiError } from '../errors.ts'
import { elapsedMs, postgresFailure } from '../observability.ts'

export type WhatIfStage = 'authentication' | 'ownership' | 'session_query' | 'final_snapshot_read'
  | 'genesis_snapshot_read' | 'fork_snapshot_read' | 'action_history_read' | 'transaction'
  | 'snapshot_restore' | 'genesis_hash' | 'action_replay' | 'final_hash' | 'fork_hash'
  | 'decision_catalog' | 'alternative_replay' | 'coach' | 'response_serialization' | 'analysis' | 'budget'
  | 'canonical_serialization' | 'canonical_sha256'
export type WhatIfTiming = {
  stage: WhatIfStage; durationMs: number; outcome: 'ok' | 'error'
  stateVersion?: number; payloadBytes?: number; errorCode?: string; sqlState?: string
  reason?: 'deadline' | 'aborted' | 'step-limit'; lastStage?: WhatIfStage
}
export type WhatIfObserver = (event: WhatIfTiming) => void

// Only allowlisted metadata leaves this boundary. Never forward Error.message,
// queries, user/session identifiers, snapshot content, or request bodies.
export class WhatIfTrace {
  stateVersion?: number
  lastStage?: WhatIfStage
  private readonly observer: WhatIfObserver
  constructor(observer: WhatIfObserver) { this.observer = observer }
  record(stage: WhatIfStage, started: number, outcome: 'ok' | 'error' = 'ok',
    fields: Partial<Pick<WhatIfTiming, 'payloadBytes' | 'reason' | 'lastStage' | 'errorCode'>> = {}, error?: unknown) {
    const failure = postgresFailure(error)
    const code = error instanceof ApiError ? error.code : fields.errorCode
    const event: WhatIfTiming = { stage, durationMs: elapsedMs(started), outcome,
      ...(this.stateVersion === undefined ? {} : { stateVersion: this.stateVersion }),
      ...(fields.payloadBytes === undefined ? {} : { payloadBytes: fields.payloadBytes }),
      ...(fields.reason === undefined ? {} : { reason: fields.reason }),
      ...(fields.lastStage === undefined ? {} : { lastStage: fields.lastStage }),
      ...(code && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? { errorCode: code } : {}),
      ...(failure?.sqlState ? { sqlState: failure.sqlState } : {}),
    }
    // Observability must never change an official result or turn a read into a failure.
    try { this.observer(event) } catch { /* A failing observer cannot change gameplay. */ }
  }
  sync<T>(stage: WhatIfStage, operation: () => T, fields?: { payloadBytes?: number }): T {
    const started = performance.now()
    this.lastStage = stage
    try {
      const value = operation()
      this.record(stage, started, 'ok', fields)
      return value
    } catch (error) {
      this.record(stage, started, 'error', fields, error)
      throw error
    }
  }
  async run<T>(stage: WhatIfStage, operation: () => Promise<T>, fields?: (value: T) => { payloadBytes?: number }): Promise<T> {
    const started = performance.now()
    this.lastStage = stage
    try {
      const value = await operation()
      this.record(stage, started, 'ok', fields?.(value))
      return value
    } catch (error) {
      this.record(stage, started, 'error', {}, error)
      throw error
    }
  }
}
