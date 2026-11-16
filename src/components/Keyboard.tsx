import { useState } from 'react'
import { KEYBOARD_END, KEYBOARD_START, isBlackKey } from '../theory/instruments'
import { midiLabel, pitchClass } from '../theory/notes'
import type { Marks } from './marks'

const WHITE_W = 46
const WHITE_H = 170
const BLACK_W = 28
const BLACK_H = 106

interface KeyShape {
  midi: number
  black: boolean
  x: number
}

const KEYS: KeyShape[] = []
{
  let white = 0
  for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi++) {
    const black = isBlackKey(midi)
    KEYS.push({ midi, black, x: black ? white * WHITE_W - BLACK_W / 2 : white * WHITE_W })
    if (!black) white++
  }
}
const WIDTH = KEYS.filter((k) => !k.black).length * WHITE_W

interface Props {
  marks: Marks
  onNote: (midi: number) => void
  label: string
}

export function Keyboard({ marks, onNote, label }: Props) {
  const [pressed, setPressed] = useState<number | null>(null)

  const press = (midi: number) => {
    setPressed(midi)
    window.setTimeout(() => setPressed((p) => (p === midi ? null : p)), 300)
    onNote(midi)
  }

  const renderKey = ({ midi, black, x }: KeyShape) => {
    const mark = marks[pitchClass(midi)]
    const w = black ? BLACK_W : WHITE_W
    const h = black ? BLACK_H : WHITE_H
    const down = pressed === midi
    const fill = down ? 'var(--color-mute)' : black ? '#16181f' : '#f2efe6'
    return (
      <g
        key={midi}
        role="button"
        tabIndex={0}
        aria-label={midiLabel(midi)}
        onPointerDown={() => press(midi)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && press(midi)}
        className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-accent"
      >
        <rect x={x} y={0} width={w} height={h} rx={black ? 3 : 4} fill={fill} stroke="#11131a" strokeWidth={1.5} />
        {mark && (
          <>
            <circle
              cx={x + w / 2}
              cy={h - (black ? 20 : 24)}
              r={black ? 11 : 13}
              fill={mark.root ? 'var(--color-root)' : 'var(--color-accent)'}
              stroke="#11131a"
              strokeWidth={1.5}
            />
            <text
              x={x + w / 2}
              y={h - (black ? 16 : 20)}
              textAnchor="middle"
              fontSize={black ? 9.5 : 11}
              fontWeight={700}
              fill="#11131a"
              pointerEvents="none"
            >
              {mark.label}
            </text>
          </>
        )}
        {!black && pitchClass(midi) === 0 && !mark && (
          <text x={x + w / 2} y={h - 10} textAnchor="middle" fontSize={10} fill="#8b8a84" pointerEvents="none">
            {midiLabel(midi)}
          </text>
        )}
      </g>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${WHITE_H}`}
        role="group"
        aria-label={label}
        className="mx-auto block h-auto w-full max-w-3xl min-w-[520px] select-none"
      >
        {KEYS.filter((k) => !k.black).map(renderKey)}
        {KEYS.filter((k) => k.black).map(renderKey)}
      </svg>
    </div>
  )
}
