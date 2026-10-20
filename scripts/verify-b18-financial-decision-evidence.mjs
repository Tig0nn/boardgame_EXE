import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = 'docs/playtests/b18-financial-decision-copy', target = `${root}/manifest.json`
const base = '1f60d792fb88d1e22dc4c9a3f928daa2efc2dd6b', implementation = '005c2b377da5c737bb5db2ce24a7980b5add1746'
const text = p => readFileSync(p, 'utf8'), json = p => JSON.parse(text(p))
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
const files = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${p}/${e.name}`) : [`${p}/${e.name}`])
const describe = (path, source = false) => {
  const b = source ? Buffer.from(text(path).replaceAll('\r\n', '\n')) : readFileSync(path)
  return { path, bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') }
}
assert.deepEqual(git(['diff', '--name-only', base, '--', 'src', 'mobile_app/src']).split('\n').sort(), [
  'mobile_app/src/components/EventModal.tsx', 'src/components/GameDialogs.tsx', 'src/components/MarketDetails.tsx',
  'src/components/SavingsPreview.tsx', 'src/components/SavingsTerms.tsx', 'src/components/TradingPanel.tsx',
  'src/components/financial-decision-copy.ts', 'src/components/savings-preview.css',
].sort())
assert.equal(git(['diff', '--name-only', base, '--', 'src/game', 'src/data', 'mobile_app/src/game', 'scripts/research', 'docs/research',
  'package.json', 'package-lock.json', 'mobile_app/package.json', 'mobile_app/package-lock.json']), '')
assert.equal(git(['diff', '--name-only', base, '--', 'docs', ':(exclude)docs/playtests/b18-financial-decision-copy', ':(exclude)docs/B18_FINANCIAL_DECISION_CLARITY_REPORT.md']), '', 'All older QA docs and evidence must remain unchanged')
for (const path of ['mobile_app/src/components/EventModal.tsx', 'src/components/GameDialogs.tsx']) {
  assert.deepEqual(text(path).match(/onChoose\([^)]*\)/g), git(['show', `${base}:${path}`]).match(/onChoose\([^)]*\)/g), 'Option action callbacks unchanged')
}
for (const [log, passed] of [['product-tests.txt', 354], ['ssr-tests.txt', 60]]) {
  assert.match(text(`${root}/${log}`), new RegExp(`# pass ${passed}\\b`)); assert.match(text(`${root}/${log}`), /# fail 0\b/)
}
for (const name of ['lint.txt', 'typecheck-mobile.txt', 'typecheck-shared.txt']) assert.equal(text(`${root}/${name}`).trim(), '')
assert.match(text(`${root}/build-mobile.txt`), /built in/)
const before = json(`${root}/before/results.json`), after = json(`${root}/after/results.json`)
assert.equal(before.checks.length, 44); assert.equal(after.checks.length, 116)
assert.deepEqual(before.errors, []); assert.deepEqual(after.errors, [])
for (const c of after.checks.filter(c => c.viewport)) assert.ok(c.pageWidth <= c.viewport + 1 && !c.modalOverflow && !c.nestedScroll)
assert.equal(after.checks.filter(c => c.exactEngineSnapshot && c.saveResumed).length, 28)
assert.equal(after.checks.filter(c => c.exactPreview).length, 24)
assert.equal(after.checks.filter(c => c.noInvalidProjection).length, 12)
assert.equal(after.checks.filter(c => c.correctSelectedPrice).length, 24)
for (const error of after.consoleErrors) assert.equal(error.location.url, 'http://127.0.0.1:5214/favicon.ico')
for (const stage of ['before', 'after']) assert.equal(files(`${root}/${stage}`).filter(p => p.endsWith('.png')).length, stage === 'before' ? 20 : 28)
const compatibility = json(`${root}/compatibility.json`)
assert.equal(compatibility.historicalReplays, 81); assert.equal(compatibility.protectedArtifacts, 1727)
for (const item of compatibility.manifests) {
  assert.equal(describe(item.path).sha256, item.sha256)
  for (const a of json(item.path).artifacts) assert.deepEqual(describe(a.path), a)
}
const sources = [...git(['diff', '--name-only', base, implementation]).split('\n'), 'docs/B18_FINANCIAL_DECISION_CLARITY_REPORT.md',
  ...['decision-copy-checkpoints.ts', 'decision-copy-browser.mjs', 'decision-copy-compat.ts'].map(p => `scripts/diagnostics/${p}`),
  'scripts/verify-b18-financial-decision-evidence.mjs'].sort()
if (process.argv.includes('--check')) {
  const m = json(target); assert.equal(m.base, base); assert.equal(m.implementation, implementation)
  for (const a of m.sourceFiles) assert.deepEqual(describe(a.path, true), a)
  for (const a of m.artifacts) assert.deepEqual(describe(a.path), a)
  assert.deepEqual(files(root).filter(p => p !== target).sort(), m.artifacts.map(a => a.path).sort())
  console.log(JSON.stringify({ manifestVerified: true, artifacts: m.artifacts.length, productTests: 354, ssr: 60, uiChecks: 116, historicalReplay: 81, protectedArtifacts: 1727 }))
} else {
  const artifacts = files(root).filter(p => p !== target).sort().map(p => describe(p))
  writeFileSync(target, JSON.stringify({ format: 'b18-financial-decision-clarity-v1', date: '2026-10-20', branch: 'codex/b18-financial-decision-clarity',
    base, implementation, verified: { product: 354, ssr: 60, uiChecks: 116, exactActionSnapshotsAndResume: 28,
      savingsPreviews: 24, invalidSavingsInputs: 12, stockPrices: 24, beforeScreenshots: 20, afterScreenshots: 28, historicalReplay: 81, protectedArtifacts: 1727 },
    viewports: [[320, 740], [390, 844], [430, 932], [1440, 900]],
    scope: { engineChanged: false, rulesChanged: false, rngChanged: false, pricingChanged: false, schemaChanged: false, replayChanged: false,
      oldEvidenceChanged: false, merged: false, deployed: false, promoted: false, domainChanged: false, ownerReviewPending: true },
    limits: ['Chromium viewport/touch emulation; no physical iOS/Android, native zoom/keyboard or screen reader.', 'Legacy bills/contracts covered by SSR; B18 personal events by actual UI.', 'Existing local favicon 404 retained.'],
    hashing: 'Source normalized UTF8 LF; artifacts raw-byte SHA256, excluding this manifest.', sourceFiles: sources.map(p => describe(p, true)), artifacts }, null, 2) + '\n')
  console.log(JSON.stringify({ manifestWritten: true, artifacts: artifacts.length, sourceFiles: sources.length }))
}
