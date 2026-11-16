import { describe, expect, it } from 'vitest'
import { halveRate, removeGhosts, type TranscribedNote } from './transcribe'

const note = (start: number, midi: number, strength = 0.5): TranscribedNote => ({ start, end: start + 0.4, midi, strength })
const midis = (notes: TranscribedNote[]) => notes.map((n) => n.midi)

describe('removeGhosts', () => {
  it('drops a weaker note sitting on an overtone of one that starts with it', () => {
    const kept = removeGhosts([note(1, 48, 0.8), note(1.02, 60, 0.3), note(1.01, 67, 0.2), note(1, 76, 0.1)])
    expect(midis(kept)).toEqual([48])
  })

  it('keeps an octave that is as strong as the note below (a real doubling)', () => {
    expect(midis(removeGhosts([note(1, 48, 0.5), note(1, 60, 0.6)]))).toEqual([48, 60])
  })

  it('keeps the same pitches when they are played one after the other', () => {
    expect(midis(removeGhosts([note(1, 48, 0.8), note(1.25, 60, 0.3), note(1.5, 67, 0.3)]))).toEqual([48, 60, 67])
  })

  it('keeps notes that are not overtones of each other', () => {
    expect(midis(removeGhosts([note(1, 48, 0.8), note(1, 52, 0.3), note(1, 55, 0.3)]))).toEqual([48, 52, 55])
  })

  it('drops notes outside the playable range and returns them in time order', () => {
    expect(midis(removeGhosts([note(2, 60), note(1, 100), note(0.5, 20), note(1, 64)]))).toEqual([64, 60])
  })
})

describe('halveRate', () => {
  it('halves the length and keeps a low tone intact', () => {
    const input = Float32Array.from({ length: 2000 }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / 22050))
    const out = halveRate(input)
    expect(out.length).toBe(1000)
    const peak = Math.max(...out.slice(100, 900))
    expect(peak).toBeGreaterThan(0.98)
  })

  it('removes content at the old Nyquist, which would otherwise alias', () => {
    const input = Float32Array.from({ length: 2000 }, (_, i) => (i % 2 ? -1 : 1))
    // the very first sample has no left neighbour to average with
    expect(Math.max(...halveRate(input).slice(1).map(Math.abs))).toBeLessThan(1e-6)
  })
})
