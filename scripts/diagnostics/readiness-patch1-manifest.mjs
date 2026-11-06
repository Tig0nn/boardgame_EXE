import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { CURATED_QUESTIONS } from '../../mobile_app/src/game/curated-catalog.ts'
import { createSemanticRequest, answerSemantic, validateSemanticResponse } from '../../src/ai/companion/semantic-index.ts'
import { presentEducationalAnswer } from '../../mobile_app/src/components/educational-ai-presentation.ts'

const out = 'docs/qa/release-readiness-patch1', root = resolve('.'), baseSha = 'e4045125684a9fd3da30a911fd91cb6687c5c586'
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const write = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
const logText = file => {
  const bytes = readFileSync(file)
  return bytes[0] === 255 && bytes[1] === 254 ? bytes.subarray(2).toString('utf16le') : bytes.toString('utf8').replace(/^\uFEFF/, '')
}
const git = args => {
  const r = spawnSync('git', [`--git-dir=${root}/.git`, `--work-tree=${root}`, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr); return r.stdout
}
const runAudit = spawnSync(process.execPath, ['scripts/diagnostics/readiness-patch1-audit.mjs'], { encoding: 'utf8', windowsHide: true })
assert.equal(runAudit.status, 0, runAudit.stderr)
const audit = json(out + '/candidate-audit.json')
const proposed = readFileSync(out + '/commit-files.txt', 'utf8').trim().split(/\r?\n/)
const checkpoint = json(out + '/checkpoint.json')
const allowed = new Set(['release/beta/build-policy.ts', 'release/beta/README.md', 'tests/ai-closed-beta-release.test.ts'])
const changed = []
for (const row of checkpoint.files) {
  assert.ok(existsSync(row.file), 'Missing checkpoint: ' + row.file)
  if (sha(row.file) !== row.sha256) { assert.ok(allowed.has(row.file), 'Unexpected change: ' + row.file); changed.push(row.file) }
}
assert.equal(git(['rev-parse', 'HEAD']).trim(), baseSha)
assert.equal(git(['rev-parse', 'codex/b18-compact-financial-ui']).trim(), baseSha)
assert.equal(git(['branch', '--show-current']).trim(), 'feat/b18-ai-companion-public-beta')
assert.equal(git(['diff', '--cached']).trim(), '')
const contexts = json('docs/qa/educational-answers-v3/BEFORE.json'), accepted = json('docs/qa/v3-final-two-answers/AFTER.json')
for (const q of CURATED_QUESTIONS) {
  const req = await createSemanticRequest(contexts.results.find(r => r.id === q.id).context, q.text, 'patch1-' + q.id)
  const response = await validateSemanticResponse(await answerSemantic(req), req)
  assert.deepEqual(presentEducationalAnswer(response, q), accepted.results.find(r => r.id === q.id).after, q.id)
}
const raw = ['commands.json', 'product-proposal-closure.txt', 'browser-preview.json', 'browser-session.json', 'replays.json', 'gate-red.txt', 'gate-green.txt', 'npm-audit-root.txt', 'npm-audit-mobile.txt']
const commands = json(out + '/commands.json')
assert.ok(commands.every(c => c.exitCode === 0))
const productGuard = logText(out + '/product-proposal-closure.txt')
assert.match(productGuard, /# fail 0/)
const preview = json(out + '/browser-preview.json'), session = json(out + '/browser-session.json'), replays = json(out + '/replays.json')
assert.deepEqual(preview.errors, []); assert.deepEqual(session.errors, [])
assert.equal(preview.results.length, 4); assert.equal(session.results.length, 13); assert.equal(replays.fail, 0)
const rawScans = [], sourceFiles = proposed.filter(f => /^(mobile_app|src|tests|scripts|release)\//.test(f))
for (const file of proposed.filter(f => existsSync(f) && /\.(?:ts|tsx|mjs|css|md|json|txt)$/.test(f) && !f.startsWith(out + '/'))) {
  const text = readFileSync(file, 'utf8')
  for (const [rule, re] of [['secret', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}\b|\bsk-(?:proj-)?[0-9A-Za-z_-]{32,}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b/g], ['local-profile', /[A-Z]:[\\/]Users[\\/][^\s"'<>]+/g], ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi]]) {
    for (const m of text.matchAll(re)) if (!/example|dummy|fake|test|@example\./i.test(m[0])) rawScans.push({ file, rule, line: text.slice(0, m.index).split('\n').length })
  }
}
assert.deepEqual(rawScans, [], 'Review proposed source/data findings before publishing')
const summary = { at: new Date().toISOString(), sourceCommit: baseSha, answersAcceptedExact: 39, commands: commands.map(c => ({ name: c.name, exitCode: c.exitCode, summary: c.summary, commandArgs: c.command.slice(1) })),
  proposedInputClosure: { pass: true, result: productGuard.match(/# tests \d+/)?.[0], note: 'Product tests rerun with a preload guard rejecting reads of excluded docs/qa inputs; static relative source dependencies checked separately.' },
  compiledPreview: { cases: preview.results, errors: preview.errors, apiRequests: preview.apiRequests, externalFontsBlocked: true, scope: preview.scope },
  browserSession: { records: session.results.length, errors: session.errors, mainAppSettingsRestart: true, pendingRestartImportResume: '12 cases via QA component host; not complete main-app import navigation.' },
  replays: { total: replays.total, pass: replays.pass, fail: replays.fail },
  dependencyAudit: { root: 'UNVERIFIED: registry access failed', mobile: 'UNVERIFIED: registry access failed' },
  projectIdentityStatus: { actualProjectId: null, expectedProjectId: null, hostedConfigured: false },
  historicalVisualTriage: { images: 219, contactSheetsViewed: 19, finding: 'Gameplay/AI panels and test controls; no obvious account/credential UI observed in contact-sheet review. Not pixel-level OCR/PII certification. All historical images excluded.', publishedImages: 4 },
  candidateAudit: { scannedOriginalPaths: 594, originalDocs: 424, textSecretFindingFiles: audit.summary.secretFindingFiles, localProfileIndicatorFiles: audit.summary.privacyIndicatorFiles, proposedSourceAndDataFindings: rawScans },
  rawEvidenceLocalOnly: raw.filter(f => existsSync(out + '/' + f)).map(f => ({ file: f, sha256: sha(out + '/' + f) })), limitations: ['No hosted deployment/actual project ID.', 'No physical mobile devices.', 'No full main-app import navigation validation.'] }
write(out + '/sanitized-qa-summary.json', summary)
const preservation = { at: new Date().toISOString(), baseSha, checkpointSha256: sha(out + '/checkpoint.json'), checkpointFiles: checkpoint.files.length, changedExisting: changed, noFilesRemoved: true, acceptedAnswersExact: 39, sharedAiUnchanged: checkpoint.files.filter(r => r.file.startsWith('src/ai/companion/') && sha(r.file) === r.sha256).length, previousQaFilesUnchanged: checkpoint.files.filter(r => r.file.startsWith('docs/qa/') && !r.file.startsWith(out + '/') && sha(r.file) === r.sha256).length, staged: false }
write(out + '/preservation.json', preservation)
const dependencies = []
const uncommitted = new Set([...git(['diff', '--name-only', '-z', baseSha]).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')])
for (const file of sourceFiles.filter(f => /\.(?:tsx?|mjs)$/.test(f))) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/["'](\.{1,2}\/[^"'\n]+)["']/g)) {
    const target = resolve(file, '..', match[1])
    const found = [target, ...['.ts','.tsx','.mjs','.js','.json','/index.ts','/index.tsx'].map(ext => target + ext)].find(p => existsSync(p) && statSync(p).isFile())
    if (!found || found.includes('/node_modules/') || found.includes('\\node_modules\\')) continue
    const rel = found.slice(root.length + 1).replaceAll('\\', '/')
    if (uncommitted.has(rel) && !proposed.includes(rel)) dependencies.push({ file, missing: rel })
  }
}
assert.deepEqual(dependencies, [], 'Proposed source dependency is missing')
const files = sourceFiles.map(file => ({ file, sha256: sha(file), bytes: statSync(file).size }))
write(out + '/source-files.json', files)
let diff = git(['diff', '--binary', baseSha])
const untracked = new Set(git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'))
for (const file of sourceFiles.filter(f => untracked.has(f))) {
  const r = spawnSync('git', ['diff', '--no-index', '--binary', '--', '/dev/null', file], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
  assert.equal(r.status, 1, r.stderr); diff += r.stdout
}
writeFileSync(out + '/source.diff', diff)
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name]) }
const artifact = walk('release/beta/dist').map(file => ({ file, sha256: sha(file), bytes: statSync(file).size }))
assert.ok(!artifact.some(r => /\/api\/|\.map$|\/\.env/.test(r.file)))
const testData = proposed.filter(f => f.startsWith('docs/') && !f.startsWith(out + '/') && f.endsWith('.json')).map(file => ({ file, sha256: sha(file), purpose: 'Synthetic validated-context/answer baseline or historical regression verdict; not a full engine save/export.' }))
const priorBytes = json(out + '/prior-candidates.json').reduce((sum, r) => sum + r.bytes, 0)
const manifest = { version: 'release-readiness-patch1', state: 'HOLD_FOR_OWNER_MANIFEST_APPROVAL; NO_GITHUB_OR_HOSTED_ACTIONS', at: new Date().toISOString(), baseSha, branch: checkpoint.branch, sourceFiles: files, testData,
  content: { acceptedCases: 39, outputsExact: true, presenterSha256: sha('mobile_app/src/components/educational-ai-presentation.ts'), catalogSha256: sha('mobile_app/src/game/curated-catalog.ts') },
  identityGate: { actualVariable: 'VERCEL_PROJECT_ID', expectedVariable: 'EXE_AI_BETA_EXPECTED_PROJECT_ID', actualProjectId: null, expectedProjectId: null, status: 'NOT_CREATED / EXPECTED_ID_UNSET', requirement: 'Owner independently verifies and approves actual Beta project ID, then sets expected ID as build-only Preview-scoped env. No automatic expected=actual fallback; no VITE prefix; no project-name reliance.', onVercelMissingOrMismatch: 'REFUSE', production: 'REFUSE', approval: 'EXE_AI_BETA_PREVIEW=1', query: '?aiBeta=1 cannot override production/build gate' },
  commitProposal: { file: out + '/commit-files.txt', count: proposed.length, docs: proposed.filter(f => f.startsWith('docs/')).length, oldCount: 594, oldDocs: 424, oldBytes: priorBytes, currentBytesExcludingManifest: proposed.filter(f => existsSync(f) && !f.endsWith('/release-manifest.json') && !f.endsWith('/release-manifest.sha256')).reduce((sum, f) => sum + statSync(f).size, 0), exclusions: out + '/exclusions.json', candidateAudit: out + '/candidate-audit.json', unchangedTrackedBaseNotRestaged: true },
  qaEvidence: ['sanitized-qa-summary.json','candidate-audit.json','preservation.json','source-files.json'].map(f => ({ file: out + '/' + f, sha256: sha(out + '/' + f) })),
  localOnlyEvidence: { rawLogs: true, sourceDiff: out + '/source.diff', fullCheckpoint: out + '/checkpoint.json', historicalScreenshots: 219, transferArchiveExcluded: 'docs/qa/educational-answers-v3.zip', noFilesDeleted: true },
  build: { label: 'exe-companion-beta', rootDirectory: 'release/beta', includeSourceOutsideRoot: true, framework: 'Other', node: '22.x', command: 'npm run build', output: 'dist', mode: 'production', staticOnly: true, providers: false },
  rollback: 'Revoke Beta access/remove Beta deployment if separately approved. Unset approval flag to block subsequent builds; it does not disable an existing immutable bundle. Do not alter Production.',
  approvals: ['Owner approves this minimal commit list and manifest.', 'After separate approval only: create Beta project, independently verify and approve its exact project ID, then provision expected ID and Preview approval flag.', 'Verify registry advisory audit and hosted build/origin/save/device gates before testers.'],
  limitations: summary.limitations.concat(['npm advisory status UNVERIFIED.', 'Visual triage is not exhaustive OCR or independent security review.', 'Audit scope is current 594 candidates plus Patch 1 additions, not a rewrite/audit of all tracked base history.']),
  remoteActions: [], staged: false, productionChanged: false,
}
const covered = new Set([...manifest.sourceFiles, ...manifest.testData, ...manifest.qaEvidence].map(r => r.file))
manifest.additionalFiles = proposed.filter(file => existsSync(file) && !covered.has(file) && !file.endsWith('/release-manifest.json') && !file.endsWith('/release-manifest.sha256')).map(file => ({ file, sha256: sha(file) }))
write(out + '/release-manifest.json', manifest)
writeFileSync(out + '/release-manifest.sha256', sha(out + '/release-manifest.json') + '  release-manifest.json\n')
console.log(JSON.stringify({ proposed: proposed.length, docs: manifest.commitProposal.docs, sourceFiles: files.length, acceptedExact: 39, changedExisting: changed, sourceDependencyClosure: true }))
