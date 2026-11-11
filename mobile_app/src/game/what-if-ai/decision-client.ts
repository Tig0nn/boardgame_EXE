import { signedMetrics } from '../endgame-whatif-comparison.ts'
import { requireEndgame } from '../endgame-whatif-contract.ts'
import { captureDataIntegrity } from '../endgame-whatif-integrity.ts'
import { equalData } from '../endgame-whatif-identity.ts'
import type { DecisionCommand, DecisionResponse, DecisionResult } from './decision.worker.ts'
import type { ReplayKind } from './decision-adapters.ts'
import { runWhatIfPrompt } from './orchestrator.ts'
import type { WhatIfProvider } from './orchestrator.ts'
import { validateProviderRequest } from '../../../../src/ai/what-if/contracts.ts'

type Port = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>

function validateResult(result: DecisionResult) {
  captureDataIntegrity(result)
  requireEndgame(JSON.stringify(result).length < 65_536, 'decision-response-cap')
  requireEndgame(['catalog', 'catalog-page', 'supported-final', 'needs-followup', 'blocked', 'cancelled'].includes(result.status), 'decision-response-invalid')
  const keys = result.status === 'catalog' ? ['decisions', 'status']
    : result.status === 'catalog-page' ? ['page', 'status'] : result.status === 'supported-final' ? ['comparison', 'status']
      : result.status === 'needs-followup' ? ['followUp', 'status'] : ['reason', 'status']
  requireEndgame(equalData(Object.keys(result).sort(), keys), 'decision-response-fields')
  if (result.status === 'catalog-page') {
    const page = result.page
    requireEndgame(Array.isArray(page.history) && page.history.length <= 16 && Array.isArray(page.decisions) && page.decisions.length <= 16
      && Number.isSafeInteger(page.total) && page.total >= 0 && page.total <= 500
      && Number.isSafeInteger(page.offset) && page.offset >= 0 && page.offset <= 500
      && (page.nextOffset === null || Number.isSafeInteger(page.nextOffset) && page.nextOffset > page.offset && page.nextOffset < page.total), 'decision-page-invalid')
    if (page.decisions.length) validateProviderRequest({ operation: 'propose', question: 'Lựa chọn đã xác minh', catalog: page.decisions })
    requireEndgame(page.history.every(entry => Number.isSafeInteger(entry.sequence) && entry.sequence > 0 && entry.sequence <= 500
      && Number.isSafeInteger(entry.lap) && entry.lap >= 1 && entry.lap <= 4 && Number.isSafeInteger(entry.turn)
      && typeof entry.action === 'string' && entry.action.length <= 64
      && (entry.symbolId === undefined || typeof entry.symbolId === 'string' && /^[A-Z0-9-]{1,16}$/.test(entry.symbolId))
      && (entry.issuerId === undefined || ['an-tam', 'but-pha'].includes(entry.issuerId))
      && (entry.lotId === undefined || typeof entry.lotId === 'string' && /^bond-[1-9][0-9]{0,2}$/.test(entry.lotId))
      && (entry.description === undefined || typeof entry.description === 'string' && entry.description.length <= 240)), 'decision-history-invalid')
    if (page.controls) {
      const c = page.controls
      requireEndgame(equalData(Object.keys(c).sort(), ['cash', 'issuers', 'lots', 'stockSellMax', 'symbols', 'terms'])
        && [c.cash, c.stockSellMax].every(value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)
        && Array.isArray(c.symbols) && c.symbols.length <= 16 && c.symbols.every(id => typeof id === 'string' && /^[A-Z0-9-]{1,16}$/.test(id))
        && Array.isArray(c.issuers) && c.issuers.length <= 2 && c.issuers.every(id => ['an-tam', 'but-pha'].includes(id))
        && Array.isArray(c.lots) && c.lots.length <= 500 && c.lots.every(lot => equalData(Object.keys(lot).sort(), ['available', 'id'])
          && /^bond-[1-9][0-9]{0,2}$/.test(lot.id) && Number.isFinite(lot.available) && lot.available > 0)
        && equalData(c.terms, [1, 2, 3]), 'decision-controls-invalid')
    }
  }
  if (result.status === 'supported-final') {
    const { actual, alternative, delta, proof, lap } = result.comparison
    const calculated = signedMetrics(actual, alternative)
    requireEndgame(lap === 4 && proof.actualReplay === true && proof.alternativeReplay === true && proof.sourceUnchanged === true
      && /^[a-f0-9]{64}$/.test(proof.alternativeExportHash) && Object.values(calculated).every(Number.isFinite)
      && equalData(delta, calculated), 'decision-comparison-unproved')
  } else requireEndgame(!Object.hasOwn(result, 'comparison'), 'decision-unverified-numbers')
}

