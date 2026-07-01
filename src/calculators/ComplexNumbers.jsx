import { useMemo, useState } from 'react'
import {
  cleanTinyValue,
  formatAnswer,
  formatInputNumber,
  formatScalar,
  normalizeComplex,
  parseNumericInput,
} from '../utils/mathFormatting'

const angleUnits = [
  { id: 'deg', label: 'Deg' },
  { id: 'rad', label: 'Rad' },
]

const complexNumberIds = ['first', 'second']

const complexNumberLabels = {
  first: 'Number 1',
  second: 'Number 2',
}

const complexOperations = [
  { id: 'add', label: '+', name: 'Add', resultLabel: 'Number 1 + Number 2' },
  { id: 'subtract', label: '-', name: 'Subtract', resultLabel: 'Number 1 - Number 2' },
  { id: 'multiply', label: 'x', name: 'Multiply', resultLabel: 'Number 1 x Number 2' },
  { id: 'divide', label: '/', name: 'Divide', resultLabel: 'Number 1 / Number 2' },
]

function createInitialComplexNumbers() {
  return {
    first: {
      mode: 'rectangular',
      real: '3',
      imaginary: '4',
      magnitude: '5',
      angle: '53.13010235',
    },
    second: {
      mode: 'polar',
      real: '1.73205081',
      imaginary: '-1',
      magnitude: '2',
      angle: '-30',
    },
  }
}

function createEmptyComplexNumbers() {
  return {
    first: {
      mode: 'rectangular',
      real: '',
      imaginary: '',
      magnitude: '',
      angle: '',
    },
    second: {
      mode: 'rectangular',
      real: '',
      imaginary: '',
      magnitude: '',
      angle: '',
    },
  }
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI
}

function getAngleInUnit(radians, angleUnit) {
  return angleUnit === 'deg' ? radiansToDegrees(radians) : radians
}

function parseComplexInput(number, angleUnit) {
  if (number.mode === 'polar') {
    const magnitude = parseNumericInput(number.magnitude)
    const angle = parseNumericInput(number.angle)

    if (magnitude === null || angle === null) return null

    const radians = angleUnit === 'deg' ? degreesToRadians(angle) : angle

    return {
      re: cleanTinyValue(magnitude * Math.cos(radians)),
      im: cleanTinyValue(magnitude * Math.sin(radians)),
    }
  }

  const real = parseNumericInput(number.real)
  const imaginary = parseNumericInput(number.imaginary)

  if (real === null || imaginary === null) return null

  return {
    re: cleanTinyValue(real),
    im: cleanTinyValue(imaginary),
  }
}

function getRectangularFields(value) {
  return {
    real: formatInputNumber(value.re),
    imaginary: formatInputNumber(value.im),
  }
}

function getPolarFields(value, angleUnit) {
  const magnitude = Math.hypot(value.re, value.im)
  const radians = magnitude === 0 ? 0 : Math.atan2(value.im, value.re)

  return {
    magnitude: formatInputNumber(magnitude),
    angle: formatInputNumber(getAngleInUnit(radians, angleUnit)),
  }
}

function convertAngleInput(angle, fromUnit, toUnit) {
  const parsedAngle = parseNumericInput(angle)

  if (parsedAngle === null) return angle

  const radians = fromUnit === 'deg' ? degreesToRadians(parsedAngle) : parsedAngle
  return formatInputNumber(getAngleInUnit(radians, toUnit))
}

function formatPolar(value, angleUnit) {
  const resolvedValue = normalizeComplex(value)
  const real = cleanTinyValue(resolvedValue.re)
  const imaginary = cleanTinyValue(resolvedValue.im)
  const magnitude = cleanTinyValue(Math.hypot(real, imaginary))
  const radians = magnitude === 0 ? 0 : Math.atan2(imaginary, real)
  const angle = cleanTinyValue(getAngleInUnit(radians, angleUnit))

  return `r = ${formatScalar(magnitude)}, theta = ${formatScalar(angle)} ${angleUnit}`
}

