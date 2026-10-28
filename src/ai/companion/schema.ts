import { CompanionContractError } from './errors.ts'

// Small closed JSON schema primitives; no dependency or server runtime in the UI contract.
export type Schema<T> = (value: unknown) => T
export function invalid(): never { throw new CompanionContractError('INVALID_REQUEST') }
export function literal<const T extends string | number | boolean | null>(expected: T): Schema<T> {
  return value => value === expected ? expected : invalid()
}
export function enumeration<const T extends readonly string[]>(values: T): Schema<T[number]> {
  return value => typeof value === 'string' && values.includes(value) ? value : invalid()
}
export function text(max = 96, pattern = /^[A-Za-z0-9:_-]+$/): Schema<string> {
  return value => typeof value === 'string' && value.length > 0 && value.length <= max && pattern.test(value) ? value : invalid()
}
export function plainText(max: number): Schema<string> {
  return value => {
    const parsed = text(max, /^[\s\S]+$/u)(value)
    if ([...parsed].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) invalid()
    return parsed
  }
}
export function integer(min = 0, max = Number.MAX_SAFE_INTEGER): Schema<number> {
  return value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : invalid()
}
export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return value => value === undefined ? undefined : schema(value)
}
export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return value => value === null ? null : schema(value)
}
export function array<T>(schema: Schema<T>, min: number, max: number): Schema<T[]> {
  return value => {
    if (!Array.isArray(value) || value.length < min || value.length > max
      || Reflect.ownKeys(value).length !== value.length + 1) invalid()
    const descriptors = Object.getOwnPropertyDescriptors(value)
    return Array.from({ length: value.length }, (_, index) => {
      if (!descriptors[index] || !('value' in descriptors[index])) invalid()
      return schema(descriptors[index].value)
    })
  }
}
type Shape = Record<string, Schema<unknown>>
type Output<S extends Shape> = { [K in keyof S]: ReturnType<S[K]> }
export function object<S extends Shape>(shape: S): Schema<Output<S>> {
  return value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid()
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !Object.hasOwn(shape, key) || !('value' in descriptors[key])) invalid()
    }
    const result: Record<string, unknown> = {}
    for (const [key, schema] of Object.entries(shape)) {
      const parsed = schema(descriptors[key]?.value)
      if (parsed !== undefined) result[key] = parsed
    }
    return result as Output<S>
  }
}
