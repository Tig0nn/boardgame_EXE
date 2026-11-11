import type {GameState} from '../../../src/game/types.ts'
import type {GoldContext,GoldEnvelope,GOLD_POLICY} from './gold-historical-contract.ts'
import type {goldSerializationEnvironment} from './gold-historical-integrity.ts'
export type GoldWorkerInput={snapshot:GameState;sequence:number;policy:typeof GOLD_POLICY;engine:string;environment:ReturnType<typeof goldSerializationEnvironment>}
export type GoldCapture={context:GoldContext;envelope:GoldEnvelope}
export type GoldExecutor=(snapshot:GameState,sequence:number,signal:AbortSignal,environment:GoldWorkerInput['environment'])=>Promise<GoldCapture>
