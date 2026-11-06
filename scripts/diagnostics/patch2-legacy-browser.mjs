import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'
import { createServer, loadConfigFromFile } from 'vite'

const out='docs/qa/release-hardening-patch2'
const loaded=await loadConfigFromFile({command:'serve',mode:'production'},resolve('release/beta/vite.config.ts'))
assert.ok(loaded)
const game=JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString()).state
assert.equal(game.phase,'finished')
const host=`import React from 'react';import{createRoot}from'react-dom/client';import{GameResultModal}from'/src/components/GameResultModal.tsx';import'/src/index.css';import'/src/engine-ui.css';import'/src/core-mvp.css';import'/src/medieval-theme.css';const game=${JSON.stringify(game)};createRoot(document.getElementById('root')).render(<GameResultModal game={game} onRestart={()=>{}} onHome={()=>{}} onClose={()=>{}} onExport={()=>{}}/>);`
const server=await createServer({...loaded.config,configFile:false,logLevel:'error',plugins:[...loaded.config.plugins,{
  name:'patch2-finished-result-qa-host',
  resolveId(id){if(id==='/__patch2_result.tsx')return id},
  load(id){if(id==='/__patch2_result.tsx')return host},
  configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
    if(req.url?.startsWith('/__patch2_result.html')){
      res.setHeader('Content-Type','text/html')
      res.end(await vite.transformIndexHtml('/__patch2_result.html','<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__patch2_result.tsx"></script></body></html>'))
    }else next()
  })},
}],server:{host:'127.0.0.1',port:5447,strictPort:true,hmr:false}})
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||join(homedir(),'AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')})
const result={scope:'Real finished GameResultModal in a QA-only browser host using the actual isolated Beta configuration/plugin; not full main-app end-game navigation.',cases:[],routeProbes:[],apiRequests:[],pageErrors:[],errors:[]}
try{
  await server.listen()
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:844}})
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort())
    const page=await context.newPage()
    page.on('pageerror',e=>result.pageErrors.push(e.message))
    page.on('request',req=>{if(/\/api\/|generativelanguage|api.openai/i.test(req.url()))result.apiRequests.push(req.url())})
    await page.goto('http://127.0.0.1:5447/__patch2_result.html')
    await page.locator('[data-financial-fact]').first().waitFor()
    assert.equal(await page.getByText(/AI Coach/).count(),0)
    assert.equal(await page.locator('.ai-coach-panel,.ai-coach-trigger-btn').count(),0)
    assert.ok(await page.locator('[data-financial-fact]').count()>0)
    await page.screenshot({path:`${out}/legacy-isolated-${width}.png`})
    result.cases.push({width,legacyAccordionAbsent:true,legacyAnalyzeCtaAbsent:true,financialFactsPresent:true})
    await context.close()
  }
  const probes=await browser.newContext()
  for(const endpoint of ['/api/ai-coach','/api/%61i-coach?preview=1','/api/ai-coach/']){
    const response=await probes.request.post('http://127.0.0.1:5447'+endpoint,{data:{}})
    assert.equal(response.status(),404)
    assert.match((await response.json()).error,/not available in this isolated Beta/)
    result.routeProbes.push({endpoint,status:response.status(),providerRequest:false})
  }
  await probes.close()
  assert.deepEqual(result.apiRequests,[]);assert.deepEqual(result.pageErrors,[])
}catch(error){result.errors.push(String(error));process.exitCode=1}
finally{writeFileSync(out+'/browser-legacy.json',JSON.stringify(result,null,2)+'\n');await browser.close();await server.close()}
console.log(JSON.stringify(result))
