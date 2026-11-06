import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betaEnabled } from '../mobile_app/src/game/beta-feature.ts'

test('Production environment always blocks AI, even with DEV, beta mode, flag and query', () => {
  for (const dev of [true, false]) for (const mode of ['production', 'development', 'beta']) {
    assert.equal(betaEnabled(dev, mode, 'production', '?aiBeta=1', '1'), false)
  }
})
test('Approved isolated preview is enabled in a production-optimized Vite build', () => {
  assert.equal(betaEnabled(false, 'production', 'preview', '?aiBeta=1', '1'), true)
  assert.equal(betaEnabled(false, 'beta', 'preview', '?aiBeta=1', '1'), true)
})
test('Query and mode alone cannot enable a hosted build without explicit preview approval flag', () => {
  for (const mode of ['production', 'beta', 'development']) {
    assert.equal(betaEnabled(false, mode, 'preview', '?aiBeta=1'), false)
    assert.equal(betaEnabled(false, mode, undefined, '?aiBeta=1', '1'), false)
  }
  assert.equal(betaEnabled(false, 'production', 'preview', '', '1'), false)
  assert.equal(betaEnabled(false, 'production', 'preview', '?aiBeta=true', '1'), false)
})
test('Local development remains explicit opt-in and is not confused with hosted preview', () => {
  assert.equal(betaEnabled(true, 'development', undefined, '?aiBeta=1'), true)
  assert.equal(betaEnabled(true, 'development', undefined, ''), false)
  assert.equal(betaEnabled(true, 'development', 'preview', '?aiBeta=1'), false)
})
test('DEV cannot expose AI on a public hostname when deployment env metadata is missing', () => {
  assert.equal(betaEnabled(true, 'development', undefined, '?aiBeta=1', undefined, 'production-mobile.example'), false)
  assert.equal(betaEnabled(true, 'development', undefined, '?aiBeta=1', undefined, '127.0.0.1'), true)
})
test('Beta build policy refuses production, missing approval and the wrong Vercel project', async () => {
  const { betaBuildSettings } = await import('../release/beta/build-policy.ts')
  assert.throws(() => betaBuildSettings({}), /preview/)
  assert.throws(() => betaBuildSettings({ VERCEL_ENV: 'production', EXE_AI_BETA_PREVIEW: '1' }), /preview/)
  assert.throws(() => betaBuildSettings({ VERCEL_ENV: 'preview' }), /approval/)
  assert.throws(() => betaBuildSettings({ VERCEL: '1', VERCEL_ENV: 'preview', EXE_AI_BETA_PREVIEW: '1', VERCEL_PROJECT_ID: 'unit-other-project' }), /project ID/)
  const expected = { environment: 'preview', enabled: '1', project: 'exe-companion-beta' }
  assert.deepEqual(betaBuildSettings({ VERCEL_ENV: 'preview', EXE_AI_BETA_PREVIEW: '1' }), expected)
  assert.deepEqual(betaBuildSettings({ VERCEL: '1', VERCEL_ENV: 'preview', EXE_AI_BETA_PREVIEW: '1', VERCEL_PROJECT_ID: 'unit-beta-project', EXE_AI_BETA_EXPECTED_PROJECT_ID: 'unit-beta-project' }), expected)
})
