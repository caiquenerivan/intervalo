import { useState } from 'react'
import { FRET_COUNT, GUITAR_TUNING, fretMidi } from '../theory/instruments'
import { midiLabel, pitchClass } from '../theory/notes'
import type { Marks } from './marks'

const NUT_X = 54
const FRET_W = 58
const STRING_GAP = 30
const TOP = 22
const WIDTH = NUT_X + FRET_W * FRET_COUNT + 16
const HEIGHT = TOP + STRING_GAP * 5 + 44
const INLAYS = [3, 5, 7, 9, 15]

/** x of the place a finger goes for a fret (0 = open string, left of the nut). */
const fretX = (fret: number) => (fret === 0 ? NUT_X - 24 : NUT_X + FRET_W * (fret - 0.5))
/** Strings are drawn like a chord chart or tab: high E on top. */
const stringY = (stringIndex: number) => TOP + STRING_GAP * (5 - stringIndex)

interface Props {
  marks: Marks
  onNote: (midi: number) => void
  label: string
  /** Only draw marks between these frets (inclusive). Every fret stays playable. */
  markFrets?: [number, number]
}

export function Fretboard({ marks, onNote, label, markFrets }: Props) {
  const [pressed, setPressed] = useState<string | null>(null)

  const press = (s: number, fret: number) => {
    const key = `${s}-${fret}`
    setPressed(key)
    window.setTimeout(() => setPressed((p) => (p === key ? null : p)), 350)
    onNote(fretMidi(s, fret))
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-label={label}
        className="block h-auto w-full min-w-[720px] select-none"
      >
        <rect x={NUT_X} y={TOP - 10} width={FRET_W * FRET_COUNT} height={STRING_GAP * 5 + 20} rx={4} fill="#2b2420" />
        {INLAYS.map((f) => (
          <circle key={f} cx={fretX(f)} cy={TOP + STRING_GAP * 2.5} r={6} fill="#4a4038" />
        ))}
        <circle cx={fretX(12)} cy={TOP + STRING_GAP * 1.5} r={6} fill="#4a4038" />
        <circle cx={fretX(12)} cy={TOP + STRING_GAP * 3.5} r={6} fill="#4a4038" />

        <rect x={NUT_X - 4} y={TOP - 10} width={5} height={STRING_GAP * 5 + 20} fill="#d9d2c3" />
        {Array.from({ length: FRET_COUNT }, (_, i) => (
          <line
            key={i}
            x1={NUT_X + FRET_W * (i + 1)}
            x2={NUT_X + FRET_W * (i + 1)}
            y1={TOP - 10}
            y2={TOP + STRING_GAP * 5 + 10}
            stroke="#8d8676"
            strokeWidth={2}
          />
        ))}
        {GUITAR_TUNING.map((_, s) => (
          <line
            key={s}
            x1={NUT_X - 40}
            x2={WIDTH - 16}
            y1={stringY(s)}
            y2={stringY(s)}
            stroke="#c9c2b0"
            strokeWidth={1 + (5 - s) * 0.35}
          />
        ))}
        {[1, 3, 5, 7, 9, 12, 15].map((f) => (
          <text key={f} x={fretX(f)} y={HEIGHT - 8} textAnchor="middle" fontSize={12} fill="#9b9eae">
            {f}
          </text>
        ))}

        {GUITAR_TUNING.map((_, s) =>
          Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
            const midi = fretMidi(s, fret)
            const inRange = !markFrets || (fret >= markFrets[0] && fret <= markFrets[1])
            const mark = inRange ? marks[pitchClass(midi)] : undefined
            const key = `${s}-${fret}`
            const isPressed = pressed === key
            return (
              <g
                key={key}
                role="button"
                tabIndex={mark ? 0 : -1}
                aria-label={midiLabel(midi)}
                onPointerDown={() => press(s, fret)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && press(s, fret)}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-accent"
              >
                <rect
                  x={fret === 0 ? 0 : NUT_X + FRET_W * (fret - 1)}
                  y={stringY(s) - STRING_GAP / 2}
                  width={fret === 0 ? NUT_X - 4 : FRET_W}
                  height={STRING_GAP}
                  fill="transparent"
                />
                {(mark || isPressed) && (
                  <circle
                    cx={fretX(fret)}
                    cy={stringY(s)}
                    r={isPressed ? 14 : 12.5}
                    fill={mark ? (mark.root ? 'var(--color-root)' : 'var(--color-accent)') : 'var(--color-text)'}
                    stroke="#11131a"
                    strokeWidth={2}
                    opacity={mark ? 1 : 0.85}
                  />
                )}
                {mark && (
                  <text
                    x={fretX(fret)}
                    y={stringY(s) + 4}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    fill="#11131a"
                    pointerEvents="none"
                  >
                    {mark.label}
                  </text>
                )}
              </g>
            )
          }),
        )}
      </svg>
    </div>
  )
}
