import React from 'react';

export type AdminTab = 'overview' | 'players' | 'economy' | 'ai' | 'replay';

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  activeSessionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, activeSessionsCount }) => {
  const navItems: { id: AdminTab; label: string; badge?: number | string }[] = [
    { id: 'overview', label: 'Tổng Quan' },
    { id: 'players', label: 'Người Dùng & Phiên Chơi', badge: activeSessionsCount },
    { id: 'economy', label: 'Bàn Cờ & Danh Mục' },
    { id: 'ai', label: 'Trợ Lý AI' },
    { id: 'replay', label: 'Kiểm Tra Ván Chơi' },
  ];

  return (
    <aside style={{
      width: '240px',
      backgroundColor: '#ffffff',
      borderRight: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px 14px',
      minHeight: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      <div>
        {/* Brand / Header */}
        <div style={{ padding: '0 8px 18px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Hệ Thống Trò Chơi
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', letterSpacing: '-0.01em' }}>
            Quản Trị Vận Hành
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
            Phiên bản V2.4 • Quy chuẩn C20
          </div>
        </div>

        {/* Navigation Items (0% icons, pure clean text) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '16px' }}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: isActive ? '#f1f5f9' : 'transparent',
                  color: isActive ? '#0f172a' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background-color 0.1s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 600,
                    background: isActive ? '#e2e8f0' : '#f1f5f9',
                    color: '#334155',
                  }} className="mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid var(--border-light)',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Động cơ đang hoạt động</span>
        </div>
        <div>Cổng máy chủ: 5175</div>
        <div>Môi trường: Kiểm thử chuẩn</div>
      </div>
    </aside>
  );
};
