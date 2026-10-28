import type { CompanionError, CompanionErrorCode, CompanionRequest } from './types.ts'

export const ERROR_POLICY = {
  INVALID_JSON: [400, 'JSON không hợp lệ.', false],
  INVALID_REQUEST: [400, 'Yêu cầu không đúng hợp đồng.', false],
  METHOD_NOT_ALLOWED: [405, 'Chỉ hỗ trợ POST.', false],
  UNSUPPORTED_VERSION: [409, 'Phiên bản hợp đồng chưa được hỗ trợ.', false],
  UNSUPPORTED_PROFILE: [409, 'Phiên bản trò chơi chưa được hỗ trợ.', false],
  CONTEXT_MISMATCH: [409, 'Dữ liệu quyết định đã thay đổi.', false],
  DECISION_UNAVAILABLE: [409, 'Chưa có quyết định sửa chữa hợp lệ.', false],
  PAYLOAD_TOO_LARGE: [413, 'Dữ liệu vượt giới hạn cho phép.', false],
  INVALID_FINANCIAL_CONTEXT: [422, 'Dữ liệu tài chính không hợp lệ.', false],
  INVALID_OPTIONS: [422, 'Lựa chọn không khớp luật hiện hành.', false],
  RATE_LIMITED: [429, 'Vui lòng đợi trước khi hỏi lại.', true],
  SERVICE_UNAVAILABLE: [503, 'Trợ giúp hiện chưa sẵn sàng.', true],
  INVALID_RESPONSE: [502, 'Phản hồi không đúng hợp đồng.', false],
} as const satisfies Record<CompanionErrorCode, readonly [number, string, boolean]>

export class CompanionContractError extends Error {
  readonly code: CompanionErrorCode
  constructor(code: CompanionErrorCode) {
    super(ERROR_POLICY[code][1])
    this.name = 'CompanionContractError'
    this.code = code
  }
}

export function errorResponse(code: CompanionErrorCode, request?: CompanionRequest, retryAfterMs?: number): CompanionError {
  if (retryAfterMs !== undefined && (code !== 'RATE_LIMITED' || !Number.isSafeInteger(retryAfterMs) || retryAfterMs < 1)) {
    throw new CompanionContractError('INVALID_REQUEST')
  }
  return {
    apiVersion: 1,
    error: { code, message: ERROR_POLICY[code][1], retryable: ERROR_POLICY[code][2],
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) },
    correlation: { requestId: request?.requestId ?? null, decisionId: request?.context.decision.decisionId ?? null,
      stateRevision: request?.context.decision.stateRevision ?? null },
  }
}
