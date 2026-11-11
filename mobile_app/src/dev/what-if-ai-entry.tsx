const root = document.getElementById('what-if-ai-root')
if (root) {
  if (import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    const [{ createRoot }, { WhatIfAiPage }] = await Promise.all([
      import('react-dom/client'), import('./what-if-ai-page.tsx'),
    ])
    createRoot(root).render(<WhatIfAiPage />)
  } else root.textContent = 'Bản thử nghiệm chỉ mở qua DEV trên máy này.'
}
export {}
