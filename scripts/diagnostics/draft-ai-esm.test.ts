import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises'
import {dirname,join,relative,resolve,sep} from 'node:path'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
test('draft contract and controller emit browser-native ESM without Node/backend imports',async t=>{
 const base=resolve('node_modules/.tmp'),folder=await mkdtemp(join(base,'draft-esm-'));assert.equal(dirname(folder),base);await writeFile(join(folder,'package.json'),'{"type":"module"}')
 const seen=new Set<string>()
 async function emit(file:string){
  file=file.replaceAll('\\','/');if(seen.has(file))return;seen.add(file);assert(!file.includes('/server/')&&!file.startsWith('api/'))
  const source=await readFile(file,'utf8'),output=resolve(folder,file.replace(/\.ts$/,'.js'));assert(output.startsWith(folder+sep));await mkdir(dirname(output),{recursive:true})
  await writeFile(output,ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023,rewriteRelativeImportExtensions:true}}).outputText)
  for(const imp of ts.preProcessFile(source).importedFiles){assert(imp.fileName.startsWith('.'),'No Node/external import');const child=relative(resolve('.'),resolve(dirname(file),imp.fileName));assert(!child.startsWith('..')&&child.endsWith('.ts'));await emit(child)}
 }
 await emit('src/ai/companion/draft-index.ts');await emit('mobile_app/src/game/draft-ai.ts');await emit('mobile_app/src/game/draft-store.ts');const browserFiles=seen.size
 await emit('tests/helpers/draft.ts')
 const api=await import(pathToFileURL(join(folder,'src/ai/companion/draft-index.js')).href),fixtures=await import(pathToFileURL(join(folder,'tests/helpers/draft.js')).href)
 for(const source of ['gold','stocks','bonds','savings','debt']){
  const s=fixtures.fundingWith(source),lotId=source==='bonds'?s.bondLots[0].id:source==='savings'?s.deposits[0].id:null
  const c=api.projectDraftContext(s,{sessionEpoch:'esm-draft',revision:0,draftId:'form',draftRevision:1},api.normalizeDraftInput({form:'funding',operation:'fund',source,amount:source==='savings'?1000000:100000,lotId})),r=await api.createDraftRequest(c,api.DRAFT_QUESTIONS[0],'esm-question'),a=await api.answerDraft(r)
  assert.equal(a.status,'answered');assert.deepEqual(await api.validateDraftResponse(a,r),a)
 }
 t.diagnostic(JSON.stringify({browserFiles,nodeImports:0,backendImports:0,examples:5,artifacts:folder}))
})
