/**
 * Predominant-melody extraction: which single line stands out of the mix,
 * note by note.
 *
 * This is a much harder problem than chords. Several instruments sound at
 * once, and "the melody" is a judgement about which one a listener follows.
 * The approach is a small version of the salience method (Salamon & Gómez's
 * Melodia is the reference):
 *
 *   spectrum peaks → harmonic-sum salience per candidate pitch
 *                  → one smooth pitch track through time (Viterbi)
 *                  → cut the track into notes
 *
 * Expect a sketch, not a transcription: it does well when a voice or lead is
 * clearly in front, and will happily follow a guitar fill when nobody sings.
 */

import { fft } from './chords'

export interface MelodyNote {
  /** Seconds. */
  start: number
  end: number
  /** MIDI note number, already rounded to a semitone. */
  midi: number
}

/** 2048 samples at 11 kHz ≈ 0.19 s windows, moved 23 ms at a time: fine enough to follow sung notes. */
const FFT_SIZE = 2048
const HOP = 256
/** G2 … G5 covers almost every sung melody, low male to high female. */
const MIN_MIDI = 43
const MAX_MIDI = 79
/** Pitch grid: 5 steps per semitone (20 cents), so slides and vibrato stay on the track. */
const STEPS = 5
const BINS = (MAX_MIDI - MIN_MIDI) * STEPS + 1
/** How many overtones vote for a candidate pitch, and how fast their vote fades. */
const HARMONICS = 8
const HARMONIC_DECAY = 0.84
/** Score of "nobody is singing"; a pitch has to be more salient than this (0–1 scale). */
const UNVOICED_SCORE = 0.3
/** Price per 20-cent step between frames, of an arbitrary leap, and of starting/stopping. */
const STEP_COST = 0.03
const LEAP_COST = 0.8
const ONSET_COST = 0.35
/**
 * Octave errors are the classic failure: a loud note's second overtone can
 * outweigh its fundamental, and the track jumps up an octave. What tells the
 * two apart is the odd overtones (1st, 3rd, 5th…) of the lower pitch: they
 * exist only if the lower note is really there. When they carry at least
 * OCTAVE_RATIO of the upper candidate's support, the upper one is turned down.
 */
const OCTAVE = 12 * STEPS
const OCTAVE_RATIO = 0.3
const OCTAVE_DAMP = 0.6
/** Largest move followed step by step (3 semitones in 23 ms is already a leap). */
const REACH = 15
/** Notes shorter than this are ornaments or glitches (seconds). */
const MIN_NOTE = 0.12

const freqToMidi = (freq: number) => 69 + 12 * Math.log2(freq / 440)

/**
 * For every frame, how strongly each candidate pitch is supported.
 * A sung note at f shows up as peaks at f, 2f, 3f…; so each spectral peak
 * votes for the pitches it could be an overtone of (f, f/2, f/3…). A pitch
 * with many overtones present — a voice — collects many votes.
 */
function salience(samples: Float32Array, sampleRate: number, tuning: number): Float32Array[] {
  const window = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)
  const kMax = FFT_SIZE / 2 - 2
  const mags = new Float32Array(kMax + 2)
  const frames: Float32Array[] = []

  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[start + i] * window[i]
      im[i] = 0
    }
    fft(re, im)
    let max = 0
    for (let k = 1; k <= kMax + 1; k++) {
      mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k])
      if (mags[k] > max) max = mags[k]
    }
    const bins = new Float32Array(BINS)
    const odd = new Float32Array(BINS)
    const floor = max * 0.02
    for (let k = 2; k <= kMax; k++) {
      const m = mags[k]
      if (m <= floor || m <= mags[k - 1] || m < mags[k + 1]) continue
      const denom = mags[k - 1] - 2 * m + mags[k + 1]
      const shift = denom === 0 ? 0 : (0.5 * (mags[k - 1] - mags[k + 1])) / denom
      const freq = ((k + shift) * sampleRate) / FFT_SIZE
      const level = Math.sqrt(m)
      let weight = 1
      for (let h = 1; h <= HARMONICS; h++, weight *= HARMONIC_DECAY) {
        const position = (freqToMidi(freq / h) - tuning - MIN_MIDI) * STEPS
        if (position < -0.5) break
        const bin = Math.round(position)
        if (bin >= BINS) continue
        bins[bin] += level * weight
        if (h % 2) odd[bin] += level * weight
        // A little to the neighbours: a peak rarely sits exactly on a grid step.
        if (bin > 0) bins[bin - 1] += level * weight * 0.5
        if (bin < BINS - 1) bins[bin + 1] += level * weight * 0.5
      }
    }
    for (let b = BINS - 1; b >= OCTAVE; b--) {
      if (odd[b - OCTAVE] >= OCTAVE_RATIO * bins[b]) bins[b] *= OCTAVE_DAMP
    }
    frames.push(bins)
  }

  // Put everything on a 0–1 scale relative to the loud, clear moments of this song.
  const peaks = frames.map((bins) => Math.max(...bins)).sort((a, b) => a - b)
  const reference = peaks[Math.floor(peaks.length * 0.95)] || 1
  for (const bins of frames) for (let b = 0; b < BINS; b++) bins[b] /= reference
  return frames
}

