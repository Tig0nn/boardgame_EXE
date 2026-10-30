import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PassThrough } from 'node:stream'
import ts from 'typescript'

test('Companion emitted ESM loads transitive rules and handles GET/POST offline without env/config', async () => {
  const base = resolve(tmpdir())
  const folder = await mkdtemp(join(base, 'exe-companion-esm-'))
  assert.equal(dirname(folder), base)
  const visited = new Set<string>()
  try {
    await writeFile(join(folder, 'package.json'), '{"type":"module"}')
    async function emit(file: string) {
      file = file.replaceAll('\\', '/')
      if (visited.has(file)) return
      visited.add(file)
      const source = await readFile(file, 'utf8')
      const output = resolve(folder, file.replace(/\.ts$/, '.js'))
      assert.ok(output.startsWith(folder + (folder.includes('\\') ? '\\' : '/')))
      await mkdir(dirname(output), { recursive: true })
      const emitted = ts.transpileModule(source, { fileName: file, compilerOptions: {
        module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, rewriteRelativeImportExtensions: true,
      } })
      await writeFile(output, emitted.outputText)
      for (const dependency of ts.preProcessFile(source).importedFiles) {
        if (!dependency.fileName.startsWith('.')) continue
        const child = relative(resolve('.'), resolve(dirname(file), dependency.fileName))
        assert.ok(!child.startsWith('..'))
        assert.ok(child.endsWith('.ts'))
        await emit(child)
      }
    }
    await emit('api/ai-companion.ts')
    const { default: handler } = await import(pathToFileURL(join(folder, 'api/ai-companion.js')).href)
    const fixtures = JSON.parse(await readFile('tests/fixtures/ai-companion/golden-v1.json', 'utf8'))
    const example = fixtures.examples.find(example => example.name === 'compare')
    for (const method of ['GET', 'POST']) {
      const req = Object.assign(new PassThrough(), { method, headers: { 'content-type': 'application/json' },
        socket: { remoteAddress: 'loopback-esm' }, body: JSON.stringify(example.request) })
      const res = Object.assign(new PassThrough(), { statusCode: 200, setHeader() {} })
      let body = ''
      res.on('data', chunk => { body += chunk })
      await handler(req, res)
      assert.equal(res.statusCode, method === 'GET' ? 405 : 200)
      const parsed = JSON.parse(body)
      if (method === 'POST') assert.deepEqual(parsed, example.fallback)
      else assert.equal(parsed.error.code, 'METHOD_NOT_ALLOWED')
    }
    assert.ok(visited.has('src/ai/companion/server/handler.ts'))
    assert.ok(visited.has('src/data/events.ts'))
  } finally {
    // Only this test's verified mkdtemp child is removed.
    assert.equal(dirname(folder), base)
    await rm(folder, { recursive: true, force: true })
  }
})
