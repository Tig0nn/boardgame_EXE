import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createCoreMvpGame } from '../../src/game/new-game.ts'
import { boardFor } from '../../src/data/board.ts'
import { decide,transact } from '../../src/game/engine.ts'

test('B18 shared goal, setup, board and completed course render without legacy target or20-tile art',async()=>{
  const server=await createServer({configFile:false,plugins:[react(),{name:'b18-ui',resolveId(id){if(id==='virtual:b18-ui')return '\0b18-ui'},load(id){if(id==='\0b18-ui')return `
    import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
    import {GoalChecks} from '/src/components/GoalChecks.tsx';import {GameSetup} from '/mobile_app/src/components/GameSetup.tsx';
    import {CoreMvpBoard} from '/mobile_app/src/components/CoreMvpBoard.tsx';import {EventModal} from '/mobile_app/src/components/EventModal.tsx';import {GameResultModal} from '/mobile_app/src/components/GameResultModal.tsx';
    export const render=(name,game)=>renderToStaticMarkup(createElement({GoalChecks,GameSetup,CoreMvpBoard,EventModal,GameResultModal}[name],{game,onHelp(){},onClose(){},onStart(){},onChoose(){},onTransaction(){},onRestart(){},onExport(){}}));
  `}}],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
  try{
    const {render}=await server.ssrLoadModule('virtual:b18-ui'),s=createCoreMvpGame('UI',0)
    const setup=render('GameSetup',s),goal=render('GoalChecks',s),board=render('CoreMvpBoard',s)
    assert.match(setup,/value="0"/);assert.match(setup,/18 Ô/);assert.match(goal,/90\.000\.000/)
    assert.doesNotMatch(goal,/80\.000\.000|Hai điều kiện|Món đồ/)
    assert.equal((board.match(/data-b18-tile=/g)??[]).length,18);assert.doesNotMatch(board,/playboard\.PNG|sectionplay/)
    const course=decide({...s,phase:'event',eventId:'course',position:4},'upgrade')
    const done=render('EventModal',{...course,turn:2,phase:'event',eventId:'course',position:7})
    assert.match(done,/hoàn thành khóa học/);assert.doesNotMatch(done,/Tham gia khóa học|disabled/)
    const stocks=transact({...s,phase:'event',eventId:'stocks',position:10},{kind:'buy',asset:'stocks',amount:2e6})
    const html=render('EventModal',{...stocks,turn:2,phase:'event',eventId:'stocks',position:13})
    assert.match(html,/>Mua</);assert.match(html,/>Bán</);assert.match(html,/Bỏ qua cơ hội/)
    assert.deepEqual(boardFor(s).map(t=>t.index),Array.from({length:18},(_,i)=>i))
  }finally{await server.close()}
})
