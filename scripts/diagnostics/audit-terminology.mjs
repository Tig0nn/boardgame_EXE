import ts from 'typescript'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
const roots=['src/components','mobile_app/src/components','mobile_app/src/game']
const files=roots.flatMap(root=>readdirSync(root).filter(f=>/\.tsx?$/.test(f)).map(f=>`${root}/${f}`))
files.push('src/App.tsx','mobile_app/src/App.tsx','src/ai/AICoachPanel.tsx')
const jargon=/\b(coupon|issuer|spread|funding|stocks|bonds|gold|business|savings|financial|course|ratings?|reserve|scenario|game|seed|payback|roi|default|liquidity|maturity|face value|engine|vs\.?|D6|Web MVP|cash|target|fees?|locked|preview|import|credit|principal|shock|buy|sell|continue|reset|retry|loading|tutorial|onboarding|drawdown)\b/gi
const findings=[],exceptions=[]
for(const file of files){
 const s=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 function visit(n){
  if(ts.isJsxText(n)||ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n)){
   const text=s.slice(n.getStart(ast),n.end).trim(),matches=[...text.matchAll(jargon)].map(m=>m[0])
   const human=ts.isJsxText(n)||/[À-ỹ₫]/.test(text)
   if(matches.length&&human){
    const row={file,line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,text,matches}
    if(file.endsWith('/glossary.ts')&&text.includes('khác tỷ suất sinh lời (ROI)'))exceptions.push({...row,reason:'Phân biệt thời gian hoàn vốn với tỷ suất sinh lời; không dùng ROI làm đồng nghĩa với thời gian'})
    else findings.push(row)
   }
  }
  ts.forEachChild(n,visit)
 }
 visit(ast)
}
const output={scope:'UI literals and read-only presentation selectors; identifiers/imports omitted',findings,exceptions,intentional:['START: tên ô, giải thích Ô Xuất phát','AI Coach: tên tính năng','JSON: định dạng xuất/nhập và dữ liệu kỹ thuật mở rộng','AA/B/CCC/D và mã cổ phiếu: giữ mã mô phỏng','Tên doanh nghiệp hư cấu: giữ nguyên','Tên tiếng Anh trong phần đối chiếu Sổ tay: dùng từ điển tập trung']}
writeFileSync('docs/playtests/b18-terminology/language-audit.json',JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output,null,2))
if(findings.length)process.exitCode=1
