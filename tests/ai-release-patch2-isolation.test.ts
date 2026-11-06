import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { build, createServer, loadConfigFromFile } from 'vite'
import { legacyAiIsolation } from '../release/beta/legacy-ai-isolation.ts'
import type { Plugin, UserConfig } from 'vite'
import type { GameState } from '../src/game/types.ts'

const betaConfigFile = resolve('release/beta/vite.config.ts')
const mobileConfigFile = resolve('mobile_app/vite.config.ts')
const resultSource = 'mobile_app/src/components/GameResultModal.tsx'
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const unchangedFiles = [resultSource, 'src/ai/AICoachPanel.tsx', 'api/ai-coach.ts', 'src/ai/server/handler.ts', 'vite.config.ts', mobileConfigFile]

async function config(file: string, command: 'serve' | 'build'): Promise<UserConfig> {
  const keys = ['VERCEL', 'VERCEL_ENV', 'EXE_AI_BETA_PREVIEW', 'VERCEL_PROJECT_ID', 'EXE_AI_BETA_EXPECTED_PROJECT_ID']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    process.env.VERCEL_ENV = 'preview'
    process.env.EXE_AI_BETA_PREVIEW = '1'
    const loaded = await loadConfigFromFile({ command, mode: 'production' }, file)
    assert.ok(loaded, 'The real release config must load')
    return loaded.config
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function cacheFolder() {
  const base = resolve('node_modules/.tmp')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, 'patch2-isolation-'))
}

async function renderResult(configuration: UserConfig, game: GameState) {
  const id = 'virtual:patch2-result'
  const harness: Plugin = {
    name: 'patch2-result-assertion-harness',
    resolveId(source) { if (source === id) return '\0' + id },
    load(source) {
      if (source === '\0' + id) return `
        import {createElement} from 'react';
        import {renderToStaticMarkup} from 'react-dom/server';
        import {GameResultModal} from '/src/components/GameResultModal.tsx';
        export const render = game => renderToStaticMarkup(createElement(GameResultModal, {
          game, onRestart(){}, onHome(){}, onClose(){}, onExport(){}, onHelp(){}
        }));
      `
    },
  }
  const server = await createServer({
    ...configuration,
    root: configuration.root ?? resolve('mobile_app'),
    configFile: false,
    logLevel: 'silent',
    cacheDir: cacheFolder(),
    plugins: [...(configuration.plugins ?? []), harness],
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const module = await server.ssrLoadModule(id)
    return module.render(game) as string
  } finally {
    await server.close()
  }
}

test('Beta result omits the legacy AI Coach while ordinary Mobile preserves its original result UI and source', async () => {
  const before = Object.fromEntries(unchangedFiles.map(file => [file, digest(file)]))
  const previousNodeEnvironment = process.env.NODE_ENV
  const game = JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString()).state as GameState
  const serialized = JSON.stringify(game)
  try {
    assert.equal(game.phase, 'finished')
    const ordinary = await renderResult(await config(mobileConfigFile, 'serve'), game)
    assert.match(ordinary, /AI Coach/)
    assert.match(ordinary, /data-financial-fact=/)
    const beta = await renderResult(await config(betaConfigFile, 'serve'), game)
    assert.match(beta, /data-financial-fact=/, 'Financial review must remain intact')
    assert.equal(/AI Coach|ai-coach-panel|ai-coach-trigger-btn|ai-coach-trigger-container/.test(beta), false, 'Beta result must omit the entire legacy Coach accordion and CTA')
    assert.equal(JSON.stringify(game), serialized, 'Isolation must not mutate game state')
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnvironment
    for (const file of unchangedFiles) assert.equal(digest(file), before[file], file + ' was rewritten')
  }
})

test('The real isolated Beta build excludes the legacy Coach client endpoint and provider code', async () => {
  const before = Object.fromEntries(unchangedFiles.map(file => [file, digest(file)]))
  const previousNodeEnvironment = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'production'
    const configuration = await config(betaConfigFile, 'build')
    const result = await build({
      ...configuration,
      configFile: false,
      mode: 'production',
      logLevel: 'silent',
      cacheDir: cacheFolder(),
      build: { ...configuration.build, write: false, emptyOutDir: false },
    })
    const bundles = Array.isArray(result) ? result : [result]
    const chunks = bundles.flatMap(bundle => 'output' in bundle ? bundle.output : []).filter(item => item.type === 'chunk')
    assert.ok(chunks.length > 0, 'Inspect an actual emitted app bundle')
    const javascript = chunks.map(chunk => chunk.code).join('\n')
    assert.equal(/\/api\/ai-coach|generativelanguage\.googleapis\.com|GEMINI_API_KEY|ai-coach-trigger-btn/.test(javascript), false, 'Beta client bundle must not contain a legacy Coach request or provider reference')
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnvironment
    for (const file of unchangedFiles) assert.equal(digest(file), before[file], file + ' was rewritten')
  }
})

test('Beta isolation fails closed on changed legacy UI structure and never transforms ordinary modules', () => {
  const transform = legacyAiIsolation().transform
  assert.equal(typeof transform, 'function')
  if (typeof transform !== 'function') throw Error('Expected synchronous isolation transform')
  const context = { error(message: unknown): never { throw Error(String(message)) } } as unknown as ThisParameterType<typeof transform>
  const original = readFileSync(resultSource, 'utf8')
  const changed = original.replace('<AICoachPanel game={game} />', '<AICoachPanel game={game} /><AICoachPanel game={game} />')
  assert.notEqual(changed, original)
  assert.throws(() => transform.call(context, changed, resolve(resultSource), { ssr: false }), /expected one Coach/)
  assert.equal(transform.call(context, 'ordinary component', resolve('mobile_app/src/components/Other.tsx'), { ssr: false }), null)
  for (const file of ['src/ai/AICoachPanel.tsx', 'src/ai/server/handler.ts', 'api/ai-coach.ts']) {
    for (const id of [resolve(file), resolve(file).toUpperCase() + '?raw']) assert.throws(() => transform.call(context, 'legacy module', id, { ssr: false }), /Legacy AI module entered/)
  }
})

test('The actual Beta dev server refuses direct legacy route probes before any API handler', async () => {
  const previousNodeEnvironment = process.env.NODE_ENV
  const server = await createServer({ ...(await config(betaConfigFile, 'serve')), configFile: false, logLevel: 'silent', cacheDir: cacheFolder(), server: { host: '127.0.0.1', port: 0, hmr: false } })
  try {
    await server.listen()
    const address = server.httpServer?.address()
    assert.ok(address && typeof address !== 'string')
    for (const endpoint of ['/api/ai-coach', '/api/%61i-coach?preview=1', '/api/ai-coach/']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${endpoint}`, { method: 'POST', body: '{}' })
      assert.equal(response.status, 404)
      assert.match((await response.json()).error, /not available in this isolated Beta/)
    }
  } finally {
    await server.close()
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnvironment
  }
})
