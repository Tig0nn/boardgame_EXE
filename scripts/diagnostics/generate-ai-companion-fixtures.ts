import { mkdirSync, writeFileSync } from 'node:fs'
import { buildRepairContext, createCompanionRequest, createAdviceCandidate, deterministicAdvice,
  renderMockAdvice, errorResponse } from '../../src/ai/companion/index.ts'
import type { AdviceMode } from '../../src/ai/companion/types.ts'
import { revealedRepair } from '../../tests/helpers/companion.ts'

if (!process.argv.includes('--write')) throw new Error('Explicit --write required; never regenerate goldens in tests.')
const cases: Array<{ name: string; mode: AdviceMode; lap?: number; cash?: number; obligations?: number }> = [
  { name: 'explain', mode: 'explain' }, { name: 'compare', mode: 'compare' }, { name: 'guide', mode: 'guide' },
  { name: 'existing-obligations', mode: 'compare', obligations: 2_000_000 },
  { name: 'low-cash', mode: 'compare', cash: 500_000 }, { name: 'zero-cash', mode: 'guide', cash: 0 },
  { name: 'temporary-cash-sufficient', mode: 'explain', cash: 1_000_000 },
  { name: 'final-lap', mode: 'compare', lap: 4 },
  { name: 'signed-net-worth', mode: 'compare', obligations: 60_000_000 },
]
const examples = []
for (const fixture of cases) {
  const game = revealedRepair(fixture.lap ?? 1)
  if (fixture.cash !== undefined) game.portfolio.cash = fixture.cash
  if (fixture.obligations !== undefined) game.obligations = fixture.obligations
  const context = buildRepairContext(game, { sessionEpoch: `golden-${fixture.name}`, revision: 1 })
  const request = await createCompanionRequest(context, fixture.mode, `req-${fixture.name}`)
  const candidate = createAdviceCandidate(request)
  const fallback = await deterministicAdvice(request)
  const success = context.options.every(option => option.execution === 'cash-sufficient') ? await renderMockAdvice(request, candidate) : null
  examples.push({ name: fixture.name, provenance: fixture.cash !== undefined || fixture.obligations !== undefined
    ? 'Controlled financial variation of a naturally revealed encounter; not a replay fixture.' : 'Naturally played to revealed repair; no injected event or RNG.',
  request, candidate, success, fallback })
}
const request = examples.find(example => example.name === 'compare')!.request
const badRole = structuredClone(createAdviceCandidate(request)); badRole.tradeoffs[0].statements[0].bindings.now = 'temporary.now'
const badAmount = { ...createAdviceCandidate(request), amountVnd: 999_999_999 }
const badProbability = { ...createAdviceCandidate(request), probability: 0.99 }
const errors = { invalidOptions: errorResponse('INVALID_OPTIONS', request), rateLimited: errorResponse('RATE_LIMITED', request, 30_000),
  unavailable: errorResponse('SERVICE_UNAVAILABLE', request), unsupported: errorResponse('UNSUPPORTED_VERSION') }
mkdirSync('tests/fixtures/ai-companion', { recursive: true })
writeFileSync('tests/fixtures/ai-companion/golden-v1.json', JSON.stringify({ apiVersion: 1, contextVersion: 'b18-advice.v1',
  status: 'Offline mock and deterministic contracts only. No Gemini or HTTP endpoint.', examples, errors,
  invalidCandidates: [{ name: 'wrong-fact-role', candidate: badRole }, { name: 'raw-amount', candidate: badAmount },
    { name: 'probability', candidate: badProbability }] }, null, 2) + '\n')
console.log(JSON.stringify({ examples: examples.length, errors: Object.keys(errors).length, invalidCandidates: 3 }))
