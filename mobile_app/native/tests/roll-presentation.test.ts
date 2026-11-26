import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('roll presentation gates only the view, never the canonical mutation', async t => {
  const host = ['react-native', 'react-native-safe-area-context', 'expo-image', 'expo-linear-gradient', 'expo-crypto', 'expo-haptics', '@react-native-async-storage/async-storage']
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    ssr: { noExternal: host }, resolve: { dedupe: ['react'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{ name: 'roll-presentation-host', enforce: 'pre', resolveId(id, importer) {
      if (id === 'fixture:new-game') return fileURLToPath(new URL('../../../src/game/new-game.ts', import.meta.url))
      if (id === 'fixture:session') return fileURLToPath(new URL('../../src/game/session.ts', import.meta.url))
      if (id === 'virtual:roll' || host.includes(id)) return '\0' + id
      if (id === './assets' || id === './ui' || id === './coach-and-what-if') return '\0' + id
      if (importer?.endsWith('/src/game.tsx') && id === './board') return '\0board'
    }, load(id) {
      if (id === '\0react-native') return `
        export const View='view',TextInput='input',Pressable='button',ScrollView='scroll',useWindowDimensions=()=>({width:384,height:824}),StyleSheet={create:x=>x}
        const apps=new Set(),motions=new Set();let reduced=false
        export const AppState={currentState:'active',addEventListener(_,fn){apps.add(fn);return{remove(){apps.delete(fn)}}}}
        export const AccessibilityInfo={isReduceMotionEnabled:async()=>reduced,addEventListener(_,fn){motions.add(fn);return{remove(){motions.delete(fn)}}}}
        export const app=state=>{AppState.currentState=state;apps.forEach(fn=>fn(state))}
        export const reduce=value=>{reduced=value;motions.forEach(fn=>fn(value))}
        export const listeners=()=>apps.size+motions.size
        export const BackHandler={addEventListener:()=>({remove(){}})}
      `
      if (id === '\0react-native-safe-area-context') return "export const useSafeAreaInsets=()=>({top:0,bottom:0,left:0,right:0})"
      if (id === '\0expo-image') return "export const Image='image'"
      if (id === '\0expo-linear-gradient') return "export const LinearGradient='gradient'"
      if (id === '\0expo-crypto') return "export const randomUUID=()=> 'fixture'"
      if (id === '\0expo-haptics') return "export const selectionAsync=async()=>{}"
      if (id === '\0@react-native-async-storage/async-storage') return "let fail=false;export const failNext=()=>{fail=true};export default {setItem:async()=>{if(fail){fail=false;throw Error('synthetic storage failure')}}}"
      if (id === '\0./assets') return 'export const art={}'
      if (id === '\0./coach-and-what-if') return 'export const CoachPanel=()=>null,PortfolioContent=()=>null,WhatIfContent=()=>null'
      if (id === '\0./ui') return `
        import{createElement}from'react'
        export const Copy='text',Eye='eye',Fox='fox',Action=p=>createElement('button',p)
        export const Panel=p=>createElement('panel',p,p.header,p.children,p.footer)
      `
      if (id === '\0board') return "import{createElement}from'react';export const Board=p=>createElement('board',p)"
      if (id === '\0virtual:roll') return `
        import assert from'node:assert/strict'
        import{createElement}from'react';import{create,act}from'react-test-renderer'
        import{LocalGame,DecisionPanel}from'/src/game.tsx'
        import{createMultiCourseGame}from'fixture:new-game';import{createMobileSession}from'fixture:session'
        import{fromLocal}from'/src/arena-model.ts';import{app,reduce,listeners}from'react-native'
        import{useRollPresentation}from'/src/roll-presentation.ts';import{failNext}from'@react-native-async-storage/async-storage'
        globalThis.IS_REACT_ACT_ENVIRONMENT=true
        export async function fixture(reduced=false){
          await act(async()=>{app('active');reduce(reduced)})
          const controller=createMobileSession(createMultiCourseGame('native-roll-polish',0,1))
          while(controller.getSnapshot().phase!=='rolling'){
            const state=controller.getSnapshot(),arena=fromLocal(state)
            controller.dispatch(arena.fixed[0].command,state)
          }
          const initial=controller.getSnapshot();let screen
          const props={initial,ownerExit(){},restart(){},sound(){},playSound(){}}
          await act(async()=>{screen=create(createElement(LocalGame,props))})
          const board=()=>screen.root.findByType('board').props
          const decision=()=>screen.root.findByType(DecisionPanel).props
          const before=board().arena.journal.filter(entry=>entry.kind==='roll').length
          return {screen,board,decision,before,
            async roll(){await act(async()=>{const press=board().onRoll;press();press()})},
            async complete(id,stage){await act(async()=>board().onPresentationComplete(id,stage))},
            async reduce(value){await act(async()=>reduce(value))},
            async app(state){await act(async()=>app(state))},
            failNext,
            async finishDecision(){
              for(let i=0;board().arena.phase!=='rolling'&&i<12;i++){
                const arena=board().arena,choice=arena.fixed.find(item=>item.skip)??arena.fixed[0]
                assert.ok(choice,'fixture decision must have a canonical fixed choice')
                await act(async()=>decision().confirm(choice.command))
              }
              assert.equal(board().arena.phase,'rolling')
            },
            async restore(){const state=board().arena.local;await act(async()=>screen.unmount());await act(async()=>{screen=create(createElement(LocalGame,{...props,initial:state}))})},
            async close(){await act(async()=>screen.unmount());assert.equal(listeners(),0)},act
          }
        }
        export async function gate(reduced=false){
          await act(async()=>{app('active');reduce(reduced)})
          function Host(props){return createElement('gate',useRollPresentation(props.sequence,props.failed))}
          let screen;await act(async()=>{screen=create(createElement(Host,{sequence:1,failed:false}))})
          return{value:()=>screen.root.findByType('gate').props,
            async update(sequence,failed=false){await act(async()=>screen.update(createElement(Host,{sequence,failed})))},
            async reduce(value){await act(async()=>reduce(value))},
            async app(state){await act(async()=>app(state))},
            async close(){await act(async()=>screen.unmount());assert.equal(listeners(),0)},act}
        }
      `
    } }],
  })
  try {
    const { fixture, gate } = await server.ssrLoadModule('virtual:roll')
    await t.test('S22 regression: Reduce Motion already ON permits two canonical rolls without cold start', async () => {
      const f = await fixture(true)
      try {
        for(let i=1;i<=2;i++){
          await f.roll() // double press each time, one accepted roll
          assert.equal(f.board().arena.journal.filter((entry: {kind:string})=>entry.kind==='roll').length,f.before+i)
          assert.equal(f.board().arena.dice,f.board().arena.local.dice)
          assert.equal(f.board().presentation,null)
          assert.equal(f.decision().visible,true)
          await f.finishDecision()
        }
      } finally {await f.close()}
    })
    await t.test('one roll commits once; dice then pawn complete before the modal appears', async () => {
      const f = await fixture()
      try {
        await f.roll()
        const state = JSON.stringify(f.board().arena.local)
        assert.equal(f.board().arena.journal.filter((entry: { kind: string }) => entry.kind === 'roll').length, f.before + 1)
        assert.equal(f.board().presentation?.stage, 'dice')
        assert.equal(f.decision().visible, false, 'the decision must not cover the tumble')
        assert.equal(f.board().blocked, true)
        const id = f.board().presentation.id
        await f.complete(id, 'pawn') // out-of-order callback must not unlock
        assert.equal(f.board().presentation.stage, 'dice')
        await f.complete(id, 'dice')
        assert.equal(f.board().presentation.stage, 'pawn')
        assert.equal(f.decision().visible, false)
        await f.complete(id, 'pawn')
        assert.equal(f.decision().visible, true)
        assert.equal(JSON.stringify(f.board().arena.local), state)
        assert.equal(f.board().arena.dice, f.board().arena.local.dice)
        await f.act(async () => f.decision().onPeek())
        assert.equal(f.decision().visible, false)
        await f.act(async () => f.board().onReturn())
        assert.equal(f.decision().visible, true)
      } finally { await f.close() }
    })
    await t.test('Reduce Motion and background release presentation without re-rolling on resume', async () => {
      for (const interrupt of ['reduce', 'background']) {
        const f = await fixture()
        try {
          await f.roll()
          const state = JSON.stringify(f.board().arena.local)
          if (interrupt === 'reduce') await f.reduce(true)
          else { await f.app('background'); await f.app('active') }
          assert.equal(f.decision().visible, true)
          assert.equal(f.board().presentation, null)
          assert.equal(JSON.stringify(f.board().arena.local), state)
          await f.finishDecision()
          await f.roll()
          assert.equal(f.board().arena.journal.filter((entry: {kind:string})=>entry.kind==='roll').length,f.before+2)
        } finally { await f.close() }
      }
    })
    await t.test('a pending server response stays locked under reduced motion or background, then releases on canonical receipt', async () => {
      for(const mode of ['reduced','background']){
        const g=await gate(mode==='reduced')
        try{
          await g.act(async()=>{assert.equal(g.value().begin(0,1),true)})
          if(mode==='background') await g.app('background')
          assert.equal(g.value().active,true)
          assert.equal(g.value().presentation.stage,'waiting')
          await g.act(async()=>assert.equal(g.value().begin(0,1),false))
          await g.update(2)
          assert.equal(g.value().active,false)
          await g.app('active')
          await g.act(async()=>{assert.equal(g.value().begin(4,2),true);assert.equal(g.value().begin(4,2),false)})
          await g.update(3,true)
          assert.equal(g.value().active,false)
          await g.update(3)
          await g.act(async()=>assert.equal(g.value().begin(6,3),true))
        }finally{await g.close()}
      }
    })
    await t.test('old completion and watchdog cannot release a newer generation; all terminal paths allow another roll', async () => {
      t.mock.timers.enable({apis:['setTimeout']})
      const g=await gate()
      try{
        await g.act(async()=>g.value().begin(0,1));await g.update(2)
        const old=g.value().presentation.id
        await g.act(async()=>t.mock.timers.tick(2400))
        await g.act(async()=>g.value().complete(old,'dice'))
        await g.act(async()=>g.value().complete(old,'pawn'))
        await g.act(async()=>g.value().begin(4,2));await g.update(3)
        const next=g.value().presentation.id
        assert.notEqual(next,old)
        await g.act(async()=>{g.value().complete(old,'pawn');g.value().cancel()})
        await g.act(async()=>g.value().begin(7,3));await g.update(4)
        const current=g.value().presentation.id
        await g.act(async()=>{g.value().complete(old,'dice');g.value().complete(next,'pawn');t.mock.timers.tick(100)})
        assert.equal(g.value().presentation.id,current)
        assert.equal(g.value().presentation.stage,'dice')
        await g.act(async()=>t.mock.timers.tick(2400))
        assert.equal(g.value().presentation,null)
        await g.act(async()=>g.value().begin(9,4));await g.update(5)
        const newest=g.value().presentation.id
        await g.act(async()=>{g.value().complete(current,'dice');g.value().complete(current,'pawn')})
        assert.equal(g.value().presentation.id,newest)
        const lateComplete=g.value().complete,lateBegin=g.value().begin
        await g.close()
        await g.act(async()=>{lateComplete(newest,'dice');t.mock.timers.tick(30_000);assert.equal(lateBegin(0,5),false)})
      }finally{t.mock.timers.reset()}
    })
    await t.test('cold restore at a decision never replays the previous animation', async () => {
      const f = await fixture()
      try {
        await f.roll(); await f.restore()
        assert.equal(f.board().presentation, null)
        assert.equal(f.decision().visible, true)
      } finally { await f.close() }
    })
    await t.test('slow response is not a presentation timer; failure and retry do not replay or send a roll', async () => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const g = await gate()
      try {
        await g.act(async () => { assert.equal(g.value().begin(4, 1), true); assert.equal(g.value().begin(4, 1), false) })
        assert.equal(g.value().presentation.stage, 'waiting')
        await g.act(async () => t.mock.timers.tick(30_000))
        assert.equal(g.value().active, true, 'network timeout belongs to the existing client, not this watchdog')
        await g.update(1, true)
        assert.equal(g.value().active, false)
        await g.update(2)
        assert.equal(g.value().presentation, null, 'recovery response must not replay an unarmed roll')
        await g.act(async () => g.value().begin(5, 2))
        await g.update(3)
        const id = g.value().presentation.id
        await g.act(async () => g.value().complete(id - 1, 'dice'))
        assert.equal(g.value().presentation.stage, 'dice')
        await g.close()
        await g.act(async () => t.mock.timers.tick(30_000))
      } finally { t.mock.timers.reset() }
    })
    await t.test('save failure and retry remain visible rather than being masked by presentation', async () => {
      const f = await fixture()
      try {
        f.failNext(); await f.roll()
        assert.equal(f.board().presentation, null)
        assert.equal(f.decision().visible, true)
        const retry = f.screen.root.findAllByType('button').find((node: { props: { label: string } }) => node.props.label === 'Thử lại')
        assert.ok(retry)
        assert.equal(retry.props.disabled, false)
      } finally { await f.close() }
    })
    await t.test('missing GPU/native completion has a bounded escape and timers clean up on unmount', async () => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      const f = await fixture()
      try {
        await f.roll()
        const state = JSON.stringify(f.board().arena.local)
        await f.act(async () => t.mock.timers.tick(2500))
        assert.equal(f.decision().visible, true)
        assert.equal(f.board().presentation, null)
        assert.equal(JSON.stringify(f.board().arena.local), state)
      } finally { await f.close(); t.mock.timers.reset() }
    })
  } finally { await server.close() }
})
