import { EndgameRejected, requireEndgame } from '../endgame-whatif-contract.ts'
import { createDecisionReplay, listDecisionChoices } from './decision-replay.ts'
import type { WhatIfDecision } from './orchestrator.ts'

/** Keep the EG3-AI-01 API while admitting every native-legal recorded Bank skip. */
export function listBankChoices(text: string, signal: AbortSignal): Promise<WhatIfDecision[]> {
  return listDecisionChoices(text, 'bank', { signal, maxMilliseconds: 30_000 })
}

export async function replayBank(text: string, selection: WhatIfDecision, signal: AbortSignal) {
  requireEndgame(selection.kind === 'bank', 'bank-selection-invalid')
  const handle = await createDecisionReplay(text, selection, { signal, maxMilliseconds: 30_000 })
  try {
    const result = handle.result
    if (result.status !== 'supported-final') {
      const reason = result.status === 'needs-followup' ? 'bank-explicit-followup-required' : result.reason
      throw new EndgameRejected(reason === 'adapter-selection-invalid' ? 'bank-selection-invalid' : reason)
    }
    requireEndgame(result.comparison.principal !== undefined, 'bank-principal-unproved')
    return { ...result.comparison, principal: result.comparison.principal }
  } finally { handle.dispose() }
}
