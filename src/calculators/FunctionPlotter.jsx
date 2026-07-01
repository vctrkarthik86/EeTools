import { useEffect, useMemo, useRef, useState } from 'react'
import { compile } from 'mathjs'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 500
const PLOT_AREA = {
  left: 58,
  right: 18,
  top: 18,
  bottom: 42,
}
const SAMPLE_COUNT = 720
const ROOT_SAMPLE_COUNT = 900
const COLORS = ['#2f7d64', '#7c4d9f', '#b65f00', '#2f5f9f', '#a63737', '#50606b']
const INITIAL_VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 }
const LOG_SAFE_VIEW = { xMin: 0.1, xMax: 100, yMin: 0.1, yMax: 100 }
const EXAMPLE_EXPRESSIONS = ['y=sin(x)', 'y=e^-t', 'y=5cos(2\u03c060t)']

function createFunction(id, expression = 'y=sin(x)', color = COLORS[0], enabled = true) {
  return { id, expression, color, enabled }
}

function stripLeftSide(expression) {
  const trimmed = expression.trim()
  const equalsIndex = trimmed.indexOf('=')

  if (equalsIndex === -1) return trimmed

  const leftSide = trimmed.slice(0, equalsIndex).trim()
  if (/^(y|f\s*\([^)]*\))$/i.test(leftSide)) {
    return trimmed.slice(equalsIndex + 1).trim()
  }

  return trimmed
}

function normalizeExpression(expression) {
  return stripLeftSide(expression)
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\u03c0/g, ' pi ')
    .replace(/pi(?=\d)/gi, 'pi ')
}

function compileExpression(expression) {
  const normalizedExpression = normalizeExpression(expression)
  return {
    normalizedExpression,
    compiled: compile(normalizedExpression),
  }
}

function evaluateFunction(compiledFunction, x) {
  if (!compiledFunction?.compiled) return null

  try {
    const value = compiledFunction.compiled.evaluate({ x, t: x })
    const numericValue = typeof value === 'number' ? value : value?.valueOf?.()

    return Number.isFinite(numericValue) ? numericValue : null
  } catch {
    return null
  }
}

function evaluateDerivative(compiledFunction, x) {
  const step = Math.max(Math.abs(x) * 1e-5, 1e-5)
  const left = evaluateFunction(compiledFunction, x - step)
  const right = evaluateFunction(compiledFunction, x + step)

  if (left === null || right === null) return null

  return (right - left) / (2 * step)
}

function integrateFunction(compiledFunction, from, to, steps = 800) {
  if (!compiledFunction || from === to) return null

  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const step = (end - start) / steps
  let area = 0
  let previousY = evaluateFunction(compiledFunction, start)

  if (previousY === null) return null

  for (let index = 1; index <= steps; index += 1) {
    const x = start + step * index
    const y = evaluateFunction(compiledFunction, x)

    if (y === null) return null

    area += ((previousY + y) / 2) * step
    previousY = y
  }

  return from <= to ? area : -area
}

function toScaleValue(value, scale) {
  if (scale === 'log') {
    if (value <= 0) return null
    return Math.log10(value)
  }

  return value
}

function fromScaleValue(value, scale) {
  return scale === 'log' ? 10 ** value : value
}

function getScaledBounds(view, scaleMode) {
  const xMin = toScaleValue(view.xMin, scaleMode.x)
  const xMax = toScaleValue(view.xMax, scaleMode.x)
  const yMin = toScaleValue(view.yMin, scaleMode.y)
  const yMax = toScaleValue(view.yMax, scaleMode.y)

  if ([xMin, xMax, yMin, yMax].some((value) => value === null)) return null

  return { xMin, xMax, yMin, yMax }
}

function getPlotSize() {
  return {
    width: CANVAS_WIDTH - PLOT_AREA.left - PLOT_AREA.right,
    height: CANVAS_HEIGHT - PLOT_AREA.top - PLOT_AREA.bottom,
  }
}

