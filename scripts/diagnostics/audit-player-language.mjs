import ts from 'typescript'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const baseline=process.argv.includes('--baseline'),base='10cdaa984bcdeddc8337eab945a98c939b405fec'
const baseFiles=baseline?new Set(execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/)):null
const roots=['src/components','mobile_app/src/components']
const files=roots.flatMap(root=>readdirSync(root).filter(f=>/\.tsx?$/.test(f)).map(f=>`${root}/${f}`))
files.push('src/App.tsx','mobile_app/src/App.tsx','src/ai/AICoachPanel.tsx','mobile_app/src/game/market-news.ts','mobile_app/src/game/economic-event.ts','mobile_app/src/game/living-presentation.ts')
const jargon=/\b(START|(?:deposit|bond|lot)-\d+|coupon|issuer|spread|funding|stocks|bonds|gold|business|savings|financial|course|ratings?|reserve|scenario|game|seed|payback|roi|default|liquidity|maturity|face value|engine|vs\.?|D6|Web MVP|cash|target|fees?|locked|preview|import|credit|principal|shock|buy|sell|continue|reset|retry|loading|tutorial|onboarding|drawdown|mascot|student|background|playboard)\b/gi
const findings=[],exceptions=[]
const developerOnly=new Set(['mobile_app/src/components/AnchorOverlay.tsx'])
for(const file of files){
 if(baseFiles&&!baseFiles.has(file))continue
 const s=baseline?execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'}):readFileSync(file,'utf8'),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 const location=n=>({file,line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1})
 function visit(n){
  if(ts.isJsxElement(n)&&['style','script'].includes(n.openingElement.tagName.getText(ast)))return
  if(ts.isJsxExpression(n)&&n.expression&&ts.isPropertyAccessExpression(n.expression)&&!ts.isJsxAttribute(n.parent)){
   const text=n.expression.getText(ast)
   if(/\b(?:lot|deposit)(?:s)?\.id$/.test(text))findings.push({...location(n),text,reason:'Direct internal lot ID in rendered text'})
  }
  if(ts.isJsxText(n)||ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n)){
   const text=s.slice(n.getStart(ast),n.end).trim(),matches=[...text.matchAll(jargon)].map(m=>m[0])
   const a11y=ts.isJsxAttribute(n.parent)&&['alt','title','aria-label','placeholder'].includes(n.parent.name.getText(ast))
   const copyProperty=ts.isPropertyAssignment(n.parent)&&['label','title','description','detail','text','caption'].includes(n.parent.name.getText(ast))
   const bareStart=ts.isStringLiteral(n)&&n.text==='START'&&file.endsWith('.tsx')
   const human=ts.isJsxText(n)||/[À-ỹ₫]/.test(text)||a11y||copyProperty||bareStart
   if(matches.length&&human){
    const row={...location(n),text,matches}
    if(developerOnly.has(file))exceptions.push({...row,reason:'DEV-only anchor calibration, not loaded in B18 player flow'})
    else if(file.endsWith('/glossary.ts')&&(text.includes('START là tên kỹ thuật')||text.includes('khác tỷ suất sinh lời (ROI)')))exceptions.push({...row,reason:'Explicit technical explanation / ROI distinction in shared glossary'})
    else findings.push(row)
   }
  }
  ts.forEachChild(n,visit)
 }
 visit(ast)
}
const output={scope:'All UI JSX text, human literals, accessibility copy, read-only presentation selectors and direct rendered lot IDs. Includes English-only alt/title labels; excludes imports, code identifiers, native select values and React keys.',files:files.length,findings,exceptions,intentional:['Tên thương hiệu, tên doanh nghiệp và mã cổ phiếu giữ nguyên.','JSON là tên định dạng tải/nhập; payload xuất/nhập nguyên bản.','AA/B/CCC/D là mã xếp hạng mô phỏng; B18/C20 và phiên bản xác định ván lịch sử.','Tên tiếng Anh đối chiếu trong mục glossary mở rộng. START chỉ là tên kỹ thuật trong giải thích từ điển, không phải nhãn ô.','IDs trong key/value/DOM hooks/callback không phải nhãn hiển thị; dữ liệu engine/log/replay không được dịch.']}
writeFileSync(`docs/playtests/b18-language-cleanup/${baseline?'before-language-audit':'language-audit'}.json`,JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({baseline,findings:findings.length,exceptions:exceptions.length,files:files.length}));if(findings.length&&!baseline)process.exitCode=1
