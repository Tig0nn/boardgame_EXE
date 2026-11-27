// Episodic Map & Chapter System Configuration & Persistence
// Xoay Vòng Tiến Lui (XVTL) — Mobile UI V2.4

export type NodeStatus = 'completed' | 'active' | 'locked';

export interface MapNodeConfig {
  id: string; // '1.1', '1.2', '1.3', '1.4'
  chapterId: number; // 1
  stageNumber: number; // 1, 2, 3, 4
  title: string;
  subtitle: string;
  description: string;
  financialGoalText: string;
  targetNetWorth: number; // in VND
  rewards: { gold: number; gems: number };
  x: number; // Percentage coordinate for winding trail (0 - 100)
  y: number; // Top percentage coordinate (0 - 100)
}

export interface MilestoneChestConfig {
  id: string;
  name: string;
  requiredNodeId: string;
  rewards: { gold: number; gems: number };
  x: number;
  y: number;
}

export interface PlayerMapProgress {
  currentChapter: number;
  activeNodeId: string;
  completedNodeIds: string[];
  openedChestIds: string[];
  gems: number;
  gold: number;
  unlockedChapters: number[];
}

export const MAP_1_NODES: MapNodeConfig[] = [
  {
    id: '1.1',
    chapterId: 1,
    stageNumber: 1,
    title: 'Chương 1: Khởi Nghiệp',
    subtitle: 'Khởi đầu 50 Triệu & Quỹ khẩn cấp',
    description: 'Nhận 50M vốn ban đầu, làm quen bàn cờ B18 và thiết lập kế hoạch tiết kiệm an toàn trước khi vào vòng xoáy thị trường.',
    financialGoalText: 'Bảo toàn vốn ≥ 50.000.000 đ & thiết lập danh mục.',
    targetNetWorth: 50_000_000,
    rewards: { gold: 1_000_000, gems: 20 },
    x: 46.5,
    y: 86.5,
  },
  {
    id: '1.2',
    chapterId: 1,
    stageNumber: 2,
    title: 'Chương 2: Vòng Quay Cơ Hội',
    subtitle: 'Tích lũy & Dòng tiền ròng',
    description: 'Khai thác lương 14M khi qua ô START, mở sổ tiết kiệm hoặc thử sức với Cổ phiếu & Vàng để tăng trưởng dòng tiền.',
    financialGoalText: 'Tích lũy tài sản ròng ≥ 65.000.000 đ.',
    targetNetWorth: 65_000_000,
    rewards: { gold: 2_000_000, gems: 30 },
    x: 78.2,
    y: 74.2,
  },
  {
    id: '1.3',
    chapterId: 1,
    stageNumber: 3,
    title: 'Chương 3: Thử Thách Bứt Phá',
    subtitle: 'Đầu tư đa kênh & Quản trị rủi ro',
    description: 'Ứng phó với các cú sốc sự kiện vĩ mô, đa dạng hóa danh mục Trái phiếu V2.5 hoặc mở quán kinh doanh đón xu hướng khách hàng.',
    financialGoalText: 'Tích lũy tài sản ròng ≥ 78.000.000 đ & không nợ xấu.',
    targetNetWorth: 78_000_000,
    rewards: { gold: 3_000_000, gems: 40 },
    x: 12.8,
    y: 57.5,
  },
  {
    id: '1.4',
    chapterId: 1,
    stageNumber: 4,
    title: 'Chương 4: Về Đích 90 Triệu',
    subtitle: 'Boss Checkpoint — Huy Động Hợp Lệ',
    description: 'Chặng chung kết quyết định! Thanh lý tài sản, thu hồi tiền gửi và trả nợ để đạt mục tiêu huy động hợp lệ tối thiểu 90M VND.',
    financialGoalText: 'Tiền về đích hợp lệ ≥ 90.000.000 đ (80M + 10M dự phòng).',
    targetNetWorth: 90_000_000,
    rewards: { gold: 5_000_000, gems: 100 },
    x: 37.2,
    y: 34.0,
  },
  {
    id: '1.5',
    chapterId: 1,
    stageNumber: 5,
    title: 'Chương 5: Đỉnh Cao Khởi Nghiệp',
    subtitle: 'Đỉnh Cao Tài Chính — Khải Hoàn Mỏ Hỗn',
    description: 'Chinh phục hòn đảo tối thượng! Tối ưu hóa toàn diện lợi nhuận, tích lũy tự do tài chính và mở khóa cánh cổng Chương 2.',
    financialGoalText: 'Tích lũy tài sản thịnh vượng & làm chủ hành trình tài chính.',
    targetNetWorth: 100_000_000,
    rewards: { gold: 10_000_000, gems: 150 },
    x: 54.0,
    y: 14.0,
  },
];

export const MAP_1_CHESTS: MilestoneChestConfig[] = [
  {
    id: 'chest-mid',
    name: 'Rương Tăng Tốc',
    requiredNodeId: '1.2',
    rewards: { gold: 1_500_000, gems: 25 },
    x: 52,
    y: 48,
  },
  {
    id: 'chest-boss',
    name: 'Kho Báu Khởi Nghiệp',
    requiredNodeId: '1.4',
    rewards: { gold: 5_000_000, gems: 80 },
    x: 50,
    y: 7,
  },
];

const MAP_PROGRESS_KEY = 'xvtl:mobile:map_progress:v1';

export function getInitialMapProgress(): PlayerMapProgress {
  return {
    currentChapter: 1,
    activeNodeId: '1.1',
    completedNodeIds: [],
    openedChestIds: [],
    gems: 50,
    gold: 50_000_000,
    unlockedChapters: [1],
  };
}

export function loadMapProgress(): PlayerMapProgress {
  try {
    const raw = window.localStorage.getItem(MAP_PROGRESS_KEY);
    if (!raw) return getInitialMapProgress();
    const parsed = JSON.parse(raw);
    return {
      currentChapter: 1,
      activeNodeId: '1.1', // Chương 1 là chương duy nhất mở khóa để chơi
      completedNodeIds: [], // Các chương 2-5 chưa mở khóa
      openedChestIds: Array.isArray(parsed.openedChestIds) ? parsed.openedChestIds : [],
      gems: parsed.gems ?? 50,
      gold: parsed.gold ?? 50_000_000,
      unlockedChapters: [1], // Chỉ Chương 1 mở khóa
    };
  } catch {
    return getInitialMapProgress();
  }
}

export function saveMapProgress(progress: PlayerMapProgress): void {
  try {
    window.localStorage.setItem(MAP_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Non-blocking for environments where local storage is full or restricted
  }
}

export function unlockNextNode(completedId: string, current: PlayerMapProgress): PlayerMapProgress {
  const completed = Array.from(new Set([...current.completedNodeIds, completedId]));
  const nodeOrder = MAP_1_NODES.map(n => n.id);
  const idx = nodeOrder.indexOf(completedId);
  const nextNodeId = idx !== -1 && idx < nodeOrder.length - 1 ? nodeOrder[idx + 1] : completedId;
  const unlockedChapters = [...current.unlockedChapters];
  
  if ((completedId === '1.4' || completedId === '1.5') && !unlockedChapters.includes(2)) {
    unlockedChapters.push(2);
  }

  const updated: PlayerMapProgress = {
    ...current,
    completedNodeIds: completed,
    activeNodeId: nextNodeId,
    unlockedChapters,
  };
  saveMapProgress(updated);
  return updated;
}