function worldToScreen(x, y, view, scaleMode) {
  const bounds = getScaledBounds(view, scaleMode)
  if (!bounds) return null

  const scaledX = toScaleValue(x, scaleMode.x)
  const scaledY = toScaleValue(y, scaleMode.y)
  if (scaledX === null || scaledY === null) return null

  const { width, height } = getPlotSize()
  const xRange = bounds.xMax - bounds.xMin
  const yRange = bounds.yMax - bounds.yMin

  if (xRange === 0 || yRange === 0) return null

  return {
    x: PLOT_AREA.left + ((scaledX - bounds.xMin) / xRange) * width,
    y: PLOT_AREA.top + ((bounds.yMax - scaledY) / yRange) * height,
  }
}

function screenToWorld(screenX, screenY, view, scaleMode) {
  const bounds = getScaledBounds(view, scaleMode)
  if (!bounds) return null

  const { width, height } = getPlotSize()
  const scaledX = bounds.xMin + ((screenX - PLOT_AREA.left) / width) * (bounds.xMax - bounds.xMin)
  const scaledY = bounds.yMax - ((screenY - PLOT_AREA.top) / height) * (bounds.yMax - bounds.yMin)

  return {
    x: fromScaleValue(scaledX, scaleMode.x),
    y: fromScaleValue(scaledY, scaleMode.y),
  }
}

function isInsidePlot(screenX, screenY) {
  const { width, height } = getPlotSize()

  return (
    screenX >= PLOT_AREA.left &&
    screenX <= PLOT_AREA.left + width &&
    screenY >= PLOT_AREA.top &&
    screenY <= PLOT_AREA.top + height
  )
}

function createLinearTicks(min, max, targetCount = 8) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return []

  const rawStep = Math.abs(max - min) / targetCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step =
    normalized <= 1 ? magnitude : normalized <= 2 ? 2 * magnitude : normalized <= 5 ? 5 * magnitude : 10 * magnitude
  const ticks = []
  const firstTick = Math.ceil(min / step) * step

  for (let value = firstTick; value <= max + step * 0.5; value += step) {
    ticks.push(value)
  }

  return ticks
}

function createLogTicks(min, max) {
  if (min <= 0 || max <= 0) return []

  const ticks = []
  const startPower = Math.ceil(Math.log10(min))
  const endPower = Math.floor(Math.log10(max))

  for (let power = startPower; power <= endPower; power += 1) {
    ticks.push(10 ** power)
  }

  return ticks
}

function createTicks(min, max, scale) {
  return scale === 'log' ? createLogTicks(min, max) : createLinearTicks(min, max)
}

function formatTick(value) {
  if (value === 0) return '0'
  const absValue = Math.abs(value)

  if (absValue >= 10000 || absValue < 0.001) return value.toExponential(1)
  if (absValue >= 100) return value.toFixed(0)
  if (absValue >= 10) return value.toFixed(1).replace(/\.0$/, '')

  return Number(value.toFixed(3)).toString()
}

function formatReadout(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--'

  const absValue = Math.abs(value)
  if (absValue >= 10000 || (absValue > 0 && absValue < 0.001)) return value.toExponential(4)

  return Number(value.toFixed(5)).toString()
}

function getSampleX(index, count, view, scaleMode) {
  if (scaleMode.x === 'log') {
    const min = Math.log10(view.xMin)
    const max = Math.log10(view.xMax)
    return 10 ** (min + ((max - min) * index) / count)
  }

  return view.xMin + ((view.xMax - view.xMin) * index) / count
}

