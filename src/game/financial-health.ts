import type { Asset, GameState } from './types.ts'
import { liquidatableFunds } from './selectors.ts'
import { money } from './format.ts'
import { RULES } from '../data/config.ts'

export const SAFE_EMERGENCY_BUFFER = 10_000_000;

export interface TradeOffPreview {
  cashAfter: number;
  bufferStatus: 'safe' | 'warning' | 'danger';
  bufferRatio: number;
  expectedYieldPercent: number;
  lockupLaps: number;
  riskLevel: 'low' | 'medium' | 'high';
  warningMessage?: string;
}

export function evaluateTradeOff(
  game: GameState,
  cost: number,
  assetType: Asset | 'savings' | 'course',
  options?: { lockupLaps?: number; yieldRate?: number }
): TradeOffPreview {
  const cashAfter = Math.max(0, game.portfolio.cash - cost);
  const bufferRatio = cashAfter / SAFE_EMERGENCY_BUFFER;
  
  let bufferStatus: 'safe' | 'warning' | 'danger' = 'safe';
  let warningMessage: string | undefined;

  if (cashAfter < 5_000_000) {
    bufferStatus = 'danger';
    warningMessage = 'Cảnh báo nguy cấp: Tiền mặt dưới 5M, đối mặt nguy cơ mất thanh khoản khi gặp biến cố y tế/xe cộ!';
  } else if (cashAfter < SAFE_EMERGENCY_BUFFER) {
    bufferStatus = 'warning';
    warningMessage = 'Lưu ý đệm an toàn: Tiền mặt dưới 10M, cần cẩn trọng nếu phát sinh chi phí sinh hoạt hoặc cú sốc kinh tế.';
  }

  const lockupLaps = options?.lockupLaps ?? (
    assetType === 'business' ? Math.max(1, game.totalLaps - game.lap) :
    assetType === 'savings' ? 1 :
    assetType === 'bonds' ? 2 : 0
  );

  const expectedYieldPercent = options?.yieldRate ?? (
    assetType === 'savings' ? 6 :
    assetType === 'bonds' ? 7.5 :
    assetType === 'stocks' ? 12 :
    assetType === 'business' ? 18 :
    assetType === 'course' ? 25 : 5
  );

  const riskLevel: 'low' | 'medium' | 'high' = 
    assetType === 'savings' ? 'low' :
    assetType === 'bonds' || assetType === 'gold' ? 'medium' : 'high';

  return {
    cashAfter,
    bufferStatus,
    bufferRatio,
    expectedYieldPercent,
    lockupLaps,
    riskLevel,
    warningMessage,
  };
}

