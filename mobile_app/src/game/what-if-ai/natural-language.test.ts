import assert from 'node:assert/strict'
import test from 'node:test'
import { interpretMock, readIntentReply, matchingHistory, requiredParameters, decisionQuestion, readVndAmount } from './natural-language.ts'
import { mockServerProvider } from '../../../../src/ai/what-if/mock-server-provider.ts'
import type { WhatIfDecision } from './orchestrator.ts'
import { listDecisionPage } from './decision-replay.ts'
import { multiAssetFixture } from '../../../../scripts/diagnostics/what-if-multi-asset-fixtures.ts'

test('Vietnamese intent extracts one explicit change, monetary units, targets and historical locator', () => {
  assert.deepEqual(interpretMock('Nếu tôi mua cổ phiếu CMG 7,25 triệu ở quyết định 10 thì sao?'), {
    status: 'intent', intent: { kind: 'stocks', action: 'buy', symbolId: 'CMG', amount: 7_250_000, sequence: 10 },
  })
  assert.deepEqual(interpretMock('Gửi tiết kiệm 1 triệu kỳ hạn 3 START lần cuối'), {
    status: 'intent', intent: { kind: 'bank', action: 'deposit', amount: 1_000_000, term: 3, occurrence: 'last' },
  })
  assert.deepEqual(interpretMock('Bán trái phiếu lot bond-2 số tiền 750.000 VND vòng 1'), {
    status: 'intent', intent: { kind: 'bonds', action: 'sell', lotId: 'bond-2', amount: 750_000, lap: 1 },
  })
  assert.equal(interpretMock('Nếu bỏ mua vàng và bỏ bán vàng?').status, 'multiple-changes')
  assert.equal(interpretMock('Mua FPT và CMG 2 triệu').status, 'multiple-changes')
  assert.equal(interpretMock('Mua cổ phiếu rồi gửi tiết kiệm').status, 'multiple-changes')
  assert.equal(interpretMock('Mua CMG -5 triệu').status, 'unsupported')
  assert.equal(interpretMock('Mua CMG−5 triệu').status, 'unsupported')
})

test('missing parameters are explicit and repeated histories require a player choice', () => {
  const reply = interpretMock('Nếu tôi mua cổ phiếu CMG thì sao?')
  assert.equal(reply.status, 'intent')
  assert.deepEqual(requiredParameters(reply.intent), ['amount'])
  const history = [{ sequence: 10, lap: 1, turn: 3, action: 'skip' }, { sequence: 51, lap: 3, turn: 12, action: 'skip' }]
  assert.equal(matchingHistory(reply.intent, history).length, 2)
  assert.deepEqual(matchingHistory({ ...reply.intent, occurrence: 'last' }, history), [history[1]])
  assert.deepEqual(matchingHistory({ ...reply.intent, sequence: 999 }, history), [])
  assert.deepEqual(requiredParameters({ kind: 'bank', action: 'deposit' }), ['amount', 'term'])
})

test('untrusted intent schema rejects fabricated IDs, extra state, invalid scalars and cross-asset fields', () => {
  for (const intent of [
    { kind: 'stocks', action: 'buy', decisionId: 'stocks:999' }, { kind: 'stocks', action: 'buy', amount: -1 },
    { kind: 'stocks', action: 'buy', amount: 1.5 }, { kind: 'bank', action: 'deposit', term: 4 },
    { kind: 'stocks', action: 'buy', lotId: 'bond-2' }, { kind: 'gold', action: 'buy' },
    { kind: 'course', action: 'advanced', state: {} }, { kind: 'stocks', action: 'buy', symbolId: '<script>' },
    { kind: 'stocks', action: new String('buy') }, { kind: 'bonds', action: 'buy', issuerId: new String('an-tam') },
  ]) assert.equal(readIntentReply({ status: 'intent', intent }), null)
  assert.equal(readIntentReply({ status: 'ambiguous', amount: 1_000_000 }), null)
  assert.deepEqual(readIntentReply({ status: 'intent', intent: { kind: 'stocks', action: 'buy' } }),
    { status: 'intent', intent: { kind: 'stocks', action: 'buy' } })
})