function drawPolyline(ctx, evaluator, view, scaleMode, color, options = {}) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = options.lineWidth ?? 2
  ctx.setLineDash(options.dash ?? [])

  let isDrawing = false

  for (let index = 0; index <= SAMPLE_COUNT; index += 1) {
    const x = getSampleX(index, SAMPLE_COUNT, view, scaleMode)
    const y = evaluator(x)
    const point = y === null ? null : worldToScreen(x, y, view, scaleMode)
    const inReasonableBounds =
      point &&
      point.y > PLOT_AREA.top - CANVAS_HEIGHT * 2 &&
      point.y < CANVAS_HEIGHT + CANVAS_HEIGHT * 2

    if (!inReasonableBounds) {
      if (isDrawing) ctx.stroke()
      ctx.beginPath()
      isDrawing = false
      continue
    }

    if (!isDrawing) {
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      isDrawing = true
    } else {
      ctx.lineTo(point.x, point.y)
    }
  }

  if (isDrawing) ctx.stroke()
  ctx.restore()
}

function findRoots(compiledFunction, view, scaleMode) {
  if (!compiledFunction?.compiled) return []

  const roots = []
  let previousX = getSampleX(0, ROOT_SAMPLE_COUNT, view, scaleMode)
  let previousY = evaluateFunction(compiledFunction, previousX)

  for (let index = 1; index <= ROOT_SAMPLE_COUNT; index += 1) {
    const x = getSampleX(index, ROOT_SAMPLE_COUNT, view, scaleMode)
    const y = evaluateFunction(compiledFunction, x)

    if (previousY !== null && y !== null) {
      if (Math.abs(y) < 1e-6) roots.push(x)
      if (previousY * y < 0) {
        let left = previousX
        let right = x
        let leftY = previousY

        for (let step = 0; step < 32; step += 1) {
          const mid = (left + right) / 2
          const midY = evaluateFunction(compiledFunction, mid)

          if (midY === null) break
          if (leftY * midY <= 0) {
            right = mid
          } else {
            left = mid
            leftY = midY
          }
        }

        roots.push((left + right) / 2)
      }
    }

    previousX = x
    previousY = y
  }

  return roots
    .filter((root, index, list) => list.findIndex((value) => Math.abs(value - root) < 1e-4) === index)
    .slice(0, 12)
}

