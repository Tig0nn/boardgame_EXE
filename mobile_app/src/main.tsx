import React from 'react';
import ReactDOM from 'react-dom/client';
import '@google/model-viewer';
import App from './App';
import './index.css';

import { assetUrl } from './utils/assets';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Register PWA Service Worker for offline iOS/Web caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = assetUrl('sw.js');
    navigator.serviceWorker.register(swPath).catch((err) => {
      console.warn('ServiceWorker registration failed: ', err);
    });
  });
}
