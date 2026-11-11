import {serializeLog} from '../../../src/game/log.ts'
import {GOLD_POLICY,GOLD_ENGINE_VERSION,goldEqual,goldContextFor,GoldRejected,requireGold} from './gold-historical-contract.ts'
import {goldSerializationEnvironment} from './gold-historical-integrity.ts'
import {verifyGold} from './gold-historical-what-if.ts'
import type {GoldWorkerInput,GoldCapture} from './gold-historical-worker-contract.ts'
/** One request's copied graph only. No storage/network/session access. */
export async function runGoldCapture(input:GoldWorkerInput):Promise<GoldCapture>{
 requireGold(input.policy===GOLD_POLICY,'policy-unsupported');requireGold(input.engine===GOLD_ENGINE_VERSION,'engine-version-unsupported');requireGold(goldEqual(input.environment,goldSerializationEnvironment(input.snapshot)),'engine-config-mismatch')
 const text=serializeLog(input.snapshot),context=await goldContextFor(text,input.sequence),envelope=await verifyGold(text,input.sequence,new AbortController().signal,input.policy,input.engine)
 return{context,envelope}
}
export const goldWorkerReason=(error:unknown)=>error instanceof GoldRejected?error.message:'verification-failed'
