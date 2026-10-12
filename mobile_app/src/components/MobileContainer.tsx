import React, { useEffect, useState, useRef } from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ children }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({
    transform: 'scale(1)',
    transformOrigin: 'top left',
  });

  useEffect(() => {
    const updateScale = () => {
      if (!frameRef.current) return;

      const designW = 940;
      const designH = 1672;

      const frameW = frameRef.current.clientWidth;
      const frameH = frameRef.current.clientHeight;

      // Tính scale theo cả hai chiều để luôn vừa vặn 100% trong khung điện thoại
      const scaleX = frameW / designW;
      const scaleY = frameH / designH;
      const scale = Math.min(scaleX, scaleY);

      // Căn giữa canvas nếu tỷ lệ màn hình thực tế lệch nhẹ
      const offsetX = (frameW - designW * scale) / 2;
      const offsetY = (frameH - designH * scale) / 2;

      setTransformStyle({
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin: 'top left',
      });
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    // Chờ 50ms để render chuẩn xác kích thước DOM
    const timer = setTimeout(updateScale, 50);

    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="device-wrapper">
      <div ref={frameRef} className="device-frame">
        {/* Dynamic Island / Tai thỏ nhỏ trang trí trên Desktop */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90px',
          height: '24px',
          background: '#000000',
          borderRadius: '999px',
          zIndex: 100,
          pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
        }} />

        {/* Viewport Game Canvas 940x1672 co giãn đồng bộ */}
        <div className="game-viewport" style={transformStyle}>
          {children}
        </div>
      </div>
    </div>
  );
};
