import { z } from 'zod'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { b18Scenario } from './services/b18.ts'

export const createSessionBody = z.strictObject({ scenarioId: z.literal(b18Scenario.scenarioId) })
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

export const gameActionBody = z.discriminatedUnion('actionId', [
  z.strictObject({ actionId: z.literal('advance'), expectedStateVersion, payload: z.strictObject({}) }),
  z.strictObject({ actionId: z.literal('roll'), expectedStateVersion, payload: z.strictObject({}) }),
  z.strictObject({
    actionId: z.literal('choose'), expectedStateVersion,
    payload: z.strictObject({ optionId: z.string().refine(id => optionIds.has(id)) }),
  }),
  z.strictObject({ actionId: z.literal('fund'), expectedStateVersion, payload: fundingPayload }),
  z.strictObject({ actionId: z.literal('trade'), expectedStateVersion, payload: tradePayload }),
])

export type GameActionRequest = z.infer<typeof gameActionBody>
