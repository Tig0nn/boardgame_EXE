import type { publicB18State, officialB18Result } from '../../../apps/api/src/services/b18-actions.ts'
import type { GameActionRequest } from '../../../apps/api/src/validation.ts'
import type { Term } from '../../../src/game/types.ts'
import type { MobileCommand } from './session.ts'

export type ServerState = ReturnType<typeof publicB18State>
export type OfficialResult = ReturnType<typeof officialB18Result>
export type Setup = { initialSavings: number; savingsTerm: Term }
export type SessionHeader = { id: string; status: 'active' | 'completed' | 'abandoned'; stateVersion: number; setup: Setup; updatedAt: string }
export type SessionDetail = { session: SessionHeader; state: ServerState; result: OfficialResult }
export type ActionReply = { sessionId: string; stateVersion: number; state: ServerState; result: OfficialResult }
export type Quote = { cashAfter: number; cashPaid?: number; cashReceived?: number; fee?: number; spread?: number; repayment?: { interest: number }; deposit?: { interestAtMaturity: number }; funding?: { lostInterest: number } }

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

export function createGameApi(accessToken: () => Promise<string | null>) {
  async function request<T>(path: string, body?: object, key?: string): Promise<T> {
    const token = await accessToken()
    if (!token) throw new ApiError(401, 'UNAUTHORIZED')
    const response = await fetch('/v1/game-sessions' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
      headers: {
        authorization: 'Bearer ' + token,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const value = await response.json().catch(() => null)
      throw new ApiError(response.status, value?.error?.code ?? 'REQUEST_FAILED')
    }
    return await response.json() as T
  }
  return {
    list: (offset = 0) => request<{ sessions: SessionHeader[] }>('?limit=20&offset=' + offset),
    create: (setup: Setup, key: string) => request<{ session: SessionHeader }>('', { scenarioId: 'b18', setup }, key),
    read: (id: string) => request<SessionDetail>('/' + encodeURIComponent(id)),
    action: (id: string, body: GameActionRequest, key: string) => request<ActionReply>('/' + encodeURIComponent(id) + '/actions', body, key),
    quote(id: string, body: GameActionRequest) {
      const path = '/' + encodeURIComponent(id)
      const { actionId, payload, expectedStateVersion } = body
      const input = { payload, expectedStateVersion }
      if (actionId === 'fund' && (body.payload.source === 'debt' || body.payload.source === 'savings')) {
        return request<{ quote: Quote }>(path + '/bank-quote', { actionId, ...input })
      }
      if (actionId !== 'trade') return null
      if (!('asset' in body.payload)) return request<{ quote: Quote }>(path + '/bank-quote', { actionId, ...input })
      return request<{ quote: Quote }>(path + (body.payload.asset === 'business' ? '/business-quote' : '/trade-quote'), input)
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
      const { kind, amount, asset, term, symbolId, lotId, issuerId, customerPreferenceId } = command.action
      if (kind === 'deposit') return { actionId: 'trade', expectedStateVersion, payload: { kind, amount, term } }
      if (kind === 'repay') return { actionId: 'trade', expectedStateVersion, payload: { kind, amount } }
      if (asset === 'business') {
        if (kind === 'upgrade') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, customerPreferenceId } }
        if (kind === 'buy' || kind === 'sell') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount } }
      }
      if (kind === 'buy' || kind === 'sell') {
        if (asset === 'gold') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount } }
        if (asset === 'stocks') return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, symbolId } }
        if (asset === 'bonds' && kind === 'buy' && issuerId) return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, issuerId } }
        if (asset === 'bonds' && kind === 'sell' && lotId) return { actionId: 'trade', expectedStateVersion, payload: { kind, asset, amount, lotId } }
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
    if (error.status === 404) return 'Ván chơi không khả dụng cho tài khoản này.'
    if (error.status === 422 || error.status === 400) return 'Lựa chọn này không khả dụng. Hãy kiểm tra lại.'
  }
  return 'Chưa nhận được phản hồi từ máy chủ. Hãy kiểm tra kết nối và thử lại.'
}

type ActionApi = Pick<ReturnType<typeof createGameApi>, 'action' | 'read'>
type Pending = { body: GameActionRequest; key: string }
type View = { detail: SessionDetail; busy: boolean; retryable: boolean; needsReload: boolean; message: string }

export function createServerSession(api: ActionApi, initial: SessionDetail) {
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
      pending = { body: actionRequest(command, version), key: crypto.randomUUID() }
      return retry()
    },
    retry,
    reload,
    clearMessage() { if (!view.needsReload && !pending) publish({ message: '' }) },
  }
}
