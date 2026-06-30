import { useMemo, useState } from 'react'
import { complex, lusolve } from 'mathjs'
import './App.css'

const MIN_SIZE = 2
const MAX_SIZE = 6
const buyMeCoffeeUrl = 'https://buymeacoffee.com/vctrkarthik'

const tools = [
  {
    id: 'matrix-solver',
    name: 'Matrix Solver',
    shortName: 'Ax = B',
  },
  {
    id: 'complex-numbers',
    name: 'Complex Numbers',
    shortName: 'a + jb',
  },
]

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

const createMatrix = (size, fill = '') =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => fill))

const createVector = (size, fill = '') => Array.from({ length: size }, () => fill)

const exampleA = [
  ['2', '1', '-1'],
  ['-3', '-1', '2'],
  ['-2', '1', '2'],
]

const exampleB = ['8', '-11', '-3']

const complexExampleA = [
  ['1+j', '2'],
  ['3', '4-j'],
]

const complexExampleB = ['1', '2+j']

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

function formatAnswer(value) {
  const resolvedValue = normalizeComplex(value)
  const real = cleanTinyValue(resolvedValue.re)
  const imaginary = cleanTinyValue(resolvedValue.im)

  if (!Number.isFinite(real) || !Number.isFinite(imaginary)) return 'Not finite'
  if (imaginary === 0) return formatScalar(real)
  if (real === 0) return `${formatScalar(imaginary)}j`

  const sign = imaginary < 0 ? '-' : '+'
  return `${formatScalar(real)} ${sign} ${formatScalar(Math.abs(imaginary))}j`
}

function normalizeComplex(value) {
  if (typeof value === 'number') return { re: value, im: 0 }
  if (value && typeof value.re === 'number' && typeof value.im === 'number') {
    return value
  }

  return complex(value)
}

function cleanTinyValue(value) {
  return Math.abs(value) < 1e-12 ? 0 : value
}

function formatScalar(value) {
  if (Math.abs(value) < 1e-12) return '0'

  const rounded = Number(value.toFixed(8))
  return rounded.toLocaleString(undefined, {
    maximumFractionDigits: 8,
  })
}

function formatInputNumber(value) {
  const cleanedValue = cleanTinyValue(value)

  if (!Number.isFinite(cleanedValue)) return ''

  return Number(cleanedValue.toFixed(8)).toString()
}

function parseComplexValue(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    return complex(value.trim().replace(/j/gi, 'i'))
  } catch {
    return null
  }
}

