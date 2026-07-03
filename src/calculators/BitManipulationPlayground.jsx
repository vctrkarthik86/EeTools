import { useMemo, useState } from 'react'

const registerWidths = [8, 16, 32]

const operationButtons = [
  { id: 'set', label: 'Set bit' },
  { id: 'clear', label: 'Clear bit' },
  { id: 'toggle', label: 'Toggle bit' },
  { id: 'read', label: 'Read bit' },
  { id: 'mask', label: 'Mask' },
  { id: 'shift', label: 'Shift' },
  { id: 'rotate', label: 'Rotate' },
]

const directionLabels = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
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

  if (!Number.isFinite(value) || !Number.isInteger(value)) return null

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

function getMaskBits(mask, width) {
  const normalizedMask = clampToWidth(mask, width)

  return Array.from({ length: width }, (_, bit) => bit).filter(
    (bit) => ((normalizedMask >> BigInt(bit)) & 1n) === 1n,
  )
}

function createStep(title, expression, value, options = {}) {
  return {
    title,
    expression,
    value,
    changedBits: options.changedBits ?? [],
    highlightBits: options.highlightBits ?? [],
    maskBits: options.maskBits ?? [],
    note: options.note ?? '',
  }
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

function StepCard({ step, width, index }) {
  return (
    <article className="bit-step">
      <div className="bit-step-copy">
        <span>Step {index + 1}</span>
        <h4>{step.title}</h4>
        <code>{step.expression}</code>
      </div>
      <BitRow
        label={step.title}
        note={step.note}
        value={step.value}
        width={width}
        highlightBits={step.highlightBits}
        maskBits={step.maskBits}
        changedBits={step.changedBits}
      />
    </article>
  )
}

export default function BitManipulationPlayground() {
  const [address, setAddress] = useState('0x40021000')
  const [width, setWidth] = useState(8)
  const [registerValue, setRegisterValue] = useState('0b00101101')
  const [bitIndex, setBitIndex] = useState('2')
  const [maskInput, setMaskInput] = useState('0xF0')
  const [moveAmount, setMoveAmount] = useState('1')
  const [moveDirection, setMoveDirection] = useState('left')
  const [lastOperation, setLastOperation] = useState(null)

  const parsedRegisterValue = useMemo(
    () => parseUnsignedInteger(registerValue),
    [registerValue],
  )
  const parsedMaskValue = useMemo(() => parseUnsignedInteger(maskInput), [maskInput])

  const normalizedRegisterValue =
    parsedRegisterValue === null ? null : clampToWidth(parsedRegisterValue, width)
  const normalizedMaskValue =
    parsedMaskValue === null ? null : clampToWidth(parsedMaskValue, width)
  const parsedBitIndex = parseWholeNumber(bitIndex)
  const parsedMoveAmount = parseWholeNumber(moveAmount)
  const registerAddress = address.trim() || 'selected register'
  const targetBits =
    parsedBitIndex !== null && parsedBitIndex >= 0 && parsedBitIndex < width
      ? [parsedBitIndex]
      : []
  const activeMaskBits = normalizedMaskValue === null ? [] : getMaskBits(normalizedMaskValue, width)
  const currentValue = normalizedRegisterValue ?? 0n

  const visibleOperation =
    lastOperation ??
    (normalizedRegisterValue === null
      ? {
          title: 'Register value',
          summary: 'Enter a valid unsigned value in decimal, hex, or binary.',
          resultText: '--',
          error: true,
          steps: [],
        }
      : {
          title: 'Register loaded',
          summary: `${registerAddress} is ${formatHex(currentValue, width)}.`,
          resultText: formatBinary(currentValue, width),
          error: false,
          steps: [
            createStep('Loaded register', `${registerAddress} = ${formatHex(currentValue, width)}`, currentValue, {
              highlightBits: targetBits,
              maskBits: activeMaskBits,
            }),
          ],
        })

  function clearOperation() {
    setLastOperation(null)
  }

  function updateWidth(nextWidth) {
    const numericWidth = Number(nextWidth)

    if (!registerWidths.includes(numericWidth)) return

    setWidth(numericWidth)
    setBitIndex((currentBitIndex) => {
      const currentBit = parseWholeNumber(currentBitIndex)
      return currentBit !== null && currentBit >= 0 && currentBit < numericWidth
        ? currentBitIndex
        : String(numericWidth - 1)
    })
    clearOperation()
  }

  function setOperationError(message) {
    setLastOperation({
      title: 'Input check',
      summary: message,
      resultText: 'No change',
      error: true,
      steps: [],
    })
  }

  function getOperationBase() {
    if (normalizedRegisterValue === null) {
      setOperationError('Enter a valid register value before running an operation.')
      return null
    }

    return normalizedRegisterValue
  }

  function getBitOperationInput() {
    const base = getOperationBase()

    if (base === null) return null

    if (parsedBitIndex === null || parsedBitIndex < 0 || parsedBitIndex >= width) {
      setOperationError(`Bit index must be between 0 and ${width - 1}.`)
      return null
    }

    const bitMask = 1n << BigInt(parsedBitIndex)

    return {
      base,
      bit: parsedBitIndex,
      bitMask,
    }
  }

  function getMoveInput() {
    const base = getOperationBase()

    if (base === null) return null

    if (parsedMoveAmount === null || parsedMoveAmount < 0) {
      setOperationError('Shift and rotate amount must be a whole number of bits.')
      return null
    }

    return {
      base,
      amount: parsedMoveAmount,
    }
  }

  function applyResult(operation, result, shouldUpdateRegister = true) {
    setLastOperation(operation)

    if (shouldUpdateRegister) {
      setRegisterValue(formatHex(result, width))
    }
  }

  function runSetBit() {
    const input = getBitOperationInput()

    if (!input) return

    const result = clampToWidth(input.base | input.bitMask, width)
    const changedBits = getChangedBits(input.base, result, width)

    applyResult(
      {
        title: 'Set bit',
        summary: `Bit ${input.bit} is now 1 at ${registerAddress}.`,
        resultText: `${formatHex(result, width)} = ${formatBinary(result, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base, {
            highlightBits: [input.bit],
          }),
          createStep('Bit mask', `1 << ${input.bit} = ${formatHex(input.bitMask, width)}`, input.bitMask, {
            highlightBits: [input.bit],
            maskBits: [input.bit],
          }),
          createStep(
            'OR result',
            `${formatHex(input.base, width)} | ${formatHex(input.bitMask, width)} = ${formatHex(result, width)}`,
            result,
            {
              changedBits,
              highlightBits: [input.bit],
            },
          ),
        ],
      },
      result,
    )
  }

  function runClearBit() {
    const input = getBitOperationInput()

    if (!input) return

    const keepMask = getWidthMask(width) ^ input.bitMask
    const result = clampToWidth(input.base & keepMask, width)
    const changedBits = getChangedBits(input.base, result, width)

    applyResult(
      {
        title: 'Clear bit',
        summary: `Bit ${input.bit} is now 0 at ${registerAddress}.`,
        resultText: `${formatHex(result, width)} = ${formatBinary(result, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base, {
            highlightBits: [input.bit],
          }),
          createStep('Bit mask', `1 << ${input.bit} = ${formatHex(input.bitMask, width)}`, input.bitMask, {
            highlightBits: [input.bit],
            maskBits: [input.bit],
          }),
          createStep('Clear mask', `~${formatHex(input.bitMask, width)} = ${formatHex(keepMask, width)}`, keepMask, {
            highlightBits: [input.bit],
            maskBits: getMaskBits(keepMask, width),
          }),
          createStep(
            'AND result',
            `${formatHex(input.base, width)} & ${formatHex(keepMask, width)} = ${formatHex(result, width)}`,
            result,
            {
              changedBits,
              highlightBits: [input.bit],
            },
          ),
        ],
      },
      result,
    )
  }

  function runToggleBit() {
    const input = getBitOperationInput()

    if (!input) return

    const result = clampToWidth(input.base ^ input.bitMask, width)
    const changedBits = getChangedBits(input.base, result, width)

    applyResult(
      {
        title: 'Toggle bit',
        summary: `Bit ${input.bit} flipped at ${registerAddress}.`,
        resultText: `${formatHex(result, width)} = ${formatBinary(result, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base, {
            highlightBits: [input.bit],
          }),
          createStep('Bit mask', `1 << ${input.bit} = ${formatHex(input.bitMask, width)}`, input.bitMask, {
            highlightBits: [input.bit],
            maskBits: [input.bit],
          }),
          createStep(
            'XOR result',
            `${formatHex(input.base, width)} ^ ${formatHex(input.bitMask, width)} = ${formatHex(result, width)}`,
            result,
            {
              changedBits,
              highlightBits: [input.bit],
            },
          ),
        ],
      },
      result,
    )
  }

  function runReadBit() {
    const input = getBitOperationInput()

    if (!input) return

    const isolatedValue = clampToWidth(input.base & input.bitMask, width)
    const readValue = isolatedValue >> BigInt(input.bit)

    applyResult(
      {
        title: 'Read bit',
        summary: `Bit ${input.bit} reads ${readValue.toString()} at ${registerAddress}.`,
        resultText: `bit ${input.bit} = ${readValue.toString()}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base, {
            highlightBits: [input.bit],
          }),
          createStep('Bit mask', `1 << ${input.bit} = ${formatHex(input.bitMask, width)}`, input.bitMask, {
            highlightBits: [input.bit],
            maskBits: [input.bit],
          }),
          createStep(
            'Isolate bit',
            `${formatHex(input.base, width)} & ${formatHex(input.bitMask, width)} = ${formatHex(isolatedValue, width)}`,
            isolatedValue,
            {
              highlightBits: [input.bit],
              maskBits: [input.bit],
            },
          ),
          createStep('Shift down', `${formatHex(isolatedValue, width)} >> ${input.bit} = ${readValue.toString()}`, readValue, {
            highlightBits: [0],
          }),
        ],
      },
      input.base,
      false,
    )
  }

  function runMask() {
    const base = getOperationBase()

    if (base === null) return

    if (normalizedMaskValue === null) {
      setOperationError('Enter a valid mask in decimal, hex, or binary.')
      return
    }

    const result = clampToWidth(base & normalizedMaskValue, width)
    const changedBits = getChangedBits(base, result, width)
    const maskBits = getMaskBits(normalizedMaskValue, width)

    applyResult(
      {
        title: 'Mask',
        summary: `Mask ${formatHex(normalizedMaskValue, width)} applied at ${registerAddress}.`,
        resultText: `${formatHex(result, width)} = ${formatBinary(result, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(base, width)}`, base, {
            maskBits,
          }),
          createStep('Mask value', `mask = ${formatHex(normalizedMaskValue, width)}`, normalizedMaskValue, {
            maskBits,
          }),
          createStep(
            'AND result',
            `${formatHex(base, width)} & ${formatHex(normalizedMaskValue, width)} = ${formatHex(result, width)}`,
            result,
            {
              changedBits,
              maskBits,
            },
          ),
        ],
      },
      result,
    )
  }

  function runShift() {
    const input = getMoveInput()

    if (!input) return

    const amount = Math.min(input.amount, width)
    const shiftedValue =
      moveDirection === 'left'
        ? clampToWidth(input.base << BigInt(amount), width)
        : clampToWidth(input.base >> BigInt(amount), width)
    const changedBits = getChangedBits(input.base, shiftedValue, width)
    const operator = moveDirection === 'left' ? '<<' : '>>'

    applyResult(
      {
        title: 'Shift',
        summary: `${registerAddress} shifted ${moveDirection} by ${amount} bit${amount === 1 ? '' : 's'}.`,
        resultText: `${formatHex(shiftedValue, width)} = ${formatBinary(shiftedValue, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base),
          createStep(
            'Shift result',
            `${formatHex(input.base, width)} ${operator} ${amount} = ${formatHex(shiftedValue, width)}`,
            shiftedValue,
            {
              changedBits,
            },
          ),
        ],
      },
      shiftedValue,
    )
  }

  function runRotate() {
    const input = getMoveInput()

    if (!input) return

    const amount = input.amount % width
    const wrapDistance = width - amount
    const shiftedValue =
      moveDirection === 'left'
        ? clampToWidth(input.base << BigInt(amount), width)
        : clampToWidth(input.base >> BigInt(amount), width)
    const wrappedValue =
      amount === 0
        ? 0n
        : moveDirection === 'left'
          ? clampToWidth(input.base >> BigInt(wrapDistance), width)
          : clampToWidth(input.base << BigInt(wrapDistance), width)
    const rotatedValue = clampToWidth(shiftedValue | wrappedValue, width)
    const changedBits = getChangedBits(input.base, rotatedValue, width)
    const shiftOperator = moveDirection === 'left' ? '<<' : '>>'
    const wrapOperator = moveDirection === 'left' ? '>>' : '<<'

    applyResult(
      {
        title: 'Rotate',
        summary: `${registerAddress} rotated ${moveDirection} by ${amount} bit${amount === 1 ? '' : 's'}.`,
        resultText: `${formatHex(rotatedValue, width)} = ${formatBinary(rotatedValue, width)}`,
        error: false,
        steps: [
          createStep('Before', `${registerAddress} = ${formatHex(input.base, width)}`, input.base),
          createStep(
            'Shift body',
            `${formatHex(input.base, width)} ${shiftOperator} ${amount} = ${formatHex(shiftedValue, width)}`,
            shiftedValue,
          ),
          createStep(
            'Wrap bits',
            amount === 0
              ? 'no wrap needed'
              : `${formatHex(input.base, width)} ${wrapOperator} ${wrapDistance} = ${formatHex(wrappedValue, width)}`,
            wrappedValue,
            {
              maskBits: getMaskBits(wrappedValue, width),
            },
          ),
          createStep(
            'OR result',
            `${formatHex(shiftedValue, width)} | ${formatHex(wrappedValue, width)} = ${formatHex(rotatedValue, width)}`,
            rotatedValue,
            {
              changedBits,
            },
          ),
        ],
      },
      rotatedValue,
    )
  }

  function runOperation(operationId) {
    if (operationId === 'set') runSetBit()
    if (operationId === 'clear') runClearBit()
    if (operationId === 'toggle') runToggleBit()
    if (operationId === 'read') runReadBit()
    if (operationId === 'mask') runMask()
    if (operationId === 'shift') runShift()
    if (operationId === 'rotate') runRotate()
  }

  function loadExample() {
    setAddress('0x40021000')
    setWidth(8)
    setRegisterValue('0b00101101')
    setBitIndex('5')
    setMaskInput('0xF0')
    setMoveAmount('2')
    setMoveDirection('left')
    setLastOperation(null)
  }

  function resetPlayground() {
    setAddress('')
    setWidth(8)
    setRegisterValue('0')
    setBitIndex('0')
    setMaskInput('0x00')
    setMoveAmount('1')
    setMoveDirection('left')
    setLastOperation(null)
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

      <div className="bit-layout">
        <div className="bit-controls">
          <div className="bit-control-grid">
            <label className="complex-field">
              <span>Register address</span>
              <input
                type="text"
                value={address}
                placeholder="0x40021000"
                onChange={(event) => {
                  setAddress(event.target.value)
                  clearOperation()
                }}
              />
            </label>
            <label className="complex-field">
              <span>Register value</span>
              <input
                type="text"
                inputMode="text"
                value={registerValue}
                placeholder="0x2D"
                onChange={(event) => {
                  setRegisterValue(event.target.value)
                  clearOperation()
                }}
              />
            </label>
            <label className="complex-field">
              <span>Bit index</span>
              <input
                type="number"
                min="0"
                max={width - 1}
                value={bitIndex}
                onChange={(event) => {
                  setBitIndex(event.target.value)
                  clearOperation()
                }}
              />
            </label>
            <label className="complex-field">
              <span>Mask</span>
              <input
                type="text"
                inputMode="text"
                value={maskInput}
                placeholder="0xF0"
                onChange={(event) => {
                  setMaskInput(event.target.value)
                  clearOperation()
                }}
              />
            </label>
            <label className="complex-field">
              <span>Shift / rotate amount</span>
              <input
                type="number"
                min="0"
                value={moveAmount}
                onChange={(event) => {
                  setMoveAmount(event.target.value)
                  clearOperation()
                }}
              />
            </label>
            <div className="unit-control">
              <span>Direction</span>
              <div className="segmented-control" role="group" aria-label="Bit move direction">
                {directionLabels.map((direction) => (
                  <button
                    type="button"
                    key={direction.id}
                    className={moveDirection === direction.id ? 'is-active' : ''}
                    onClick={() => {
                      setMoveDirection(direction.id)
                      clearOperation()
                    }}
                  >
                    {direction.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bit-operation-buttons" role="group" aria-label="Bit operations">
            {operationButtons.map((operation) => (
              <button
                type="button"
                key={operation.id}
                className={operation.id === 'set' ? 'primary-button' : ''}
                onClick={() => runOperation(operation.id)}
              >
                {operation.label}
              </button>
            ))}
          </div>

          <div className="actions">
            <button type="button" onClick={loadExample}>
              Example
            </button>
            <button type="button" onClick={resetPlayground}>
              Reset
            </button>
          </div>
        </div>

        <section className="bit-register-card" aria-label="Current register">
          <div className="bit-register-header">
            <div>
              <p className="eyebrow">Register</p>
              <h3>{registerAddress}</h3>
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
            <BitRow
              label="Current bits"
              note={formatBinary(normalizedRegisterValue, width)}
              value={normalizedRegisterValue}
              width={width}
              highlightBits={targetBits}
              maskBits={activeMaskBits}
            />
          )}
        </section>
      </div>

      <section
        className={`bit-steps ${visibleOperation.error ? 'has-error' : ''}`}
        aria-label="Bit operation steps"
        aria-live="polite"
      >
        <div className="bit-result-banner">
          <div>
            <span>{visibleOperation.title}</span>
            <strong>{visibleOperation.resultText}</strong>
          </div>
          <p>{visibleOperation.summary}</p>
        </div>

        {visibleOperation.error ? (
          <p className="message error">{visibleOperation.summary}</p>
        ) : (
          <div className="bit-step-list">
            {visibleOperation.steps.map((step, index) => (
              <StepCard step={step} width={width} index={index} key={`${step.title}-${index}`} />
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
