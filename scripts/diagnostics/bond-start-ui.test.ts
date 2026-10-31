import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/engine.ts'
import { beginSettlement } from '../../src/game/settlement.ts'
import { serializeLog } from '../../src/game/log.ts'
import { roundMarketReview, creditRoundReview } from '../../mobile_app/src/game/market-news.ts'
import type { GameState } from '../../src/game/types.ts'

test('START React UI separates received cash, claims and losses with hidden accounting', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'start-ui', resolveId(id) { if (id === 'virtual:start-ui') return '\0start-ui' },
      load(id) { if (id === '\0start-ui') return `
        import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
        import { LapSummaryModal } from '/mobile_app/src/components/LapSummaryModal.tsx';
        export const render = game => renderToStaticMarkup(createElement(LapSummaryModal, {game, onContinue(){}, onHelp(){}}));
      ` } }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('virtual:start-ui')
    await t.test('periodic living is a signed outgoing row, legacy START has no periodic row', () => {
      const candidate = beginSettlement(createMobileGame('living-ui', 0))
      const before = serializeLog(candidate), html = render(candidate)
      assert.match(html, /Chi phí sinh hoạt/)
      assert.match(html, /Tiền đã chi[\s\S]*?7\.000\.000/)
      assert.equal(serializeLog(candidate), before)
      const legacy = beginSettlement(createMobileGame('legacy-living-ui', 0, 1, 'v2.5-credit-risk', 'v2.4-on-landing'))
      assert.doesNotMatch(render(legacy), /Chi phí sinh hoạt/)
    })
    function holding() {
      let game = createMobileGame('start-ui', 0)
      for (let turn = 1; turn <= 3; turn++) game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn },
        { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 5e6 })
      game.market.normalLaps = [1, 2]
      return game
    }
    await t.test('multiple lots yield one default-visible issuer, amounts reconcile and all details start closed', () => {
      const game = beginSettlement(holding()), html = render(game)
      assert.equal((html.match(/class="start-issuer /g) ?? []).length, 1)
      assert.match(html, /Lãi trái phiếu định kỳ[\s\S]*?675\.000/)
      assert.doesNotMatch(html.split('Chi tiết các khoản trái phiếu')[0], /bond-[123]/)
      assert.match(html, /Chi tiết các khoản trái phiếu/); assert.match(html, /Khoản trái phiếu 1/)
      assert.match(html, /Xem dự báo và thực tế/); assert.match(html, /Chi tiết dòng tiền toàn vòng/)
      assert.doesNotMatch(html, /<details[^>]*\bopen/)
      assert.match(html, /Ghé ví tại ô Xuất phát →/)
      assert.match(html, /0/)
      assert.doesNotMatch(html, /class="positive">[+]?(?:0|0 ₫)</)
    })
    await t.test('delayed principal/coupon is amber, zero receipt neutral, no realized loss', () => {
      let game = holding(); game.lap = 2; game.bondCredit!.issuers[0].status = 'delayed'
      game = beginSettlement(game)
      const html = render(game)
      assert.match(html, /Đang chậm trả/); assert.match(html, /Khoản còn chờ/)
      assert.match(html, /15\.675\.000/)
      assert.match(html, /chưa được cộng vào tiền mặt/)
      assert.doesNotMatch(html, /class="start-loss"/)
      assert.match(html, /start-no-receipt neutral/)
    })
    await t.test('default recovery claim is separate from permanent write-down and cash', () => {
      let game = holding(); game.bondCredit!.issuers[0].status = 'defaulted'
      game = beginSettlement(game)
      const html = render(game)
      assert.match(html, /Không trả đủ theo hợp đồng/)
      assert.match(html, /Khoản chờ thu hồi chưa được cộng vào tiền mặt/)
      assert.match(html, /Khoản không thu hồi được/)
      assert.match(html, /không phải tiền chi thêm/)
      assert.match(html, /12\.000\.000/); assert.match(html, /3\.675\.000/)
    })
    await t.test('rendering preserves serialized engine log and news/credit calculations', () => {
      const game = beginSettlement(holding())
      const log = serializeLog(game), news = roundMarketReview(game, 1), credit = creditRoundReview(game, 1)
      render(game); render(game)
      assert.equal(serializeLog(game), log)
      assert.deepEqual(roundMarketReview(game, 1), news); assert.deepEqual(creditRoundReview(game, 1), credit)
    })
    await t.test('no holdings and legacy metadata render gracefully, with raw legacy records', () => {
      const empty = beginSettlement(createMobileGame('empty', 0))
      assert.doesNotMatch(render(empty), /class="start-issuer /)
      let legacy: GameState = createMobileGame('old-start', 0, 1, 'v2.4-single-issuer')
      legacy = transact({ ...legacy, phase: 'event', position: 6, eventId: 'bonds', turn: 1 }, { kind: 'buy', asset: 'bonds', amount: 1e6 })
      legacy = beginSettlement(legacy)
      const html = render(legacy)
      assert.doesNotMatch(html, /class="start-issuer /)
      assert.match(html, /Khoản trái phiếu 1/)
      assert.doesNotMatch(html, /bond-1/)
    })
  } finally { await server.close() }
})
