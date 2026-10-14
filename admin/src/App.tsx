import React, { useState, useEffect } from 'react';
import { Sidebar, AdminTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { PlayersTab } from './components/PlayersTab';
import { EconomyTab } from './components/EconomyTab';
import { AiMonitorTab } from './components/AiMonitorTab';
import { ReplayTab } from './components/ReplayTab';
import { getTelemetryData } from './data/telemetry';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [data, setData] = useState(getTelemetryData());
  const [lastUpdated, setLastUpdated] = useState<string>('Vừa kết nối');
  const [replaySeed, setReplaySeed] = useState<string>('seed-live-alpha');

  const updateData = () => {
    setData(getTelemetryData());
    const now = new Date();
    setLastUpdated(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
  };

  const handleRefresh = () => {
    updateData();
  };

  // Tự động đồng bộ thời gian thực khi có hành động bên Game App
  useEffect(() => {
    // 1. Lắng nghe BroadcastChannel từ tab game
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('xvtl_telemetry_channel');
      channel.onmessage = () => {
        updateData();
      };
    }

    // 2. Lắng nghe storage event khi localStorage thay đổi
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xvtl_live_telemetry_v1') {
        updateData();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Tự động kiểm tra polling mỗi 3 giây để cập nhật thời lượng chơi
    const interval = setInterval(updateData, 3000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleInspectReplay = (seed: string) => {
    setReplaySeed(seed);
    setCurrentTab('replay');
  };

  const getTabDetails = (): { title: string; subtitle: string } => {
    switch (currentTab) {
      case 'overview':
        return {
          title: 'Tổng quan vận hành trò chơi',
          subtitle: 'Giám sát nhịp độ người chơi, tiến độ 4 vòng và các chỉ số tài chính trọng yếu',
        };
      case 'players':
        return {
          title: 'Quản lý người dùng & phiên chơi',
          subtitle: 'Theo dõi tình trạng bàn chơi, dòng tiền và lịch sử sự kiện theo thời gian thực',
        };
      case 'economy':
        return {
          title: 'Bàn cờ & phân bổ danh mục đầu tư',
          subtitle: 'Mật độ dừng chân trên 20 ô chuẩn và cơ cấu tài sản tích lũy',
        };
      case 'ai':
        return {
          title: 'Hệ thống trợ lý tài chính AI',
          subtitle: 'Hiệu năng phản hồi, số lượt phân tích và đánh giá tài chính sau trận',
        };
      case 'replay':
        return {
          title: 'Kiểm tra diễn biến ván chơi',
          subtitle: 'Tái hiện từng lượt đổ xúc xắc và sự kiện dựa theo mã ván',
        };
    }
  };

  const { title, subtitle } = getTabDetails();
  const activeCount = data.recentSessions.filter((s) => s.status === 'playing').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-body)' }}>
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeSessionsCount={activeCount}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header
          title={title}
          subtitle={subtitle}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          {currentTab === 'overview' && (
            <OverviewTab summary={data} />
          )}

          {currentTab === 'players' && (
            <PlayersTab
              sessions={data.recentSessions}
              onInspectReplay={handleInspectReplay}
            />
          )}

          {currentTab === 'economy' && (
            <EconomyTab
              tileHeatmap={data.tileHeatmap}
              assetDistribution={data.assetDistribution}
              summary={data}
            />
          )}

          {currentTab === 'ai' && (
            <AiMonitorTab
              aiMetrics={data.aiMetrics}
              recentSessions={data.recentSessions}
            />
          )}

          {currentTab === 'replay' && (
            <ReplayTab initialSeed={replaySeed} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
