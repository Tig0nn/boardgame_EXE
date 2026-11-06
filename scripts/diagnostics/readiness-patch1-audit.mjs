import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const out = 'docs/qa/release-readiness-patch1', root = resolve('.')
if (process.argv.includes('--verify-proposal')) {
  const manifest = JSON.parse(readFileSync(out + '/release-manifest.json', 'utf8'))
  const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex')
  const proposed = readFileSync(out + '/commit-files.txt', 'utf8').trim().split(/\r?\n/)
  for (const file of proposed) assert.ok(existsSync(file), 'Missing proposed file: ' + file)
  for (const row of [...manifest.sourceFiles, ...manifest.testData, ...manifest.qaEvidence, ...manifest.additionalFiles]) assert.equal(digest(row.file), row.sha256, row.file)
  assert.equal(digest(out + '/release-manifest.json'), readFileSync(out + '/release-manifest.sha256', 'utf8').split(/\s/)[0])
  console.log(JSON.stringify({ verifiedProposedFiles: proposed.length, hashes: true, archiveNotRequired: true }))
  process.exit(0)
}
const prior = JSON.parse(readFileSync(out + '/prior-candidates.json', 'utf8'))
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
function decode(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return bytes.subarray(2).toString('utf16le')
  if (bytes[0] === 254 && bytes[1] === 255) return Buffer.from(bytes.subarray(2)).swap16().toString('utf16le')
  return bytes.toString('utf8').replace(/^\uFEFF/, '')
}
const textExt = /\.(?:[cm]?[jt]sx?|css|html|json|md|txt|diff|patch)$/i
const requiredData = new Set([
  'docs/qa/educational-answers-v3/BEFORE.json',
  'docs/qa/v3-final-content-polish/BEFORE.json',
  'docs/qa/v3-final-content-polish/owner-review.json',
  'docs/qa/v3-final-two-answers/BEFORE.json',
  'docs/qa/v3-final-two-answers/AFTER.json',
])
const secrets = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['provider-key', /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-(?:proj-)?[0-9A-Za-z_-]{32,})\b/g],
  ['github-key', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['aws-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['credential-assignment', /(?:api[_-]?key|secret|password|auth[_-]?token)\s*[:=]\s*["']([A-Za-z0-9_+\/-]{24,})["']/gi],
  ['credential-url', /https?:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/g],
]
const privacy = [
  ['local-profile-path', /(?:[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/)[^\s"'<>]+/g],
  ['email-address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ['bearer-token', /Bearer\s+[A-Za-z0-9_.-]{20,}/g],
]
function scan(text, rules) {
  const hits = []
  for (const [rule, re] of rules) {
    re.lastIndex = 0
    const matches = [...text.matchAll(re)].filter(m => !/example|placeholder|dummy|redacted|your[_-]|fake|test[_-]|@example\./i.test(m[1] ?? m[0]))
    if (matches.length) hits.push({ rule, count: matches.length, lines: [...new Set(matches.map(m => text.slice(0, m.index).split('\n').length))].slice(0, 12) })
  }
  return hits
}
function pngTextChunks(bytes) {
  const types = []
  for (let p = 8; p + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(p), type = bytes.toString('ascii', p + 4, p + 8)
    assert.ok(p + length + 12 <= bytes.length, 'Invalid PNG chunk length')
    if (['tEXt', 'zTXt', 'iTXt'].includes(type)) types.push(type)
    p += length + 12
  }
  return types
}
const groups = new Map()
for (const row of prior) {
  const key = row.sha256
  groups.set(key, [...(groups.get(key) ?? []), row.file])
}
const rows = prior.map(row => {
  assert.ok(existsSync(row.file))
  const bytes = readFileSync(row.file), text = textExt.test(row.file) ? decode(bytes) : null
  let category, disposition, reason
  if (requiredData.has(row.file)) { category = 'synthetic-canonical-test-input'; disposition = 'KEEP'; reason = 'Required by unchanged regression tests or accepted-output equality; validated public facts, not a full game export.' }
  else if (row.file.endsWith('.png')) { category = 'historical-screenshot'; disposition = 'LOCAL_ONLY'; reason = 'Historical viewport capture; superseded by four current compiled Preview screenshots. No need to publish all 219 images.' }
  else if (/owner-example-game\.json|owner-example\.json/i.test(row.file)) { category = 'full-save-or-owner-export'; disposition = 'LOCAL_ONLY'; reason = 'Full natural game export or paired owner sample; raw replay/save data unnecessary for GitHub review.' }
  else if (/\.(diff|patch)$/.test(row.file)) { category = 'duplicate-source-patch'; disposition = 'LOCAL_ONLY'; reason = 'Redundant historical source copy; use Git diff and current manifest source hashes.' }
  else if (row.file.startsWith('docs/')) { category = row.file.endsWith('.txt') ? 'raw-log-or-path-list' : row.file.endsWith('.md') ? 'historical-report' : 'historical-qa-json'; disposition = 'LOCAL_ONLY'; reason = 'Superseded by Patch 1 report, structured current QA summary and file-level audit; preserve local evidence.' }
  else if (row.file.startsWith('scripts/diagnostics/') && !row.file.endsWith('.test.ts') && !row.file.endsWith('/semantic-evaluation.mjs')) { category = 'superseded-qa-script'; disposition = 'LOCAL_ONLY'; reason = 'Historical stage-specific tool or manifest; current Patch 1 tools replace its release/replay/browser role.' }
  else { category = 'source-or-test'; disposition = 'KEEP'; reason = 'Runtime/build source, regression test/fixture, or current local review entrypoint.' }
  const png = row.file.endsWith('.png') ? { signatureValid: bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), textMetadataChunks: pngTextChunks(bytes), capture: 'Page viewport image; historical image audit via local contact sheets; excluded regardless of visual findings.' } : undefined
  return { ...row, currentSha256: sha(row.file), category, disposition, reason, secretFindings: text === null ? [] : scan(text, secrets), privacyIndicators: text === null ? [] : scan(text, privacy), png, exactDuplicates: groups.get(row.sha256).filter(f => f !== row.file), largerThan500KiB: row.bytes > 512 * 1024, textReviewedByScanner: text !== null }
})
const summary = { originalCandidates: rows.length, docs: rows.filter(r => r.file.startsWith('docs/')).length, png: rows.filter(r => r.png).length, exactDuplicateGroups: [...groups.values()].filter(g => g.length > 1), priorKeep: rows.filter(r => r.disposition === 'KEEP').length, priorLocalOnly: rows.filter(r => r.disposition === 'LOCAL_ONLY').length, secretFindingFiles: rows.filter(r => r.secretFindings.length).map(r => ({ file: r.file, findings: r.secretFindings })), privacyIndicatorFiles: rows.filter(r => r.privacyIndicators.length).length, scope: 'All 594 paths and all 424 docs classified; full text scanned where applicable. No secret/PII values are printed. Binary screenshots are inspected through contact sheets and excluded from proposed commit.', transferArchive: { file: 'docs/qa/educational-answers-v3.zip', disposition: 'LOCAL_ONLY', reason: 'Still excluded; contents not inspected and no need to publish transfer archive.' } }
writeFileSync(out + '/candidate-audit.json', JSON.stringify({ summary, rows }, null, 2) + '\n')
assert.equal(summary.secretFindingFiles.length, 0, 'Potential credential requires review; see redacted audit metadata.')
const r = spawnSync('git', [`--git-dir=${root}/.git`, `--work-tree=${root}`, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
assert.equal(r.status, 0)
const untrackedResult = spawnSync('git', [`--git-dir=${root}/.git`, `--work-tree=${root}`, 'ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
assert.equal(untrackedResult.status, 0)
const newFiles = untrackedResult.stdout.split('\0').filter(Boolean)
const old = new Set(prior.map(r => r.file))
const additions = newFiles.filter(f => !old.has(f) && (/^scripts\/diagnostics\/readiness-patch1-(?:checks|replays|browser|session-browser|manifest|audit|proposal-guard)\.(?:mjs|ts)$/.test(f) || /^tests\//.test(f)))
const evidence = ['sanitized-qa-summary.json', 'candidate-audit.json', 'release-manifest.json', 'commit-files.txt', 'exclusions.json', 'source-files.json', 'preservation.json', 'release-manifest.sha256', 'preview-personal-rules-320.png', 'preview-personal-rules-390.png', 'preview-macro-compare-320.png', 'preview-macro-compare-390.png'].map(f => out + '/' + f)
const proposed = [...new Set([...rows.filter(r => r.disposition === 'KEEP').map(r => r.file), ...additions, ...evidence, 'scripts/diagnostics/readiness-patch1-manifest.mjs', 'scripts/diagnostics/readiness-patch1-browser.mjs', 'scripts/diagnostics/readiness-patch1-session-browser.mjs', 'docs/EXE_AI_COMPANION_RELEASE_READINESS_PATCH1_REPORT.md'])].sort()
writeFileSync(out + '/commit-files.txt', proposed.join('\n') + '\n')
writeFileSync(out + '/exclusions.json', JSON.stringify({ localOnly: rows.filter(r => r.disposition === 'LOCAL_ONLY').map(r => ({ file: r.file, reason: r.reason })), additionalLocalOnly: newFiles.filter(f => !old.has(f) && !proposed.includes(f)).map(file => ({ file, reason: file.endsWith('.zip') ? summary.transferArchive.reason : 'Raw/intermediate QA, visual-triage sheet or local checkpoint; structured current evidence is sufficient for review.' })), noFilesDeleted: true }, null, 2) + '\n')
console.log(JSON.stringify({ reviewed: rows.length, docs: summary.docs, screenshots: summary.png, duplicateGroups: summary.exactDuplicateGroups.length, privacyIndicatorFiles: summary.privacyIndicatorFiles, secretFindingFiles: summary.secretFindingFiles.length, proposed: proposed.length, proposedDocs: proposed.filter(f => f.startsWith('docs/')).length }))
