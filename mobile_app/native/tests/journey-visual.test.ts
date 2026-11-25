import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('illustrated journey keeps navigation, locked chapters, save access and motion cleanup', async () => {
  const host = ['react-native', 'expo-image', 'expo-linear-gradient', 'react-native-svg', 'react-native-safe-area-context', 'expo-asset', '@react-three/fiber/native']
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react'] }, ssr: { noExternal: [...host, '@react-three/fiber', 'three'] },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{ name: 'journey-native-host', enforce: 'pre', resolveId(id, importer) {
      if (importer?.endsWith('/src/board.tsx') && id === 'three') return '\0three'
      if (importer?.endsWith('/src/board.tsx') && id === './dice-3d') return '\0dice'
      if (id.startsWith('three/examples/')) return '\0gltf'
      if (id === 'virtual:journey' || host.includes(id)) return '\0' + id
      if (id === './assets') return '\0assets'
    }, load(id) {
      if (id === '\0assets') return 'export const art=new Proxy({},{get:(_,key)=>key})'
      if (id === '\0dice') return "import{createElement}from'react';export const Dice3D=p=>createElement('view',{accessibilityLabel:'Xúc xắc · '+p.value})"
      if (id === '\0three') return 'export class AnimationMixer{};export class Box3{};export class Vector3{}'
      if (id === '\0gltf') return 'export class GLTFLoader{}'
      if (id === '\0expo-image') return "export const Image='image'"
      if (id === '\0expo-asset') return 'export const useAssets=()=>[undefined]'
      if (id === '\0@react-three/fiber/native') return 'export const Canvas=()=>null,useFrame=()=>{},useLoader=()=>{}'
      if (id === '\0expo-linear-gradient') return "export const LinearGradient='gradient'"
      if (id === '\0react-native-svg') return "export default 'svg';export const Path='path',Circle='circle'"
      if (id === '\0react-native-safe-area-context') return 'export const useSafeAreaInsets=()=>({top:24,bottom:24})'
      if (id === '\0react-native') return `
        export const View='view',Text='text',ScrollView='scroll',Pressable='button',KeyboardAvoidingView='keyboard-view',ActivityIndicator='spinner'
        export const StyleSheet={create:x=>x,absoluteFill:{}},Platform={OS:'android'},Keyboard={dismiss(){}}
        export const useWindowDimensions=()=>({width:384,height:824})
        let motionListener,appListener;export const stats={started:0,stopped:0,removed:0}
        const sub=()=>({remove(){stats.removed++}})
        export const AppState={currentState:'active',addEventListener(_,fn){appListener=fn;return sub()}}
        export const AccessibilityInfo={isReduceMotionEnabled:async()=>false,addEventListener(_,fn){motionListener=fn;return sub()}}
        export const reduce=value=>motionListener(value),background=()=>appListener('background')
        class Value{constructor(value){this.value=value}setValue(value){this.value=value}interpolate(){return this.value}getTranslateTransform(){return []}}
        const animation=()=>({start(){stats.started++},stop(){stats.stopped++}})
        export const Animated={Value,ValueXY:Value,View:'animated-view',timing:animation,loop:animation,sequence:animation}
        export const Easing={sin:x=>x,inOut:x=>x,out:x=>x,quad:x=>x}
      `
      if (id === '\0virtual:journey') return `
        import{createElement}from'react';import{create,act}from'react-test-renderer'
        import{Landing,ChapterMap}from'/src/journey-screens.tsx';import{reduce,background,stats}from'react-native'
        import{Board}from'/src/board.tsx';import{fromLocal}from'/src/arena-model.ts';import{createMultiCourseGame}from'/@fs/${fileURLToPath(new URL('../../../src/game/new-game.ts', import.meta.url)).replaceAll('\\', '/')}'
        globalThis.IS_REACT_ACT_ENVIRONMENT=true
        export async function verify(){
          let screen,plays=0,online=0,resumes=0,settings=0,sounds=0,guides=0
          const handlers={open(){plays++},online(){online++},continueGame(){resumes++},settings(){settings++},sound(){sounds++},guide(){guides++},back(){}}
          await act(async()=>{screen=create(createElement(Landing,{...handlers,muted:false}))})
          const button=name=>screen.root.findAllByType('button').find(n=>n.props.accessibilityLabel===name)
          await act(async()=>button('Bắt đầu phiêu lưu').props.onPress())
          await act(async()=>button('Cài đặt').props.onPress())
          await act(async()=>button('Tắt âm thanh').props.onPress())
          const started=stats.started
          await act(async()=>reduce(true));const stoppedForReduce=stats.stopped>0
          await act(async()=>screen.unmount())
          await act(async()=>{screen=create(createElement(ChapterMap,{...handlers,account:true,muted:false,saved:true}))})
          const nodes=screen.root.findAllByType('button').filter(n=>n.props.accessibilityLabel?.startsWith('Chương '))
          await act(async()=>nodes.find(n=>n.props.accessibilityLabel.startsWith('Chương 2')).props.onPress())
          const lockedDidNotPlay=plays===1
          await act(async()=>nodes.find(n=>n.props.accessibilityLabel.startsWith('Chương 1')).props.onPress())
          await act(async()=>button('Sổ tay').props.onPress())
          await act(async()=>button('Cloud Save · Ván của tôi').props.onPress())
          await act(async()=>button('Túi đồ và ván lưu').props.onPress())
          await act(async()=>button('Tiếp tục ván trên thiết bị').props.onPress())
          const beforeBackground=stats.stopped
          await act(async()=>background());const pausedInBackground=stats.stopped>beforeBackground
          await act(async()=>screen.unmount())
          return {plays,online,resumes,settings,sounds,guides,nodes:nodes.length,lockedDidNotPlay,started,stoppedForReduce,pausedInBackground,removed:stats.removed}
        }
        export async function board(){
          let screen,rolls=0,returned=0
          const arena={...fromLocal(createMultiCourseGame('board-visual-only',0,1)),phase:'rolling',dice:6}
          const props={arena,peek:false,blocked:false,onRoll(){rolls++},onReturn(){returned++},onHome(){},onWallet(){},onGuide(){},onSound(){},onSettings(){},onTile(){}}
          await act(async()=>{screen=create(createElement(Board,props))})
          const buttons=()=>screen.root.findAllByType('button')
          const roll=()=>buttons().find(n=>n.props.accessibilityLabel==='Lắc xúc xắc')
          const target=roll().props.style({pressed:false})
          const dockPassThrough=screen.root.findAllByType('view').find(n=>n.props.testID==='native-board-dock')?.props.pointerEvents
          const tileTargets=buttons().filter(n=>n.props.accessibilityLabel?.startsWith('Ô ')).map(n=>n.props.style)
          const before=rolls
          await act(async()=>roll().props.onPress())
          await act(async()=>screen.update(createElement(Board,{...props,peek:true})))
          const peekDisabled=roll().props.disabled
          await act(async()=>buttons().find(n=>n.props.accessibilityLabel==='Quay lại quyết định').props.onPress())
          const diceLabel=screen.root.findAllByType('view').some(n=>n.props.accessibilityLabel==='Xúc xắc · 6')
          await act(async()=>screen.unmount())
          return {before,rolls,returned,peekDisabled,target,tileTargets,diceLabel,dockPassThrough}
        }
      `
    } }],
  })
  try {
    const result = await (await server.ssrLoadModule('virtual:journey')).verify()
    assert.deepEqual([result.plays, result.online, result.resumes, result.settings, result.sounds, result.guides], [2, 1, 1, 1, 1, 1])
    assert.equal(result.nodes, 5)
    assert.ok(result.lockedDidNotPlay)
    assert.ok(result.started > 0 && result.stoppedForReduce && result.pausedInBackground)
    assert.equal(result.removed, 4)
    const board = await (await server.ssrLoadModule('virtual:journey')).board()
    assert.equal(board.before, 0, 'rendering the board must never request a roll')
    assert.equal(board.rolls, 1)
    assert.equal(board.returned, 1)
    assert.equal(board.peekDisabled, true)
    assert.ok(board.diceLabel)
    assert.equal(board.dockPassThrough, 'box-none', 'empty dock area must not intercept the Board Peek return control')
    assert.ok(board.target.width >= 128 && board.target.height >= 68)
    assert.equal(board.tileTargets.length, 18)
    assert.ok(board.tileTargets.every((target: { width: number; height: number }) => target.width >= 48 && target.height >= 48))
  } finally { await server.close() }
})
