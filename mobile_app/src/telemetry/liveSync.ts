// Telemetry Live Sync Client for Mobile App
// Đồng bộ thời gian thực diễn biến ván chơi từ mobile_app sang admin portal

export interface LiveStepEvent {
  turn: number
  lap: number
  tile: number
  action: string
  delta: number
  note: string
}

export interface LiveGameSession {
  id: string
  playerName: string
  avatar: string
  startTime: string
  startTimestamp: number
  status: 'playing' | 'completed' | 'insolvent' | 'dropped'
  currentLap: number
  totalLaps: number
  currentTile: number
  seed: string
  durationMinutes: number
  cash: number
  netWorth: number
  lawfulProceeds: number
  debt: number
  aiCoachRequested: boolean
  timeline: LiveStepEvent[]
  visitedTiles: number[]
}

const STORAGE_KEY = 'xvtl_live_telemetry_v1'
const ACTIVE_SESSION_KEY = 'xvtl_active_session_id'

// Helper: Lấy hoặc tạo Session ID ẩn danh cho người chơi hiện tại
export function getOrCreateActiveSessionId(): string {
  try {
    let id = sessionStorage.getItem(ACTIVE_SESSION_KEY)
    if (!id) {
      const hex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')
      id = `sess_${hex}`
      sessionStorage.setItem(ACTIVE_SESSION_KEY, id)
    }
    return id
  } catch {
    return 'sess_demo'
  }
}

// Đọc toàn bộ danh sách phiên chơi đã lưu
export function getStoredSessions(): LiveGameSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Lưu và phát sóng cập nhật sang tab Admin
export function saveAndBroadcastSessions(sessions: LiveGameSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    // Phát sóng qua BroadcastChannel cho tab Admin bắt ngay lập tức
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('xvtl_telemetry_channel')
      channel.postMessage({ type: 'TELEMETRY_UPDATED', timestamp: Date.now() })
      channel.close()
    }
  } catch (e) {
    console.warn('[Telemetry] Không thể lưu localStorage:', e)
  }
}

// Cập nhật trạng thái ván game thời gian thực
export function syncGameSnapshot(
  game: {
    seed: string
    lap: number
    totalLaps: number
    position: number
    phase: string
    turn?: number
    portfolio: { cash: number; debt: number }
  },
  netWorth: number,
  lawfulProceeds: number,
  lastActionText?: string,
  delta?: number
) {
  try {
    const sessionId = getOrCreateActiveSessionId()
    const shortCode = sessionId.replace('sess_', '#')
    const sessions = getStoredSessions()
    
    let currentSession = sessions.find(s => s.id === sessionId)
    const now = Date.now()

    let gameStatus: LiveGameSession['status'] = 'playing'
    if (game.phase === 'finished' || game.phase === 'victory' || game.phase === 'summary') {
      gameStatus = lawfulProceeds >= 90_000_000 ? 'completed' : 'completed'
    } else if (game.phase === 'insolvent' || game.phase === 'bankrupt') {
      gameStatus = 'insolvent'
    }

    if (!currentSession) {
      currentSession = {
        id: sessionId,
        playerName: `Phiên ${shortCode}`,
        avatar: '',
        startTime: 'Vừa xong',
        startTimestamp: now,
        status: gameStatus,
        currentLap: game.lap,
        totalLaps: game.totalLaps,
        currentTile: game.position,
        seed: game.seed || 'default-seed',
        durationMinutes: 0.1,
        cash: game.portfolio.cash,
        netWorth: netWorth,
        lawfulProceeds: lawfulProceeds,
        debt: game.portfolio.debt,
        aiCoachRequested: false,
        timeline: [],
        visitedTiles: [game.position],
      }
      sessions.unshift(currentSession)
    } else {
      currentSession.status = gameStatus
      currentSession.currentLap = game.lap
      currentSession.currentTile = game.position
      currentSession.cash = game.portfolio.cash
      currentSession.netWorth = netWorth
      currentSession.lawfulProceeds = lawfulProceeds
      currentSession.debt = game.portfolio.debt
      currentSession.durationMinutes = Math.max(0.1, Number(((now - currentSession.startTimestamp) / 60000).toFixed(1)))

      if (!currentSession.visitedTiles.includes(game.position)) {
        currentSession.visitedTiles.push(game.position)
      }
    }

    // Nếu có sự kiện hành động cụ thể, thêm vào timeline
    if (lastActionText) {
      const stepNumber = currentSession.timeline.length + 1
      currentSession.timeline.push({
        turn: stepNumber,
        lap: game.lap,
        tile: game.position,
        action: lastActionText,
        delta: delta || 0,
        note: `Vị trí ô #${game.position}`,
      })
    }

    // Giữ tối đa 50 ván gần nhất để tránh tràn localStorage
    const trimmedSessions = sessions.slice(0, 50)
    saveAndBroadcastSessions(trimmedSessions)
  } catch (error) {
    console.error('[Telemetry] Lỗi đồng bộ snapshot:', error)
  }
}

// Đánh dấu người chơi đã yêu cầu AI Coach
export function recordAiCoachCall() {
  try {
    const sessionId = getOrCreateActiveSessionId()
    const sessions = getStoredSessions()
    const current = sessions.find(s => s.id === sessionId)
    if (current) {
      current.aiCoachRequested = true
      saveAndBroadcastSessions(sessions)
    }
  } catch (e) {
    console.error('[Telemetry] Lỗi ghi nhận AI Coach call:', e)
  }
}

// Khởi tạo ván mới (tạo session mới)
export function startNewLiveSession() {
  try {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')
    const newId = `sess_${hex}`
    sessionStorage.setItem(ACTIVE_SESSION_KEY, newId)
    return newId
  } catch {
    return 'sess_new'
  }
}
