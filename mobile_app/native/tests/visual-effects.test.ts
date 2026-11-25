import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('native visual effects settle, pause, release resources and never dispatch gameplay', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    resolve: { dedupe: ['react'] }, ssr: { noExternal: ['three', 'react-native', '@react-three/fiber'] },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{ name: 'visual-effects-device-host', enforce: 'pre', resolveId(id) {
      if (['react-native', '@react-three/fiber/native', 'virtual:effects'].includes(id)) return '\0' + id
    }, load(id) {
      if (id === '\0react-native') return `
        export const View='view',StyleSheet={absoluteFill:{}}
        const motions=new Set(),apps=new Set();export const stats={started:0,stopped:0}
        export const AppState={currentState:'active',addEventListener(_,fn){apps.add(fn);return{remove(){apps.delete(fn)}}}}
        export const AccessibilityInfo={isReduceMotionEnabled:async()=>false,addEventListener(_,fn){motions.add(fn);return{remove(){motions.delete(fn)}}}}
        export const reduce=value=>motions.forEach(fn=>fn(value)),background=()=>apps.forEach(fn=>fn('background'))
        export const listeners=()=>motions.size+apps.size
        class Value{setValue(){}interpolate(){return 0}}
        export const Animated={Value,View:'particle',timing:()=>({}),loop:()=>({start(){stats.started++},stop(){stats.stopped++}})}
      `
      if (id === '\0@react-three/fiber/native') return `
        import{useEffect}from'react'
        export const Canvas='canvas',stats={frames:0};const frames=new Set()
        const state={invalidate(){stats.frames++}}
        export const useThree=selector=>selector(state)
        export const useFrame=callback=>useEffect(()=>{frames.add(callback);return()=>frames.delete(callback)},[callback])
        export const step=()=>frames.forEach(fn=>fn({},1/60))
      `
      if (id === '\0virtual:effects') return `
        import{createElement}from'react';import{create,act}from'react-test-renderer';import{Group}from'three'
        import{DiceScene,Dice3D}from'/src/dice-3d.tsx';import{ResultParticles}from'/src/result-particles.tsx'
        import{step,stats as frameStats}from'@react-three/fiber/native'
        import{reduce,background,stats,listeners}from'react-native'
        globalThis.IS_REACT_ACT_ENVIRONMENT=true
        export async function dice(){
          let screen,disposals=0;const group=new Group()
          const props={value:6,rollSequence:1,motion:true}
          await act(async()=>{screen=create(createElement(DiceScene,props),{createNodeMock:n=>n.type==='group'?group:null})})
          const topCount=screen.root.findByProps({name:'die-face-top'}).findAllByType('mesh').length
          const geometry=screen.root.findByType('primitive').props.object
          geometry.addEventListener('dispose',()=>disposals++)
          const initial=group.rotation.toArray().slice(0,3)
          await act(async()=>screen.update(createElement(DiceScene,{...props,rollSequence:2})))
          step();const spinning=group.rotation.toArray().slice(0,3)
          for(let i=0;i<60;i++)step()
          const settled=group.rotation.toArray().slice(0,3),before=frameStats.frames
          for(let i=0;i<60;i++)step()
          const idle=frameStats.frames===before
          await act(async()=>screen.update(createElement(DiceScene,{...props,rollSequence:3,motion:false})))
          const reduced=group.rotation.toArray().slice(0,3)
          await act(async()=>screen.unmount())
          await act(async()=>{screen=create(createElement(Dice3D,{...props,value:0}))})
          const noInventedRoll=screen.toJSON()===null
          await act(async()=>screen.unmount())
          return{topCount,initial,spinning,settled,idle,reduced,disposals,noInventedRoll}
        }
        export async function result(){
          let screen
          await act(async()=>{screen=create(createElement(ResultParticles,{won:true}))})
          const victory=screen.root.findAllByType('particle').length
          const passive=screen.root.findByType('view').props.pointerEvents
          await act(async()=>reduce(true))
          const reduced=screen.root.findAllByType('particle').length
          await act(async()=>reduce(false))
          await act(async()=>screen.update(createElement(ResultParticles,{won:false})))
          const defeat=screen.root.findAllByType('particle').length
          await act(async()=>background())
          const paused=screen.root.findAllByType('particle').length
          await act(async()=>screen.unmount())
          return{victory,defeat,passive,reduced,paused,started:stats.started,stopped:stats.stopped,listeners:listeners()}
        }
      `
    } }],
  })
  try {
    const effects = await server.ssrLoadModule('virtual:effects')
    const die = await effects.dice()
    assert.equal(die.topCount, 6)
    assert.deepEqual(die.initial, [0, 0, 0], 'cold restore shows a settled die')
    assert.notDeepEqual(die.spinning, die.initial, 'an equal roll with a new sequence still animates')
    assert.deepEqual(die.settled, [0, 0, 0])
    assert.ok(die.idle, 'no further frame invalidations after settling')
    assert.deepEqual(die.reduced, [0, 0, 0])
    assert.equal(die.disposals, 1)
    assert.ok(die.noInventedRoll)
    const particles = await effects.result()
    assert.equal(particles.victory, 24)
    assert.equal(particles.defeat, 24)
    assert.equal(particles.passive, 'none')
    assert.equal(particles.reduced, 0)
    assert.equal(particles.paused, 0)
    assert.equal(particles.started, particles.stopped)
    assert.equal(particles.listeners, 0)
  } finally { await server.close() }
})
