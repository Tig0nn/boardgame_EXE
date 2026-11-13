import { z } from 'zod'
import { b18Scenario } from './services/b18.ts'
import { supportedChoices } from './services/b18-actions.ts'

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

export const gameActionBody = z.discriminatedUnion('actionId', [
  z.strictObject({ actionId: z.literal('advance'), expectedStateVersion, payload: z.strictObject({}) }),
  z.strictObject({ actionId: z.literal('roll'), expectedStateVersion, payload: z.strictObject({}) }),
  z.strictObject({
    actionId: z.literal('choose'), expectedStateVersion,
    payload: z.strictObject({ optionId: z.enum(supportedChoices) }),
  }),
])

export type GameActionRequest = z.infer<typeof gameActionBody>
