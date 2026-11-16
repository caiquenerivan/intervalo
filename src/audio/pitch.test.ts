import { describe, expect, it } from 'vitest'
import { GUITAR_TUNING } from '../theory/instruments'
import { centsOff, midiToFreq } from '../theory/notes'
import { detectPitch, median, rms } from './pitch'
import { pluckSamples } from './synth'

const SR = 48000
const N = 4096

function harmonic(freq: number, amps: number[], noise = 0): Float32Array {
  const buf = new Float32Array(N)
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  for (let i = 0; i < N; i++) {
    let s = 0
    amps.forEach((a, h) => (s += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR)))
    buf[i] = s + noise * rand()
  }
  return buf
}

describe('detectPitch (YIN)', () => {
  it('detects a pure sine within 1 cent', () => {
    for (const f of [82.41, 110, 196, 329.63, 440]) {
      const r = detectPitch(harmonic(f, [1]), SR)!
      expect(Math.abs(1200 * Math.log2(r.freq / f))).toBeLessThan(1)
      expect(r.clarity).toBeGreaterThan(0.95)
    }
  })

  it('finds the fundamental when the 2nd harmonic is louder (no octave error)', () => {
    const r = detectPitch(harmonic(82.41, [0.4, 1, 0.6, 0.3]), SR)!
    expect(Math.abs(1200 * Math.log2(r.freq / 82.41))).toBeLessThan(2)
  })

  it('tolerates noise', () => {
    const r = detectPitch(harmonic(146.83, [1, 0.5, 0.3], 0.1), SR)!
    expect(Math.abs(1200 * Math.log2(r.freq / 146.83))).toBeLessThan(5)
  })

  it('reads every open string from a plucked-string signal', () => {
    for (const midi of GUITAR_TUNING) {
      const samples = pluckSamples(midiToFreq(midi), SR, 0.5)
      // skip the noisy attack, like a real tuner effectively does
      const r = detectPitch(samples.subarray(4800, 4800 + N), SR)!
      expect(r).not.toBeNull()
      expect(Math.abs(centsOff(r.freq, midi))).toBeLessThan(8)
    }
  })

  it('returns null for noise and silence', () => {
    expect(detectPitch(harmonic(100, [0], 1), SR)).toBeNull()
    expect(detectPitch(new Float32Array(N), SR)).toBeNull()
    expect(rms(new Float32Array(N))).toBe(0)
  })
})

describe('median', () => {
  it('ignores outliers', () => {
    expect(median([110, 110.2, 220, 109.9, 110.1])).toBe(110.1)
    expect(median([1, 2])).toBe(1.5)
  })
})
