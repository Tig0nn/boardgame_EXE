import type { ComponentProps } from 'react'
import { TradingPanel } from '../../../src/components/TradingPanel'
import './mobile-trading.css'

type MobileTradingProps = Omit<ComponentProps<typeof TradingPanel>, 'compact' | 'buyOnly'>

export function MobileTrading(props: MobileTradingProps) {
  return (
    <div className="mobile-trading">
      <TradingPanel {...props} compact />
    </div>
  )
}
