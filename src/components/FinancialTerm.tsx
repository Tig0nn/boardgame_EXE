import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FINANCIAL_TERMS, annotateTerms, tooltipPosition } from './glossary'
import type { FinancialTermId } from './glossary'
import './FinancialTerm.css'

export function FinancialTerm({ term, children }: { term: FinancialTermId; children?: ReactNode }) {
  const entry = FINANCIAL_TERMS[term], id = useId()
  const accessibleLabel = typeof children === 'string' && !entry.label.toLowerCase().includes(children.toLowerCase())
    ? `${children} · Giải thích: ${entry.label}` : `Giải thích: ${entry.label}`
  const trigger = useRef<HTMLButtonElement>(null), popup = useRef<HTMLSpanElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const cancelClose = () => clearTimeout(timer.current)
  const show = () => { cancelClose(); setOpen(true) }
  const deferClose = () => { timer.current = setTimeout(() => setOpen(false), 120) }
  useEffect(() => {
    if (!open) return
    const element = popup.current!, button = trigger.current!
    const place = () => {
      const root = button.closest('dialog') ?? document
      const actions = [...root.querySelectorAll<HTMLButtonElement>('.button')].filter(b => !b.disabled && b.getClientRects().length > 0).map(b => b.getBoundingClientRect())
      // Native popovers enter the top layer above a modal and cannot be clipped by it.
      element.style.maxHeight = ''; element.style.width = `${Math.min(300, innerWidth - 16)}px`
      const p = tooltipPosition(button.getBoundingClientRect(), innerWidth, innerHeight, element.scrollHeight, actions)
      Object.assign(element.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, maxHeight: `${p.maxHeight}px` })
    }
    const outside = (e: Event) => { if (!button.contains(e.target as Node) && !element.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) } }
    const other = (e: Event) => { if ((e as CustomEvent).detail !== id) setOpen(false) }
    window.dispatchEvent(new CustomEvent('financial-term-open', { detail: id }))
    element.showPopover?.(); place()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('financial-term-open', other)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      element.hidePopover?.(); cancelClose()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('financial-term-open', other)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, id])
  return <span className="financial-term" onMouseEnter={show} onMouseLeave={deferClose}>
    <button ref={trigger} type="button" className="financial-term-trigger" aria-label={accessibleLabel} aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined}
      onFocus={show} onBlur={e => { if (!popup.current?.contains(e.relatedTarget as Node)) deferClose() }} onClick={show}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show() } }}>
      {children ?? entry.label}<span className="term-info" aria-hidden="true">ⓘ</span>
    </button>
    <span ref={popup} id={id} popover="manual" role="tooltip" className="financial-term-popup" data-open={open || undefined} onMouseEnter={cancelClose} onMouseLeave={deferClose}>
      <strong>{entry.label}</strong><span>{entry.definition}</span>
    </span>
  </span>
}

/** React text nodes escape markup. Only dictionary phrases receive annotation. */
export function GlossaryText({ text }: { text: string }) {
  return <>{annotateTerms(text).map((part, i) => part.term ? <FinancialTerm key={i} term={part.term}>{part.text}</FinancialTerm> : part.text)}</>
}

export function FinancialGlossary() {
  return <details className="financial-glossary"><summary>Giải thích thuật ngữ</summary>
    <p>Lãi suất, giá và xếp hạng dưới đây thuộc mô phỏng của trò chơi.</p>
    <dl>{(Object.keys(FINANCIAL_TERMS) as FinancialTermId[]).map(term => <div key={term}><dt>{FINANCIAL_TERMS[term].label}{term !== 'start' && <> <small>({FINANCIAL_TERMS[term].english})</small></>}</dt><dd>{FINANCIAL_TERMS[term].definition}</dd></div>)}</dl>
  </details>
}
