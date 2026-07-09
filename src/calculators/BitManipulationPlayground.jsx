import { useMemo, useState } from 'react'

const registerWidths = [8, 16, 32]

const modes = [
  { id: 'bit', label: 'Bit level' },
  { id: 'register', label: 'Register update' },
]

const bitOperations = [
  { id: 'set', label: 'Set' },
  { id: 'clear', label: 'Clear' },
  { id: 'toggle', label: 'Toggle' },
  { id: 'read', label: 'Read' },
  { id: 'shift', label: 'Shift' },
]

const registerOperations = [
  { id: 'read', label: 'Read field' },
  { id: 'write', label: 'Write field' },
]

const shiftDirections = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const operatorReference = [
  { symbol: '&', label: 'AND' },
  { symbol: '|', label: 'OR' },
  { symbol: '^', label: 'XOR' },
  { symbol: '~', label: 'NOT' },
  { symbol: '<<', label: 'Left shift' },
  { symbol: '>>', label: 'Right shift' },
]

function parseUnsignedInteger(input) {
  const cleanedInput = input.trim().replace(/_/g, '')

  if (!cleanedInput) return null

  const isHex = /^0x[0-9a-f]+$/i.test(cleanedInput)
  const isBinary = /^0b[01]+$/i.test(cleanedInput)
  const isDecimal = /^\d+$/.test(cleanedInput)

  if (!isHex && !isBinary && !isDecimal) return null

  try {
    return BigInt(cleanedInput)
  } catch {
    return null
  }
}

function parseWholeNumber(input) {
  if (input.trim() === '') return null

  const value = Number(input)

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null

  return value
}

function getWidthMask(width) {
  return (1n << BigInt(width)) - 1n
}

function clampToWidth(value, width) {
  return value & getWidthMask(width)
}

function formatHex(value, width) {
  const hexDigits = Math.ceil(width / 4)
  return `0x${clampToWidth(value, width).toString(16).toUpperCase().padStart(hexDigits, '0')}`
}

function formatBinary(value, width) {
  return clampToWidth(value, width)
    .toString(2)
    .padStart(width, '0')
    .replace(/(.{4})(?=.)/g, '$1 ')
}

function getChangedBits(before, after, width) {
  const changed = clampToWidth(before ^ after, width)

  return Array.from({ length: width }, (_, bit) => bit).filter(
    (bit) => ((changed >> BigInt(bit)) & 1n) === 1n,
  )
}

function getRangeBits(startBit, endBit) {
  return Array.from(
    { length: endBit - startBit + 1 },
    (_, index) => startBit + index,
  )
}

function getFieldMask(startBit, endBit) {
  const fieldWidth = endBit - startBit + 1
  return ((1n << BigInt(fieldWidth)) - 1n) << BigInt(startBit)
}

function clampPosition(position, width) {
  return Math.min(width - 1, Math.max(0, position))
}

