import type { GameActionRequest, OfficialResult, ServerState, WhatIfAssistantReply, WhatIfAssistantRequest, WhatIfCatalog, WhatIfEvaluation, WhatIfRequest } from './cloud-contract.ts'
export type { ServerState } from './cloud-contract.ts'
import type { Term } from '../../../src/game/types.ts'
import { mobileGamePresentation } from '../../../src/game-presentation.ts'
import type { GamePresentation } from '../../../src/game-presentation.ts'
import type { MobileCommand } from './session.ts'
import type { AccessToken } from './account-token.ts'

export type Setup = { initialSavings: number; savingsTerm: Term }
export type SessionHeader = { id: string; status: 'active' | 'completed' | 'abandoned'; stateVersion: number; setup: Setup; updatedAt: string }
export type SessionDetail = { session: SessionHeader; state: ServerState; result: OfficialResult }
export type ActionReply = { sessionId: string; stateVersion: number; state: ServerState; result: OfficialResult }
type Simulation = { evaluation: WhatIfEvaluation; explanation?: string }

function verifiedExplanation(reply: Extract<WhatIfAssistantReply, { operation: 'explain' }>) {
  const { claim } = reply
  if (reply.status !== 'completed' || reply.evaluation.status !== 'completed' ||
      claim?.basis !== 'verified-final-cash' || typeof claim.id !== 'string' || !claim.id.trim() ||
      typeof claim.text !== 'string' || !claim.text.trim()) return undefined
  // Provider availability is independent of the server's verified cash comparison.
  switch (reply.assistance) {
    case 'not-requested':
    case 'used':
    case 'disabled':
    case 'unavailable':
    case 'timeout':
    case 'rate-limited':
    case 'output-rejected':
      return claim.text
    default:
      return undefined
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export function createGameApi(accessToken: AccessToken, send: typeof fetch = fetch, allowWhatIfGemini = true) {
  const pendingSimulations = new Map<string, Promise<Simulation>>()
  const completedSimulations = new Map<string, Simulation>()
  async function request<T>(path: string, body?: object, key?: string, signal?: AbortSignal): Promise<T> {
    const token = await accessToken()
    if (!token) throw new ApiError(401, 'UNAUTHORIZED')
    const serialized = body ? JSON.stringify(body) : undefined
    const transmit = (bearer: string, signal: AbortSignal) => send('/v1/game-sessions' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal,
      headers: {
        authorization: 'Bearer ' + bearer,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      body: serialized,
    })
    const deadline = new AbortController()
    const cancel = () => deadline.abort()
    const timer = setTimeout(cancel, 12000)
    if (signal?.aborted) cancel()
    else signal?.addEventListener('abort', cancel, { once: true })
    try {
      let response = await transmit(token, deadline.signal)
      if (response.status === 401) {
        const refreshed = await accessToken(token)
        if (refreshed && refreshed !== token) response = await transmit(refreshed, deadline.signal)
      }
      if (!response.ok) {
        const value = await response.json().catch(() => null)
        throw new ApiError(response.status, value?.error?.code ?? 'REQUEST_FAILED')
      }
      return await response.json() as T
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
  }
  function simulateWhatIf(id: string, input: WhatIfRequest) {
    const key = JSON.stringify([id, input.stateVersion, input.sequence, input.alternative])
    const completed = completedSimulations.get(key)
    if (completed) return Promise.resolve(completed)
    const pending = pendingSimulations.get(key)
    if (pending) return pending
    const path = '/' + encodeURIComponent(id) + '/what-if'
    const simulation = request<WhatIfAssistantReply>(path + '/assistant', {
      ...input, operation: 'explain', allowGemini: allowWhatIfGemini,
    } satisfies WhatIfAssistantRequest).then<Simulation, Simulation>(reply => {
      if (reply.version !== 1 || reply.operation !== 'explain' || reply.stateVersion !== input.stateVersion ||
          reply.evaluation.stateVersion !== input.stateVersion || reply.evaluation.sequence !== input.sequence) {
        throw new Error('Mô phỏng không khớp quyết định đã chọn.')
      }
      return { evaluation: reply.evaluation, explanation: verifiedExplanation(reply) }
    }, async (error: unknown) => {
      if (error instanceof ApiError && error.status < 500) throw error
      const evaluation = await request<WhatIfEvaluation>(path, input)
      if (evaluation.stateVersion !== input.stateVersion || evaluation.sequence !== input.sequence) {
        throw new Error('Mô phỏng không khớp quyết định đã chọn.')
      }
      return { evaluation }
    })
    pendingSimulations.set(key, simulation)
    void simulation.then(result => {
      pendingSimulations.delete(key)
      completedSimulations.set(key, result)
      if (completedSimulations.size > 64) {
        const oldest = completedSimulations.keys().next().value
        if (oldest !== undefined) completedSimulations.delete(oldest)
      }
    }, () => { pendingSimulations.delete(key) })
    return simulation
  }

  return {
    list: (offset = 0) => request<{ sessions: SessionHeader[] }>('?limit=20&offset=' + offset),
    create: (key: string) => request<{ session: SessionHeader }>('', { scenarioId: 'b18' }, key),
    read: (id: string) => request<SessionDetail>('/' + encodeURIComponent(id)),
    action: (id: string, body: GameActionRequest, key: string) => request<ActionReply>('/' + encodeURIComponent(id) + '/actions', body, key),
    async quote(id: string, endpoint: 'trade-quote' | 'bank-quote' | 'business-quote',
      input: { expectedStateVersion: number; payload: object }, signal: AbortSignal) {
      const reply = await request<{ sessionId: string; stateVersion: number; quote: unknown }>(
        '/' + encodeURIComponent(id) + '/' + endpoint, input, undefined, signal)
      if (reply.sessionId !== id || reply.stateVersion !== input.expectedStateVersion) throw new ApiError(409, 'STATE_VERSION_CONFLICT')
      return reply.quote
    },
    whatIfCatalog: (id: string, signal: AbortSignal) => request<WhatIfCatalog>('/' + encodeURIComponent(id) + '/what-if', undefined, undefined, signal),
    simulateWhatIf,
    async presentation(id: string, version: number, signal: AbortSignal) {
      const reply = await request<{ sessionId: string; stateVersion: number; presentation: GamePresentation }>(
        '/' + encodeURIComponent(id) + '/mobile-presentation', undefined, undefined, signal)
      if (reply.sessionId !== id || reply.stateVersion !== version) throw new ApiError(409, 'STATE_VERSION_CONFLICT')
      return mobileGamePresentation(reply.presentation)
    },
  }
}

export function actionRequest(command: MobileCommand, expectedStateVersion: number): GameActionRequest {
  switch (command.type) {
    case 'advance':
    case 'roll': return { actionId: command.type, expectedStateVersion, payload: {} }
    case 'choose': return { actionId: 'choose', expectedStateVersion, payload: { optionId: command.id } }
    case 'fund': {
      const { source, amount, lotId } = command
      if (source === 'bonds') {
        if (!lotId) throw new Error('Chọn khoản trái phiếu.')
        return { actionId: 'fund', expectedStateVersion, payload: { source, amount, lotId } }
      }
      return { actionId: 'fund', expectedStateVersion, payload: source === 'savings' && lotId ? { source, amount, lotId } : { source, amount } }
    }
    case 'trade': {
      const { kind, amount, asset, term, symbolId, lotId, issuerId, customerPreferenceId, completeEncounter } = command.action
      if (kind === 'deposit') return { actionId: 'trade', expectedStateVersion, payload: { kind, amount, term } }
      if (kind === 'repay') return { actionId: 'trade', expectedStateVersion, payload: { kind, amount } }
      if (asset === 'business') {
        if (kind === 'upgrade') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, customerPreferenceId } }
        if (kind === 'buy' || kind === 'sell') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount } }
      }
      if (kind === 'buy' || kind === 'sell') {
        if (asset === 'gold') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, completeEncounter } }
        if (asset === 'stocks') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, symbolId, completeEncounter } }
        if (asset === 'bonds' && kind === 'buy' && issuerId) return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, issuerId, completeEncounter } }
        if (asset === 'bonds' && kind === 'sell' && lotId) return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, lotId, completeEncounter } }
      }
      throw new Error('Giao dịch không hợp lệ.')
    }
  }
}

