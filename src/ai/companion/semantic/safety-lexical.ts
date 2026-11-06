// Token and monetary-reference parsing; no intent inference or financial quote arithmetic.
/** NFC whole-token matching. Accent folding is deliberately not a lexical identity rule. */
export function tokens(text:string):string[]{return text.normalize('NFC').toLocaleLowerCase('vi').match(/[\p{L}\p{N}]+(?:[.,]\p{N}+)*|[;?]/gu)??[]}
export function words(text:string){const list=tokens(text).filter(t=>t!==';'&&t!=='?');return {list,has(...phrases:string[]){return phrases.some(p=>{const part=tokens(p);return list.some((_,i)=>part.every((v,j)=>list[i+j]===v))})}}}
export function mentionedMoney(text:string):{value:number|null;ambiguous:boolean}{
 // Accent folding applies only to amounts, not the whole-token identity rules above.
 const q=text.normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/gu,'d').toLowerCase().replace(/\u00a0/gu,' ')
 const digit:Record<string,number>={mot:1,hai:2,ba:3,bon:4,tu:4,nam:5,lam:5,sau:6,bay:7,tam:8,chin:9}
 const word='(?:mot|hai|ba|bon|tu|nam|lam|sau|bay|tam|chin|muoi|tram|linh|le|chuc)'
 const candidate=new RegExp('(?<![\\p{L}\\p{N}.,])([+-]?\\d[\\d.,]*(?: +\\d{3})*|'+word+'(?: +'+word+')*)\\s*$','u')
 function tens(list:string[]):number{
  if(list.length===1)return list[0]==='muoi'?10:digit[list[0]]??NaN
  const start=list[0]==='muoi'?10:digit[list[0]]>=2&&list[1]==='muoi'?digit[list[0]]*10:NaN
  const rest=list.slice(list[0]==='muoi'?1:2)
  return rest.length===0?start:rest.length===1?start+(digit[rest[0]]??NaN):NaN
 }
 function coefficient(raw:string):number{
  if(/^\d/u.test(raw)){
   if(/^[1-9]\d{0,2}([., ])\d{3}(?:\1\d{3})*$/u.test(raw))return Number(raw.replace(/[., ]/gu,''))
   return /^\d+(?:[.,]\d+)?$/u.test(raw)?Number(raw.replace(',','.')):NaN
  }
  const list=raw.split(/ +/u)
  if(list[1]!=='tram')return tens(list)
  const rest=list.slice(2),hundreds=digit[list[0]]*100
  if(!rest.length)return hundreds
  if(['linh','le'].includes(rest[0]))return rest.length===2?hundreds+(digit[rest[1]]??NaN):NaN
  const tail=tens(rest);return tail>=10?hundreds+tail:NaN
 }
 const amounts:number[]=[],ranges:[number,number][]=[]
 let malformed=/\d(?:tr(?:ieu|d)?|k|ty|ti)\d/u.test(q)
 for(const m of q.matchAll(/(?<!\p{L})(trieu|trd|tr|nghin|ngan|ty|ti|k|dong|d)(?![\p{L}\p{N}])/gu)){
  const prefix=q.slice(0,m.index),part=prefix.match(candidate)
  if(!part){if(/\p{N}/u.test(prefix.trim().split(/\s+/u).at(-1)??''))malformed=true;continue}
  if(/(?:\bam\s*|[−–—])$/u.test(prefix.slice(0,part.index)))malformed=true
  const scale=['trieu','trd','tr'].includes(m[1])?1e6:['nghin','ngan','k'].includes(m[1])?1e3:['ty','ti'].includes(m[1])?1e9:1
  const half=/^\s+ruoi(?!\p{L})/u.exec(q.slice(m.index+m[0].length))
  if(half&&/^\s+ruoi(?!\p{L})/u.test(q.slice(m.index+m[0].length+half[0].length)))malformed=true
  amounts.push((coefficient(part[1])+(half?.[0]?0.5:0))*scale)
  ranges.push([prefix.length-part[0].length,m.index+m[0].length+(half?.[0].length??0)])
 }
 for(const m of q.matchAll(/(?<![\p{L}\p{N}.,])[+-]?\d[\d.,]*(?: +\d{3})*(?![\p{L}\p{N}])/gu)){
  if(m[0].replace(/\D/gu,'').length<6||ranges.some(([start,end])=>m.index>=start&&m.index<end))continue
  if(/(?:\bam\s*|[−–—])$/u.test(q.slice(0,m.index)))malformed=true
  amounts.push(coefficient(m[0]))
 }
 const ambiguous=malformed||amounts.length>1||amounts.some(a=>!Number.isSafeInteger(a)||a<=0)
 return {value:!ambiguous&&amounts.length===1?amounts[0]:null,ambiguous}
}
