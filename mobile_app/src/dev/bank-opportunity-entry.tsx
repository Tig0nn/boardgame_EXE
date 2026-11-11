const root = document.getElementById('opportunity-root')
if (root) {
  if (import.meta.env.DEV) {
    const [{ createRoot }, { BankOpportunityPage }] = await Promise.all([
      import('react-dom/client'), import('./bank-opportunity-page.tsx'),
    ])
    createRoot(root).render(<BankOpportunityPage/>)
  } else root.textContent = 'Bản thử nghiệm chỉ mở trong môi trường DEV.'
}
export {}
