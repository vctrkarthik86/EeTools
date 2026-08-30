import { useMemo, useRef, useState } from 'react'
import { derivative, simplify } from 'mathjs'
import {
  cleanTinyValue,
  formatInputNumber,
  formatScalar,
  parseNumericInput,
} from '../utils/mathFormatting'

const angleUnits = [
  { id: 'deg', label: 'Deg' },
  { id: 'rad', label: 'Rad' },
]

const vectorIds = ['first', 'second']

const vectorLabels = {
  first: { name: 'Vector 1', symbol: 'A' },
  second: { name: 'Vector 2', symbol: 'B' },
}

const coordinateModes = [
  { id: 'rectangular', label: 'Rect', name: 'Rectangular' },
  { id: 'cylindrical', label: 'Cyl', name: 'Cylindrical' },
  { id: 'spherical', label: 'Sph', name: 'Spherical' },
]

const vectorOperations = [
  { id: 'add', label: 'A+B', name: 'Add', resultLabel: 'A + B' },
  { id: 'subtract', label: 'A-B', name: 'Subtract', resultLabel: 'A - B' },
  { id: 'dot', label: 'Dot', name: 'Dot product', resultLabel: 'A dot B' },
  { id: 'cross', label: 'Cross', name: 'Cross product', resultLabel: 'A cross B' },
  { id: 'magnitude-first', label: '|A|', name: 'Magnitude of A', resultLabel: '|A|' },
  { id: 'magnitude-second', label: '|B|', name: 'Magnitude of B', resultLabel: '|B|' },
]

const operatorSystems = [
  {
    id: 'rectangular',
    label: 'Rect',
    name: 'Rectangular',
    variables: ['x', 'y', 'z'],
    fieldLabels: ['A_x', 'A_y', 'A_z'],
    basis: ['a_x', 'a_y', 'a_z'],
    example: {
      scalarField: 'x*y + z^2',
      vectorField: ['-y', 'x', '0'],
    },
  },
  {
    id: 'cylindrical',
    label: 'Cyl',
    name: 'Cylindrical',
    variables: ['ρ', 'φ', 'z'],
    fieldLabels: ['A_ρ', 'A_φ', 'A_z'],
    basis: ['a_ρ', 'a_φ', 'a_z'],
    example: {
      scalarField: 'ρ^2 * z',
      vectorField: ['0', 'ρ^2', '0'],
    },
  },
  {
    id: 'spherical',
    label: 'Sph',
    name: 'Spherical',
    variables: ['r', 'θ', 'φ'],
    fieldLabels: ['A_r', 'A_θ', 'A_φ'],
    basis: ['a_r', 'a_θ', 'a_φ'],
    example: {
      scalarField: 'r * cos(θ)',
      vectorField: ['0', '0', 'r * sin(θ)'],
    },
  },
]


function createVectorFields(overrides = {}) {
  return {
    mode: 'rectangular',
    x: '',
    y: '',
    z: '',
    cylRho: '',
    cylPhi: '',
    cylZ: '',
    sphR: '',
    sphTheta: '',
    sphPhi: '',
    ...overrides,
  }
}

function createInitialVectors() {
  return {
    first: createVectorFields({
      mode: 'rectangular',
      x: '3',
      y: '-2',
      z: '4',
    }),
    second: createVectorFields({
      mode: 'cylindrical',
      cylRho: '1.5',
      cylPhi: '2',
      cylZ: '-1',
    }),
  }
}

function createEmptyVectors() {
  return {
    first: createVectorFields(),
    second: createVectorFields(),
  }
}

function createOperatorInputs() {
  return operatorSystems.reduce((inputs, system) => {
    inputs[system.id] = {
      scalarField: system.example.scalarField,
      vectorField: [...system.example.vectorField],
    }
    return inputs
  }, {})
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI
}

function convertAngleInput(angle, fromUnit, toUnit) {
  const parsedAngle = parseNumericInput(angle)

  if (parsedAngle === null) return angle

  const radians = fromUnit === 'deg' ? degreesToRadians(parsedAngle) : parsedAngle
  return formatInputNumber(toUnit === 'deg' ? radiansToDegrees(radians) : radians)
}

function getAngleInRadians(value, angleUnit) {
  const angle = parseNumericInput(value)

  if (angle === null) return null

  return angleUnit === 'deg' ? degreesToRadians(angle) : angle
}

function getAngleInUnit(radians, angleUnit) {
  return angleUnit === 'deg' ? radiansToDegrees(radians) : radians
}

function fromCylindrical(components) {
  return {
    x: components.rho * Math.cos(components.phi),
    y: components.rho * Math.sin(components.phi),
    z: components.z,
  }
}

function fromSpherical(components) {
  return {
    x: components.r * Math.sin(components.theta) * Math.cos(components.phi),
    y: components.r * Math.sin(components.theta) * Math.sin(components.phi),
    z: components.r * Math.cos(components.theta),
  }
}

function toCylindrical(vector) {
  return {
    rho: Math.hypot(vector.x, vector.y),
    phi: Math.atan2(vector.y, vector.x),
    z: vector.z,
  }
}

function toSpherical(vector) {
  const r = Math.hypot(vector.x, vector.y, vector.z)

  return {
    r,
    theta: r === 0 ? 0 : Math.acos(vector.z / r),
    phi: Math.atan2(vector.y, vector.x),
  }
}

function parseVectorInput(vector, angleUnit) {
  if (vector.mode === 'cylindrical') {
    const rho = parseNumericInput(vector.cylRho)
    const phi = getAngleInRadians(vector.cylPhi, angleUnit)
    const z = parseNumericInput(vector.cylZ)

    if (rho === null || phi === null || z === null) return null

    return cleanVector(fromCylindrical({ rho, phi, z }))
  }

  if (vector.mode === 'spherical') {
    const r = parseNumericInput(vector.sphR)
    const theta = getAngleInRadians(vector.sphTheta, angleUnit)
    const phi = getAngleInRadians(vector.sphPhi, angleUnit)

    if (r === null || theta === null || phi === null) return null

    return cleanVector(fromSpherical({ r, theta, phi }))
  }

  const x = parseNumericInput(vector.x)
  const y = parseNumericInput(vector.y)
  const z = parseNumericInput(vector.z)

  if (x === null || y === null || z === null) return null

  return cleanVector({ x, y, z })
}

