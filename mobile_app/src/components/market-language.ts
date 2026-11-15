// Presentation only. These labels never participate in credit transitions or pricing.
const validPressure = (value: number) => Number.isInteger(value) && value >= 0 && value <= 2

export function issuerPressureChange(before: number, after: number): string {
  if (!validPressure(before) || !validPressure(after)) return 'Chưa đủ dữ liệu về áp lực tài chính'
  return after > before ? 'Áp lực tài chính tăng' : after < before ? 'Áp lực tài chính giảm' : 'Áp lực tài chính không thay đổi'
}

export function issuerPressureDetails(before: number, after: number): string {
  if (!validPressure(before) || !validPressure(after)) return 'Chưa đủ dữ liệu về áp lực tài chính của bên phát hành.'
  return `Áp lực tài chính của bên phát hành: ${before}/2 → ${after}/2. Trong trò chơi, 0 là thấp nhất, 2 là cao nhất; không phải nợ của bạn. Mức 0 vẫn có thể chậm trả hoặc mất vốn. Chỉ số này không tự xác nhận đã chậm trả.`
}
