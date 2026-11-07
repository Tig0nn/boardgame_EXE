/**
 * Bộ phân giải đường dẫn tài nguyên tĩnh (assets) dùng chung cho Mobile Web, GitHub Pages, và Capacitor Native.
 * Tự động gắn tiền tố import.meta.env.BASE_URL (ví dụ /PlayBoard/ trên GitHub Pages hoặc ./ trong Capacitor)
 * để tránh lỗi 404 khi host dưới subpath.
 */
export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const clean = path.startsWith('/') ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL || './';
  return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
}