function getFieldsForMode(vector, mode, angleUnit) {
  if (mode === 'cylindrical') {
    const cylindrical = toCylindrical(vector)

    return {
      cylRho: formatInputNumber(cylindrical.rho),
      cylPhi: formatInputNumber(getAngleInUnit(cylindrical.phi, angleUnit)),
      cylZ: formatInputNumber(cylindrical.z),
    }
  }

  if (mode === 'spherical') {
    const spherical = toSpherical(vector)

    return {
      sphR: formatInputNumber(spherical.r),
      sphTheta: formatInputNumber(getAngleInUnit(spherical.theta, angleUnit)),
      sphPhi: formatInputNumber(getAngleInUnit(spherical.phi, angleUnit)),
    }
  }

  return {
    x: formatInputNumber(vector.x),
    y: formatInputNumber(vector.y),
    z: formatInputNumber(vector.z),
  }
}

function cleanVector(vector) {
  return {
    x: cleanTinyValue(vector.x),
    y: cleanTinyValue(vector.y),
    z: cleanTinyValue(vector.z),
  }
}

function addVectors(first, second) {
  return cleanVector({
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  })
}

function subtractVectors(first, second) {
  return cleanVector({
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  })
}

function dotProduct(first, second) {
  return cleanTinyValue(first.x * second.x + first.y * second.y + first.z * second.z)
}

function crossProduct(first, second) {
  return cleanVector({
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  })
}

function getMagnitude(vector) {
  return cleanTinyValue(Math.hypot(vector.x, vector.y, vector.z))
}

