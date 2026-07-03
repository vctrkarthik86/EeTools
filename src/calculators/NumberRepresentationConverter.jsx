import { useMemo, useState } from 'react'

const bitWidths = [4, 8, 16, 32]

const inputBases = [
  {
    id: 'decimal',
    label: 'Decimal',
    shortLabel: 'Dec',
    radix: 10,
    prefix: '',
    digitPattern: /^[0-9]+$/i,
  },
  {
    id: 'binary',
    label: 'Binary',
    shortLabel: 'Bin',
    radix: 2,
    prefix: '0b',
    digitPattern: /^[01]+$/i,
  },
  {
    id: 'hex',
    label: 'Hexadecimal',
    shortLabel: 'Hex',
    radix: 16,
    prefix: '0x',
    digitPattern: /^[0-9a-f]+$/i,
  },
  {
    id: 'octal',
    label: 'Octal',
    shortLabel: 'Oct',
    radix: 8,
    prefix: '0o',
    digitPattern: /^[0-7]+$/i,
  },
]

const representationFormats = [
  { id: 'unsigned', label: 'Unsigned' },
  { id: 'signed-magnitude', label: 'Signed magnitude' },
  { id: 'ones-complement', label: "1's complement" },
  { id: 'twos-complement', label: "2's complement" },
]

function getWidthMask(width) {
  return (1n << BigInt(width)) - 1n
}

function getBitCapacity(width) {
  return 1n << BigInt(width)
}

function groupBinaryBits(bitString) {
  return bitString.replace(/(.{4})(?=.)/g, '$1 ')
}

function formatBinary(value, width) {
  return groupBinaryBits((value & getWidthMask(width)).toString(2).padStart(width, '0'))
}

function formatOctal(value, width) {
  const digits = Math.ceil(width / 3)
  return `0o${(value & getWidthMask(width)).toString(8).padStart(digits, '0')}`
}

function formatHex(value, width) {
  const digits = Math.ceil(width / 4)
  return `0x${(value & getWidthMask(width)).toString(16).toUpperCase().padStart(digits, '0')}`
}

function formatValueForBase(value, baseId) {
  const sign = value < 0n ? '-' : ''
  const absoluteValue = value < 0n ? -value : value

  if (baseId === 'binary') return `${sign}${groupBinaryBits(absoluteValue.toString(2))}`
  if (baseId === 'hex') return `${sign}0x${absoluteValue.toString(16).toUpperCase()}`
  if (baseId === 'octal') return `${sign}0o${absoluteValue.toString(8)}`

  return value.toString()
}

function parseDigitsToBigInt(digits, radix) {
  return digits.split('').reduce((total, digit) => {
    const digitValue = BigInt(Number.parseInt(digit, radix))
    return total * BigInt(radix) + digitValue
  }, 0n)
}

function parseInputNumber(input, baseId) {
  const base = inputBases.find((candidate) => candidate.id === baseId) ?? inputBases[0]
  let cleanedInput = input.trim().replace(/[\s_]/g, '')

  if (!cleanedInput) {
    return {
      value: null,
      error: 'Enter a value.',
    }
  }

  let sign = 1n

  if (cleanedInput.startsWith('-')) {
    sign = -1n
    cleanedInput = cleanedInput.slice(1)
  } else if (cleanedInput.startsWith('+')) {
    cleanedInput = cleanedInput.slice(1)
  }

  if (base.prefix && cleanedInput.toLowerCase().startsWith(base.prefix)) {
    cleanedInput = cleanedInput.slice(base.prefix.length)
  }

  if (!cleanedInput || !base.digitPattern.test(cleanedInput)) {
    return {
      value: null,
      error: `Enter a valid ${base.label.toLowerCase()} value.`,
    }
  }

  return {
    value: sign * parseDigitsToBigInt(cleanedInput.toLowerCase(), base.radix),
    error: '',
  }
}

function getFormatRange(formatId, width) {
  const maxUnsigned = getBitCapacity(width) - 1n
  if (formatId === 'unsigned') {
    return {
      min: 0n,
      max: maxUnsigned,
    }
  }

  const maxSignedMagnitude = (1n << BigInt(width - 1)) - 1n

  if (formatId === 'twos-complement') {
    return {
      min: -(1n << BigInt(width - 1)),
      max: maxSignedMagnitude,
    }
  }

  return {
    min: -maxSignedMagnitude,
    max: maxSignedMagnitude,
  }
}

function encodeValue(value, formatId, width) {
  if (formatId === 'unsigned') return value

  const signBit = 1n << BigInt(width - 1)

  if (formatId === 'signed-magnitude') {
    return value < 0n ? signBit | -value : value
  }

  if (formatId === 'ones-complement') {
    return value < 0n ? getWidthMask(width) ^ -value : value
  }

  return value < 0n ? getBitCapacity(width) + value : value
}

