import { STOCKS } from './config.ts'
import type { StockCatalogVersion } from '../game/types.ts'

// Identity metadata verified 2026-10-13; sources and broad-sector rationale in the integration report.
// Volatility/order are game calibration, never issuer performance or live quotes.
const VIETNAMESE_STOCKS = [
  { id: 'FPT', name: 'CTCP FPT', sector: 'technology', volatility: 0.06 },
  { id: 'CMG', name: 'Tập đoàn Công nghệ CMC', sector: 'technology', volatility: 0.08 },
  { id: 'VCB', name: 'Vietcombank', sector: 'banking', volatility: 0.04 },
  { id: 'TCB', name: 'Techcombank', sector: 'banking', volatility: 0.05 },
  { id: 'HPG', name: 'Tập đoàn Hòa Phát', sector: 'manufacturing', volatility: 0.05 },
  { id: 'BMP', name: 'Nhựa Bình Minh', sector: 'manufacturing', volatility: 0.07 },
]
export function stockCatalog(version: StockCatalogVersion = 'fictional-v1') {
  if (version === 'fictional-v1') return STOCKS
  if (version === 'vn-v1') return VIETNAMESE_STOCKS
  throw new Error('Phiên bản danh mục cổ phiếu không được hỗ trợ.')
}
