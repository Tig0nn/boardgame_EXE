const callbackParams = ['code', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token']

export function takeConfirmationCode(url: URL) {
  const query = url.searchParams
  const fragment = new URLSearchParams(url.hash.slice(1))
  const hasCallbackFragment = callbackParams.some(key => fragment.has(key))
  if (!hasCallbackFragment && !callbackParams.some(key => query.has(key))) return null

  const codes = query.getAll('code')
  const failed = hasCallbackFragment || codes.length !== 1 || !codes[0] ||
    callbackParams.slice(1).some(key => query.has(key))
  const cleaned = new URL(url)
  for (const key of callbackParams) cleaned.searchParams.delete(key)
  if (hasCallbackFragment) cleaned.hash = ''
  return { code: failed ? null : codes[0], failed: Boolean(failed), cleanUrl: cleaned.href }
}
