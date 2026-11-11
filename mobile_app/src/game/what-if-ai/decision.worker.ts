import { requireEndgame } from '../endgame-whatif-contract.ts'
import { captureDataIntegrity } from '../endgame-whatif-integrity.ts'
import { equalData } from '../endgame-whatif-identity.ts'
import { createDecisionReplay, listDecisionChoices, listDecisionPage } from './decision-replay.ts'
import type { CatalogPage, CatalogQuery } from './flexible-catalog.ts'
import type { ReplayResult } from './decision-replay.ts'
import type { ReplayKind } from './decision-adapters.ts'
import type { WhatIfDecision } from './orchestrator.ts'

export type DecisionCommand =
  { kind: 'catalog'; text?: string; scenario: ReplayKind; query?: CatalogQuery } | { kind: 'create'; selection: WhatIfDecision }
  | { kind: 'followup'; choice: { id: string; optionId: string } }
export type DecisionRequest = DecisionCommand & { id: number }
export type DecisionResult = ReplayResult | { status: 'catalog'; decisions: WhatIfDecision[] }
  | { status: 'catalog-page'; page: CatalogPage }
export type DecisionResponse = { id: number; result: DecisionResult }

const worker = self as unknown as { onmessage: ((event: MessageEvent<DecisionRequest>) => void) | null; postMessage(reply: DecisionResponse): void }
let source: { text: string; scenario: ReplayKind; decisions: WhatIfDecision[] } | undefined
let session: Awaited<ReturnType<typeof createDecisionReplay>> | undefined
let busy = false, ordinal = 0
worker.onmessage = async ({ data }) => {
  if (busy) return
  busy = true
  try {
    captureDataIntegrity(data)
    requireEndgame(Number.isSafeInteger(data.id) && data.id === ordinal + 1, 'decision-request-order')
    ordinal = data.id
    let result: DecisionResult
    if (data.kind === 'catalog') {
      if (source) source.decisions = []
      requireEndgame(!session && (!source || source.scenario === data.scenario && (!data.text || source.text === data.text)), 'decision-worker-phase')
      const text = source?.text ?? data.text
      requireEndgame(typeof text === 'string', 'decision-source-required')
      if (data.query) {
        const page = await listDecisionPage(text, data.scenario, data.query, { maxMilliseconds: 30_000 })
        source = { text, scenario: data.scenario, decisions: page.decisions }
        result = { status: 'catalog-page', page }
      } else {
        requireEndgame(!source, 'decision-worker-phase')
        const decisions = await listDecisionChoices(text, data.scenario, { maxMilliseconds: 30_000 })
        source = { text, scenario: data.scenario, decisions }
        result = { status: 'catalog', decisions }
      }
    } else if (data.kind === 'create') {
      requireEndgame(source && !session && source.decisions.some(option => equalData(option, data.selection)), 'decision-selection-not-cataloged')
      session = await createDecisionReplay(source.text, data.selection, { maxMilliseconds: 30_000 })
      result = session.result
    } else {
      requireEndgame(data.kind === 'followup' && session, 'decision-worker-phase')
      result = await session.resume(data.choice, { maxMilliseconds: 30_000 })
    }
    worker.postMessage({ id: data.id, result })
  } catch (error) {
    worker.postMessage({ id: data?.id, result: { status: 'blocked', reason: error instanceof Error ? error.message.slice(0, 160) : 'decision-worker-failed' } })
  } finally { busy = false }
}
