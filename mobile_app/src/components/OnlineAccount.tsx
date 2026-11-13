import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { AuthError, Session } from '@supabase/supabase-js'
import { Modal } from '../../../src/components/Modal'
import App from '../App'
import { createAccountToken } from '../game/account-token'
import { takeConfirmationCode } from '../game/auth-redirect'
import { OnlineApp } from './OnlineApp'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const auth = url?.startsWith('https://') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, { auth: {
    flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
  } }).auth : null

type AuthClient = NonNullable<typeof auth>

let confirmation: Promise<boolean> | undefined

async function confirmEmail(client: AuthClient) {
  const redirect = takeConfirmationCode(new URL(window.location.href))
  if (!redirect) return true
  window.history.replaceState(window.history.state, '', redirect.cleanUrl)
  if (!redirect.code) return false
  try {
    const { error } = await client.exchangeCodeForSession(redirect.code)
    return !error
  } catch {
    return false
  }
}

function SignedInAccount({ client, owner, onExpired, onSignOut, onPractice }: {
  client: AuthClient; owner: string; onExpired: (rejected?: string) => void
  onSignOut: () => void; onPractice: () => void
}) {
  const [accessToken] = useState(() => {
    const read = ({ data, error }: { data: { session: Session | null }; error: AuthError | null }) => {
      if (error && (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500 || error.status === 429)) throw error
      return data.session
    }
    return createAccountToken(owner,
      async () => read(await client.getSession()),
      async () => read(await client.refreshSession()),
      onExpired)
  })
  return <OnlineApp accessToken={accessToken} onSignOut={onSignOut} onPractice={onPractice} />
}

export function OnlineAccount() {
  const [session, setSession] = useState<Session | null | undefined>(auth ? undefined : null)
  const [practice, setPractice] = useState(false)
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checkingConfirmation, setCheckingConfirmation] = useState(!!auth)
  const submitting = useRef(false)

  useEffect(() => {
    if (!auth) return
    let active = true
    const { data } = auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') setRegister(false)
      setSession(next)
    })
    confirmation ??= confirmEmail(auth)
    void confirmation.then(confirmed => {
      if (!active) return
      if (!confirmed) setError('Không thể hoàn tất xác nhận trong trình duyệt này. Hãy đăng nhập nếu email đã được xác nhận, hoặc mở liên kết mới trong trình duyệt đã đăng ký.')
      setCheckingConfirmation(false)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  const signOut = async () => {
    if (!auth || submitting.current) return
    submitting.current = true
    setError('')
    try {
      const result = await auth.signOut({ scope: 'local' })
      if (result.error) setError('Không thể đăng xuất. Hãy thử lại.')
    } catch { setError('Không thể đăng xuất. Hãy thử lại.') }
    finally { submitting.current = false }
  }

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth || submitting.current) return
    const form = new FormData(event.currentTarget)
    const credentials = { email: String(form.get('email')).trim(), password: String(form.get('password')) }
    submitting.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (register) {
        const emailRedirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href
        const { data, error } = await auth.signUp({ ...credentials, options: { emailRedirectTo } })
        if (error) setError('Không thể đăng ký. Hãy kiểm tra email, mật khẩu và thử lại.')
        else if (!data.session) setNotice('Hãy kiểm tra email để xác nhận tài khoản. Mở liên kết trên trình duyệt đã đăng ký hoặc quay lại đăng nhập sau khi xác nhận.')
      } else {
        const { error } = await auth.signInWithPassword(credentials)
        if (error) setError('Không thể đăng nhập. Hãy kiểm tra thông tin và xác nhận email nếu được yêu cầu.')
      }
    } catch { setError('Không thể kết nối dịch vụ đăng nhập.') }
    finally { submitting.current = false; setBusy(false) }
  }

  if (practice) return <App onLeaveLocal={() => setPractice(false)} />
  if (auth && session && !checkingConfirmation) return <>
    <SignedInAccount key={session.user.id} client={auth} owner={session.user.id}
      onExpired={rejected => setSession(previous => {
        if (!previous || previous.user.id !== session.user.id || (rejected && previous.access_token !== rejected)) return previous
        return null
      })}
      onSignOut={() => { void signOut() }} onPractice={() => setPractice(true)} />
    {error && <Modal title="Tài khoản EXE" onClose={() => setError('')}><p role="alert">{error}</p></Modal>}
  </>
  return <Modal title="EXE trực tuyến">
    <h2>{register ? 'Tạo tài khoản EXE' : 'EXE trực tuyến'}</h2>
    {session === undefined || checkingConfirmation ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : auth ?
      <form onSubmit={authenticate}>
        <label htmlFor="online-email">Email</label>
        <input className="text-input" id="online-email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="online-password">Mật khẩu</label>
        <input className="text-input" id="online-password" name="password" type="password"
          autoComplete={register ? 'new-password' : 'current-password'} required />
        <button className="button primary" disabled={busy}>{register ? 'Đăng ký' : 'Đăng nhập'}</button>
        <button className="button secondary" type="button" disabled={busy}
          onClick={() => { setRegister(!register); setError(''); setNotice('') }}>
          {register ? 'Quay lại đăng nhập' : 'Tạo tài khoản'}
        </button>
      </form> : <p>Đăng nhập trực tuyến chưa được cấu hình cho môi trường này.</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    <button className="button secondary" type="button" disabled={busy} onClick={() => setPractice(true)}>Chơi local</button>
  </Modal>
}
