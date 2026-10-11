export const money = (value: number) => `${(Math.round(value) || 0).toLocaleString('vi-VN')} ₫`
export const signedMoney = (value: number) => `${value > 0 ? '+' : ''}${money(value)}`
export const percent = (value: number) => `${value > 0 ? '+' : ''}${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
