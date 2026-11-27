import React from 'react';

interface TileData {
  index: number;
  label: string;
  type: string;
  x: number;
  y: number;
}

interface AnchorOverlayProps {
  tiles: TileData[];
  visible: boolean;
  activeTileIndex: number;
  onSelectTile: (index: number) => void;
}

export const AnchorOverlay: React.FC<AnchorOverlayProps> = ({
  tiles,
  visible,
  activeTileIndex,
  onSelectTile,
}) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'auto',
      zIndex: 35,
    }}>
      {tiles.map((tile) => {
        const isCurrent = tile.index === activeTileIndex;
        return (
          <div
            key={tile.index}
            onClick={() => onSelectTile(tile.index)}
            style={{
              position: 'absolute',
              left: `${tile.x}px`,
              top: `${tile.y}px`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: isCurrent ? 45 : 36,
              transition: 'transform 0.2s',
            }}
          >
            {/* Chấm tròn Anchor */}
            <div style={{
              width: isCurrent ? '26px' : '20px',
              height: isCurrent ? '26px' : '20px',
              borderRadius: '50%',
              backgroundColor: isCurrent ? '#F59E0B' : '#EF4444',
              border: '2px solid #FFFFFF',
              boxShadow: isCurrent 
                ? '0 0 16px #F59E0B, 0 0 24px #F59E0B' 
                : '0 0 10px rgba(239, 68, 68, 0.8)',
              animation: isCurrent ? 'pulse 1.2s infinite' : 'none',
            }} />

            {/* Tag nhãn thông tin ô */}
            <div style={{
              marginTop: '4px',
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#F8FAFC',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
              transform: 'scale(0.95)',
            }}>
              #{tile.index} {tile.label}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
