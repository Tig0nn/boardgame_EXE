import { performance } from 'node:perf_hooks'

type SnapshotOperation = 'snapshot_insert' | 'snapshot_read' | 'session_state_read'
type SnapshotFields = { stateVersion?: number; payloadBytes?: number }
type SnapshotEvent = SnapshotFields & {
  operation: SnapshotOperation; durationMs: number; sqlState?: string; category?: string; outcome: 'ok' | 'error'
}
export type SnapshotObserver = (event: SnapshotEvent) => void

export function postgresFailure(error: unknown) {
  for (let depth = 0; error instanceof Error && depth < 5; depth++) {
    if ('severity' in error && 'code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) {
      const sqlState = error.code
      const category = sqlState === '57014' ? 'query_cancelled'
        : sqlState === '55P03' ? 'lock_unavailable'
        : sqlState.startsWith('08') ? 'database_connection'
        : sqlState.startsWith('23') ? 'database_constraint'
        : 'database_query'
      return { sqlState, category }
    }
    if ('code' in error && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE'].includes(String(error.code))) {
      return { category: 'database_connection' }
    }
    error = error.cause
  }
}

export function elapsedMs(started: number) {
  return Math.round((performance.now() - started) * 10) / 10
}

export async function observeSnapshot<T>(observer: SnapshotObserver | undefined, operation: SnapshotOperation,
  fields: SnapshotFields, query: () => Promise<T>) {
  if (!observer) return query()
  const started = performance.now()
  let result
  try {
    result = await query()
  } catch (error) {
    observer({ operation, ...fields, durationMs: elapsedMs(started), outcome: 'error', ...postgresFailure(error) })
    throw error
  }
  observer({ operation, ...fields, durationMs: elapsedMs(started), outcome: 'ok' })
  return result
}
