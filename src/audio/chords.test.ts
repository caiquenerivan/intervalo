import { describe, expect, it } from 'vitest'
import { analyseChords, chordName, fft, prepare, segment, type Analysis } from './chords'
import { SHARP_NAMES } from '../theory/notes'

const SR = 11025

/** A band-ish chord: bass root plus a triad, each note with decaying overtones. */
function renderChord(out: Float32Array, start: number, seconds: number, root: number, minor: boolean, a4: number) {
  const notes = [root - 12, root, root + (minor ? 3 : 4), root + 7]
  const from = Math.floor(start * SR)
  const length = Math.floor(seconds * SR)
  for (const midi of notes) {
    const freq = a4 * 2 ** ((midi - 69) / 12)
    for (let h = 1; h <= 5; h++) {
      const w = (2 * Math.PI * freq * h) / SR
      for (let i = 0; i < length; i++) {
        out[from + i] += (0.2 / h) * Math.exp((-1.5 * i) / SR) * Math.sin(w * i)
      }
    }
  }
}

function song(chords: [number, boolean][], seconds = 2, a4 = 440, noise = 0): Float32Array {
  const out = new Float32Array(Math.floor(chords.length * seconds * SR))
  chords.forEach(([root, minor], i) => renderChord(out, i * seconds, seconds, root, minor, a4))
  let seed = 3
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 16807) % 2147483647
    out[i] += noise * ((seed / 2147483647) * 2 - 1)
  }
  return out
}

/** A sung-style line: one note at a time, louder than the band, moving in quarter-second steps. */
function addMelody(out: Float32Array, midis: number[], step = 0.25, level = 0.5) {
  midis.forEach((midi, n) => {
    const freq = 440 * 2 ** ((midi - 69) / 12)
    const from = Math.floor(n * step * SR)
    const length = Math.floor(step * SR)
    for (let h = 1; h <= 4; h++) {
      const w = (2 * Math.PI * freq * h) / SR
      for (let i = 0; i < length && from + i < out.length; i++) {
        const envelope = Math.min(1, i / 200, (length - i) / 200)
        out[from + i] += (level / h) * envelope * Math.sin(w * i)
      }
    }
  })
}

/** Kick-and-snare-like noise bursts on every beat. */
function addDrums(out: Float32Array, every = 0.5, level = 0.5) {
  let seed = 11
  for (let t = 0; t * SR < out.length; t += every) {
    const from = Math.floor(t * SR)
    for (let i = 0; i < 0.06 * SR && from + i < out.length; i++) {
      seed = (seed * 16807) % 2147483647
      out[from + i] += level * ((seed / 2147483647) * 2 - 1) * Math.exp((-60 * i) / SR)
    }
  }
}

const names = (a: Analysis) => a.segments.map((s) => (s.chord ? chordName(s.chord, SHARP_NAMES) : '-')).join(' ')

// C3 = 48
const C: [number, boolean] = [48, false]
const G: [number, boolean] = [55, false]
const Am: [number, boolean] = [57, true]
const F: [number, boolean] = [53, false]
const Em: [number, boolean] = [52, true]
const D: [number, boolean] = [50, false]

describe('fft', () => {
  it('puts a sine in the right bin', () => {
    const n = 64
    const re = Float32Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / n))
    const im = new Float32Array(n)
    fft(re, im)
    const mags = Array.from(re, (r, i) => Math.hypot(r, im[i]))
    expect(mags[5]).toBeCloseTo(n / 2, 3)
    expect(mags[59]).toBeCloseTo(n / 2, 3)
    expect(Math.max(...mags.filter((_, i) => i !== 5 && i !== 59))).toBeLessThan(1e-3)
  })
})

describe('analyseChords', () => {
  it('reads a I–V–vi–IV progression with the changes in the right place', () => {
    const a = analyseChords(song([C, G, Am, F, C, G, Am, F]), SR)
    expect(names(a)).toBe('C G Am F C G Am F')
    a.segments.slice(1).forEach((seg, i) => expect(Math.abs(seg.start - (i + 1) * 2)).toBeLessThan(0.4))
    expect(a.key).toEqual({ tonic: 0, minor: false })
    expect(Math.abs(a.tuningCents)).toBeLessThan(5)
  })

  it('tells major from minor on the same root', () => {
    expect(names(analyseChords(song([[57, false], Am, [52, false], Em]), SR))).toBe('A Am E Em')
  })

  it('copes with a recording that is not at A = 440', () => {
    const a = analyseChords(song([G, D, Em, C], 2, 448), SR) // ≈ +31 cents
    expect(names(a)).toBe('G D Em C')
    expect(a.tuningCents).toBeGreaterThan(22)
    expect(a.tuningCents).toBeLessThan(40)
  })

  it('survives noise', () => {
    expect(names(analyseChords(song([C, F, G, C], 2, 440, 0.05), SR))).toBe('C F G C')
  })

  it('follows the chords, not the melody on top of them', () => {
    const audio = song([C, G, Am, F, C, G, Am, F])
    // C major melody full of passing notes that do not belong to the chord under them.
    const phrase = [76, 74, 72, 74, 76, 77, 79, 77, 74, 72, 71, 72, 74, 76, 74, 71, 72, 71, 69, 71, 72, 74, 76, 72, 69, 71, 72, 74, 72, 71, 69, 67]
    addMelody(audio, [...phrase, ...phrase])
    addDrums(audio)
    expect(names(analyseChords(audio, SR))).toBe('C G Am F C G Am F')
  })

  it('does not chase a melody that outlines a different chord', () => {
    // Band holds C for 4 s while the tune arpeggiates E minor and A minor on top.
    const audio = song([C, C, F, F])
    addMelody(audio, [76, 79, 83, 79, 76, 79, 83, 79, 81, 84, 88, 84, 81, 84, 88, 84, 81, 84, 81, 77, 81, 84, 81, 77, 79, 76, 79, 84, 79, 76, 72, 76])
    expect(names(analyseChords(audio, SR))).toBe('C F')
  })

  it('in simple mode, drops a lick that is read as a chord and returns to the same chord', () => {
    const audio = song([C, C, C, C, C])
    // 1.5 s of A and B notes over the held C: two notes of A minor's neighbourhood, never the full chord.
    addMelody(audio, new Array(16).fill(0).concat([45, 47, 45, 47, 45, 47]), 0.25, 0.9)
    const p = prepare(audio, SR)
    const read = (detail: 'simple' | 'detailed') =>
      segment(p, detail).map((s) => (s.chord ? chordName(s.chord, SHARP_NAMES) : '-')).join(' ')
    expect(read('detailed')).not.toBe('C')
    expect(read('simple')).toBe('C')
  })

  it('keeps a short but complete chord, even between two of the same', () => {
    expect(names(analyseChords(song([C, C, Am, C, C]), SR))).toBe('C Am C')
  })

  it('reports no chord for silence between chords', () => {
    const audio = new Float32Array(6 * SR)
    renderChord(audio, 0, 2, 48, false, 440)
    renderChord(audio, 4, 2, 55, false, 440)
    for (let i = 1.6 * SR; i < 4 * SR; i++) audio[Math.floor(i)] = 0
    expect(names(analyseChords(audio, SR))).toBe('C - G')
  })

  it('handles empty and very short input', () => {
    expect(analyseChords(new Float32Array(0), SR).segments).toEqual([])
    expect(analyseChords(new Float32Array(100), SR).segments).toEqual([])
  })
})
