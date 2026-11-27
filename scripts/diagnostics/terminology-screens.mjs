import {mkdirSync,writeFileSync,readFileSync,copyFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const stage=process.argv.includes('--after')?'after':'before',out=`docs/playtests/b18-terminology/${stage}`;mkdirSync(out,{recursive:true})
const b=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'})
const checks=[],errors=[]
async function shot(p,label){const d=await p.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(d.scroll<=d.w+1);await p.screenshot({path:`${out}/${label}.png`});checks.push({label,...d})}
try{
 for(const width of [320,390]){
  const c=await b.newContext({viewport:{width,height:844}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message))
  await p.goto(process.env.B18_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click()
  await p.getByRole('button',{name:'Mở sổ tay',exact:true}).last().click();await p.getByRole('tab',{name:'Đầu tư',exact:true}).click();await shot(p,`${width}-handbook`)
  if(stage==='after'){await p.getByText('Giải thích thuật ngữ',{exact:true}).click();await shot(p,`${width}-glossary`)}
  await p.getByRole('button',{name:'Đóng sổ tay',exact:true}).click();await p.getByText('Chơi lại cùng hành trình',{exact:true}).click();await p.locator('#mobile-seed').fill(process.env.TERMS_SEED??'TERMS-1')
  await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await shot(p,`${width}-bulletin`)
  await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.waitForTimeout(350);await p.getByRole('button',{name:'Gieo xúc xắc',exact:true}).last().click();await p.waitForTimeout(3300)
  assert.ok(await p.locator('.bond-credit-panel').count());await shot(p,`${width}-bond-trade`);await c.close()
  const r=await b.newPage({viewport:{width,height:844}});r.on('pageerror',e=>errors.push(e.message));await r.goto(process.env.B18_URL??'http://127.0.0.1:5200',{waitUntil:'domcontentloaded'});await r.getByRole('button',{name:'Bỏ qua hướng dẫn'}).click();await r.getByText('Mở ván đã lưu',{exact:true}).click();await r.locator('#saved-game-file').setInputFiles({name:'result.json',mimeType:'application/json',buffer:gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz'))});await r.waitForTimeout(400);await shot(r,`${width}-result`);await r.close()
 }
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.B18_DESKTOP_URL??'http://127.0.0.1:5201',{waitUntil:'domcontentloaded'})
 await p.getByRole('button',{name:'Luật chơi',exact:true}).click();if(stage==='after')await p.getByText('Giải thích thuật ngữ',{exact:true}).click();await shot(p,'desktop-handbook');await p.getByRole('button',{name:'Đã hiểu',exact:true}).click();
 await p.getByText('Tùy chỉnh hành trang',{exact:false}).click();await p.locator('#seed').fill(process.env.TERMS_SEED??'TERMS-1');await p.getByRole('button',{name:/Bắt đầu hành trình/}).click();await shot(p,'desktop-bulletin');await p.getByRole('button',{name:'Bắt đầu vòng 1',exact:true}).click();await p.getByRole('button',{name:/Gieo xúc xắc/}).click();await p.waitForTimeout(650);await shot(p,'desktop-bond-trade');await c.close()
 if(stage==='before')copyFileSync('docs/playtests/b18-beginner-ux/after/desktop-result.png',`${out}/desktop-result.png`);
 assert.deepEqual(errors,[]);writeFileSync(`${out}/screens.json`,JSON.stringify({stage,checks,errors,realUi:true},null,2)+'\n');console.log(JSON.stringify({stage,screenshots:checks.length,errors:errors.length}))
}finally{await b.close()}
