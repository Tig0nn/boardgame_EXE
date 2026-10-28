import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { canonicalJson } from '../src/ai/companion/serialization.ts'
import { parseRepairContext, contextDigest, createCompanionRequest, parseCompanionRequest } from '../src/ai/companion/contracts.ts'
import { revealedRepair } from './helpers/companion.ts'
import { ERROR_POLICY } from '../src/ai/companion/errors.ts'

const context = () => buildRepairContext(revealedRepair(), { sessionEpoch: 'contract', revision: 1 })

test('canonical context digest ignores object insertion order, not revisions or array order', async () => {
  const original = context()
  const reversed = JSON.parse(JSON.stringify(original), (_key, value) => value && !Array.isArray(value) && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse()) : value)
  assert.equal(await contextDigest(original), await contextDigest(reversed))
  reversed.decision.stateRevision = 'contract:2'
  assert.notEqual(await contextDigest(original), await contextDigest(reversed))
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]))
})

for (const key of ['seed', 'rng', 'futureDice', 'rawState', 'debug', 'apiKey', '__proto__']) {
  test(`strict schemas reject ${key} at every object boundary`, async () => {
    for (const scope of ['root', 'profile', 'decision', 'financial', 'option']) {
      const value = context()
      const target = scope === 'root' ? value : scope === 'option' ? value.options[0] : value[scope]
      Object.defineProperty(target, key, { value: 'PRIVATE_CANARY', enumerable: true })
      assert.throws(() => parseRepairContext(value))
    }
    const request = await createCompanionRequest(context(), 'compare', 'req')
    await assert.rejects(parseCompanionRequest({ ...request, [key]: 'PRIVATE_CANARY' }))
  })
}

test('rejects forged quotes, option IDs, numeric edge cases, profiles and data outside the closed repair scope', () => {
  const mutations = [
    c => { c.options[0].costNowVnd = 1 }, c => { c.options[0].optionId = 'skip' },
    c => { c.options[1].optionId = 'full' }, c => { c.options[1].dueLap = 2 },
    c => { c.financial.cashVnd = -1 }, c => { c.financial.cashVnd = 1.5 },
    c => { c.financial.cashVnd = NaN }, c => { c.financial.cashVnd = Infinity },
    c => { c.financial.cashVnd = Number.MAX_SAFE_INTEGER + 1 },
    c => { c.financial.obligationsVnd = Number.MAX_SAFE_INTEGER },
    c => { c.profile.gameplayProfile = 'core-mvp-b18-v1' },
    c => { c.decision.lap = 5 }, c => { c.decision.phase = 'funding' },
    c => { c.revealedDecisions.push({ seed: 'CANARY' }) }, c => { c.publicMarket.push({ future: 100 }) },
  ]
  for (const mutate of mutations) { const value = structuredClone(context()); mutate(value); assert.throws(() => parseRepairContext(value)) }
})

test('request validation checks versions, UTF8 byte cap, parse errors, digest and detached input', async () => {
  const request = await createCompanionRequest(context(), 'compare', 'req')
  await assert.rejects(parseCompanionRequest({ ...request, apiVersion: 2 }), { code: 'UNSUPPORTED_VERSION' })
  await assert.rejects(parseCompanionRequest({ ...request, mode: 'choose-for-me' }))
  await assert.rejects(parseCompanionRequest('{'), { code: 'INVALID_JSON' })
  await assert.rejects(parseCompanionRequest(' '.repeat(8193)), { code: 'PAYLOAD_TOO_LARGE' })
  await assert.rejects(parseCompanionRequest('à'.repeat(4097)), { code: 'PAYLOAD_TOO_LARGE' })
  await assert.rejects(parseCompanionRequest({ ...request, contextDigest: 'sha256:' + '0'.repeat(64) }), { code: 'CONTEXT_MISMATCH' })
  const pending = parseCompanionRequest(request)
  request.context.decision.stateRevision = 'changed'
  assert.equal((await pending).context.decision.stateRevision, 'contract:1')
})

test('boundary failures preserve financial, option and profile error taxonomy', () => {
  const financial = context(); financial.financial.cashVnd = -1
  assert.throws(() => parseRepairContext(financial), { code: 'INVALID_FINANCIAL_CONTEXT' })
  const options = JSON.parse(JSON.stringify(context())); options.options[0].optionId = 'skip'
  assert.throws(() => parseRepairContext(options), { code: 'INVALID_OPTIONS' })
  const profile = JSON.parse(JSON.stringify(context())); profile.profile.gameplayProfile = 'legacy'
  assert.throws(() => parseRepairContext(profile), { code: 'UNSUPPORTED_PROFILE' })
  assert.equal(ERROR_POLICY.INVALID_FINANCIAL_CONTEXT[0], 422)
  assert.equal(ERROR_POLICY.INVALID_OPTIONS[0], 422)
  assert.equal(ERROR_POLICY.UNSUPPORTED_PROFILE[0], 409)
})
