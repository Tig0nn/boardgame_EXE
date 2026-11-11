import type { GameState } from '../../../src/game/types.ts'
export const ENGINE_SOURCE = '5a9f6aa4907ad5d2e2013fe68d6d22fa10debd9e3c93c2c01ced11f2494d8415'
export const ENGINE_VERSION = `g4b2-bank-v1:${ENGINE_SOURCE}`
export type Session = { getSnapshot(): GameState; subscribe(listener: () => void): () => void }
export type Decision = { sequence: number; turn: number; lap: number; tileId: number; eventId: 'bank'; decisionId: 'skip' }
export type Checkpoint = { sequence: number; lap: number; turn: number } | null
export type Context = { transcript: string; prefix: string; config: string; engine: string; decision: Decision; checkpoint: Checkpoint }
export type ReviewDTO = { status: 'blocked'; reason: string }
  | { status: 'known'; principal: number; cashNow: number; cashIfDeposit: number; rate: number; term: 1; lockedUntilLap: number }
  | { status: 'supported'; principal: number; actualCash: number; alternativeCash: number; difference: number;
      actualLiquidBuffer: number; alternativeLiquidBuffer: number; fees: number; debt: number; obligations: number;
      checkpointLap: number; checkpointTurn: number }
export type Envelope = { context: Context; result: ReviewDTO }
export type Verifier = (text: string, sequence: number, signal: AbortSignal) => Promise<Envelope>
export class Rejected extends Error {}
export function requireProof(value: unknown, reason: string): asserts value { if (!value) throw new Rejected(reason) }
export const json = (value: unknown) => JSON.stringify(value)
const stable = (v: unknown) => JSON.stringify(v, (_key, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x)
export const equal = (a: unknown, b: unknown) => stable(a) === stable(b)
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(json(value))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')
}
export function parseSource(text: string) {
  requireProof(text.length <= 20_000_000, 'source-too-large')
  const data = JSON.parse(text) as { schemaVersion: number; rulesVersion: string; state: GameState; entries: GameState['log']; financialConfig: unknown }
  requireProof(data.schemaVersion === 7 && data.state?.gameplayProfile === 'core-mvp-b18-multi-course-v1'
    && data.rulesVersion === 'gameplay-core-mvp-b18-multi-course-v1' && data.state.totalLaps === 4, 'version-unsupported')
  requireProof(Array.isArray(data.entries) && data.entries.length > 0 && data.entries.length <= 500
    && equal(data.entries, data.state.log) && data.entries.every((e, i) => e.sequence === i + 1), 'history-invalid')
  return data
}
export async function contextFor(text: string, sequence: number): Promise<Context> {
  const data = parseSource(text)
  requireProof(Number.isSafeInteger(sequence) && sequence > 1, 'decision-missing')
  const e = data.entries[sequence - 1]
  requireProof(e?.kind === 'decision' && e.eventId === 'bank' && e.decisionId === 'skip', 'explicit-bank-skip-required')
  requireProof(e.tileId === 17 && e.before.position === 17, 'boundary-unsupported')
  const next = data.entries.find(x => x.sequence > sequence && ['roll', 'decision', 'rebalancing', 'funding'].includes(x.kind))
  const completed = next?.kind === 'roll' ? data.entries.find(x => x.sequence > next.sequence && x.kind === 'settlement'
    && x.lap === e.lap && x.after.turn === e.before.turn + 1) : undefined
  return { transcript: await digest(text), prefix: await digest(data.entries.slice(0, sequence)),
    config: await digest(data.financialConfig), engine: ENGINE_VERSION,
    decision: { sequence, turn: e.turn, lap: e.lap, tileId: e.tileId, eventId: 'bank', decisionId: 'skip' },
    checkpoint: completed ? { sequence: completed.sequence, lap: completed.lap, turn: completed.after.turn } : null }
}
