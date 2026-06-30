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

function parseComplexValue(value) {
  if (typeof value !== 'string' || value.trim() === '') return null

  try {
    return complex(value.trim().replace(/j/gi, 'i'))
  } catch {
    return null
  }
}

function App() {
  const [activeTool] = useState('matrix-solver')
  const [size, setSize] = useState(3)
  const [matrixA, setMatrixA] = useState(() => createMatrix(3))
  const [vectorB, setVectorB] = useState(() => createVector(3))
  const [solution, setSolution] = useState(null)
  const [error, setError] = useState('')

  const activeToolMeta = useMemo(
    () => tools.find((tool) => tool.id === activeTool),
    [activeTool],
  )

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

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Electrical Engineering Tools</p>
          <h1>Course calculators</h1>
          <p className="author-credit">Created by Victor Karthik</p>
        </div>
        <div className="header-actions">
          <a
            className="coffee-button"
            href={buyMeCoffeeUrl}
            target="_blank"
            rel="noreferrer"
          >
            Buy me a coffee
          </a>
          <span className="status-pill">{activeToolMeta.shortName}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="tool-nav" aria-label="Tool list">
          {tools.map((tool) => (
            <button
              className="tool-tab active"
              type="button"
              key={tool.id}
              aria-current={tool.id === activeTool ? 'page' : undefined}
            >
              <span>{tool.name}</span>
              <strong>{tool.shortName}</strong>
            </button>
          ))}
          <div className="coming-soon">More calculators</div>
        </aside>

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
