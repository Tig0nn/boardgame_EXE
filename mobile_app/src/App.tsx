import React, { useState, useRef, useEffect } from 'react';
import tilesData from './data/tiles.json';
import economyData from './data/economy.json';
import { MobileContainer } from './components/MobileContainer';
import { TopHud } from './components/TopHud';
import { BoardView } from './components/BoardView';
import { Dice3D } from './components/Dice3D';
import { BottomControls } from './components/BottomControls';
import { PortfolioDrawer } from './components/PortfolioDrawer';
import { EventModal, EventActionPayload } from './components/EventModal';
import { FundingDialog } from './components/FundingDialog';
import { LapSummaryModal } from './components/LapSummaryModal';
import { RebalanceModal } from './components/RebalanceModal';
import { GameResultModal } from './components/GameResultModal';
import { FloatingMoney, MoneyParticle } from './components/FloatingMoney';
import { PhoneQrModal } from './components/PhoneQrModal';
import { sound } from './utils/audio';

export const App: React.FC = () => {
  const [currentTileIndex, setCurrentTileIndex] = useState<number>(0);
  const [lap, setLap] = useState<number>(1);
  const [cash, setCash] = useState<number>(economyData.initialCash);
  const [debt, setDebt] = useState<number>(0);
  const [netWorth, setNetWorth] = useState<number>(economyData.initialCash);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastDice, setLastDice] = useState<number>(1);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [isDiceOnBoard, setIsDiceOnBoard] = useState<boolean>(false);
  const [isPawnMoving, setIsPawnMoving] = useState<boolean>(false);
  const [isDancing, setIsDancing] = useState<boolean>(false);
  const [shakeScreen, setShakeScreen] = useState<boolean>(false);
  const [particles, setParticles] = useState<MoneyParticle[]>([]);

  // Trạng thái tài sản
  const [stocksCount, setStocksCount] = useState<number>(0);
  const [goldCount, setGoldCount] = useState<number>(0);
  const [bondsCount, setBondsCount] = useState<number>(0);
  const [hasCourse, setHasCourse] = useState<boolean>(false);
  const [hasBusiness, setHasBusiness] = useState<boolean>(false);
  const [salaryBonus, setSalaryBonus] = useState<number>(0);

  // Trạng thái modal
  const [isPortfolioOpen, setIsPortfolioOpen] = useState<boolean>(false);
  const [activeEventTile, setActiveEventTile] = useState<typeof tilesData[0] | null>(null);
  const [isFundingOpen, setIsFundingOpen] = useState<boolean>(false);
  const [fundingCost, setFundingCost] = useState<number>(0);
  const [isLapSummaryOpen, setIsLapSummaryOpen] = useState<boolean>(false);
  const [isRebalanceOpen, setIsRebalanceOpen] = useState<boolean>(false);
  const [isGameResultOpen, setIsGameResultOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref để truy cập state mới nhất trong async hop loop
  const stateRef = useRef({
    currentTileIndex,
    lap,
    cash,
    netWorth,
    salaryBonus,
    hasBusiness,
    debt,
  });

  useEffect(() => {
    stateRef.current = { currentTileIndex, lap, cash, netWorth, salaryBonus, hasBusiness, debt };
  }, [currentTileIndex, lap, cash, netWorth, salaryBonus, hasBusiness, debt]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Tạo hiệu ứng số tiền bay lơ lửng
  const triggerMoneyParticle = (text: string, type: 'gain' | 'loss' | 'bonus', x = 470, y = 840) => {
    const id = Date.now().toString() + Math.random().toString();
    setParticles((prev) => [...prev, { id, text, type, x, y }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1500);
  };

  // Hiệu ứng rung màn hình & chớp viền đỏ khi gặp rủi ro
  const triggerScreenShake = () => {
    setShakeScreen(true);
    sound.playAlert();
    sound.triggerHaptic('heavy');
    setTimeout(() => {
      setShakeScreen(false);
    }, 350);
  };

  // Tự động mở khóa phần cứng Audio và phát nhạc nền ngay từ chạm đầu tiên
  useEffect(() => {
    const unlockOnFirstInteraction = () => {
      sound.unlockAudio();
      if (!isMuted) {
        sound.startBgm();
      }
      window.removeEventListener('touchstart', unlockOnFirstInteraction, true);
      window.removeEventListener('click', unlockOnFirstInteraction, true);
    };
    window.addEventListener('touchstart', unlockOnFirstInteraction, true);
    window.addEventListener('click', unlockOnFirstInteraction, true);
    return () => {
      window.removeEventListener('touchstart', unlockOnFirstInteraction, true);
      window.removeEventListener('click', unlockOnFirstInteraction, true);
    };
  }, [isMuted]);

  // Toggle bật/tắt âm thanh
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    sound.isMuted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted) {
      sound.unlockAudio();
      sound.startBgm();
      sound.playClick();
      showToast('🔊 Đã bật âm thanh & Nhạc nền sống động');
    } else {
      sound.stopBgm();
      showToast('🔇 Đã tắt âm thanh');
    }
  };

  // Logic gieo xúc xắc 3D & Di chuyển quân cờ lượn sóng từng ô
  const handleRollDice = async () => {
    if (
      isRolling ||
      isPawnMoving ||
      isDiceOnBoard ||
      activeEventTile ||
      isFundingOpen ||
      isLapSummaryOpen ||
      isRebalanceOpen ||
      isGameResultOpen
    ) return;

    sound.unlockAudio();
    sound.playClick();
    sound.playDiceRoll();
    sound.triggerHaptic('medium');

    const diceRoll = Math.floor(Math.random() * 6) + 1;
    setLastDice(diceRoll); // Cập nhật ngay để xúc xắc 3D xoay chuẩn xác tới mặt đích đến
    setIsDiceOnBoard(true); // Bay lên cỏ và GIỮ CỐ ĐỊNH trên cỏ
    setIsRolling(true);
    showToast('🎲 Đang gieo...');

    // Thời gian cho xúc xắc bay lên bãi cỏ và nảy 2 nhịp
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsRolling(false);

    // Dừng 400ms để người chơi nhìn rõ mặt số vừa gieo được trước khi quân cờ bắt đầu nhảy
    await new Promise((resolve) => setTimeout(resolve, 400));

    setIsPawnMoving(true);
    let curr = stateRef.current.currentTileIndex;
    let currLap = stateRef.current.lap;
    let currCash = stateRef.current.cash;
    let crossedStart = false;

    for (let step = 1; step <= diceRoll; step++) {
      sound.playHop();
      sound.triggerHaptic('light');
      await new Promise((resolve) => setTimeout(resolve, 280));

      curr = (curr + 1) % tilesData.length;
      setCurrentTileIndex(curr);

      if (curr === 0) {
        crossedStart = true;
        const nextLap = currLap + 1;
        const effectiveSalary = economyData.salaryPerLap + stateRef.current.salaryBonus;
        const bizIncome = stateRef.current.hasBusiness ? 3_000_000 : 0;
        const debtInterest = Math.round(stateRef.current.debt * 0.1);
        const netGain = effectiveSalary + bizIncome - economyData.livingCostPerLap - debtInterest;
        currCash += netGain;

        currLap = nextLap;
        setLap(currLap);
        setCash(currCash);
        setNetWorth(currCash + stocksCount * 10_000_000 + goldCount * 6_000_000 + bondsCount * 8_000_000 - stateRef.current.debt);

        sound.playCoin();
        triggerMoneyParticle(`+${effectiveSalary / 1_000_000}M ₫ Lương`, 'gain', 470, 1100);
      }
    }

    setIsPawnMoving(false);
    // Lưu ý: xúc xắc VẪN Ở LẠI TRÊN CỎ, chỉ bay về khi User nhận thưởng/mua/bỏ qua!

    // Xử lý sau khi hoàn tất bước nhảy
    if (crossedStart) {
      setIsDancing(true);
      setTimeout(() => setIsDancing(false), 3000);
      if (currLap > economyData.totalLaps) {
        sound.playVictory();
        setIsGameResultOpen(true);
      } else {
        sound.playCoin();
        setIsLapSummaryOpen(true);
      }
    } else {
      const destinationTile = tilesData[curr];
      if (destinationTile && destinationTile.type !== 'start') {
        if (destinationTile.category === 'shock' || destinationTile.type === 'living') {
          triggerScreenShake();
        }
        sound.playEventShow();
        setActiveEventTile(destinationTile);
      } else {
        // Ô không có sự kiện: sau 700ms xúc xắc mới tự động về Footer
        setTimeout(() => {
          setIsDiceOnBoard(false);
        }, 700);
      }
    }
  };

  // Xử lý xác nhận hành động trong EventModal
  const handleConfirmAction = (payload: EventActionPayload) => {
    sound.playClick();
    const currentCost = payload.cost || 0;
    const currentIncome = payload.income || 0;

    if (currentCost > cash) {
      triggerScreenShake();
      setFundingCost(currentCost);
      setIsFundingOpen(true);
      return;
    }

    const nextCash = cash - currentCost + currentIncome;
    let nextNetWorth = netWorth - currentCost + currentIncome;

    if (payload.type === 'buy_course') {
      sound.playCoin();
      setHasCourse(true);
      setSalaryBonus((prev) => prev + (payload.recurringBoost || 3_000_000));
      triggerMoneyParticle('+3M/vòng Lương', 'bonus');
    } else if (payload.type === 'buy_business') {
      sound.playCoin();
      setHasBusiness(true);
      nextNetWorth += 20_000_000;
      triggerMoneyParticle('Khởi Nghiệp ☕', 'bonus');
    } else if (payload.type === 'buy_stock') {
      sound.playCoin();
      setStocksCount((c) => c + 1);
      nextNetWorth += currentCost;
      triggerMoneyParticle('📈 Mua Cổ Phiếu', 'bonus');
    } else if (payload.type === 'buy_gold') {
      sound.playCoin();
      setGoldCount((c) => c + 1);
      nextNetWorth += currentCost;
      triggerMoneyParticle('🟡 Mua Vàng SJC', 'bonus');
    } else if (payload.type === 'buy_bonds') {
      sound.playCoin();
      setBondsCount((c) => c + 1);
      nextNetWorth += currentCost;
      triggerMoneyParticle('📜 Mua Trái Phiếu', 'bonus');
    } else if (payload.type === 'pay_living' || payload.type === 'pay_shock_now') {
      sound.playPay();
      triggerMoneyParticle(`-${currentCost / 1_000_000}M ₫`, 'loss');
    } else if (payload.type === 'receive_bonus') {
      sound.playCoin();
      triggerMoneyParticle(`+${currentIncome / 1_000_000}M ₫ Thưởng`, 'gain');
    }

    setCash(nextCash);
    setNetWorth(nextNetWorth);
    setActiveEventTile(null);
    setIsDiceOnBoard(false); // User nhận thưởng/mua cổ phiếu xong: xúc xắc từ từ bay về Footer!
    showToast(`✅ ${payload.detail}`);
  };

  // Bán tài sản trong RebalanceModal
  const handleSellStock = () => {
    if (stocksCount <= 0) return;
    sound.playCoin();
    setStocksCount((c) => c - 1);
    const nextCash = cash + 10_000_000;
    setCash(nextCash);
    triggerMoneyParticle('+10M ₫', 'gain');
    showToast('📈 Đã bán 1 lô cổ phiếu (+10M VND)');
  };

  const handleSellGold = () => {
    if (goldCount <= 0) return;
    sound.playCoin();
    setGoldCount((c) => c - 1);
    const nextCash = cash + 6_000_000;
    setCash(nextCash);
    triggerMoneyParticle('+6M ₫', 'gain');
    showToast('🟡 Đã bán 1 lượng vàng SJC (+6M VND)');
  };

  const handleSellBond = () => {
    if (bondsCount <= 0) return;
    sound.playCoin();
    setBondsCount((c) => c - 1);
    const nextCash = cash + 8_000_000;
    setCash(nextCash);
    triggerMoneyParticle('+8M ₫', 'gain');
    showToast('📜 Đã bán 1 lô trái phiếu (+8M VND)');
  };

  // Vay nợ khẩn cấp
  const handleBorrow = (amount: number) => {
    sound.playCoin();
    const nextDebt = debt + amount;
    const nextCash = cash + amount;
    setDebt(nextDebt);
    setCash(nextCash);
    setIsFundingOpen(false);
    triggerMoneyParticle(`+${amount / 1_000_000}M ₫ Vay`, 'gain');
    showToast(`💳 Vay khẩn cấp thành công +${amount / 1_000_000}M ₫ (Dư nợ: ${nextDebt / 1_000_000}M)`);
  };

  // Reset chơi lại ván mới
  const handleRestart = () => {
    sound.playClick();
    setCurrentTileIndex(0);
    setLap(1);
    setCash(economyData.initialCash);
    setDebt(0);
    setNetWorth(economyData.initialCash);
    setStocksCount(0);
    setGoldCount(0);
    setBondsCount(0);
    setHasCourse(false);
    setHasBusiness(false);
    setSalaryBonus(0);
    setIsGameResultOpen(false);
    setIsLapSummaryOpen(false);
    showToast('🔄 Đã khởi tạo hành trình tài chính mới!');
  };

  return (
    <>
      <PhoneQrModal networkUrl="http://192.168.2.7:5174/" />
      <MobileContainer>
      {/* 1. HUD Chỉ Số Tài Chính Đỉnh Màn Hình */}
      <TopHud
        cash={cash}
        debt={debt}
        netWorth={netWorth}
        targetGoal={economyData.targetGoal}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* 2. Bàn Cờ, Layer SectionPlay, Xúc Xắc 3D & Quân Cờ */}
      <BoardView
        currentTileIndex={currentTileIndex}
        tileCoordinates={tilesData}
        lap={Math.min(lap, economyData.totalLaps)}
        totalLaps={economyData.totalLaps}
        isPawnMoving={isPawnMoving}
        isDancing={isDancing}
        shakeScreen={shakeScreen}
      >
        <Dice3D
          value={lastDice}
          isRolling={isRolling}
          onRollClick={handleRollDice}
          disabled={
            isPawnMoving ||
            isDiceOnBoard ||
            !!activeEventTile ||
            isFundingOpen ||
            isLapSummaryOpen ||
            isGameResultOpen
          }
          isUpOnLawn={isDiceOnBoard}
        />

        {/* Hiệu ứng hạt tiền bay lơ lửng */}
        <FloatingMoney particles={particles} />
      </BoardView>

      {/* Thông Báo Toast */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '280px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 60,
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1.5px solid #F59E0B',
          borderRadius: '999px',
          padding: '10px 24px',
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: 700,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(12px)',
          animation: 'fadeInDown 0.3s ease',
        }}>
          {toastMessage}
        </div>
      )}

      {/* 3. Vùng Điều Khiển Đáy Màn Hình */}
      <BottomControls
        onRollClick={handleRollDice}
        onPortfolioClick={() => {
          sound.playClick();
          setIsPortfolioOpen(true);
        }}
        onLogClick={() => {
          sound.playClick();
          showToast(`📜 Nhật ký: Vòng ${lap}/${economyData.totalLaps} • Tài sản ròng: ${(netWorth / 1_000_000).toLocaleString()}M ₫`);
        }}
        lastDiceValue={lastDice}
      />

      {/* 4. Drawer Ví Tài Sản Bật Lên Từ Đáy */}
      <PortfolioDrawer
        isOpen={isPortfolioOpen}
        onClose={() => {
          sound.playClick();
          setIsPortfolioOpen(false);
        }}
        cash={cash}
        debt={debt}
        netWorth={netWorth}
        targetGoal={economyData.targetGoal}
      />

      {/* 5. Modal Xử Lý Sự Kiện Ô Dừng Chân */}
      <EventModal
        tile={activeEventTile}
        cash={cash}
        hasCourse={hasCourse}
        hasBusiness={hasBusiness}
        onConfirmAction={handleConfirmAction}
        onClose={() => {
          sound.playClick();
          setActiveEventTile(null);
          setIsDiceOnBoard(false); // User bỏ qua hoặc đóng: xúc xắc từ từ bay về Footer!
        }}
      />

      {/* 6. Modal Xử Lý Khủng Hoảng Thanh Khoản */}
      <FundingDialog
        isOpen={isFundingOpen}
        requiredAmount={fundingCost}
        currentCash={cash}
        currentDebt={debt}
        maxDebtLimit={economyData.maxDebtLimit}
        onBorrow={handleBorrow}
        onClose={() => {
          sound.playClick();
          setIsFundingOpen(false);
        }}
      />

      {/* 7. Modal Báo Cáo Quyết Toán Vòng (Lap Summary) */}
      <LapSummaryModal
        isOpen={isLapSummaryOpen}
        lap={lap}
        totalLaps={economyData.totalLaps}
        salary={economyData.salaryPerLap}
        salaryBonus={salaryBonus}
        businessIncome={hasBusiness ? 3_000_000 : 0}
        livingCost={economyData.livingCostPerLap}
        debtInterest={Math.round(debt * 0.1)}
        onOpenRebalance={() => {
          sound.playClick();
          setIsRebalanceOpen(true);
        }}
        onContinue={() => {
          sound.playClick();
          setIsLapSummaryOpen(false);
          setIsDiceOnBoard(false); // Hoàn tất qua vòng: xúc xắc từ từ bay về Footer!
        }}
      />

      {/* 8. Modal Tái Cơ Cấu Tài Sản (Rebalance) */}
      <RebalanceModal
        isOpen={isRebalanceOpen}
        onClose={() => {
          sound.playClick();
          setIsRebalanceOpen(false);
          setIsDiceOnBoard(false); // Hoàn tất tái cơ cấu: xúc xắc từ từ bay về Footer!
        }}
        stockHoldings={stocksCount}
        goldHoldings={goldCount}
        bondHoldings={bondsCount}
        onSellStock={handleSellStock}
        onSellGold={handleSellGold}
        onSellBond={handleSellBond}
      />

      {/* 9. Modal Kết Quả Chung Cuộc & AI Coach */}
      <GameResultModal
        isOpen={isGameResultOpen}
        cash={cash}
        debt={debt}
        stocksCount={stocksCount}
        goldCount={goldCount}
        bondsCount={bondsCount}
        hasBusiness={hasBusiness}
        hasCourse={hasCourse}
        targetGoal={economyData.targetGoal}
        onRestart={handleRestart}
      />

      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </MobileContainer>
    </>
  );
};

export default App;
