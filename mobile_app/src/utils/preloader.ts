/**
 * Preload critical game assets into browser memory cache
 * to ensure 0ms rendering and zero loading lag.
 */

const CRITICAL_ASSETS = [
  '/assets/splash-game.webp',
  '/assets/play-icon.png',
  '/assets/sound-btn.png',
  '/assets/setting-btn.png',
  '/assets/setting-frame.png',
  '/assets/layer-2-clean.webp',
  '/assets/layer-1-clean.webp',
  '/assets/oke-btn.png',
  '/assets/main-background.webp',
  '/assets/luat-choi.webp',
  '/assets/playboard-4.PNG',
  '/assets/sectionplay.PNG',
  '/assets/nut-home.PNG',
  '/assets/icon.PNG',
  '/assets/cropped/app-logo.png',
  '/assets/cropped/tuido-icon.png',
  '/assets/cropped/sotay-full-icon.png',
  '/assets/cropped/nutlac-btn.webp',
  '/assets/cropped/xucxac-icon.png',
  '/assets/cropped/sectionplay-board.png',
  '/assets/map-no-nodes.webp',
  '/assets/map-chapter-1.png',
  '/assets/map-chapter-2.png',
  '/assets/map-chapter-3.png',
  '/assets/map-chapter-4.png',
  '/assets/map-chapter-5.png',
  '/assets/map-chapter-1.webp',
  '/assets/map-chapter-2.webp',
  '/assets/map-chapter-3.webp',
  '/assets/map-chapter-4.webp',
  '/assets/map-chapter-5.webp',
  '/assets/nodes/node-1.webp',
  '/assets/nodes/node-2.webp',
  '/assets/nodes/node-3.webp',
  '/assets/nodes/node-4.webp',
  '/assets/nodes/node-5.webp',
];

const loadedCache = new Set<string>();

export function preloadGameAssets(): Promise<void[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);

  const promises = CRITICAL_ASSETS.map(src => {
    if (loadedCache.has(src)) return Promise.resolve();

    return new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        loadedCache.add(src);
        resolve();
      };
      img.onerror = () => {
        // Resolve anyway so app doesn't block on network glitch
        resolve();
      };
      img.src = src;
    });
  });

  return Promise.all(promises);
}
