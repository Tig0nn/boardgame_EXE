import type { Asset, Category } from '../game/types.ts'

export const RULES = {
  laps: 3, tiles: 20, startingCapital: 50_000_000, recurringIncome: 14_000_000,
  livingCost: 7_000_000, goal: 80_000_000, cashGoal: 10_000_000, savingsRate: 0.06, debtRate: 0.1,
  courseCost: 6_000_000, courseBoost: 3_000_000, borrowingLimit: 30_000_000,
}
// Experimental calibration snapshot; confirmed salary/course rules live in RULES.
export const ECONOMY = {
  savingsRates: { 1: 0.06, 2: 0.07, 3: 0.08 },
  tradeFees: { stocks: 0.01, bonds: 0.015, gold: 0.01 }, goldSpread: 0.03,
  stockTicket: 10_000_000, goldTicket: 6_000_000, bondTicket: 8_000_000,
  bond: { issuer: 'Liên hiệp Mây Ngọc (giả lập)', facePrice: 100_000, coupon: 0.05, term: 2,
    creditRisk: 'Giá bán có thể giảm do rủi ro tín dụng; mẫu hiện tại không mô phỏng vỡ nợ ngẫu nhiên.' },
  market: { historyPoints: 12, initialStockPrice: 100_000, initialGoldPrice: 1_000_000,
    sectorVolatility: 0.035, minimumReturn: -0.8, historyMarketVolatility: 0.07,
    historySectorVolatility: 0.025, historyGoldVolatility: 0.1, historyBondVolatility: 0.03 },
  business: { cost: 20_000_000, baseIncome: 3_000_000, upgradeCost: 5_000_000,
    baseUplift: 700_000, matchingBonus: 1_000_000, maxUpgrades: 6,
    capitalRecovery: 0.7, upgradeRecovery: 0.5, depreciation: 0.08,
    trendIncome: { growth: 1.25, uncertain: 0.75, recovery: 1.1 },
    trendWeights: { growth: 1, uncertain: 1, recovery: 1 },
    minimumEconomicMultiplier: 0.3, maximumEconomicMultiplier: 1.8,
    economicIncomeImpact: 2_000_000 },
  personal: { medical: [5_000_000, 6_000_000], repair: [4_000_000, 1_000_000, 4_000_000],
    family: [3_000_000, 3_500_000] },
  obligation: { bills: [2_000_000, 2_500_000], contract: [1_500_000, 2_000_000], bonus: 2_000_000 },
}
export const STOCKS = [
  { id: 'XV-MAY', name: 'Mây Lục', sector: 'technology', volatility: 0.06 },
  { id: 'XV-HAT', name: 'Hạt Sáng', sector: 'technology', volatility: 0.08 },
  { id: 'XV-SONG', name: 'Ngân hàng Sông Biếc', sector: 'banking', volatility: 0.04 },
  { id: 'XV-DEM', name: 'Ngân hàng Đệm Xanh', sector: 'banking', volatility: 0.05 },
  { id: 'XV-GOM', name: 'Xưởng Gốm Sao', sector: 'manufacturing', volatility: 0.05 },
  { id: 'XV-SOI', name: 'Sợi Nắng', sector: 'manufacturing', volatility: 0.07 },
]
export const SECTORS: Record<string, string> = { technology: 'Công nghệ', banking: 'Ngân hàng', manufacturing: 'Sản xuất' }
export const MACRO_EVENTS = [
  { id: 'credit-tightening', label: 'Tín dụng thắt chặt', stocks: { technology: -0.12, banking: -0.16, manufacturing: -0.1 }, bonds: -0.06, gold: 0.08, business: -0.2 },
  { id: 'demand-boom', label: 'Nhu cầu khởi sắc', stocks: { technology: 0.14, banking: 0.08, manufacturing: 0.12 }, bonds: 0.02, gold: -0.05, business: 0.2 },
  { id: 'supply-recovery', label: 'Chuỗi cung ứng phục hồi', stocks: { technology: 0.06, banking: -0.03, manufacturing: 0.16 }, bonds: -0.02, gold: -0.04, business: 0.1 },
]
export const CATEGORIES: Record<Category, { label: string; short: string; icon: string }> = {
  investment: { label: 'Cơ hội sinh lời', short: 'Cơ hội sinh lời', icon: 'chart' },
  income: { label: 'Cơ hội tăng thu nhập', short: 'Cơ hội tăng thu nhập', icon: 'wallet' },
  shock: { label: 'Biến cố tài chính', short: 'Biến cố tài chính', icon: 'bolt' },
  obligation: { label: 'Dòng tiền & nghĩa vụ', short: 'Dòng tiền & nghĩa vụ', icon: 'receipt' },
}
export const ASSETS: Record<Asset | 'cash' | 'savings', { label: string; icon: string }> = {
  cash: { label: 'Tiền mặt', icon: 'wallet' }, savings: { label: 'Tiết kiệm', icon: 'bank' },
  stocks: { label: 'Cổ phiếu', icon: 'chart' }, bonds: { label: 'Trái phiếu', icon: 'receipt' },
  gold: { label: 'Vàng', icon: 'gold' }, business: { label: 'Kinh doanh', icon: 'shop' },
}
export interface Scenario {
  id: string; label: string; description: string
  tendencies: Record<Asset, string>; ranges: Record<Asset, [number, number]>
}
export const SCENARIOS: Scenario[] = [
  { id: 'growth', label: 'Nhịp tăng trưởng', description: 'Tiêu dùng khởi sắc, doanh nghiệp có thêm cơ hội. Thị trường vẫn có thể đi ngược dự báo.',
    tendencies: { stocks: 'Xu hướng tăng', bonds: 'Khá ổn định', gold: 'Có thể hạ nhiệt', business: 'Nhu cầu tích cực' },
    ranges: { stocks: [-0.08, 0.3], bonds: [0.03, 0.07], gold: [-0.1, 0.12], business: [0.15, 0.5] } },
  { id: 'uncertain', label: 'Thị trường thận trọng', description: 'Nhà đầu tư dè dặt hơn. Tài sản phòng thủ được chú ý, nhưng không có kết quả nào được đảm bảo.',
    tendencies: { stocks: 'Dễ biến động', bonds: 'Khá ổn định', gold: 'Được quan tâm', business: 'Tiêu dùng chậm lại' },
    ranges: { stocks: [-0.22, 0.16], bonds: [0.02, 0.06], gold: [-0.05, 0.2], business: [-0.08, 0.28] } },
  { id: 'recovery', label: 'Tín hiệu phục hồi', description: 'Niềm tin đang quay trở lại. Cơ hội xuất hiện cùng những biến động khó đoán.',
    tendencies: { stocks: 'Có cơ hội phục hồi', bonds: 'Tăng trưởng nhẹ', gold: 'Đi ngang', business: 'Dần khởi sắc' },
    ranges: { stocks: [-0.12, 0.25], bonds: [0.03, 0.08], gold: [-0.08, 0.14], business: [0.05, 0.4] } },
]
