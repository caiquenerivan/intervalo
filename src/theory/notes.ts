/** Pitch class: 0 = C, 1 = C#/Db, ... 11 = B. */
export type PitchClass = number

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

/** Major keys whose signature is written with flats: F, Bb, Eb, Ab, Db, Gb. */
const FLAT_KEYS = [5, 10, 3, 8, 1, 6]

export const A4 = 440

export function pitchClass(midi: number): PitchClass {
  return ((Math.round(midi) % 12) + 12) % 12
}

/**
 * Whether a chord/scale built on `tonic` reads better with flats.
 * Minor-flavoured formulas borrow the signature of their relative major.
 */
export function prefersFlats(tonic: PitchClass, minor = false): boolean {
  const majorTonic = minor ? (tonic + 3) % 12 : tonic
  return FLAT_KEYS.includes(majorTonic)
}

export function noteName(pc: PitchClass, flats = false): string {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[pitchClass(pc)]
}

/** Scientific pitch notation: MIDI 60 = C4, MIDI 69 = A4. */
export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1
}

export function midiLabel(midi: number, flats = false): string {
  return `${noteName(pitchClass(midi), flats)}${octaveOf(midi)}`
}

export function midiToFreq(midi: number, a4 = A4): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

/** Fractional MIDI number for a frequency (69.5 = a quarter tone above A4). */
export function freqToMidi(freq: number, a4 = A4): number {
  return 69 + 12 * Math.log2(freq / a4)
}

/** Distance in cents from `freq` to the pitch of `midi` (positive = sharp). */
export function centsOff(freq: number, midi: number, a4 = A4): number {
  return 1200 * Math.log2(freq / midiToFreq(midi, a4))
}

export interface NearestNote {
  midi: number
  cents: number
}

export function nearestNote(freq: number, a4 = A4): NearestNote {
  const midi = Math.round(freqToMidi(freq, a4))
  return { midi, cents: centsOff(freq, midi, a4) }
}
