import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { CUSTOMER_PREFERENCES } from '../../src/data/customer-preferences.ts'
import { currentCustomerPreference } from '../../src/game/customer-preferences.ts'
import { advance, transact } from '../../src/game/engine.ts'
import { beginSettlement } from '../../src/game/settlement.ts'
import { businessOverview } from '../../src/game/selectors.ts'
import { serializeLog } from '../../src/game/log.ts'
import { replayGameLog } from './replay-game-log.ts'
import { money } from '../../src/game/format.ts'

test('current customer preference UI is shared, current-only and read-only', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'business-preference-ui',
      resolveId(id) { if (id === 'virtual:preference-ui') return '\0preference-ui' },
      load(id) { if (id === '\0preference-ui') return `
        import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
        import { EconomicBulletin } from '/mobile_app/src/components/MarketNews.tsx';
        import { BusinessPanel } from '/src/components/BusinessPanel.tsx';
        import { Tutorial } from '/mobile_app/src/components/Tutorial.tsx';
        export const render = (name, game) => renderToStaticMarkup(createElement({EconomicBulletin, BusinessPanel, Tutorial}[name], {game, firstTime:false, onClose(){}, onTransaction(){}, feedback:null, compact:true}));
      ` } }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('virtual:preference-ui')
    const base = createMobileGame('preferences', 0)
    await t.test('bulletin and unopened shop use saved current preference, not seed or future data', () => {
      for (const preference of CUSTOMER_PREFERENCES) {
        const game = { ...base, customerPreferenceId: preference.id }
        const before = serializeLog(game)
        for (const name of ['EconomicBulletin', 'BusinessPanel']) {
          const html = render(name, game)
          assert.match(html, new RegExp(`data-current-preference="${preference.id}"`))
          assert.ok(html.includes(preference.label)); assert.ok(html.includes(preference.example))
          assert.match(html, /THỊ HIẾU KHÁCH HÀNG · VÒNG 1/)
          assert.match(html, /1\.000\.000 ₫\/tầng tại START/)
          for (const other of CUSTOMER_PREFERENCES.filter(p => p.id !== preference.id)) assert.ok(!html.includes(other.label))
        }
        assert.equal(serializeLog(game), before)
      }
    })
    await t.test('owned shop keeps legal upgrade, engine previews and current directions in rulebook', () => {
      const owned = transact({ ...base, phase: 'event', position: 8, eventId: 'business', turn: 1 }, { kind: 'buy', asset: 'business', amount: 20e6 })
      const later = { ...owned, phase: 'event' as const, position: 13, eventId: 'business', turn: 2 }
      const preference = currentCustomerPreference(later), view = businessOverview(later, preference.id)
      const panel = render('BusinessPanel', later)
      assert.ok(panel.includes(money(view.income))); assert.ok(panel.includes(money(view.incrementalIncome)))
      assert.match(panel, /Phù hợp vòng này/)
      const upgraded = transact(later, { kind: 'upgrade', asset: 'business', amount: 5e6, customerPreferenceId: preference.id })
      assert.equal(businessOverview(upgraded).income, 4.7e6)
      const before = serializeLog(upgraded), help = render('Tutorial', upgraded)
      assert.match(help, /Thị hiếu vòng hiện tại/); assert.match(help, /aria-valuemax="6"/)
      assert.ok(help.includes(`${preference.label} · 1 tầng`))
      assert.match(render('BusinessPanel', upgraded), /Đã nâng cấp một lần tại ô này/)
      assert.equal(serializeLog(upgraded), before)
      const expected = beginSettlement(structuredClone(upgraded)), settled = beginSettlement(upgraded)
      assert.equal(settled.log.findLast(e => e.kind === 'schedule' && e.title === 'Dòng tiền kinh doanh')?.cashDelta, 4.7e6)
      assert.equal(serializeLog(settled), serializeLog(expected))
    })
    await t.test('rendering cannot change START cash, RNG or next-round preference', () => {
      const control = structuredClone(base), before = serializeLog(base)
      for (const name of ['EconomicBulletin', 'BusinessPanel', 'Tutorial']) render(name, base)
      assert.equal(serializeLog(base), before)
      const settled = beginSettlement(base), expected = beginSettlement(control)
      assert.equal(serializeLog(settled), serializeLog(expected))
      const next = advance(advance(settled)), preference = currentCustomerPreference(next)
      assert.notEqual(preference.id, base.customerPreferenceId)
      assert.match(render('EconomicBulletin', next), new RegExp(`data-current-preference="${preference.id}"`))
      assert.match(render('Tutorial', next), /THỊ HIẾU KHÁCH HÀNG · VÒNG 2/)
    })
    await t.test('preference-less historical sessions and setup stay compatible; saved replay remains exact', () => {
      const legacy = { ...base, businessRulesVersion: 'v2.3-fixed-income', customerPreferenceId: undefined }
      assert.doesNotMatch(render('EconomicBulletin', legacy), /data-current-preference/)
      assert.doesNotMatch(render('Tutorial', legacy), /Thị hiếu vòng hiện tại/)
      assert.doesNotMatch(render('Tutorial', undefined), /Thị hiếu vòng hiện tại/)
      for (const file of ['docs/playtests/periodic-living-v26/browser-win-full.json.gz', 'docs/playtests/gd-artwork/business-v2_4-game-log.json.gz']) {
        const data = JSON.parse(gunzipSync(readFileSync(file)).toString())
        const before = JSON.stringify(data)
        for (const name of ['EconomicBulletin', 'BusinessPanel', 'Tutorial']) render(name, data.state)
        assert.equal(JSON.stringify(data), before)
        assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), data.state)
      }
    })
  } finally { await server.close() }
})