export interface FinancialHealthReport {
  overallScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  title: string;
  verdict: string;
  pillarScores: {
    cashflowScore: number;       // Quản trị dòng tiền & thanh khoản (max 25)
    diversificationScore: number; // Đa dạng hóa danh mục (max 25)
    growthScore: number;          // Tăng trưởng tài sản & ROI (max 25)
    riskControlScore: number;     // Kiểm soát rủi ro & nợ xấu (max 25)
  };
  keyTurningPoints: Array<{
    lap: number;
    title: string;
    description: string;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  actionableInsights: string[];
}

export function evaluateFinancialHealth(game: GameState): FinancialHealthReport {
  const funds = liquidatableFunds(game);
  const won = funds >= 90_000_000;
  const initialCap = RULES.startingCapital; // 50M

  // 1. Quản trị Dòng tiền (Cashflow & Runway): Max 25 điểm
  // Đánh giá dựa trên tiền mặt cuối ván và việc tránh rơi vào cảnh thiếu nợ / mất thanh khoản
  let cashflowScore = 15;
  if (game.portfolio.cash >= SAFE_EMERGENCY_BUFFER) cashflowScore += 10;
  else if (game.portfolio.cash >= 5_000_000) cashflowScore += 5;
  if (game.portfolio.debt > 0) cashflowScore = Math.max(0, cashflowScore - 10);

  // 2. Đa dạng hóa danh mục (Diversification): Max 25 điểm
  // Đếm số kênh đầu tư người chơi đã kích hoạt (> 0)
  const activeChannels = [
    game.deposits.some(d => d.principal > 0) || game.portfolio.savings > 0,
    game.portfolio.stocks > 0,
    game.portfolio.bonds > 0,
    game.portfolio.gold > 0,
    game.portfolio.business > 0,
    (game.ownedCourses && game.ownedCourses.length > 0) || game.coursePurchased,
  ].filter(Boolean).length;

  const diversificationScore = Math.min(25, activeChannels * 5);

  // 3. Hiệu suất tăng trưởng (Growth & ROI): Max 25 điểm
  // Dựa trên mức vượt mục tiêu 90M hoặc mức lợi nhuận trên vốn 50M
  const profit = funds - initialCap;
  let growthScore: number;
  if (profit >= 40_000_000) growthScore = 25; // >= 90M
  else if (profit >= 30_000_000) growthScore = 20; // 80M - 89M
  else if (profit >= 20_000_000) growthScore = 15; // 70M - 79M
  else if (profit >= 10_000_000) growthScore = 10; // 60M - 69M
  else growthScore = 5;

  // 4. Kiểm soát rủi ro (Risk Control): Max 25 điểm
  let riskControlScore = 20;
  if (game.portfolio.debt === 0) riskControlScore += 5;
  else riskControlScore -= Math.min(15, Math.round((game.portfolio.debt / 10_000_000) * 5));

  // Phạt nếu bị kẹt vốn nặng trong tiệm kinh doanh vào cuối ván
  if (game.portfolio.business > 15_000_000 && !won) {
    riskControlScore = Math.max(0, riskControlScore - 8);
  }

  const overallScore = Math.min(100, Math.max(0, cashflowScore + diversificationScore + growthScore + riskControlScore));

  let grade: 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
  let title = 'Nhà Đầu Tư Mới Vào Nghề';
  let verdict = 'Bạn cần rèn luyện thêm kỹ năng quản trị dòng tiền và phân bổ vốn để chinh phục mốc 90M.';

  if (overallScore >= 90 && won) {
    grade = 'S';
    title = 'Bậc Thầy Quản Trị Tài Chính';
    verdict = 'Xuất sắc! Bạn làm chủ hoàn hảo cả 4 trụ cột: dòng tiền dồi dào, danh mục cân bằng và bứt phá mục tiêu 90M ngoạn mục.';
  } else if (overallScore >= 80) {
    grade = 'A';
    title = 'Nhà Đầu Tư Chiến Lược';
    verdict = 'Rất tốt! Chiến lược đầu tư bài bản, kiểm soát rủi ro vững vàng và tạo ra lợi nhuận bền vững.';
  } else if (overallScore >= 70) {
    grade = 'B';
    title = 'Nhà Đầu Tư Thận Trọng';
    verdict = 'Khá ổn định! Bạn giữ được an toàn vốn nhưng cần chủ động chớp thời cơ sinh lời lớn hơn để về đích.';
  } else if (overallScore >= 60) {
    grade = 'C';
    title = 'Nhà Đầu Tư Phòng Thủ';
    verdict = 'Dòng tiền còn mong manh hoặc chưa tận dụng hết sức mạnh của lãi kép và các kênh đầu tư sinh lời.';
  }

  // Phân tích các bước ngoặt then chốt trong nhật ký
  const keyTurningPoints: FinancialHealthReport['keyTurningPoints'] = [];

  // Kiểm tra khóa học
  if (game.ownedCourses && game.ownedCourses.length > 0) {
    keyTurningPoints.push({
      lap: 1,
      title: 'Đầu Tư Bản Thân Kịp Thời',
      description: 'Nâng cấp kỹ năng sớm giúp tăng lương định kỳ qua mỗi lần qua ô Xuất phát, tạo dòng tiền dồi dào.',
      impact: 'positive',
    });
  }

  // Kiểm tra nợ
  if (game.portfolio.debt > 0) {
    keyTurningPoints.push({
      lap: game.lap,
      title: 'Áp Lực Gánh Nặng Nợ',
      description: `Khoản nợ ${money(game.portfolio.debt)} làm suy giảm nguồn tiền huy động hợp lệ khi xét mục tiêu 90M.`,
      impact: 'negative',
    });
  }

  // Kiểm tra vốn kẹt trong kinh doanh
  if (game.portfolio.business > 0 && !won) {
    keyTurningPoints.push({
      lap: 4,
      title: 'Bẫy Kẹt Vốn Kinh Doanh (Illiquidity Trap)',
      description: 'Vốn nằm trong cơ sở kinh doanh chưa kịp bán thanh lý ra tiền mặt, không được tính vào 90M hợp lệ.',
      impact: 'negative',
    });
  }

  // Kiểm tra coupon trái phiếu / cổ tức
  if (game.portfolio.bonds >= 16_000_000) {
    keyTurningPoints.push({
      lap: 2,
      title: 'Dòng Thu Nhập Thụ Động Từ Trái Phiếu',
      description: 'Coupon định kỳ từ trái phiếu đã bổ trợ vững chắc cho quỹ dự phòng tiền mặt.',
      impact: 'positive',
    });
  }

  // Lời khuyên hành động (Actionable Insights)
  const actionableInsights: string[] = [];
  if (game.portfolio.cash < SAFE_EMERGENCY_BUFFER) {
    actionableInsights.push('Luôn duy trì tối thiểu 10.000.000 đ tiền mặt để sẵn sàng cho chi phí sinh hoạt và biến cố cá nhân.');
  }
  if (!game.coursePurchased && (!game.ownedCourses || game.ownedCourses.length === 0)) {
    actionableInsights.push('Hãy ưu tiên học khóa học ngay từ Vòng 1 hoặc Vòng 2 để tối ưu hóa ROI tăng lương suốt 4 vòng chơi.');
  }
  if (game.portfolio.business > 0 && game.portfolio.cash < 8_000_000) {
    actionableInsights.push('Chỉ mở tiệm kinh doanh khi bạn đã có nguồn tiền nhàn rỗi vững vàng để tránh bị kẹt vốn không rút kịp.');
  }
  if (activeChannels < 3) {
    actionableInsights.push('Hãy phân bổ vốn vào ít nhất 3 kênh (Tiết kiệm, Trái phiếu, Cổ phiếu/Vàng) để giảm thiểu biến động thị trường.');
  }

  return {
    overallScore,
    grade,
    title,
    verdict,
    pillarScores: {
      cashflowScore,
      diversificationScore,
      growthScore,
      riskControlScore,
    },
    keyTurningPoints,
    actionableInsights,
  };
}
