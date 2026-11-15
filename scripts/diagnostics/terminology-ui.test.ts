import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { FINANCIAL_TERMS } from '../../src/components/glossary.ts'

test('shared glossary renders on Desktop and Mobile, escapes selector text, and leaves state untouched', async () => {
  const server = await createServer({configFile:false,cacheDir:'node_modules/.vite-terminology-test',plugins:[react(),{
    name:'terminology-ui',resolveId(id){if(id==='virtual:terminology-ui')return '\0terminology-ui'},load(id){if(id==='\0terminology-ui')return `
      import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
      import {FinancialGlossary,FinancialTerm,GlossaryText} from '/src/components/FinancialTerm.tsx';
      import {RulebookModal} from '/mobile_app/src/components/RulebookModal.tsx';
      import {BondCreditPanel} from '/src/components/BondCreditPanel.tsx';
      import App from '/src/App.tsx';
      export const render=(name,props={})=>renderToStaticMarkup(createElement({FinancialGlossary,FinancialTerm,GlossaryText,RulebookModal,BondCreditPanel,App}[name],props));
    `}
  }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
  try {
    const {render}=await server.ssrLoadModule('virtual:terminology-ui')
    const glossary=render('FinancialGlossary')
    for(const entry of Object.values(FINANCIAL_TERMS))assert.ok(glossary.includes(entry.definition.replaceAll('&','&amp;')))
    assert.match(render('FinancialTerm',{term:'coupon'}),/aria-label="Giải thích: Tiền lãi trái phiếu định kỳ"/)
    assert.match(render('FinancialTerm',{term:'coupon'}),/popover="manual" role="tooltip"/)
    assert.doesNotMatch(render('FinancialTerm',{term:'coupon'}),/ title=/)
    assert.match(render('FinancialTerm',{term:'proceeds',children:'Nguồn tiền về đích'}),/aria-label="Giải thích: Nguồn tiền về đích"/)
    assert.match(render('GlossaryText',{text:'Lãi trái phiếu <script>alert(1)</script>'}),/&lt;script&gt;/)
    assert.doesNotMatch(render('GlossaryText',{text:'Lãi trái phiếu <script>alert(1)</script>'}),/<script>/)
    const game=createMultiCourseGame('TERMS-1'),before=JSON.stringify(game)
    for(const name of ['RulebookModal','BondCreditPanel']) {
      const html=render(name,{game,onClose(){},onTransaction(){},onSkip(){}})
      assert.ok(html.includes(name==='RulebookModal'?'Sổ tay hành trình':'Giải thích: Tiền lãi trái phiếu định kỳ'))
    }
    assert.match(render('App'),/Xoay Vòng/)
    assert.equal(JSON.stringify(game),before)
  }finally{await server.close()}
})
