import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
async function mount() {
  const Demo = import.meta.env.DEV && new URLSearchParams(location.search).get('whatIfDemo') === 'repair'
    ? (await import('./dev/WhatIfDemo')).default : App
  if (!rootElement) return
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Demo />
    </React.StrictMode>
  );
}
void mount()
