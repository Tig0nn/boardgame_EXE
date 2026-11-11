import { runCapturedReview, workerReason } from './bank-historical-worker-job.ts'
import type { WorkerInput } from './bank-historical-worker-contract.ts'
const scope = self as unknown as { onmessage: ((e: MessageEvent<WorkerInput>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = ({ data }) => {
  void runCapturedReview(data).then(value => scope.postMessage({ ok: true, value }),
    error => scope.postMessage({ ok: false, reason: workerReason(error) }))
}