export function recoverable(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500 || error.status === 401 || error.status === 429
}

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
    if (error.status === 409) return 'Ván đã thay đổi. Hãy tải lại ván và thử lại.'
    if (error.status === 404) return 'Ván chơi không khả dụng cho tài khoản này.'
    if (error.status === 422 || error.status === 400) return 'Lựa chọn này không khả dụng. Hãy kiểm tra lại.'
  }
  return 'Chưa nhận được phản hồi từ máy chủ. Hãy kiểm tra kết nối và thử lại.'
}

type ActionApi = Pick<ReturnType<typeof createGameApi>, 'action' | 'read'>
type Pending = { body: GameActionRequest; key: string }
type View = { detail: SessionDetail; busy: boolean; retryable: boolean; needsReload: boolean; message: string }

export function createServerSession(api: ActionApi, initial: SessionDetail, newKey: () => string = () => crypto.randomUUID()) {
  let view: View = { detail: initial, busy: false, retryable: false, needsReload: false, message: '' }
  let pending: Pending | undefined
  const listeners = new Set<() => void>()
  function publish(update: Partial<View>) {
    view = { ...view, ...update }
    for (const listener of listeners) listener()
  }
  async function reload(message = '') {
    if (view.busy || pending) return false
    publish({ busy: true })
    try {
      const detail = await api.read(initial.session.id)
      publish({ detail, needsReload: false, message })
      return true
    } catch (error) {
      publish({ needsReload: true, message: apiMessage(error) })
      return false
    } finally {
      publish({ busy: false })
    }
  }
  async function retry() {
    if (view.busy || !pending) return false
    const { body, key } = pending
    publish({ busy: true, retryable: false, message: '' })
    try {
      const reply = await api.action(initial.session.id, body, key)
      if (reply.sessionId !== initial.session.id || reply.stateVersion !== body.expectedStateVersion + 1) {
        throw new Error('Unexpected action response version')
      }
      pending = undefined
      publish({ detail: {
        session: { ...view.detail.session, stateVersion: reply.stateVersion, status: reply.result ? 'completed' : 'active' },
        state: reply.state,
        result: reply.result,
      } })
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        pending = undefined
        publish({ busy: false, needsReload: true })
        await reload('Ván đã thay đổi. Đã tải lại trạng thái từ máy chủ.')
      } else {
        if (!recoverable(error)) pending = undefined
        publish({ retryable: !!pending, message: apiMessage(error) })
      }
      return false
    } finally {
      publish({ busy: false })
    }
  }
  return {
    getSnapshot: () => view,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    send(command: MobileCommand, version: number) {
      if (view.busy || pending || view.needsReload || version !== view.detail.session.stateVersion) return Promise.resolve(false)
      pending = { body: actionRequest(command, version), key: newKey() }
      return retry()
    },
    retry,
    reload,
    clearMessage() { if (!view.needsReload && !pending) publish({ message: '' }) },
  }
}
