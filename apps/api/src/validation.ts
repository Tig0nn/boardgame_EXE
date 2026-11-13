import { z } from 'zod'
import { readLearningQuestion } from '../../../src/ai/mascot/learning.ts'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { CUSTOMER_PREFERENCES } from '../../../src/data/customer-preferences.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { MULTI_COURSE_RULES } from '../../../src/game/rules-profile.ts'
import { b18DefaultSetup, b18Scenario } from './services/b18.ts'

const savingsTerm = z.union([z.literal(1), z.literal(2), z.literal(3)])
const b18Setup = z.strictObject({
  initialSavings: z.number().int().min(0).max(MULTI_COURSE_RULES.startingCapital).default(b18DefaultSetup.initialSavings),
  savingsTerm: savingsTerm.default(b18DefaultSetup.savingsTerm),
})

export const createSessionBody = z.strictObject({
  scenarioId: z.literal(b18Scenario.scenarioId),
  setup: b18Setup.default(b18DefaultSetup),
})
export const idempotencyKey = z.uuid()
export const sessionParams = z.strictObject({ id: z.uuid() })

const queryInteger = (minimum: number, maximum: number, fallback: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum)).default(fallback)

export const listSessionsQuery = z.strictObject({
  limit: queryInteger(1, 100, 20),
  offset: queryInteger(0, 10_000, 0),
})

const expectedStateVersion = z.number().int().min(0).max(2_147_483_647)
const optionIds = new Set(eventsForGame(b18Scenario).flatMap(event => event.options.map(option => option.id)))
const amount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const lotId = z.string().min(1).max(64)

const fundingPayload = z.union([
  z.strictObject({ source: z.literal('savings'), amount, lotId: lotId.optional() }),
  z.strictObject({ source: z.literal('bonds'), amount, lotId }),
  z.strictObject({ source: z.enum(['stocks', 'gold', 'debt']), amount }),
])

const tradeKind = z.enum(['buy', 'sell'])
const completeEncounter = z.boolean().optional()
const tradePayload = z.union([
  z.strictObject({ kind: tradeKind, asset: z.literal('gold'), amount, completeEncounter }),
  z.strictObject({ kind: tradeKind, asset: z.literal('stocks'), amount, completeEncounter, symbolId: z.string().min(1).max(64).optional() }),
  z.strictObject({ kind: z.literal('buy'), asset: z.literal('bonds'), amount, completeEncounter, issuerId: z.enum(BOND_ISSUERS.map(issuer => issuer.id)) }),
  z.strictObject({ kind: z.literal('sell'), asset: z.literal('bonds'), amount, completeEncounter, lotId }),
])

export type TradePayload = z.infer<typeof tradePayload>
export const tradeQuoteBody = z.strictObject({ expectedStateVersion, payload: tradePayload })

const businessAsset = z.literal('business')
const businessPayload = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('buy'), asset: businessAsset, amount }),
  z.strictObject({ kind: z.literal('sell'), asset: businessAsset, amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
  z.strictObject({
    kind: z.literal('upgrade'), asset: businessAsset, amount,
    customerPreferenceId: z.enum(CUSTOMER_PREFERENCES.map(preference => preference.id)).optional(),
  }),
])
export type BusinessPayload = z.infer<typeof businessPayload>
export const businessQuoteBody = z.strictObject({ expectedStateVersion, payload: businessPayload })
export type BusinessQuoteRequest = z.infer<typeof businessQuoteBody>

const bankPayload = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('deposit'), amount, term: savingsTerm.optional() }),
  z.strictObject({ kind: z.literal('repay'), amount }),
])
export type BankPayload = z.infer<typeof bankPayload>

const bankFundingPayload = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('savings'), amount, lotId: lotId.optional() }),
  z.strictObject({ source: z.literal('debt'), amount }),
])

export const bankQuoteBody = z.discriminatedUnion('actionId', [
  z.strictObject({ actionId: z.literal('trade'), expectedStateVersion, payload: bankPayload }),
  z.strictObject({ actionId: z.literal('fund'), expectedStateVersion, payload: bankFundingPayload }),
])
export type BankQuoteRequest = z.infer<typeof bankQuoteBody>

const chooseAction = z.strictObject({
  actionId: z.literal('choose'), payload: z.strictObject({ optionId: z.string().refine(id => optionIds.has(id)) }),
})
const fundAction = z.strictObject({ actionId: z.literal('fund'), payload: fundingPayload })
const tradeAction = z.strictObject({ actionId: z.literal('trade'), payload: z.union([tradePayload, bankPayload, businessPayload]) })
const version = { expectedStateVersion }

export const gameActionBody = z.discriminatedUnion('actionId', [
  z.strictObject({ actionId: z.literal('advance'), expectedStateVersion, payload: z.strictObject({}) }),
  z.strictObject({ actionId: z.literal('roll'), expectedStateVersion, payload: z.strictObject({}) }),
  chooseAction.extend(version), fundAction.extend(version), tradeAction.extend(version),
])

export type GameActionRequest = z.infer<typeof gameActionBody>

const alternativeAction = z.discriminatedUnion('actionId', [chooseAction, fundAction, tradeAction])

export const whatIfBody = z.strictObject({
  stateVersion: expectedStateVersion,
  sequence: z.number().int().positive().max(2_147_483_647),
  alternative: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('omit') }),
    z.strictObject({ mode: z.literal('replace'), action: alternativeAction }),
  ]),
})
export type WhatIfRequest = z.infer<typeof whatIfBody>

const coachQueryInt = z.string().regex(/^\d{1,10}$/u).transform(Number)
export const foxCoachQuery = z.strictObject({
  stateVersion: coachQueryInt.pipe(expectedStateVersion).optional(),
  journalSequence: coachQueryInt.pipe(expectedStateVersion.min(1)).optional(),
})
export const foxLearningBody = z.strictObject({
  allowGemini: z.boolean().optional(),
  stateVersion: expectedStateVersion.optional(),
  question: z.string().refine(question => readLearningQuestion(question) !== null).transform(question => question.trim()),
})

const assistantQuestion = z.string().max(240).refine(value => !/\p{Cc}/u.test(value)).transform(value => value.trim()).pipe(z.string().min(3))
const assistantCommon = { stateVersion: expectedStateVersion, allowGemini: z.boolean().optional() }
export const whatIfAssistantBody = z.discriminatedUnion('operation', [
  z.strictObject({ ...assistantCommon, operation: z.literal('interpret'), question: assistantQuestion }),
  z.strictObject({ ...assistantCommon, operation: z.literal('propose'), question: assistantQuestion }),
  whatIfBody.extend({ operation: z.literal('explain'), allowGemini: assistantCommon.allowGemini }),
])
export type WhatIfAssistantRequest = z.infer<typeof whatIfAssistantBody>
