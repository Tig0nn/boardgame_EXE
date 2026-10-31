import React, { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { BOND_ISSUERS } from '../../../src/data/bond-issuers';
import { ECONOMY } from '../../../src/data/config';
import { creditIssuer, hasBondCredit, creditBondLots } from '../../../src/game/bond-credit';
import { money } from '../../../src/game/format';
import { purchasePreview, saleQuote } from '../../../src/game/selectors';
import type { BondIssuerId, GameState, RebalanceAction, TradableAsset } from '../../../src/game/types';
import { tileTradingEnabled } from '../../../src/game/encounters';
import { sound } from '../utils/audio';
import { TradingPanel } from '../../../src/components/TradingPanel';
import { BondHoldings } from '../../../src/components/BondHoldings';

interface MobileTradingPanelProps {
  game: GameState;
  onTransaction: (action: RebalanceAction) => boolean | void;
  onSkip: () => void;
  marketContext?: (asset: TradableAsset, symbolId: string) => ReactNode;
  compact?: boolean;
}

export const MobileTradingPanel: React.FC<MobileTradingPanelProps> = ({
  game,
  onTransaction,
  onSkip,
  marketContext,
}) => {
  const tile = game.eventId as TradableAsset | 'bank' | 'business';
  const submitLock = useRef(false);

  const submit = (action: RebalanceAction) => {
    if (submitLock.current) return;
    submitLock.current = true;
    try {
      sound.playClick();
      if (onTransaction(action) === false) {
        submitLock.current = false;
      }
    } catch (error) {
      submitLock.current = false;
      throw error;
    }
  };

  // PHÂN HỆ 1: TRÁI PHIẾU TÍN DỤNG (BOND CREDIT ENCOUNTER)
  if (tile === 'bonds' && hasBondCredit(game)) {
    return (
      <MobileBondCreditView
        game={game}
        onTransaction={submit}
        onSkip={onSkip}
        marketContext={marketContext}
      />
    );
  }

  // CÁC PHÂN HỆ KHÁC: GỌI TRADINGPANEL CHUẨN KÈM WRAPPER GAMIFIED
  return (
    <div className="mobile-trading-wrapper w-full" style={{ fontFamily: "'Fredoka', sans-serif" }}>
      <TradingPanel
        key={`${game.turn}-${game.log.length}`}
        game={game}
        compact
        onTransaction={submit}
        onSkip={onSkip}
        marketContext={marketContext}
      />
    </div>
  );
};

// ============================================================================
// PHÂN HỆ TRÁI PHIẾU TÍN DỤNG CHUYÊN BIỆT CHO MOBILE
// ============================================================================
interface MobileBondCreditViewProps {
  game: GameState;
  onTransaction: (action: RebalanceAction) => void;
  onSkip: () => void;
  marketContext?: (asset: TradableAsset, symbolId: string) => ReactNode;
}

function MobileBondCreditView({
  game,
  onTransaction,
  onSkip,
  marketContext,
}: MobileBondCreditViewProps) {
  const [issuerId, setIssuerId] = useState<BondIssuerId>('an-tam');
  const [amount, setAmount] = useState<number>(8_000_000);
  const [selectedChip, setSelectedChip] = useState<string>('8M');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const config = BOND_ISSUERS.find((item) => item.id === issuerId)!;
  const issuer = creditIssuer(game, issuerId);
  const preview = purchasePreview(game, amount);
  const available = issuer.status === 'performing';
  const face = preview.valid && available ? Math.round((amount / issuer.currentPrice) * config.faceValue) : 0;
  const maturityLap = game.lap + config.term - 1;
  const periodicInterest = preview.valid && available ? Math.round(face * config.coupon) : 0;

  // Lựa chọn mua / bán nếu bật giao dịch hai chiều tại ô (b18-tile-trading-v1)
  const isTileTrading = tileTradingEnabled(game);
  const availableLots = creditBondLots(game).filter((x) => x.quote.executable);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [sellLotId, setSellLotId] = useState<string>(availableLots[0]?.lot.id ?? '');
  const sellLot = availableLots.find((x) => x.lot.id === sellLotId) ?? availableLots[0];
  const sellAvailable = sellLot?.quote.gross ?? 0;
  const [sellAmount, setSellAmount] = useState<number>(sellAvailable);
  const sellValid = Number.isSafeInteger(sellAmount) && sellAmount > 0 && sellAmount <= sellAvailable;
  const sellQuotePreview = saleQuote(game, 'bonds', sellValid ? sellAmount : 0, sellLot?.lot.id);

  // Quick preset chips cho số tiền mua
  const maxAffordable = Math.floor(game.portfolio.cash / 8_000_000) * 8_000_000;
  const presets = [
    { label: '8M', val: 8_000_000 },
    { label: '16M', val: 16_000_000 },
    { label: '24M', val: 24_000_000 },
    { label: 'Tối Đa', val: maxAffordable },
  ];

  return (
    <div
      className="mobile-bond-panel flex flex-col gap-3"
      style={{
        fontFamily: "'Fredoka', sans-serif",
        color: '#381F0B',
        writingMode: 'horizontal-tb',
      }}
    >
      {/* Tab Mua / Bán (nếu có sở hữu trái phiếu và bật giao dịch hai chiều) */}
      {isTileTrading && availableLots.length > 0 && (
        <div
          style={{
            display: 'flex',
            background: 'rgba(245, 235, 230, 0.8)',
            padding: '3px',
            borderRadius: '999px',
            border: '1.5px solid rgba(180, 83, 9, 0.25)',
          }}
        >
          <button
            type="button"
            onClick={() => setTradeMode('buy')}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '999px',
              border: 'none',
              background: tradeMode === 'buy' ? '#F59E0B' : 'transparent',
              color: tradeMode === 'buy' ? '#FFFFFF' : '#78350F',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Mua Mới
          </button>
          <button
            type="button"
            onClick={() => {
              setTradeMode('sell');
              if (sellLot) setSellAmount(sellLot.quote.gross);
            }}
            style={{
              flex: 1,
              padding: '6px 0',
              borderRadius: '999px',
              border: 'none',
              background: tradeMode === 'sell' ? '#F59E0B' : 'transparent',
              color: tradeMode === 'sell' ? '#FFFFFF' : '#78350F',
              fontWeight: 900,
              fontSize: '12.5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Bán Khoản Đang Giữ
          </button>
        </div>
      )}

      {tradeMode === 'buy' ? (
        <>
          {/* 1. LỰA CHỌN TỔ CHỨC CHO VAY VỐN (2 THẺ BÀI SANG TRỌNG) */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 900,
                color: '#78350F',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>📜</span>
              <span>Chọn bên vay vốn:</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {BOND_ISSUERS.map((item) => {
                const current = creditIssuer(game, item.id);
                const isSelected = issuerId === item.id;
                const isSafe = item.id === 'an-tam';
                const isItemAvailable = current.status === 'performing';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setIssuerId(item.id);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '8px 10px',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid #D97706' : '1.5px solid #E2E8F0',
                      background: isSelected
                        ? 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 100%)'
                        : '#FFFFFF',
                      boxShadow: isSelected
                        ? '0 4px 12px rgba(245, 158, 11, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
                        : '0 2px 5px rgba(0,0,0,0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                      transition: 'all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                      fontFamily: "'Fredoka', sans-serif",
                    }}
                  >
                    {/* Header: Badge Hạng & Tên */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        marginBottom: '4px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 900,
                          padding: '1.5px 6px',
                          borderRadius: '999px',
                          color: '#FFFFFF',
                          background: isSafe ? '#059669' : '#EA580C',
                          letterSpacing: '0.3px',
                        }}
                      >
                        Hạng {current.rating}
                      </span>
                      <img
                        src={isSafe ? '/assets/safety-icon.png' : '/assets/boost-icon.png'}
                        alt={isSafe ? 'An toàn' : 'Bứt phá'}
                        style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                      />
                    </div>

                    <strong
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 900,
                        color: isSelected ? '#78350F' : '#1E293B',
                        lineHeight: 1.2,
                        marginBottom: '4px',
                      }}
                    >
                      {isSafe ? 'HTX An Tâm' : 'Cty Bứt Phá'}
                    </strong>

                    {/* Lãi suất & Thời hạn */}
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#475569',
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      <div>
                        Lãi: <b style={{ color: isSafe ? '#059669' : '#EA580C' }}>{(item.coupon * 100).toFixed(1)}%/kỳ</b>
                      </div>
                      <div>Kỳ hạn: <b>{item.term} vòng</b></div>
                    </div>

                    {/* Trạng thái rủi ro tóm gọn */}
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '9.5px',
                        color: isItemAvailable ? '#64748B' : '#DC2626',
                        fontWeight: 700,
                        lineHeight: 1.25,
                      }}
                    >
                      {isItemAvailable
                        ? isSafe
                          ? 'Ít rủi ro, an toàn vốn'
                          : 'Lãi cao, dễ chậm nợ'
                        : '⚠️ Tạm ngừng bán mới'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. CHỌN SỐ TIỀN MUA & PHÍM BẤM NHANH */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1.5px solid rgba(180, 83, 9, 0.2)',
              padding: '10px 12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#78350F' }}>
                Số tiền đầu tư:
              </span>
              <strong
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: '#92400E',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(amount)}
              </strong>
            </div>

            {/* Quick chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
              {presets.map((p) => {
                const canAfford = p.val > 0 && p.val <= game.portfolio.cash;
                const isChipSelected = canAfford && selectedChip === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      if (!canAfford) return;
                      sound.playClick();
                      setSelectedChip(p.label);
                      setAmount(p.val);
                    }}
                    style={{
                      padding: '5px 0',
                      borderRadius: '8px',
                      border: isChipSelected ? '1.5px solid #D97706' : '1px solid #CBD5E1',
                      background: isChipSelected ? '#FEF3C7' : canAfford ? '#F8FAFC' : '#F1F5F9',
                      color: isChipSelected ? '#92400E' : canAfford ? '#334155' : '#94A3B8',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      transition: 'all 0.12s ease',
                      fontFamily: "'Fredoka', sans-serif",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. BẢNG TÓM TẮT TÀI CHÍNH (FINANCIAL SUMMARY CARD) */}
          <div
            style={{
              background: 'linear-gradient(180deg, #FDFBF7 0%, #F5EBE6 100%)',
              border: '1.5px dashed rgba(180, 83, 9, 0.3)',
              borderRadius: '14px',
              padding: '8px 12px',
              fontSize: '11.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', borderBottom: '1px solid rgba(180, 83, 9, 0.15)', paddingBottom: '4px' }}>
              <img src="/assets/money-report.png" alt="Báo giá & Dòng tiền" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#78350F' }}>BÁO GIÁ & DÒNG TIỀN DỰ KIẾN</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Lãi mỗi kỳ nếu trả đúng:</span>
              <strong style={{ color: '#059669', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {preview.valid && available ? `+${money(periodicInterest)}` : '—'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Phí giao dịch bán:</span>
              <strong style={{ color: '#475569', fontWeight: 800 }}>
                {(ECONOMY.tradeFees.bonds * 100).toFixed(1)}%
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(180, 83, 9, 0.15)',
                paddingTop: '4px',
                marginTop: '2px',
              }}
            >
              <span style={{ color: '#78350F', fontWeight: 700 }}>Tiền mặt sau giao dịch:</span>
              <strong
                style={{
                  color: preview.valid ? '#92400E' : '#DC2626',
                  fontWeight: 900,
                  fontSize: '12.5px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {preview.cashAfter !== null ? money(preview.cashAfter) : 'Không đủ tiền mặt'}
              </strong>
            </div>

            {maturityLap > game.totalLaps && (
              <p style={{ margin: '2px 0 0', color: '#B45309', fontSize: '10px', fontWeight: 700 }}>
                ⚠️ Đáo hạn sau khi hết ván ({maturityLap} vòng); cuối ván sẽ thanh lý theo giá thị trường sau phí.
              </p>
            )}
          </div>

          {/* Tín hiệu thị trường nếu có */}
          {marketContext?.('bonds', issuerId)}

          {/* 4. CÁC NÚT HÀNH ĐỘNG GAMIFIED (MUA & BỎ QUA) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
            <button
              type="button"
              disabled={!preview.valid || !available}
              onClick={() => {
                onTransaction({
                  kind: 'buy',
                  asset: 'bonds',
                  issuerId,
                  amount,
                  completeEncounter: true,
                });
              }}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '999px',
                border: !preview.valid || !available ? 'none' : '2px solid #FEF3C7',
                background:
                  !preview.valid || !available
                    ? '#94A3B8'
                    : 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 45%, #D97706 100%)',
                color: !preview.valid || !available ? '#E2E8F0' : '#381F0B',
                fontSize: '13.5px',
                fontWeight: 900,
                cursor: !preview.valid || !available ? 'not-allowed' : 'pointer',
                boxShadow:
                  !preview.valid || !available
                    ? 'none'
                    : '0 4px 14px rgba(245, 158, 11, 0.45), 0 2px 4px rgba(0,0,0,0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'transform 0.12s ease',
                fontFamily: "'Fredoka', sans-serif",
              }}
              onPointerDown={(e) => {
                if (preview.valid && available) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
                }
              }}
              onPointerUp={(e) => {
                if (preview.valid && available) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }
              }}
            >
              {!available
                ? 'Tổ chức này tạm ngừng bán'
                : !preview.valid
                  ? 'Số tiền không hợp lệ'
                  : `Mua Trái Phiếu ${money(amount)}`}
            </button>

            {/* Nút Bỏ qua cơ hội thanh nhã (Loại bỏ đường gạch đứt xấu) */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onSkip();
              }}
              style={{
                width: '100%',
                padding: '7px 0',
                background: 'transparent',
                border: 'none',
                color: '#78350F',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
                fontFamily: "'Fredoka', sans-serif",
                textDecoration: 'none',
              }}
            >
              Bỏ qua cơ hội này →
            </button>
          </div>

          {/* 5. CHI TIẾT BÁO GIÁ & RỦI RO (EXPANDABLE ACCORDION GỌN GÀNG) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '6px 10px',
              fontSize: '11px',
            }}
          >
            <div
              onClick={() => setDetailsOpen(!detailsOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                fontWeight: 800,
                color: '#78350F',
              }}
            >
              <span>ℹ️ Báo giá, lịch nhận tiền & rủi ro</span>
              <span>{detailsOpen ? '▲' : '▼'}</span>
            </div>

            {detailsOpen && (
              <div
                style={{
                  marginTop: '6px',
                  paddingTop: '6px',
                  borderTop: '1px solid #F1F5F9',
                  color: '#475569',
                  lineHeight: 1.4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div>
                  • <b>Giá mua một trái phiếu:</b> {issuer.currentPrice ? money(issuer.currentPrice) : 'Tạm ngừng'} (Mệnh giá {money(config.faceValue)}).
                </div>
                <div>
                  • <b>Kỳ nhận lãi:</b> Nhận coupon khi qua ô Xuất phát. Lãi và gốc có rủi ro chậm trả theo xếp hạng tín nhiệm.
                </div>
                <div>
                  • <b>Áp lực tài chính của bên phát hành:</b> {issuer.stress}/2 (0 thấp nhất, 2 cao nhất).
                </div>
                <div style={{ marginTop: '2px' }}>
                  <BondHoldings game={game} />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* PHÂN HỆ BÁN TRÁI PHIẾU ĐANG NẮM GIỮ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#78350F' }}>
            Khoản trái phiếu muốn thanh lý:
          </div>
          {availableLots.length > 1 && (
            <select
              value={sellLotId}
              onChange={(e) => {
                setSellLotId(e.target.value);
                const chosen = availableLots.find((x) => x.lot.id === e.target.value);
                if (chosen) setSellAmount(chosen.quote.gross);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              {availableLots.map((x) => (
                <option key={x.lot.id} value={x.lot.id}>
                  {x.lot.id} · Nhận tối đa {money(x.quote.net)}
                </option>
              ))}
            </select>
          )}
          {sellLot && (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                padding: '8px 10px',
                border: '1px solid #E2E8F0',
                fontSize: '11.5px',
              }}
            >
              <div>Lô: <b>{sellLot.lot.id}</b> · Vốn đã chi: <b>{money(sellLot.lot.principal)}</b></div>
              <div style={{ color: '#059669', fontWeight: 800 }}>Giá thu hồi thực nhận: {money(sellQuotePreview.net)}</div>
            </div>
          )}
          <button
            type="button"
            disabled={!sellValid}
            onClick={() => {
              onTransaction({
                kind: 'sell',
                asset: 'bonds',
                amount: sellAmount,
                lotId: sellLot?.lot.id,
              });
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '999px',
              background: 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 100%)',
              border: 'none',
              fontWeight: 900,
              fontSize: '13px',
              cursor: sellValid ? 'pointer' : 'not-allowed',
            }}
          >
            Xác nhận bán · Nhận {money(sellQuotePreview.net)}
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{ background: 'transparent', border: 'none', color: '#64748B', fontWeight: 700 }}
          >
            Quay lại
          </button>
        </div>
      )}
    </div>
  );
}
