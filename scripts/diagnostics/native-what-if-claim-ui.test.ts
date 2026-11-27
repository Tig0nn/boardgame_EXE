import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createGameApi } from '../../mobile_app/src/game/server-session.ts'

test('native comparison renders the mapped server text before its coach fallback', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react', 'react-dom'] }, ssr: { noExternal: ['react-native'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{
      name: 'native-comparison-render', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'virtual:comparison' || id === 'react-native') return '\0' + id
        if (id === './ui' && importer?.endsWith('/coach-and-what-if.tsx')) return '\0native-host'
      },
      load(id) {
        if (id === '\0react-native') return "export const View='div', TextInput='input', ActivityIndicator='span', StyleSheet={create:x=>x}"
        if (id === '\0native-host') return "export const Copy='span', Action='button', Fox='i'"
        if (id === '\0virtual:comparison') return `
          import { createElement } from 'react'
          import { renderToStaticMarkup } from 'react-dom/server'
          import { Comparison } from '/mobile_app/native/src/coach-and-what-if.tsx'
          export const render = result => renderToStaticMarkup(createElement(Comparison,
            { result, original: 'Khóa cơ bản', alternative: 'Khóa nâng cao' }))
        `
      },
    }],
  })
  try {
    const { render } = await server.ssrLoadModule('virtual:comparison')
    const direct = 'Tiền mặt cuối vòng 4 thấp hơn theo replay.'
    const fallback = 'Thông tin tại thời điểm quyết định.'
    const evaluation = { status: 'completed', stateVersion: 60, sequence: 53,
      actual: { outcome: 'defeat', lawfulProceedsVnd: '84000000' },
      alternative: { outcome: 'defeat', lawfulProceedsVnd: '78000000' },
      delta: { lawfulProceedsVnd: '-6000000' }, coach: { cards: [{ id: 'cash-at-decision', text: fallback }] } }
    for (const claim of [{ id: 'course-down', basis: 'verified-final-cash', text: direct }, null]) {
      const api = createGameApi(async () => 'fixture', async () => Response.json({ version: 1,
        operation: 'explain', status: 'completed', assistance: 'not-requested', stateVersion: 60, evaluation, claim }), false)
      const html: string = render(await api.simulateWhatIf('fixture', { stateVersion: 60, sequence: 53, alternative: { mode: 'omit' } }))
      assert.equal(html.includes(direct), claim !== null)
      assert.equal(html.includes(fallback), claim === null)
    }
  } finally {
    await server.close()
  }
})
