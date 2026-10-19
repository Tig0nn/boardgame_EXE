import { localizeNarrative } from '../components/glossary'
import { GlossaryText } from '../components/FinancialTerm'
import { useState } from 'react'
import type { GameState } from '../game/types.ts'
import { buildCoachFacts } from './facts.ts'
import type { CoachEvidence, CoachOutput } from './types.ts'
import './aiCoach.css'

export interface AICoachPanelProps {
  game: GameState
  endpointUrl?: string
  featureFlagEnabled?: boolean
  mockOutput?: CoachOutput
}

function formatEvidenceTag(ev?: CoachEvidence, id = ''): string {
  if (!ev) {
    return id.replace(/^ev:/, '').replace(/-/g, ' ')
  }

  switch (ev.id) {
    case 'ev:goal-achieved': {
      const match = ev.fact.match(/([\d.]+\s*VND)/)
      return match ? `Cán đích (${match[1]})` : 'Cán đích thành công'
    }
    case 'ev:goal-missed': {
      const match = ev.fact.match(/thiếu ([\d.]+\s*VND)/)
      return match ? `Thiếu ${match[1]} huy động` : 'Chưa đủ 90M huy động'
    }
    case 'ev:insolvent-finish':
      return `Phá sản Vòng ${ev.lap ?? ''}`.trim()
    case 'ev:business-locked':
      return 'Kẹt vốn kinh doanh tại đích'
    case 'ev:liquidity-gap':
      return 'Thiếu thanh khoản tiền mặt'
    case 'ev:savings-early-withdrawal':
      return 'Rút tiết kiệm trước hạn'
    case 'ev:outstanding-debt':
      return 'Còn nợ vay chưa trả'
    case 'ev:debt-interest-paid':
      return 'Chi trả lãi vay'
    case 'ev:course-purchased':
      return `Khóa học Vòng ${ev.lap ?? 1} (+3M lương)`
    case 'ev:course-not-purchased':
      return 'Không đầu tư khóa học'
    case 'ev:business-upgraded':
      return 'Nâng cấp kinh doanh'
    case 'ev:business-sold':
    case 'ev:business-liquidated':
      return `Bán kinh doanh Vòng ${ev.lap ?? 4}`
    case 'ev:savings-matured-interest':
      return 'Tiết kiệm đáo hạn nhận lãi'
    case 'ev:financial-portfolio':
      return 'Danh mục tài chính (cổ phiếu/vàng/trái phiếu)'
    case 'ev:macro-shocks-applied':
      return 'Sốc thị trường vĩ mô'
    default: {
      switch (ev.kind) {
        case 'goal-result':
          return 'Kết quả mục tiêu'
        case 'course':
          return ev.lap ? `Khóa học Vòng ${ev.lap}` : 'Khóa học'
        case 'business-sale':
          return ev.lap ? `Bán kinh doanh Vòng ${ev.lap}` : 'Bán kinh doanh'
        case 'business-locked':
          return 'Kẹt vốn kinh doanh'
        case 'savings-withdrawal':
          return 'Rút tiết kiệm trước hạn'
        case 'savings-maturity':
          return 'Tiết kiệm đáo hạn'
        case 'macro-shock':
          return 'Sốc thị trường vĩ mô'
        case 'asset-trade':
          return 'Danh mục tài sản'
        case 'borrowing':
          return 'Khoản vay nợ'
        default:
          return ev.fact.length <= 35 ? ev.fact : ev.fact.slice(0, 30)
      }
    }
  }
}

