import { buildRepairContext } from '../../src/ai/companion/context.ts'
import { createQuestionRequest } from '../../src/ai/companion/question-contract.ts'
import { revealedRepair } from './companion.ts'
export async function questionRequest(question = 'So sánh trả ngay và sửa tạm', cash = 50_000_000) {
  const game = revealedRepair()
  game.portfolio.cash = cash
  return createQuestionRequest(buildRepairContext(game, { sessionEpoch: 'question-wire', revision: 1 }),
    { sessionEpoch: 'question-wire', revision: 1 }, question, 'question-wire:question:1')
}
