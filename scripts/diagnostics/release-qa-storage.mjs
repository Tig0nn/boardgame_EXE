import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gunzipSync,gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const out='docs/playtests/b18-release-qa/storage';mkdirSync(out,{recursive:true})
const urls={mobile:'https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app',desktop:'https://boardgame-r8ukc7g79-tris-projects-2888207c.vercel.app'}
const b=await chromium.launch({headless:true,executablePath:'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const checks=[],issues=[],errors=[]
const stored=p=>p.evaluate(()=>localStorage.getItem('xvtl:mobile:game:v1'))
const bytes=path=>path.endsWith('.gz')?gunzipSync(readFileSync(path)):readFileSync(path)
async function shot(p,label){await p.screenshot({path:`${out}/${label}.png`});writeFileSync(`${out}/${label}.txt`,await p.locator('body').innerText())}
async function download(p,button,label){const promise=p.waitForEvent('download');await button.click();const d=await promise,stream=await d.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const buffer=Buffer.concat(chunks);writeFileSync(`${out}/${label}.json.gz`,gzipSync(buffer));return JSON.parse(buffer)}
async function fresh(kind='mobile'){
 const c=await b.newContext({viewport:{width:kind==='mobile'?390:1440,height:844}}),p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push({kind,error:e.message}));return {c,p}
}
try{
 // A natural Desktop deposit, exported before reload as evidence, not a synthetic fixture.
 {
  const {c,p}=await fresh('desktop');await c.tracing.start({screenshots:true,snapshots:true})
  try{
   await p.goto(urls.desktop,{waitUntil:'domcontentloaded'});await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#seed').fill('LANG-0');await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
   await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(650);await p.locator('#trade-amount').fill('6000000');await p.getByRole('button',{name:/Xác nhận gửi khoản mới/}).click()
   await p.locator('.game-tools').getByRole('button',{name:'Nhật ký',exact:true}).click();const d=await download(p,p.getByRole('button',{name:'Tải nhật ký JSON',exact:true}),'desktop-before-reload')
   assert.equal(d.state.deposits.length,1);assert.equal(d.state.deposits[0].principal,6e6);await p.getByRole('button',{name:'Đóng',exact:true}).click();await shot(p,'desktop-transaction-before-reload')
   await p.reload();await shot(p,'desktop-after-reload')
   const setup=await p.locator('#seed').count(),resume=await p.getByRole('button',{name:/Tiếp tục ván|Xem lại ván/}).count(),importer=await p.locator('input[type="file"]').count()
   const persisted=await stored(p)
   checks.push({label:'desktop-reload',setupReturned:setup===0?await p.getByText('Tùy chỉnh hành trang',{exact:false}).count()>0:true,resumeControls:resume,importControls:importer,storedGame:persisted!==null,completedDeposit:6e6,exportedLog:true})
   if(!persisted&&!resume)issues.push({id:'RQA-01',severity:'P0',label:'Desktop loses natural in-progress game on reload',url:urls.desktop,seed:'LANG-0',reproduction:'Start > advance > roll 6 to Bank > deposit 6M > reload. Setup returns with no resume or import.',source:'src/App.tsx holds game only in React state; Desktop Setup has no restore/import route.',backup:'JSON can be downloaded before leaving; importing it is available on Mobile, not Desktop.'})
  }catch(e){issues.push({label:'desktop-storage-check',error:String(e)});await shot(p,'desktop-storage-FAILURE')}
  finally{await c.tracing.stop({path:`${out}/desktop-reload-trace.zip`}).catch(()=>{});await c.close()}
 }
 // Import genuine archived sessions through the public file picker, never localStorage injection.
 const fixtures=[
  ['schema4-c20','docs/playtests/a-log.json'],
  ['schema5-c20','docs/playtests/atomic-investments-v24/browser-game-log.json.gz'],
  ['schema6-b18','docs/playtests/core-mvp-b18/browser-390-savings.json.gz'],
  ['schema7-multi','docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz'],
  ['credit-delayed','docs/playtests/b18-terminology/delayed-checkpoint.json'],
  ['credit-defaulted','docs/playtests/b18-terminology/defaulted-checkpoint.json'],
  ['funding-savings','docs/playtests/core-mvp-b18/browser-funding-savings.json.gz'],
  ['funding-debt','docs/playtests/core-mvp-b18/browser-funding-debt.json.gz'],
  ['unsold-business','docs/playtests/core-mvp-b18-multi-course/frozen-holdout-novice.json.gz'],
  ['desktop-to-mobile-manual','docs/playtests/b18-release-qa/storage/desktop-before-reload.json.gz'],
 ]
 for(const [name,path]of fixtures){const {c,p}=await fresh();try{
  await p.goto(urls.mobile,{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await p.getByText('Mở ván đã lưu',{exact:true}).click();const original=JSON.parse(bytes(path))
  await p.locator('#saved-game-file').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer:bytes(path)})
  await p.waitForFunction(()=>localStorage.getItem('xvtl:mobile:game:v1')!==null);const raw=await stored(p),s=JSON.parse(raw).state
  assert.equal(s.seed,original.state.seed);assert.equal(s.phase,original.state.phase);assert.deepEqual(s.portfolio,original.state.portfolio);assert.equal(s.log.length,original.state.log.length)
  await shot(p,`${name}-imported`)
  if(name==='unsold-business'){assert.ok(s.portfolio.business>0);await p.getByText('Chi tiết kết quả & nhật ký',{exact:true}).click();await shot(p,`${name}-excluded-from-goal`)}
  if(name.startsWith('credit-')){await p.getByText('Chi tiết các khoản trái phiếu',{exact:true}).click();await shot(p,`${name}-details`)}
  await p.reload();await p.getByRole('button',{name:original.state.phase==='finished'?/Xem lại ván .* đã kết thúc/:/Tiếp tục ván/}).click();await p.waitForTimeout(400);assert.equal(await stored(p),raw)
  checks.push({label:name,importedThroughUi:true,fixture:path,schema:original.schemaVersion,phase:s.phase,reloadExact:true,naturalFullGame:false})
 }catch(e){issues.push({label:name,error:String(e)});await shot(p,`${name}-FAILURE`)}finally{await c.close()}}
 // Bad import does not create a game, including schema/profile mismatch.
 {const {c,p}=await fresh();try{
  await p.goto(urls.mobile,{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await p.getByText('Mở ván đã lưu',{exact:true}).click()
  for(const [name,buffer]of [['malformed',Buffer.from('{invalid')],['unsupported',Buffer.from(JSON.stringify({schemaVersion:99,state:{log:[]}}))]]){
   await p.locator('#saved-game-file').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer});assert.ok((await p.getByRole('alert').innerText()).length>15);assert.equal(await stored(p),null);await shot(p,`import-${name}`);checks.push({label:`import-${name}`,rejected:true,stateCreated:false})
  }
 }finally{await c.close()}}
 // Fault injection changes the Storage API only, never a financial state.
 for(const fault of ['corrupt','quota','read-denied']){const {c,p}=await fresh();try{
  if(fault==='corrupt')await c.addInitScript(()=>localStorage.setItem('xvtl:mobile:game:v1','{invalid'))
  if(fault==='quota')await c.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='xvtl:mobile:game:v1')throw new DOMException('QA quota','QuotaExceededError');return original.call(this,k,v)}})
  if(fault==='read-denied')await c.addInitScript(()=>{Storage.prototype.getItem=function(){throw new DOMException('QA denied','SecurityError')}})
  await p.goto(urls.mobile,{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();assert.equal(await p.getByRole('button',{name:/Tiếp tục ván/}).count(),0)
  if(fault==='quota'){
   await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByText(/Không lưu tự động được/).waitFor();await shot(p,'quota-warning')
   await p.getByRole('button',{name:'Đóng',exact:true}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.getByText(/Không lưu tự động được/).waitFor();await p.getByRole('button',{name:'Đóng',exact:true}).click();await p.getByTitle('Ví Tài Sản',{exact:true}).click()
   await download(p,p.getByRole('button',{name:'Lưu nhật ký / ván chơi',exact:true}),'quota-recovery-export');checks.push({label:'quota',warningVisible:true,canExport:true,stateInjected:false})
  }else{await shot(p,`storage-${fault}`);checks.push({label:fault,appUsable:true,noFalseResume:true,stateInjected:false})}
 }catch(e){issues.push({label:`storage-${fault}`,error:String(e)});await shot(p,`storage-${fault}-FAILURE`)}finally{await c.close()}}
}finally{writeFileSync(`${out}/results.json`,JSON.stringify({checks,issues,errors,realPreview:true,automaticCrossOriginSaveTransfer:false},null,2)+'\n');await b.close()}
console.log(JSON.stringify({checks:checks.length,issues:issues.length,errors:errors.length}))
