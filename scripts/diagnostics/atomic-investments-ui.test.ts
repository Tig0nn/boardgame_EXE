import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/transactions.ts'

test('atomic investment UI preserves prices/news and follows the saved encounter policy', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'atomic-investment-ui-entry',
      resolveId(id) { if (id === 'virtual:atomic-ui') return '\0atomic-ui' },
      load(id) { if (id === '\0atomic-ui') return `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { GamePhase } from '/mobile_app/src/components/GamePhase.tsx';
        import { EventModal } from '/mobile_app/src/components/EventModal.tsx';
        import { PhaseDialog } from '/src/components/GameDialogs.tsx';
        export const render = (name, props) => renderToStaticMarkup(createElement({GamePhase, EventModal, PhaseDialog}[name], props));
      ` },
    }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom',
  })
  try {
    const { render } = await server.ssrLoadModule('virtual:atomic-ui')
    const base = createMobileGame('atomic-ui', 0, 1, 'v2.4-single-issuer')
    const props = { onChoose: () => {}, onTransaction: () => true, send: () => true, onRestart: () => {}, onExport: () => {}, onFund: () => {}, onAdvance: () => {} }
    await t.test('new Mobile and Web panels offer one buy and one skip, keeping fees and market context', () => {
      for (const [asset, position] of [['stocks', 2], ['gold', 9], ['bonds', 6]] as const) {
        const game = { ...base, phase: 'event', eventId: asset, position, turn: 1 }
        const mobile = render('EventModal', { ...props, game })
        const web = render('PhaseDialog', { ...props, game })
        for (const html of [mobile, web]) {
          assert.equal((html.match(/Bỏ qua cơ hội/g) ?? []).length, 1)
          assert.match(html, /id="trade-amount"/)
          assert.match(html, /Tiền mặt sau giao dịch/)
          assert.doesNotMatch(html, /Hoàn tất · Về bàn chơi|Có thể giao dịch nhiều lần/)
        }
        assert.match(mobile, /Xem tín hiệu thị trường/)
        assert.match(mobile, asset === 'gold' ? /Chênh lệch mua–bán<\/span><strong>3%<\/strong>[^]*Phí bán<\/span><strong>1%/ : asset === 'bonds' ? /Phí bán 1\.5%/ : /Phí bán 1%/)
      }
    })
    await t.test('successful purchases leave no encounter modal or second form', () => {
      for (const [asset, position] of [['stocks', 2], ['gold', 9], ['bonds', 6]] as const) {
        const game = transact({ ...base, phase: 'event', eventId: asset, position, turn: 1 }, { kind: 'buy', asset, amount: 1_000_000 })
        assert.equal(render('GamePhase', { ...props, game }), '')
      }
    })
    await t.test('reopened same-turn encounter does not show another purchase form', () => {
      const one = transact({ ...base, phase: 'event', eventId: 'gold', position: 9, turn: 1 }, { kind: 'buy', asset: 'gold', amount: 1_000_000 })
      const html = render('EventModal', { ...props, game: { ...one, phase: 'event', eventId: 'gold' } })
      assert.doesNotMatch(html, /id="trade-amount"/)
      assert.match(html, /Đã mua trong lượt này/)
    })
    await t.test('saved historical Gold/Bonds sessions keep their multi-purchase forms', () => {
      for (const [asset, position] of [['gold', 9], ['bonds', 6]] as const) {
        const historical = { ...base, encounterRulesVersion: 'v2.4-business-purchase-complete' as const, phase: 'event' as const, eventId: asset, position, turn: 1 }
        const one = transact(historical, { kind: 'buy', asset, amount: 1_000_000 })
        const html = render('EventModal', { ...props, game: one })
        assert.match(html, /id="trade-amount"/)
        assert.match(html, /Hoàn tất · Về bàn chơi/)
        assert.equal((html.match(/Xem tín hiệu thị trường/g) ?? []).length, 1)
      }
    })
  } finally { await server.close() }
})
