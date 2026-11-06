/** Build-time approval for the integrated game Preview; query parameters cannot enable a build. */
export function integrationPreviewSettings(env: Record<string, string | undefined>) {
  const actual = env.VERCEL_PROJECT_ID
  const expected = env.EXE_AI_UI_EXPECTED_PROJECT_ID
  const enabled = env.VERCEL_ENV === 'preview'
    && env.VERCEL_GIT_COMMIT_REF === 'feat/ai-companion-ui-preview'
    && env.EXE_AI_UI_PREVIEW === '1'
    && !!actual && !!expected && actual.trim() === actual && expected.trim() === expected
    && actual === expected
  return { enabled, environment: env.VERCEL_ENV ?? '' }
}
