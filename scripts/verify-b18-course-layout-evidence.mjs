import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

const root = 'docs/playtests/b18-course-layout', target = `${root}/manifest.json`
const base = 'f96a8f6fdedaaa6151dfd108084a090b738a942f', implementation = '0c60f1c6516d686785bfea0981a8728f5cb7d3eb'
const json = p => JSON.parse(readFileSync(p, 'utf8')), text = p => readFileSync(p, 'utf8')
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
const files = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${p}/${e.name}`) : [`${p}/${e.name}`])
const describe = (path, source = false) => {
  const bytes = source ? Buffer.from(text(path).replaceAll('\r\n', '\n')) : readFileSync(path)
  return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
}
const product = git(['diff', '--name-only', base, '--', 'src', 'mobile_app/src']).split('\n').sort()
assert.deepEqual(product, ['src/components/CourseChoices.tsx', 'src/components/course-choices.css'])
assert.equal(git(['diff', '--name-only', base, '--', 'src/game', 'src/data', 'scripts/research', 'docs/research', 'package.json', 'package-lock.json', 'mobile_app/package.json', 'mobile_app/package-lock.json']), '')
const component = 'src/components/CourseChoices.tsx', original = git(['show', `${base}:${component}`])
assert.deepEqual(text(component).match(/onChoose\([^)]*\)/g), original.match(/onChoose\([^)]*\)/g), 'Action callbacks unchanged')
for (const log of ['product-tests.txt', 'ssr-tests.txt']) { assert.match(text(`${root}/${log}`), new RegExp(`# pass ${log.startsWith('product') ? 351 : 2}\\b`)); assert.match(text(`${root}/${log}`), /# fail 0\b/) }
for (const log of ['lint.txt', 'typecheck-mobile.txt', 'typecheck-shared.txt']) assert.equal(text(`${root}/${log}`).trim(), '')
assert.match(text(`${root}/build-mobile.txt`), /built in/)
const before = json(`${root}/before/results.json`), after = json(`${root}/after/results.json`)
assert.equal(before.checks.length, 112); assert.equal(before.findings.length, 32)
assert.equal(after.checks.length, 142); assert.deepEqual(after.findings, []); assert.deepEqual(after.errors, [])
assert.equal(after.checks.filter(c => c.exactlyOnePurchase).length, 20)
assert.equal(after.checks.filter(c => c.cashAndCoursesUnchanged).length, 10)
assert.equal(after.checks.filter(c => c.saveUnchanged).length, 30)
for (const c of after.checks.filter(c => c.cards)) {
  assert.ok(c.stacked && !c.pageOverflow && !c.modalOverflow && c.nestedScroll === 0 && c.overflow.length === 0)
  if (c.viewport === 1440) assert.ok(c.modalWidth < 500)
  for (const b of c.buttons) assert.ok(b.height >= 44 && Math.abs(b.width - b.parentWidth) < 3)
}
for (const e of after.consoleErrors) assert.equal(e.location.url, 'http://127.0.0.1:5212/favicon.ico')
for (const stage of ['before', 'after']) assert.equal(files(`${root}/${stage}`).filter(p => p.endsWith('.png')).length, 27)
const compatibility = json(`${root}/compatibility.json`)
assert.equal(compatibility.historicalReplays, 81); assert.equal(compatibility.protectedArtifacts, 1598)
for (const item of compatibility.manifests) {
  assert.equal(describe(item.path).sha256, item.sha256)
  for (const a of json(item.path).artifacts) assert.deepEqual(describe(a.path), a)
}
const sources = [...git(['diff', '--name-only', base, implementation]).split('\n'), 'docs/B18_COURSE_LAYOUT_POLISH_REPORT.md',
  ...['course-layout-checkpoints.ts', 'course-layout-browser.mjs', 'course-layout-compat.ts'].map(p => `scripts/diagnostics/${p}`),
  'scripts/verify-b18-course-layout-evidence.mjs'].sort()
if (process.argv.includes('--check')) {
  const m = json(target)
  assert.equal(m.base, base); assert.equal(m.implementation, implementation)
  for (const item of m.sourceFiles) assert.deepEqual(describe(item.path, true), item)
  for (const item of m.artifacts) assert.deepEqual(describe(item.path), item)
  assert.deepEqual(files(root).filter(p => p !== target).sort(), m.artifacts.map(a => a.path).sort())
  console.log(JSON.stringify({ manifestVerified: true, artifacts: m.artifacts.length, productFilesChanged: 2, productTests: 351, relevantSsr: 2, uiChecks: 142, screenshots: 54, replay: 81, historicalArtifactsUnchanged: 1598 }))
} else {
  const artifacts = files(root).filter(p => p !== target).sort().map(p => describe(p))
  writeFileSync(target, JSON.stringify({ format: 'b18-course-layout-v1', date: '2026-10-20', branch: 'codex/b18-course-layout-polish', base, implementation,
    verified: { productTests: 351, relevantSsr: 2, uiChecks: 142, purchaseChecks: 20, skipChecks: 10, readOnlySaveChecks: 30,
      beforeScreenshots: 27, afterScreenshots: 27, historicalReplays: 81, protectedArtifacts: 1598 },
    viewports: [[320, 740], [390, 844], [430, 932], [768, 1024], [1440, 900]],
    limits: ['Chromium viewport/touch emulation only; no physical iOS/Android or screen reader.', 'Text-only computed font magnification is not native zoom.', 'Existing local favicon 404 remains.'],
    scope: { engineChanged: false, schemaChanged: false, replayChanged: false, historicalEvidenceChanged: false, dependenciesChanged: false,
      merged: false, redeployed: false, promoted: false, ownerReviewPending: true },
    hashing: 'Source normalized UTF8 LF; raw-byte evidence SHA256. Manifest excludes itself.', sourceFiles: sources.map(p => describe(p, true)), artifacts }, null, 2) + '\n')
  console.log(JSON.stringify({ manifestWritten: true, artifacts: artifacts.length, sourceFiles: sources.length }))
}
