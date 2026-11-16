import { playChord, playSequence, type Voice } from '../../audio/synth'
import type { Key } from '../../i18n'
import { chordById, intervalById } from '../../theory/formulas'

export type EarKind = 'interval' | 'chord'
/** How an interval is presented: rising, falling, or both notes at once. */
export type Mode = 'asc' | 'desc' | 'harm'

export interface Level {
  items: string[]
  modes: Mode[]
  desc: Key
}

const ALL_INTERVALS = ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']

/**
 * Levels start with sounds that are far apart and easy to tell from each
 * other, then fill in the neighbours that are easy to confuse.
 */
export const LEVELS: Record<EarKind, Level[]> = {
  interval: [
    { items: ['M3', 'P5', 'P8'], modes: ['asc'], desc: 'ear.level.int1' },
    { items: ['M2', 'm3', 'M3', 'P4', 'P5', 'P8'], modes: ['asc'], desc: 'ear.level.int2' },
    { items: ALL_INTERVALS, modes: ['asc'], desc: 'ear.level.int3' },
    { items: ALL_INTERVALS, modes: ['asc', 'desc', 'harm'], desc: 'ear.level.int4' },
  ],
  chord: [
    { items: ['maj', 'min'], modes: ['harm'], desc: 'ear.level.ch1' },
    { items: ['maj', 'min', 'dim', 'aug'], modes: ['harm'], desc: 'ear.level.ch2' },
    { items: ['dom7', 'maj7', 'min7'], modes: ['harm'], desc: 'ear.level.ch3' },
    { items: ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'm7b5'], modes: ['harm'], desc: 'ear.level.ch4' },
  ],
}

export const cardId = (kind: EarKind, item: string) => `${kind}:${item}`
export const labelKey = (kind: EarKind, item: string) => `${kind}.${item}` as Key

export interface Question {
  kind: EarKind
  item: string
  mode: Mode
  /** Notes in the order they are played. */
  midis: number[]
}

/**
 * The root is random on purpose: with a fixed root people memorise absolute
 * pitches ("that high note is the fifth") instead of the distance.
 */
export function makeQuestion(
  kind: EarKind,
  item: string,
  modes: Mode[],
  random: () => number = Math.random,
): Question {
  const root = 48 + Math.floor(random() * 13) // C3..C4
  const mode = modes[Math.floor(random() * modes.length)]
  if (kind === 'chord') {
    return { kind, item, mode: 'harm', midis: chordById(item).intervals.map((i) => root + i) }
  }
  const pair = [root, root + intervalById(item).semitones]
  return { kind, item, mode, midis: mode === 'desc' ? pair.reverse() : pair }
}

export function playQuestion(q: Question, voice: Voice) {
  if (q.mode === 'harm') playChord(q.midis, voice, q.kind === 'chord' ? 0.02 : 0, 1.8)
  else playSequence(q.midis, voice, 0.75, 1.1)
}
