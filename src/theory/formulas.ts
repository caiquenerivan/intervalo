import { noteName, prefersFlats, type PitchClass } from './notes'

export interface Formula {
  id: string
  /** Semitones above the tonic. */
  intervals: number[]
  /** Degree label for each interval, e.g. "1", "♭3", "5". */
  degrees: string[]
  /** Minor-flavoured: spell with the relative major's accidentals. */
  minor: boolean
}

const f = (id: string, intervals: number[], degrees: string, minor = false): Formula => ({
  id,
  intervals,
  degrees: degrees.split(' '),
  minor,
})

export const CHORDS: Formula[] = [
  f('maj', [0, 4, 7], '1 3 5'),
  f('min', [0, 3, 7], '1 ♭3 5', true),
  f('dim', [0, 3, 6], '1 ♭3 ♭5', true),
  f('aug', [0, 4, 8], '1 3 ♯5'),
  f('sus2', [0, 2, 7], '1 2 5'),
  f('sus4', [0, 5, 7], '1 4 5'),
  f('dom7', [0, 4, 7, 10], '1 3 5 ♭7'),
  f('maj7', [0, 4, 7, 11], '1 3 5 7'),
  f('min7', [0, 3, 7, 10], '1 ♭3 5 ♭7', true),
  f('m7b5', [0, 3, 6, 10], '1 ♭3 ♭5 ♭7', true),
  f('dim7', [0, 3, 6, 9], '1 ♭3 ♭5 𝄫7', true),
]

export const SCALES: Formula[] = [
  f('major', [0, 2, 4, 5, 7, 9, 11], '1 2 3 4 5 6 7'),
  f('minor', [0, 2, 3, 5, 7, 8, 10], '1 2 ♭3 4 5 ♭6 ♭7', true),
  f('majPent', [0, 2, 4, 7, 9], '1 2 3 5 6'),
  f('minPent', [0, 3, 5, 7, 10], '1 ♭3 4 5 ♭7', true),
  f('blues', [0, 3, 5, 6, 7, 10], '1 ♭3 4 ♭5 5 ♭7', true),
  f('harmMinor', [0, 2, 3, 5, 7, 8, 11], '1 2 ♭3 4 5 ♭6 7', true),
  f('melMinor', [0, 2, 3, 5, 7, 9, 11], '1 2 ♭3 4 5 6 7', true),
  f('dorian', [0, 2, 3, 5, 7, 9, 10], '1 2 ♭3 4 5 6 ♭7', true),
  f('phrygian', [0, 1, 3, 5, 7, 8, 10], '1 ♭2 ♭3 4 5 ♭6 ♭7', true),
  f('lydian', [0, 2, 4, 6, 7, 9, 11], '1 2 3 ♯4 5 6 7'),
  f('mixolydian', [0, 2, 4, 5, 7, 9, 10], '1 2 3 4 5 6 ♭7'),
]

export const chordById = (id: string) => CHORDS.find((c) => c.id === id)!
export const scaleById = (id: string) => SCALES.find((s) => s.id === id)!

export interface Tone {
  pc: PitchClass
  name: string
  degree: string
  /** Semitones above the tonic. */
  interval: number
}

/** The notes of a chord or scale built on `tonic`, in formula order. */
export function buildTones(tonic: PitchClass, formula: Formula): Tone[] {
  const flats = prefersFlats(tonic, formula.minor)
  return formula.intervals.map((interval, i) => {
    const pc = (tonic + interval) % 12
    return { pc, name: noteName(pc, flats), degree: formula.degrees[i], interval }
  })
}

/** MIDI notes for playback, starting from the tonic at or above `baseMidi`. */
export function formulaMidis(tonic: PitchClass, formula: Formula, baseMidi: number): number[] {
  const root = baseMidi + ((tonic - (baseMidi % 12) + 12) % 12)
  return formula.intervals.map((i) => root + i)
}

export interface Interval {
  id: string
  semitones: number
}

export const INTERVALS: Interval[] = [
  { id: 'm2', semitones: 1 },
  { id: 'M2', semitones: 2 },
  { id: 'm3', semitones: 3 },
  { id: 'M3', semitones: 4 },
  { id: 'P4', semitones: 5 },
  { id: 'TT', semitones: 6 },
  { id: 'P5', semitones: 7 },
  { id: 'm6', semitones: 8 },
  { id: 'M6', semitones: 9 },
  { id: 'm7', semitones: 10 },
  { id: 'M7', semitones: 11 },
  { id: 'P8', semitones: 12 },
]

export const intervalById = (id: string) => INTERVALS.find((i) => i.id === id)!
