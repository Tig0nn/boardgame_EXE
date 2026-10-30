import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PassThrough } from 'node:stream'
import ts from 'typescript'

test('public Question browser/server emitted ESM validates frozen wire and default-OFF route without provider', async t => {
  const base = resolve('node_modules/.tmp')
  const folder = await mkdtemp(join(base, 'question-esm-'))
  assert.equal(dirname(folder), base)
  const visited = new Set<string>(), builtins = new Set<string>()
  let browser = true
  try {
    await writeFile(join(folder, 'package.json'), '{"type":"module"}')
    async function emit(file: string) {
      file = file.replaceAll('\\', '/')
      if (visited.has(file)) return
      if (browser) assert.ok(!file.includes('/server/') && !file.startsWith('api/'))
      visited.add(file)
      const source = await readFile(file, 'utf8')
      const output = resolve(folder, file.replace(/\.ts$/, '.js'))
      assert.ok(output.startsWith(folder + sep))
      await mkdir(dirname(output), { recursive: true })
      await writeFile(output, ts.transpileModule(source, { fileName: file, compilerOptions: {
        module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, rewriteRelativeImportExtensions: true,
      } }).outputText)
      for (const dependency of ts.preProcessFile(source).importedFiles) {
        if (!dependency.fileName.startsWith('.')) {
          assert.ok(!browser && dependency.fileName.startsWith('node:'), 'No external/browser Node imports')
          builtins.add(dependency.fileName); continue
        }
        const child = relative(resolve('.'), resolve(dirname(file), dependency.fileName))
        assert.ok(!child.startsWith('..') && child.endsWith('.ts'))
        await emit(child)
      }
    }
    await emit('src/ai/companion/question-index.ts')
    const browserFiles = visited.size
    const question = await import(pathToFileURL(join(folder, 'src/ai/companion/question-index.js')).href)
    const fixtures = JSON.parse(await readFile('tests/fixtures/ai-companion/question-wire-v1.json', 'utf8'))
    const feature = question.createQuestionFeature(true)
    for (const example of fixtures.examples) {
      assert.deepEqual(await question.answerQuestion(example.request, { feature }), example.response)
      assert.deepEqual(await question.parseQuestionResponse(example.response, example.request, { feature }), example.response)
    }
    const off = question.createQuestionController({ sessionEpoch: 'esm', getSnapshot: () => ({}) })
    assert.equal(await off.ask('Thanh khoản là gì?'), null)
    off.dispose()
    browser = false
    await emit('api/ai-companion-question.ts')
    const { default: defaultHandler } = await import(pathToFileURL(join(folder, 'api/ai-companion-question.js')).href)
    const { createQuestionHandler } = await import(pathToFileURL(join(folder, 'src/ai/companion/server/question-handler.js')).href)
    async function invoke(handler: typeof defaultHandler) {
      const req = Object.assign(new PassThrough(), { method: 'POST', headers: { 'content-type': 'application/json' },
        socket: { remoteAddress: 'loopback-esm' }, body: JSON.stringify(fixtures.examples[0].request) })
      const res = Object.assign(new PassThrough(), { statusCode: 200, setHeader() {} })
      let raw = ''; res.on('data', chunk => { raw += chunk })
      await handler(req, res)
      return { status: res.statusCode, body: JSON.parse(raw) }
    }
    const disabled = await invoke(defaultHandler)
    assert.equal(disabled.status, 503)
    assert.equal(question.parseQuestionError(disabled.body, undefined, 503).error.code, 'QUESTION_FEATURE_DISABLED')
    const enabled = await invoke(createQuestionHandler({ feature }))
    assert.equal(enabled.status, 200)
    assert.deepEqual(enabled.body, fixtures.examples[0].response)
    t.diagnostic(JSON.stringify({ browserFiles, browserBackendImports: 0, browserExternalImports: 0,
      serverFiles: visited.size, nodeBuiltins: [...builtins].sort(), wireExamples: fixtures.examples.length }))
  } finally {
    // Remove only this test-created child, verified inside the AI worktree's ignored temp folder.
    assert.equal(dirname(folder), base)
    assert.ok(folder.startsWith(base + sep))
    await rm(folder, { recursive: true, force: true })
  }
})
