import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/game/engine.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'
import type { GameState } from '../src/game/types.ts'

test('AI Coach Facts: ném lỗi nếu game chưa kết thúc (game.phase !== "finished")', () => {
  const game = createGame('test-seed', 10_000_000, 1, 'experimental-b')
  assert.equal(game.phase, 'forecast')
  assert.throws(
    () => buildCoachFacts(game),
    /Chỉ có thể tạo AI Coach facts khi ván chơi đã kết thúc/
  )
})

test('AI Coach Facts: kịch bản THẮNG đạt trên 90M hợp lệ', () => {
  const base = createGame('seed-win', 0, 1, 'experimental-b')
  // Giả lập trạng thái kết thúc ván thắng
  const finishedGame: GameState = {
    ...base,
    phase: 'finished',
    lap: 4,
    termination: 'completed',
    coursePurchased: true,
    portfolio: {
      ...base.portfolio,
      cash: 95_000_000,
      savings: 0,
      stocks: 0,
      bonds: 0,
      gold: 0,
      business: 0,
      debt: 0,
    },
  }

  const facts = buildCoachFacts(finishedGame)
  assert.equal(facts.version, 1)
  assert.equal(facts.completed, true)
  assert.equal(facts.won, true)
  assert.equal(facts.insolvent, false)
  assert.equal(facts.lawfulProceedsVnd, 95_000_000)
  assert.ok(facts.lawfulProceedsVnd >= facts.targetProceedsVnd)

  // Kiểm tra bằng chứng
  assert.ok(facts.evidence.length <= 8)
  const goalEvidence = facts.evidence.find(e => e.kind === 'goal-result')
  assert.ok(goalEvidence)
  assert.equal(goalEvidence.id, 'ev:goal-achieved')
  assert.match(goalEvidence.fact, /Đạt mục tiêu thành công/)

  // Khóa học bản thân
  const courseEvidence = facts.evidence.find(e => e.kind === 'course')
  assert.ok(courseEvidence)
  assert.equal(courseEvidence.id, 'ev:course-purchased')
})

test('AI Coach Facts: kịch bản THUA do vốn kẹt trong kinh doanh (Liquidity Gap & Locked Business)', () => {
  const base = createGame('seed-locked', 0, 1, 'experimental-b')
  // Giả lập: Net Worth = 110M (vượt 90M), nhưng tiền mặt 50M + kinh doanh 60M chưa bán -> lawfulProceeds = 50M < 90M
  const finishedGame: GameState = {
    ...base,
    phase: 'finished',
    lap: 4,
    termination: 'completed',
    portfolio: {
      ...base.portfolio,
      cash: 50_000_000,
      business: 60_000_000,
      savings: 0,
      stocks: 0,
      bonds: 0,
      gold: 0,
      debt: 0,
    },
    business: {
      ...base.business,
      capital: 60_000_000,
      upgrades: { taste: 2 },
    },
  }

  const facts = buildCoachFacts(finishedGame)
  assert.equal(facts.won, false)
  assert.equal(facts.netWorthVnd, 110_000_000)
  assert.equal(facts.lawfulProceedsVnd, 50_000_000)
  assert.equal(facts.businessLockedQuoteVnd, 60_000_000)

  // Bắt buộc có 2 bằng chứng: business-locked và liquidity-gap
  const lockedEv = facts.evidence.find(e => e.id === 'ev:business-locked')
  assert.ok(lockedEv, 'Phải có evidence business-locked')
  assert.equal(lockedEv.kind, 'business-locked')
  assert.match(lockedEv.fact, /60\.000\.000 VND chưa thanh lý/)

  const gapEv = facts.evidence.find(e => e.id === 'ev:liquidity-gap')
  assert.ok(gapEv, 'Phải có evidence liquidity-gap khi netWorth > 90M nhưng không thắng')
  assert.equal(gapEv.kind, 'liquidity-gap')
})

test('AI Coach Facts: kịch bản RÚT TIẾT KIỆM SỚM mất lãi', () => {
  const base = createGame('seed-savings', 30_000_000, 3, 'experimental-b')
  const finishedGame: GameState = {
    ...base,
    phase: 'finished',
    lap: 4,
    termination: 'completed',
    deposits: [
      {
        id: 'deposit-1',
        principal: 30_000_000,
        startLap: 1,
        maturityLap: 3,
        rate: 0.06,
        status: 'withdrawn',
        earnedInterest: 0,
      },
    ],
    log: [
      {
        sequence: 1,
        kind: 'funding',
        lap: 2,
        turn: 8,
        tileId: 5,
        title: 'Huy động tiền khẩn cấp',
        decision: 'Rút sổ tiết kiệm deposit-1',
        consequence: 'Mất lãi 5.400.000 VND',
        cashDelta: 30_000_000,
        savingsDelta: -30_000_000,
        stockDelta: 0,
        bondDelta: 0,
        goldDelta: 0,
        businessDelta: 0,
        debtDelta: 0,
        recurringIncomeDelta: 0,
        forcedWithdrawalAmount: 30_000_000,
        lostSavingsInterest: 5_400_000,
        forcedAssetSaleAmount: 0,
        assetSaleAmounts: { stocks: 0, bonds: 0, gold: 0 },
        obligationCreated: 0,
        cashProceeds: 30_000_000,
        expensePaid: 0,
        debtInterestPaid: 0,
        debtInterestAccrued: 0,
        before: base,
        after: base,
      },
    ],
  }

  const facts = buildCoachFacts(finishedGame)
  const savingsEv = facts.evidence.find(e => e.kind === 'savings-withdrawal')
  assert.ok(savingsEv, 'Phải có evidence savings-withdrawal')
  assert.match(savingsEv.fact, /5\.400\.000 VND/)
})

