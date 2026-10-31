import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import ts from 'typescript'

test('AI Coach emitted ESM function loads shared modules and rejects GET without provider credentials', async () => {
  const base = resolve(tmpdir())
  const folder = await mkdtemp(join(base, 'pr8-ai-coach-'))
  assert.equal(dirname(folder), base)
  try {
    const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsed = ts.convertCompilerOptionsFromJson(config.config.compilerOptions ?? {}, '.')
    assert.deepEqual(parsed.errors, [])
    await writeFile(join(folder, 'package.json'), '{"type":"module"}')
    for (const file of ['api/ai-coach.ts', 'src/ai/server/handler.ts', 'src/ai/server/rateLimiter.ts', 'src/ai/schema.ts', 'src/ai/types.ts']) {
      const output = join(folder, file.replace(/\.ts$/, '.js'))
      await mkdir(dirname(output), { recursive: true })
      const emitted = ts.transpileModule(await readFile(file, 'utf8'), {
        compilerOptions: { ...parsed.options, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
        fileName: file,
      })
      await writeFile(output, emitted.outputText)
    }
    const { default: handler } = await import(pathToFileURL(join(folder, 'api/ai-coach.js')).href)
    let body = ''
    const response = { statusCode: 200, setHeader() {}, end(value: string) { body = value } }
    await handler({ method: 'GET' } as IncomingMessage, response as unknown as ServerResponse)
    assert.equal(response.statusCode, 405)
    assert.match(JSON.parse(body).error, /POST/)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
})