function drawPlot({ ctx, compiledFunctions, selectedFunction, view, scaleMode, cursor, roots, showDerivative, showIntegral, integralRange }) {
  const { width, height } = getPlotSize()

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  ctx.save()
  ctx.beginPath()
  ctx.rect(PLOT_AREA.left, PLOT_AREA.top, width, height)
  ctx.clip()

  const xTicks = createTicks(view.xMin, view.xMax, scaleMode.x)
  const yTicks = createTicks(view.yMin, view.yMax, scaleMode.y)

  ctx.strokeStyle = '#e7ece7'
  ctx.lineWidth = 1

  xTicks.forEach((tick) => {
    const start = worldToScreen(tick, view.yMin, view, scaleMode)
    const end = worldToScreen(tick, view.yMax, view, scaleMode)
    if (!start || !end) return
    ctx.beginPath()
    ctx.moveTo(start.x, PLOT_AREA.top)
    ctx.lineTo(start.x, PLOT_AREA.top + height)
    ctx.stroke()
  })

  yTicks.forEach((tick) => {
    const start = worldToScreen(view.xMin, tick, view, scaleMode)
    if (!start) return
    ctx.beginPath()
    ctx.moveTo(PLOT_AREA.left, start.y)
    ctx.lineTo(PLOT_AREA.left + width, start.y)
    ctx.stroke()
  })

  if (scaleMode.x === 'linear' && view.xMin <= 0 && view.xMax >= 0) {
    const zero = worldToScreen(0, view.yMin, view, scaleMode)
    if (zero) {
      ctx.strokeStyle = '#9aa59d'
      ctx.beginPath()
      ctx.moveTo(zero.x, PLOT_AREA.top)
      ctx.lineTo(zero.x, PLOT_AREA.top + height)
      ctx.stroke()
    }
  }

  if (scaleMode.y === 'linear' && view.yMin <= 0 && view.yMax >= 0) {
    const zero = worldToScreen(view.xMin, 0, view, scaleMode)
    if (zero) {
      ctx.strokeStyle = '#9aa59d'
      ctx.beginPath()
      ctx.moveTo(PLOT_AREA.left, zero.y)
      ctx.lineTo(PLOT_AREA.left + width, zero.y)
      ctx.stroke()
    }
  }

  if (showIntegral && selectedFunction?.compiled) {
    const from = Math.min(Number(integralRange.from), Number(integralRange.to))
    const to = Math.max(Number(integralRange.from), Number(integralRange.to))
    const baseline = scaleMode.y === 'log' ? view.yMin : 0
    const points = []
    const shadeSteps = 240

    for (let index = 0; index <= shadeSteps; index += 1) {
      const x = from + ((to - from) * index) / shadeSteps
      const y = evaluateFunction(selectedFunction, x)
      const point = y === null ? null : worldToScreen(x, y, view, scaleMode)
      if (point) points.push(point)
    }

    const startBase = worldToScreen(from, baseline, view, scaleMode)
    const endBase = worldToScreen(to, baseline, view, scaleMode)

    if (points.length > 1 && startBase && endBase) {
      ctx.fillStyle = `${selectedFunction.color}24`
      ctx.beginPath()
      ctx.moveTo(startBase.x, startBase.y)
      points.forEach((point) => ctx.lineTo(point.x, point.y))
      ctx.lineTo(endBase.x, endBase.y)
      ctx.closePath()
      ctx.fill()
    }
  }

  compiledFunctions.forEach((plotFunction) => {
    if (!plotFunction.enabled || !plotFunction.compiled) return
    drawPolyline(
      ctx,
      (x) => evaluateFunction(plotFunction, x),
      view,
      scaleMode,
      plotFunction.color,
    )
  })

  if (showDerivative && selectedFunction?.compiled) {
    drawPolyline(
      ctx,
      (x) => evaluateDerivative(selectedFunction, x),
      view,
      scaleMode,
      selectedFunction.color,
      { dash: [7, 5], lineWidth: 1.75 },
    )
  }

  roots.forEach((root) => {
    const point = worldToScreen(root, 0, view, scaleMode)
    if (!point) return

    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = selectedFunction?.color ?? '#2f7d64'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  })

  if (cursor && isInsidePlot(cursor.screenX, cursor.screenY)) {
    ctx.strokeStyle = '#53615a'
    ctx.setLineDash([4, 5])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cursor.screenX, PLOT_AREA.top)
    ctx.lineTo(cursor.screenX, PLOT_AREA.top + height)
    ctx.moveTo(PLOT_AREA.left, cursor.screenY)
    ctx.lineTo(PLOT_AREA.left + width, cursor.screenY)
    ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()

  ctx.strokeStyle = '#cfd8d1'
  ctx.strokeRect(PLOT_AREA.left, PLOT_AREA.top, width, height)

  ctx.fillStyle = '#657069'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  xTicks.forEach((tick) => {
    const point = worldToScreen(tick, view.yMin, view, scaleMode)
    if (!point) return
    ctx.fillText(formatTick(tick), point.x, CANVAS_HEIGHT - 16)
  })

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  yTicks.forEach((tick) => {
    const point = worldToScreen(view.xMin, tick, view, scaleMode)
    if (!point) return
    ctx.fillText(formatTick(tick), PLOT_AREA.left - 8, point.y)
  })
  ctx.textBaseline = 'alphabetic'
}

