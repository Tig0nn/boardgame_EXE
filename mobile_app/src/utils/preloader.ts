/**
 * Preload critical game assets into browser memory cache
 * to ensure 0ms rendering and zero loading lag.
 */

const CRITICAL_ASSETS = [
  '/assets/splash-game.png',
  '/assets/play-icon.png',
  '/assets/sound-btn.png',
  '/assets/setting-btn.png',
  '/assets/setting-frame.png',
  '/assets/layer-2-clean.png',
  '/assets/layer-1-clean.PNG',
  '/assets/oke-btn.png',
  '/assets/main-background.png',
  '/assets/playboard-4.PNG',
  '/assets/sectionplay.PNG',
  '/assets/nut-home.PNG',
  '/assets/icon.PNG',
  '/assets/cropped/app-logo.png',
  '/assets/cropped/tuido-icon.png',
  '/assets/cropped/sotay-full-icon.png',
  '/assets/cropped/nutlac-btn.png',
  '/assets/cropped/xucxac-icon.png',
  '/assets/cropped/sectionplay-board.png',
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
