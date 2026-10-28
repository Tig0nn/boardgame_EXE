// Browser-safe public contract surface. No server/env/provider imports.
export type * from './types.ts'
export { API_VERSION, CONTEXT_VERSION, INTEGRITY, MODES } from './types.ts'
export { buildRepairContext } from './context.ts'
export type { ContextIdentity } from './context.ts'
export { createCompanionRequest, parseCompanionRequest, parseRepairContext, parseCompanionError,
  serializeContext, contextDigest, MAX_REQUEST_BYTES } from './contracts.ts'
export { deterministicAdvice, renderMockAdvice, parseCompanionSuccess } from './advice.ts'
export { createAdviceCandidate } from './templates.ts'
export { createMockTransport, createRevisionTracker, matchesAdvice, CompanionTransportError } from './client.ts'
export type { AdviceTransport, MockOptions } from './client.ts'
export { CompanionContractError, ERROR_POLICY, errorResponse } from './errors.ts'
