import { useEffect, useState, useSyncExternalStore } from 'react'
import { Action, Copy } from './ui'
import { gameplayAnalytics } from './analytics/runtime'

export function AnalyticsSettings() {
  const status = useSyncExternalStore(gameplayAnalytics.subscribe, gameplayAnalytics.getSnapshot)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void gameplayAnalytics.initialize() }, [])
  const enabled = status.consent === 'enabled'
  function choose(value: boolean) {
    setBusy(true)
    void gameplayAnalytics.setConsent(value).then(() => gameplayAnalytics.flush()).catch(() => {}).finally(() => setBusy(false))
  }
  return <>
    <Copy variant="heading">Thống kê chơi ẩn danh</Copy>
    <Copy variant="note">Ghi nhận ẩn danh lượt mở app, bắt đầu ván, hoàn thành vòng, kết quả, chơi lại và quay lại để cải thiện EXE. Không gửi email, tên, số tiền, nhật ký hay dữ liệu Cloud Save. Không ghi màn hình hoặc dùng mã quảng cáo.</Copy>
    <Copy variant="note">{enabled ? 'Đang bật.' : 'Đang tắt.'} Dùng mã ngẫu nhiên của lượt cài đặt để nhận biết lần quay lại. Bạn có thể tắt hoặc bật lại tại đây; lựa chọn được lưu. Khi tắt, dữ liệu chờ gửi trên máy sẽ được xóa.</Copy>
    {!status.configured && <Copy variant="note">Bản này chưa kết nối nhà cung cấp thống kê, nên không gửi dữ liệu.</Copy>}
    {!status.storageAvailable && <Copy variant="note">Không lưu được tùy chọn. Thống kê đang tắt; bạn vẫn chơi bình thường.</Copy>}
    <Action label={enabled ? 'Tắt thống kê ẩn danh' : 'Bật thống kê ẩn danh'}
      selected={enabled} disabled={!status.ready || busy || !status.storageAvailable} onPress={() => choose(!enabled)}/>
    {status.consent === 'unknown' && <Action label="Không chia sẻ thống kê" disabled={busy || !status.ready} onPress={() => choose(false)}/>}
  </>
}
