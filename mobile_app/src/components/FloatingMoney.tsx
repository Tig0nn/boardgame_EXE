import React from 'react';

export interface MoneyParticle {
  id: string;
  text: string;
  type: 'gain' | 'loss' | 'bonus';
  x: number;
  y: number;
}

interface FloatingMoneyProps {
  particles: MoneyParticle[];
}

export const FloatingMoney: React.FC<FloatingMoneyProps> = ({ particles }) => {
  if (particles.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 85,
    }}>
      {particles.map((p) => {
        const color = p.type === 'gain' ? '#34D399' : p.type === 'bonus' ? '#FBBF24' : '#F87171';
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}px`,
              top: `${p.y}px`,
              transform: 'translate(-50%, -50%)',
              color,
              fontSize: '28px',
              fontWeight: 900,
              fontFamily: 'Baloo 2, cursive',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 12px rgba(0, 0, 0, 0.5)',
              animation: 'floatUpAndFade 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
              whiteSpace: 'nowrap',
            }}
          >
            {p.text}
          </div>
        );
      })}

      <style>{`
        @keyframes floatUpAndFade {
          0% {
            opacity: 0;
            transform: translate(-50%, -10px) scale(0.7);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -40px) scale(1.15);
          }
          70% {
            opacity: 1;
            transform: translate(-50%, -85px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -130px) scale(0.85);
          }
        }
      `}</style>
    </div>
  );
};
