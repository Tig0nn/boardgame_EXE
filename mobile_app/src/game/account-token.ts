type AccountSession = { user: { id: string }; access_token: string }

export type AccessToken = (rejected?: string) => Promise<string | null>

export function createAccountToken<T extends AccountSession>(
  owner: string,
  read: () => Promise<T | null>,
  refresh: () => Promise<T | null>,
  onExpired: (rejected?: string) => void,
): AccessToken {
  let refreshing: Promise<T | null> | undefined
  return async rejected => {
    const current = await read()
    if (!current) { onExpired(rejected); return null }
    if (current.user.id !== owner) return null
    if (current.access_token !== rejected) return current.access_token

    refreshing ??= refresh().finally(() => { refreshing = undefined })
    const updated = await refreshing
    const latest = await read()
    if (latest && latest.user.id !== owner) return null
    if (!updated || !latest) { onExpired(rejected); return null }
    if (updated.user.id !== owner) return null
    if (latest.access_token === rejected) { onExpired(rejected); return null }
    return latest.access_token
  }
}
