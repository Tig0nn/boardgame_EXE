import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AIDemoPage } from './AIDemoPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AIDemoPage />
  </StrictMode>
)
