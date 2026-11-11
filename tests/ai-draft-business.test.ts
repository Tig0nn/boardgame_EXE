import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answerDraft, createDraftRequest, DRAFT_QUESTIONS, normalizeDraftInput, projectDraftContext } from '../src/ai/companion/draft-index.ts'
import type { DraftInput } from '../src/ai/companion/draft-index.ts'
import { ECONOMY } from '../src/data/config.ts'
import { transact } from '../src/game/engine.ts'
import { serializeLog } from '../src/game/log.ts'
import { saveGameLocally } from '../src/game/saved-game.ts'
import { businessOverview, purchasePreview } from '../src/game/selectors.ts'
import type { GameState } from '../src/game/types.ts'
import { encounter } from './helpers/universal.ts'

const identity = { sessionEpoch: 'business-draft', revision: 1, draftId: 'business-form', draftRevision: 1 }
const cost = ECONOMY.business.cost
const upgradeCost = ECONOMY.business.upgradeCost

function ownedBusiness(later = true) {
  const first = encounter('business')
  const purchased = transact(first, { kind: 'buy', asset: 'business', amount: cost })
  return { ...purchased, phase: 'event' as const, eventId: 'business', turn: first.turn + Number(later) }
}

function packedSave(game: GameState) {
  let value = ''
  assert(saveGameLocally(game, { setItem(_key, save) { value = save } }))
  return value
}

async function inspect(game: GameState, input: Partial<DraftInput>, question: string = DRAFT_QUESTIONS[0]) {
  const original = structuredClone(game)
  const log = serializeLog(game)
  const save = packedSave(game)
  const context = projectDraftContext(game, identity, normalizeDraftInput({ form: 'business', ...input }))
  const reply = await answerDraft(await createDraftRequest(context, question, 'business-draft'))
  assert.deepEqual(game, original)
  assert.deepEqual(serializeLog(game), log)
  assert.equal(packedSave(game), save)
  return { context, reply, lines: Object.fromEntries(reply.lines.map(line => [line.code, line.value])) }
}

test('Business buy quotes exactly the official purchase cost and cash after purchase', async () => {
  const game = encounter('business')
  const { reply, lines } = await inspect(game, { operation: 'buy', amount: cost })
  assert.equal(reply.status, 'answered')
  assert.deepEqual(lines, { entered: cost, payNow: cost, cashAfter: purchasePreview(game, cost).cashAfter })
})

test('Business sell-all keeps the submitted amount separate from selector proceeds', async () => {
  const owned = ownedBusiness()
  const recovery = businessOverview(owned).sale
  const game = { ...owned, portfolio: { ...owned.portfolio, business: recovery + 1 } }
  const { reply, lines } = await inspect(game, { operation: 'sell', amount: game.portfolio.business })
  assert.equal(reply.status, 'answered')
  assert.deepEqual(lines, { entered: game.portfolio.business, net: recovery, cashAfter: game.portfolio.cash + recovery })
  assert.equal(transact(game, { kind: 'sell', asset: 'business', amount: game.portfolio.business }).portfolio.cash, lines.cashAfter)
})

test('Business upgrade preserves the selected specialization and official incremental income', async () => {
  const game = ownedBusiness()
  for (const preferenceId of ['checkin', 'budget', 'taste'] as const) {
    const { reply, lines } = await inspect(game, { operation: 'upgrade', amount: upgradeCost, preferenceId })
    assert.equal(reply.status, 'answered')
    assert.equal(lines.incremental, businessOverview(game, preferenceId).incrementalIncome)
  }
})

test('Business buy fails closed with insufficient cash, wrong amount or existing ownership', async () => {
  const initial = encounter('business')
  const insufficient = { ...initial, portfolio: { ...initial.portfolio, cash: cost - 1 } }
  for (const [game, amount] of [[insufficient, cost], [initial, cost - 1], [ownedBusiness(), cost]] as const) {
    const { context, reply } = await inspect(game, { operation: 'buy', amount })
    assert.notEqual(context.preview.status, 'quoted')
    assert.deepEqual(reply.lines, [])
  }
})

test('Business sell fails closed on the purchase turn, without ownership or for a partial amount', async () => {
  const sameTurn = ownedBusiness(false)
  const later = ownedBusiness()
  for (const [game, amount] of [[sameTurn, sameTurn.portfolio.business], [encounter('business'), later.portfolio.business], [later, later.portfolio.business - 1]] as const) {
    const { context, reply } = await inspect(game, { operation: 'sell', amount })
    assert.notEqual(context.preview.status, 'quoted')
    assert.deepEqual(reply.lines, [])
  }
})

test('Business upgrade fails closed until a later encounter and requires a specialization', async () => {
  const sameTurn = await inspect(ownedBusiness(false), { operation: 'upgrade', amount: upgradeCost, preferenceId: 'checkin' })
  const noPreference = await inspect(ownedBusiness(), { operation: 'upgrade', amount: upgradeCost })
  assert.equal(sameTurn.context.preview.status, 'unavailable')
  assert.deepEqual(sameTurn.reply.lines, [])
  assert.equal(noPreference.reply.status, 'fallback')
})

test('Business sell-or-upgrade question produces no quote for either action', async () => {
  const game = ownedBusiness()
  for (const input of [
    { operation: 'sell', amount: game.portfolio.business },
    { operation: 'upgrade', amount: upgradeCost, preferenceId: 'checkin' },
  ] as const) {
    const { reply } = await inspect(game, input, 'Tôi nên bán quán hay nâng cấp phương án đang nhập?')
    assert.equal(reply.status, 'fallback')
    assert.deepEqual(reply.lines, [])
  }
})
