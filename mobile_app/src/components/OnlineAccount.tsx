import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { Modal } from '../../../src/components/Modal'
import App from '../App'
import { OnlineApp } from './OnlineApp'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const auth = url?.startsWith('https://') && key?.startsWith('sb_publishable_')
  ? createClient(url, key).auth : null

export function OnlineAccount() {
  const [session, setSession] = useState<Session | null | undefined>(auth ? undefined : null)
  const [practice, setPractice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!auth) return
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  const owner = session?.user.id
  const accessToken = useCallback(async () => {
    const current = (await auth?.getSession())?.data.session
    return current && current.user.id === owner ? current.access_token : null
  }, [owner])
  const signOut = async () => {
    try {
      if ((await auth?.signOut())?.error) throw new Error('Sign-out failed')
    } catch { setError('Không thể đăng xuất. Hãy thử lại.') }
  }
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth || busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const result = await auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) })
      if (result.error) setError('Không thể đăng nhập. Hãy kiểm tra thông tin và kết nối.')
    } catch {
      setError('Không thể kết nối dịch vụ đăng nhập.')
    } finally { setBusy(false) }
  }
  if (practice) return <App onLeaveLocal={() => setPractice(false)} />
  if (session) return <>
    <OnlineApp key={session.user.id} accessToken={accessToken}
      onSignOut={() => { void signOut() }} onPractice={() => setPractice(true)} />
    {error && <Modal title="Đăng xuất" onClose={() => setError('')}><p role="alert">{error}</p></Modal>}
  </>
  return <Modal title="EXE trực tuyến">
    <h2>EXE trực tuyến</h2>
    {session === undefined ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : auth ?
      <form onSubmit={signIn}>
        <label htmlFor="online-email">Email</label>
        <input className="text-input" id="online-email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="online-password">Mật khẩu</label>
        <input className="text-input" id="online-password" name="password" type="password" autoComplete="current-password" required />
        <button className="button primary" disabled={busy}>Đăng nhập</button>
      </form> : <p>Đăng nhập trực tuyến chưa được cấu hình cho môi trường này.</p>}
    {error && <p role="alert">{error}</p>}
    <button className="button secondary" type="button" onClick={() => setPractice(true)}>Chơi local</button>
  </Modal>
}
