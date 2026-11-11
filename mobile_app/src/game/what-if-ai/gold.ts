import type { createEndgameUiController, EndgameView } from '../endgame-whatif-ui-controller.ts'
import { explainWhatIf, runWhatIfPrompt } from './orchestrator.ts'
import type { WhatIfDecision, WhatIfProvider } from './orchestrator.ts'

type Controller = Pick<ReturnType<typeof createEndgameUiController>, 'getSnapshot' | 'create'>

export async function askGold(controller: Controller, provider: WhatIfProvider, question: string, signal: AbortSignal) {
  const view = controller.getSnapshot()
  if (view.kind !== 'catalog') return 'unsupported'
  const options = view.decisions.map(({ sequence, lap, turn }) => ({
    sequence, decision: { kind: 'gold', decisionId: `gold:${sequence}`, alternativeId: 'skip', lap, turn } satisfies WhatIfDecision,
  }))
  return runWhatIfPrompt(provider, question, options.map(option => option.decision), signal, async choice => {
    if (controller.getSnapshot() !== view) throw new DOMException('Catalog replaced', 'AbortError')
    const selection = options.find(option => option.decision.decisionId === choice.decisionId)!
    await controller.create(selection.sequence, choice.alternativeId === 'skip' ? choice.alternativeId : null)
  })
}

export function explainGold(provider: WhatIfProvider, view: Extract<EndgameView, { kind: 'final' }>, signal: AbortSignal) {
  const cash = view.rows.find(row => row.key === 'cash')
  if (!cash) return Promise.resolve(null)
  const direction = cash.direction === 'Tăng' ? 'up' : cash.direction === 'Giảm' ? 'down' : 'unchanged'
  return explainWhatIf(provider, { kind: 'gold', direction, confirmedFollowUp: view.combined }, signal)
}
