import React, { useState } from 'react';

interface ReplayStep {
  turn: number;
  diceRoll: number;
  tileIndex: number;
  tileName: string;
  round: number;
  action: string;
  cash: number;
  netWorth: number;
}

interface ReplayTabProps {
  initialSeed?: string;
}

// Simple string-to-number hash for Mulberry32 seed
const stringToSeed = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 42819;
};

// Deterministic Mulberry32 generator for visualization
const generateStepsFromSeed = (seedStr: string): ReplayStep[] => {
  let s = stringToSeed(seedStr);
  const random = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const tileNames = [
    'Xuất phát (Nhận lương)', 'Khóa học bản thân', 'Cổ phiếu đợt 1', 'Sự kiện đời sống',
    'Chi phí sinh hoạt', 'Ngân hàng tiết kiệm', 'Sự kiện bất ngờ', 'Trái phiếu doanh nghiệp',
    'Cơ hội đầu tư', 'Chi phí thuê nhà', 'Giao dịch vàng', 'Sự kiện thị trường',
    'Cổ phiếu đợt 2', 'Cơ sở kinh doanh F&B', 'Chi phí sinh hoạt', 'Ngân hàng tiết kiệm',
    'Rủi ro đột xuất', 'Trái phiếu đợt 2', 'Cơ hội hợp tác', 'Chi phí phát sinh'
  ];

  const steps: ReplayStep[] = [];
  let currentTile = 0;
  let round = 1;
  let cash = 50000000;
  let netWorth = 50000000;

  for (let turn = 1; turn <= 16; turn++) {
    const diceRoll = Math.floor(random() * 6) + 1;
    const prevTile = currentTile;
    currentTile = (currentTile + diceRoll) % 20;

    if (currentTile < prevTile) {
      round = Math.min(4, round + 1);
      cash += 14000000;
      netWorth += 14000000;
    }

    let action = `Đổ được [${diceRoll}] tiến tới ô #${currentTile}`;
    if (currentTile === 0) {
      action += ' • Nhận lương 14.0M VND';
    } else if (currentTile === 4 || currentTile === 9 || currentTile === 14 || currentTile === 19) {
      const cost = 7000000;
      cash = Math.max(0, cash - cost);
      netWorth = Math.max(0, netWorth - cost);
      action += ` • Thanh toán chi phí -${(cost / 1000000).toFixed(1)}M`;
    } else if (currentTile === 2 || currentTile === 12) {
      const delta = Math.floor((random() - 0.3) * 10000000);
      cash += delta;
      netWorth += delta;
      action += ` • Giao dịch cổ phiếu ${delta >= 0 ? '+' : ''}${(delta / 1000000).toFixed(1)}M`;
    } else {
      const delta = Math.floor((random() - 0.2) * 8000000);
      cash += delta;
      netWorth += delta;
      action += ` • Biến động tài sản ${delta >= 0 ? '+' : ''}${(delta / 1000000).toFixed(1)}M`;
    }

    steps.push({
      turn,
      diceRoll,
      tileIndex: currentTile,
      tileName: tileNames[currentTile] || `Ô #${currentTile}`,
      round,
      action,
      cash,
      netWorth,
    });
  }

  return steps;
};

export const ReplayTab: React.FC<ReplayTabProps> = ({ initialSeed = 'saigon-alpha-2026' }) => {
  const [seedInput, setSeedInput] = useState<string>(initialSeed);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const steps = React.useMemo(() => generateStepsFromSeed(seedInput), [seedInput]);
  const activeStep = steps[currentStepIndex] || steps[0];

  React.useEffect(() => {
    let timer: number | null = null;
    if (isPlaying) {
      timer = window.setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / replaySpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, replaySpeed, steps.length]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px' }}>
      {/* Control Panel */}
      <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Kiểm tra diễn biến ván chơi
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tái hiện chính xác từng lượt xúc xắc và sự kiện dựa theo mã ván
          </p>
        </div>

        {/* Seed Input */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Mã ván chơi (Seed):
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={seedInput}
              onChange={(e) => {
                setSeedInput(e.target.value);
                setCurrentStepIndex(0);
                setIsPlaying(false);
              }}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--radius-xs)',
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
              }}
              className="mono"
            />
            <button
              onClick={() => {
                setSeedInput(`seed-xvtl-${Math.floor(Math.random() * 90000) + 10000}`);
                setCurrentStepIndex(0);
                setIsPlaying(false);
              }}
              className="btn"
            >
              Tạo mã mới
            </button>
          </div>
        </div>

        {/* Current State Snapshot */}
        <div style={{ padding: '14px', borderRadius: 'var(--radius-xs)', background: '#f8fafc', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lượt hiện tại:</span>
            <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Lượt {activeStep.turn} / {steps.length} (Vòng {activeStep.round}/4)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-xs)',
              background: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 700,
              color: '#ffffff',
            }} className="mono">
              {activeStep.diceRoll}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{activeStep.tileName}</div>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vị trí ô #{activeStep.tileIndex}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tiền mặt</div>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {(activeStep.cash / 1000000).toFixed(1)}M VND
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tài sản ròng</div>
              <div className="mono" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {(activeStep.netWorth / 1000000).toFixed(1)}M VND
              </div>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIndex === 0}
              className="btn"
              style={{ flex: 1, opacity: currentStepIndex === 0 ? 0.4 : 1 }}
            >
              Lượt trước
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="btn btn-primary"
              style={{ flex: 1.4 }}
            >
              {isPlaying ? 'Tạm dừng' : 'Tự động chạy'}
            </button>
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className="btn"
              style={{ flex: 1, opacity: currentStepIndex === steps.length - 1 ? 0.4 : 1 }}
            >
              Lượt sau
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Tốc độ phát:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setReplaySpeed(spd)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid',
                    borderColor: replaySpeed === spd ? 'var(--text-primary)' : 'var(--border-light)',
                    background: replaySpeed === spd ? '#0f172a' : '#ffffff',
                    color: replaySpeed === spd ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  className="mono"
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Export JSON */}
        <button
          onClick={() => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(steps, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `replay_${seedInput}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}
          className="btn"
          style={{ width: '100%', marginTop: '4px' }}
        >
          Xuất dữ liệu ván đấu (JSON)
        </button>
      </div>

      {/* Step by Step Timeline Table */}
      <div className="panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Chi tiết 16 lượt đi của ván đấu
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Nhấp chuột vào bất kỳ hàng nào để xem trạng thái tại lượt đó
        </p>

        <div style={{ overflowX: 'auto', maxHeight: '540px' }}>
          <table>
            <thead>
              <tr>
                <th>Lượt</th>
                <th>Xúc xắc</th>
                <th>Ô đích đến</th>
                <th>Sự kiện diễn ra</th>
                <th style={{ textAlign: 'right' }}>Tài sản ròng</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                return (
                  <tr
                    key={step.turn}
                    onClick={() => {
                      setCurrentStepIndex(idx);
                      setIsPlaying(false);
                    }}
                    style={{
                      background: isCurrent ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td className="mono" style={{ fontSize: '11px' }}>
                      #{step.turn} (V{step.round})
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      [{step.diceRoll}]
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{step.tileName}</span>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        (#{step.tileIndex})
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {step.action}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">
                      {(step.netWorth / 1000000).toFixed(1)}M
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
