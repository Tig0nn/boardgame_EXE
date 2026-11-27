/**
 * Bộ phân giải đường dẫn tài nguyên tĩnh (assets) dùng chung cho Mobile Web, GitHub Pages, và Capacitor Native.
 * Tự động gắn tiền tố subpath chính xác (ví dụ /PlayBoard/ trên GitHub Pages hoặc ./ trong Capacitor)
 * để tránh tuyệt đối lỗi 404 khi mở PWA hoặc duyệt web trên iOS Safari / Android.
 */
export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const clean = path.startsWith('/') ? path.slice(1) : path;

  // 1. Nếu đang chạy trên GitHub Pages (*.github.io), luôn trích xuất tên repo từ pathname làm tiền tố tuyệt đối
  if (typeof window !== 'undefined' && window.location?.hostname?.endsWith('.github.io')) {
    const segments = (window.location.pathname || '').split('/').filter(Boolean);
    const repo = segments.length > 0 ? segments[0] : 'PlayBoard';
    return `/${repo}/${clean}`;
  }

  // 2. Sử dụng base URL từ cấu hình Vite (nếu có và không phải ./ thuần túy)
  const base = import.meta.env.BASE_URL || './';
  if (base && base !== './' && base !== '.') {
    return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
  }

  // 3. Fallback cho Capacitor Native hoặc Localhost
  return `./${clean}`;
}
