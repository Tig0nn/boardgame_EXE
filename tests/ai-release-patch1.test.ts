import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betaBuildSettings } from '../release/beta/build-policy.ts'

// Synthetic unit-test identifiers only. No actual Beta project exists or is configured.
const preview = { VERCEL: '1', VERCEL_ENV: 'preview', EXE_AI_BETA_PREVIEW: '1' }
const ids = { VERCEL_PROJECT_ID: 'unit-beta-id-not-real', EXE_AI_BETA_EXPECTED_PROJECT_ID: 'unit-beta-id-not-real' }
test('Hosted Preview accepts only independently configured matching project IDs, without a project-name variable', () => {
  assert.equal(betaBuildSettings({ ...preview, ...ids }).enabled, '1')
})
test('A matching project name cannot substitute for either missing ID or mask a mismatch', () => {
  const named = { ...preview, VERCEL_PROJECT_NAME: 'exe-companion-beta' }
  for (const pair of [{}, { VERCEL_PROJECT_ID: ids.VERCEL_PROJECT_ID }, { EXE_AI_BETA_EXPECTED_PROJECT_ID: ids.EXE_AI_BETA_EXPECTED_PROJECT_ID }, { ...ids, VERCEL_PROJECT_ID: 'unit-other-id-not-real' }]) assert.throws(() => betaBuildSettings({ ...named, ...pair }), /project ID/i)
})
test('Whitespace, empty and padded IDs fail closed rather than being silently normalized', () => {
  for (const pair of [{ ...ids, VERCEL_PROJECT_ID: '' }, { ...ids, EXE_AI_BETA_EXPECTED_PROJECT_ID: '' }, { VERCEL_PROJECT_ID: ' ', EXE_AI_BETA_EXPECTED_PROJECT_ID: ' ' }, { VERCEL_PROJECT_ID: ' padded ', EXE_AI_BETA_EXPECTED_PROJECT_ID: ' padded ' }]) assert.throws(() => betaBuildSettings({ ...preview, ...pair }), /project ID/i)
})
test('Production and absent explicit approval are refused even with matching IDs', () => {
  assert.throws(() => betaBuildSettings({ ...preview, ...ids, VERCEL_ENV: 'production' }), /preview/i)
  assert.throws(() => betaBuildSettings({ ...preview, ...ids, EXE_AI_BETA_PREVIEW: undefined }), /approval/i)
})
test('Local artifact QA requires preview and approval but does not configure a real project ID', () => {
  assert.equal(betaBuildSettings({ VERCEL_ENV: 'preview', EXE_AI_BETA_PREVIEW: '1' }).enabled, '1')
})
