import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import ts from 'typescript'

const root = 'docs/playtests/b18-mobile-ux-writing', target = `${root}/manifest.json`
const base = 'f0bb612a2aa9514c4fc2fcbf8d878b7bece3947f', implementation = '878414a93e66f6545ff816ee6ffb64957c74870a'
const text = p => readFileSync(p, 'utf8'), json = p => JSON.parse(text(p))
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 30e6 }).trim()
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`])
const describe = (path, normalized = false) => {
  const bytes = normalized ? Buffer.from(text(path).replaceAll('\r\n', '\n')) : readFileSync(path)
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
}
const protectedPaths = ['src/game', 'src/data', 'src/App.tsx', 'scripts/research', 'docs/research',
  'package.json', 'package-lock.json', 'mobile_app/package.json', 'mobile_app/package-lock.json',
  'mobile_app/src/App.tsx', 'mobile_app/src/game/session.ts',
  'docs/B18_MVP_RELEASE_READINESS_REPORT.md', 'docs/B18_MVP_MOBILE_ONLY_RELEASE_ADDENDUM.md', 'docs/B18_MVP_LANGUAGE_CLEANUP_REPORT.md']
assert.equal(git(['diff', '--name-only', base, '--', ...protectedPaths]), '', 'Protected product/engine/data/history must stay unchanged')
// The two files under Mobile/game are read-only display selectors. Verify that
// their token streams differ only in string values, not identifiers or formulas.
function structure(source) {
  const tree = ts.createSourceFile('presentation.ts', source, ts.ScriptTarget.Latest, true)
  const result = ts.transform(tree, [context => {
    const visit = node => ts.isStringLiteral(node) ? ts.factory.createStringLiteral('<display string>') : ts.visitEachChild(node, visit, context)
    return node => ts.visitNode(node, visit)
  }])
  try { return ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]) }
  finally { result.dispose() }
}
for (const path of ['mobile_app/src/game/economic-event.ts', 'mobile_app/src/game/market-news.ts']) {
  assert.deepEqual(structure(text(path)), structure(git(['show', `${base}:${path}`])), `Only copy may differ in ${path}`)
}
assert.match(text(`${root}/product-tests.txt`), /# pass 351\b/)
assert.match(text(`${root}/product-tests.txt`), /# fail 0\b/)
assert.match(text(`${root}/ssr-tests.txt`), /# pass 50\b/)
assert.match(text(`${root}/ssr-tests.txt`), /# fail 0\b/)
assert.equal(text(`${root}/lint.txt`).trim(), '')
for (const path of ['typecheck-mobile.txt', 'typecheck-shared.txt']) assert.equal(text(`${root}/${path}`).trim(), '')
assert.match(text(`${root}/build-mobile.txt`), /built in/)
assert.match(text(`${root}/parity.txt`), /"matchedFrozenGames":13,"phases":3,"allEconomicSnapshotsEqual":true/)
assert.equal(json('docs/playtests/core-mvp-b18-multi-course/research-parity.json').results.reduce((n, r) => n + r.checkedSnapshots, 0), 2306)
const compat = json(`${root}/compatibility.json`)
assert.equal(compat.historicalReplays, 81); assert.equal(compat.verifiedHistoricalArtifacts, 1300)
for (const item of compat.manifests) {
  for (const artifact of json(item.path).artifacts) assert.deepEqual(describe(artifact.path), artifact)
}
const before = json(`${root}/before/results.json`), after = json(`${root}/after/results.json`), a11y = json(`${root}/accessibility/results.json`)
assert.equal(before.checks.length, 36); assert.equal(after.checks.length, 162); assert.equal(a11y.checks.length, 12)
assert.deepEqual(before.errors, []); assert.deepEqual(after.errors, []); assert.deepEqual(a11y.errors, [])
assert.deepEqual(after.httpErrors, [])
for (const error of after.consoleErrors) assert.match(error.location.url, /^http:\/\/127\.0\.0\.1:5210\/favicon\.ico$/)
for (const check of after.checks.filter(c => c.pageWidth)) assert.ok(check.pageWidth <= check.width + 1 && !check.modalOverflow)
assert.equal(after.checks.filter(c => c.label.endsWith('-resume') && c.unchanged).length, 33)
assert.ok(a11y.checks.every(c => c.saveUnchanged || c.latestSaveResumed))
for (const stage of ['before', 'after', 'accessibility']) assert.equal(walk(`${root}/${stage}`).filter(p => p.endsWith('.png')).length, { before: 24, after: 96, accessibility: 12 }[stage])
const sources = [...git(['diff', '--name-only', base, implementation]).split('\n'),
  'docs/B18_MOBILE_UX_WRITING_AUDIT.md', 'docs/B18_MOBILE_UX_WRITING_REPORT.md',
  ...['ux-writing-browser.mjs', 'ux-writing-accessibility.mjs', 'ux-writing-checkpoints.ts', 'ux-writing-compat.ts', 'ux-writing-inventory.mjs'].map(p => `scripts/diagnostics/${p}`),
  'scripts/verify-b18-ux-writing-evidence.mjs'].sort()
if (process.argv.includes('--check')) {
  const m = json(target)
  assert.equal(m.base, base); assert.equal(m.implementation, implementation)
  for (const item of m.sourceFiles) assert.deepEqual(describe(item.path, true), item, item.path)
  for (const item of m.artifacts) assert.deepEqual(describe(item.path), item, item.path)
  assert.deepEqual(walk(root).filter(p => p !== target).sort(), m.artifacts.map(a => a.path).sort())
  console.log(JSON.stringify({ manifestVerified: true, artifacts: m.artifacts.length, protectedHistoricalArtifacts: 1300, product: 351, ssr: 50, replay: 81, parityGames: 13, paritySnapshots: 2306 }))
} else {
  const artifacts = walk(root).filter(p => p !== target).sort().map(p => describe(p))
  writeFileSync(target, JSON.stringify({ format: 'b18-mobile-ux-writing-v1', date: '2026-10-20', branch: 'codex/b18-mobile-ux-writing-audit',
    base, productionCodeBase: '927e53e2189bd6d901ed494791d9dc7e912358a6', implementation,
    verified: { product: 351, ssr: 50, historicalReplays: 81, historicalArtifacts: 1300, parityGames: 13, paritySnapshots: 2306,
      beforeScreenshots: 24, afterScreenshots: 96, accessibilityScreenshots: 12, visualAfterChecks: 162, accessibilityChecks: 12, saveResumeImports: 33, latestSaveFlows: 3 },
    limits: ['Chromium viewport/touch emulation only in this task; no physical iOS/Safari or Android, screen reader, native zoom or virtual keyboard.',
      'Existing local favicon.ico 404 recorded; no application JavaScript page errors.', 'No human learning assessment, no new full UI games. Checkpoints are exact historical replay prefixes.'],
    scope: { gameplayChanged: false, engineChanged: false, schemaChanged: false, oldEvidenceChanged: false, dependenciesChanged: false,
      desktopProjectChanged: false, merged: false, manualDeployment: false, promoted: false, domainChanged: false, ownerReviewPending: true },
    hashing: 'Source UTF8 normalized LF; evidence artifacts raw SHA256; excludes manifest itself.',
    sourceFiles: sources.map(p => describe(p, true)), artifacts }, null, 2) + '\n')
  console.log(JSON.stringify({ manifestWritten: true, artifacts: artifacts.length, sourceFiles: sources.length }))
}
