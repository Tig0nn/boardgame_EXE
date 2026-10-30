import { goalForGame } from '../../game/rules-profile.ts'
import { REPAIR_PROFILE, repairQuotes } from './repair-quotes.ts'
import { array, enumeration, integer, literal, object, optional, nullable, text, plainText } from './schema.ts'
import type { Schema } from './schema.ts'
import { CompanionContractError, ERROR_POLICY } from './errors.ts'
import { canonicalJson, sha256 } from './serialization.ts'
import { MODES } from './types.ts'
import type { CompanionRequest, RepairContext, RepairQuote, CompanionError, CompanionErrorCode } from './types.ts'

export const MAX_REQUEST_BYTES = 8192
const id = text()
const money = integer()
function compatible<const T extends string | number>(expected: T, code: CompanionErrorCode = 'UNSUPPORTED_VERSION'): Schema<T> {
  return value => {
    if (value === expected) return expected
    throw new CompanionContractError(typeof value === typeof expected ? code : 'INVALID_REQUEST')
  }
}
function atBoundary<T>(schema: Schema<T>, code: CompanionErrorCode): Schema<T> {
  return value => {
    try { return schema(value) }
    catch (error) {
      if (error instanceof CompanionContractError && error.code === 'INVALID_REQUEST') throw new CompanionContractError(code)
      throw error
    }
  }
}
const profileSchema = object({
  gameplayProfile: compatible(REPAIR_PROFILE.gameplayProfile, 'UNSUPPORTED_PROFILE'), boardRevision: compatible(REPAIR_PROFILE.boardRevision, 'UNSUPPORTED_PROFILE'),
  goalRulesVersion: compatible(REPAIR_PROFILE.goalRulesVersion, 'UNSUPPORTED_PROFILE'), encounterRulesVersion: compatible(REPAIR_PROFILE.encounterRulesVersion, 'UNSUPPORTED_PROFILE'),
  courseRulesVersion: compatible(REPAIR_PROFILE.courseRulesVersion, 'UNSUPPORTED_PROFILE'), bondRulesVersion: compatible(REPAIR_PROFILE.bondRulesVersion, 'UNSUPPORTED_PROFILE'),
  livingExpenseRulesVersion: compatible(REPAIR_PROFILE.livingExpenseRulesVersion, 'UNSUPPORTED_PROFILE'), savingsProfileId: compatible(REPAIR_PROFILE.savingsProfileId, 'UNSUPPORTED_PROFILE'),
  adviceRulesVersion: compatible(REPAIR_PROFILE.adviceRulesVersion, 'UNSUPPORTED_PROFILE'),
})
const quoteSchema: Schema<RepairQuote> = object({
  optionId: enumeration(['full', 'temporary']), engineAction: literal('choose'), allowed: literal(true),
  costNowVnd: money, obligationAddedVnd: money, totalCommittedCostVnd: money, cashAfterImmediateVnd: money,
  obligationsAfterImmediateVnd: money, obligationsAfterResolutionVnd: money, fundingShortfallVnd: money,
  execution: enumeration(['cash-sufficient', 'funding-required']), due: enumeration(['none', 'next-start-settlement']),
  dueLap: nullable(integer(1, 4)),
})
const empty: Schema<[]> = value => { array(literal(null), 0, 0)(value); return [] }
const contextSchema: Schema<RepairContext> = object({
  profile: profileSchema,
  decision: object({ decisionId: id, stateRevision: id, phase: literal('event'), eventId: literal('repair'),
    encounterSequence: integer(1), turn: integer(1), lap: integer(1, 4), totalLaps: literal(4),
    tileIndex: literal(3), tileType: literal('personal') }),
  financial: atBoundary(object({ cashVnd: money, savingsPrincipalVnd: money, assetLiquidationQuoteVnd: money,
    netWorthVnd: integer(Number.MIN_SAFE_INTEGER), debtVnd: money, obligationsVnd: money, goalTargetVnd: money }), 'INVALID_FINANCIAL_CONTEXT'),
  options: atBoundary(array(quoteSchema, 2, 2), 'INVALID_OPTIONS'), revealedDecisions: empty, publicMarket: empty,
})

export function parseRepairContext(value: unknown): RepairContext {
  const context = contextSchema(value)
  const expected = repairQuotes(context.financial.cashVnd, context.financial.obligationsVnd, context.decision.lap)
  if (canonicalJson(expected) !== canonicalJson(context.options)) throw new CompanionContractError('INVALID_OPTIONS')
  if (context.financial.goalTargetVnd !== goalForGame(context.profile).target) {
    throw new CompanionContractError('INVALID_FINANCIAL_CONTEXT')
  }
  return context
}

export function serializeContext(context: unknown): string { return canonicalJson(parseRepairContext(context)) }
export async function contextDigest(context: unknown): Promise<string> { return sha256(serializeContext(context)) }

export const requestSchema: Schema<CompanionRequest> = object({
  apiVersion: compatible(1), contextVersion: compatible('b18-advice.v1'), requestId: id,
  mode: enumeration(MODES), locale: literal('vi-VN'), contextDigest: text(71, /^sha256:[0-9a-f]{64}$/),
  context: parseRepairContext, question: optional(plainText(400)),
})

function decodeRequest(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) throw new CompanionContractError('PAYLOAD_TOO_LARGE')
  try { return JSON.parse(raw) } catch { throw new CompanionContractError('INVALID_JSON') }
}

/** Decodes into a detached DTO before awaiting digest, preventing caller mutation races. */
export async function parseCompanionRequest(raw: unknown): Promise<CompanionRequest> {
  const request = requestSchema(decodeRequest(raw))
  if (new TextEncoder().encode(JSON.stringify(request)).length > MAX_REQUEST_BYTES) throw new CompanionContractError('PAYLOAD_TOO_LARGE')
  if (await contextDigest(request.context) !== request.contextDigest) throw new CompanionContractError('CONTEXT_MISMATCH')
  return request
}

export async function createCompanionRequest(context: unknown, mode: CompanionRequest['mode'], requestId: string): Promise<CompanionRequest> {
  const dto = parseRepairContext(context)
  return parseCompanionRequest({ apiVersion: 1, contextVersion: 'b18-advice.v1', requestId, mode, locale: 'vi-VN',
    contextDigest: await contextDigest(dto), context: dto })
}

const errorSchema: Schema<CompanionError> = object({
  apiVersion: literal(1),
  error: object({ code: enumeration(Object.keys(ERROR_POLICY) as Array<keyof typeof ERROR_POLICY>),
    message: plainText(150), retryable: value => {
      if (typeof value !== 'boolean') throw new CompanionContractError('INVALID_REQUEST')
      return value
    }, retryAfterMs: optional(integer(1)) }),
  correlation: object({ requestId: nullable(id), decisionId: nullable(id), stateRevision: nullable(id) }),
})
export function parseCompanionError(value: unknown): CompanionError {
  const error = errorSchema(value), policy = ERROR_POLICY[error.error.code]
  if (error.error.message !== policy[1] || error.error.retryable !== policy[2]
    || error.error.retryAfterMs !== undefined && error.error.code !== 'RATE_LIMITED') throw new CompanionContractError('INVALID_RESPONSE')
  return error
}