function StaticCoordinatePlot({ vector, mode, angleUnit }) {
  const width = 460
  const height = 330
  const origin = { x: 230, y: 225 }
  const magnitude = getMagnitude(vector)
  const plotScale = magnitude === 0 ? 0 : 112 / magnitude

  function project(point) {
    return {
      x: origin.x + (point.x - point.y * 0.72) * plotScale,
      y: origin.y - point.z * plotScale + (point.x + point.y) * 0.3 * plotScale,
    }
  }

  const tip = project(vector)
  const xyPoint = project({ x: vector.x, y: vector.y, z: 0 })
  const cylindrical = toCylindrical(vector)
  const spherical = toSpherical(vector)
  const phi = getAngleInUnit(cylindrical.phi, angleUnit)
  const theta = getAngleInUnit(spherical.theta, angleUnit)
  const modeName = coordinateModes.find((candidate) => candidate.id === mode)?.name

  return (
    <div className={`coordinate-plot coordinate-plot-${mode}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="coordinate-plot-title coordinate-plot-description">
        <title id="coordinate-plot-title">Vector in {modeName} coordinates</title>
        <desc id="coordinate-plot-description">
          A three-dimensional diagram of the entered vector with {modeName.toLowerCase()} coordinate guides.
        </desc>
        <defs>
          <marker id="coordinate-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
          <radialGradient id="coordinate-sphere" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#2f7d64" stopOpacity="0.09" />
          </radialGradient>
        </defs>

        {mode === 'rectangular' && (
          <g className="coordinate-guides">
            <path d="M 95 184 L 230 225 L 365 266 L 230 307 Z" className="coordinate-plane" />
            <line x1="80" y1="180" x2="380" y2="270" />
            <line x1="360" y1="177" x2="100" y2="273" />
            <line x1="230" y1="297" x2="230" y2="48" />
            <text x="386" y="279">x</text>
            <text x="83" y="285">y</text>
            <text x="238" y="52">z</text>
            <line x1={tip.x} y1={tip.y} x2={xyPoint.x} y2={xyPoint.y} className="coordinate-projection" />
            <line x1={xyPoint.x} y1={xyPoint.y} x2={origin.x} y2={origin.y} className="coordinate-projection" />
          </g>
        )}

        {mode === 'cylindrical' && (
          <g className="coordinate-guides">
            <ellipse cx="230" cy="225" rx="126" ry="43" className="coordinate-plane" />
            <ellipse cx="230" cy="142" rx="126" ry="43" className="coordinate-faint" />
            <line x1="104" y1="142" x2="104" y2="225" className="coordinate-faint" />
            <line x1="356" y1="142" x2="356" y2="225" className="coordinate-faint" />
            <line x1="230" y1="292" x2="230" y2="45" />
            <line x1={origin.x} y1={origin.y} x2={xyPoint.x} y2={xyPoint.y} className="coordinate-radius" />
            <line x1={xyPoint.x} y1={xyPoint.y} x2={tip.x} y2={tip.y} className="coordinate-projection" />
            <path d="M 265 236 Q 254 208 230 205" className="coordinate-angle" />
            <text x="238" y="49">z</text>
            <text x="269" y="222">φ</text>
            <text x={(origin.x + xyPoint.x) / 2 + 5} y={(origin.y + xyPoint.y) / 2 - 6}>ρ</text>
          </g>
        )}

        {mode === 'spherical' && (
          <g className="coordinate-guides">
            <circle cx="230" cy="176" r="124" fill="url(#coordinate-sphere)" className="coordinate-sphere" />
            <ellipse cx="230" cy="176" rx="124" ry="42" className="coordinate-faint" />
            <path d="M 230 52 C 278 88 278 264 230 300" className="coordinate-faint" />
            <line x1="230" y1="302" x2="230" y2="42" />
            <line x1={origin.x} y1={origin.y} x2={xyPoint.x} y2={xyPoint.y} className="coordinate-projection" />
            <path d="M 230 185 Q 253 188 264 208" className="coordinate-angle" />
            <path d="M 230 191 Q 254 177 253 151" className="coordinate-angle coordinate-angle-theta" />
            <text x="238" y="45">z</text>
            <text x="267" y="199">φ</text>
            <text x="259" y="165">θ</text>
            <text x={(origin.x + tip.x) / 2 + 7} y={(origin.y + tip.y) / 2 - 7}>r</text>
          </g>
        )}

        <line
          x1={origin.x}
          y1={origin.y}
          x2={tip.x}
          y2={tip.y}
          className="coordinate-vector-arrow"
          markerEnd="url(#coordinate-arrow)"
        />
        <circle cx={origin.x} cy={origin.y} r="4" className="coordinate-origin" />
        <circle cx={tip.x} cy={tip.y} r="5" className="coordinate-tip" />
        <text x={origin.x + 8} y={origin.y + 18} className="coordinate-origin-label">O</text>
        <text x={tip.x + 9} y={tip.y - 9} className="coordinate-tip-label">V</text>
      </svg>
      <div className="coordinate-plot-legend" aria-label="Plot values">
        <span>|V| = {formatScalar(magnitude)}</span>
        {mode === 'cylindrical' && <span>φ = {formatScalar(phi)} {angleUnit}</span>}
        {mode === 'spherical' && <span>θ = {formatScalar(theta)} {angleUnit}, φ = {formatScalar(phi)} {angleUnit}</span>}
      </div>
    </div>
  )
}

function CoordinatePlot({ vector, mode, angleUnit }) {
  const width = 460
  const height = 350
  const origin = { x: 230, y: 188 }
  const magnitude = getMagnitude(vector)
  const [rotation, setRotation] = useState({ yaw: 0.65, pitch: 0.4 })
  const drag = useRef(null)
  const rhoSymbol = '\u03c1'
  const phiSymbol = '\u03c6'
  const thetaSymbol = '\u03b8'

  if (!Number.isFinite(magnitude)) {
    return <StaticCoordinatePlot vector={vector} mode={mode} angleUnit={angleUnit} />
  }

  const vectorScale = magnitude === 0 ? 0 : 108 / magnitude
  const plottedVector = {
    x: vector.x * vectorScale,
    y: vector.y * vectorScale,
    z: vector.z * vectorScale,
  }
  const cylindrical = toCylindrical(vector)
  const spherical = toSpherical(vector)
  const phi = cylindrical.phi
  const theta = spherical.theta
  const modeName = coordinateModes.find((candidate) => candidate.id === mode)?.name

  function project(point) {
    const cosYaw = Math.cos(rotation.yaw)
    const sinYaw = Math.sin(rotation.yaw)
    const cosPitch = Math.cos(rotation.pitch)
    const sinPitch = Math.sin(rotation.pitch)
    const horizontal = point.x * cosYaw - point.y * sinYaw
    const depth = point.x * sinYaw + point.y * cosYaw

    return {
      x: origin.x + horizontal,
      y: origin.y - point.z * cosPitch + depth * sinPitch,
    }
  }

  function pathFrom(points, close = false) {
    const path = points
      .map((point, index) => {
        const projected = project(point)
        return `${index === 0 ? 'M' : 'L'} ${projected.x} ${projected.y}`
      })
      .join(' ')

    return close ? `${path} Z` : path
  }

  function arcPoints(createPoint, end, steps = 32) {
    return Array.from({ length: steps + 1 }, (_, index) => createPoint((end * index) / steps))
  }

  function midpoint(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      z: (first.z + second.z) / 2,
    }
  }

  function renderLabel(point, text, className = '') {
    const position = project(point)
    return (
      <text x={position.x + 7} y={position.y - 7} className={`coordinate-value-label ${className}`}>
        {text}
      </text>
    )
  }

  function handleKeyDown(event) {
    const step = event.shiftKey ? 0.2 : 0.1
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return

    event.preventDefault()
    setRotation((current) => ({
      yaw: current.yaw + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      pitch: Math.max(
        -1.35,
        Math.min(1.35, current.pitch + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0)),
      ),
    }))
  }

  const xPoint = { x: plottedVector.x, y: 0, z: 0 }
  const xyPoint = { x: plottedVector.x, y: plottedVector.y, z: 0 }
  const radialPoint = { x: plottedVector.x, y: plottedVector.y, z: 0 }
  const tip = project(plottedVector)
  const circle = arcPoints(
    (angle) => ({ x: 112 * Math.cos(angle), y: 112 * Math.sin(angle), z: 0 }),
    Math.PI * 2,
    64,
  )
  const phiArc = arcPoints(
    (angle) => ({ x: 45 * Math.cos(angle), y: 45 * Math.sin(angle), z: 0 }),
    phi,
  )
  const thetaArc = arcPoints(
    (angle) => ({
      x: 58 * Math.sin(angle) * Math.cos(phi),
      y: 58 * Math.sin(angle) * Math.sin(phi),
      z: 58 * Math.cos(angle),
    }),
    theta,
  )
  const sphereCircleXz = arcPoints(
    (angle) => ({ x: 112 * Math.cos(angle), y: 0, z: 112 * Math.sin(angle) }),
    Math.PI * 2,
    64,
  )
  const sphereCircleYz = arcPoints(
    (angle) => ({ x: 0, y: 112 * Math.cos(angle), z: 112 * Math.sin(angle) }),
    Math.PI * 2,
    64,
  )
  const axisLength = 135
  const axisEnds = {
    x: project({ x: axisLength, y: 0, z: 0 }),
    y: project({ x: 0, y: axisLength, z: 0 }),
    z: project({ x: 0, y: 0, z: axisLength }),
  }
  const anglePhi = formatScalar(getAngleInUnit(phi, angleUnit))
  const angleTheta = formatScalar(getAngleInUnit(theta, angleUnit))

  return (
    <div className={`coordinate-plot coordinate-plot-${mode}`}>
      <div className="coordinate-plot-toolbar">
        <span>Drag to rotate · Arrow keys also work</span>
        <button type="button" onClick={() => setRotation({ yaw: 0.65, pitch: 0.4 })}>
          Reset view
        </button>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex="0"
        aria-labelledby="interactive-coordinate-title interactive-coordinate-description"
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, ...rotation }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          setRotation({
            yaw: drag.current.yaw + (event.clientX - drag.current.x) * 0.012,
            pitch: Math.max(
              -1.35,
              Math.min(1.35, drag.current.pitch - (event.clientY - drag.current.y) * 0.012),
            ),
          })
        }}
        onPointerUp={(event) => {
          drag.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={() => { drag.current = null }}
        onLostPointerCapture={() => { drag.current = null }}
      >
        <title id="interactive-coordinate-title">Vector in {modeName} coordinates</title>
        <desc id="interactive-coordinate-description">
          Rotatable three-dimensional diagram with labeled {modeName.toLowerCase()} components.
        </desc>
        <defs>
          <marker id="interactive-coordinate-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        {mode === 'rectangular' && (
          <g className="coordinate-guides">
            <path
              d={pathFrom([
                { x: -105, y: -105, z: 0 },
                { x: 105, y: -105, z: 0 },
                { x: 105, y: 105, z: 0 },
                { x: -105, y: 105, z: 0 },
              ], true)}
              className="coordinate-plane"
            />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.x.x} y2={axisEnds.x.y} className="coordinate-axis-x" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.y.x} y2={axisEnds.y.y} className="coordinate-axis-y" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.z.x} y2={axisEnds.z.y} className="coordinate-axis-z" />
            <text x={axisEnds.x.x + 7} y={axisEnds.x.y}>x</text>
            <text x={axisEnds.y.x + 7} y={axisEnds.y.y}>y</text>
            <text x={axisEnds.z.x + 7} y={axisEnds.z.y}>z</text>
            <path d={pathFrom([{ x: 0, y: 0, z: 0 }, xPoint])} className="coordinate-component coordinate-component-x" />
            <path d={pathFrom([xPoint, xyPoint])} className="coordinate-component coordinate-component-y" />
            <path d={pathFrom([xyPoint, plottedVector])} className="coordinate-component coordinate-component-z" />
            {renderLabel(midpoint({ x: 0, y: 0, z: 0 }, xPoint), `x = ${formatScalar(vector.x)}`, 'coordinate-label-x')}
            {renderLabel(midpoint(xPoint, xyPoint), `y = ${formatScalar(vector.y)}`, 'coordinate-label-y')}
            {renderLabel(midpoint(xyPoint, plottedVector), `z = ${formatScalar(vector.z)}`, 'coordinate-label-z')}
          </g>
        )}

        {mode === 'cylindrical' && (
          <g className="coordinate-guides">
            <path d={pathFrom(circle, true)} className="coordinate-plane" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.x.x} y2={axisEnds.x.y} className="coordinate-faint" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.z.x} y2={axisEnds.z.y} className="coordinate-axis-z" />
            <text x={axisEnds.x.x + 7} y={axisEnds.x.y}>x reference</text>
            <text x={axisEnds.z.x + 7} y={axisEnds.z.y}>z</text>
            <path d={pathFrom([{ x: 0, y: 0, z: 0 }, radialPoint])} className="coordinate-component coordinate-component-rho" />
            <path d={pathFrom([radialPoint, plottedVector])} className="coordinate-component coordinate-component-z" />
            <path d={pathFrom(phiArc)} className="coordinate-angle" />
            {renderLabel(midpoint({ x: 0, y: 0, z: 0 }, radialPoint), `${rhoSymbol} = ${formatScalar(cylindrical.rho)}`, 'coordinate-label-rho')}
            {renderLabel(midpoint(radialPoint, plottedVector), `z = ${formatScalar(vector.z)}`, 'coordinate-label-z')}
            {renderLabel({ x: 50 * Math.cos(phi / 2), y: 50 * Math.sin(phi / 2), z: 0 }, `${phiSymbol} = ${anglePhi} ${angleUnit}`, 'coordinate-label-angle')}
          </g>
        )}

        {mode === 'spherical' && (
          <g className="coordinate-guides">
            <circle cx={origin.x} cy={origin.y} r="112" className="coordinate-sphere" />
            <path d={pathFrom(circle, true)} className="coordinate-faint" />
            <path d={pathFrom(sphereCircleXz, true)} className="coordinate-faint" />
            <path d={pathFrom(sphereCircleYz, true)} className="coordinate-faint" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.x.x} y2={axisEnds.x.y} className="coordinate-faint" />
            <line x1={origin.x} y1={origin.y} x2={axisEnds.z.x} y2={axisEnds.z.y} className="coordinate-axis-z" />
            <text x={axisEnds.x.x + 7} y={axisEnds.x.y}>x reference</text>
            <text x={axisEnds.z.x + 7} y={axisEnds.z.y}>z</text>
            <path d={pathFrom([{ x: 0, y: 0, z: 0 }, radialPoint])} className="coordinate-projection" />
            <path d={pathFrom(phiArc)} className="coordinate-angle" />
            <path d={pathFrom(thetaArc)} className="coordinate-angle coordinate-angle-theta" />
            {renderLabel(midpoint({ x: 0, y: 0, z: 0 }, plottedVector), `r = ${formatScalar(spherical.r)}`, 'coordinate-label-r')}
            {renderLabel({ x: 50 * Math.cos(phi / 2), y: 50 * Math.sin(phi / 2), z: 0 }, `${phiSymbol} = ${anglePhi} ${angleUnit}`, 'coordinate-label-angle')}
            {renderLabel({
              x: 65 * Math.sin(theta / 2) * Math.cos(phi),
              y: 65 * Math.sin(theta / 2) * Math.sin(phi),
              z: 65 * Math.cos(theta / 2),
            }, `${thetaSymbol} = ${angleTheta} ${angleUnit}`, 'coordinate-label-theta')}
          </g>
        )}

        <line
          x1={origin.x}
          y1={origin.y}
          x2={tip.x}
          y2={tip.y}
          className="coordinate-vector-arrow"
          markerEnd="url(#interactive-coordinate-arrow)"
        />
        <circle cx={origin.x} cy={origin.y} r="4" className="coordinate-origin" />
        <circle cx={tip.x} cy={tip.y} r="5" className="coordinate-tip" />
        <text x={origin.x + 8} y={origin.y + 18} className="coordinate-origin-label">O</text>
        <text x={tip.x + 9} y={tip.y - 9} className="coordinate-tip-label">V</text>
      </svg>

      <div className="coordinate-plot-legend" aria-label="Plot values">
        <span>|V| = {formatScalar(magnitude)}</span>
        {mode === 'rectangular' && (
          <span>x = {formatScalar(vector.x)}, y = {formatScalar(vector.y)}, z = {formatScalar(vector.z)}</span>
        )}
        {mode === 'cylindrical' && (
          <span>{rhoSymbol} = {formatScalar(cylindrical.rho)}, {phiSymbol} = {anglePhi} {angleUnit}, z = {formatScalar(vector.z)}</span>
        )}
        {mode === 'spherical' && (
          <span>r = {formatScalar(spherical.r)}, {thetaSymbol} = {angleTheta} {angleUnit}, {phiSymbol} = {anglePhi} {angleUnit}</span>
        )}
      </div>
    </div>
  )
}

function getVectorViews(vector, angleUnit) {
  const cylindrical = toCylindrical(vector)
  const spherical = toSpherical(vector)

  return [
    {
      id: 'rectangular',
      label: 'Rectangular',
      values: [
        { label: 'x', value: vector.x },
        { label: 'y', value: vector.y },
        { label: 'z', value: vector.z },
      ],
    },
    {
      id: 'cylindrical',
      label: 'Cylindrical',
      values: [
        { label: 'ρ', value: cylindrical.rho },
        { label: 'φ', value: getAngleInUnit(cylindrical.phi, angleUnit), unit: angleUnit },
        { label: 'z', value: cylindrical.z },
      ],
    },
    {
      id: 'spherical',
      label: 'Spherical',
      values: [
        { label: 'r', value: spherical.r },
        { label: 'θ', value: getAngleInUnit(spherical.theta, angleUnit), unit: angleUnit },
        { label: 'φ', value: getAngleInUnit(spherical.phi, angleUnit), unit: angleUnit },
      ],
    },
  ]
}

function formatCoordinateView(view) {
  return view.values
    .map((component) => {
      const unit = component.unit ? ` ${component.unit}` : ''
      return `${component.label} = ${formatScalar(cleanTinyValue(component.value))}${unit}`
    })
    .join(', ')
}

function formatSymbolicExpression(expression) {
  return expression
    .replace(/\brho\b/g, 'ρ')
    .replace(/\btheta\b/g, 'θ')
    .replace(/\bphi\b/g, 'φ')
}

function formatSymbolicTerm(component, basis) {
  const simplified = simplify(component).toString()
  const displayed = formatSymbolicExpression(simplified)
  const coefficient = /\s[+-]\s/.test(displayed) ? `(${displayed})` : displayed

  if (simplified === '0') return null
  if (simplified === '1') return { sign: '+', text: basis }
  if (simplified === '-1') return { sign: '-', text: basis }
  if (simplified.startsWith('-')) {
    const unsigned = coefficient.startsWith('-') ? coefficient.slice(1) : coefficient
    return { sign: '-', text: `${unsigned} ${basis}` }
  }

  return { sign: '+', text: `${coefficient} ${basis}` }
}

function formatSymbolicVector(components, basis) {
  const terms = components
    .map((component, index) => formatSymbolicTerm(component, basis[index]))
    .filter(Boolean)

  if (!terms.length) return '0'

  return terms
    .map((term, index) => {
      if (index === 0) return term.sign === '-' ? `-${term.text}` : term.text
      return `${term.sign} ${term.text}`
    })
    .join(' ')
}

function normalizeSymbolicInput(input) {
  const normalized = input.trim()

  if (!normalized) return '0'

  return normalized
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\u03c1/g, 'rho')
    .replace(/\u03b8/g, 'theta')
    .replace(/\u03c6/g, 'phi')
    .replace(/\u03d5/g, 'phi')
    .replace(/\u03c0/g, 'pi')
}

function simplifyExpression(expression) {
  return simplify(expression).toString()
}

function getDerivative(expression, variable) {
  return simplify(derivative(expression, variable)).toString()
}

function calculateGradient(systemId, scalarField) {
  const field = normalizeSymbolicInput(scalarField)

  if (systemId === 'cylindrical') {
    return [
      getDerivative(field, 'rho'),
      simplifyExpression(`(1 / rho) * (${getDerivative(field, 'phi')})`),
      getDerivative(field, 'z'),
    ]
  }

  if (systemId === 'spherical') {
    return [
      getDerivative(field, 'r'),
      simplifyExpression(`(1 / r) * (${getDerivative(field, 'theta')})`),
      simplifyExpression(`(1 / (r * sin(theta))) * (${getDerivative(field, 'phi')})`),
    ]
  }

  return [
    getDerivative(field, 'x'),
    getDerivative(field, 'y'),
    getDerivative(field, 'z'),
  ]
}

function calculateVectorGradient(systemId, vectorField) {
  const [first, second, third] = vectorField.map(normalizeSymbolicInput)

  if (systemId === 'cylindrical') {
    return [
      [getDerivative(first, 'rho'), getDerivative(second, 'rho'), getDerivative(third, 'rho')],
      [
        simplifyExpression(`(1 / rho) * ((${getDerivative(first, 'phi')}) - (${second}))`),
        simplifyExpression(`(1 / rho) * ((${getDerivative(second, 'phi')}) + (${first}))`),
        simplifyExpression(`(1 / rho) * (${getDerivative(third, 'phi')})`),
      ],
      [getDerivative(first, 'z'), getDerivative(second, 'z'), getDerivative(third, 'z')],
    ]
  }

  if (systemId === 'spherical') {
    return [
      [getDerivative(first, 'r'), getDerivative(second, 'r'), getDerivative(third, 'r')],
      [
        simplifyExpression(`(1 / r) * ((${getDerivative(first, 'theta')}) - (${second}))`),
        simplifyExpression(`(1 / r) * ((${getDerivative(second, 'theta')}) + (${first}))`),
        simplifyExpression(`(1 / r) * (${getDerivative(third, 'theta')})`),
      ],
      [
        simplifyExpression(
          `(1 / (r * sin(theta))) * ((${getDerivative(first, 'phi')}) - ` +
            `(${third}) * sin(theta))`,
        ),
        simplifyExpression(
          `(1 / (r * sin(theta))) * ((${getDerivative(second, 'phi')}) - ` +
            `(${third}) * cos(theta))`,
        ),
        simplifyExpression(
          `(1 / (r * sin(theta))) * ((${getDerivative(third, 'phi')}) + ` +
            `(${first}) * sin(theta) + (${second}) * cos(theta))`,
        ),
      ],
    ]
  }

  return [
    [getDerivative(first, 'x'), getDerivative(second, 'x'), getDerivative(third, 'x')],
    [getDerivative(first, 'y'), getDerivative(second, 'y'), getDerivative(third, 'y')],
    [getDerivative(first, 'z'), getDerivative(second, 'z'), getDerivative(third, 'z')],
  ]
}

function calculateDivergence(systemId, vectorField) {
  const [first, second, third] = vectorField.map(normalizeSymbolicInput)

  if (systemId === 'cylindrical') {
    return simplifyExpression(
      `(1 / rho) * (${getDerivative(`rho * (${first})`, 'rho')}) + ` +
        `(1 / rho) * (${getDerivative(second, 'phi')}) + (${getDerivative(third, 'z')})`,
    )
  }

  if (systemId === 'spherical') {
    return simplifyExpression(
      `(1 / r^2) * (${getDerivative(`r^2 * (${first})`, 'r')}) + ` +
        `(1 / (r * sin(theta))) * (${getDerivative(
          `sin(theta) * (${second})`,
          'theta',
        )}) + ` +
        `(1 / (r * sin(theta))) * (${getDerivative(third, 'phi')})`,
    )
  }

  return simplifyExpression(
    `(${getDerivative(first, 'x')}) + (${getDerivative(second, 'y')}) + (${getDerivative(
      third,
      'z',
    )})`,
  )
}

function calculateScalarLaplacian(systemId, scalarField) {
  const field = normalizeSymbolicInput(scalarField)

  if (systemId === 'cylindrical') {
    return simplifyExpression(
      `(1 / rho) * (${getDerivative(`rho * (${getDerivative(field, 'rho')})`, 'rho')}) + ` +
        `(1 / rho^2) * (${getDerivative(getDerivative(field, 'phi'), 'phi')}) + ` +
        `(${getDerivative(getDerivative(field, 'z'), 'z')})`,
    )
  }

  if (systemId === 'spherical') {
    return simplifyExpression(
      `(1 / r^2) * (${getDerivative(`r^2 * (${getDerivative(field, 'r')})`, 'r')}) + ` +
        `(1 / (r^2 * sin(theta))) * (${getDerivative(
          `sin(theta) * (${getDerivative(field, 'theta')})`,
          'theta',
        )}) + ` +
        `(1 / (r^2 * sin(theta)^2)) * (${getDerivative(
          getDerivative(field, 'phi'),
          'phi',
        )})`,
    )
  }

  return simplifyExpression(
    `(${getDerivative(getDerivative(field, 'x'), 'x')}) + ` +
      `(${getDerivative(getDerivative(field, 'y'), 'y')}) + ` +
      `(${getDerivative(getDerivative(field, 'z'), 'z')})`,
  )
}

function calculateCurl(systemId, vectorField) {
  const [first, second, third] = vectorField.map(normalizeSymbolicInput)

  if (systemId === 'cylindrical') {
    return [
      simplifyExpression(
        `(1 / rho) * ((${getDerivative(third, 'phi')}) - (${getDerivative(
          `rho * (${second})`,
          'z',
        )}))`,
      ),
      simplifyExpression(`(${getDerivative(first, 'z')}) - (${getDerivative(third, 'rho')})`),
      simplifyExpression(
        `(1 / rho) * ((${getDerivative(`rho * (${second})`, 'rho')}) - (${getDerivative(
          first,
          'phi',
        )}))`,
      ),
    ]
  }

  if (systemId === 'spherical') {
    return [
      simplifyExpression(
        `(1 / (r * sin(theta))) * ((${getDerivative(
          `(${third}) * sin(theta)`,
          'theta',
        )}) - (${getDerivative(second, 'phi')}))`,
      ),
      simplifyExpression(
        `(1 / r) * (((1 / sin(theta)) * (${getDerivative(first, 'phi')})) - (${getDerivative(
          `r * (${third})`,
          'r',
        )}))`,
      ),
      simplifyExpression(
        `(1 / r) * ((${getDerivative(`r * (${second})`, 'r')}) - (${getDerivative(
          first,
          'theta',
        )}))`,
      ),
    ]
  }

  return [
    simplifyExpression(`(${getDerivative(third, 'y')}) - (${getDerivative(second, 'z')})`),
    simplifyExpression(`(${getDerivative(first, 'z')}) - (${getDerivative(third, 'x')})`),
    simplifyExpression(`(${getDerivative(second, 'x')}) - (${getDerivative(first, 'y')})`),
  ]
}

function calculateOperatorResults(systemId, operatorInput) {
  try {
    return {
      gradient: calculateGradient(systemId, operatorInput.scalarField),
      vectorGradient: calculateVectorGradient(systemId, operatorInput.vectorField),
      divergence: calculateDivergence(systemId, operatorInput.vectorField),
      curl: calculateCurl(systemId, operatorInput.vectorField),
      scalarLaplacian: calculateScalarLaplacian(systemId, operatorInput.scalarField),
      error: '',
    }
  } catch (error) {
    return {
      gradient: null,
      vectorGradient: null,
      divergence: null,
      curl: null,
      scalarLaplacian: null,
      error: error.message || 'Check the field expressions.',
    }
  }
}

function getOperationResult(operation, first, second) {
  if (operation === 'add') return { type: 'vector', value: addVectors(first, second) }
  if (operation === 'subtract') return { type: 'vector', value: subtractVectors(first, second) }
  if (operation === 'dot') return { type: 'scalar', value: dotProduct(first, second) }
  if (operation === 'cross') return { type: 'vector', value: crossProduct(first, second) }
  if (operation === 'magnitude-first') return { type: 'scalar', value: getMagnitude(first) }

  return { type: 'scalar', value: getMagnitude(second) }
}

export default function VectorCalculator({ description }) {
  const [angleUnit, setAngleUnit] = useState('deg')
  const [vectors, setVectors] = useState(() => createInitialVectors())
  const [coordinateVector, setCoordinateVector] = useState(() =>
    createVectorFields({ mode: 'rectangular', x: '3', y: '2', z: '4' }),
  )
  const [coordinateView, setCoordinateView] = useState('rectangular')
  const [operation, setOperation] = useState('add')
  const [operatorSystem, setOperatorSystem] = useState('rectangular')
  const [operatorInputs, setOperatorInputs] = useState(() => createOperatorInputs())

  const parsedVectors = useMemo(
    () => ({
      first: parseVectorInput(vectors.first, angleUnit),
      second: parseVectorInput(vectors.second, angleUnit),
    }),
    [angleUnit, vectors],
  )
  const parsedCoordinateVector = useMemo(
    () => parseVectorInput(coordinateVector, angleUnit),
    [angleUnit, coordinateVector],
  )

  const activeOperation =
    vectorOperations.find((candidate) => candidate.id === operation) ?? vectorOperations[0]
  const activeOperatorSystem =
    operatorSystems.find((system) => system.id === operatorSystem) ?? operatorSystems[0]
  const activeOperatorInput = operatorInputs[activeOperatorSystem.id]
  const operatorResults = useMemo(
    () => calculateOperatorResults(activeOperatorSystem.id, activeOperatorInput),
    [activeOperatorInput, activeOperatorSystem.id],
  )

  const algebraResult = useMemo(() => {
    if (!parsedVectors.first || !parsedVectors.second) {
      return {
        result: null,
        error: 'Enter valid components for both vectors.',
      }
    }

    return {
      result: getOperationResult(operation, parsedVectors.first, parsedVectors.second),
      error: '',
    }
  }, [operation, parsedVectors])

  function updateAngleUnit(nextUnit) {
    if (nextUnit === angleUnit) return

    setVectors((current) =>
      Object.fromEntries(
        Object.entries(current).map(([vectorId, vector]) => [
          vectorId,
          {
            ...vector,
            cylPhi: convertAngleInput(vector.cylPhi, angleUnit, nextUnit),
            sphTheta: convertAngleInput(vector.sphTheta, angleUnit, nextUnit),
            sphPhi: convertAngleInput(vector.sphPhi, angleUnit, nextUnit),
          },
        ]),
      ),
    )
    setCoordinateVector((current) => ({
      ...current,
      cylPhi: convertAngleInput(current.cylPhi, angleUnit, nextUnit),
      sphTheta: convertAngleInput(current.sphTheta, angleUnit, nextUnit),
      sphPhi: convertAngleInput(current.sphPhi, angleUnit, nextUnit),
    }))
    setAngleUnit(nextUnit)
  }

  function updateVectorField(vectorId, field, value) {
    setVectors((current) => ({
      ...current,
      [vectorId]: {
        ...current[vectorId],
        [field]: value,
      },
    }))
  }

  function updateVectorMode(vectorId, mode) {
    setVectors((current) => {
      const currentVector = current[vectorId]
      const parsedVector = parseVectorInput(currentVector, angleUnit)

      return {
        ...current,
        [vectorId]: {
          ...currentVector,
          mode,
          ...(parsedVector ? getFieldsForMode(parsedVector, mode, angleUnit) : {}),
        },
      }
    })
  }

  function updateCoordinateField(field, value) {
    setCoordinateVector((current) => ({ ...current, [field]: value }))
  }

  function updateCoordinateInputMode(mode) {
    setCoordinateVector((current) => {
      const parsedVector = parseVectorInput(current, angleUnit)

      return {
        ...current,
        mode,
        ...(parsedVector ? getFieldsForMode(parsedVector, mode, angleUnit) : {}),
      }
    })
  }

  function updateOperatorScalar(value) {
    setOperatorInputs((current) => ({
      ...current,
      [activeOperatorSystem.id]: {
        ...current[activeOperatorSystem.id],
        scalarField: value,
      },
    }))
  }

  function updateOperatorVectorField(index, value) {
    setOperatorInputs((current) => ({
      ...current,
      [activeOperatorSystem.id]: {
        ...current[activeOperatorSystem.id],
        vectorField: current[activeOperatorSystem.id].vectorField.map((field, fieldIndex) =>
          fieldIndex === index ? value : field,
        ),
      },
    }))
  }

  function loadExample() {
    setAngleUnit('deg')
    setVectors(createInitialVectors())
    setCoordinateVector(createVectorFields({ mode: 'spherical', sphR: '5', sphTheta: '40', sphPhi: '30' }))
    setCoordinateView('spherical')
    setOperation('cross')
    setOperatorInputs(createOperatorInputs())
    setOperatorSystem('rectangular')
  }

  function clearCalculator() {
    setVectors(createEmptyVectors())
    setCoordinateVector(createVectorFields())
    setCoordinateView('rectangular')
    setOperation('add')
  }

  function renderCoordinateControl(vectorId, vector) {
    return (
      <div className="segmented-control" role="group" aria-label={`${vectorLabels[vectorId].name} coordinates`}>
        {coordinateModes.map((mode) => (
          <button
            type="button"
            key={mode.id}
            className={vector.mode === mode.id ? 'is-active' : ''}
            onClick={() => updateVectorMode(vectorId, mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
    )
  }

  function renderVectorFields(vectorId) {
    const vector = vectors[vectorId]
    const label = vectorLabels[vectorId]
    const parsedVector = parsedVectors[vectorId]
    const vectorViews =
      parsedVector ? getVectorViews(parsedVector, angleUnit) : []

    return (
      <section className="vector-input-panel" key={vectorId}>
        <div className="complex-number-header">
          <div>
            <p className="eyebrow">{label.name}</p>
            <h3>{label.symbol}</h3>
          </div>
          <div className="vector-header-actions">
            {renderCoordinateControl(vectorId, vector)}
          </div>
        </div>

        {vector.mode === 'rectangular' && (
          <div className="complex-field-grid vector-field-grid">
            <label className="complex-field">
              <span>{label.symbol}_x</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.x}
                placeholder="3"
                onChange={(event) => updateVectorField(vectorId, 'x', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_y</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.y}
                placeholder="-2"
                onChange={(event) => updateVectorField(vectorId, 'y', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_z</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.z}
                placeholder="4"
                onChange={(event) => updateVectorField(vectorId, 'z', event.target.value)}
              />
            </label>
          </div>
        )}

        {vector.mode === 'cylindrical' && (
          <div className="complex-field-grid vector-field-grid">
            <label className="complex-field">
              <span>{label.symbol}_ρ</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.cylRho}
                placeholder="1.5"
                onChange={(event) => updateVectorField(vectorId, 'cylRho', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_φ ({angleUnit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.cylPhi}
                placeholder="2"
                onChange={(event) => updateVectorField(vectorId, 'cylPhi', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_z</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.cylZ}
                placeholder="-1"
                onChange={(event) => updateVectorField(vectorId, 'cylZ', event.target.value)}
              />
            </label>
          </div>
        )}

        {vector.mode === 'spherical' && (
          <div className="complex-field-grid vector-field-grid">
            <label className="complex-field">
              <span>{label.symbol}_r</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.sphR}
                placeholder="2"
                onChange={(event) => updateVectorField(vectorId, 'sphR', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_θ ({angleUnit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.sphTheta}
                placeholder="-1"
                onChange={(event) => updateVectorField(vectorId, 'sphTheta', event.target.value)}
              />
            </label>
            <label className="complex-field">
              <span>{label.symbol}_φ ({angleUnit})</span>
              <input
                type="number"
                inputMode="decimal"
                value={vector.sphPhi}
                placeholder="0.5"
                onChange={(event) => updateVectorField(vectorId, 'sphPhi', event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="vector-view-grid">
          {coordinateModes.map((mode) => {
            const view = vectorViews.find((candidate) => candidate.id === mode.id)

            return (
              <output key={mode.id}>
                <span>{mode.name}</span>
                <strong>{view ? formatCoordinateView(view) : '--'}</strong>
              </output>
            )
          })}
        </div>
      </section>
    )
  }

  function renderVectorResult(vector) {
    return (
      <div className="vector-result-views">
        {getVectorViews(vector, angleUnit).map((view) => (
          <output key={view.id}>
            <span>{view.label}</span>
            <strong>{formatCoordinateView(view)}</strong>
          </output>
        ))}
      </div>
    )
  }

  function renderCoordinateSystem() {
    const fieldSets = {
      rectangular: [
        { field: 'x', label: 'V_x', placeholder: '3' },
        { field: 'y', label: 'V_y', placeholder: '2' },
        { field: 'z', label: 'V_z', placeholder: '4' },
      ],
      cylindrical: [
        { field: 'cylRho', label: 'V_ρ', placeholder: '3.6' },
        { field: 'cylPhi', label: `V_φ (${angleUnit})`, placeholder: '34' },
        { field: 'cylZ', label: 'V_z', placeholder: '4' },
      ],
      spherical: [
        { field: 'sphR', label: 'V_r', placeholder: '5.4' },
        { field: 'sphTheta', label: `V_θ (${angleUnit})`, placeholder: '42' },
        { field: 'sphPhi', label: `V_φ (${angleUnit})`, placeholder: '34' },
      ],
    }
    const activeFields = fieldSets[coordinateVector.mode]
    const coordinateViews = parsedCoordinateVector
      ? getVectorViews(parsedCoordinateVector, angleUnit)
      : []

    return (
      <section className="vector-coordinate-panel" aria-labelledby="coordinate-system-title">
        <div className="vector-coordinate-header">
          <div>
            <p className="eyebrow">Coordinate system</p>
            <h3 id="coordinate-system-title">Visualize one vector</h3>
            <p className="coordinate-helper">Enter V in any coordinate format, then choose how to view it.</p>
          </div>
        </div>

        <div className="coordinate-workspace">
          <div className="coordinate-input-card">
            <div className="coordinate-control-group">
              <span>Input format</span>
              <div className="segmented-control" role="group" aria-label="Vector input coordinate system">
                {coordinateModes.map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    className={coordinateVector.mode === mode.id ? 'is-active' : ''}
                    onClick={() => updateCoordinateInputMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="complex-field-grid vector-field-grid coordinate-field-grid">
              {activeFields.map((field) => (
                <label className="complex-field" key={field.field}>
                  <span>{field.label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={coordinateVector[field.field]}
                    placeholder={field.placeholder}
                    onChange={(event) => updateCoordinateField(field.field, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="coordinate-conversion-list" aria-label="Equivalent coordinates">
              {coordinateModes.map((mode) => {
                const view = coordinateViews.find((candidate) => candidate.id === mode.id)

                return (
                  <output key={mode.id} className={coordinateView === mode.id ? 'is-active' : ''}>
                    <span>{mode.name}</span>
                    <strong>{view ? formatCoordinateView(view) : '--'}</strong>
                  </output>
                )
              })}
            </div>
          </div>

          <div className="coordinate-visual-card">
            <div className="coordinate-visual-header">
              <div>
                <span>Graphical view</span>
                <strong>{coordinateModes.find((mode) => mode.id === coordinateView)?.name}</strong>
              </div>
              <div className="segmented-control" role="group" aria-label="Graph coordinate system">
                {coordinateModes.map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    className={coordinateView === mode.id ? 'is-active' : ''}
                    onClick={() => setCoordinateView(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {parsedCoordinateVector ? (
              <CoordinatePlot vector={parsedCoordinateVector} mode={coordinateView} angleUnit={angleUnit} />
            ) : (
              <div className="coordinate-empty-state" role="status">Enter all three components to draw the vector.</div>
            )}
          </div>
        </div>
      </section>
    )
  }

  function renderAngleUnitControls() {
    return (
      <section className="vector-reference-panel" aria-label="Angle unit">
        <div>
          <p className="eyebrow">Angle unit</p>
          <h3>θ and φ</h3>
        </div>
        <div className="vector-reference-controls">
          <div className="unit-control">
            <span>Use for cylindrical and spherical angles</span>
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
      </section>
    )
  }

  function renderSymbolicMatrix(matrix, rowLabels, columnLabels) {
    const cells = [
      <div className="vector-tensor-cell vector-tensor-header" key="corner" aria-hidden="true" />,
      ...columnLabels.map((label) => (
        <div className="vector-tensor-cell vector-tensor-header" role="columnheader" key={`column-${label}`}>
          {label}
        </div>
      )),
    ]

    matrix.forEach((row, rowIndex) => {
      cells.push(
        <div
          className="vector-tensor-cell vector-tensor-header"
          role="rowheader"
          key={`row-${rowLabels[rowIndex]}`}
        >
          {rowLabels[rowIndex]}
        </div>,
      )

      row.forEach((entry, columnIndex) => {
        cells.push(
          <div
            className="vector-tensor-cell vector-tensor-entry"
            role="cell"
            key={`${rowIndex}-${columnIndex}`}
          >
            {formatSymbolicExpression(entry)}
          </div>,
        )
      })
    })

    return (
      <div className="vector-tensor-table" role="table" aria-label="Gradient of A">
        {cells}
      </div>
    )
  }

  function renderSymbolicVector(components, basis) {
    return formatSymbolicVector(components, basis)
  }

  return (
    <section className="tool-panel vector-panel" aria-labelledby="vector-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Electromagnetics</p>
          <h2 id="vector-title">Vector calculator</h2>
          <p className="tool-description">{description}</p>
        </div>
      </div>

      <div className="vector-layout">
        {renderAngleUnitControls()}

        {renderCoordinateSystem()}

        <div className="vector-inputs">{vectorIds.map(renderVectorFields)}</div>

        <section className="vector-operation-panel" aria-label="Vector algebra result">
          <div className="complex-operation-header">
            <div>
              <p className="eyebrow">Vector algebra</p>
              <h3>{activeOperation.resultLabel}</h3>
            </div>
            <div className="operation-controls vector-operation-controls" role="group" aria-label="Operation">
              {vectorOperations.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={operation === candidate.id ? 'is-active' : ''}
                  aria-label={candidate.name}
                  onClick={() => setOperation(candidate.id)}
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </div>

          {algebraResult.error ? (
            <p className="message error">{algebraResult.error}</p>
          ) : algebraResult.result.type === 'scalar' ? (
            <div className="vector-scalar-result">
              <output>
                <span>Answer</span>
                <strong>{formatScalar(algebraResult.result.value)}</strong>
              </output>
            </div>
          ) : (
            renderVectorResult(algebraResult.result.value)
          )}
        </section>

        <section className="vector-operator-panel" aria-label="Gradient, divergence, curl, and del squared">
          <div className="vector-operator-header">
            <div>
              <p className="eyebrow">Operators</p>
              <h3>Grad, div, curl, del^2</h3>
            </div>
            <div className="segmented-control" role="group" aria-label="Operator coordinate system">
              {operatorSystems.map((system) => (
                <button
                  type="button"
                  key={system.id}
                  className={operatorSystem === system.id ? 'is-active' : ''}
                  onClick={() => setOperatorSystem(system.id)}
                >
                  {system.label}
                </button>
              ))}
            </div>
          </div>

          <div className="vector-operator-grid">
            <label className="complex-field vector-scalar-field">
              <span>Scalar potential V({activeOperatorSystem.variables.join(', ')})</span>
              <input
                type="text"
                inputMode="text"
                value={activeOperatorInput.scalarField}
                spellCheck="false"
                onChange={(event) => updateOperatorScalar(event.target.value)}
              />
            </label>

            {activeOperatorSystem.fieldLabels.map((label, index) => (
              <label className="complex-field" key={label}>
                <span>{label}</span>
                <input
                  type="text"
                  inputMode="text"
                  value={activeOperatorInput.vectorField[index]}
                  spellCheck="false"
                  onChange={(event) => updateOperatorVectorField(index, event.target.value)}
                />
              </label>
            ))}
          </div>

          {operatorResults.error ? (
            <p className="message error">{operatorResults.error}</p>
          ) : (
            <div className="vector-symbolic-results">
              <output>
                <span>grad V</span>
                <strong>
                  {renderSymbolicVector(operatorResults.gradient, activeOperatorSystem.basis)}
                </strong>
              </output>

              <output className="vector-tensor-output">
                <span>grad A</span>
                {renderSymbolicMatrix(
                  operatorResults.vectorGradient,
                  activeOperatorSystem.basis,
                  activeOperatorSystem.fieldLabels,
                )}
              </output>

              <output>
                <span>div A</span>
                <strong>{formatSymbolicExpression(operatorResults.divergence)}</strong>
              </output>

              <output>
                <span>curl A</span>
                <strong>{renderSymbolicVector(operatorResults.curl, activeOperatorSystem.basis)}</strong>
              </output>

              <output>
                <span>del^2 V</span>
                <strong>{formatSymbolicExpression(operatorResults.scalarLaplacian)}</strong>
              </output>
            </div>
          )}
        </section>
      </div>

      <div className="actions">
        <button type="button" onClick={loadExample}>
          Example
        </button>
        <button type="button" onClick={clearCalculator}>
          Clear
        </button>
      </div>
    </section>
  )
}
