import { isDeepStrictEqual } from 'node:util'
import { composeLearningAnswer, fallbackLearning, INSUFFICIENT, learningCards, offlineLearning } from '../../../../src/ai/mascot/learning.ts'
import { learningKnowledge } from '../../../../src/ai/mascot/learning-knowledge.ts'
import { projectLearningContext } from '../../../../src/ai/mascot/learning-context.ts'
import type { Database } from '../db/client.ts'
import { ApiError } from '../errors.ts'
import { postgresFailure } from '../observability.ts'
import { officialB18Result } from './b18-actions.ts'
import type { FoxAssist, FoxAssistanceStatus } from './fox-assistance.ts'
import { coachEvidence, eligibleKinds, foxCoachVersion, foxCoachView, journalEvidence } from './fox-evidence.ts'
import { loadGameState } from './game-state.ts'

async function ownedState(db: Database, userId: string, id: string, version?: number) {
  let value
  try { value = await loadGameState(db, userId, id) }
  catch (error) {
    const failure = postgresFailure(error)
    if (failure?.sqlState === '57014' || failure?.category === 'database_connection') {
      throw new ApiError(503, 'COACH_UNAVAILABLE', 'Coach could not read the saved game; retry the request')
    }
    throw error
  }
  const { session, game, result } = value
  if (version !== undefined && version !== session.stateVersion) {
    throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Reload the game before requesting its explanation')
  }
  const stored = result ? { outcome: result.outcome, lawfulProceedsVnd: String(result.lawfulProceedsVnd) } : null
  if (!isDeepStrictEqual(stored, officialB18Result(game))) throw new Error('Coach result does not match saved state')
  return { stateVersion: session.stateVersion, game }
}

export async function readFoxCoach(db: Database, userId: string, id: string, options: { stateVersion?: number; journalSequence?: number }) {
  const { stateVersion, game } = await ownedState(db, userId, id, options.stateVersion)
  const decision = options.journalSequence === undefined
    ? game.log.findLast(item => eligibleKinds.has(item.kind))
    : game.log.find(item => item.sequence === options.journalSequence && eligibleKinds.has(item.kind))
  if (options.journalSequence !== undefined && !decision) {
    throw new ApiError(422, 'COACH_DECISION_NOT_FOUND', 'Select a decision from the saved journal')
  }
  return { ...foxCoachView(game, officialB18Result(game), decision), stateVersion }
}

export async function learnWithFox(db: Database, userId: string, id: string, question: string, version?: number,
  options: { allowGemini?: boolean; assist?: FoxAssist; signal?: AbortSignal } = {}) {
  const { stateVersion, game } = await ownedState(db, userId, id, version)
  const context = projectLearningContext(game)
  const catalog = learningCards(context)
  let cards = composeLearningAnswer(offlineLearning(question, catalog) ?? fallbackLearning(question, catalog, context))
  let assistance: FoxAssistanceStatus = options.allowGemini ? 'disabled' : 'not-requested'
  // A local limitation is also a deterministic answer and must not be overridden.
  if (options.allowGemini && cards.length) assistance = 'not-needed'
  else if (options.allowGemini && options.assist) {
    const selection = await options.assist(userId, question, catalog, options.signal)
    assistance = selection.status
    cards = composeLearningAnswer(selection.cards)
  }
  const evidence = coachEvidence(game, undefined, officialB18Result(game))
  return {
    version: foxCoachVersion, stateVersion, source: 'deterministic' as const,
    assistance,
    status: cards.length && cards.some(card => card.scope !== 'UNKNOWN') ? 'answered' as const : 'insufficient' as const,
    cards: cards.map(card => ({ ...card, references: learningKnowledge.find(item => item.id === card.id)?.references ?? [] })),
    message: cards.length ? null : INSUFFICIENT,
    evidence: {
      position: cards.some(card => card.id === 'cash') ? evidence.position : null,
      result: cards.some(card => ['result', 'actual-result', 'prediction-result'].includes(card.id)) ? evidence.result : null,
      gold: cards.some(card => card.id === 'gold-market') ? evidence.goldPrice : null,
      journal: (context?.entries ?? []).filter(entry =>
        cards.some(card => card.id === 'entry-' + entry.id || card.id === 'gold-cash-zero' && entry.kind === 'buy' && entry.asset === 'gold'))
        .flatMap(entry => game.log.filter(item => item.sequence === entry.id).map(journalEvidence)),
    },
  }
}
export type FoxCoachReply = Awaited<ReturnType<typeof readFoxCoach>>
export type FoxLearningReply = Awaited<ReturnType<typeof learnWithFox>>
