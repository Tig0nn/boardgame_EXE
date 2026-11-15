import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/engine.ts'
import { applyMacroShock } from '../../src/game/market.ts'
import { serializeLog } from '../../src/game/log.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'

test('Economic Event React popup presents observed market changes with one acknowledgement', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false,
    plugins: [react(), { name: 'event-ui', resolveId(id) { if (id === 'virtual:event-ui') return '\0event-ui' },
      load(id) { if (id === '\0event-ui') return `
        import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
        import { EventModal } from '/mobile_app/src/components/EventModal.tsx';
        export const render = game => renderToStaticMarkup(createElement(EventModal, {game,onChoose(){},onTransaction(){},onHelp(){}}));
      ` } }], resolve: { dedupe: ['react', 'react-dom'] }, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { render } = await server.ssrLoadModule('virtual:event-ui')
    for (const id of ['credit-tightening', 'demand-boom', 'supply-recovery']) await t.test(`${id}: three market groups, real percentages, issuers and closed details`, () => {
      const game = applyMacroShock({ ...createMobileGame('event-ui', 0), phase: 'event', eventId: id, turn: 1, position: 5 }, id)
      const saved = serializeLog(game), html = render(game)
      assert.ok(html.includes("Cổ phiếu") && html.includes("Trái phiếu") && html.includes("Vàng"))
      assert.match(html, /BIẾN CỐ KINH TẾ/); assert.match(html, /Góc nhìn tài chính/)
      assert.match(html, /An Tâm/); assert.match(html, /Bứt Phá/)
      assert.match(html, /Áp lực tài chính/); assert.doesNotMatch(html, /Đang chậm trả|Đang thu hồi vốn/)
      assert.match(html, /Bạn hiện chưa nắm giữ tài sản nào bị tác động/)
      assert.doesNotMatch(html.split('<details')[0], /\d\/2/)
      assert.doesNotMatch(html, /<details[^>]*\bopen/)
      assert.equal((html.match(/ĐÃ HIỂU · TIẾP TỤC/gi) ?? []).length, 1)
      assert.doesNotMatch(html, /Thị trường vừa thay đổi\. Cơ hội mới/)
      assert.doesNotMatch(html, /event-portfolio/)
      assert.equal(serializeLog(game), saved)
    })
    await t.test('zero movement is neutral, missing log unavailable and legacy single issuer supported', () => {
      const base = { ...createMobileGame('zero-ui', 0), scenarioId: 'growth', phase: 'event' as const, eventId: 'demand-boom', position: 5, turn: 1 }
      assert.match(render(applyMacroShock(base, 'demand-boom')), /↔ 0%/)
      assert.match(render(base), /Chưa đủ dữ liệu/)
      const legacy = applyMacroShock({ ...createMobileGame('legacy-ui', 0, 1, 'v2.4-single-issuer'), phase: 'event', eventId: 'credit-tightening', position: 5, turn: 1 }, 'credit-tightening')
      const html = render(legacy)
      assert.match(html, /Giá giảm 6%|↓ 6%|6%/)
    })
    await t.test('business is excluded from three market groups, but observed personal capital change is explained', () => {
      let game = createMobileGame('business-event-ui', 0)
      game = transact({ ...game, phase: 'event', eventId: 'business', position: 8, turn: 1 }, { kind: 'buy', asset: 'business', amount: 20e6 })
      game = applyMacroShock({ ...game, phase: 'event', eventId: 'credit-tightening', position: 5, turn: 2 }, 'credit-tightening')
      const html = render(game), marketSection = html.split('Biến động giá sau sự kiện:')[1]?.split('Tác động danh mục của bạn')[0] ?? ''
      assert.doesNotMatch(marketSection, /Vốn quán|thu nhập vận hành|Quán kinh doanh/)
      assert.match(html, /Tác động danh mục của bạn: /)
      assert.match(html, /Quán kinh doanh|Vốn quán|500\.000/)
      assert.doesNotMatch(html, /Bạn hiện chưa nắm giữ tài sản nào bị tác động/)
    })
    for (const [event, stress, direction] of [
      ['credit-tightening', 0, 'tăng', 'Giá giảm'],
      ['demand-boom', 1, 'giảm', 'Giá tăng'],
      ['supply-recovery', 0, 'không thay đổi', 'Giá tăng'],
      ['credit-tightening', 2, 'không thay đổi', 'Giá giảm'],
    ] as const) await t.test(`B18 ${event}/${stress}: price and issuer pressure, owned holdings, immutable render`, () => {
      let base = createMultiCourseGame('UX-WRITING-MACRO')
      // Controlled SSR fixture: legal purchase, then deliberately chosen stress
      // boundary to cover copy. Not exported as a naturally played UI game.
      base = transact({ ...base, phase: 'event', eventId: 'stocks', position: 10, turn: 1 }, { kind: 'buy', asset: 'stocks', symbolId: base.market.stocks[0].id, amount: 4e6 })
      base = { ...base, phase: 'event', eventId: event, turn: 2, position: 1,
        bondCredit: { ...base.bondCredit!, issuers: base.bondCredit!.issuers.map(item => ({ ...item, stress })) } }
      const game = applyMacroShock(base, event), saved = serializeLog(game), html = render(game)
      assert.match(html, new RegExp(`Áp lực tài chính ${direction}`))
      assert.match(html, /Tác động danh mục của bạn: /)
      assert.match(html, /Cổ phiếu/)
      assert.doesNotMatch(html, /Bạn hiện chưa nắm giữ/)
      assert.match(html, /Góc nhìn tài chính/)
      assert.equal(serializeLog(game), saved)
    })
  } finally { await server.close() }
})
