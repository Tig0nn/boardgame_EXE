import { Rejected } from './bank-historical-contract.ts'
import type { VerifiedCapture, SnapshotExecutor } from './bank-historical-worker-contract.ts'
type Port = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>
/** Per-request worker: close/abort/error/deadline/completion all terminate it. No shared queue. */
export function createWorkerExecutor(factory: () => Port = () => new Worker(new URL('./bank-historical.worker.ts', import.meta.url), { type: 'module', name: 'bank-historical-review' })): SnapshotExecutor {
  return (snapshot, sequence, signal, environment) => new Promise<VerifiedCapture>((resolve, reject) => {
    if (signal.aborted) { reject(new Rejected('cancelled')); return }
    let worker: Port
    try { worker = factory() } catch { reject(new Rejected('worker-unavailable')); return }
    let done = false
    const finish = (value?: VerifiedCapture, reason?: string) => {
      if (done) return; done = true
      clearTimeout(timeout); signal.removeEventListener('abort', abort)
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate()
      if (value) resolve(value); else reject(new Rejected(reason ?? 'worker-failed'))
    }
    const abort = () => finish(undefined, 'cancelled')
    const timeout = setTimeout(() => finish(undefined, 'execution-budget'), 25_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = e => {
      const data = e.data as { ok?: boolean; value?: VerifiedCapture; reason?: string }
      if (data?.ok === true && data.value?.context && data.value.envelope?.context && data.value.envelope.result) finish(data.value)
      else finish(undefined, typeof data?.reason === 'string' ? data.reason : 'worker-response-invalid')
    }
    worker.onerror = () => finish(undefined, 'worker-failed')
    worker.onmessageerror = () => finish(undefined, 'worker-response-invalid')
    try { worker.postMessage({ snapshot, sequence, environment }) } catch { finish(undefined, 'capture-failed') }
  })
}
