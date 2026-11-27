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
          export const Pressable='pressable', View='view', Text='text',ScrollView='scroll',Platform={OS:'android'},StyleSheet={create:x=>x,absoluteFill:{}}
          let dimensions={width:384,height:824,fontScale:1};export const useWindowDimensions=()=>dimensions
          export const setScreen=value=>{dimensions=value}
          export const AppState={currentState:'active',addEventListener:()=>({remove(){}})}
          export const AccessibilityInfo={isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}})}
          export const Animated={Value:class{setValue(){}}}
        `
        if (id === '\0expo-image') return `export const Image='image'`
        if (id === '\0expo-linear-gradient') return `export const LinearGradient='gradient'`
        if (id === '\0react-native-svg') return `export default 'svg';export const Circle='circle',Path='path'`
        if (id === '\0react-native-safe-area-context') return `let insets={top:0,bottom:0,left:0,right:0};export const useSafeAreaInsets=()=>insets,setInsets=value=>{insets=value}`
        if (id === '\0virtual:result-health') return `
          import {createElement} from 'react'
          import {create,act} from 'react-test-renderer'
          import {ResultHealth} from '/src/result-health.tsx'
          import {ResultHero} from '/src/decision-presentation.tsx'
          import {ResultLayout,ResultAction} from '/src/result-layout.tsx'
          import {ResultCopy} from '/src/result-currency.tsx'
          import {setScreen} from 'react-native'
          import {setInsets} from 'react-native-safe-area-context'
          import {fromLocal} from '/src/arena-model.ts'
          import {createMultiCourseGame} from ${JSON.stringify(fileURLToPath(new URL('../../../src/game/new-game.ts', import.meta.url)).replaceAll('\\', '/'))}
          import {serializeLog} from ${JSON.stringify(fileURLToPath(new URL('../../../src/game/log.ts', import.meta.url)).replaceAll('\\', '/'))}
          import {money} from ${JSON.stringify(fileURLToPath(new URL('../../../src/game/format.ts', import.meta.url)).replaceAll('\\', '/'))}
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          export async function currency(value){
            return currencyText(money(value))
          }
          export async function currencyText(formatted){
            let screen
            await act(async()=>{screen=create(createElement(ResultCopy,{variant:'title',numberOfLines:1,adjustsFontSizeToFit:true},formatted))})
            const nodes=screen.root.findAllByType('text'),root=nodes[0]
            function content(node){return typeof node==='string'||typeof node==='number'?String(node):node.children.map(content).join('')}
            const symbol=nodes.find(n=>n.children.length===1&&n.children[0]==='₫')
            const result={formatted,rendered:content(root),label:root.props.accessibilityLabel,symbolStyle:symbol?.props.style,fit:root.props.adjustsFontSizeToFit}
            await act(async()=>screen.unmount());return result
          }
          export async function layout(width,height,insets){
            setScreen({width,height,fontScale:1});setInsets(insets)
            const arena=fromLocal(createMultiCourseGame('result-layout-host',0,1))
            arena.result={outcome:'defeat',lawfulProceedsVnd:'84000000'}
            let screen,closes=0,actions=0
            await act(async()=>{screen=create(createElement(ResultLayout,{arena,onClose(){closes++},
              footer:createElement(ResultAction,{label:'Ván mới',onPress(){actions++},primary:true})},createElement('body',null,'long report')))})
            const frame=screen.root.find(n=>n.props.testID==='result-frame').props.style
            const banner=screen.root.find(n=>n.props.testID==='result-banner').props.style
            const scroll=screen.root.findByType('scroll')
            const footerOutside=scroll.findAll(n=>n.props.testID==='result-footer').length===0
            const buttons=screen.root.findAllByType('pressable')
            const targets=buttons.map(n=>typeof n.props.style==='function'?n.props.style({pressed:false}):n.props.style)
            await act(async()=>buttons.find(n=>n.props.accessibilityLabel==='Đóng').props.onPress())
            await act(async()=>buttons.find(n=>n.props.accessibilityLabel==='Ván mới').props.onPress())
            await act(async()=>screen.unmount())
            return{frame,banner,footerOutside,targets,closes,actions}
          }
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
    for (const value of [0,92_458_182,90_000_000,-3_000_000,Number.MAX_SAFE_INTEGER]) {
      const currency = await ui.currency(value)
      assert.equal(currency.rendered,currency.formatted.replace(/ (₫)/gu,'\u00a0$1'),'the amount and symbol share a nonbreaking space in presentation')
      assert.equal(currency.rendered.replaceAll('\u00a0',' '),currency.formatted,'only the presentation space changes')
      if (value === 92_458_182) assert.equal(currency.formatted,'92.458.182 ₫')
      assert.equal(currency.label,currency.formatted)
      assert.equal(currency.symbolStyle.fontFamily,'sans-serif')
      assert.equal(currency.symbolStyle.fontWeight,'400')
      assert.equal(currency.fit,true)
    }
    for (const sentence of [
      'Thanh toán ngay cho biến cố cá nhân 5.000.000 ₫.',
      'Học phí đã trả 9.000.000 ₫ · Lương thêm đã nhận 12.000.000 ₫.',
      'Phí và chênh lệch giá mua và bán đã trả 125.000 ₫.',
      'Nợ còn lại 10.000.000 ₫, đã trừ khỏi nguồn tiền về đích.',
      'Tiền đã đầu tư còn nằm trong quán 20.000.000 ₫; quán chưa bán nên không tính vào mục tiêu.',
      'Lương đã nhận 56.000.000 ₫. Sinh hoạt đã trả 20.000.000 ₫.',
    ]) {
      const currency = await ui.currencyText(sentence)
      assert.equal(currency.rendered,sentence.replace(/ (₫)/gu,'\u00a0$1'))
      assert.equal(currency.label,sentence,'accessibility retains the unmodified canonical review sentence')
      assert.equal(currency.symbolStyle.fontFamily,'sans-serif')
    }
    for (const [width,height] of [[320,740],[384,824],[430,932]]) {
      const insets = { top: 24, bottom: 24, left: 0, right: 0 }
      const layout = await ui.layout(width,height,insets)
      assert.equal(layout.frame.width, Math.min(340,(width-20)*.88))
      assert.equal(layout.frame.height, Math.min(660,height*.8,height-68))
      assert.equal(layout.frame.borderRadius, 30)
      assert.equal(layout.banner.minHeight, 105)
      assert.equal(layout.footerOutside, true)
      assert.ok(layout.targets.every((target: { minHeight: number }) => target.minHeight >= 48))
      assert.deepEqual([layout.closes,layout.actions],[1,1])
    }
    const constrained = await ui.layout(384,824,{top:80,bottom:160,left:20,right:20})
    assert.equal(constrained.frame.height,564, 'frame fits the safe region without applying its insets twice')
    assert.equal(constrained.frame.width,(384-40-20)*.88)
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
