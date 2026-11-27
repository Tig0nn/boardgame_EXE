import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface PhoneQrModalProps {
  networkUrl?: string;
}

export const PhoneQrModal: React.FC<PhoneQrModalProps> = ({
  networkUrl = 'http://192.168.2.7:5174/',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  useEffect(() => {
    // Ẩn panel nếu đang mở trực tiếp trên màn hình điện thoại
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 850);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sinh mã QR Code offline bằng thư viện qrcode
  useEffect(() => {
    QRCode.toDataURL(networkUrl, {
      width: 220,
      margin: 1.5,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Lỗi sinh QR:', err));
  }, [networkUrl]);

  if (isMobileDevice) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(networkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      pointerEvents: 'auto',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Nút nhỏ khi đã thu nhỏ */}
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: '#FFFFFF',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '999px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.5)',
          }}
        >
          <span>📱</span>
          <span>Hiện Mã QR Test</span>
        </button>
      ) : (
        /* Hộp Panel QR Code Luôn Hiển Thị Sẵn */
        <div style={{
          width: '300px',
          background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
          border: '2px solid #10B981',
          borderRadius: '28px',
          padding: '20px 18px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 20px rgba(16, 185, 129, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
          position: 'relative',
        }}>
          {/* Nút thu nhỏ panel */}
          <button
            onClick={() => setIsMinimized(true)}
            title="Thu nhỏ panel QR"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#94A3B8',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Tiêu đề */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>📱</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#34D399', fontFamily: 'Baloo 2, cursive' }}>
                QUÉT ĐỂ TEST TRÊN ĐIỆN THOẠI
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                Trải nghiệm Fullscreen như Expo Go
              </div>
            </div>
          </div>

          {/* Khung Mã QR Code */}
          <div style={{
            background: '#FFFFFF',
            padding: '10px',
            borderRadius: '18px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code test on phone"
                style={{
                  width: '190px',
                  height: '190px',
                  display: 'block',
                  borderRadius: '8px',
                }}
              />
            ) : (
              <div style={{
                width: '190px',
                height: '190px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
                fontSize: '12px',
              }}>
                Đang tạo mã QR...
              </div>
            )}
          </div>

          {/* Hướng dẫn thao tác */}
          <div style={{ fontSize: '12px', color: '#E2E8F0', lineHeight: 1.4 }}>
            Bật <strong>Camera iPhone / Zalo</strong> quét mã trên để mở chơi trực tiếp!
          </div>

          {/* Địa chỉ IP Wi-Fi */}
          <div style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '12px', color: '#38BDF8', fontWeight: 700, fontFamily: 'monospace' }}>
              {networkUrl}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#10B981' : 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Đã chép!' : 'Copy'}
            </button>
          </div>

          <div style={{ fontSize: '10px', color: '#64748B' }}>
            ⚡ Lưu ý: Điện thoại & máy tính cùng mạng Wi-Fi
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
