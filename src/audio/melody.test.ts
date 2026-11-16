import { describe, expect, it } from 'vitest'
import { extractMelody, type MelodyNote } from './melody'

const SR = 11025

/** A voice-like tone: many overtones, a little vibrato, soft attack and release. */
function sing(out: Float32Array, start: number, seconds: number, midi: number, level = 0.4) {
  const freq = 440 * 2 ** ((midi - 69) / 12)
  const from = Math.floor(start * SR)
  const length = Math.floor(seconds * SR)
  for (let h = 1; h <= 8; h++) {
    let phase = 0
    for (let i = 0; i < length && from + i < out.length; i++) {
      const vibrato = 1 + 0.006 * Math.sin((2 * Math.PI * 5.5 * i) / SR)
      phase += (2 * Math.PI * freq * h * vibrato) / SR
      const envelope = Math.min(1, i / 300, (length - i) / 300)
      out[from + i] += (level / h ** 0.8) * envelope * Math.sin(phase)
    }
  }
}

/** Plucked accompaniment: decaying chord tones, restruck every half second. */
function strum(out: Float32Array, start: number, seconds: number, midis: number[]) {
  for (let t = 0; t < seconds; t += 0.5) {
    const from = Math.floor((start + t) * SR)
    for (const midi of midis) {
      const freq = 440 * 2 ** ((midi - 69) / 12)
      for (let h = 1; h <= 4; h++) {
        const w = (2 * Math.PI * freq * h) / SR
        for (let i = 0; i < 0.5 * SR && from + i < out.length; i++) {
          out[from + i] += (0.1 / h) * Math.exp((-5 * i) / SR) * Math.sin(w * i)
        }
      }
    }
  }
}

const pitches = (notes: MelodyNote[]) => notes.map((n) => n.midi)

describe('extractMelody', () => {
  it('transcribes a solo line', () => {
    const tune = [60, 62, 64, 65, 67, 65, 64, 60]
    const audio = new Float32Array(Math.floor((tune.length * 0.4 + 0.5) * SR))
    tune.forEach((midi, i) => sing(audio, 0.2 + i * 0.4, 0.38, midi))
    const notes = extractMelody(audio, SR)
    expect(pitches(notes)).toEqual(tune)
    notes.forEach((n, i) => expect(Math.abs(n.start - (0.2 + i * 0.4))).toBeLessThan(0.08))
  })

  it('follows the voice over a strummed accompaniment', () => {
    const tune = [64, 67, 69, 67, 64, 62, 60, 62, 64, 64]
    const audio = new Float32Array(Math.floor((tune.length * 0.5 + 0.5) * SR))
    strum(audio, 0, 2.5, [36, 48, 52, 55]) // C
    strum(audio, 2.5, 3, [43, 47, 50, 55]) // G
    tune.forEach((midi, i) => sing(audio, 0.1 + i * 0.5, 0.45, midi))
    // the repeated E at the end may come out as one long note or two
    expect([tune, tune.slice(0, -1)]).toContainEqual(pitches(extractMelody(audio, SR)))
  })

  it('stays silent through rests and when nothing is sung', () => {
    const audio = new Float32Array(4 * SR)
    sing(audio, 0.2, 0.6, 62)
    sing(audio, 2.8, 0.6, 65)
    const notes = extractMelody(audio, SR)
    expect(pitches(notes)).toEqual([62, 65])
    expect(notes[0].end).toBeLessThan(1)
    expect(notes[1].start).toBeGreaterThan(2.6)
    expect(extractMelody(new Float32Array(2 * SR), SR)).toEqual([])
  })

  it('does not jump an octave on a low male note', () => {
    const audio = new Float32Array(2 * SR)
    sing(audio, 0.2, 1.5, 47) // B2
    expect(pitches(extractMelody(audio, SR))).toEqual([47])
  })

  it('uses the tuning found by the chord analysis', () => {
    const audio = new Float32Array(2 * SR)
    // 40 cents sharp of C4: without correction it is a coin toss between C and C#
    const length = Math.floor(1.5 * SR)
    for (let h = 1; h <= 6; h++) {
      const w = (2 * Math.PI * 261.63 * 2 ** (40 / 1200) * h) / SR
      for (let i = 0; i < length; i++) audio[2000 + i] += (0.3 / h) * Math.sin(w * i)
    }
    expect(pitches(extractMelody(audio, SR, 40))).toEqual([60])
  })
})
