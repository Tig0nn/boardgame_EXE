import test from 'node:test'
import assert from 'node:assert/strict'
import { integrationPreviewSettings } from '../mobile_app/preview-policy.ts'

const approved = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feat/ai-companion-ui-preview',
  EXE_AI_UI_PREVIEW: '1',
  VERCEL_PROJECT_ID: 'approved-mobile-project',
  EXE_AI_UI_EXPECTED_PROJECT_ID: 'approved-mobile-project',
}

test('integration AI is enabled only for the explicitly approved branch, Preview, and project', () => {
  assert.equal(integrationPreviewSettings(approved).enabled, true)
  for (const patch of [
    { VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' },
    { VERCEL_GIT_COMMIT_REF: 'main' },
    { VERCEL_GIT_COMMIT_REF: 'codex/b18-compact-financial-ui' },
    { EXE_AI_UI_PREVIEW: '' }, { VERCEL_PROJECT_ID: 'another-project' },
    { EXE_AI_UI_EXPECTED_PROJECT_ID: '' },
  ]) assert.equal(integrationPreviewSettings({ ...approved, ...patch }).enabled, false, JSON.stringify(patch))
  assert.equal(integrationPreviewSettings({}).enabled, false)
})
