import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, children, onClose, wide = false, className = '' }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    // Native initial focus can scroll a long financial panel to its bottom action.
    dialog.focus({ preventScroll: true })
    dialog.scrollTop = 0
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} tabIndex={-1} className={`modal ${wide ? 'wide' : ''} ${className}`} aria-label={title} onCancel={e => { if (onClose) onClose(); else e.preventDefault() }}>
    {onClose && <button className="modal-close icon-button" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>}
    {children}
  </dialog>
}