export default function FunctionPlotter() {
  const [functions, setFunctions] = useState(() => [
    createFunction('fn-1', EXAMPLE_EXPRESSIONS[0], COLORS[0], true),
    createFunction('fn-2', EXAMPLE_EXPRESSIONS[1], COLORS[1], true),
    createFunction('fn-3', EXAMPLE_EXPRESSIONS[2], COLORS[2], false),
  ])
  const [selectedId, setSelectedId] = useState('fn-1')
  const [view, setView] = useState(INITIAL_VIEW)
  const [scaleMode, setScaleMode] = useState({ x: 'linear', y: 'linear' })
  const [showDerivative, setShowDerivative] = useState(false)
  const [showIntegral, setShowIntegral] = useState(false)
  const [showRoots, setShowRoots] = useState(true)
  const [integralRange, setIntegralRange] = useState({ from: -Math.PI, to: Math.PI })
  const [cursor, setCursor] = useState(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  const compiledFunctions = useMemo(
    () =>
      functions.map((plotFunction) => {
        try {
          const compiled = compileExpression(plotFunction.expression)
          return { ...plotFunction, ...compiled, error: '' }
        } catch (error) {
          return { ...plotFunction, normalizedExpression: '', compiled: null, error: error.message }
        }
      }),
    [functions],
  )

  const selectedFunction =
    compiledFunctions.find((plotFunction) => plotFunction.id === selectedId) ?? compiledFunctions[0]

  const roots = useMemo(
    () => (showRoots ? findRoots(selectedFunction, view, scaleMode) : []),
    [scaleMode, selectedFunction, showRoots, view],
  )

  const integralArea = useMemo(
    () => integrateFunction(selectedFunction, Number(integralRange.from), Number(integralRange.to)),
    [integralRange, selectedFunction],
  )

  const cursorFunctionValue = cursor ? evaluateFunction(selectedFunction, cursor.x) : null
  const cursorDerivativeValue = cursor ? evaluateDerivative(selectedFunction, cursor.x) : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pixelRatio = window.devicePixelRatio || 1
    const context = canvas.getContext('2d')

    canvas.width = CANVAS_WIDTH * pixelRatio
    canvas.height = CANVAS_HEIGHT * pixelRatio
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    drawPlot({
      ctx: context,
      compiledFunctions,
      selectedFunction,
      view,
      scaleMode,
      cursor,
      roots,
      showDerivative,
      showIntegral,
      integralRange,
    })
  }, [compiledFunctions, cursor, integralRange, roots, scaleMode, selectedFunction, showDerivative, showIntegral, view])

  function updateFunction(id, updates) {
    setFunctions((current) =>
      current.map((plotFunction) =>
        plotFunction.id === id ? { ...plotFunction, ...updates } : plotFunction,
      ),
    )
  }

  function addFunction() {
    const id = `fn-${Date.now()}`
    const color = COLORS[functions.length % COLORS.length]

    setFunctions((current) => [...current, createFunction(id, 'y=x^2', color, true)])
    setSelectedId(id)
  }

  function removeFunction(id) {
    setFunctions((current) => current.filter((plotFunction) => plotFunction.id !== id))
    if (selectedId === id) {
      const nextFunction = functions.find((plotFunction) => plotFunction.id !== id)
      if (nextFunction) setSelectedId(nextFunction.id)
    }
  }

  function loadExample(expression) {
    updateFunction(selectedId, { expression, enabled: true })
  }

  function resetView() {
    setView(scaleMode.x === 'log' || scaleMode.y === 'log' ? LOG_SAFE_VIEW : INITIAL_VIEW)
  }

  function updateViewField(field, value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return

    setView((current) => ({ ...current, [field]: numericValue }))
  }

  function updateScale(axis, value) {
    setScaleMode((current) => ({ ...current, [axis]: value }))
    setView((current) => {
      if (value !== 'log') return current

      return {
        ...current,
        [`${axis}Min`]: current[`${axis}Min`] > 0 ? current[`${axis}Min`] : LOG_SAFE_VIEW[`${axis}Min`],
        [`${axis}Max`]: current[`${axis}Max`] > 0 ? current[`${axis}Max`] : LOG_SAFE_VIEW[`${axis}Max`],
      }
    })
  }

  function getCanvasPoint(event) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()

    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  function handlePointerMove(event) {
    const point = getCanvasPoint(event)

    if (dragRef.current) {
      const { startPoint, startView } = dragRef.current
      const bounds = getScaledBounds(startView, scaleMode)
      if (!bounds) return

      const { width, height } = getPlotSize()
      const deltaX = ((point.x - startPoint.x) / width) * (bounds.xMax - bounds.xMin)
      const deltaY = ((point.y - startPoint.y) / height) * (bounds.yMax - bounds.yMin)
      const nextXMin = fromScaleValue(bounds.xMin - deltaX, scaleMode.x)
      const nextXMax = fromScaleValue(bounds.xMax - deltaX, scaleMode.x)
      const nextYMin = fromScaleValue(bounds.yMin + deltaY, scaleMode.y)
      const nextYMax = fromScaleValue(bounds.yMax + deltaY, scaleMode.y)

      setView({ xMin: nextXMin, xMax: nextXMax, yMin: nextYMin, yMax: nextYMax })
      return
    }

    if (!isInsidePlot(point.x, point.y)) {
      setCursor(null)
      return
    }

    const worldPoint = screenToWorld(point.x, point.y, view, scaleMode)
    if (!worldPoint) return

    setCursor({ ...worldPoint, screenX: point.x, screenY: point.y })
  }

  function handlePointerDown(event) {
    const point = getCanvasPoint(event)
    if (!isInsidePlot(point.x, point.y)) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startPoint: point, startView: view }
  }

  function handlePointerUp(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  function handleWheel(event) {
    event.preventDefault()
    const point = getCanvasPoint(event)
    if (!isInsidePlot(point.x, point.y)) return

    const anchor = screenToWorld(point.x, point.y, view, scaleMode)
    const bounds = getScaledBounds(view, scaleMode)
    if (!anchor || !bounds) return

    const factor = event.deltaY < 0 ? 0.82 : 1.18
    const anchorX = toScaleValue(anchor.x, scaleMode.x)
    const anchorY = toScaleValue(anchor.y, scaleMode.y)

    setView({
      xMin: fromScaleValue(anchorX - (anchorX - bounds.xMin) * factor, scaleMode.x),
      xMax: fromScaleValue(anchorX + (bounds.xMax - anchorX) * factor, scaleMode.x),
      yMin: fromScaleValue(anchorY - (anchorY - bounds.yMin) * factor, scaleMode.y),
      yMax: fromScaleValue(anchorY + (bounds.yMax - anchorY) * factor, scaleMode.y),
    })
  }

  return (
    <section className="tool-panel plotter-panel" aria-labelledby="plotter-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Graphing</p>
          <h2 id="plotter-title">Function plotter</h2>
        </div>
        <button type="button" onClick={resetView}>
          Reset view
        </button>
      </div>

      <div className="plotter-layout">
        <div className="plotter-controls">
          <section className="plotter-section" aria-labelledby="equations-title">
            <div className="plotter-section-header">
              <h3 id="equations-title">Equations</h3>
              <button type="button" onClick={addFunction}>
                Add
              </button>
            </div>

            <div className="function-list">
              {compiledFunctions.map((plotFunction) => (
                <div className="function-row" key={plotFunction.id}>
                  <input
                    className="function-enabled"
                    type="checkbox"
                    checked={plotFunction.enabled}
                    aria-label={`${plotFunction.expression} visible`}
                    onChange={(event) => updateFunction(plotFunction.id, { enabled: event.target.checked })}
                  />
                  <input
                    className="function-color"
                    type="color"
                    value={plotFunction.color}
                    aria-label={`${plotFunction.expression} color`}
                    onChange={(event) => updateFunction(plotFunction.id, { color: event.target.value })}
                  />
                  <input
                    className="function-expression"
                    type="text"
                    value={plotFunction.expression}
                    aria-label="Function expression"
                    spellCheck="false"
                    onFocus={() => setSelectedId(plotFunction.id)}
                    onChange={(event) => updateFunction(plotFunction.id, { expression: event.target.value })}
                  />
                  <button
                    type="button"
                    className="function-select-button"
                    aria-pressed={selectedId === plotFunction.id}
                    onClick={() => setSelectedId(plotFunction.id)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="function-remove-button"
                    disabled={functions.length === 1}
                    onClick={() => removeFunction(plotFunction.id)}
                  >
                    Remove
                  </button>
                  {plotFunction.error && <p className="message error function-error">{plotFunction.error}</p>}
                </div>
              ))}
            </div>

            <div className="example-buttons" aria-label="Example equations">
              {EXAMPLE_EXPRESSIONS.map((expression) => (
                <button type="button" key={expression} onClick={() => loadExample(expression)}>
                  {expression}
                </button>
              ))}
            </div>
          </section>

          <section className="plotter-section" aria-labelledby="view-title">
            <h3 id="view-title">View</h3>
            <div className="plotter-grid-controls">
              <label>
                <span>x min</span>
                <input type="number" value={view.xMin} onChange={(event) => updateViewField('xMin', event.target.value)} />
              </label>
              <label>
                <span>x max</span>
                <input type="number" value={view.xMax} onChange={(event) => updateViewField('xMax', event.target.value)} />
              </label>
              <label>
                <span>y min</span>
                <input type="number" value={view.yMin} onChange={(event) => updateViewField('yMin', event.target.value)} />
              </label>
              <label>
                <span>y max</span>
                <input type="number" value={view.yMax} onChange={(event) => updateViewField('yMax', event.target.value)} />
              </label>
              <label>
                <span>x scale</span>
                <select value={scaleMode.x} onChange={(event) => updateScale('x', event.target.value)}>
                  <option value="linear">Linear</option>
                  <option value="log">Log</option>
                </select>
              </label>
              <label>
                <span>y scale</span>
                <select value={scaleMode.y} onChange={(event) => updateScale('y', event.target.value)}>
                  <option value="linear">Linear</option>
                  <option value="log">Log</option>
                </select>
              </label>
            </div>
          </section>

          <section className="plotter-section" aria-labelledby="analysis-title">
            <h3 id="analysis-title">Analysis</h3>
            <label className="plotter-check">
              <input type="checkbox" checked={showDerivative} onChange={(event) => setShowDerivative(event.target.checked)} />
              <span>Derivative</span>
            </label>
            <label className="plotter-check">
              <input type="checkbox" checked={showIntegral} onChange={(event) => setShowIntegral(event.target.checked)} />
              <span>Integral shaded area</span>
            </label>
            <label className="plotter-check">
              <input type="checkbox" checked={showRoots} onChange={(event) => setShowRoots(event.target.checked)} />
              <span>Find roots</span>
            </label>
            <div className="integral-controls">
              <label>
                <span>from</span>
                <input
                  type="number"
                  value={integralRange.from}
                  onChange={(event) => setIntegralRange((current) => ({ ...current, from: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>to</span>
                <input
                  type="number"
                  value={integralRange.to}
                  onChange={(event) => setIntegralRange((current) => ({ ...current, to: Number(event.target.value) }))}
                />
              </label>
            </div>
          </section>
        </div>

        <div className="plotter-stage">
          <canvas
            ref={canvasRef}
            className="plot-canvas"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            aria-label="Function plot"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setCursor(null)}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
          />

          <div className="plotter-readout">
            <output>
              <span>Cursor</span>
              <strong>x {formatReadout(cursor?.x)}, y {formatReadout(cursor?.y)}</strong>
            </output>
            <output>
              <span>Selected f(x)</span>
              <strong>{formatReadout(cursorFunctionValue)}</strong>
            </output>
            <output>
              <span>f'(x)</span>
              <strong>{formatReadout(cursorDerivativeValue)}</strong>
            </output>
            <output>
              <span>Integral</span>
              <strong>{formatReadout(integralArea)}</strong>
            </output>
          </div>

          <div className="roots-panel">
            <span>Roots in view</span>
            <strong>{roots.length ? roots.map(formatReadout).join(', ') : 'None found'}</strong>
          </div>
        </div>
      </div>
    </section>
  )
}