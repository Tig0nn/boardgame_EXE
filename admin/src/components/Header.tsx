import React from 'react';

interface HeaderProps {
  title: string;
  subtitle: string;
  onRefresh: () => void;
  lastUpdated: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onRefresh, lastUpdated }) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 28px',
      borderBottom: '1px solid var(--border-light)',
      backgroundColor: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 20,
    }}>
      <div>
        <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Cập nhật lần cuối: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{lastUpdated}</strong>
        </div>

        <button
          onClick={onRefresh}
          className="btn"
        >
          Làm mới
        </button>

        <div style={{
          padding: '4px 8px',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: '#f1f5f9',
          border: '1px solid var(--border-light)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#334155',
        }}>
          Quyền Quản Trị
        </div>
      </div>
    </header>
  );
};
