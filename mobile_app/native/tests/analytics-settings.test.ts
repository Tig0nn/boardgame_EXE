import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createGameplayAnalytics } from '../src/analytics/core.ts'

test('Settings explicitly opts in/declines/withdraws and remains usable with no provider', async () => {
  const core = createGameplayAnalytics({ configured: false, testMode: true, build: '9', now: Date.now,
    uuid: () => { throw Error('must not create identity without provider') }, hash: async () => { throw Error('must not hash') },
    storage: { getItem: async () => null, setItem: async () => {} }, send: async () => { throw Error('must not send') } })
  const bridge = globalThis as unknown as Record<string, unknown>; bridge.__EXE_ANALYTICS_CORE = core
  const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react'] }, server: { middlewareMode: true, ws: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'analytics-settings-host', enforce: 'pre', resolveId(id, importer) {
      if (id === 'virtual:settings' || importer?.endsWith('/analytics-settings.tsx') && ['./ui', './analytics/runtime'].includes(id)) return '\0' + id
    }, load(id) {
      if (id === '\0./analytics/runtime') return 'export const gameplayAnalytics=globalThis.__EXE_ANALYTICS_CORE'
      if (id === '\0./ui') return "import {createElement} from 'react'; export const Copy='text'; export const Action=p=>createElement('button',p,p.label)"
      if (id === '\0virtual:settings') return `
        import {createElement} from 'react'
        import {act,create} from 'react-test-renderer'
        import {AnalyticsSettings} from '/src/analytics-settings.tsx'
        globalThis.IS_REACT_ACT_ENVIRONMENT=true
        let screen
        export async function mount(){await act(async()=>{screen=create(createElement(AnalyticsSettings))})}
        export const text=()=>JSON.stringify(screen.toJSON())
        export async function tap(label){await act(async()=>{const b=screen.root.findAllByType('button').find(n=>n.props.label===label); if(!b || b.props.disabled)throw Error('disabled'); b.props.onPress()})}
        export async function unmount(){await act(async()=>screen.unmount())}
      `
    } }] })
  try {
    const ui = await server.ssrLoadModule('virtual:settings'); await ui.mount()
    assert.equal(core.getSnapshot().consent, 'unknown')
    assert.match(ui.text(), /Không chia sẻ thống kê/); assert.match(ui.text(), /chưa kết nối/)
    await ui.tap('Không chia sẻ thống kê'); assert.equal(core.getSnapshot().consent, 'disabled')
    await ui.tap('Đồng ý bật thống kê ẩn danh'); assert.equal(core.getSnapshot().consent, 'enabled')
    await ui.tap('Tắt thống kê ẩn danh'); assert.equal(core.getSnapshot().consent, 'disabled')
    await ui.unmount()
  } finally { await server.close(); delete bridge.__EXE_ANALYTICS_CORE }
})
