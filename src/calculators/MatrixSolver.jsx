import { useState } from 'react'
import { lusolve } from 'mathjs'
import { formatAnswer, parseComplexValue } from '../utils/mathFormatting'

const MIN_SIZE = 2
const MAX_SIZE = 6

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

export default function MatrixSolver() {
  const [size, setSize] = useState(3)
  const [matrixA, setMatrixA] = useState(() => createMatrix(3))
  const [vectorB, setVectorB] = useState(() => createVector(3))
  const [solution, setSolution] = useState(null)
  const [error, setError] = useState('')

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