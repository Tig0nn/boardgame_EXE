import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import {createMultiCourseGame} from '../../src/game/new-game.ts'
import {readFileSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {FINANCIAL_TERMS} from '../../src/components/glossary.ts'

test('wallet preserves deposit sequence/maturity and both interfaces explain savings periods without exposing IDs',async()=>{
  const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-language-cleanup-test',plugins:[react(),{
    name:'language-cleanup-ui',resolveId(id){if(id==='virtual:language-cleanup-ui')return '\0language-cleanup-ui'},load(id){if(id==='\0language-cleanup-ui')return `
      import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
      import {Portfolio} from '/src/components/Portfolio.tsx';import {FundingDialog} from '/src/components/FundingDialog.tsx';
      import {SavingsTerms} from '/src/components/SavingsTerms.tsx';import {TradingPanel} from '/src/components/TradingPanel.tsx';
      import {GameSetup} from '/mobile_app/src/components/GameSetup.tsx';import {Setup} from '/src/components/Setup.tsx';
      import {BondCreditPanel} from '/src/components/BondCreditPanel.tsx';import {BondHoldings} from '/src/components/BondHoldings.tsx';
      import {MarketDetails} from '/src/components/MarketDetails.tsx';import {CourseChoices} from '/src/components/CourseChoices.tsx';
      import {PhaseDialog} from '/src/components/GameDialogs.tsx';import {LogDialog} from '/src/components/EventLog.tsx';
      import {Board} from '/src/components/Board.tsx';import {CoreMvpBoard} from '/mobile_app/src/components/CoreMvpBoard.tsx';
      import {LapSummaryModal} from '/mobile_app/src/components/LapSummaryModal.tsx';import {GameResultModal} from '/mobile_app/src/components/GameResultModal.tsx';
      import {EconomicBulletin} from '/mobile_app/src/components/MarketNews.tsx';import {RulebookModal} from '/mobile_app/src/components/RulebookModal.tsx';
      export const render=(name,props)=>renderToStaticMarkup(createElement({Portfolio,FundingDialog,SavingsTerms,TradingPanel,GameSetup,Setup,BondCreditPanel,BondHoldings,MarketDetails,CourseChoices,PhaseDialog,LogDialog,Board,CoreMvpBoard,LapSummaryModal,GameResultModal,EconomicBulletin,RulebookModal}[name],props));
    `}
  }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
  try{
    const {render}=await server.ssrLoadModule('virtual:language-cleanup-ui'),base=createMultiCourseGame('LANGUAGE-SSR',10e6,3),original=base.deposits[0]
    // Rendering fixture only: gaps and different absolute maturities deliberately
    // cover the reported UI regression. Never saved or used by replay/parity.
    const game={...base,lap:2,deposits:[{...original,id:'deposit-1',status:'matured'},{...original,id:'deposit-2',status:'withdrawn'},{...original,id:'deposit-3',principal:4e6,maturityLap:3},{...original,id:'deposit-10',principal:6e6,startLap:2,maturityLap:4}]}
    const before=JSON.stringify(game),html=render('Portfolio',{game,compact:true})
    assert.match(html,/Khoản tiết kiệm 3/);assert.match(html,/Khoản tiết kiệm 10/)
    assert.doesNotMatch(html,/Khoản tiết kiệm 1<|Khoản tiết kiệm 2<|deposit-\d+|\bSTART\b/)
    assert.match(html,/Đáo hạn khi qua ô Xuất phát lần thứ 3/);assert.match(html,/Đáo hạn khi qua ô Xuất phát lần thứ 4/)
    assert.match(html,/6% mỗi kỳ/);assert.match(html,/Còn <strong>3<\/strong> lần nhận lương/)
    assert.match(html,/<dt>Lương định kỳ<\/dt><dd class="positive">\+14\.000\.000/)
    const funding=render('FundingDialog',{game:{...game,phase:'funding',portfolio:{...game.portfolio,cash:0},pendingPayment:{title:'Thiếu tiền',total:1e6,remaining:1e6}},onFund(){}})
    assert.match(funding,/<option[^>]*value="deposit-3"[^>]*>Khoản tiết kiệm 3/)
    assert.match(funding,/<option[^>]*value="deposit-10"[^>]*>Khoản tiết kiệm 10/)
    assert.doesNotMatch(funding,/>deposit-\d+/)
    for(const name of ['GameSetup','Setup']){
      const setup=render(name,{onStart(){},onHelp(){}})
      assert.match(setup,/mỗi kỳ/);assert.match(setup,/mỗi lần qua ô Xuất phát/);assert.doesNotMatch(setup,/\bSTART\b/)
    }
    const terms=render('SavingsTerms',{name:'qa-term',term:3,rates:{1:.04,2:.05,3:.06},onChange(){}})
    assert.match(terms,/Tổng 18% cuối kỳ hạn/);assert.match(terms,/Lãi đơn/)
    assert.equal(JSON.stringify(game),before)
    const done=JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString()).state
    const credit=JSON.parse(readFileSync('docs/playtests/b18-terminology/defaulted-checkpoint.json','utf8')).state
    const callbacks={onClose(){},onHelp(){},onStart(){},onSkip(){},onTransaction(){},onChoose(){},onRestart(){},onExport(){},onAdvance(){},onContinue(){},onFund(){},onRoll(){}}
    const views=[['Portfolio',done],['BondHoldings',credit],['LogDialog',done],['PhaseDialog',done],['GameResultModal',done],['LapSummaryModal',credit],['EconomicBulletin',base],['RulebookModal',base],['Board',base],['CoreMvpBoard',base],['CourseChoices',base],['BondCreditPanel',base],['TradingPanel',{...base,phase:'event',eventId:'bank',position:6}]] as const
    const audit=[]
    for(const [name,g]of views){
      const snapshot=JSON.stringify(g),html=render(name,{game:g,...callbacks}),visible=html.replace(/<[^>]*>/g,'').replaceAll(FINANCIAL_TERMS.start.definition,'')
      assert.doesNotMatch(visible,/\bSTART\b|\b(?:deposit|bond|lot)-\d+\b/,`${name}: visible internal name`)
      if(name==='EconomicBulletin')assert.match(visible,/4 lần qua ô Xuất phát còn lại/)
      assert.equal(JSON.stringify(g),snapshot)
      audit.push({component:name,characters:visible.length,remainingStartOrLotIds:0,stateUnchanged:true})
    }
    for(const asset of ['gold','bonds']){
      const visible=render('MarketDetails',{game:credit,asset}).replace(/<[^>]*>/g,'').replaceAll(FINANCIAL_TERMS.start.definition,'')
      assert.doesNotMatch(visible,/\bSTART\b|\b(?:deposit|bond|lot)-\d+\b/)
      audit.push({component:`MarketDetails/${asset}`,characters:visible.length,remainingStartOrLotIds:0,stateUnchanged:true})
    }
    // Tests are read-only by default. A new QA run must explicitly select its own
    // output; never overwrite the evidence locked by the original cleanup task.
    if(process.env.UI_AUDIT_OUTPUT)writeFileSync(process.env.UI_AUDIT_OUTPUT,JSON.stringify({audit,exception:'Only the exact shared glossary sentence explaining START as a technical name is allowed.',sourceArchivesReadOnly:true},null,2)+'\n')
  }finally{await server.close()}
})
