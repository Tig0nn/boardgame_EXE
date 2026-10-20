import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMultiCourseGame, createPlayerGame } from '../../src/game/new-game.ts'
import { depositPreview } from '../../src/game/selectors.ts'
import { money } from '../../src/game/format.ts'
import { eventsForGame } from '../../src/data/events.ts'
import type { Term } from '../../src/game/types.ts'

test('financial decision copy renders scheduled outgoing amounts and valid profile-based savings quotes', async t => {
  const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-financial-decision-test', plugins: [react(), {
    name: 'financial-decision-ui', resolveId(id) { if (id === 'virtual:financial-decision') return '\0financial-decision' },
    load(id) { if (id === '\0financial-decision') return `
      import {createElement} from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
      import {EventModal} from '/mobile_app/src/components/EventModal.tsx';
      import {PhaseDialog} from '/src/components/GameDialogs.tsx';
      import {SavingsPreview} from '/src/components/SavingsPreview.tsx';
      import {SavingsTerms} from '/src/components/SavingsTerms.tsx';
      import {TradingPanel} from '/src/components/TradingPanel.tsx';
      export const render=(name,props)=>renderToStaticMarkup(createElement({EventModal,PhaseDialog,SavingsPreview,SavingsTerms,TradingPanel}[name],{onChoose(){},onTransaction(){},onSkip(){},...props}));
    ` },
  }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('virtual:financial-decision')
    for (const id of ['family', 'medical', 'repair', 'bills', 'contract']) await t.test(`${id} outgoing schedule, both wrappers, no mutation`, () => {
      // Controlled rendering fixture, not an exported natural gameplay log.
      const game = { ...(id === 'bills' || id === 'contract' ? createPlayerGame('COPY-LEGACY', 0) : createMultiCourseGame('COPY')), phase: 'event', eventId: id, position: 3 }
      const saved = JSON.stringify(game)
      for (const name of ['EventModal', 'PhaseDialog']) {
        const html = render(name, { game })
        assert.match(html, /Trả ngay/); assert.match(html, /phải trả .* khi qua ô Xuất phát/)
        assert.doesNotMatch(html, /Nghĩa vụ tại|\+3\.500\.000|lãi vay|tiền phạt|\bSTART\b/)
        if (id === 'family') assert.match(html, /nhiều hơn trả ngay 500\.000/)
        if (id === 'repair') assert.match(html, /Tổng trả 5\.000\.000.*nhiều hơn trả ngay 1\.000\.000/)
      }
      assert.equal(JSON.stringify(game), saved)
    })
    await t.test('positive income keeps its plus sign', () => {
      const game = { ...createPlayerGame('BONUS', 0), phase: 'event', eventId: 'bonus', position: 9 }
      assert.match(render('EventModal', { game }), /Tiền mặt \+/)
      assert.match(eventsForGame(game).find(e => e.id === 'bonus')!.options[0].detail, /Tiền mặt \+/)
    })
    await t.test('term 1/2/3 quotes use the running profile and absolute maturity, including legacy', () => {
      for (const game of [createMultiCourseGame('SAVINGS'), createPlayerGame('LEGACY-SAVINGS', 0, 1, 'original')]) {
        for (const term of [1, 2, 3] as Term[]) for (const amount of [10e6, 2e6]) {
          const saved = JSON.stringify(game), quote = depositPreview(game, amount, term), html = render('SavingsPreview', { game, amount, term })
          for (const value of [amount, quote.interest, amount + quote.interest]) assert.ok(html.includes(money(value)))
          assert.match(html, new RegExp(`lần thứ ${quote.maturityLap}`))
          assert.equal(JSON.stringify(game), saved)
        }
      }
      const example = render('SavingsPreview', { game: createMultiCourseGame('EXAMPLE'), amount: 10e6, term: 2 })
      assert.match(example, /1\.000\.000/); assert.match(example, /11\.000\.000/)
    })
    await t.test('invalid inputs never render projected proceeds; late maturity warns explicitly', () => {
      const game = createMultiCourseGame('INVALID')
      for (const amount of [0, -1, Number.NaN, 1.5, game.portfolio.cash + 1]) assert.equal(render('SavingsPreview', { game, amount, term: 2 }), '')
      assert.match(render('SavingsPreview', { game: { ...game, lap: 4 }, amount: 10e6, term: 3 }), /Đến hạn sau khi hết ván/)
    })
    await t.test('plain savings explanation is split from the withdrawal warning; stock label stays asset-specific', () => {
      const text = render('SavingsTerms', { name: 'terms', term: 2, rates: { 1: .04, 2: .05, 3: .06 }, onChange() {} })
      assert.match(text, /Mỗi lần qua ô Xuất phát được tính là 1 kỳ/)
      assert.match(text, /Lãi chỉ tính trên số tiền gửi ban đầu/)
      assert.match(text, /<p[^>]*>Nếu phải rút trước hạn/)
      const game = { ...createMultiCourseGame('STOCKS'), phase: 'event', eventId: 'stocks', position: 10 }
      const html = render('TradingPanel', { game, compact: true })
      assert.match(html, /Giá hiện tại/); assert.doesNotMatch(html, /Giá \/ đơn vị/)
      assert.match(html, /Thay đổi gần nhất/); assert.match(html, /Phí mua 0/)
    })
  } finally { await server.close() }
})
