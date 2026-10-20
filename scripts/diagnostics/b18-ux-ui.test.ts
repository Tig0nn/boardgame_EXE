import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createMultiCourseGame} from '../../src/game/new-game.ts'

test('beginner course disclosure, factual result feedback and ended-vs-running saved game labels',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-b18-ux-test',plugins:[react(),{
    name:'b18-ux-ui',resolveId(id){if(id==='virtual:b18-ux-ui')return '\0b18-ux-ui'},load(id){if(id==='\0b18-ux-ui')return `
      import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
      import {CourseChoices} from '/src/components/CourseChoices.tsx';import {GameResultModal} from '/mobile_app/src/components/GameResultModal.tsx';import {GameSetup} from '/mobile_app/src/components/GameSetup.tsx';
      export const render=(name,game)=>renderToStaticMarkup(createElement({CourseChoices,GameResultModal,GameSetup}[name],{game,saved:game,onRestore(){},onStart(){},onChoose(){},onHelp(){},onRestart(){},onExport(){}}));
    `},
  }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
  try{
    const {render}=await server.ssrLoadModule('virtual:b18-ux-ui')
    const s=createMultiCourseGame('DISCLOSURE'),html=render('CourseChoices',{...s,phase:'event',eventId:'course',position:4})
    assert.equal((html.match(/class="course-projection"/g)??[]).length,2)
    assert.doesNotMatch(html,/class="course-projection" open/)
    assert.match(html,/<summary>Xem thu nhập còn lại<\/summary>/)
    const initial=html.replace(/<details[\s\S]*?<\/details>/g,'')
    assert.match(initial,/6\.000\.000/);assert.match(initial,/10\.000\.000/);assert.match(initial,/Mua khóa cơ bản/);assert.match(initial,/Bỏ qua/)
    assert.doesNotMatch(initial,/Thu nhập còn lại − học phí|Số lần qua ô Xuất phát còn lại|chi phí cơ hội/)
    const done=JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString()).state
    const result=render('GameResultModal',done)
    assert.match(result,/data-financial-fact="courses"/);assert.match(result,/16\.000\.000/)
    assert.match(result,/data-financial-fact="trading"/);assert.match(result,/AI Coach · Tùy chọn/)
    assert.ok(result.indexOf('data-financial-fact')<result.indexOf('AI Coach'))
    assert.match(render('GameSetup',done),/Xem lại ván B18 đã kết thúc/)
    assert.doesNotMatch(render('GameSetup',done),/Tiếp tục ván B18/)
    assert.match(render('GameSetup',s),/Tiếp tục ván B18 · Vòng 1\/4/)
  }finally{await server.close()}
})