function getRangeText(range, baseId) {
  return `${formatValueForBase(range.min, baseId)} to ${formatValueForBase(range.max, baseId)}`
}

export default function NumberRepresentationConverter() {
  const [inputBase, setInputBase] = useState('decimal')
  const [bitWidth, setBitWidth] = useState(8)
  const [representationFormat, setRepresentationFormat] = useState('twos-complement')
  const [inputValue, setInputValue] = useState('-6')

  const activeBase = inputBases.find((base) => base.id === inputBase) ?? inputBases[0]
  const activeFormat =
    representationFormats.find((format) => format.id === representationFormat) ??
    representationFormats[0]
  const activeRange = useMemo(
    () => getFormatRange(representationFormat, bitWidth),
    [bitWidth, representationFormat],
  )
  const parsedInput = useMemo(
    () => parseInputNumber(inputValue, inputBase),
    [inputBase, inputValue],
  )

  const conversion = useMemo(() => {
    if (parsedInput.value === null) {
      return {
        pattern: null,
        error: parsedInput.error,
      }
    }

    if (parsedInput.value < activeRange.min || parsedInput.value > activeRange.max) {
      return {
        pattern: null,
        error: `Value must be between ${getRangeText(activeRange, inputBase)}.`,
      }
    }

    return {
      pattern: encodeValue(parsedInput.value, representationFormat, bitWidth),
      error: '',
    }
  }, [activeRange, bitWidth, inputBase, parsedInput, representationFormat])

  function loadExample() {
    setInputBase('decimal')
    setBitWidth(8)
    setRepresentationFormat('twos-complement')
    setInputValue('-6')
  }

  function clearConverter() {
    setInputValue('')
  }

  return (
    <section className="tool-panel representation-panel" aria-labelledby="representation-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Digital systems</p>
          <h2 id="representation-title">Number representation converter</h2>
        </div>
      </div>

      <div className="representation-simple-flow">
        <section className="representation-choice-card" aria-label="Input base">
          <span>Base</span>
          <div className="segmented-control representation-base-control" role="group" aria-label="Input base">
            {inputBases.map((base) => (
              <button
                type="button"
                key={base.id}
                className={inputBase === base.id ? 'is-active' : ''}
                onClick={() => setInputBase(base.id)}
              >
                {base.shortLabel}
              </button>
            ))}
          </div>
        </section>

        <section className="representation-choice-card" aria-label="Bit width">
          <span>Bits</span>
          <div className="segmented-control representation-width-control" role="group" aria-label="Bit width">
            {bitWidths.map((width) => (
              <button
                type="button"
                key={width}
                className={bitWidth === width ? 'is-active' : ''}
                onClick={() => setBitWidth(width)}
              >
                {width}
              </button>
            ))}
          </div>
        </section>

        <section className="representation-choice-card representation-format-card" aria-label="Number representation format">
          <span>Representation</span>
          <div
            className="segmented-control representation-format-control"
            role="group"
            aria-label="Number representation format"
          >
            {representationFormats.map((format) => (
              <button
                type="button"
                key={format.id}
                className={representationFormat === format.id ? 'is-active' : ''}
                onClick={() => setRepresentationFormat(format.id)}
              >
                {format.label}
              </button>
            ))}
          </div>
        </section>

        <section className="representation-range-card" aria-label="Allowed input range">
          <span>Range</span>
          <div className="representation-range-grid">
            <output>
              <span>{activeBase.label}</span>
              <strong>{getRangeText(activeRange, inputBase)}</strong>
            </output>
          </div>
        </section>

        <section className="representation-value-card" aria-label="Value input">
          <label className="complex-field">
            <span>Value</span>
            <input
              type="text"
              inputMode="text"
              value={inputValue}
              placeholder={formatValueForBase(activeRange.min, inputBase)}
              onChange={(event) => setInputValue(event.target.value)}
            />
          </label>
          <div className="actions representation-actions">
            <button type="button" onClick={loadExample}>
              Example
            </button>
            <button type="button" onClick={clearConverter}>
              Clear
            </button>
          </div>
        </section>
      </div>

      <section className="representation-result-card" aria-label="Converted value">
        <div>
          <p className="eyebrow">Result</p>
          <h3>{activeFormat.label}</h3>
        </div>

        {conversion.error ? (
          <p className="message error">{conversion.error}</p>
        ) : (
          <div className="representation-result-grid">
            <output>
              <span>Decimal</span>
              <strong>{parsedInput.value.toString()}</strong>
            </output>
            <output>
              <span>Binary</span>
              <strong>{formatBinary(conversion.pattern, bitWidth)}</strong>
            </output>
            <output>
              <span>Octal</span>
              <strong>{formatOctal(conversion.pattern, bitWidth)}</strong>
            </output>
            <output>
              <span>Hexadecimal</span>
              <strong>{formatHex(conversion.pattern, bitWidth)}</strong>
            </output>
          </div>
        )}
      </section>
    </section>
  )
}