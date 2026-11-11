import { listBankChoices, replayBank } from './bank-replay.ts'
import type { WhatIfDecision } from './orchestrator.ts'

export type BankRequest = { text: string; selection?: WhatIfDecision }
export type BankComparison = Awaited<ReturnType<typeof replayBank>>
export type BankReply = { kind: 'catalog'; catalog: WhatIfDecision[] }
  | { kind: 'final'; comparison: BankComparison } | { kind: 'blocked'; reason: string }

const worker = self as unknown as { onmessage: ((event: MessageEvent<BankRequest>) => void) | null; postMessage(reply: BankReply): void }
worker.onmessage = async ({ data }) => {
  worker.onmessage = null
  const { signal } = new AbortController()
  try {
    if (data.selection) worker.postMessage({ kind: 'final', comparison: await replayBank(data.text, data.selection, signal) })
    else worker.postMessage({ kind: 'catalog', catalog: await listBankChoices(data.text, signal) })
  } catch (error) {
    worker.postMessage({ kind: 'blocked', reason: error instanceof Error ? error.message.slice(0, 160) : 'bank-replay-failed' })
  }
}
