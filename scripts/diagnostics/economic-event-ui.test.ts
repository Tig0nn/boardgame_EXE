import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { createMobileGame } from '../../mobile_app/src/game/session.ts'
import { transact } from '../../src/game/engine.ts'
import { applyMacroShock } from '../../src/game/market.ts'
import { serializeLog } from '../../src/game/log.ts'

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
      assert.equal((html.match(/class="event-asset"/g) ?? []).length, 3)
      assert.match(html, /BIẾN CỐ KINH TẾ/); assert.match(html, /Góc nhìn tài chính/)
      assert.match(html, /Bình quân đều các mã/); assert.match(html, /An Tâm/); assert.match(html, /Bứt Phá/)
      assert.match(html, /Áp lực trả nợ/); assert.doesNotMatch(html, /Đang chậm trả|Đang thu hồi vốn/)
      assert.match(html, /Xem chi tiết thị trường/); assert.doesNotMatch(html, /<details[^>]*\bopen/)
      assert.equal((html.match(/Đã hiểu · Tiếp tục/g) ?? []).length, 1)
      assert.doesNotMatch(html, /Thị trường vừa thay đổi\. Cơ hội mới/)
      assert.doesNotMatch(html, /event-portfolio/)
      assert.equal(serializeLog(game), saved)
    })
    await t.test('zero movement is neutral, missing log unavailable and legacy single issuer supported', () => {
      const base = { ...createMobileGame('zero-ui', 0), scenarioId: 'growth', phase: 'event' as const, eventId: 'demand-boom', position: 5, turn: 1 }
      assert.match(render(applyMacroShock(base, 'demand-boom')), /event-movement flat[^>]*[^<]*>↔ 0%/)
      assert.match(render(base), /Chưa đủ dữ liệu/)
      const legacy = applyMacroShock({ ...createMobileGame('legacy-ui', 0, 1, 'v2.4-single-issuer'), phase: 'event', eventId: 'credit-tightening', position: 5, turn: 1 }, 'credit-tightening')
      const html = render(legacy)
      assert.doesNotMatch(html, /event-issuers/)
      assert.match(html, /Giá giảm 6%/)
    })
    await t.test('business valuation only appears in optional portfolio disclosure, never main comparison', () => {
      let game = createMobileGame('business-event-ui', 0)
      game = transact({ ...game, phase: 'event', eventId: 'business', position: 8, turn: 1 }, { kind: 'buy', asset: 'business', amount: 20e6 })
      game = applyMacroShock({ ...game, phase: 'event', eventId: 'credit-tightening', position: 5, turn: 2 }, 'credit-tightening')
      const html = render(game), main = html.split('class="event-portfolio"')[0]
      assert.doesNotMatch(main, /Vốn quán|thu nhập vận hành/)
      assert.match(html, /Tài sản của bạn bị ảnh hưởng thế nào/)
      assert.match(html, /không tính thu nhập vận hành quán/)
      assert.match(html, /Thay đổi định giá chưa thực hiện/)
    })
  } finally { await server.close() }
})
