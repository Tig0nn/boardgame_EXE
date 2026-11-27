import 'react-native-url-polyfill/auto'
import { createClient, type AuthError, type Session } from '@supabase/supabase-js'
import { fetch as nativeFetch } from 'expo/fetch'
import * as SecureStore from 'expo-secure-store'
import { AppState, Linking } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { createAccountToken } from '../../src/game/account-token'
import { createGameApi } from '../../src/game/server-session'

const apiOrigin = process.env.EXPO_PUBLIC_EXE_API_ORIGIN?.trim()
const authOrigin = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
const publishable = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
const whatIfGemini = process.env.EXPO_PUBLIC_EXE_WHATIF_GEMINI === '1'
const authStore = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
}
const safeOrigin = (value?: string) => {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined
    if (url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:' &&
        ['127.0.0.1', '10.0.2.2', 'localhost'].includes(url.hostname))) return url.origin
  } catch { /* invalid or missing deployment configuration */ }
  return undefined
}
const endpoint = safeOrigin(apiOrigin)
const authUrl = safeOrigin(authOrigin)
export const auth = endpoint && authUrl && publishable && publishable.startsWith('sb_publishable_') ? createClient(authUrl, publishable, {
  auth: { storage: authStore, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' },
}).auth : null
const callback = 'exe-boardgame://auth/callback'

export function useAccount() {
  const [session, setSession] = useState<Session | null>()
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!auth) return
    const client = auth
    let alive = true
    let usedCode: string | null = null
    const handle = async (value: string | null) => {
      if (!value || !alive) return
      const url = new URL(value)
      if (url.protocol !== 'exe-boardgame:' || url.hostname !== 'auth' || url.pathname !== '/callback') return
      const code = url.searchParams.get('code')
      if (!code || code === usedCode) return
      usedCode = code
      try {
        const response = await client.exchangeCodeForSession(code)
        if (alive) setMessage(response.error ? 'Liên kết xác nhận đã hết hạn hoặc không thuộc thiết bị này.' : 'Email đã được xác nhận.')
      } catch { if (alive) setMessage('Chưa kết nối được để xác nhận email.') }
    }
    const { data } = client.onAuthStateChange((_event, next) => { if (alive) setSession(next) })
    const link = Linking.addEventListener('url', ({ url }) => { void handle(url) })
    void Linking.getInitialURL().then(handle).catch(() => {})
    const refresh = (state: string) => {
      if (state === 'active') void client.startAutoRefresh()
      else void client.stopAutoRefresh()
    }
    refresh(AppState.currentState)
    const appState = AppState.addEventListener('change', refresh)
    return () => {
      alive = false
      data.subscription.unsubscribe()
      link.remove()
      appState.remove()
      void client.stopAutoRefresh()
    }
  }, [])

  const owner = session?.user.id
  const api = useMemo(() => {
    const client = auth
    if (!owner || !endpoint || !client) return
    const read = (response: { data: { session: Session | null }; error: AuthError | null }) => {
      if (response.error && (response.error.status == null || response.error.status >= 500)) throw response.error
      return response.data.session
    }
    const token = createAccountToken(owner, async () => read(await client.getSession()),
      async () => read(await client.refreshSession()), () => setMessage('Phiên đăng nhập đã hết hạn.'))
    const send: typeof fetch = (url, init) => nativeFetch(endpoint + String(url), init) as unknown as Promise<Response>
    return createGameApi(token, send, whatIfGemini)
  }, [owner])

  return {
    configured: auth !== null, ready: auth === null || session !== undefined, session, api, message,
    authenticate: async (email: string, password: string, register: boolean) => {
      if (!auth) return
      setMessage('')
      try {
        const result = register
          ? await auth.signUp({ email, password, options: { emailRedirectTo: callback } })
          : await auth.signInWithPassword({ email, password })
        setMessage(result.error ? 'Đăng nhập hoặc đăng ký chưa thành công. Kiểm tra email và mật khẩu.'
          : register && !result.data.session ? 'Mở liên kết xác nhận trong email trên thiết bị này.' : '')
      } catch { setMessage('Không thể kết nối dịch vụ đăng nhập. Hãy thử lại.') }
    },
    signOut: async () => {
      try {
        const result = await auth?.signOut({ scope: 'local' })
        setMessage(result?.error ? 'Chưa đăng xuất được. Hãy thử lại.' : '')
        return !result?.error
      } catch {
        setMessage('Chưa đăng xuất được. Hãy thử lại.')
        return false
      }
    },
  }
}
