import type { BankComparison, BankReply, BankRequest } from './bank.worker.ts'
import { explainWhatIf, runWhatIfPrompt } from './orchestrator.ts'
import type { WhatIfProvider } from './orchestrator.ts'

type Port = Pick<Worker, 'onmessage' | 'onerror' | 'onmessageerror' | 'postMessage' | 'terminate'>

/** One request per Worker. An abort or missed deadline terminates the worker and removes its listeners. */
export function requestBank(input: BankRequest, signal: AbortSignal,
  factory: () => Port = () => new Worker(new URL('./bank.worker.ts', import.meta.url), { type: 'module', name: 'endgame-bank-ai' }),
) {
  return new Promise<BankReply>((resolve, reject) => {
    signal.throwIfAborted()
    const worker = factory()
    let active = true
    function finish(reply: BankReply | null, error?: unknown) {
      if (!active) return
      active = false
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      worker.onmessage = worker.onerror = worker.onmessageerror = null
      worker.terminate()
      if (reply) resolve(reply)
      else reject(error)
    }
    const abort = () => finish(null, signal.reason)
    const fail = () => finish(null, new Error('bank-worker-failed'))
    const timer = setTimeout(() => finish(null, new Error('bank-worker-timeout')), 35_000)
    signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }: MessageEvent<BankReply>) => {
      if (data?.kind !== 'blocked' && data?.kind !== (input.selection ? 'final' : 'catalog')) fail()
      else finish(data)
    }
    worker.onerror = worker.onmessageerror = fail
    try { worker.postMessage(input) } catch (error) { finish(null, error) }
  })
}

export async function askBank(text: string, provider: WhatIfProvider, question: string, signal: AbortSignal, request = requestBank): Promise<BankReply> {
  const prepared = await request({ text }, signal)
  signal.throwIfAborted()
  if (prepared.kind !== 'catalog') return prepared
  let reply: BankReply = { kind: 'blocked', reason: 'bank-question-unsupported' }
  await runWhatIfPrompt(provider, question, prepared.catalog, signal, async selection => {
    reply = await request({ text, selection }, signal)
  })
  return reply
}

export function explainBank(provider: WhatIfProvider, comparison: BankComparison, signal: AbortSignal) {
  const delta = comparison.delta.cash
  return explainWhatIf(provider, { kind: 'bank', direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged',
    confirmedFollowUp: false }, signal)
}