/** A single private Worker owns the source and explicit transcript until completion, cancellation, or timeout. */
export function createDecisionClient(signal: AbortSignal,
  factory: () => Port = () => new Worker(new URL('./decision.worker.ts', import.meta.url), { type: 'module', name: 'b18-decision-analysis' }),
  deadlineMs = 35_000,
) {
  signal.throwIfAborted()
  requireEndgame(Number.isSafeInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= 35_000, 'decision-deadline')
  const worker = factory()
  let ordinal = 0, disposed = false, published: DecisionResult | null = null
  let pending: { id: number; expected: string[]; resolve(result: DecisionResult): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> } | undefined
  function release(reason: string) {
    if (disposed) return
    disposed = true
    published = null
    worker.onmessage = worker.onerror = worker.onmessageerror = null
    worker.terminate()
    signal.removeEventListener('abort', abort)
    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(new DOMException(reason, 'AbortError'))
      pending = undefined
    }
  }
  const dispose = () => release('decision-worker-cancelled')
  const abort = () => dispose()
  signal.addEventListener('abort', abort, { once: true })
  worker.onerror = worker.onmessageerror = dispose
  worker.onmessage = ({ data }: MessageEvent<DecisionResponse>) => {
    const active = pending
    if (!active || disposed || data?.id !== active.id) return
    try {
      validateResult(data.result)
      requireEndgame(active.expected.includes(data.result.status) || ['blocked', 'cancelled'].includes(data.result.status), 'decision-response-phase')
      clearTimeout(active.timer)
      pending = undefined
      published = structuredClone(data.result)
      active.resolve(structuredClone(published))
    } catch { dispose() }
  }
  async function request(command: DecisionCommand): Promise<DecisionResult> {
    signal.throwIfAborted()
    requireEndgame(!disposed && !pending, 'decision-client-unavailable')
    captureDataIntegrity(command)
    const expected = command.kind === 'catalog' ? [command.query ? 'catalog-page' : 'catalog'] : ['supported-final', 'needs-followup']
    published = null
    return new Promise((resolve, reject) => {
      const id = ++ordinal, timer = setTimeout(() => release('decision-worker-timeout'), deadlineMs)
      pending = { id, timer, resolve, reject, expected }
      try { worker.postMessage(structuredClone({ ...command, id })) } catch { dispose() }
    })
  }
  return { request, dispose, read: () => published ? structuredClone(published) : null }
}

export async function askDecision(client: ReturnType<typeof createDecisionClient>, text: string, kind: ReplayKind,
  provider: WhatIfProvider, question: string, signal: AbortSignal,
) {
  const catalog = await client.request({ kind: 'catalog', text, scenario: kind })
  if (catalog.status !== 'catalog') return catalog
  const outcome = await runWhatIfPrompt(provider, question, catalog.decisions, signal, async selection => {
    await client.request({ kind: 'create', selection })
  })
  if (outcome === 'unsupported') return { status: 'blocked', reason: 'decision-question-unsupported' } as const
  signal.throwIfAborted()
  return client.read()
}
