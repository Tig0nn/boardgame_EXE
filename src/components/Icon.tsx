const paths: Record<string, React.ReactNode> = {
  chart: <><path d="M4 18V6M4 18h16M8 14l4-5 4 3 4-7"/><path d="M16 5h4v4"/></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m5 6 12-3v3M16 11h5v5h-5z"/><path d="M17.5 13.5h.1"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z"/>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3"/></>,
  bank: <><path d="m3 8 9-5 9 5zM4 21h16M5 18h14M7 11v7M12 11v7M17 11v7"/></>,
  gold: <><path d="m5 9-3 9h20l-3-9zM8 9l2-6h5l2 6M6 18l3-9M18 18l-3-9"/></>,
  shop: <><path d="M4 10v11h16V10M3 4h18l1 6a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2zM9 21v-6h6v6"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
  flag: <><path d="M5 22V3m0 1c4-4 9 4 14 0v10c-5 4-10-4-14 0"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  leaf: <><path d="M20 3C4 2 2 9 6 16c7 4 14-2 14-13zM5 20 15 9"/></>,
}
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.chart}</svg>
}