export function AICoachPanel({
  game,
  endpointUrl = '/api/ai-coach',
  featureFlagEnabled = true,
  mockOutput,
}: AICoachPanelProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [output, setOutput] = useState<CoachOutput | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('Phân tích AI hiện chưa sẵn sàng.')
  const [retryCount, setRetryCount] = useState<number>(0)
  const [evidenceMap, setEvidenceMap] = useState<Record<string, CoachEvidence>>({})

  // 1. Kiểm tra an toàn: Chỉ hiển thị khi ván kết thúc và tính năng được bật
  if (game.phase !== 'finished' || !featureFlagEnabled) {
    return null
  }

  const handleAnalyze = async () => {
    setStatus('loading')
    try {
      const facts = buildCoachFacts(game)
      const evMap: Record<string, CoachEvidence> = {}
      for (const ev of facts.evidence) {
        evMap[ev.id] = ev
      }
      setEvidenceMap(evMap)

      // Nếu có mockOutput (dành cho chế độ giả lập preview), trả về kết quả giả lập
      if (mockOutput) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setOutput(mockOutput)
        setStatus('success')
        return
      }

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facts),
      })

      const data = await response.json()

      if (response.ok && data && data.version === 1 && Array.isArray(data.insights)) {
        setOutput(data as CoachOutput)
        setStatus('success')
      } else {
        setErrorMsg(data?.fallback || 'Phân tích AI hiện chưa sẵn sàng.')
        setStatus('error')
        setRetryCount(prev => prev + 1)
      }
    } catch {
      setErrorMsg('Phân tích AI hiện chưa sẵn sàng.')
      setStatus('error')
      setRetryCount(prev => prev + 1)
    }
  }

  return (
    <div className="ai-coach-panel">
      {status === 'idle' && (
        <div className="ai-coach-trigger-container">
          <button
            type="button"
            className="ai-coach-trigger-btn"
            onClick={handleAnalyze}
          >
            <span>Nhờ AI phân tích ván chơi</span>
          </button>
          <span className="ai-coach-trigger-hint">
            Đúc kết nguyên nhân tài chính & gợi ý chiến lược cho ván sau
          </span>
        </div>
      )}

      {status === 'loading' && (
        <div className="ai-coach-loading-container">
          <div className="ai-coach-spinner" />
          <span className="ai-coach-loading-text">
            Đang phân tích ván chơi và đối chiếu bằng chứng...
          </span>
        </div>
      )}

      {status === 'success' && output && (
        <div className="ai-coach-success-content">
          <div className="ai-coach-header">
            <span className="ai-coach-tag">
              Bạn Đồng Hành Đầu Tư
            </span>
            <small style={{ color: '#64748b', fontSize: '0.75rem' }}>Góc nhìn sau ván cờ</small>
          </div>

          <h3 className="ai-coach-headline">{localizeNarrative(output.headline)}</h3>

          <div className="ai-coach-insights-list">
            {output.insights.map((insight, idx) => (
              <div key={idx} className="ai-coach-insight-card">
                <h4 className="ai-coach-insight-title">{localizeNarrative(insight.title)}</h4>
                <p className="ai-coach-insight-desc"><GlossaryText text={localizeNarrative(insight.explanation)} /></p>
                {insight.evidenceIds && insight.evidenceIds.length > 0 && (
                  <div className="ai-coach-evidence-badges">
                    {insight.evidenceIds.map(id => {
                      const ev = evidenceMap[id]
                      return (
                        <span
                          key={id}
                          className="ai-coach-badge"
                          title={ev?.fact ? localizeNarrative(ev.fact) : id}
                        >
                          {formatEvidenceTag(ev, id)}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {output.tryNext && (
            <div className="ai-coach-try-next-card">
              <span className="ai-coach-try-next-label">
                Bạn đồng hành mách nước ván tới
              </span>
              <p className="ai-coach-try-next-text">{localizeNarrative(output.tryNext)}</p>
            </div>
          )}

          <div className="ai-coach-disclaimer">
            Nhận xét AI · chỉ dùng dữ liệu giả lập trong trò chơi
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="ai-coach-error-card">
          <p className="ai-coach-error-text">{localizeNarrative(errorMsg)}</p>
          {retryCount < 2 && (
            <button
              type="button"
              className="ai-coach-retry-btn"
              onClick={handleAnalyze}
            >
              Thử lại
            </button>
          )}
        </div>
      )}
    </div>
  )
}
