import { complex } from 'mathjs'

export function normalizeComplex(value) {
  if (typeof value === 'number') return { re: value, im: 0 }
  if (value && typeof value.re === 'number' && typeof value.im === 'number') {
    return value
  }

  return complex(value)
}

export function cleanTinyValue(value) {
  return Math.abs(value) < 1e-12 ? 0 : value
}

export function formatScalar(value, decimalPlaces = 3) {
  if (Math.abs(value) < 1e-12) return '0'

  const rounded = Number(value.toFixed(decimalPlaces))
  return rounded.toLocaleString(undefined, {
    maximumFractionDigits: decimalPlaces,
  })
}

export function formatInputNumber(value) {
  const cleanedValue = cleanTinyValue(value)

  if (!Number.isFinite(cleanedValue)) return ''

  return Number(cleanedValue.toFixed(3)).toString()
}

export function formatAnswer(value, decimalPlaces = 3) {
  const resolvedValue = normalizeComplex(value)
  const real = cleanTinyValue(resolvedValue.re)
  const imaginary = cleanTinyValue(resolvedValue.im)

  if (!Number.isFinite(real) || !Number.isFinite(imaginary)) return 'Not finite'
  if (imaginary === 0) return formatScalar(real, decimalPlaces)
  if (real === 0) return `${formatScalar(imaginary, decimalPlaces)}j`

  const sign = imaginary < 0 ? '-' : '+'
  return `${formatScalar(real, decimalPlaces)} ${sign} ${formatScalar(Math.abs(imaginary), decimalPlaces)}j`
}

export function parseComplexValue(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    return complex(value.trim().replace(/j/gi, 'i'))
  } catch {
    return null
  }
}

export function parseNumericInput(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}