function calculateComplexOperation(first, second, operation) {
  if (operation === 'add') {
    return {
      result: {
        re: first.re + second.re,
        im: first.im + second.im,
      },
      error: '',
    }
  }

  if (operation === 'subtract') {
    return {
      result: {
        re: first.re - second.re,
        im: first.im - second.im,
      },
      error: '',
    }
  }

  if (operation === 'multiply') {
    return {
      result: {
        re: first.re * second.re - first.im * second.im,
        im: first.re * second.im + first.im * second.re,
      },
      error: '',
    }
  }

  const denominator = second.re ** 2 + second.im ** 2

  if (Math.abs(denominator) < 1e-12) {
    return {
      result: null,
      error: 'Division by zero is not defined for complex numbers.',
    }
  }

  return {
    result: {
      re: (first.re * second.re + first.im * second.im) / denominator,
      im: (first.im * second.re - first.re * second.im) / denominator,
    },
    error: '',
  }
}

export default function ComplexNumbers() {
  const [angleUnit, setAngleUnit] = useState('deg')
  const [complexNumbers, setComplexNumbers] = useState(() => createInitialComplexNumbers())
  const [complexOperation, setComplexOperation] = useState('add')

  const parsedComplexNumbers = useMemo(
    () => ({
      first: parseComplexInput(complexNumbers.first, angleUnit),
      second: parseComplexInput(complexNumbers.second, angleUnit),
    }),
    [angleUnit, complexNumbers],
  )

  const complexCalculation = useMemo(() => {
    const first = parsedComplexNumbers.first
    const second = parsedComplexNumbers.second

    if (!first || !second) {
      return {
        result: null,
        error: 'Enter valid values for both complex numbers.',
      }
    }

    return calculateComplexOperation(first, second, complexOperation)
  }, [complexOperation, parsedComplexNumbers])

  const activeComplexOperation =
    complexOperations.find((operation) => operation.id === complexOperation) ??
    complexOperations[0]

  function updateComplexField(numberId, field, value) {
    setComplexNumbers((current) => ({
      ...current,
      [numberId]: {
        ...current[numberId],
        [field]: value,
      },
    }))
  }

  function updateComplexInputMode(numberId, mode) {
    setComplexNumbers((current) => {
      const parsedValue = parseComplexInput(current[numberId], angleUnit)
      const nextNumber = {
        ...current[numberId],
        mode,
      }

      if (parsedValue) {
        Object.assign(
          nextNumber,
          mode === 'rectangular'
            ? getRectangularFields(parsedValue)
            : getPolarFields(parsedValue, angleUnit),
        )
      }

      return {
        ...current,
        [numberId]: nextNumber,
      }
    })
  }

  function updateAngleUnit(nextUnit) {
    if (nextUnit === angleUnit) return

    setComplexNumbers((current) => ({
      first:
        current.first.mode === 'polar'
          ? {
              ...current.first,
              angle: convertAngleInput(current.first.angle, angleUnit, nextUnit),
            }
          : current.first,
      second:
        current.second.mode === 'polar'
          ? {
              ...current.second,
              angle: convertAngleInput(current.second.angle, angleUnit, nextUnit),
            }
          : current.second,
    }))
    setAngleUnit(nextUnit)
  }

  function loadComplexCalculatorExample() {
    setAngleUnit('deg')
    setComplexOperation('multiply')
    setComplexNumbers(createInitialComplexNumbers())
  }

  function resetComplexCalculator() {
    setComplexOperation('add')
    setComplexNumbers(createEmptyComplexNumbers())
  }

  function renderComplexNumber(numberId) {
    const number = complexNumbers[numberId]
    const parsedValue = parsedComplexNumbers[numberId]
    const label = complexNumberLabels[numberId]

    return (
      <section className="complex-number-panel" key={numberId}>
        <div className="complex-number-header">
          <div>
            <p className="eyebrow">{label}</p>
            <h3>{numberId === 'first' ? 'A' : 'B'}</h3>
          </div>
          <div className="segmented-control" role="group" aria-label={`${label} format`}>
            <button
              type="button"
              className={number.mode === 'rectangular' ? 'is-active' : ''}
              onClick={() => updateComplexInputMode(numberId, 'rectangular')}
            >
              Rect
            </button>
            <button
              type="button"
              className={number.mode === 'polar' ? 'is-active' : ''}
              onClick={() => updateComplexInputMode(numberId, 'polar')}
            >
              Polar
            </button>
          </div>
        </div>

        {number.mode === 'rectangular' ? (
          <div className="complex-field-grid">
            <label className="complex-field">
              <span>Real</span>
              <input
                type="number"
                inputMode="decimal"
                value={number.real}
                placeholder="3"
                onChange={(event) => updateComplexField(numberId, 'real', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>Imaginary</span>
              <input
                type="number"
                inputMode="decimal"
                value={number.imaginary}
                placeholder="4"
                onChange={(event) =>
                  updateComplexField(numberId, 'imaginary', event.target.value)
                }
              />
            </label>
          </div>
        ) : (
          <div className="complex-field-grid">
            <label className="complex-field">
              <span>Magnitude</span>
              <input
                type="number"
                inputMode="decimal"
                value={number.magnitude}
                placeholder="5"
                onChange={(event) =>
                  updateComplexField(numberId, 'magnitude', event.target.value)
                }
              />
            </label>
            <label className="complex-field">
              <span>Angle ({angleUnit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={number.angle}
                placeholder={angleUnit === 'deg' ? '53.13' : '0.9273'}
                onChange={(event) => updateComplexField(numberId, 'angle', event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="format-output-grid">
          <output>
            <span>Rectangular</span>
            <strong>{parsedValue ? formatAnswer(parsedValue) : '--'}</strong>
          </output>
          <output>
            <span>Polar</span>
            <strong>{parsedValue ? formatPolar(parsedValue, angleUnit) : '--'}</strong>
          </output>
        </div>
      </section>
    )
  }

  return (
    <section className="tool-panel" aria-labelledby="complex-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Complex arithmetic</p>
          <h2 id="complex-title">Complex numbers</h2>
        </div>
        <div className="unit-control">
          <span>Angle unit</span>
          <div className="segmented-control" role="group" aria-label="Angle unit">
            {angleUnits.map((unit) => (
              <button
                type="button"
                key={unit.id}
                className={angleUnit === unit.id ? 'is-active' : ''}
                onClick={() => updateAngleUnit(unit.id)}
              >
                {unit.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="complex-layout">
        <div className="complex-inputs">{complexNumberIds.map(renderComplexNumber)}</div>

        <section className="complex-operation-panel" aria-label="Complex result">
          <div className="complex-operation-header">
            <div>
              <p className="eyebrow">Arithmetic</p>
              <h3>{activeComplexOperation.resultLabel}</h3>
            </div>
            <div className="operation-controls" role="group" aria-label="Operation">
              {complexOperations.map((operation) => (
                <button
                  type="button"
                  key={operation.id}
                  className={complexOperation === operation.id ? 'is-active' : ''}
                  aria-label={operation.name}
                  onClick={() => setComplexOperation(operation.id)}
                >
                  {operation.label}
                </button>
              ))}
            </div>
          </div>

          {complexCalculation.error ? (
            <p className="message error">{complexCalculation.error}</p>
          ) : (
            <div className="format-output-grid result-output-grid">
              <output>
                <span>Rectangular</span>
                <strong>{formatAnswer(complexCalculation.result)}</strong>
              </output>
              <output>
                <span>Polar</span>
                <strong>{formatPolar(complexCalculation.result, angleUnit)}</strong>
              </output>
            </div>
          )}
        </section>
      </div>

      <div className="actions">
        <button type="button" onClick={loadComplexCalculatorExample}>
          Example
        </button>
        <button type="button" onClick={resetComplexCalculator}>
          Clear
        </button>
      </div>
    </section>
  )
}