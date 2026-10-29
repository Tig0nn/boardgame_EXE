import { tileDisplayLabel } from '../../../src/components/player-language'
import { GlossaryText } from '../../../src/components/FinancialTerm'
import { useRef, useState } from 'react'
import { ECONOMY } from '../../../src/data/config'
import { rulesForGame, MULTI_COURSE_RULES, isMultiCourse } from '../../../src/game/rules-profile'
import { money } from '../../../src/game/format'
import { Icon } from '../../../src/components/Icon'
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board'
import type { GameState } from '../../../src/game/types'
import { livingPresentation } from '../game/living-presentation'
import { businessRulesForGame } from '../../../src/game/business'
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard'
import { GamifiedModal } from './GamifiedModal'
import { sound } from '../utils/audio'

const steps = [
  {
    title: 'Từ vốn nhỏ, tới ước mơ lớn',
    tag: 'ĐÍCH ĐẾN CỦA BẠN',
    text: 'Bắt đầu với 50 triệu. Sau 4 lần qua ô Xuất phát, cần gom đủ 90 triệu sau phí và nợ.',
    detail: 'Mục tiêu là nguồn tiền hợp lệ: tiền mặt + gốc tiết kiệm đang gửi + giá bán tài sản tài chính sau phí, trừ nợ và các khoản phải trả. Vốn kinh doanh chưa bán và lãi tiết kiệm chưa nhận không được tính.',
  },
  {
    title: 'Một thành phố đầy cơ hội',
    tag: 'KHÁM PHÁ BÀN CỜ',
    text: 'Chạm ô để xem trước. Gieo xúc xắc → di chuyển → chọn hành động khi dừng; đi ngang không kích hoạt ô.',
    detail: '1 kỳ tài chính tương ứng với 1 vòng bàn cờ, kết thúc khi qua ô Xuất phát để nhận lương và quyết toán. Kỳ đầu của khoản đầu tư kết thúc ở lần quyết toán sắp tới. Ô Kinh doanh cho mua, nâng cấp hoặc bán quán. Ô thị trường cho mua hoặc bán đúng loại tài sản. Biến cố có thể đổi giá thị trường hoặc tạo khoản cần thanh toán.',
  },
  {
    title: 'Chạm xúc xắc, lên đường!',
    tag: 'MỘT LƯỢT CHƠI',
    text: 'Giữ tiền mặt cho sinh hoạt và bất ngờ. Bạn tự chọn mức dự phòng; đầu tư có thể làm tiền khó rút ngay.',
    detail: 'Chỉ quyết định khi nhân vật dừng. Mỗi lần ghé ô Cổ phiếu, Vàng hoặc Trái phiếu chỉ được một giao dịch mua hoặc bán thành công; xong là quay lại bàn cờ. Giao dịch lỗi không mất quyền. Bạn có thể bỏ qua hoặc giao dịch tiếp khi gặp lại ô ở lượt sau. Mở quán và gửi một khoản tiết kiệm xong cũng trở về bàn cờ.',
  },
  {
    title: 'Để đồng tiền cùng bạn lớn lên',
    tag: 'CHỌN CÁCH KIẾM TIỀN',
    text: 'Tiết kiệm có lãi cố định. Trái phiếu cho tổ chức phát hành vay: lãi trái phiếu định kỳ cao hơn đi cùng rủi ro chậm trả hoặc mất vốn.',
    detail: 'Ngân hàng: một khoản gửi mới mỗi lần ghé, kỳ hạn 1 / 2 / 3 kỳ với lãi 4/5/6% mỗi kỳ, lãi tính trên tiền gốc, nhận cuối kỳ hạn; các khoản độc lập, không tự tái tục. Cổ phiếu, vàng, trái phiếu được bán ở ô tương ứng, tại ô Xuất phát và huy động tiền thanh toán. Quán chỉ được nâng cấp hoặc bán từ lần ghé ô Kinh doanh sau lượt mua; mỗi lần ghé nâng tối đa một tầng. Quán nhận 3 triệu + 700 nghìn mỗi tầng + 1 triệu mỗi tầng hợp sở thích khách tại ô Xuất phát; giá bán chịu thị trường và khấu hao. Giá tài sản có thể giảm. Các mức giá trong trò chơi là mô phỏng, không phải dữ liệu giao dịch thực tế.',
  },
  {
    title: 'Luôn chừa tiền cho bất ngờ',
    tag: 'KHI CẦN THANH TOÁN',
    text: 'Dừng ở ô Sinh hoạt cần trả tiền. Thiếu tiền mặt? Bạn vẫn có thể xoay xở.',
    detail: 'Tiền mặt được dùng trước. Phần còn thiếu có thể kết hợp rút toàn khoản tiết kiệm, bán cổ phiếu/trái phiếu/vàng và vay trong hạn mức 30 triệu. Rút sớm mất toàn bộ lãi kỳ hạn chưa trả; tiền thừa vẫn ở ví. Vay chịu lãi 10% ở kỳ trả kế tiếp; vay tại lần qua ô Xuất phát cuối được cộng lãi vào nợ ngay. Không bán khẩn cấp quán kinh doanh. Hết nguồn thanh toán thì hành trình kết thúc.',
  },
  {
    title: 'Về đích với một chiếc ví vững vàng',
    tag: 'SẴN SÀNG CHƯA?',
    text: 'Hoàn thành 4 vòng và tích lũy đủ 90 triệu từ nguồn tiền về đích là chiến thắng!',
    detail: 'Mục tiêu duy nhất: 90 triệu từ tiền mặt, gốc tiết kiệm rút được và tiền bán tài sản tài chính, sau phí, nợ và khoản phải trả. Không cần toàn bộ là tiền mặt, không buộc giữ riêng 10 triệu. Nếu chưa đủ hoặc hết khả năng thanh toán, hãy thử một hành trình mới. Sổ tay luôn ở ngay trên màn hình để bạn xem lại bất cứ lúc nào.',
  },
]

