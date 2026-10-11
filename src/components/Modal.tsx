import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-label={title} onCancel={e => { if (onClose) onClose(); else e.preventDefault() }}>
    {onClose && <button className="modal-close icon-button" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>}
    {children}
  </dialog>
}
