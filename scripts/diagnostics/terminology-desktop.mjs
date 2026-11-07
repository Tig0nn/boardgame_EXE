import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright')
const out='docs/playtests/b18-terminology/after';mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,...process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}})
const results=[],errors=[],layout=[]
async function shot(page,label){
  const dims=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({width:e.clientWidth,scroll:e.scrollWidth}))}))
  assert.ok(dims.body<=dims.viewport+1);for(const d of dims.dialogs)assert.ok(d.scroll<=d.width+1)
  layout.push({label,...dims});await page.screenshot({path:`${out}/${label}.png`})
}
try{
  for(const poor of [false,true]){
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
    page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.B18_DESKTOP_URL??'http://127.0.0.1:5201',{waitUntil:'domcontentloaded'})
    await page.getByText('Tùy chỉnh hành trang',{exact:false}).click();await page.locator('#seed').fill('TRADING-AB-MAIN-0')
    if(poor){await page.locator('#allocation').fill('50000000');await page.locator('#allocation').dispatchEvent('input')}
    await page.getByRole('button',{name:/Bắt đầu hành trình/}).click()
    const seen=new Set();let finished=false
    for(let step=0;step<150;step++){
      const dialog=page.locator('dialog[open]').last()
      if(!await dialog.count()){
        if(!seen.has('board')){await shot(page,`desktop-${poor?'poor':'game'}-board`);seen.add('board')}
        await page.getByRole('button',{name:/Gieo xúc xắc/}).click();await page.waitForTimeout(600);continue
      }
      if(await dialog.getByText('Đầu tư bản thân',{exact:true}).count()||await dialog.getByText('Đã hoàn thành cả hai khóa',{exact:true}).count()){
        const complete=await dialog.getByText('Đã hoàn thành cả hai khóa',{exact:true}).count()
        const learned=await dialog.getByText('Đã học',{exact:true}).count()
        const name=poor?'insufficient':complete?'both':learned?'one':'unlearned'
        if(!seen.has(name)){await shot(page,`desktop-course-${name}`);seen.add(name)}
        if(poor){for(const name of ['Mua khóa cơ bản','Mua khóa nâng cao'])assert.equal(await dialog.getByRole('button',{name,exact:true}).isEnabled(),false);await dialog.getByRole('button',{name:'Bỏ qua',exact:true}).click();break}
        const basic=dialog.getByRole('button',{name:'Mua khóa cơ bản',exact:true}),advanced=dialog.getByRole('button',{name:'Mua khóa nâng cao',exact:true})
        if(await basic.count()&&await basic.isEnabled())await basic.click()
        else if(await advanced.count()&&await advanced.isEnabled())await advanced.click()
        else await dialog.getByRole('button',{name:/^Tiếp tục$|^Bỏ qua$/}).click()
      }else if(await dialog.getByRole('button',{name:/Bắt đầu vòng/}).count())await dialog.getByRole('button',{name:/Bắt đầu vòng/}).click()
      else if(await dialog.getByRole('button',{name:/Mở quyền bán tại START/}).count())await dialog.getByRole('button',{name:/Mở quyền bán tại START/}).click()
      else if(await dialog.getByRole('button',{name:/Chơi một hành trình mới/}).count()){await shot(page,'desktop-result');finished=true;break}
      else if(await dialog.getByRole('button',{name:/Hoàn tất|Tiếp tục vòng|Xem kết quả|Xem dự báo/}).count())await dialog.getByRole('button',{name:/Hoàn tất|Tiếp tục vòng|Xem kết quả|Xem dự báo/}).last().click()
      else if(await dialog.getByRole('button',{name:/Bỏ qua cơ hội|Đã xem tác động/}).count())await dialog.getByRole('button',{name:/Bỏ qua cơ hội|Đã xem tác động/}).last().click()
      else if(await dialog.getByRole('button',{name:/Thanh toán [345]\./}).count())await dialog.getByRole('button',{name:/Thanh toán [345]\./}).first().click()
      else throw Error(`Unknown desktop sheet: ${await dialog.innerText()}`)
      await page.waitForTimeout(100)
    }
    assert.equal(finished,!poor)
    if(!poor){assert.ok(seen.has('one')&&seen.has('both'));const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Tải nhật ký quyết định/}).click();const download=await downloadPromise;const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);writeFileSync(`${out}/browser-desktop.json.gz`,gzipSync(bytes));results.push({desktop:true,fullGame:true,result:JSON.parse(bytes).finalResult})}
    else results.push({desktop:true,flow:'insufficient',partialFlow:true})
    await context.close()
  }
  assert.deepEqual(errors,[]);writeFileSync(`${out}/desktop-browser-verification.json`,JSON.stringify({results,layout,errors,actualUiActions:true,forcedStates:false,humanPlaytest:false},null,2)+'\n')
  console.log(JSON.stringify({desktopFlows:results.length,layoutChecks:layout.length,errors:errors.length}))
}catch(e){const p=browser.contexts().at(-1)?.pages().at(-1);if(p){await p.screenshot({path:`${out}/desktop-failure.png`});writeFileSync(`${out}/desktop-failure.txt`,await p.locator('body').innerText())}throw e}finally{await browser.close()}
