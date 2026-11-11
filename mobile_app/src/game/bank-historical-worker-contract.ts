import type { GameState } from '../../../src/game/types.ts'
import type { Context, Envelope } from './bank-historical-contract.ts'
import type { serializationEnvironment } from './bank-historical-integrity.ts'
export type WorkerInput = { snapshot: GameState; sequence: number; environment: ReturnType<typeof serializationEnvironment> }
export type VerifiedCapture = { context: Context; envelope: Envelope }
export type SnapshotExecutor = (snapshot: GameState, sequence: number, signal: AbortSignal,
  environment: WorkerInput['environment']) => Promise<VerifiedCapture>
