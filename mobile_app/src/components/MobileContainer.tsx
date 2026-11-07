import React, { useEffect, useState, useRef } from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
  overlay?: React.ReactNode;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({ children, overlay }) => {
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
        {/* Viewport Game Canvas 940x1672 co giãn đồng bộ (Đã loại bỏ viên thuốc Dynamic Island giả lập thừa thãi) */}
        <div className="game-viewport" style={{ ...transformStyle, pointerEvents: 'auto' }}>
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
};
