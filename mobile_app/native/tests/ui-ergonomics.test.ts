import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('native controls keep usable targets and keyboard-safe decision drafts', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react'] },
    ssr: { noExternal: ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{
      name: 'native-ergonomics-host', enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:ergonomics' || ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context'].includes(id)) return '\0' + id
      },
      load(id) {
        if (id === '\0react-native') return `
          export const ActivityIndicator='spinner', Pressable='pressable', ScrollView='scroll',Text='text',View='view',KeyboardAvoidingView='keyboard-view'
          export const Platform={OS:'android'}, StyleSheet={create:x=>x,absoluteFill:{}}
          export let dismisses=0
          export const Keyboard={dismiss(){dismisses++}}
        `
        if (id === '\0expo-image') return "export const Image='image'"
        if (id === '\0expo-linear-gradient') return "export const LinearGradient='gradient'"
        if (id === '\0react-native-svg') return "export default 'svg';export const Circle='circle',Path='path'"
        if (id === '\0react-native-safe-area-context') return "export const useSafeAreaInsets=()=>({top:24,bottom:24,left:0,right:0})"
        if (id === '\0virtual:ergonomics') return `
          import {createElement,useEffect,useState} from 'react'
          import {create,act} from 'react-test-renderer'
          import {ArtButton,Action,Panel} from '/src/ui.tsx'
          import {dismisses} from 'react-native'
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          export async function target(size) {
            let screen
            await act(async()=>{screen=create(createElement(ArtButton,{size,label:'Bản đồ',icon:1,onPress(){}}))})
            const button=screen.root.findByType('pressable')
            const style=button.props.style({pressed:false})
            const icon=screen.root.findByType('image').props.style
            await act(async()=>screen.unmount())
            return {width:style.width,height:style.height,iconWidth:icon.width,iconHeight:icon.height}
          }
          export async function action() {
            let screen
            const label='Xác nhận · 50.000.000 ₫ và nội dung tiếng Việt dài'
            await act(async()=>{screen=create(createElement(Action,{label,onPress(){}}))})
            const node=screen.root.findByType('pressable')
            const text=screen.root.findByType('text')
            const result={height:node.props.style({pressed:false}).minHeight,text:text.props.children,lines:text.props.numberOfLines,label}
            await act(async()=>screen.unmount())
            return result
          }
          export async function panel(){
            let screen,mounts=0,unmounts=0
            function Draft(){
              const [value,setValue]=useState('1000000')
              useEffect(()=>{mounts++;return()=>{unmounts++}},[])
              return createElement('input',{value,onChangeText:setValue})
            }
            const element=visible=>createElement(Panel,{title:'Quyết định',subtitle:'VÒNG 2 / 4',lap:2,icon:7,visible,
              footer:createElement('button',{label:'BỎ QUA CƠ HỘI'})},createElement(Draft))
            await act(async()=>{screen=create(element(true))})
            await act(async()=>{screen.root.findByType('input').props.onChangeText('25000000')})
            const container=screen.root.findAllByType('keyboard-view')[0]
            const scroll=screen.root.findByType('scroll').props
            const footerOutside=screen.root.findByType('scroll').findAllByType('button').length===0
            const frame=screen.root.findAllByType('gradient').find(n=>n.props.testID==='native-panel-frame').props.style
            const icon=screen.root.findByType('image').props.source
            const keyboard=container && {behavior:container.props.behavior,offset:container.props.keyboardVerticalOffset}
            const before=dismisses
            await act(async()=>screen.update(element(false)))
            const dismissed=dismisses-before
            await act(async()=>screen.update(element(true)))
            const result={keyboard,scrollMode:scroll.keyboardDismissMode,taps:scroll.keyboardShouldPersistTaps,footerOutside,frame,icon,
              draft:screen.root.findByType('input').props.value,mounts,unmounts,dismissed}
            await act(async()=>screen.unmount())
            return result
          }
        `
      },
    }],
  })
  try {
    const ui = await server.ssrLoadModule('virtual:ergonomics')
    await t.test('small icon controls expose 48dp targets and keep their original artwork size', async () => {
      for (const size of [36, 44, 86]) {
        const result = await ui.target(size)
        assert.ok(result.width >= 48 && result.height >= 48)
        assert.equal(result.iconWidth, size)
        assert.equal(result.iconHeight, size)
      }
    })
    await t.test('long financial labels wrap in a target of at least 48dp', async () => {
      const result = await ui.action()
      assert.ok(result.height >= 48)
      assert.equal(result.text, result.label)
      assert.equal(result.lines, undefined)
    })
    await t.test('keyboard avoidance and scroll dismissal preserve the mounted decision draft', async () => {
      const result = await ui.panel()
      assert.deepEqual(result.keyboard, { behavior: 'height', offset: 24 })
      assert.equal(result.scrollMode, 'on-drag')
      assert.equal(result.taps, 'handled')
      assert.equal(result.draft, '25000000')
      assert.equal(result.mounts, 1)
      assert.equal(result.unmounts, 0)
      assert.equal(result.dismissed, 1)
      assert.equal(result.footerOutside, true, 'decision footer remains outside the long body scroll')
      assert.equal(result.frame.maxWidth, 370)
      assert.equal(result.icon, 7, 'the original transaction artwork remains in the header')
    })
  } finally { await server.close() }
})
