import test from 'node:test'
import assert from 'node:assert/strict'
import { investmentLotLabel, maturityLabel, localizePlayerText, tileDisplayLabel, savingsPeriodExplanation } from '../src/components/player-language.ts'
import { localizeNarrative } from '../src/components/glossary.ts'

test('savings numbering uses persistent IDs rather than current list order', () => {
  const deposits=[{id:'deposit-1',status:'matured'},{id:'deposit-2',status:'withdrawn'},{id:'deposit-3',status:'active'},{id:'deposit-10',status:'active'}]
  const labels=deposits.filter(d=>d.status==='active').map(d=>investmentLotLabel('savings',d.id))
  assert.deepEqual(labels,['Khoản tiết kiệm 3','Khoản tiết kiệm 10'])
  assert.equal(investmentLotLabel('savings','deposit-2'),'Khoản tiết kiệm 2')
  assert.equal(investmentLotLabel('savings','lot-7'),'Khoản tiết kiệm 7')
  assert.equal(investmentLotLabel('savings','unknown-private-id'),'Khoản tiết kiệm')
})
test('bond labels preserve their own persistent sequence and never expose transaction IDs', () => {
  assert.equal(investmentLotLabel('bonds','bond-12'),'Khoản trái phiếu 12')
  assert.equal(investmentLotLabel('bonds','lot-4'),'Khoản trái phiếu 4')
})
test('maturity is the absolute passage index, independent of current lap or selected term', () => {
  const lots=[{id:'deposit-1',startLap:1,maturityLap:3},{id:'deposit-2',startLap:2,maturityLap:4}]
  assert.deepEqual(lots.map(l=>maturityLabel(l.maturityLap)),['Đáo hạn khi qua ô Xuất phát lần thứ 3','Đáo hạn khi qua ô Xuất phát lần thứ 4'])
  assert.equal(maturityLabel(lots[0].maturityLap),maturityLabel(3))
})
test('historical text is localized only for presentation, including internal lot labels and START', () => {
  const old=Object.freeze({text:'deposit-2 đáo hạn START 3; bond-7 tại START; FPT JSON',maturityLap:3,id:'deposit-2'})
  assert.equal(localizePlayerText(old.text),'Khoản tiết kiệm 2 đáo hạn khi qua ô Xuất phát lần thứ 3; Khoản trái phiếu 7 tại ô Xuất phát; FPT JSON')
  assert.equal(old.text,'deposit-2 đáo hạn START 3; bond-7 tại START; FPT JSON')
  assert.equal(old.id,'deposit-2')
  assert.equal(localizePlayerText('issuerId couponRate maturityLap START_INTERNAL XV-MAY'),'issuerId couponRate maturityLap START_INTERNAL XV-MAY')
})
test('tile display and savings period explanations are Vietnamese while source identifiers stay intact', () => {
  assert.equal(tileDisplayLabel('START'),'Xuất phát')
  assert.equal(tileDisplayLabel('Cổ phiếu'),'Cổ phiếu')
  assert.match(savingsPeriodExplanation,/mỗi lần qua ô Xuất phát/)
  assert.match(savingsPeriodExplanation,/lãi đơn.*cuối kỳ hạn/i)
  assert.doesNotMatch(savingsPeriodExplanation,/START|tái tục tự động/)
})

test('historical lot IDs are localized before ordinary English words in the shared renderer', () => {
  assert.equal(localizeNarrative('Rút lot-4 tại START; deposit-10; bond-7'),'Rút Khoản 4 tại ô Xuất phát; Khoản tiết kiệm 10; Khoản trái phiếu 7')
})
