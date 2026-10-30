import { parseCompanionRequest } from './contracts.ts'
import { deterministicAdvice, parseCompanionSuccess, renderMockAdvice } from './advice.ts'
import { createAdviceCandidate } from './templates.ts'
import { CompanionContractError, ERROR_POLICY, errorResponse } from './errors.ts'
import type { CompanionError, CompanionRequest, CompanionSuccess } from './types.ts'

export type AdviceTransport = (request: CompanionRequest, signal: AbortSignal) => Promise<CompanionSuccess>
export interface MockOptions {
  scenario?: 'success' | 'fallback' | 'rate-limited' | 'unavailable' | 'timeout'
  delayMs?: number
  candidate?: unknown
}
export class CompanionTransportError extends Error {
  readonly response: CompanionError
  readonly status: number
  constructor(response: CompanionError) {
    super(response.error.message)
    this.name = 'CompanionTransportError'
    this.response = response
    this.status = ERROR_POLICY[response.error.code][0]
  }
}
function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Đã hủy yêu cầu trợ giúp.', 'AbortError')
}
async function delay(ms: number, signal: AbortSignal) {
  checkAbort(signal)
  if (!ms) return
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      reject(new DOMException('Đã hủy yêu cầu trợ giúp.', 'AbortError'))
    }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Entirely offline: does not fetch, read env or implement /api/ai-companion. */
export function createMockTransport(options: MockOptions = {}): AdviceTransport {
  const milliseconds = options.delayMs ?? 0
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 30_000) throw new CompanionContractError('INVALID_REQUEST')
  return async (raw, signal) => {
    checkAbort(signal)
    const request = await parseCompanionRequest(raw)
    await delay(milliseconds, signal)
    if (options.scenario === 'timeout') throw new DOMException('Hết thời gian chờ mock.', 'TimeoutError')
    if (options.scenario === 'rate-limited') throw new CompanionTransportError(errorResponse('RATE_LIMITED', request, 30_000))
    if (options.scenario === 'unavailable') throw new CompanionTransportError(errorResponse('SERVICE_UNAVAILABLE', request))
    let response: CompanionSuccess
    if (options.scenario === 'fallback' || request.question || request.context.options.some(option => option.fundingShortfallVnd > 0)) {
      response = await deterministicAdvice(request)
    } else {
      try { response = await renderMockAdvice(request, options.candidate ?? createAdviceCandidate(request)) }
      catch (error) {
        if (!(error instanceof CompanionContractError)) throw error
        response = await deterministicAdvice(request, 'output-rejected')
      }
    }
    const result = await parseCompanionSuccess(response, request)
    checkAbort(signal)
    return result
  }
}

/** Call on every observed snapshot, including same-phase changes. Reset for a new session epoch. */
export function createRevisionTracker(sessionEpoch: string) {
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(sessionEpoch)) throw new CompanionContractError('INVALID_REQUEST')
  let previous: object | undefined, revision = -1
  return { observe(snapshot: object) {
    if (previous !== snapshot) {
      if (revision === Number.MAX_SAFE_INTEGER) throw new CompanionContractError('INVALID_REQUEST')
      previous = snapshot; revision++
    }
    return { sessionEpoch, revision }
  } }
}

/** Use after parseCompanionSuccess, immediately before rendering with the current UI request. */
export function matchesAdvice(response: CompanionSuccess, pending: CompanionRequest, current: CompanionRequest): boolean {
  return response.requestId === pending.requestId && response.requestId === current.requestId
    && response.mode === pending.mode && response.mode === current.mode
    && response.decisionId === pending.context.decision.decisionId && response.decisionId === current.context.decision.decisionId
    && response.stateRevision === pending.context.decision.stateRevision && response.stateRevision === current.context.decision.stateRevision
    && response.contextDigest === pending.contextDigest && response.contextDigest === current.contextDigest
    && response.apiVersion === current.apiVersion && response.contextVersion === current.contextVersion
}
