import { distribution } from './game-length-model.ts'

// Null means the event never occurred (e.g. purchase lap); it is not a zero-valued observation.
export function numericMetrics(rows: Record<string, unknown>[]) {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
  return Object.fromEntries(keys.flatMap(key => {
    const values = rows.flatMap(row => typeof row[key] === 'number' ? [row[key] as number] : [])
    return values.length ? [[key, distribution(values)]] : []
  }))
}
