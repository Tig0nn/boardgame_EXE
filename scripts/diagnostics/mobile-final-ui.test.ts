import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame, createMobileSession } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/engine.ts'
import { C20_BOARD, PERIODIC_C20_BOARD } from '../../src/data/board.ts'
import { liquidatableFunds } from '../../src/game/selectors.ts'
import { money } from '../../src/game/format.ts'

test('Mobile final UI contracts use the official engine, board and financial previews', async t => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), {
      name: 'mobile-ui-contract-entry',
      resolveId(id) { if (id === 'virtual:mobile-ui-contract') return '\0mobile-ui-contract' },
      load(id) { if (id === '\0mobile-ui-contract') return `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import App from '/mobile_app/src/App.tsx';
        import { EventModal } from '/mobile_app/src/components/EventModal.tsx';
        import { Tutorial, BoardGuide } from '/mobile_app/src/components/Tutorial.tsx';
        import { GameSetup } from '/mobile_app/src/components/GameSetup.tsx';
        import { GameResultModal } from '/mobile_app/src/components/GameResultModal.tsx';
        import { SavingsTerms } from '/src/components/SavingsTerms.tsx';
        export const render = (name, props) => renderToStaticMarkup(createElement({App, EventModal, Tutorial, BoardGuide, GameSetup, GameResultModal, SavingsTerms}[name], props));
      ` },
    }],
    resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom',
  })
  try {
    const { render } = await server.ssrLoadModule('virtual:mobile-ui-contract')
    const base = createMobileGame('mobile-final-ui', 0)
    const noop = () => {}
    await t.test('fresh player sees onboarding without creating a game; returning player sees setup', () => {
      const first = render('App', {})
      assert.match(first, /Hướng dẫn chơi/)
      assert.doesNotMatch(first, /id="initial-savings"/)
      Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => 'seen' } } })
      try {
        const returning = render('App', {})
        assert.match(returning, /id="initial-savings"/)
        assert.doesNotMatch(returning, /aria-label="Hướng dẫn chơi"/)
      } finally { Reflect.deleteProperty(globalThis, 'window') }
    })
    await t.test('term cards show per-START and total simple interest correctly', () => {
      const html = render('SavingsTerms', { name: 'terms', term: 1, rates: { 1: .04, 2: .05, 3: .06 }, onChange: noop })
      for (const label of ['1 kỳ · Lãi suất 4% mỗi kỳ · Tổng 4% cuối kỳ hạn', '2 kỳ · Lãi suất 5% mỗi kỳ · Tổng 10% cuối kỳ hạn', '3 kỳ · Lãi suất 6% mỗi kỳ · Tổng 18% cuối kỳ hạn']) assert.ok(html.includes(label))
      assert.equal((html.match(/type="radio"/g) ?? []).length, 3)
    })
    await t.test('purchase tiles never offer voluntary selling even when holdings exist', () => {
      for (const [asset, position] of [['stocks', 2], ['bonds', 6], ['gold', 9]] as const) {
        const owned = transact({ ...base, phase: 'event', eventId: asset, position }, { kind: 'buy', asset, amount: 1_000_000, issuerId: asset === 'bonds' ? 'an-tam' : undefined, symbolId: base.market.stocks[0].id, completeEncounter: asset === 'stocks' ? true : undefined })
        const game = { ...owned, phase: 'event', turn: owned.turn + 1, eventId: asset, position }
        const before = JSON.stringify(game)
        const html = render('EventModal', { game, onChoose: noop, onTransaction: noop })
        assert.doesNotMatch(html, /<button[^>]*>[^<]*Bán/)
        assert.match(html, />Mua /)
        assert.equal(JSON.stringify(game), before)
      }
    })
    await t.test('result uses lawful proceeds and never liquidates or claims four laps for insolvency', () => {
      const owned = transact({ ...base, phase: 'event', eventId: 'business', position: 8 }, { kind: 'buy', asset: 'business', amount: 20_000_000 })
      const game = { ...owned, phase: 'finished', termination: 'insolvent' }
      const before = JSON.stringify(game)
      const html = render('GameResultModal', { game, onRestart: noop, onExport: noop })
      assert.ok(html.includes(money(liquidatableFunds(game))))
      assert.match(html, /không còn nguồn thanh toán/)
      assert.doesNotMatch(html, /Hoàn Thành 4 Vòng|Nguồn Tiền Thực Thu|Chiến Thắng/)
      assert.equal(JSON.stringify(game), before)
    })
    await t.test('tutorial keeps six steps and rulebook displays every official C20 tile', () => {
      const html = render('Tutorial', { firstTime: true, onClose: noop })
      assert.match(html, /aria-valuemax="6"/)
      const board = render('BoardGuide', { game: createMobileGame('legacy-guide', 0, 1, 'v2.4-single-issuer', 'v2.4-on-landing') })
      assert.equal((board.match(/<li /g) ?? []).length, 20)
      for (const tile of C20_BOARD) assert.match(board, new RegExp(`<li value="${tile.index + 1}">[\\s\\S]*?</svg> ${tile.type === 'start' ? 'Xuất phát' : tile.label}</li>`))
      assert.deepEqual(C20_BOARD.filter(tile => tile.type === 'bank').map(tile => tile.index + 1), [2, 13])
      const candidate = render('BoardGuide', { game: base })
      for (const tile of PERIODIC_C20_BOARD) assert.match(candidate, new RegExp(`<li value="${tile.index + 1}">[\\s\\S]*?</svg> ${tile.type === 'start' ? 'Xuất phát' : tile.label}</li>`))
      assert.doesNotMatch(candidate, /Sinh hoạt/)
    })
    await t.test('stock completion and Bank lots remain atomic through the Mobile controller', () => {
      const stockGame = { ...base, phase: 'event' as const, eventId: 'stocks', position: 2 }
      const stock = createMobileSession(stockGame)
      const buy = { type: 'trade' as const, action: { kind: 'buy' as const, asset: 'stocks' as const, amount: 1_000_000, symbolId: base.market.stocks[0].id, completeEncounter: true } }
      assert.equal(stock.dispatch(buy, stockGame), true)
      assert.equal(stock.getSnapshot().phase, 'rolling')
      assert.equal(stock.dispatch(buy, stockGame), false)
      const bankGame = { ...base, phase: 'event' as const, eventId: 'bank', position: 1 }
      const bank = createMobileSession(bankGame)
      const deposit = { type: 'trade' as const, action: { kind: 'deposit' as const, amount: 1_000_000, term: 2 as const } }
      bank.dispatch(deposit, bankGame)
      const one = bank.getSnapshot()
      assert.equal(one.phase, 'rolling')
      assert.throws(() => bank.dispatch(deposit, one))
      const later = { ...one, phase: 'event' as const, turn: one.turn + 1, eventId: 'bank', position: 12 }
      const next = createMobileSession(later)
      next.dispatch(deposit, later)
      assert.deepEqual(next.getSnapshot().deposits.map(lot => [lot.principal, lot.maturityLap]), [[1_000_000, 2], [1_000_000, 2]])
    })
    await t.test('Business purchase ends encounter; same-turn sale/upgrade blocked, later upgrade allowed once', () => {
      const initial = { ...base, phase: 'event' as const, eventId: 'business', position: 8, turn: 1 }
      const owned = transact(initial, { kind: 'buy', asset: 'business', amount: 20_000_000 })
      assert.equal(owned.phase, 'rolling')
      const sameTurn = { ...owned, phase: 'event' as const, eventId: 'business', position: 8 }
      const html = render('EventModal', { game: sameTurn, onChoose: noop, onTransaction: noop })
      assert.match(html, /<button[^>]*disabled[^>]*>Bán toàn cơ sở/)
      assert.throws(() => transact(sameTurn, { kind: 'sell', asset: 'business', amount: 20_000_000 }))
      const later = { ...sameTurn, turn: 2 }
      const upgrade = { kind: 'upgrade' as const, asset: 'business' as const, amount: 5_000_000, customerPreferenceId: later.customerPreferenceId! }
      const upgraded = transact(later, upgrade)
      assert.throws(() => transact(upgraded, upgrade))
      assert.equal(transact(upgraded, { kind: 'sell', asset: 'business', amount: upgraded.portfolio.business }).business.capital, 0)
    })
  } finally { await server.close() }
})