function parseNumericInput(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
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

function App() {
  const [activeTool, setActiveTool] = useState('matrix-solver')
  const [size, setSize] = useState(3)
  const [matrixA, setMatrixA] = useState(() => createMatrix(3))
  const [vectorB, setVectorB] = useState(() => createVector(3))
  const [solution, setSolution] = useState(null)
  const [error, setError] = useState('')
  const [angleUnit, setAngleUnit] = useState('deg')
  const [complexNumbers, setComplexNumbers] = useState(() => createInitialComplexNumbers())
  const [complexOperation, setComplexOperation] = useState('add')

  const activeToolMeta = useMemo(
    () => tools.find((tool) => tool.id === activeTool) ?? tools[0],
    [activeTool],
  )

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

  function resizeSystem(nextSize) {
    const numericSize = Number(nextSize)
    const integerSize = Number.isFinite(numericSize) ? Math.round(numericSize) : MIN_SIZE
    const limitedSize = Math.min(MAX_SIZE, Math.max(MIN_SIZE, integerSize))

    setSize(limitedSize)
    setSolution(null)
    setError('')
    setMatrixA((current) =>
      createMatrix(limitedSize).map((row, rowIndex) =>
        row.map((value, columnIndex) => current[rowIndex]?.[columnIndex] ?? value),
      ),
    )
    setVectorB((current) =>
      createVector(limitedSize).map((value, rowIndex) => current[rowIndex] ?? value),
    )
  }

  function updateMatrixCell(rowIndex, columnIndex, value) {
    setMatrixA((current) =>
      current.map((row, r) =>
        row.map((cell, c) => (r === rowIndex && c === columnIndex ? value : cell)),
      ),
    )
    setSolution(null)
    setError('')
  }

  function updateVectorCell(rowIndex, value) {
    setVectorB((current) =>
      current.map((cell, r) => (r === rowIndex ? value : cell)),
    )
    setSolution(null)
    setError('')
  }

  function loadExample() {
    setSize(3)
    setMatrixA(exampleA)
    setVectorB(exampleB)
    setSolution(null)
    setError('')
  }

  function loadComplexExample() {
    setSize(2)
    setMatrixA(complexExampleA)
    setVectorB(complexExampleB)
    setSolution(null)
    setError('')
  }

  function resetSystem() {
    setMatrixA(createMatrix(size))
    setVectorB(createVector(size))
    setSolution(null)
    setError('')
  }

  function solveSystem() {
    const parsedA = matrixA.map((row) => row.map(parseComplexValue))
    const parsedB = vectorB.map(parseComplexValue)
    const hasMissingValue =
      parsedA.some((row) => row.some((value) => value === null)) ||
      parsedB.some((value) => value === null)

    if (hasMissingValue) {
      setSolution(null)
      setError('Every cell needs a valid real or complex number.')
      return
    }

    try {
      const bColumn = parsedB.map((value) => [value])
      const result = lusolve(parsedA, bColumn)
      const values = result.valueOf().map((row) => row[0])

      setSolution(values)
      setError('')
    } catch {
      setSolution(null)
      setError('This matrix cannot be solved. Check for a singular matrix.')
    }
  }

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

  function renderMatrixSolver() {
    return (
      <section className="tool-panel" aria-labelledby="matrix-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Linear systems</p>
            <h2 id="matrix-title">Matrix solver</h2>
          </div>
          <label className="size-control">
            <span>Size of A</span>
            <input
              type="number"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={size}
              onChange={(event) => resizeSystem(event.target.value)}
            />
          </label>
        </div>

        <div className="equation-strip" aria-label="Equation format">
          <span>A</span>
          <span>x</span>
          <span>=</span>
          <span>B</span>
        </div>

        <div className="matrix-area">
          <div className="matrix-group">
            <div className="matrix-label">A</div>
            <div
              className="matrix-grid"
              style={{ '--matrix-size': size }}
              role="group"
              aria-label="Matrix A values"
            >
              {matrixA.map((row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <input
                    key={`a-${rowIndex}-${columnIndex}`}
                    type="text"
                    inputMode="text"
                    placeholder="0"
                    value={cell}
                    aria-label={`A row ${rowIndex + 1} column ${columnIndex + 1}`}
                    onChange={(event) =>
                      updateMatrixCell(rowIndex, columnIndex, event.target.value)
                    }
                  />
                )),
              )}
            </div>
          </div>

          <div className="matrix-group vector-group">
            <div className="matrix-label">B</div>
            <div className="vector-grid" role="group" aria-label="Vector B values">
              {vectorB.map((cell, rowIndex) => (
                <input
                  key={`b-${rowIndex}`}
                  type="text"
                  inputMode="text"
                  placeholder="0"
                  value={cell}
                  aria-label={`B row ${rowIndex + 1}`}
                  onChange={(event) => updateVectorCell(rowIndex, event.target.value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="primary-button" onClick={solveSystem}>
            Solve
          </button>
          <button type="button" onClick={loadExample}>
            Example
          </button>
          <button type="button" onClick={loadComplexExample}>
            Complex
          </button>
          <button type="button" onClick={resetSystem}>
            Clear
          </button>
        </div>

        {error && <p className="message error">{error}</p>}

        {solution && (
          <section className="solution-panel" aria-label="Solution values">
            <div className="matrix-label">x</div>
            <div className="solution-list">
              {solution.map((value, index) => (
                <output key={`x-${index}`}>
                  <span>x{index + 1}</span>
                  <strong>{formatAnswer(value)}</strong>
                </output>
              ))}
            </div>
          </section>
        )}
      </section>
    )
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

  function renderComplexNumbers() {
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Electrical Engineering Tools</p>
          <h1>Calculators</h1>
          <p className="author-credit">Created by Victor Karthik</p>
        </div>
        <div className="header-actions">
          <span className="status-pill">{activeToolMeta.shortName}</span>
          <a
            className="coffee-button"
            href={buyMeCoffeeUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Buy me a coffee"
          >
            <span className="coffee-symbol" aria-hidden="true">
              ☕
            </span>
            Buy me a coffee
          </a>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-nav" aria-label="Tool list">
          {tools.map((tool) => (
            <button
              className={`tool-tab ${tool.id === activeTool ? 'active' : ''}`}
              type="button"
              key={tool.id}
              aria-current={tool.id === activeTool ? 'page' : undefined}
              onClick={() => setActiveTool(tool.id)}
            >
              <span>{tool.name}</span>
              <strong>{tool.shortName}</strong>
            </button>
          ))}
          <div className="coming-soon">More calculators</div>
        </aside>

        {activeTool === 'matrix-solver' ? renderMatrixSolver() : renderComplexNumbers()}
      </div>

      <footer className="app-footer">
        <span>Author: Victor Karthik</span>
        <a href={buyMeCoffeeUrl} target="_blank" rel="noreferrer">
          Support this tool
        </a>
      </footer>
    </main>
  )
}

export default App