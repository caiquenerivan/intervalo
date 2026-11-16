import { describe, expect, it } from 'vitest'
import { GUITAR_TUNING } from './instruments'
import { chordShape } from './shapes'

describe('chordShape', () => {
  it('gives the familiar open shapes', () => {
    expect(chordShape(0, false)).toEqual([-1, 3, 2, 0, 1, 0])
    expect(chordShape(9, true)).toEqual([-1, 0, 2, 2, 1, 0])
  })

  it('uses barre shapes elsewhere, low on the neck', () => {
    expect(chordShape(5, false)).toEqual([1, 3, 3, 2, 1, 1]) // F
    expect(chordShape(11, true)).toEqual([-1, 2, 4, 4, 3, 2]) // Bm
  })

  it('only ever sounds the notes of the chord, for all 24 chords', () => {
    for (let root = 0; root < 12; root++) {
      for (const minor of [false, true]) {
        const tones = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12]
        const shape = chordShape(root, minor)
        const sounding = shape.flatMap((fret, s) => (fret < 0 ? [] : [(GUITAR_TUNING[s] + fret) % 12]))
        expect(sounding.every((pc) => tones.includes(pc))).toBe(true)
        expect(new Set(sounding).size).toBe(3)
        // the lowest string played is the root
        expect(sounding[0]).toBe(root)
        expect(Math.max(...shape)).toBeLessThanOrEqual(9)
      }
    }
  })
})