function BitRow({
  label,
  note = '',
  value,
  width,
  highlightBits = [],
  maskBits = [],
  changedBits = [],
}) {
  const normalizedValue = clampToWidth(value, width)
  const highlightSet = new Set(highlightBits)
  const maskSet = new Set(maskBits)
  const changedSet = new Set(changedBits)
  const bitIndexes = Array.from({ length: width }, (_, index) => width - index - 1)

  return (
    <div className="bit-row-shell">
      <div className="bit-row-heading">
        <span>{label}</span>
        {note && <code>{note}</code>}
      </div>
      <div className="bit-row-scroll">
        <div className="bit-row" style={{ '--register-width': width }}>
          {bitIndexes.map((bit) => {
            const bitValue = Number((normalizedValue >> BigInt(bit)) & 1n)
            const classNames = [
              'bit-cell',
              bitValue === 1 ? 'is-one' : '',
              highlightSet.has(bit) ? 'is-target' : '',
              maskSet.has(bit) ? 'is-mask' : '',
              changedSet.has(bit) ? 'is-changed' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <span
                className={classNames}
                key={bit}
                aria-label={`Bit ${bit} is ${bitValue}`}
              >
                <small>{bit}</small>
                <strong>{bitValue}</strong>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function createError(message) {
  return {
    error: message,
    title: 'Input check',
    code: '',
    result: 0n,
    resultLabel: 'Result',
    resultText: '--',
    changedBits: [],
    highlightBits: [],
    maskBits: [],
    maskText: '',
    canApply: false,
  }
}

export default function BitManipulationPlayground() {
  const [mode, setMode] = useState('bit')
  const [width, setWidth] = useState(8)
  const [registerName, setRegisterName] = useState('PORTA')
  const [registerValue, setRegisterValue] = useState('0b00101101')
  const [bitIndex, setBitIndex] = useState(3)
  const [bitOperation, setBitOperation] = useState('set')
  const [shiftAmount, setShiftAmount] = useState('1')
  const [shiftDirection, setShiftDirection] = useState('left')
  const [fieldStart, setFieldStart] = useState(2)
  const [fieldEnd, setFieldEnd] = useState(5)
  const [fieldValue, setFieldValue] = useState('0b1010')
  const [registerOperation, setRegisterOperation] = useState('read')

  const parsedRegisterValue = useMemo(
    () => parseUnsignedInteger(registerValue),
    [registerValue],
  )
  const parsedShiftAmount = useMemo(() => parseWholeNumber(shiftAmount), [shiftAmount])
  const parsedFieldValue = useMemo(() => parseUnsignedInteger(fieldValue), [fieldValue])
  const normalizedRegisterValue =
    parsedRegisterValue === null ? null : clampToWidth(parsedRegisterValue, width)
  const registerLabel = registerName.trim() || 'PORTA'
  const bitPositions = Array.from({ length: width }, (_, index) => index)

  const operationPreview = useMemo(() => {
    if (normalizedRegisterValue === null) {
      return createError('Register value must be decimal, 0x hex, or 0b binary.')
    }

    if (mode === 'bit') {
      const bitMask = 1n << BigInt(bitIndex)
      const maskBits = bitOperation === 'shift' ? [] : [bitIndex]

      if (bitOperation === 'set') {
        const result = clampToWidth(normalizedRegisterValue | bitMask, width)

        return {
          error: '',
          title: `Set bit ${bitIndex}`,
          code: `${registerLabel} = ${registerLabel} | (1 << ${bitIndex});`,
          result,
          resultLabel: 'New value',
          resultText: formatHex(result, width),
          changedBits: getChangedBits(normalizedRegisterValue, result, width),
          highlightBits: [bitIndex],
          maskBits,
          maskText: formatHex(bitMask, width),
          canApply: true,
        }
      }

      if (bitOperation === 'clear') {
        const result = clampToWidth(normalizedRegisterValue & ~bitMask, width)

        return {
          error: '',
          title: `Clear bit ${bitIndex}`,
          code: `${registerLabel} = ${registerLabel} & ~(1 << ${bitIndex});`,
          result,
          resultLabel: 'New value',
          resultText: formatHex(result, width),
          changedBits: getChangedBits(normalizedRegisterValue, result, width),
          highlightBits: [bitIndex],
          maskBits,
          maskText: formatHex(bitMask, width),
          canApply: true,
        }
      }

      if (bitOperation === 'toggle') {
        const result = clampToWidth(normalizedRegisterValue ^ bitMask, width)

        return {
          error: '',
          title: `Toggle bit ${bitIndex}`,
          code: `${registerLabel} = ${registerLabel} ^ (1 << ${bitIndex});`,
          result,
          resultLabel: 'New value',
          resultText: formatHex(result, width),
          changedBits: getChangedBits(normalizedRegisterValue, result, width),
          highlightBits: [bitIndex],
          maskBits,
          maskText: formatHex(bitMask, width),
          canApply: true,
        }
      }

      if (bitOperation === 'read') {
        const readValue = (normalizedRegisterValue & bitMask) >> BigInt(bitIndex)

        return {
          error: '',
          title: `Read bit ${bitIndex}`,
          code: `bit = (${registerLabel} & (1 << ${bitIndex})) >> ${bitIndex};`,
          result: normalizedRegisterValue,
          resultLabel: 'Read value',
          resultText: readValue.toString(),
          changedBits: [],
          highlightBits: [bitIndex],
          maskBits,
          maskText: formatHex(bitMask, width),
          canApply: false,
        }
      }

      if (parsedShiftAmount === null) {
        return createError('Shift amount must be a whole number.')
      }

      const amount = Math.min(parsedShiftAmount, width)
      const operator = shiftDirection === 'left' ? '<<' : '>>'
      const result =
        shiftDirection === 'left'
          ? clampToWidth(normalizedRegisterValue << BigInt(amount), width)
          : clampToWidth(normalizedRegisterValue >> BigInt(amount), width)

      return {
        error: '',
        title: `Shift ${shiftDirection}`,
        code: `${registerLabel} = ${registerLabel} ${operator} ${amount};`,
        result,
        resultLabel: 'New value',
        resultText: formatHex(result, width),
        changedBits: getChangedBits(normalizedRegisterValue, result, width),
        highlightBits: [],
        maskBits: [],
        maskText: '',
        canApply: true,
      }
    }

    if (fieldStart > fieldEnd) {
      return createError('End bit must be greater than or equal to start bit.')
    }

    const fieldWidth = fieldEnd - fieldStart + 1
    const fieldMask = getFieldMask(fieldStart, fieldEnd)
    const fieldBits = getRangeBits(fieldStart, fieldEnd)

    if (registerOperation === 'read') {
      const readValue = (normalizedRegisterValue & fieldMask) >> BigInt(fieldStart)

      return {
        error: '',
        title: `Read bits ${fieldStart} to ${fieldEnd}`,
        code: [
          `mask = ((1 << ${fieldWidth}) - 1) << ${fieldStart};`,
          `field = (${registerLabel} & mask) >> ${fieldStart};`,
        ].join('\n'),
        result: normalizedRegisterValue,
        resultLabel: 'Field value',
        resultText: `${readValue.toString()} (${formatHex(readValue, fieldWidth)})`,
        changedBits: [],
        highlightBits: fieldBits,
        maskBits: fieldBits,
        maskText: formatHex(fieldMask, width),
        canApply: false,
      }
    }

    if (parsedFieldValue === null) {
      return createError('Field value must be decimal, 0x hex, or 0b binary.')
    }

    const maxFieldValue = (1n << BigInt(fieldWidth)) - 1n

    if (parsedFieldValue > maxFieldValue) {
      return createError(`Field value must fit in ${fieldWidth} bit${fieldWidth === 1 ? '' : 's'}.`)
    }

    const shiftedFieldValue = (parsedFieldValue << BigInt(fieldStart)) & fieldMask
    const result = clampToWidth((normalizedRegisterValue & ~fieldMask) | shiftedFieldValue, width)
    const fieldCodeValue = fieldValue.trim() || 'value'

    return {
      error: '',
      title: `Write bits ${fieldStart} to ${fieldEnd}`,
      code: [
        `mask = ((1 << ${fieldWidth}) - 1) << ${fieldStart};`,
        `${registerLabel} = (${registerLabel} & ~mask) | ((${fieldCodeValue} << ${fieldStart}) & mask);`,
      ].join('\n'),
      result,
      resultLabel: 'New value',
      resultText: formatHex(result, width),
      changedBits: getChangedBits(normalizedRegisterValue, result, width),
      highlightBits: fieldBits,
      maskBits: fieldBits,
      maskText: formatHex(fieldMask, width),
      canApply: true,
    }
  }, [
    bitIndex,
    bitOperation,
    fieldEnd,
    fieldStart,
    fieldValue,
    mode,
    normalizedRegisterValue,
    parsedFieldValue,
    parsedShiftAmount,
    registerLabel,
    registerOperation,
    shiftDirection,
    width,
  ])

  function updateWidth(nextWidth) {
    const numericWidth = Number(nextWidth)

    if (!registerWidths.includes(numericWidth)) return

    setWidth(numericWidth)
    setBitIndex((current) => clampPosition(current, numericWidth))
    setFieldStart((current) => clampPosition(current, numericWidth))
    setFieldEnd((current) => clampPosition(current, numericWidth))
  }

  function applyPreviewResult() {
    if (!operationPreview.canApply || operationPreview.error) return

    setRegisterValue(formatHex(operationPreview.result, width))
  }

  function loadExample() {
    setMode('bit')
    setWidth(8)
    setRegisterName('PORTA')
    setRegisterValue('0b00101101')
    setBitIndex(3)
    setBitOperation('set')
    setShiftAmount('1')
    setShiftDirection('left')
    setFieldStart(2)
    setFieldEnd(5)
    setFieldValue('0b1010')
    setRegisterOperation('read')
  }

  function resetPlayground() {
    setMode('bit')
    setWidth(8)
    setRegisterName('PORTA')
    setRegisterValue('0')
    setBitIndex(0)
    setBitOperation('set')
    setShiftAmount('1')
    setShiftDirection('left')
    setFieldStart(0)
    setFieldEnd(3)
    setFieldValue('0')
    setRegisterOperation('read')
  }

  return (
    <section className="tool-panel bit-panel" aria-labelledby="bit-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Digital logic</p>
          <h2 id="bit-title">Bit manipulation playground</h2>
        </div>
        <label className="size-control">
          <span>Register width</span>
          <select value={width} onChange={(event) => updateWidth(event.target.value)}>
            {registerWidths.map((registerWidth) => (
              <option value={registerWidth} key={registerWidth}>
                {registerWidth} bit
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bit-mode-bar">
        <div className="segmented-control" role="group" aria-label="Bit manipulation mode">
          {modes.map((modeOption) => (
            <button
              type="button"
              key={modeOption.id}
              className={mode === modeOption.id ? 'is-active' : ''}
              onClick={() => setMode(modeOption.id)}
            >
              {modeOption.label}
            </button>
          ))}
        </div>

        <div className="bit-operator-strip" aria-label="Bitwise operators">
          {operatorReference.map((operator) => (
            <span key={operator.symbol}>
              <strong>{operator.symbol}</strong>
              {operator.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bit-layout">
        <section className="bit-controls" aria-label="Bit controls">
          <div className="bit-control-grid">
            <label className="complex-field">
              <span>Register name</span>
              <input
                type="text"
                value={registerName}
                placeholder="PORTA"
                onChange={(event) => setRegisterName(event.target.value)}
              />
            </label>

            <label className="complex-field">
              <span>Register value</span>
              <input
                type="text"
                inputMode="text"
                value={registerValue}
                placeholder="0x2D"
                onChange={(event) => setRegisterValue(event.target.value)}
              />
            </label>
          </div>

          {mode === 'bit' ? (
            <>
              <div className="unit-control bit-operation-control">
                <span>Operation</span>
                <div className="segmented-control" role="group" aria-label="Bit operation">
                  {bitOperations.map((operation) => (
                    <button
                      type="button"
                      key={operation.id}
                      className={bitOperation === operation.id ? 'is-active' : ''}
                      onClick={() => setBitOperation(operation.id)}
                    >
                      {operation.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bit-control-grid bit-input-grid">
                <label className="complex-field">
                  <span>Bit position</span>
                  <select
                    value={bitIndex}
                    onChange={(event) => setBitIndex(Number(event.target.value))}
                  >
                    {bitPositions.map((position) => (
                      <option value={position} key={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>

                {bitOperation === 'shift' && (
                  <>
                    <label className="complex-field">
                      <span>Shift amount</span>
                      <input
                        type="number"
                        min="0"
                        value={shiftAmount}
                        onChange={(event) => setShiftAmount(event.target.value)}
                      />
                    </label>

                    <div className="unit-control">
                      <span>Direction</span>
                      <div className="segmented-control" role="group" aria-label="Shift direction">
                        {shiftDirections.map((direction) => (
                          <button
                            type="button"
                            key={direction.id}
                            className={shiftDirection === direction.id ? 'is-active' : ''}
                            onClick={() => setShiftDirection(direction.id)}
                          >
                            {direction.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="unit-control bit-operation-control">
                <span>Operation</span>
                <div className="segmented-control" role="group" aria-label="Register field operation">
                  {registerOperations.map((operation) => (
                    <button
                      type="button"
                      key={operation.id}
                      className={registerOperation === operation.id ? 'is-active' : ''}
                      onClick={() => setRegisterOperation(operation.id)}
                    >
                      {operation.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bit-control-grid bit-input-grid">
                <label className="complex-field">
                  <span>Start bit</span>
                  <select
                    value={fieldStart}
                    onChange={(event) => setFieldStart(Number(event.target.value))}
                  >
                    {bitPositions.map((position) => (
                      <option value={position} key={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="complex-field">
                  <span>End bit</span>
                  <select
                    value={fieldEnd}
                    onChange={(event) => setFieldEnd(Number(event.target.value))}
                  >
                    {bitPositions.map((position) => (
                      <option value={position} key={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>

                {registerOperation === 'write' && (
                  <label className="complex-field bit-field-value">
                    <span>Field value</span>
                    <input
                      type="text"
                      inputMode="text"
                      value={fieldValue}
                      placeholder="0b1010"
                      onChange={(event) => setFieldValue(event.target.value)}
                    />
                  </label>
                )}
              </div>
            </>
          )}

          <div className="actions">
            <button
              type="button"
              className="primary-button"
              disabled={!operationPreview.canApply || Boolean(operationPreview.error)}
              onClick={applyPreviewResult}
            >
              Apply
            </button>
            <button type="button" onClick={loadExample}>
              Example
            </button>
            <button type="button" onClick={resetPlayground}>
              Reset
            </button>
          </div>
        </section>

        <section
          className={`bit-code-card ${operationPreview.error ? 'has-error' : ''}`}
          aria-label="Generated bitwise code"
          aria-live="polite"
        >
          <div>
            <p className="eyebrow">Code</p>
            <h3>{operationPreview.title}</h3>
          </div>

          {operationPreview.error ? (
            <p className="message error">{operationPreview.error}</p>
          ) : (
            <>
              <pre>
                <code>{operationPreview.code}</code>
              </pre>

              <div className="bit-result-grid">
                <output>
                  <span>{operationPreview.resultLabel}</span>
                  <strong>{operationPreview.resultText}</strong>
                </output>
                {operationPreview.maskText && (
                  <output>
                    <span>Mask</span>
                    <strong>{operationPreview.maskText}</strong>
                  </output>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="bit-register-card" aria-label="Register preview">
        <div className="bit-register-header">
          <div>
            <p className="eyebrow">Register</p>
            <h3>{registerLabel}</h3>
          </div>
          <div className="bit-value-grid">
            <output>
              <span>Hex</span>
              <strong>
                {normalizedRegisterValue === null ? '--' : formatHex(normalizedRegisterValue, width)}
              </strong>
            </output>
            <output>
              <span>Decimal</span>
              <strong>
                {normalizedRegisterValue === null
                  ? '--'
                  : normalizedRegisterValue.toString(10)}
              </strong>
            </output>
          </div>
        </div>

        {normalizedRegisterValue === null ? (
          <p className="message error">Register value must be decimal, 0x hex, or 0b binary.</p>
        ) : (
          <>
            <BitRow
              label="Current bits"
              note={formatBinary(normalizedRegisterValue, width)}
              value={normalizedRegisterValue}
              width={width}
              highlightBits={operationPreview.highlightBits}
              maskBits={operationPreview.maskBits}
            />

            {!operationPreview.error && (
              <BitRow
                label={operationPreview.canApply ? 'Result bits' : 'Read preview'}
                note={formatBinary(operationPreview.result, width)}
                value={operationPreview.result}
                width={width}
                highlightBits={operationPreview.highlightBits}
                maskBits={operationPreview.maskBits}
                changedBits={operationPreview.changedBits}
              />
            )}
          </>
        )}
      </section>
    </section>
  )
}
