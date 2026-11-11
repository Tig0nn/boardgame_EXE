import { serializeLog } from '../../../src/game/log.ts'
import { contextFor, equal, Rejected, requireProof } from './bank-historical-contract.ts'
import { serializationEnvironment } from './bank-historical-integrity.ts'
import { verifyBank } from './bank-historical-what-if.ts'
import type { WorkerInput, VerifiedCapture } from './bank-historical-worker-contract.ts'

// One request per dedicated worker. No session, storage, network or React access.
export async function runCapturedReview(input: WorkerInput): Promise<VerifiedCapture> {
  requireProof(equal(input.environment, serializationEnvironment(input.snapshot)), 'engine-config-mismatch')
  const text = serializeLog(input.snapshot)
  const context = await contextFor(text, input.sequence)
  const envelope = await verifyBank(text, input.sequence, new AbortController().signal)
  return { context, envelope }
}
// This file is imported only by the worker entry (tests import runCapturedReview separately).
export function workerReason(error: unknown) { return error instanceof Rejected ? error.message : 'verification-failed' }
