import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const out='docs/playtests/b18-release-qa/stock-resale';mkdirSync(out,{recursive:true})
const b=await chromium.launch({headless:true,executablePath:'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message))
 await p.goto('https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await p.getByText('Mở ván đã lưu',{exact:true}).click()
 await p.locator('#saved-game-file').setInputFiles('docs/playtests/b18-release-qa/stock-resale-checkpoint.json');await p.getByRole('button',{name:'Bán',exact:true}).click()
 const sell=p.getByRole('button',{name:/Xác nhận bán · Nhận/});await sell.scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/stock-sale-preview.png`});writeFileSync(`${out}/stock-sale-preview.txt`,await p.locator('body').innerText());await p.waitForTimeout(400);await sell.click();await p.waitForTimeout(400)
 const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state);assert.equal(s.phase,'rolling');assert.equal(s.portfolio.stocks,0);assert.equal(s.log.at(-1).decisionId,'sell-stocks-complete')
 assert.equal(await sell.count(),0)
 await p.getByTitle('Ví Tài Sản',{exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Lưu nhật ký / ván chơi',exact:true}).click();const d=await pending,stream=await d.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);writeFileSync(`${out}/stock-resale-after.json.gz`,gzipSync(Buffer.concat(chunks)))
 assert.deepEqual(errors,[]);writeFileSync(`${out}/results.json`,JSON.stringify({passed:true,importedLegalReplayPrefix:true,naturalFullGame:false,saleAtStockTile:true,oneSuccessfulTransaction:true,errors},null,2)+'\n')
}finally{await b.close()}
