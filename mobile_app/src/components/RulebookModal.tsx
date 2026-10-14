import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'

interface RulebookModalProps {
  onClose: () => void
  initialTab?: number
}

interface TabContent {
  id: string
  title: string
  icon: string
  badge: string
  headline: string
  body: React.ReactNode
}

export function RulebookModal({ onClose, initialTab = 0 }: RulebookModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab)

  const tabs: TabContent[] = [
    {
      id: 'goal',
      title: 'Mục tiêu',
      icon: '🎯',
      badge: 'Nhiệm vụ',
      headline: 'Huy động 90.000.000 đ trong 4 vòng',
      body: (
        <div className="rulebook-section">
          <div className="rulebook-stat-grid">
            <div className="rulebook-stat-card">
              <span className="stat-label">Vốn khởi đầu</span>
              <strong className="stat-val text-accent">{money(RULES.startingCapital)}</strong>
            </div>
            <div className="rulebook-stat-card">
              <span className="stat-label">Mục tiêu hợp lệ</span>
              <strong className="stat-val text-success">{money(RULES.goal + RULES.cashGoal)}</strong>
            </div>
            <div className="rulebook-stat-card">
              <span className="stat-label">Thời hạn chơi</span>
              <strong className="stat-val">4 Vòng quanh bàn cờ</strong>
            </div>
            <div className="rulebook-stat-card">
              <span className="stat-label">Lương mỗi vòng</span>
              <strong className="stat-val text-primary">+{money(RULES.recurringIncome)} / START</strong>
            </div>
          </div>
          <p className="rulebook-text">
            Bạn nhập vai một sinh viên vừa tốt nghiệp bước vào đời. Nhiệm vụ của bạn là quản lý dòng tiền thông minh, đầu tư sinh lời để khi hoàn thành 4 vòng quanh thành phố, tổng tiền mặt và tài sản thanh lý được đạt từ <strong>90 triệu VND</strong> trở lên (80M mua tài sản lớn + 10M quỹ dự phòng bắt buộc).
          </p>
        </div>
      ),
    },
    {
      id: 'board',
      title: 'Bàn cờ',
      icon: '🗺️',
      badge: 'Địa hình',
      headline: '20 ô chiến lược quanh thành phố',
      body: (
        <div className="rulebook-section">
          <ul className="rulebook-list">
            <li>
              <span className="list-icon">🚩</span>
              <div>
                <strong>Ô START (Ô 1):</strong> Nhận lương định kỳ <strong>14.000.000 đ</strong>, nhận lãi tiết kiệm đáo hạn và doanh thu từ cơ sở kinh doanh.
              </div>
            </li>
            <li>
              <span className="list-icon">🏦</span>
              <div>
                <strong>Ngân hàng (Ô 6, Ô 16):</strong> Gửi tiết kiệm có kỳ hạn an toàn, sinh lời chắc chắn theo từng lần qua ô START.
              </div>
            </li>
            <li>
              <span className="list-icon">📈</span>
              <div>
                <strong>Thị trường tài chính:</strong> Cổ phiếu (Ô 3, 13), Trái phiếu (Ô 8, 18), Vàng (Ô 11) để lướt sóng hoặc phòng thủ.
              </div>
            </li>
            <li>
              <span className="list-icon">🏪</span>
              <div>
                <strong>Cơ sở kinh doanh (Ô 14):</strong> Mua cửa hàng tạo dòng tiền thu nhập thụ động bền vững mỗi vòng.
              </div>
            </li>
            <li>
              <span className="list-icon">☕</span>
              <div>
                <strong>Sinh hoạt phí & Cơ hội:</strong> Dừng ô Chi phí sẽ trừ <strong>7.000.000 đ</strong>. Dừng ô Cơ hội/Rủi ro sẽ kích hoạt các sự kiện đời sống bất ngờ.
              </div>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'turn',
      title: 'Lượt chơi',
      icon: '🎲',
      badge: 'Thao tác',
      headline: 'Quy trình 1 lượt chơi đơn giản',
      body: (
        <div className="rulebook-section">
          <div className="rulebook-steps">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="step-content">
                <strong>Gieo xúc xắc</strong>
                <p>Bấm nút gieo để tung xúc xắc 1-6 mặt. Xúc xắc 3D sẽ lăn ngẫu nhiên.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="step-content">
                <strong>Di chuyển nhân vật</strong>
                <p>Nhân vật nhảy theo chiều kim đồng hồ quanh bàn cờ 20 ô.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="step-content">
                <strong>Kích hoạt sự kiện ô dừng</strong>
                <p>Chỉ ô mà nhân vật dừng chân mới kích hoạt sự kiện mua bán hoặc thanh toán.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">4</div>
              <div className="step-content">
                <strong>Ra quyết định tài chính</strong>
                <p>Chọn mua, bán, đầu tư hoặc bỏ qua tùy theo chiến lược của bạn.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'earn',
      title: 'Kiếm tiền',
      icon: '📈',
      badge: 'Tăng trưởng',
      headline: 'Các kênh gia tăng tài sản',
      body: (
        <div className="rulebook-section">
          <div className="rulebook-tip-box">
            <strong>💡 Mẹo tài chính:</strong> Đừng để toàn bộ tiền mặt nằm yên. Hãy phân bổ vốn vào nhiều giỏ khác nhau!
          </div>
          <ul className="rulebook-list">
            <li>
              <span className="list-icon">🏦</span>
              <div>
                <strong>Tiết kiệm Ngân hàng:</strong> Lãi suất 1, 2 hoặc 3 kỳ hạn. Lãi suất tính theo từng vòng START, tự động trả gốc và lãi khi đáo hạn.
              </div>
            </li>
            <li>
              <span className="list-icon">📊</span>
              <div>
                <strong>Cổ phiếu:</strong> Mua giá thấp, bán giá cao tại ô START hoặc phiên tái cơ cấu. Biến động theo từng chu kỳ thị trường.
              </div>
            </li>
            <li>
              <span className="list-icon">🛡️</span>
              <div>
                <strong>Trái phiếu & Vàng:</strong> Tài sản an toàn, ít rủi ro biến động mạnh, giúp bảo vệ danh mục khi thị trường suy thoái.
              </div>
            </li>
            <li>
              <span className="list-icon">🏢</span>
              <div>
                <strong>Cơ sở kinh doanh:</strong> Mang lại nguồn tiền cố định mỗi khi qua START. Có thể nâng cấp tầng để tăng thêm thu nhập nếu trùng xu hướng tiêu dùng.
              </div>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'funding',
      title: 'Chi phí & Nợ',
      icon: '💸',
      badge: 'Thanh khoản',
      headline: 'Xử lý khi thiếu tiền mặt bắt buộc',
      body: (
        <div className="rulebook-section">
          <p className="rulebook-text">
            Khi dừng chân vào các ô sinh hoạt phí (7.000.000 đ) hoặc sự kiện bất ngờ yêu cầu trả tiền, nếu tiền mặt không đủ, game sẽ mở màn hình <strong>Huy động vốn bắt buộc</strong>.
          </p>
          <div className="rulebook-steps">
            <div className="step-card">
              <div className="step-num">A</div>
              <div className="step-content">
                <strong>Rút sổ tiết kiệm</strong>
                <p>Rút toàn bộ khoản tiền gửi (mất phần lãi chưa đáo hạn).</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">B</div>
              <div className="step-content">
                <strong>Bán cổ phiếu / vàng / trái phiếu</strong>
                <p>Thanh lý nhanh tài sản tài chính theo thời giá hiện tại.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">C</div>
              <div className="step-content">
                <strong>Vay khẩn cấp</strong>
                <p>Vay tối đa trong hạn mức 30 triệu với lãi suất 10% trả tại vòng kết thúc.</p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'victory',
      title: 'Về đích',
      icon: '🏆',
      badge: 'Kết thúc',
      headline: 'Điều kiện phân định Thắng / Thua',
      body: (
        <div className="rulebook-section">
          <div className="rulebook-stat-grid">
            <div className="rulebook-stat-card full">
              <span className="stat-label">Tiêu chuẩn Chiến thắng</span>
              <strong className="stat-val text-success">Tiền thực thu $\ge$ 90.000.000 đ</strong>
            </div>
          </div>
          <p className="rulebook-text">
            Sau khi hoàn thành <strong>Vòng 4</strong> và bước qua ô START cuối cùng, game sẽ tự động thanh lý toàn bộ tài sản theo giá trị thị trường và hoàn trả các khoản nợ:
          </p>
          <ul className="rulebook-list compact">
            <li>✅ <strong>Thắng vẻ vang:</strong> Tổng tiền mặt hợp lệ đạt từ 90 triệu trở lên. AI Coach sẽ chúc mừng và phân tích chiến lược tài chính xuất sắc của bạn.</li>
            <li>⚠️ <strong>Cần cố gắng:</strong> Dưới 90 triệu, AI Coach sẽ chỉ ra những quyết định chi tiêu chưa tối ưu và gợi ý cách phân bổ vốn cho ván chơi sau.</li>
          </ul>
        </div>
      ),
    },
  ]

  const current = tabs[activeTab]

  return (
    <Modal title="Sổ Tay Luật Chơi">
      <div className="rulebook-container">
        {/* Navigation Tabs Bar */}
        <div className="rulebook-tabs-nav" role="tablist">
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === idx}
              className={`rulebook-tab-btn ${activeTab === idx ? 'active' : ''}`}
              onClick={() => setActiveTab(idx)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.title}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="rulebook-body" role="tabpanel">
          <div className="rulebook-header">
            <span className="rulebook-badge">{current.badge}</span>
            <h3 className="rulebook-headline">{current.headline}</h3>
          </div>
          {current.body}
        </div>

        {/* Footer controls */}
        <div className="rulebook-footer">
          <div className="rulebook-dots">
            {tabs.map((_, idx) => (
              <span
                key={idx}
                className={`rulebook-dot ${activeTab === idx ? 'active' : ''}`}
                onClick={() => setActiveTab(idx)}
              />
            ))}
          </div>
          <div className="rulebook-actions">
            {activeTab > 0 && (
              <button
                className="button secondary sm-button"
                onClick={() => setActiveTab(prev => prev - 1)}
              >
                ← Trước
              </button>
            )}
            {activeTab < tabs.length - 1 ? (
              <button
                className="button primary sm-button"
                onClick={() => setActiveTab(prev => prev + 1)}
              >
                Tiếp theo →
              </button>
            ) : (
              <button
                className="button primary sm-button"
                onClick={onClose}
              >
                Đã hiểu, vào game! 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