const UNVOICED = BINS

/**
 * One pitch (or silence) per frame, chosen so the whole track is both well
 * supported and smooth. Taking the strongest pitch frame by frame jumps
 * between voice, guitar and octave errors; a voice does not move like that.
 */
function track(frames: Float32Array[]): Int16Array {
  const n = frames.length
  const path = new Int16Array(n).fill(UNVOICED)
  if (!n) return path
  let best = new Float32Array(BINS + 1)
  best.set(frames[0])
  best[UNVOICED] = UNVOICED_SCORE
  const from: Int16Array[] = []

  for (let f = 1; f < n; f++) {
    let top = 0
    for (let b = 1; b < BINS; b++) if (best[b] > best[top]) top = b
    const next = new Float32Array(BINS + 1)
    const back = new Int16Array(BINS + 1)
    for (let b = 0; b < BINS; b++) {
      // Three ways to arrive at this pitch: a leap, a new note after silence, or a small move.
      let score = best[top] - LEAP_COST
      let prev = top
      if (best[UNVOICED] - ONSET_COST > score) {
        score = best[UNVOICED] - ONSET_COST
        prev = UNVOICED
      }
      const lo = Math.max(0, b - REACH)
      const hi = Math.min(BINS - 1, b + REACH)
      for (let p = lo; p <= hi; p++) {
        const candidate = best[p] - STEP_COST * Math.abs(p - b)
        if (candidate > score) {
          score = candidate
          prev = p
        }
      }
      next[b] = score + frames[f][b]
      back[b] = prev
    }
    const stay = best[UNVOICED]
    const stop = best[top] - ONSET_COST
    next[UNVOICED] = Math.max(stay, stop) + UNVOICED_SCORE
    back[UNVOICED] = stay >= stop ? UNVOICED : top
    from.push(back)
    best = next
  }

  let state = 0
  for (let b = 1; b <= BINS; b++) if (best[b] > best[state]) state = b
  path[n - 1] = state
  for (let f = n - 2; f >= 0; f--) {
    state = from[f][state]
    path[f] = state
  }
  return path
}

/** Turns the pitch track into notes: runs of frames that round to the same semitone. */
function toNotes(path: Int16Array, sampleRate: number): MelodyNote[] {
  const frameTime = HOP / sampleRate
  const centre = FFT_SIZE / 2 / sampleRate
  const n = path.length

  // Median over 5 frames (~0.1 s) irons out vibrato before rounding.
  const semis = new Int16Array(n).fill(-1)
  const windowValues: number[] = []
  for (let f = 0; f < n; f++) {
    if (path[f] === UNVOICED) continue
    windowValues.length = 0
    for (let g = Math.max(0, f - 2); g <= Math.min(n - 1, f + 2); g++) {
      if (path[g] !== UNVOICED) windowValues.push(path[g])
    }
    windowValues.sort((a, b) => a - b)
    semis[f] = MIN_MIDI + Math.round(windowValues[windowValues.length >> 1] / STEPS)
  }

  const notes: MelodyNote[] = []
  const time = (frame: number) => Math.max(0, frame * frameTime + centre - frameTime / 2)
  let runStart = 0
  for (let f = 1; f <= n; f++) {
    if (f < n && semis[f] === semis[runStart]) continue
    if (semis[runStart] >= 0) {
      const note = { start: time(runStart), end: time(f), midi: semis[runStart] }
      const last = notes[notes.length - 1]
      const tooShort = note.end - note.start < MIN_NOTE
      if (!tooShort) {
        notes.push(note)
      } else if (last && Math.abs(last.end - note.start) < 1e-6 && Math.abs(last.midi - note.midi) <= 1) {
        // A blip a semitone away, glued to the previous note: part of a slide into or out of it.
        last.end = note.end
      }
    }
    runStart = f
  }

  // Close hairline gaps left by dropped blips between two halves of the same note.
  const merged: MelodyNote[] = []
  for (const note of notes) {
    const last = merged[merged.length - 1]
    if (last && last.midi === note.midi && note.start - last.end < MIN_NOTE) last.end = note.end
    else merged.push(note)
  }
  return merged
}

/** `samples` is mono at a low rate (≈ 11 kHz). `tuningCents` comes from the chord analysis. */
export function extractMelody(samples: Float32Array, sampleRate: number, tuningCents = 0): MelodyNote[] {
  const frames = salience(samples, sampleRate, tuningCents / 100)
  return toNotes(track(frames), sampleRate)
}
