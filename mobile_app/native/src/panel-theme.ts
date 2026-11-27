// Visual tokens from Mobile Web GamifiedModal/getLapTheme and medieval-theme.css.
// Keep this presentation-only: lap selects artwork colors, never game rules.
export const foil = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'] as const
const themes = [
  { border: '#FCD34D', ribbon: ['#9A3412', '#D97706', '#F59E0B', '#D97706', '#9A3412'], edge: '#FEF3C7' },
  { border: '#86EFAC', ribbon: ['#064E3B', '#059669', '#10B981', '#059669', '#064E3B'], edge: '#D1FAE5' },
  { border: '#7DD3FC', ribbon: ['#0C4A6E', '#0284C7', '#38BDF8', '#0284C7', '#0C4A6E'], edge: '#E0F2FE' },
  { border: '#D8B4FE', ribbon: ['#4C1D95', '#7E22CE', '#A855F7', '#7E22CE', '#4C1D95'], edge: '#F3E8FF' },
  { border: '#FDBA74', ribbon: ['#7F1D1D', '#DC2626', '#F97316', '#DC2626', '#7F1D1D'], edge: '#FEF3C7' },
] as const

export function panelTheme(lap?: number) {
  return themes[lap && Number.isInteger(lap) && lap >= 1 && lap <= 4 ? lap : 0]
}