export function BoardGuide({ game }: { game?: GameState }) {
  const board = game ? boardFor(game) : MULTI_COURSE_B18_BOARD
  return (
    <ol className="rulebook-board" style={{ margin: '6px 0', paddingLeft: '20px' }}>
      {board.map((tile) => (
        <li key={tile.index} value={tile.index + 1}>
          <Icon name={tile.icon} size={16} /> {tileDisplayLabel(tile.label)}
        </li>
      ))}
    </ol>
  )
}

export function Tutorial({
  firstTime,
  onClose,
  game,
  onHelp,
}: {
  firstTime: boolean
  onClose: () => void
  game?: GameState
  onHelp?: () => void
}) {
  const [index, setIndex] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const living = livingPresentation(game)
  const rules = game ? rulesForGame(game) : MULTI_COURSE_RULES
  const step =
    index === 4
      ? {
          ...steps[index],
          title: 'Chủ động cho mỗi vòng mới',
          text: living.text,
          detail: `${living.detail} ${steps[index].detail}`,
        }
      : steps[index]

  const navigate = (next: number) => {
    sound.playClick()
    setIndex(next)
    heading.current?.focus({ preventScroll: true })
  }

  return (
    <GamifiedModal
      badgeText={firstTime ? 'CHÀO MỪNG TÂN BINH' : 'SỔ TAY HÀNH TRÌNH'}
      title="Hướng dẫn chơi"
      onClose={firstTime ? undefined : onClose}
      onHelp={firstTime ? undefined : onHelp}
      primaryAction={{
        label:
          index === steps.length - 1
            ? firstTime
              ? 'Sẵn sàng chơi! →'
              : 'Đóng sổ tay'
            : 'Tiếp theo →',
        onClick: () => {
          sound.playClick()
          if (index === steps.length - 1) onClose()
          else navigate(index + 1)
        },
      }}
      secondaryAction={
        index > 0
          ? {
              label: 'Quay lại',
              onClick: () => navigate(index - 1),
            }
          : undefined
      }
    >
      {/* Topline & Skip button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: '#D97706',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          {index + 1} / {steps.length} · {step.tag}
        </span>
        {firstTime && (
          <button
            type="button"
            onClick={() => {
              sound.playClick()
              onClose()
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '2px 4px',
            }}
          >
            Bỏ qua hướng dẫn
          </button>
        )}
      </div>

      {/* Stepper Progress Bar */}
      <div
        className="tutorial-progress"
        role="progressbar"
        aria-label="Tiến độ hướng dẫn"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={index + 1}
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '8px',
          width: '100%',
        }}
      >
        {steps.map((item, i) => (
          <div
            key={item.title}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '9999px',
              background: i === index ? '#F59E0B' : i < index ? '#10B981' : '#E2E8F0',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Main Step Content Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FEFCE8 0%, #FEF9C3 100%)',
          border: '1.5px solid #FDE047',
          borderRadius: '16px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 2px 4px rgba(245, 158, 11, 0.08)',
        }}
      >
        <h2
          ref={heading}
          tabIndex={-1}
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 900,
            color: '#713F12',
            letterSpacing: '-0.2px',
            outline: 'none',
          }}
        >
          {step.title}
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#854D0E', lineHeight: '1.45' }}>
          <GlossaryText text={step.text} />
        </p>
      </div>

      {/* Step Graphics / Interactive Breakdown */}
      {index === 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '8px',
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 12px',
            textAlign: 'center',
          }}
        >
          <div>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', display: 'block' }}>
              Vốn ban đầu
            </small>
            <strong style={{ fontSize: '13.5px', fontWeight: 900, color: '#16A34A' }}>
              50 triệu
            </strong>
          </div>
          <span style={{ color: '#D97706', fontWeight: 900 }}>→</span>
          <div>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', display: 'block' }}>
              Mục tiêu sau 4 vòng
            </small>
            <strong style={{ fontSize: '13.5px', fontWeight: 900, color: '#D97706' }}>
              90 triệu
            </strong>
          </div>
        </div>
      )}

      {index === 1 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}
        >
          {[
            ['🏦', 'Ngân hàng', 'Gửi tiết kiệm'],
            ['📈', 'Thị trường', 'Mua tài sản'],
            ['🧋', 'Kinh doanh', 'Mở & nâng quán'],
            ['📚', 'Khóa học', 'Tăng lương'],
            ['🧾', living.periodic ? 'Xuất phát' : 'Sinh hoạt', living.periodic ? 'Lương & sinh hoạt' : 'Trả chi phí'],
            ['⚡', 'Biến cố', 'Đón bất ngờ'],
          ].map(([icon, title, text]) => (
            <div
              key={title}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span aria-hidden="true" style={{ fontSize: '14px' }}>
                  {icon}
                </span>
                <strong style={{ fontSize: '11.5px', color: '#1E293B' }}>{title}</strong>
              </div>
              <small style={{ fontSize: '10.5px', color: '#64748B' }}>{text}</small>
            </div>
          ))}
        </div>
      )}

      {index === 2 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 10px',
          }}
        >
          {['Gieo xúc xắc', 'Nhân vật di chuyển', 'Khám phá ô dừng', 'Chọn hành động'].map(
            (title, i) => (
              <div
                key={title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#334155',
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#FEF3C7',
                    color: '#B45309',
                    fontSize: '10px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <strong style={{ fontWeight: 800 }}>{title}</strong>
              </div>
            )
          )}
        </div>
      )}

      {index === 3 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          {[
            ['🏦 Tiết kiệm', 'Nhận gốc + lãi khi đến hạn'],
            ['🧾 Trái phiếu', 'Chọn bên phát hành · Lãi coupon'],
            ['📈 Cổ phiếu', 'Mua/bán theo nhịp thị trường'],
            ['🧋 Mở quán', `+${money(ECONOMY.business.baseIncome)} / lần qua ô Xuất phát`],
            [
              '📚 Khóa học',
              !game || isMultiCourse(game)
                ? '6M / +2M · 10M / +4M mỗi lần qua ô Xuất phát'
                : `Lương +${money(rules.courseBoost!)} / vòng`,
            ],
          ].map(([name, note]) => (
            <div
              key={name}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '6px 8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '11.5px',
              }}
            >
              <strong style={{ color: '#1E1B4B' }}>{name}</strong>
              <small style={{ color: '#64748B', fontSize: '10.5px' }}>{note}</small>
            </div>
          ))}
        </div>
      )}

      {index === 4 && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1.5px solid #FECACA',
            borderRadius: '14px',
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#B91C1C' }}>
              {living.label}
            </span>
            <strong style={{ fontSize: '13.5px', fontWeight: 900, color: '#DC2626' }}>
              {money(living.amount)}
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#991B1B', lineHeight: '1.4' }}>
            💡 Chừa tiền sinh hoạt · Dự phòng biến cố cá nhân bất ngờ.
          </p>
        </div>
      )}

      {index === 5 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: '14px',
              padding: '8px 10px',
            }}
          >
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#15803D', display: 'block' }}>
              Một mục tiêu
            </small>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: '#16A34A' }}>
              90 triệu
            </strong>
          </div>
          <div
            style={{
              background: '#FDF4FF',
              border: '1.5px solid #F0ABFC',
              borderRadius: '14px',
              padding: '8px 10px',
            }}
          >
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#86198F', display: 'block' }}>
              Thời hạn
            </small>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: '#A21CAF' }}>
              4 vòng
            </strong>
          </div>
        </div>
      )}

      {game && businessRulesForGame(game) === 'v2.4-customer-preferences' && (
        <details
          className="tutorial-preference"
          style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '6px 8px',
            fontSize: '11px',
          }}
        >
          <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Thị hiếu vòng hiện tại</summary>
          <div style={{ marginTop: '6px' }}>
            <CustomerPreferenceCard game={game} showUpgrades />
          </div>
        </details>
      )}

      {/* Expandable Detailed Rulebook Details */}
      <details
        key={index}
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '8px 10px',
          fontSize: '11.5px',
          color: '#334155',
          lineHeight: '1.4',
        }}
      >
        <summary style={{ fontWeight: 800, color: '#1E293B', cursor: 'pointer', outline: 'none' }}>
          📖 Luật chi tiết
        </summary>
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0 }}>
            <GlossaryText text={step.detail} />
          </p>
          {index === 1 && (
            <>
              <p style={{ margin: '4px 0 0' }}>{living.text}</p>
              <BoardGuide game={game} />
            </>
          )}
          {index === 3 && (
            <>
              <p style={{ margin: 0 }}>
                Kỳ hạn 1 / 2 / 3 kỳ: lãi đơn cuối kỳ lần lượt 4% / 10% / 18% tiền gốc. Giá thị trường là dữ liệu hư cấu trong trò chơi; không phải giá giao dịch thực tế.
              </p>
              <p style={{ margin: 0 }}>
                Đầu vòng đọc Bản tin thị trường; tại ô mua mở “Xem tín hiệu thị trường”. Cuối vòng, “Dự báo và thực tế” cho biết giá đã đổi ra sao.
              </p>
            </>
          )}
          {index === 5 && (
            <>
              <p style={{ margin: 0 }}>
                Trò chơi tính nguồn tiền có thể huy động theo báo giá hợp lệ, không tự tạo giao dịch thanh lý toàn bộ tài sản.
              </p>
              <p style={{ margin: 0 }}>
                AI Coach là gợi ý tùy chọn, có thể không sẵn sàng hoặc nhận xét sai. Hãy đối chiếu với nhật ký ván chơi.
              </p>
            </>
          )}
        </div>
      </details>
    </GamifiedModal>
  )
}
