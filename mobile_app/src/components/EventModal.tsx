import { useMemo, useSyncExternalStore } from 'react'
import { createRepairAiBinding, repairAiEligible } from '../game/repair-ai'
import type { RepairAiSession } from '../game/repair-ai'
import { repairAiFeature } from '../game/repair-ai-feature'
import { RepairAiPanel } from './RepairAiPanel'
import { eventsForGame } from '../../../src/data/events'
import { canChoose } from '../../../src/game/engine'
import { money } from '../../../src/game/format'
import type { GameState, RebalanceAction } from '../../../src/game/types'
import { TradingPanel } from '../../../src/components/TradingPanel'
import { MarketSignal } from './MarketNews'
import { investmentPurchasesComplete } from '../../../src/game/encounters'
import { MACRO_EVENTS } from '../../../src/data/config'
import { EconomicEventModal } from './EconomicEventModal'
import { isMultiCourse } from '../../../src/game/rules-profile'
import { MobileCourseChoices } from './MobileCourseChoices'
import { MobileBankPanel } from './MobileBankPanel'
import { localizeNarrative } from '../../../src/components/glossary'
import { paymentOptionCopy } from '../../../src/components/financial-decision-copy'
import { GamifiedModal } from './GamifiedModal'
import { sound } from '../utils/audio'