test('historical locator is filtered by the native Worker catalog without dropping the page cap', async () => {
  const text = multiAssetFixture('stocks', 'skip')
  const page = await listDecisionPage(text, 'stocks', { mode: 'history', offset: 0, limit: 1, locator: { occurrence: 'last' } })
  assert.equal(page.total, 1)
  assert.equal(page.history.length, 1)
  assert.equal(typeof page.history[0].description, 'string')
})

test('skip questions preserve the original target and Course Basic is not confused with a sale', () => {
  const reply = interpretMock('Nếu bỏ mua cổ phiếu CMG thì sao?')
  assert.equal(reply.status, 'intent')
  assert.equal(reply.intent.originalSymbolId, 'CMG')
  assert.deepEqual(matchingHistory(reply.intent, [
    { sequence: 10, lap: 1, turn: 3, action: 'buy-stocks-complete', symbolId: 'FPT' },
  ]), [])
  const basic = interpretMock('Bỏ học khóa cơ bản lần đầu')
  assert.equal(basic.status, 'intent')
  assert.equal(basic.intent.originalAction, 'basic')
  assert.equal(interpretMock('Học Advanced lần đầu').status, 'intent')
  assert.equal(interpretMock('Mua quán tại quyết định 28').status, 'intent')
  assert.equal(interpretMock('Không biết mua CMG 1 triệu').status, 'ambiguous')
})

test('ambiguous amount formatting, alternative terms and calendar units never become guessed tool parameters', () => {
  const amount = interpretMock('Mua CMG 1.000 triệu tại quyết định 10')
  assert.equal(amount.status, 'intent')
  assert.deepEqual(requiredParameters(amount.intent), ['amount'])
  assert.equal(interpretMock('Gửi 1 triệu kỳ hạn 2 hoặc 3 START').status, 'ambiguous')
  assert.equal(interpretMock('Gửi tiết kiệm 1 triệu kỳ hạn 3 tháng').status, 'unsupported')
})

test('omission questions do not relabel a recorded sale or Basic lesson as a purchase or Advanced lesson', async () => {
  for (const kind of ['stocks', 'bonds', 'business', 'course', 'advanced'] as const) {
    const choice: WhatIfDecision = { kind, decisionId: `${kind}:37`, alternativeId: 'skip', lap: 2, turn: 10 }
    const question = decisionQuestion(choice)
    assert(!/mua|nâng cao/i.test(question))
    assert.deepEqual(await mockServerProvider.propose({ question, catalog: [choice] }, new AbortController().signal),
      { decisionId: choice.decisionId, alternativeId: 'skip' })
  }
})

test('player amounts accept consistent VND grouping and ambiguous amounts stay unconfirmed', () => {
  for (const amount of ['1250000', '1.250.000', '1,250,000']) assert.equal(readVndAmount(amount), 1_250_000)
  for (const amount of ['1.5', '1.250,000', '1e6', '-10000', '9007199254740992']) assert.equal(readVndAmount(amount), undefined)
  assert.deepEqual(interpretMock('Mua CMG 1.250,000 VND lần đầu'), { status: 'intent', intent: { kind: 'stocks', action: 'buy', symbolId: 'CMG', occurrence: 'first' } })
})

test('compound same-asset actions require a new question while check-in remains a legal intent', () => {
  assert.equal(interpretMock('Mua CMG 1 triệu, bán CMG 2 triệu').status, 'multiple-changes')
  assert.deepEqual(interpretMock('Nâng cấp không gian check-in lần đầu'), { status: 'intent', intent: { kind: 'business', action: 'upgrade', preferenceId: 'checkin', occurrence: 'first' } })
  assert.deepEqual(interpretMock('Học khóa học cơ bản lần đầu'), { status: 'intent', intent: { kind: 'course', action: 'basic', occurrence: 'first' } })
})

test('a stock suggestion with a historical locator still asks for the missing symbol', () => {
  const suggestion = interpretMock('Nếu tôi mua cổ phiếu tại quyết định 10 thì sao?')
  assert.equal(suggestion.status, 'intent')
  assert.deepEqual(requiredParameters(suggestion.intent), ['symbolId', 'amount'])
  const explicit = interpretMock('Mua cổ phiếu ZZZ 1 triệu tại quyết định 10')
  assert.equal(explicit.status, 'intent')
  assert.equal(explicit.intent.symbolId, 'ZZZ')
})
