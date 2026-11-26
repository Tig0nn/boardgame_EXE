import { View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { money } from '../../../src/game/format'
import type { Arena, FixedChoice } from './arena-model'
import { art } from './assets'
import { Action, Copy } from './ui'
import { palette } from './theme'
import { ResultParticles } from './result-particles'

export function CashStrip({ cash }: { cash: number }) {
  return <LinearGradient colors={['#fffbeb', '#fef3c7']} style={{ borderRadius: 16, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: '#fcd34d', padding: 12 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Image source={art.money} style={{ width: 22, height: 22 }} contentFit="contain"/>
        <Copy variant="note" style={{ color: '#92400e', fontFamily: 'Fredoka700' }}>Tiền mặt hiện có</Copy>
      </View>
      <Copy variant="heading" style={{ color: '#78350f', flexShrink: 1 }}>{money(cash)}</Copy>
    </View>
  </LinearGradient>
}

export function MarketCard({ asset, forecast }: { asset: 'stocks' | 'bonds' | 'gold'; forecast: string }) {
  const names = { stocks: 'Cổ phiếu', bonds: 'Trái phiếu', gold: 'Vàng trú ẩn' }
  return <View style={{ borderRadius: 18, borderWidth: 1, borderColor: '#dbe4ef', backgroundColor: '#fff',
    padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' }}>
    <Image source={art[asset]} style={{ width: 38, height: 38 }} contentFit="contain"/>
    <View style={{ flex: 1, gap: 4 }}><Copy variant="heading" style={{ color: '#1e293b' }}>{names[asset]}</Copy>
      <Copy variant="note" style={{ color: '#526581' }}>{forecast}</Copy></View>
  </View>
}

export function BusinessCard({ details }: { details: NonNullable<Arena['businessDetails']> }) {
  const rows = details.owned
    ? [['Thu nhập hiện tại tại START', details.currentStartIncome], ['Giá thu hồi hiện tại', details.currentSaleValue]] as const
    : [['Vốn đầu tư', details.purchaseCost], ['Thu nhập nền mỗi START', details.baseIncome], ['Giá thu hồi ban đầu', details.initialSaleValue]] as const
  return <View style={{ gap: 12 }}>
    <View style={{ padding: 12, borderWidth: 1, borderColor: '#dfc8a9', borderStyle: 'dashed', gap: 6 }}>
      <Copy variant="note" style={{ fontFamily: 'Fredoka700' }}>THỊ HIẾU KHÁCH HÀNG</Copy>
      <Copy variant="heading">{details.currentCustomerPreference.label}</Copy>
      <Copy>{details.currentCustomerPreference.example}</Copy>
      <Copy variant="note">Thưởng nâng cấp phù hợp thị hiếu · {money(details.matchingBonus)}/tầng tại START.</Copy>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={art.shop} style={{ width: 38, height: 38 }} contentFit="contain"/>
      <View style={{ flex: 1, gap: 3 }}><Copy variant="note">{details.owned ? 'QUÁN ĐANG HOẠT ĐỘNG' : 'CƠ HỘI MỚI'}</Copy>
        <Copy variant="heading">{details.owned ? 'Quản lý quán của bạn' : 'Mở quán của bạn'}</Copy></View>
    </View>
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#dfc8a9', borderStyle: 'dashed', paddingVertical: 12, gap: 12 }}>
      {rows.map(([label, value]) => <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
        <Copy style={{ flexShrink: 1 }}>{label}</Copy><Copy variant="heading">{money(value)}</Copy>
      </View>)}
    </View>
    <Copy variant="note">Nhận thu nhập tại ô Xuất Phát. Chỉ bán khi ghé ô Kinh doanh; tiền còn trong quán không dùng trả chi phí bắt buộc hay tính vào mục tiêu.</Copy>
    {!details.owned && details.cashAfterPurchase != null && <Copy variant="note">Tiền mặt sau mua · {money(details.cashAfterPurchase)}</Copy>}
  </View>
}

export function DecisionActions({ choices, locked, confirm }: {
  choices: FixedChoice[]; locked: boolean; confirm: (command: FixedChoice['command']) => void
}) {
  return <>{choices.filter(item => !item.skip).map((item, index) => <Action key={index}
    label={item.label} tone="primary" disabled={locked} onPress={() => confirm(item.command)}>
    {item.note && <Copy variant="note" style={{ color: '#2d1003', textAlign: 'center' }}>{item.note}</Copy>}
  </Action>)}</>
}

export function ResultFinances({ arena }: { arena: Arena }) {
  const rows = [
    ['Tiền mặt', arena.portfolio.cash], ['Tiết kiệm', arena.portfolio.savings],
    ['Cổ phiếu', arena.portfolio.stocks], ['Trái phiếu', arena.portfolio.bonds], ['Vàng', arena.portfolio.gold],
    ['Vốn trong kinh doanh', arena.portfolio.business], ['Dư nợ', arena.portfolio.debt], ['Nghĩa vụ', arena.obligations],
  ] as const
  return <View style={{ borderRadius: 16, backgroundColor: '#f8fafc', borderColor: '#dbe4ef', borderWidth: 1, padding: 12, gap: 8 }}>
    <Copy variant="heading">Chi tiết tài sản và nghĩa vụ</Copy>
    {rows.map(([label, value]) => <View key={label} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
      <Copy variant="note">{label}</Copy><Copy>{money(value)}</Copy>
    </View>)}
    <Copy variant="note">Nguồn huy động hợp lệ và tài sản ròng là hai chỉ số khác nhau; kết quả chính thức ở trên giữ nguyên từ ván.</Copy>
  </View>
}

export function GoalMeter({ proceeds, target }: Pick<Arena, 'proceeds' | 'target'>) {
  const progress = target > 0 ? Math.max(0, Math.min(100, proceeds / target * 100)) : 0
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Tiến độ mục tiêu"
    accessibilityValue={{ min: 0, max: target, now: Math.max(0, Math.min(target, proceeds)), text: money(proceeds) + ' / ' + money(target) }}
    style={{ height: 7, borderRadius: 7, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
    <LinearGradient colors={['#f59e0b', '#ea580c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={{ height: 7, width: `${progress}%` }}/>
  </View>
}

export function ResultHero({ arena }: { arena: Arena }) {
  const result = arena.result
  if (!result) return null
  const won = result.outcome === 'victory'
  const insolvent = result.outcome === 'insolvent'
  return <LinearGradient colors={won ? ['#fef3c7', '#fde68a', '#fcd34d'] : ['#e0e7ff', '#c7d2fe', '#a5b4fc']}
    style={{ borderRadius: 18, padding: 12, gap: 8, alignItems: 'center', borderWidth: 1, borderColor: won ? '#f59e0b' : '#818cf8' }}>
    <ResultParticles won={won}/>
    <Image source={won ? art.winnerGoal : art.loser} accessibilityLabel={won ? 'Chiến thắng' : 'Hẹn một hành trình mới'}
      style={{ width: 44, height: 44 }} contentFit="contain"/>
    <View style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 16, backgroundColor: won ? '#b45309' : '#4338ca', maxWidth: '100%' }}>
      <Copy variant="heading" style={{ color: '#fff', fontSize: 15, textAlign: 'center' }}>
        {won ? 'CHIẾN THẮNG RỰC RỠ!' : insolvent ? 'HẸN MỘT HÀNH TRÌNH MỚI!' : 'TIẾC QUÁ, THỬ LẠI NHÉ!'}
      </Copy>
    </View>
    <Copy variant="note" style={{ color: palette.ink, textAlign: 'center' }}>
      {won ? 'Bạn đã hoàn thành mục tiêu của hành trình.' : insolvent ? 'Hành trình dừng vì không còn nguồn thanh toán khả dụng.' : 'Cùng nhìn lại quyết định và thử một phương án khác.'}
    </Copy>
  </LinearGradient>
}
