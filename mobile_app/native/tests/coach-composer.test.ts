import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'

test('long coach explanations leave a mounted question and submit control outside the shrinking scroll viewport', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react'] },
    ssr: { noExternal: ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{
      name: 'coach-composer-native-host', enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:coach-composer' || ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'].includes(id)) return '\0' + id
      },
      load(id) {
        if (id === '\0react-native') return `
          export const ActivityIndicator='spinner',Pressable='pressable',ScrollView='scroll',Text='text',View='view',TextInput='input',KeyboardAvoidingView='keyboard-view'
          export const Platform={OS:'android'},StyleSheet={create:x=>x,absoluteFill:{}},Keyboard={dismiss(){}}
        `
        if (id === '\0expo-image') return "export const Image='image'"
        if (id === '\0expo-linear-gradient') return "export const LinearGradient='gradient'"
        if (id === '\0react-native-svg') return "export default 'svg';export const Circle='circle',Path='path'"
        if (id === '\0react-native-safe-area-context') return "export const useSafeAreaInsets=()=>({top:24,bottom:24,left:0,right:0})"
        if (id === '\0virtual:coach-composer') return `
          import {createElement} from 'react'
          import {create,act} from 'react-test-renderer'
          import {CoachPanel} from '/src/coach-and-what-if.tsx'
          import {fromLocal} from '/src/arena-model.ts'
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          export async function verify(game){
            const base=fromLocal(game)
            const arena={...base,coachCards:Array.from({length:40},(_,i)=>({id:'long-'+i,title:'Giải thích',text:'Nội dung giải thích dài để thử vùng cuộn.'}))}
            let screen
            const render=()=>createElement(CoachPanel,{arena,onClose(){}})
            await act(async()=>{screen=create(render())})
            try {
              const input=screen.root.findByType('input')
              const scroll=screen.root.findByType('scroll')
              const ask=()=>screen.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Hỏi Cáo')
              const outsideScroll=!scroll.findAll(n=>n===input||n===ask()).length
              const emptyDisabled=ask().props.disabled
              await act(async()=>input.props.onChangeText('Thanh khoản là gì?'))
              await act(async()=>screen.update(render()))
              const sameInput=screen.root.findByType('input')===input
              const draft=input.props.value
              const ready=!ask().props.disabled
              await act(async()=>ask().props.onPress())
              const answer=screen.root.findAllByType('text').map(n=>n.props.children).flat().join(' ')
              const draftAfterSubmit=input.props.value
              await act(async()=>input.props.onChangeText('ab'))
              await act(async()=>ask().props.onPress())
              return {outsideScroll,emptyDisabled,sameInput,draft,ready,draftAfterSubmit,answer,validation:screen.root.findAllByType('text').some(n=>n.props.accessibilityRole==='alert')}
            } finally {await act(async()=>screen.unmount())}
          }
        `
      },
    }],
  })
  try {
    const module = await server.ssrLoadModule('virtual:coach-composer')
    const game = createMultiCourseGame('coach-composer-regression', 0, 1)
    const before = serializeLog(game)
    const result = await module.verify(game)
    assert.equal(result.outsideScroll, true, 'input and submit must not scroll out with the long coach history')
    assert.equal(result.emptyDisabled, true)
    assert.equal(result.sameInput, true, 'rerender must not remount the focused input')
    assert.equal(result.draft, 'Thanh khoản là gì?')
    assert.equal(result.ready, true)
    assert.equal(result.draftAfterSubmit, result.draft)
    assert.match(result.answer, /Thanh khoản/)
    assert.equal(result.validation, true)
    assert.equal(serializeLog(game), before)
  } finally { await server.close() }
})
