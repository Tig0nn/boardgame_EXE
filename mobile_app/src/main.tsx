import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
async function mount() {
  let Demo = App
  if (import.meta.env.DEV || (import.meta.env.PROD && import.meta.env.VITE_ENDGAME_WHAT_IF_BETA === '1')) {
    const params = new URLSearchParams(location.search)
    const endgame = params.getAll('endgameWhatIf')
    if (import.meta.env.DEV && params.get('whatIfDemo') === 'repair') {
      Demo = (await import('./dev/WhatIfDemo')).default
    } else if (endgame.length === 1 && endgame[0] === '1' && !params.has('whatIfDemo')) {
      Demo = await import('./dev/EndgameWhatIfDev').then(module => module.default, () => App)
    } else if (import.meta.env.DEV && params.has('mascotDemo')) {
      Demo = (await import('./dev/MascotDemo')).default
    }
  }
  if (!rootElement) return
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Demo />
    </React.StrictMode>
  );
}
void mount()
