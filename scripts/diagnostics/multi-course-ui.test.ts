import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMultiCourseGame, createCoreMvpGame } from '../../src/game/new-game.ts'
import { decide } from '../../src/game/engine.ts'
import type { GameState } from '../../src/game/types.ts'

test('Desktop/Mobile share exact course cards and preserve legacy single-course UI/board',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-multi-course-ui-test',plugins:[react(),{
    name:'multi-course-ui',resolveId(id){if(id==='virtual:multi-course-ui')return '\0multi-course-ui'},load(id){if(id==='\0multi-course-ui')return `
      import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
      import {CourseChoices} from '/src/components/CourseChoices.tsx';import {PhaseDialog} from '/src/components/GameDialogs.tsx';
      import {EventModal} from '/mobile_app/src/components/EventModal.tsx';import {CoreMvpBoard} from '/mobile_app/src/components/CoreMvpBoard.tsx';
      export const render=(name,game)=>renderToStaticMarkup(createElement({CourseChoices,PhaseDialog,EventModal,CoreMvpBoard}[name],{game,onChoose(){}}));
    `},
  }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
  try{
    const {render}=await server.ssrLoadModule('virtual:multi-course-ui')
    const s:GameState={...createMultiCourseGame('SSR'),phase:'event',eventId:'course',position:4}
    const body=render('CourseChoices',s)
    // useId depends on the React tree path; compare shared content after normalizing
    // only generated IDs, leaving every label, amount and action attribute intact.
    const content=(html:string)=>html.replace(/_R_[a-zA-Z0-9]+_/g,'_R_term_')
    for(const name of ['PhaseDialog','EventModal'])assert.ok(content(render(name,s)).includes(content(body)))
    assert.equal((body.match(/<article /g)??[]).length,2)
    assert.match(body,/Khóa cơ bản/);assert.match(body,/Khóa nâng cao/);assert.match(body,/6\.000\.000/);assert.match(body,/10\.000\.000/)
    assert.match(body,/Số lần qua ô Xuất phát còn lại/);assert.match(body,/không phải lợi nhuận bảo đảm/);assert.match(body,/không vay mới/i)
    const poor=render('CourseChoices',{...s,portfolio:{...s.portfolio,cash:0}})
    assert.equal((poor.match(/disabled=""/g)??[]).length,2);assert.equal((poor.match(/Không đủ tiền/g)??[]).length,2)
    const partial=render('CourseChoices',{...s,portfolio:{...s.portfolio,cash:6e6}})
    assert.equal((partial.match(/disabled=""/g)??[]).length,1)
    assert.match(partial,/Mua khóa cơ bản/);assert.match(partial,/Không đủ tiền/)
    const basic=decide(s,'course-basic')
    const basicOnly={...basic,turn:1,position:7,phase:'event' as const,eventId:'course'}
    const basicBefore=JSON.stringify(basicOnly),basicHtml=render('CourseChoices',basicOnly)
    assert.equal((basicHtml.match(/Đã hoàn thành/g)??[]).length,1);assert.match(basicHtml,/Mua khóa nâng cao/)
    assert.equal(JSON.stringify(basicOnly),basicBefore,'Rendering course choices must not change state')
    let learned=decide(s,'course-advanced')
    learned={...learned,turn:1,position:7,phase:'event',eventId:'course'}
    const one=render('CourseChoices',learned);assert.equal((one.match(/Đã hoàn thành/g)??[]).length,1);assert.match(one,/Mua khóa cơ bản/)
    learned=decide(learned,'course-basic')
    const both=render('CourseChoices',{...learned,turn:2,phase:'event',eventId:'course',position:12})
    assert.match(both,/Đã hoàn thành cả hai khóa/);assert.match(both,/20\.000\.000/);assert.doesNotMatch(both,/article|Mua khóa|disabled/)
    assert.match(render('CoreMvpBoard',s),/aria-label="Ô 16: Trái phiếu"/)
    const old=createCoreMvpGame('OLD-UI');assert.match(render('CoreMvpBoard',old),/aria-label="Ô 16: Đầu tư bản thân"/)
    assert.match(render('EventModal',{...old,phase:'event',eventId:'course',position:4}),/Tham gia khóa học 8\.000\.000/)
  }finally{await server.close()}
})