test('AI Coach Facts: kịch bản VAY NỢ và PHÁ SẢN (Insolvent)', () => {
  const base = createGame('seed-insolvent', 0, 1, 'experimental-b')
  const insolventGame: GameState = {
    ...base,
    phase: 'finished',
    lap: 3,
    turn: 15,
    termination: 'insolvent',
    portfolio: {
      ...base.portfolio,
      cash: 200_000,
      debt: 15_000_000,
      savings: 0,
      stocks: 0,
      bonds: 0,
      gold: 0,
      business: 0,
    },
    log: [
      {
        sequence: 2,
        kind: 'settlement',
        lap: 3,
        turn: 14,
        tileId: 0,
        title: 'Trả lãi nợ',
        decision: 'Thanh toán lãi',
        consequence: 'Trừ lãi',
        cashDelta: -1_500_000,
        savingsDelta: 0,
        stockDelta: 0,
        bondDelta: 0,
        goldDelta: 0,
        businessDelta: 0,
        debtDelta: 0,
        recurringIncomeDelta: 0,
        forcedWithdrawalAmount: 0,
        lostSavingsInterest: 0,
        forcedAssetSaleAmount: 0,
        assetSaleAmounts: { stocks: 0, bonds: 0, gold: 0 },
        obligationCreated: 0,
        cashProceeds: 0,
        expensePaid: 0,
        debtInterestPaid: 1_500_000,
        debtInterestAccrued: 0,
        before: base,
        after: base,
      },
    ],
  }

  const facts = buildCoachFacts(insolventGame)
  assert.equal(facts.insolvent, true)
  assert.equal(facts.won, false)

  const insolvEv = facts.evidence.find(e => e.kind === 'insolvency')
  assert.ok(insolvEv, 'Phải có evidence insolvency')
  assert.match(insolvEv.fact, /Mất khả năng thanh toán/)

  const debtEv = facts.evidence.find(e => e.id === 'ev:outstanding-debt')
  assert.ok(debtEv, 'Phải có evidence outstanding debt')
  assert.match(debtEv.fact, /15\.000\.000 VND/)
})

test('AI Coach Facts: kiểm tra toàn vẹn dữ liệu, kích thước payload < 10KB và giới hạn 8 evidences', () => {
  const base = createGame('seed-limits', 10_000_000, 1, 'experimental-b')
  const game: GameState = {
    ...base,
    phase: 'finished',
    lap: 4,
    termination: 'completed',
    coursePurchased: true,
    portfolio: {
      ...base.portfolio,
      cash: 70_000_000,
      stocks: 5_000_000,
      gold: 5_000_000,
      bonds: 5_000_000,
      business: 10_000_000,
      debt: 2_000_000,
      savings: 0,
    },
    market: {
      ...base.market,
      appliedShocks: ['shock-1', 'shock-2'],
    },
  }

  const facts = buildCoachFacts(game)

  // 1. Tối đa 8 evidences
  assert.ok(facts.evidence.length <= 8, `Số lượng evidence (${facts.evidence.length}) phải <= 8`)

  // 2. Không có ID trùng lặp
  const ids = facts.evidence.map(e => e.id)
  const uniqueIds = new Set(ids)
  assert.equal(ids.length, uniqueIds.size, 'Mọi evidenceId phải là duy nhất')

  // 3. Kích thước payload JSON < 10 KB (10240 bytes)
  const jsonString = JSON.stringify(facts)
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8')
  assert.ok(sizeBytes < 10240, `Kích thước facts (${sizeBytes} bytes) phải nhỏ hơn 10 KB`)

  // 4. Toàn bộ số tiền đều là Safe Integer
  assert.ok(Number.isSafeInteger(facts.lawfulProceedsVnd))
  assert.ok(Number.isSafeInteger(facts.netWorthVnd))
  assert.ok(Number.isSafeInteger(facts.cashVnd))
  assert.ok(Number.isSafeInteger(facts.debtVnd))
  assert.ok(Number.isSafeInteger(facts.businessLockedQuoteVnd))
})
