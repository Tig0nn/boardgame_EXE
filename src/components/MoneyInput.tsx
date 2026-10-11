import { useState } from 'react'
import { formatMoneyInput, parseMoneyInput } from '../ui/money-input'

/** Presentation only: the callback receives exact integer dong, or NaN for invalid input. */
export function MoneyInput({ id, amount, onChange, invalid = false }: {
  id: string; amount: number; onChange: (amount: number) => void; invalid?: boolean
}) {
  const [raw, setRaw] = useState(formatMoneyInput(amount))
  const value = Number.isSafeInteger(amount) ? (raw === '' && amount === 0 ? '' : formatMoneyInput(amount)) : raw
  return <div className="money-input"><input id={id} className="text-input" type="text" inputMode="numeric" autoComplete="off"
    aria-invalid={invalid} value={value} onPaste={event => {
      const text = event.clipboardData.getData('text').trim()
      if (!Number.isSafeInteger(parseMoneyInput(text))) {
        event.preventDefault(); setRaw(text); onChange(NaN)
      }
    }} onChange={event => {
      const input = event.currentTarget
      const text = input.value
      const digitCount = text.slice(0, input.selectionStart ?? text.length).replace(/\D/g, '').length
      const next = /^[\d.]*$/.test(text) ? parseMoneyInput(text.replaceAll('.', '')) : NaN
      setRaw(text); onChange(next)
      requestAnimationFrame(() => {
        if (!input.isConnected || document.activeElement !== input) return
        let caret = 0; let digits = 0
        while (caret < input.value.length && digits < digitCount) if (/\d/.test(input.value[caret++])) digits++
        input.setSelectionRange(caret, caret)
      })
    }} /><span aria-hidden="true">₫</span></div>
}
