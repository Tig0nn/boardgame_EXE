import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { advance, roll, decide, canChoose, transact } from '../../src/game/engine.ts'
import { eventsForGame } from '../../src/data/events.ts'
import type { GameState } from '../../src/game/types.ts'
import { naturalBetaEncounter } from './beta-natural.ts'
import { ECONOMY } from '../../src/data/config.ts'
import type { CuratedQuestion } from '../../mobile_app/src/game/curated-catalog.ts'
import { projectGameplayContext } from '../../src/ai/companion/universal-index.ts'
import { normalizeDraftInput, projectDraftContext } from '../../src/ai/companion/draft-index.ts'

export function naturalCuratedState(domain: string): GameState {
  if (['bank', 'stocks', 'bonds', 'gold', 'business', 'course'].includes(domain)) return naturalBetaEncounter(domain)
  if (domain === 'personal') return naturalBetaEncounter('medical')
  if (['medical', 'repair', 'family'].includes(domain)) return naturalBetaEncounter(domain)
  if (domain === 'macro') return naturalBetaEncounter('demand-boom')
  for (let seed = 0; seed < 100; seed++) {
    let game = createMultiCourseGame('curated-natural-' + seed, 10_000_000, 2)
    for (let step = 0; step < 200; step++) {
      const matches = domain === 'overview' ? game.phase === 'rolling' : game.phase === domain
      if (matches) return game
      if (game.phase === 'finished' || game.phase === 'funding') break
      if (game.phase === 'rolling') game = roll(game)
      else if (game.phase === 'event') {
        const options = eventsForGame(game).find(x => x.id === game.eventId)?.options ?? []
        const option = options.find(x => x.id === 'skip' && canChoose(game, x.id)) ?? options.find(x => canChoose(game, x.id))
        if (!option) break
        game = decide(game, option.id)
      } else game = advance(game)
    }
  }
  throw Error('No natural state for ' + domain)
}

export function naturalCuratedOwned(asset: 'bank' | 'stocks' | 'gold') {
  for (let seed = 0; seed < 100; seed++) {
    let state = createMultiCourseGame('curated-owned-' + seed, 0, 1), bought = false
    for (let step = 0; step < 200; step++) {
      if (state.phase === 'event' && state.eventId === asset) {
        if (bought && (asset !== 'bank' || state.deposits.some(lot => lot.status === 'active'))) return state
        if (!bought) {
          const next = asset === 'bank' ? transact(state, { kind: 'deposit', amount: 2_000_000, term: 3 }) : transact(state, { kind: 'buy', asset, amount: asset === 'stocks' ? ECONOMY.stockTicket : ECONOMY.goldTicket, ...(asset === 'stocks' ? { symbolId: state.market.stocks[0].id } : {}) })
          if (state !== next) { state = next; bought = true; continue }
        }
      }
      if (state.phase === 'finished' || state.phase === 'funding') break
      if (state.phase === 'rolling') state = roll(state)
      else if (state.phase === 'event') {
        const options = eventsForGame(state).find(x => x.id === state.eventId)?.options ?? []
        const option = options.find(x => x.id === 'skip' && canChoose(state, x.id)) ?? options.find(x => canChoose(state, x.id))
        if (!option) break
        state = decide(state, option.id)
      } else state = advance(state)
    }
  }
  throw Error('No owned natural encounter: ' + asset)
}

export function curatedQuestionCase(question: CuratedQuestion) {
  let state = naturalCuratedState(question.domains[0])
  if (question.requiredFacts.some(x => x.code === 'net') && ['stocks', 'gold'].includes(question.categoryId)) state = naturalCuratedOwned(question.categoryId as 'stocks' | 'gold')
  if (question.id === 'bank-maturity') state = naturalCuratedOwned('bank')
  const identity = { sessionEpoch: 'curated-verification', revision: 0 }
  const input = question.requiredDraft ? normalizeDraftInput({ ...question.requiredDraft, amount: 2_000_000, term: question.categoryId === 'bank' ? 1 : null, symbolId: question.categoryId === 'stocks' ? state.market.stocks[0].id : null }) : null
  const actual = projectGameplayContext(state, identity)
  const draft = input ? projectDraftContext(state, { ...identity, draftId: 'actual-form-input', draftRevision: 1 }, input) : null
  return { state, input, context: { actual, draft } }
}
