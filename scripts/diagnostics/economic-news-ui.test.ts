import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { beginSettlement } from '../../src/game/settlement.ts'
import { applyMacroShock } from '../../src/game/market.ts'
import { SCENARIOS } from '../../src/data/config.ts'

test('Mobile economic news renders through real phase and transaction components', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'economic-news-ui-entry',
      resolveId(id) { if (id === 'virtual:news-ui') return '\0news-ui' },
      load(id) { if (id === '\0news-ui') return `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { GamePhase } from '/mobile_app/src/components/GamePhase.tsx';
        import { MarketSignal, ForecastReality } from '/mobile_app/src/components/MarketNews.tsx';
        export const render = (name, props) => renderToStaticMarkup(createElement({GamePhase, MarketSignal, ForecastReality}[name], props));
      ` },
    }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom',
  })
  try {
    const { render } = await server.ssrLoadModule('virtual:news-ui')
    const base = createMobileGame('news-ui', 0)
    const props = { send: () => true, onRestart: () => {}, onHelp: () => {} }
    await t.test('all scenarios show bulletin, three assets and a single start CTA', () => {
      for (const scenario of SCENARIOS) {
        const game = { ...base, scenarioId: scenario.id, log: [] }
        const html = render('GamePhase', { ...props, game })
        assert.ok(html.includes(scenario.label))
        assert.equal((html.match(/<article>/g) ?? []).length, 3)
        assert.match(html, /Bắt đầu vòng 1/)
        assert.doesNotMatch(html, /RNG|seed|experimental|simulation/)
        assert.equal(game.rng, base.rng)
      }
    })
    await t.test('market context appears only on Stocks/Bonds/Gold, with legal buy actions intact', () => {
      for (const eventId of ['stocks', 'bonds', 'gold', 'bank', 'business']) {
        const game = { ...base, phase: 'event', eventId }
        const before = JSON.stringify(game)
        const html = render('GamePhase', { ...props, game })
        assert.equal(html.includes('Xem tín hiệu thị trường'), ['stocks', 'bonds', 'gold'].includes(eventId))
        if (eventId === 'bonds') assert.match(html.split('<summary>Xem tín hiệu thị trường')[0], /Phí bán 1\.5%/)
        assert.doesNotMatch(html, /<button[^>]*>Bán /)
        assert.equal(JSON.stringify(game), before)
      }
    })
    await t.test('summary renders realized prices, observed shock and educational distinction', () => {
      const game = beginSettlement(applyMacroShock({ ...base, turn: 1 }, 'credit-tightening'))
      const html = render('GamePhase', { ...props, game })
      assert.match(html, /Dự báo vs\. Thực tế/)
      assert.match(html, /Tín dụng thắt chặt/)
      assert.match(html, /không phải lãi của bạn/)
      assert.match(html, /Ghé ví tại START/)
      assert.equal((html.match(/<article>/g) ?? []).length, 5)
      assert.match(html, /Tín dụng &amp; tiền thực nhận/)
      assert.doesNotMatch(html, /Dự báo:.*Nhu cầu tích cực/)
    })
    await t.test('missing observations show unavailable; gold fees and quote remain explicit', () => {
      const unavailable = render('ForecastReality', { game: base, lap: 1 })
      assert.match(unavailable, /Chưa đủ dữ liệu/)
      const signal = render('MarketSignal', { game: base, asset: 'gold' })
      assert.match(signal, /Phí bán 1% \+ chênh lệch 3%/)
      assert.match(signal, /Giá hiện tại/)
      assert.match(signal, /Còn 4 lần qua START/)
    })
  } finally { await server.close() }
})
