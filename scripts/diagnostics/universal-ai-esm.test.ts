import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {dirname,join,relative,resolve,sep} from 'node:path'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
test('universal browser entry emits native ESM with no backend or Node dependency',async t=>{
 const base=resolve('node_modules/.tmp'),folder=await mkdtemp(join(base,'universal-esm-'));assert.equal(dirname(folder),base)
 await writeFile(join(folder,'package.json'),'{"type":"module"}')
 const seen=new Set<string>()
 async function emit(file:string){
  file=file.replaceAll('\\','/');if(seen.has(file))return;seen.add(file)
  assert.ok(!file.includes('/server/')&&!file.startsWith('api/'))
  const source=await readFile(file,'utf8'),output=resolve(folder,file.replace(/\.ts$/,'.js'));assert.ok(output.startsWith(folder+sep));await mkdir(dirname(output),{recursive:true})
  await writeFile(output,ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023,rewriteRelativeImportExtensions:true}}).outputText)
  for(const imp of ts.preProcessFile(source).importedFiles){assert.ok(imp.fileName.startsWith('.'),'No external/Node browser import');const child=relative(resolve('.'),resolve(dirname(file),imp.fileName));assert.ok(!child.startsWith('..')&&child.endsWith('.ts'));await emit(child)}
 }
 await emit('src/ai/companion/universal-index.ts');const browserFiles=seen.size
 await emit('tests/helpers/universal.ts')
 const api=await import(pathToFileURL(join(folder,'src/ai/companion/universal-index.js')).href),fixtures=await import(pathToFileURL(join(folder,'tests/helpers/universal.js')).href)
 for(const domain of ['bank','gold','personal','macro','funding','summary']){
  const s=['funding','summary'].includes(domain)?fixtures.phaseState(domain):fixtures.encounter(domain==='personal'?'repair':domain==='macro'?'credit-tightening':domain)
  const c=api.projectGameplayContext(s,{sessionEpoch:'esm',revision:0}),r=await api.createGameplayRequest(c,api.suggestions(c.domain)[0],'esm-request'),a=await api.answerGameplay(r)
  assert.equal(a.status,'answered');assert.deepEqual(await api.validateGameplayResponse(a,r),a)
 }
 t.diagnostic(JSON.stringify({browserFiles,backendImports:0,nodeImports:0,examples:6,artifacts:folder}))
})