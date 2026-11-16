import type { Shape } from '../theory/shapes'

const STRING_GAP = 14
const FRET_GAP = 18
const LEFT = 16
const TOP = 26
const FRETS = 4

interface Props {
  name: string
  shape: Shape
  active?: boolean
  onClick?: () => void
}

/** The small chord diagram found above the lyrics on any chord sheet. */
export function ChordBox({ name, shape, active, onClick }: Props) {
  const fretted = shape.filter((f) => f > 0)
  const highest = Math.max(...fretted, 0)
  // Slide the window up the neck when the shape does not fit in the first frets.
  const base = highest > FRETS ? Math.min(...fretted) : 1
  const width = LEFT * 2 + STRING_GAP * 5
  const height = TOP + FRET_GAP * FRETS + 10
  const ink = active ? 'var(--color-ink)' : 'var(--color-text)'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-1 pt-1.5 transition ${
        active ? 'border-accent bg-accent text-ink' : 'border-line bg-surface hover:border-mute'
      }`}
    >
      <div className="text-center text-base leading-none font-bold">{name}</div>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        {base === 1 ? (
          <rect x={LEFT - 1} y={TOP - 3} width={STRING_GAP * 5 + 2} height={3} fill={ink} />
        ) : (
          <text x={LEFT - 5} y={TOP + FRET_GAP * 0.5 + 3} fontSize={8} textAnchor="end" fill={ink}>
            {base}
          </text>
        )}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line key={i} x1={LEFT} x2={LEFT + STRING_GAP * 5} y1={TOP + FRET_GAP * i} y2={TOP + FRET_GAP * i} stroke={ink} strokeWidth={0.7} opacity={0.5} />
        ))}
        {shape.map((fret, s) => {
          const x = LEFT + STRING_GAP * s
          return (
            <g key={s}>
              <line x1={x} x2={x} y1={TOP} y2={TOP + FRET_GAP * FRETS} stroke={ink} strokeWidth={0.7} opacity={0.5} />
              {fret < 0 && (
                <text x={x} y={TOP - 7} fontSize={9} textAnchor="middle" fill={ink} opacity={0.7}>
                  ×
                </text>
              )}
              {fret === 0 && <circle cx={x} cy={TOP - 10} r={3} fill="none" stroke={ink} strokeWidth={1} opacity={0.7} />}
              {fret > 0 && <circle cx={x} cy={TOP + FRET_GAP * (fret - base + 0.5)} r={4.5} fill={ink} />}
            </g>
          )
        })}
      </svg>
    </button>
  )
}
