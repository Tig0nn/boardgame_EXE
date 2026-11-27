import {mkdirSync,writeFileSync,existsSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const pw=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE??'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const out='docs/playtests/b18-release-qa';mkdirSync(out,{recursive:true})
const urls={mobile:'https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app',desktop:'https://boardgame-r8ukc7g79-tris-projects-2888207c.vercel.app'}
const results=[]
for(const name of ['chromium','firefox','webkit']){
 const executable=name==='chromium'?(process.env.BROWSER_PATH??'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'):pw[name].executablePath()
 if(!existsSync(executable)){results.push({browser:name,status:'BLOCKED',reason:'Browser executable unavailable',executable});continue}
 let browser
 try{
  browser=await pw[name].launch({headless:true,executablePath:executable})
  for(const [kind,url]of Object.entries(urls)){
   const context=await browser.newContext({viewport:{width:kind==='mobile'?390:1440,height:900}}),page=await context.newPage(),errors=[],consoleErrors=[],failedRequests=[]
   page.on('pageerror',e=>errors.push(e.message))
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())})
   page.on('requestfailed',r=>failedRequests.push({url:r.url(),failure:r.failure()?.errorText}))
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000})
   await page.getByRole('button',{name:kind==='mobile'?'Bỏ qua hướng dẫn':/Bắt đầu hành trình/}).waitFor()
   await page.screenshot({path:`${out}/probe-${name}-${kind}.png`})
   const body=await page.locator('body').innerText()
   writeFileSync(`${out}/probe-${name}-${kind}.txt`,body)
   results.push({browser:name,version:browser.version(),kind,url,finalUrl:page.url(),http:response.status(),title:await page.title(),appLoaded:/Bỏ qua hướng dẫn|Sẵn sàng dạo phố|Tùy chỉnh hành trang|Bắt đầu hành trình/.test(body),protection:/Vercel Authentication|Log in to Vercel|Authentication Required/.test(body),errors,consoleErrors,failedRequests})
   await context.close()
  }
 }catch(e){results.push({browser:name,status:'BLOCKED',reason:String(e)})}finally{await browser?.close()}
}
writeFileSync(`${out}/browser-probe.json`,JSON.stringify({results},null,2)+'\n');console.log(JSON.stringify(results))
