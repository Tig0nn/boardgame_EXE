import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('owner workspace isolates data, pending requests and creation retries', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    ssr: { noExternal: ['react-native', 'expo-image', 'expo-crypto'] }, resolve: { dedupe: ['react'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{
      name: 'native-cloud-host', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'virtual:cloud' || ['react-native', 'expo-image', 'expo-crypto'].includes(id)) return '\0' + id
        if (importer?.endsWith('/cloud-saves.tsx') && ['./ui', './game', './assets'].includes(id)) return '\0' + id
      },
      load(id) {
        if (id === '\0react-native') return "export const StyleSheet={create:x=>x,absoluteFill:{}}, TextInput='input', BackHandler={addEventListener:()=>({remove(){}})}"
        if (id === '\0expo-image') return "export const Image='image'"
        if (id === '\0expo-crypto') return "let next=0; export const randomUUID=()=> 'fixture-key-'+(++next)"
        if (id === '\0./assets') return "export const art={}"
        if (id === '\0./ui') return `
          import {createElement} from 'react'
          export const Copy='text'
          export const Action=p=>createElement('button',p,p.label)
          export const Panel=p=>createElement('panel',{},p.title,p.header,p.children)
        `
        if (id === '\0./game') return `
          import {createElement} from 'react'
          export const CloudGame=p=>createElement('cloud-game',{},p.initial.session.id,
            createElement('button',{label:'Exit cloud',onPress:p.ownerExit},'Exit cloud'))
        `
        if (id === '\0virtual:cloud') return `
          import {createElement} from 'react'
          import {create,act} from 'react-test-renderer'
          import {CloudSaveFlow} from '/src/cloud-saves.tsx'
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          let screen
          const element=account=>createElement(CloudSaveFlow,{account,back(){},sound(){},playSound(){}})
          export async function mount(account){await act(async()=>{screen=create(element(account))})}
          export async function update(account){await act(async()=>{screen.update(element(account))})}
          export async function tap(label){await act(async()=>{
            const button=screen.root.findAllByType('button').find(n=>n.props.label===label)
            if(!button || button.props.disabled)throw Error('Button unavailable: '+label)
            button.props.onPress()
          })}
          export const text=()=>JSON.stringify(screen.toJSON())
          export const labels=()=>screen.root.findAllByType('button').map(n=>n.props.label)
          export async function flush(work){await act(work)}
          export async function unmount(){await act(async()=>screen.unmount())}
        `
      },
    }],
  })
  try {
    const ui = await server.ssrLoadModule('virtual:cloud')
    const header = { id: 'game-A', status: 'completed', stateVersion: 60, updatedAt: '2026-11-20T00:00:00Z' }
    const detail = { session: header, state: {}, result: { outcome: 'defeat', lawfulProceedsVnd: '84000000' } }
    const account = (id: string, api: object) => ({ session: { user: { id } }, api,
      ready: true, configured: true, message: '', authenticate: async () => {}, signOut: async () => true })
    await t.test('A to B to A cannot resurrect a previously open game or cached list', async () => {
      const api = { list: async () => ({ sessions: [header] }), read: async () => detail }
      await ui.mount(account('A', api))
      await ui.tap('Mở Cloud Save')
      await ui.tap(ui.labels().find((s: string) => s.startsWith('Xem kết quả')))
      assert.match(ui.text(), /game-A/)
      await ui.update(account('B', { list: async () => ({ sessions: [] }) }))
      assert.doesNotMatch(ui.text(), /game-A|Xem kết quả/)
      await ui.update(account('A', api))
      assert.doesNotMatch(ui.text(), /game-A|Xem kết quả/)
      assert.match(ui.text(), /Mở Cloud Save/)
      await ui.unmount()
    })
    await t.test('late A list cannot populate B workspace', async () => {
      let resolve: (value: object) => void = () => {}
      const response = new Promise<object>(done => { resolve = done })
      await ui.mount(account('A', { list: async () => response }))
      await ui.tap('Mở Cloud Save')
      await ui.update(account('B', { list: async () => ({ sessions: [] }) }))
      await ui.flush(async () => { resolve({ sessions: [header] }) })
      assert.doesNotMatch(ui.text(), /Xem kết quả/)
      await ui.tap('Mở Cloud Save')
      assert.match(ui.text(), /Bạn chưa có ván trực tuyến/)
      await ui.unmount()
    })
    await t.test('session expiry clears the completed game; login restores from a fresh read', async () => {
      let reads = 0
      const a = account('A', { list: async () => ({ sessions: [header] }), read: async () => { reads++; return detail } })
      await ui.mount(a)
      await ui.tap('Mở Cloud Save')
      await ui.tap(ui.labels().find((s: string) => s.startsWith('Xem kết quả')))
      await ui.update({ ...a, session: null, api: undefined })
      assert.doesNotMatch(ui.text(), /game-A/)
      assert.match(ui.text(), /Đăng nhập/)
      await ui.update(a)
      await ui.tap('Mở Cloud Save')
      await ui.tap(ui.labels().find((s: string) => s.startsWith('Xem kết quả')))
      assert.equal(reads, 2)
      await ui.unmount()
    })
    await t.test('lost create response retries one key; failed initial read retries only the read', async () => {
      const keys: string[] = []
      let reads = 0
      const api = { list: async () => ({ sessions: [] }),
        create: async (key: string) => {
          keys.push(key)
          if (keys.length === 1) throw new TypeError('response lost')
          return { session: header }
        },
        read: async () => { if (++reads === 1) throw new TypeError('offline'); return detail },
      }
      await ui.mount(account('A', api))
      await ui.tap('Mở Cloud Save')
      await ui.tap('Tạo ván mới')
      await ui.tap('Tạo ván mới')
      await ui.tap('Tạo ván mới')
      assert.equal(keys.length, 2)
      assert.equal(keys[0], keys[1])
      assert.equal(reads, 2)
      assert.match(ui.text(), /game-A/)
      await ui.unmount()
    })
    await t.test('leaving a game refreshes its completed status in Cloud Save', async () => {
      let lists = 0
      const api = { list: async () => ({ sessions: [{ ...header, status: ++lists === 1 ? 'active' : 'completed' }] }),
        read: async () => detail }
      await ui.mount(account('A', api))
      await ui.tap('Mở Cloud Save')
      await ui.tap(ui.labels().find((s: string) => s.startsWith('Tiếp tục ván')))
      await ui.tap('Exit cloud')
      assert.equal(lists, 2)
      assert.ok(ui.labels().some((s: string) => s.startsWith('Xem kết quả')))
      await ui.unmount()
    })
  } finally { await server.close() }
})
