import {mkdirSync,writeFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const out='docs/playtests/b18-terminology/after';mkdirSync(out,{recursive:true});const errors=[],checks=[]
const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message))
async function shot(name){const d=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(d.scroll<=d.w+1);await p.screenshot({path:`${out}/${name}.png`});checks.push({name,...d})}
async function download(name){const task=p.waitForEvent('download');await p.getByRole('button',{name}).click();const d=await task,stream=await d.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks).toString()}
async function current(){await p.getByRole('button',{name:'Chơi mới',exact:true}).click();const text=await download(/Tải nhật ký hiện tại/);await p.getByRole('button',{name:'Đóng',exact:true}).click();return text}
try{
  await p.goto(process.env.B18_DESKTOP_URL??'http://127.0.0.1:5201',{waitUntil:'domcontentloaded'})
  await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#seed').fill('B18-UI-TRADES')
  await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click()
  const before=await current()
  for(const i of [0,6,10,4,1,2,3,8,5]){
    const tile=p.locator(`[data-tile-index="${i}"]`);await tile.focus();await p.keyboard.press('Enter');await shot(`desktop-tile-${i+1}`)
    await p.keyboard.press('Escape');assert.equal(await tile.evaluate(e=>e===document.activeElement),true)
  }
  assert.equal(await current(),before,'All nine Desktop tile inspections are read-only')
  let complete=false
  for(let step=0;step<150;step++){
    const d=p.locator('dialog[open]').last()
    if(!await d.count()){await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(600);continue}
    if(await d.getByRole('button',{name:/Chơi một hành trình mới/}).count()){complete=true;break}
    const basic=d.getByRole('button',{name:'Mua khóa cơ bản',exact:true}),advanced=d.getByRole('button',{name:'Mua khóa nâng cao',exact:true})
    if(await basic.count()&&await basic.isEnabled())await basic.click()
    else if(await advanced.count()&&await advanced.isEnabled())await advanced.click()
    else if(await d.getByRole('button',{name:/Bắt đầu vòng/}).count())await d.getByRole('button',{name:/Bắt đầu vòng/}).click()
    else if(await d.getByRole('button',{name:/Mở quyền bán tại START/}).count())await d.getByRole('button',{name:/Mở quyền bán tại START/}).click()
    else if(await d.getByRole('button',{name:/Hoàn tất|Xem kết quả|Xem dự báo/}).count())await d.getByRole('button',{name:/Hoàn tất|Xem kết quả|Xem dự báo/}).last().click()
    else await d.getByRole('button',{name:/^Tiếp tục$|^Bỏ qua$|Bỏ qua cơ hội|Đã xem tác động|Thanh toán [345]\./}).first().click()
    await p.waitForTimeout(100)
  }
  assert.ok(complete);await shot('desktop-result-defeat')
  const log=await download(/Tải nhật ký quyết định/),data=JSON.parse(log)
  assert.equal(data.finalResult.won,false);assert.equal(data.finalResult.lawfulProceeds,84e6)
  assert.match(await p.locator('.financial-review').innerText(),/16\.000\.000.*14\.000\.000/)
  writeFileSync(`${out}/browser-desktop-defeat.json.gz`,gzipSync(log))
  assert.deepEqual(errors,[]);writeFileSync(`${out}/desktop-board-verification.json`,JSON.stringify({checks,errors,readOnlyInspection:true,keyboardFocusReturned:true,fullGame:true,result:data.finalResult},null,2)+'\n')
  console.log(JSON.stringify({desktopNineTypes:true,fullDefeatGame:true,errors:errors.length}))
}finally{await b.close()}
