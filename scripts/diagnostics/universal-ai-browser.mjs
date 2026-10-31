import {createCoreMvpGame} from '../../src/game/new-game.ts'
import {continueFixtureGame} from '../../tests/helpers/companion.ts'
import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve,sep} from 'node:path'
import {encounter,phaseState} from '../../tests/helpers/universal.ts'
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright')
import {saveGameLocally} from '../../src/game/saved-game.ts'
const qa=resolve(process.env.UNIVERSAL_QA_DIR||'node_modules/.tmp/b18-universal-20261030');assert(qa.startsWith(resolve('node_modules/.tmp')+sep));mkdirSync(qa,{recursive:true})
const host=`import React from 'react';import{createRoot}from'react-dom/client';import{GamePhase}from'/mobile_app/src/components/GamePhase.tsx';import{createMobileSession}from'/mobile_app/src/game/session.ts';import{universalAiFeature}from'/mobile_app/src/game/universal-ai-feature.ts';import'/mobile_app/src/index.css';let root,session,epoch=0,actions=0;function makeSession(game){const base=createMobileSession(game),listeners=new Set();let current=base.getSnapshot();base.subscribe(()=>{current=base.getSnapshot();listeners.forEach(fn=>fn())});return{getSnapshot:()=>current,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},dispatch:base.dispatch,change(){current={...current,portfolio:{...current.portfolio,cash:current.portfolio.cash-1}};listeners.forEach(fn=>fn());render()}}}function render(){root.render(React.createElement(React.StrictMode,null,React.createElement(GamePhase,{key:epoch,game:session.getSnapshot(),session,send(cmd){actions++;const ok=session.dispatch(cmd,session.getSnapshot());render();return ok},onRestart(){},onHome(){}})))}window.universalHost={mount(game){session=makeSession(game);root=createRoot(document.getElementById('root'));render()},replace(game){session=makeSession(game);epoch++;render()},change(){session.change()},disable(){universalAiFeature.setEnabled(false)},snapshot(){return session.getSnapshot()},actions(){return actions},unmount(){root.unmount()}};`
const server=await createServer({configFile:false,root:resolve('.'),envDir:resolve(qa,'no-env'),publicDir:resolve('mobile_app/public'),resolve:{dedupe:['react','react-dom']},plugins:[{name:'universal-test-host',resolveId(id){if(id==='/universal-host.js')return '/__universal_host.js'},load(id){if(id==='/__universal_host.js')return host},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/universal-host.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/universal-host.html','<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/universal-host.js"></script></body></html>'))}else next()})}},react()],server:{host:'127.0.0.1',port:5188,strictPort:true,hmr:false}})
await server.listen()
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH})
function coreCourse(){for(let seed=0;seed<100;seed++){let s=createCoreMvpGame('universal-core-'+seed,0);for(let i=0;i<200&&s.phase!=='finished';i++){if(s.phase==='event'&&s.eventId==='course')return s;if(s.phase==='funding')break;s=continueFixtureGame(s)}}throw Error('Missing natural core course')}
const phase=process.env.UNIVERSAL_PHASE||'A'
const results=[],errors=[],network=[],decision=p=>p.getByRole('tab',{name:'Quyết định',exact:true}),ai=p=>p.getByRole('tab',{name:'✨ Hỏi AI',exact:true}),input=p=>p.getByLabel('Bạn muốn hiểu điều gì?',{exact:true})
async function run(name,fn,width=390){const p=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push({name,error:e.message}));p.on('request',r=>{if(/\/api\/|generativelanguage/.test(r.url()))network.push(r.url())});await p.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());try{await fn(p);results.push({name,passed:true});console.log('PASS',name)}catch(e){results.push({name,passed:false,error:e.stack});throw e}finally{await p.close()}}
async function mount(p,state,query='?universalAi=1'){await p.goto('http://127.0.0.1:5188/universal-host.html'+query);await p.waitForFunction(()=>!!window.universalHost);await p.evaluate(s=>window.universalHost.mount(s),state)}
async function ask(p,q){await input(p).fill(q);await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await p.locator('.gameplay-result h3').waitFor()}
try{
 for(const id of (phase==='FLOW'?[]:phase==='ALL'?['bank','stocks','bonds','gold','business','course','course-core','repair','medical','family','credit-tightening','demand-boom','supply-recovery','forecast','rolling','funding','summary','rebalancing']:phase==='C'?['forecast','rolling','funding','summary','rebalancing']:phase==='B'?['repair','medical','family','credit-tightening','demand-boom','supply-recovery']:['bank','stocks','bonds','gold','business','course']))await run(`${phase} ${id}: actual rendering path, grounded, tabs preserve inputs and state`,async p=>{
  const state=['forecast','rolling','funding','summary','rebalancing'].includes(id)?phaseState(id):id==='course-core'?coreCourse():encounter(id);await mount(p,state);await decision(p).waitFor();assert.equal(await decision(p).getAttribute('aria-selected'),'true');const before=await p.evaluate(()=>JSON.stringify(window.universalHost.snapshot()));await ai(p).click();assert.equal(await p.locator('.gameplay-ai').getAttribute('data-domain'),['repair','medical','family'].includes(id)?'personal':['credit-tightening','demand-boom','supply-recovery'].includes(id)?'macro':id==='rolling'?'overview':id==='course-core'?'course':id);await p.locator('.gameplay-samples button').first().click();await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await p.locator('.gameplay-reflection').waitFor();if(id==='course-core'){await p.getByText('Tham gia khóa học',{exact:true}).waitFor();assert.equal(await p.locator('.gameplay-samples').getByText('Hai khóa học khác nhau thế nào?',{exact:true}).count(),0)}const answer=await p.locator('.gameplay-result').innerText();assert.equal(await p.locator('.gamified-modal-backdrop').count(),id==='rolling'?0:1);await decision(p).click();await ai(p).click();assert.equal(await p.locator('.gameplay-result').innerText(),answer);assert.equal(await p.evaluate(()=>JSON.stringify(window.universalHost.snapshot())),before);assert.equal(await p.evaluate(()=>window.universalHost.actions()),0);await p.screenshot({animations:'disabled',path:resolve(qa,`${phase}-${id}-answered.png`)})
 })
 await run('OFF no universal entry',async p=>{await mount(p,encounter('gold'),'');await p.getByRole('heading',{name:'Vàng',exact:true}).waitFor();assert.equal(await p.getByRole('tab').count(),0)})
 await run('honest fallback and no invented facts',async p=>{await mount(p,encounter('gold'));await ai(p).click();await ask(p,'Ngày mai giá vàng bao nhiêu?');assert.match(await p.locator('.gameplay-result').innerText(),/Không thể biết/);assert.equal(await p.locator('.gameplay-fact').count(),0);assert.equal(await p.locator('.gameplay-reflection').count(),0)})

 if(phase==='ALL'||phase==='FLOW'){
 if(phase==='ALL'){
  await run('review: missing macro evidence hides the AI entry',async p=>{
   const state=encounter('credit-tightening');state.log=[];await mount(p,state);await p.locator('.gamified-modal-backdrop').waitFor();assert.equal(await p.getByRole('tab').count(),0);assert.equal(await p.evaluate(()=>window.universalHost.actions()),0)
  })
  await run('review: advertised samples answer without holdings and gold sale quote stays honest',async p=>{
   for(const domain of ['stocks','gold','rebalancing']){
    await mount(p,domain==='rebalancing'?phaseState(domain):encounter(domain));await ai(p).click()
    for(let index=0;index<3;index++){await p.locator('.gameplay-samples button').nth(index).click();await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await p.locator('.gameplay-reflection').waitFor();assert.equal(await p.locator('.gameplay-fact').count()>0,true)}
    if(domain==='gold'){await ask(p,'Báo giá bán vàng hiện tại');assert.equal(await p.locator('.gameplay-reflection').count(),0);assert.match(await p.locator('.gameplay-result').innerText(),/Chưa có tài sản/)}
   }
  })
  async function slow(p){await p.addInitScript(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{await new Promise(r=>setTimeout(r,120));return digest(...args)}})}
  async function startAsk(p,q='Vàng trong game hoạt động thế nào?'){await ai(p).click();await input(p).fill(q);await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click()}
  await run('StrictMode one request; keyboard tabs; retained trade input',async p=>{
   await p.addInitScript(()=>{window.requestIds=0;const uuid=crypto.randomUUID.bind(crypto);crypto.randomUUID=()=>{window.requestIds++;return uuid()}})
   await mount(p,encounter('bank'));await decision(p).waitFor();const field=p.locator('#mobile-bank-amount');await field.fill('1234567');const inputBefore=await field.inputValue();const before=await p.evaluate(()=>window.requestIds)
   await decision(p).focus();await p.keyboard.press('ArrowRight');assert.equal(await ai(p).getAttribute('aria-selected'),'true');assert.equal(await ai(p).evaluate(e=>e===document.activeElement),true)
   await p.locator('.gameplay-samples button').first().click();await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await p.locator('.gameplay-reflection').waitFor();assert.equal(await p.evaluate(()=>window.requestIds)-before,1)
   await input(p).focus();await p.keyboard.press('Escape');assert.equal(await decision(p).evaluate(e=>e===document.activeElement),true);assert.equal(await field.inputValue(),inputBefore);assert.equal(await p.evaluate(()=>window.universalHost.actions()),0)
  })
  await run('snapshot change while Decision selected clears answer',async p=>{
   await mount(p,encounter('gold'));await startAsk(p);await p.locator('.gameplay-reflection').waitFor();await decision(p).click();await p.evaluate(()=>window.universalHost.change());await ai(p).click();assert.equal(await input(p).inputValue(),'');assert.equal(await p.locator('.gameplay-reflection').count(),0)
  })
  for(const event of ['edit','snapshot','disable','unmount','new-session'])await run('pending '+event+' rejects old answer',async p=>{
   await slow(p);await mount(p,encounter('gold'));await startAsk(p);await p.getByRole('status').waitFor()
   if(event==='edit')await input(p).fill('Vàng có rủi ro gì?')
   if(event==='snapshot'){await decision(p).click();await p.evaluate(()=>window.universalHost.change())}
   if(event==='disable')await p.getByRole('button',{name:'Tắt AI ở phiên này',exact:true}).click()
   if(event==='unmount')await p.evaluate(()=>window.universalHost.unmount())
   if(event==='new-session')await p.evaluate(s=>window.universalHost.replace(s),encounter('gold'))
   await p.waitForTimeout(950);assert.equal(await p.locator('.gameplay-reflection').count(),0)
   if(event==='disable')assert.equal(await p.getByRole('tab').count(),0)
   if(event==='new-session'){assert.equal(await decision(p).getAttribute('aria-selected'),'true');await ai(p).click();assert.equal(await input(p).inputValue(),'')}
  })
  await run('payment while pending enters funding without AI action or stale output',async p=>{
   await slow(p);const poor=encounter('repair');poor.portfolio.cash=0;await mount(p,poor);await ai(p).click();await input(p).fill('So sánh trả ngay và sửa tạm');await p.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click();await decision(p).click();await p.getByRole('button',{name:/^Sửa ngay/i}).click();await p.waitForTimeout(950);assert.equal(await p.evaluate(()=>window.universalHost.snapshot().phase),'funding');assert.equal(await p.evaluate(()=>window.universalHost.actions()),1);await ai(p).click();assert.equal(await p.locator('.gameplay-reflection').count(),0);assert.equal(await p.locator('.gameplay-ai').getAttribute('data-domain'),'funding')
  })
  await run('safe execution error stays distinct from fallback',async p=>{await p.addInitScript(()=>{crypto.subtle.digest=async()=>{throw Error('PRIVATE_KEY_VALUE')}});await mount(p,encounter('gold'));await startAsk(p);await p.getByRole('alert').waitFor();assert.doesNotMatch(await p.getByRole('alert').innerText(),/PRIVATE_KEY_VALUE/);assert(await p.getByRole('button',{name:'← Quay lại Quyết định',exact:true}).isVisible())})
  for(const width of [320,375,390])await run('responsive answered/fallback/keyboard viewport '+width,async p=>{
   await mount(p,encounter('repair'));await decision(p).waitFor();assert.equal(await p.locator('[data-gameplay-cash]').isVisible(),false);await p.screenshot({animations:'disabled',path:resolve(qa,width+'-decision.png')});await ai(p).click();await p.screenshot({animations:'disabled',path:resolve(qa,width+'-ai.png')});await ask(p,'So sánh trả ngay và sửa tạm');await p.locator('.gameplay-reflection').waitFor();await p.screenshot({animations:'disabled',path:resolve(qa,width+'-answered.png')});const before=await p.locator('.gameplay-cash').boundingBox();await p.locator('.gameplay-limitations').scrollIntoViewIfNeeded();assert.equal((await p.locator('.gameplay-cash').boundingBox()).y,before.y);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await ask(p,'Chọn giúp tôi');await p.locator('.gameplay-result h3').scrollIntoViewIfNeeded();await p.screenshot({animations:'disabled',path:resolve(qa,width+'-fallback.png')});await p.setViewportSize({width,height:360});await input(p).focus();await input(p).scrollIntoViewIfNeeded();const back=await p.getByRole('button',{name:'← Quay lại Quyết định',exact:true}).boundingBox();assert(back.y+back.height<=360);await p.screenshot({animations:'disabled',path:resolve(qa,width+'-keyboard-viewport.png')})
  },width)
 }
  await run('actual App Entrance → Map → repair AI → payment → Map continuation',async p=>{
   let save='';assert(saveGameLocally(encounter('repair'),{setItem(_key,v){save=v}}));await p.addInitScript(save=>{localStorage.setItem('xvtl:mobile:game:v1',save);localStorage.setItem('xvtl:mobile:tutorial:v1','seen')},save)
   await p.goto('http://127.0.0.1:5188/tests/browser/repair-ai.html?app=1&universalAi=1');await p.getByRole('button',{name:'Bắt đầu phiêu lưu'}).click();await p.getByTestId('map-node-1.1').click();await ai(p).click();await ask(p,'So sánh trả ngay và sửa tạm');await p.locator('.gameplay-reflection').waitFor();await p.screenshot({animations:'disabled',path:resolve(qa,'actual-app-answer.png')});await decision(p).click();await p.getByRole('button',{name:/^Sửa ngay/i}).click();await p.getByRole('button',{name:'Quay lại Bản đồ',exact:true}).click();await p.locator('.map-screen-root').waitFor();await p.screenshot({animations:'disabled',path:resolve(qa,'actual-app-map.png')});await p.getByTestId('map-node-1.1').click();assert.equal(await p.locator('.gameplay-reflection').count(),0);for(const width of [320,375,390]){
    await p.setViewportSize({width,height:844});await p.waitForTimeout(120)
    for(const name of ['Lắc Xúc Xắc','Túi Đồ','Sổ Tay']){
     const button=p.getByRole('button',{name,exact:true}),box=await button.boundingBox();assert(box);assert.equal(await button.isEnabled(),true)
     assert(await p.evaluate(({x,y,name})=>document.elementFromPoint(x,y)?.closest('button')?.getAttribute('aria-label')===name,{x:box.x+box.width/2,y:box.y+box.height/2,name}), 'AI overview intercepts '+name+' at '+width)
    }
    await p.screenshot({animations:'disabled',path:resolve(qa,'actual-app-rolling-'+width+'.png')})
   }
  })
 }

 assert.deepEqual(errors,[]);assert.deepEqual(network,[])
}finally{writeFileSync(resolve(qa,`${phase}-browser-results.json`),JSON.stringify({results,errors,network,physicalKeyboard:'NOT TESTED'},null,2));await browser.close();await server.close()}