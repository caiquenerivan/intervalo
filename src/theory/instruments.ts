/** Standard guitar tuning, low to high: E2 A2 D3 G3 B3 E4. */
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64]
export const FRET_COUNT = 15

/** Keyboard range shown in the UI: C3 to C5 (25 keys). */
export const KEYBOARD_START = 48
export const KEYBOARD_END = 72

export const BLACK_KEYS = [1, 3, 6, 8, 10]
export const isBlackKey = (midi: number) => BLACK_KEYS.includes(((midi % 12) + 12) % 12)

export function fretMidi(stringIndex: number, fret: number): number {
  return GUITAR_TUNING[stringIndex] + fret
}

/** The guitar string whose open pitch is closest to `freq` (index into GUITAR_TUNING). */
export function nearestString(freq: number, a4 = 440): number {
  const midi = 69 + 12 * Math.log2(freq / a4)
  let best = 0
  for (let i = 1; i < GUITAR_TUNING.length; i++) {
    if (Math.abs(GUITAR_TUNING[i] - midi) < Math.abs(GUITAR_TUNING[best] - midi)) best = i
  }
  return best
}