export function EventModal({
  game,
  session,
  onChoose,
  onTransaction,
  onHelp,
}: {
  game: GameState
  session?: RepairAiSession
  onChoose: (id: string) => void
  onTransaction: (action: RebalanceAction) => boolean | void
  onHelp?: () => void
}) {
  const aiEnabled = useSyncExternalStore(repairAiFeature.subscribe, repairAiFeature.isEnabled, () => false)
  const ai = useMemo(() => session ? createRepairAiBinding(session, repairAiFeature) : null, [session])
  if (MACRO_EVENTS.some((event) => event.id === game.eventId)) {
    return <EconomicEventModal game={game} onChoose={onChoose} onHelp={onHelp} />
  }

  const event = eventsForGame(game).find((e) => e.id === game.eventId)!
  if (!event) return null

  // Màn hình Đầu tư bản thân (Course)
  if (event.id === 'course' && isMultiCourse(game)) {
    return (
      <GamifiedModal
        badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · Ô ${game.position + 1}`}
        title="Đầu tư bản thân"
        onHelp={onHelp}
      >
        <MobileCourseChoices game={game} onChoose={onChoose} />
      </GamifiedModal>
    )
  }

  // Màn hình Ngân hàng (Bank)
  if (event.id === 'bank') {
    return (
      <GamifiedModal
        badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · Ô ${game.position + 1}`}
        title="Ngân hàng"
        onHelp={onHelp}
      >
        <MobileBankPanel
          game={game}
          onTransaction={onTransaction}
          onSkip={() => onChoose('skip')}
        />
      </GamifiedModal>
    )
  }

  const trading = ['stocks', 'bonds', 'gold', 'bank', 'business'].includes(event.id)
  const traded = game.log.some((entry) => entry.turn === game.turn && entry.kind === 'rebalancing')
  const panelOwnsSkip =
    event.id === 'stocks' ||
    (['gold', 'bonds'].includes(event.id) && investmentPurchasesComplete(game))

  const title =
    ({ stocks: 'Cổ phiếu', bonds: 'Trái phiếu', gold: 'Vàng', business: 'Quán của bạn' } as Record<
      string,
      string
    >)[event.id] ?? event.title

  const description = (
    <>
      {/* Narrative Mô Tả Tình Huống */}
      {!trading && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1.5px solid #BBF7D0',
            borderRadius: '16px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#166534',
            lineHeight: '1.45',
          }}
        >
          {event.id === 'living'
            ? 'Đến lúc chăm lo cho cuộc sống thường nhật.'
            : event.id === 'course'
              ? 'Học một lần, nâng cao tri thức và tăng thu nhập cho những chặng đường tiếp theo.'
              : event.category === 'shock' &&
                  !event.options.some((option) => option.cost || option.obligation)
                ? 'Thị trường vừa xuất hiện biến động. Cơ hội mới đang chờ đón bạn!'
                : localizeNarrative(event.description)}
        </div>
      )}

    </>
  )
  const cash = (
    <>
      {/* Badge Tiền Mặt Hiện Có (Soft Organic UI) */}
      <div data-gameplay-cash
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(254, 243, 199, 0.5)',
          border: '2px dashed #FCD34D',
          borderRadius: '16px',
          padding: '10px 14px',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        <span style={{ color: '#92400E' }}>Tiền mặt hiện có:</span>
        <strong style={{ color: '#78350F', fontSize: '14.5px', fontWeight: 900 }}>
          {money(game.portfolio.cash)}
        </strong>
      </div>

    </>
  )
  const decisions = (
    <>
      {/* Danh Sách Các Lựa Chọn Hành Động */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {event.options
          .filter(
            (option) =>
              !panelOwnsSkip &&
              !(event.id === 'course' && game.coursePurchased && option.id === 'upgrade')
          )
          .map((option) => {
            const payment = paymentOptionCopy(event, option)
            const disabled = !canChoose(game, option.id)
            const isPrimary = option.id !== 'skip'
            const isAffordable = (option.cost ?? 0) <= game.portfolio.cash

            return (
              <button
                key={option.id}
                disabled={disabled}
                onClick={() => {
                  sound.playClick()
                  ai?.close()
                  onChoose(option.id)
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  background: disabled
                    ? '#E2E8F0'
                    : isPrimary
                      ? 'linear-gradient(180deg, #FBBF24 0%, #F97316 48%, #EA580C 100%)'
                      : '#FFFFFF',
                  color: disabled ? '#94A3B8' : isPrimary ? '#FFFFFF' : '#475569',
                  border: isPrimary ? 'none' : '1.5px solid #CBD5E1',
                  boxShadow:
                    disabled || !isPrimary
                      ? 'none'
                      : '0 4px 12px rgba(234, 88, 12, 0.35)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  boxSizing: 'border-box',
                  textShadow: isPrimary && !disabled ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
                }}
              >
                <strong style={{ fontSize: '14.5px', fontWeight: 900, textTransform: 'uppercase' }}>
                  {option.id === 'acknowledge' || (event.id === 'course' && game.coursePurchased)
                    ? 'Tiếp tục hành trình →'
                    : option.id === 'skip' && traded
                      ? 'Hoàn tất · Về bàn chơi →'
                      : payment?.label ?? option.label}
                </strong>

                {option.id !== 'skip' && option.id !== 'acknowledge' && (
                  <span style={{ fontSize: '11.5px', opacity: 0.9 }}>
                    {payment ? payment.detail : localizeNarrative(option.detail)}
                  </span>
                )}

                {payment?.comparison && (
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.25)',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      marginTop: '2px',
                    }}
                  >
                    {payment.comparison}
                  </span>
                )}

                {!isAffordable && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#DC2626',
                      fontWeight: 800,
                      background: '#FEE2E2',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      marginTop: '2px',
                    }}
                  >
                    Thiếu {money(option.cost! - game.portfolio.cash)} · Cần huy động vốn
                  </span>
                )}
              </button>
            )
          })}
      </div>
    </>
  )
  if (aiEnabled && ai && session?.getSnapshot() === game && repairAiEligible(game)) {
    return <RepairAiPanel binding={ai} title={title} badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · Ô ${game.position + 1}`}
      cash={cash} description={description} decisions={decisions} onHelp={onHelp ? () => { ai.close(); onHelp() } : undefined} />
  }
  return <GamifiedModal badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · Ô ${game.position + 1}`} title={title} onHelp={onHelp}>
    {description}
    {cash}
    {/* Trading Panel nếu thuộc nhóm giao dịch */}
      {trading && (
        <div style={{ width: '100%' }}>
          <TradingPanel
            key={`${game.turn}-${game.log.length}`}
            game={game}
            compact
            onTransaction={onTransaction}
            onSkip={() => onChoose('skip')}
            marketContext={(asset, symbolId) => (
              <MarketSignal game={game} asset={asset} symbolId={symbolId} />
            )}
          />
        </div>
      )}

    {decisions}
  </GamifiedModal>
}
