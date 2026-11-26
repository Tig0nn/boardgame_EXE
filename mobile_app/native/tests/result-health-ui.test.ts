import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('Result report renders canonical scores and accessible, read-only accordions', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    assetsInclude: ['**/*.glb', '**/*.wav'],
    resolve: { dedupe: ['react'] }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{ name: 'result-report-host', enforce: 'pre',
      resolveId(id) {
        if (['virtual:result-health', 'react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'].includes(id)) return '\0' + id
      },
      load(id) {
        if (id === '\0react-native') return `
          export const Pressable='pressable', View='view', Text='text',StyleSheet={create:x=>x}
          export const AppState={currentState:'active',addEventListener:()=>({remove(){}})}
          export const AccessibilityInfo={isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}})}
          export const Animated={Value:class{setValue(){}}}
        `
        if (id === '\0expo-image') return `export const Image='image'`
        if (id === '\0expo-linear-gradient') return `export const LinearGradient='gradient'`
        if (id === '\0react-native-svg') return `export default 'svg';export const Circle='circle',Path='path'`
        if (id === '\0react-native-safe-area-context') return `export const useSafeAreaInsets=()=>({top:0,bottom:0})`
        if (id === '\0virtual:result-health') return `
          import {createElement} from 'react'
          import {create,act} from 'react-test-renderer'
          import {ResultHealth} from '/src/result-health.tsx'
          import {ResultHero} from '/src/decision-presentation.tsx'
          import {fromLocal} from '/src/arena-model.ts'
          import {createMultiCourseGame} from ${JSON.stringify(fileURLToPath(new URL('../../../src/game/new-game.ts', import.meta.url)).replaceAll('\\', '/'))}
          import {serializeLog} from ${JSON.stringify(fileURLToPath(new URL('../../../src/game/log.ts', import.meta.url)).replaceAll('\\', '/'))}
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          export async function check(online,outcome='defeat'){
            const game=createMultiCourseGame('result-report-host',0,1), before=serializeLog(game)
            const arena=fromLocal(game);if(online)delete arena.local
            arena.result={outcome,lawfulProceedsVnd:'84000000'}
            const official=JSON.stringify(arena.result)
            let screen;await act(async()=>{screen=create(createElement('root',null,createElement(ResultHero,{arena}),createElement(ResultHealth,{arena})))})
            const bars=screen.root.findAll(n=>n.props.accessibilityRole==='progressbar').map(n=>n.props.accessibilityValue)
            const badges=screen.root.findAll(n=>n.props.testID==='result-health-grade').length
            let expanded=false,target=0
            if(!online){
              const button=screen.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Gợi ý cho hành trình tiếp theo')
              target=button.props.style({pressed:false}).minHeight
              await act(async()=>button.props.onPress())
              expanded=button.props.accessibilityState.expanded
            }
            const text=screen.root.findAllByType('text').map(n=>n.props.children).flat().join(' ')
            await act(async()=>screen.unmount())
            return{bars,badges,expanded,target,text,unchanged:before===serializeLog(game)&&official===JSON.stringify(arena.result)}
          }
        `
      },
    }],
  })
  try {
    const ui = await server.ssrLoadModule('virtual:result-health')
    const local = await ui.check(false)
    assert.equal(local.bars.length, 4)
    for (const bar of local.bars) { assert.equal(bar.max, 25); assert.ok(bar.now >= 0 && bar.now <= 25) }
    assert.ok(local.badges > 0)
    assert.equal(local.expanded, true)
    assert.ok(local.target >= 48)
    assert.equal(local.unchanged, true)
    const online = await ui.check(true)
    assert.equal(online.bars.length, 0)
    assert.equal(online.badges, 0)
    assert.match(online.text, /chưa đủ dữ liệu/)
    assert.equal(online.unchanged, true)
    for (const [outcome, heading] of [['victory', /CHIẾN THẮNG RỰC RỠ/], ['defeat', /TIẾC QUÁ/], ['insolvent', /HẸN MỘT HÀNH TRÌNH MỚI/]] as const) {
      const result = await ui.check(false, outcome)
      assert.match(result.text, heading)
      assert.equal(result.unchanged, true)
    }
  } finally { await server.close() }
})
