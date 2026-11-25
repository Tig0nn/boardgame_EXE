import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('local screen saves on entry and waits for storage before exiting', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    ssr: { noExternal: ['react-native', 'expo-image', 'expo-linear-gradient', 'expo-crypto', 'expo-haptics', '@react-native-async-storage/async-storage'] },
    resolve: { dedupe: ['react'] }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false }, appType: 'custom',
    plugins: [{
      name: 'local-game-device-host', enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'fixture:new-game') return fileURLToPath(new URL('../../../src/game/new-game.ts', import.meta.url))
        if (id === 'virtual:local' || ['react-native', 'expo-image', 'expo-linear-gradient', 'expo-crypto', 'expo-haptics', '@react-native-async-storage/async-storage'].includes(id)) return '\0' + id
        if (importer?.includes('/src/') && ['./ui', './assets'].includes(id)) return '\0' + id
        if (importer?.endsWith('/src/game.tsx') && ['./board', './ui', './assets', './coach-and-what-if'].includes(id)) return '\0' + id
      },
      load(id) {
        if (id === '\0react-native') return "export const View='view',TextInput='input',StyleSheet={create:x=>x},BackHandler={addEventListener:()=>({remove(){}})}"
        if (id === '\0expo-image') return "export const Image='image'"
        if (id === '\0expo-linear-gradient') return "export const LinearGradient='gradient'"
        if (id === '\0expo-crypto') return "export const randomUUID=()=> 'fixture'"
        if (id === '\0expo-haptics') return "export const selectionAsync=async()=>{}"
        if (id === '\0./assets') return "export const art={}"
        if (id === '\0./coach-and-what-if') return "export const CoachPanel=()=>null,PortfolioContent=()=>null,WhatIfContent=()=>null"
        if (id === '\0./ui') return `
          import {createElement} from 'react'
          export const Copy='text',Eye='eye',Fox='fox'
          export const Action=p=>createElement('button',p,p.label)
          export const Panel=p=>p.visible===false?null:createElement('panel',{},p.header,p.children)
        `
        if (id === '\0./board') return `
          import {createElement} from 'react'
          export const Board=p=>createElement('button',{label:'Exit local',onPress:p.onHome},'Exit local')
        `
        if (id === '\0@react-native-async-storage/async-storage') return `
          let release,fail=false
          let gate=new Promise(resolve=>{release=resolve})
          export let stored=''
          export const unblock=()=>release()
          export const failNext=()=>{fail=true}
          export default {async setItem(key,payload){await gate;if(fail){fail=false;throw Error('fixture storage failure')}stored=payload}}
        `
        if (id === '\0virtual:local') return `
          import {createElement} from 'react'
          import {create,act} from 'react-test-renderer'
          import {LocalGame} from '/src/game.tsx'
          import {createMultiCourseGame} from 'fixture:new-game'
          import {stored,unblock,failNext} from '@react-native-async-storage/async-storage'
          globalThis.IS_REACT_ACT_ENVIRONMENT=true
          export async function verify(){
            let exits=0,screen
            await act(async()=>{screen=create(createElement(LocalGame,{initial:createMultiCourseGame('local-entry',0,1),
              ownerExit(){exits++},restart(){},sound(){},playSound(){}}))})
            await act(async()=>{screen.root.findAllByType('button').find(n=>n.props.label==='Exit local').props.onPress()})
            const before=exits
            await act(async()=>{unblock()})
            const after=exits
            const save=JSON.parse(stored)
            await act(async()=>screen.unmount())
            failNext()
            await act(async()=>{screen=create(createElement(LocalGame,{initial:createMultiCourseGame('local-failure',0,1),
              ownerExit(){exits++},restart(){},sound(){},playSound(){}}))})
            const retry=screen.root.findAllByType('button').find(n=>n.props.label==='Thử lại')
            const retryVisible=!!retry
            await act(async()=>{retry.props.onPress()})
            const recovered=JSON.parse(stored)
            await act(async()=>screen.unmount())
            return {before,after,schema:save.schemaVersion,seed:save.state.seed,retryVisible,recoveredSeed:recovered.state.seed}
          }
        `
      },
    }],
  })
  try {
    const { verify } = await server.ssrLoadModule('virtual:local')
    const result = await verify()
    assert.deepEqual(result, { before: 0, after: 1, schema: 7, seed: 'local-entry', retryVisible: true, recoveredSeed: 'local-failure' })
  } finally { await server.close() }
})
