import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/engine.ts'
import { settleCreditBonds } from '../../src/game/bond-credit.ts'

test('Bond V2.5 real React panels expose issuer choice, executable lot sales and credit status', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'bond-credit-ui', resolveId(id) { if (id === 'virtual:bond-ui') return '\0bond-ui' },
      load(id) { if (id === '\0bond-ui') return `
        import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
        import { EventModal } from '/mobile_app/src/components/EventModal.tsx';
        import { RebalanceDialog } from '/src/components/RebalanceDialog.tsx';
        import { FundingDialog } from '/src/components/FundingDialog.tsx';
        import { BondHoldings } from '/src/components/BondHoldings.tsx';
        export const render = (name, props) => renderToStaticMarkup(createElement({EventModal,RebalanceDialog,FundingDialog,BondHoldings}[name],props));
      ` } }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('virtual:bond-ui')
    const base = createMobileGame('bond-ui', 0)
    const props = { onChoose() {}, onTransaction() {}, onContinue() {}, onFund() {}, compact: true }
    await t.test('two issuer cards retain one CTA/skip and conditional contract copy', () => {
      const html = render('EventModal', { ...props, game: { ...base, phase: 'event', eventId: 'bonds', position: 6 } })
      assert.equal((html.match(/class="bond-issuer-card[ "]/g) ?? []).length, 2)
      assert.equal((html.match(/Bỏ qua cơ hội/g) ?? []).length, 1)
      assert.match(html, /Mua trái phiếu/); assert.match(html, /nếu trả đúng hạn/)
      assert.match(html, /Phí bán 1\.5%/); assert.match(html, /Xem tín hiệu thị trường/)
      assert.doesNotMatch(html, /financial-warning/)
    })
    let owned = transact({ ...base, phase: 'event', eventId: 'bonds', position: 6, turn: 1 }, { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 6_000_000 })
    await t.test('funding chooses the specific issuer lot and displays actual net proceeds', () => {
      const game = { ...owned, phase: 'funding', portfolio: { ...owned.portfolio, cash: 0 }, pendingPayment: { origin: 'settlement', title: 'Nghĩa vụ', total: 1_000_000, remaining: 1_000_000 } }
      const html = render('FundingDialog', { ...props, game })
      assert.match(html, /id="fund-bond-lot"/); assert.match(html, /Bứt Phá/)
      assert.match(html, /5\.910\.000/)
    })
    await t.test('default holdings show claims/loss and do not become eligible funding assets', () => {
      owned = structuredClone(owned)
      owned.bondCredit!.issuers[1].status = 'defaulted'; owned.bondCredit!.issuers[1].defaultLap = 1
      settleCreditBonds(owned)
      const html = render('BondHoldings', { game: owned })
      assert.match(html, /Đang thu hồi/); assert.match(html, /Chưa có giá bán/); assert.match(html, /Mất gốc/)
      const funding = render('FundingDialog', { ...props, game: { ...owned, phase: 'funding', pendingPayment: { origin: 'settlement', title: 'Nghĩa vụ', total: 1_000_000, remaining: 1_000_000 } } })
      assert.doesNotMatch(funding, /Bán trái phiếu/)
    })
    await t.test('historical single issuer panel keeps its original terms', () => {
      const game = createMobileGame('old-ui', 0, 1, 'v2.4-single-issuer')
      const html = render('EventModal', { ...props, game: { ...game, phase: 'event', eventId: 'bonds', position: 6 } })
      assert.doesNotMatch(html, /bond-issuer-card/); assert.match(html, /Lãi 5%/)
    })
  } finally { await server.close() }
})
