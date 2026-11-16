import type { Tone } from '../theory/formulas'

export interface Mark {
  label: string
  root?: boolean
}

/** Notes to highlight on an instrument, keyed by pitch class (0–11). */
export type Marks = Record<number, Mark>

export function marksFromTones(tones: Tone[], show: 'notes' | 'degrees'): Marks {
  const marks: Marks = {}
  for (const t of tones) {
    marks[t.pc] = { label: show === 'notes' ? t.name : t.degree, root: t.interval === 0 }
  }
  return marks
}
