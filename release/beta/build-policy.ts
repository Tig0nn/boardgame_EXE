export function betaBuildSettings(env: Record<string, string | undefined>) {
  if (env.VERCEL_ENV !== 'preview') throw Error('Beta build requires VERCEL_ENV=preview; production is refused.')
  if (env.EXE_AI_BETA_PREVIEW !== '1') throw Error('Beta build requires explicit Owner preview approval flag EXE_AI_BETA_PREVIEW=1.')
  if (env.VERCEL === '1') {
    const actual = env.VERCEL_PROJECT_ID, expected = env.EXE_AI_BETA_EXPECTED_PROJECT_ID
    if (!actual || !expected || actual.trim() !== actual || expected.trim() !== expected || actual !== expected) {
      throw Error('Beta project ID verification refused: missing or mismatched actual/Owner-approved expected project ID.')
    }
  }
  return { environment: 'preview', enabled: '1', project: 'exe-companion-beta' } as const
}
