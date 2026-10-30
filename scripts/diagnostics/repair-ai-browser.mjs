import {createServer} from 'vite'
import react from '@vitejs/plugin-react'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {revealedRepair} from '../../tests/helpers/companion.ts'
import {saveGameLocally} from '../../src/game/saved-game.ts'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const qa=resolve('node_modules/.tmp/b18-ai-ui-20261030');mkdirSync(qa,{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})})
const server=process.env.REPAIR_AI_TEST_URL?null:await createServer({configFile:false,root:resolve('.'),envDir:resolve(qa,'no-env'),publicDir:resolve('mobile_app/public'),plugins:[react()],resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:5186,strictPort:true,hmr:false}})
await server?.listen()
const base=process.env.REPAIR_AI_TEST_URL||'http://127.0.0.1:5186/tests/browser/repair-ai.html'
const results=[],errors=[],network=[]
const trigger='✨ Hỏi AI trước khi quyết định'
async function run(name,fn,options={}){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,...options})
 page.on('pageerror',e=>errors.push({name,message:e.message}))
 page.on('request',request=>{if(request.url().includes('/api/')||/generativelanguage/.test(request.url()))network.push(request.url())})
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
 try{await fn(page);results.push({name,passed:true});console.log('PASS',name)}catch(error){results.push({name,passed:false,error:error.message});throw error}finally{await page.close()}
}
async function start(page,query='?repairAi=1') {await page.goto(base+query);await page.getByRole('button',{name:trigger,exact:true}).waitFor()}
async function open(page){await page.getByRole('button',{name:trigger,exact:true}).click();await page.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).waitFor()}
async function ask(page,text){await page.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).fill(text);await page.getByRole('button',{name:'Gửi câu hỏi',exact:true}).click()}
async function slow(page){await page.addInitScript(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{await new Promise(r=>setTimeout(r,200));return digest(...args)}})}
try{
 await run('default OFF has no AI button',async p=>{await p.addInitScript(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined}));await p.goto(base);await p.getByText('Tiền mặt hiện có:').waitFor();assert.equal(await p.getByRole('button',{name:trigger}).count(),0)})
 await run('actual App saved-game restore and supported comparison',async p=>{
  let save='';assert(saveGameLocally(revealedRepair(),{setItem(_key,value){save=value}}))
  await p.addInitScript(save=>{localStorage.setItem('xvtl:mobile:game:v1',save);localStorage.setItem('xvtl:mobile:tutorial:v1','seen')},save)
  await p.goto(base+'?app=1&repairAi=1');await p.getByRole('button',{name:'Bắt đầu phiêu lưu'}).click();await open(p)
  await ask(p,'So sánh trả ngay và sửa tạm');await p.locator('.repair-ai-reflection').waitFor()
  assert.match(await p.locator('.repair-ai-result').innerText(),/3.000.000 đ/)
  assert.equal(await p.locator('.gamified-modal-backdrop').count(),1)
  await p.screenshot({path:resolve(qa,'actual-app-answer-390.png')})
 })
 await run('unsupported is explicit unanswered fallback',async p=>{await start(p);await open(p);await ask(p,'Thu nhập của tôi là bao nhiêu?');await p.getByText('Chưa thể trả lời câu hỏi này',{exact:true}).waitFor();assert.equal(await p.locator('.repair-ai-reflection').count(),0)})
 await run('false free-repair premise is corrected by canonical amounts',async p=>{await start(p);await open(p);await ask(p,'Sửa tạm miễn phí đúng không');await p.locator('.repair-ai-reflection').waitFor();const text=await p.locator('.repair-ai-result').innerText();assert.match(text,/1.000.000 đ/);assert.match(text,/4.000.000 đ/);assert.match(text,/5.000.000 đ/)})
 await run('insufficient cash keeps conditional funding explanation and payment controls',async p=>{await start(p,'?repairAi=1&poor=1');await open(p);await ask(p,'So sánh trả ngay và sửa tạm');await p.locator('.repair-ai-reflection').waitFor();assert.match(await p.locator('.repair-ai-result').innerText(),/Chi phí huy động vốn chưa được tính/);assert.equal(await p.getByRole('button',{name:/^Sửa ngay/i}).count(),1);await p.screenshot({path:resolve(qa,'insufficient-cash.png')})})
 await run('choose payment while local work is pending cancels panel',async p=>{await slow(p);await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.getByRole('status').filter({hasText:'Đang đối chiếu'}).waitFor();await p.getByRole('button',{name:/^Sửa ngay/i}).click();await p.waitForTimeout(1200);assert.equal(await p.locator('.repair-ai-panel').count(),0);assert.equal(await p.locator('.repair-ai-reflection').count(),0)})
 await run('close pending AI restores focus and both original decisions',async p=>{await slow(p);await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.getByRole('button',{name:'← Quay lại quyết định',exact:true}).click();await p.waitForTimeout(1000);assert.equal(await p.locator('.repair-ai-panel').count(),0);assert.equal(await p.getByRole('button',{name:/^Sửa tạm, trả sau/i}).count(),1);assert.equal(await p.getByRole('button',{name:trigger,exact:true}).evaluate(el=>el===document.activeElement),true)})
 await run('disable during loading removes every AI output and trigger',async p=>{await slow(p);await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.getByRole('button',{name:'Tắt AI ở phiên này',exact:true}).click();await p.waitForTimeout(1000);assert.equal(await p.locator('.repair-ai').count(),0);assert.equal(await p.getByRole('button',{name:/^Sửa ngay/i}).count(),1)})
 await run('restart/import replacement cannot render previous session answer',async p=>{await slow(p);await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.getByRole('button',{name:'Test: restart/import session',exact:true}).click();await p.waitForTimeout(1000);assert.equal(await p.locator('.repair-ai-panel').count(),0);await open(p);assert.equal(await p.locator('.repair-ai-reflection').count(),0);assert.equal(await p.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).inputValue(),'')})
 await run('local failure shows only safe error and keeps decision available',async p=>{
  await p.addInitScript(()=>{crypto.subtle.digest=async()=>{throw Error('TEST_PRIVATE_ERROR')}})
  await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.getByRole('alert').waitFor()
  assert.doesNotMatch(await p.locator('.repair-ai-result').innerText(),/TEST_PRIVATE_ERROR/)
  assert.equal(await p.getByRole('button',{name:/^Sửa ngay/i}).count(),1)
 })
 await run('editing question clears visible answer immediately and Escape returns',async p=>{await start(p);await open(p);await ask(p,'Thanh khoản là gì?');await p.locator('.repair-ai-reflection').waitFor();await p.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).fill('Câu hỏi khác');assert.equal(await p.locator('.repair-ai-reflection').count(),0);await p.keyboard.press('Escape');assert.equal(await p.locator('.repair-ai-panel').count(),0)})
 for(const width of [320,768,1440]) await run(`layout keyboard and scroll ${width}px`,async p=>{
  await start(p);await open(p);await ask(p,'So sánh trả ngay và sửa tạm');await p.locator('.repair-ai-reflection').waitFor()
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await p.getByRole('button',{name:/^Sửa ngay/i}).scrollIntoViewIfNeeded();assert(await p.getByRole('button',{name:/^Sửa ngay/i}).isVisible())
  await p.screenshot({path:resolve(qa,`layout-${width}.png`)})
  await p.setViewportSize({width,height:360});await p.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).focus();await p.getByLabel('Bạn muốn hiểu điều gì?',{exact:true}).scrollIntoViewIfNeeded()
  const bounds=await p.locator('.gamified-modal-card').boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=360)
  await p.screenshot({path:resolve(qa,`keyboard-viewport-${width}.png`)})
 },{viewport:{width,height:844}})
 assert.deepEqual(errors,[],'Uncaught browser exceptions');assert.deepEqual(network,[],'No AI/Google network allowed')
}finally{writeFileSync(resolve(qa,'browser-results.json'),JSON.stringify({results,errors,network,virtualKeyboard:'viewport emulation; physical IME not tested'},null,2));await browser.close();await server?.close()}