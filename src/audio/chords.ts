/**
 * Chord recognition from a recording.
 *
 * The pipeline is the classic one from the music-information-retrieval
 * literature (Fujishima 1999, and most systems after it):
 *
 *   audio → short-time spectrum → spectral peaks → 12-bin chroma
 *         → match against chord templates → smooth over time (Viterbi)
 *
 * It recognises the 24 major and minor triads. That is a deliberate limit:
 * a seventh chord shares three of its four notes with a triad, and telling
 * them apart reliably in a full mix needs a trained model, not templates.
 */

export interface ChordLabel {
  /** Pitch class of the root, 0 = C. */
  root: number
  minor: boolean
}

export interface Segment {
  /** Seconds. */
  start: number
  end: number
  /** null = no chord (silence, drums only, or nothing recognisable). */
  chord: ChordLabel | null
}

export interface Analysis {
  segments: Segment[]
  key: { tonic: number; minor: boolean }
  /** How far the recording sits from A = 440 Hz, in cents. */
  tuningCents: number
  duration: number
}

/** 4096 samples at 11 025 Hz ≈ 0.37 s: bins 2.7 Hz apart, enough to separate semitones at C2. */
const FFT_SIZE = 4096
const HOP = 1024
/** C2 … about F6: below is rumble, above is overtones, cymbals and the top of the melody. */
const MIN_FREQ = 65
const MAX_FREQ = 1400
/**
 * Harmony lives low, melody lives high. Peaks up to this frequency count in
 * full; above it they fade, so a voice or lead guitar cannot outvote the band.
 */
const HARMONY_CEILING = 330
/** Notes below this are the bass line, which nearly always plays the chord's root. */
const BASS_CEILING = 180
/** How much the bass note counts toward choosing the root. */
const BASS_WEIGHT = 0.35
/**
 * Frames on each side for the median filter (≈ ±0.75 s). A chord tone is
 * there for the whole chord; a melody note is gone in a fraction of a second
 * and the median simply never sees it.
 */
const SMOOTH = 8
/** Cost of changing chord between frames; higher = fewer, longer chords. */
const CHANGE_PENALTY = 0.6
/** Score given to "no chord"; a real chord has to beat it. */
const NO_CHORD_SCORE = 0.55
/** Segments shorter than this are absorbed by their neighbour. */
const MIN_SEGMENT = 0.75

/** In-place radix-2 FFT. `re`/`im` must have a power-of-two length. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const cos = Math.cos(step * k)
        const sin = Math.sin(step * k)
        const a = start + k
        const b = a + half
        const tr = re[b] * cos - im[b] * sin
        const ti = re[b] * sin + im[b] * cos
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

interface Peaks {
  /** Index into freq/mag where each frame starts; length = frames + 1. */
  offsets: number[]
  freq: number[]
  mag: number[]
}

/**
 * Spectral peaks of every frame. Keeping only the peaks (with their
 * interpolated frequency) instead of every bin throws away the noise floor
 * and lets us correct the tuning afterwards without a second FFT pass.
 */
function findPeaks(samples: Float32Array, sampleRate: number): Peaks {
  const window = new Float32Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))

  const kMin = Math.max(1, Math.floor((MIN_FREQ * FFT_SIZE) / sampleRate))
  const kMax = Math.min(FFT_SIZE / 2 - 2, Math.ceil((MAX_FREQ * FFT_SIZE) / sampleRate))
  const re = new Float32Array(FFT_SIZE)
  const im = new Float32Array(FFT_SIZE)
  const mags = new Float32Array(kMax + 2)
  const peaks: Peaks = { offsets: [0], freq: [], mag: [] }

  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[start + i] * window[i]
      im[i] = 0
    }
    fft(re, im)
    let max = 0
    for (let k = kMin - 1; k <= kMax + 1; k++) {
      mags[k] = Math.hypot(re[k], im[k])
      if (mags[k] > max) max = mags[k]
    }
    const floor = max * 0.05
    for (let k = kMin; k <= kMax; k++) {
      const m = mags[k]
      if (m <= floor || m <= mags[k - 1] || m < mags[k + 1]) continue
      // Parabolic interpolation: the true peak sits between bins.
      const denom = mags[k - 1] - 2 * m + mags[k + 1]
      const shift = denom === 0 ? 0 : (0.5 * (mags[k - 1] - mags[k + 1])) / denom
      peaks.freq.push(((k + shift) * sampleRate) / FFT_SIZE)
      peaks.mag.push(m)
    }
    peaks.offsets.push(peaks.freq.length)
  }
  return peaks
}

/**
 * Recordings are rarely at exactly A = 440 (tape speed, a guitar tuned by
 * ear, a half-step-down band). If every peak lands 30 cents sharp, half of
 * them round to the wrong semitone. The deviation from the nearest semitone
 * is an angle, so its average has to be a circular mean.
 */
function estimateTuning(peaks: Peaks): number {
  let c = 0
  let s = 0
  for (let i = 0; i < peaks.freq.length; i++) {
    const semis = 12 * Math.log2(peaks.freq[i] / 440)
    const angle = 2 * Math.PI * (semis - Math.round(semis))
    c += peaks.mag[i] * Math.cos(angle)
    s += peaks.mag[i] * Math.sin(angle)
  }
  return c === 0 && s === 0 ? 0 : Math.atan2(s, c) / (2 * Math.PI)
}

interface Chroma {
  /** Harmony: 12 pitch classes per frame, low register favoured. */
  chroma: Float32Array[]
  /** Bass register only. */
  bass: Float32Array[]
  energy: Float32Array
}

/** Folds each frame's peaks into 12 pitch classes: octaves are ignored on purpose. */
function chromagram(peaks: Peaks, tuning: number): Chroma {
  const frames = peaks.offsets.length - 1
  const chroma: Float32Array[] = []
  const bass: Float32Array[] = []
  const energy = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    const bins = new Float32Array(12)
    const low = new Float32Array(12)
    for (let i = peaks.offsets[f]; i < peaks.offsets[f + 1]; i++) {
      const freq = peaks.freq[i]
      const midi = 69 + 12 * Math.log2(freq / 440) - tuning
      const pc = ((Math.round(midi) % 12) + 12) % 12
      // Square root: a loud lead should count more than a quiet pad, not ten times more.
      const level = Math.sqrt(peaks.mag[i])
      const weight = freq <= HARMONY_CEILING ? 1 : (HARMONY_CEILING / freq) ** 1.5
      bins[pc] += level * weight
      if (freq <= BASS_CEILING) low[pc] += level
      energy[f] += peaks.mag[i]
    }
    chroma.push(bins)
    bass.push(low)
  }
  return { chroma, bass, energy }
}

/** Length of a three-note template vector, for the cosine similarity. */
const TEMPLATE_NORM = Math.sqrt(3)

/** Index 0–11 = major on that root, 12–23 = minor, 24 = no chord. */
const STATES = 25
const NO_CHORD = 24
const labelOf = (state: number): ChordLabel | null =>
  state === NO_CHORD ? null : { root: state % 12, minor: state >= 12 }

function scoreFrames({ chroma, bass, energy }: Chroma): Float32Array[] {
  // Anything far below the song's typical level is treated as silence.
  const sorted = Array.from(energy).sort((a, b) => a - b)
  const quiet = sorted[Math.floor(sorted.length * 0.9)] * 0.03

  const steady = new Float32Array(12)
  const low = new Float32Array(12)
  const column: number[] = []
  return chroma.map((_, f) => {
    const scores = new Float32Array(STATES)
    if (energy[f] <= quiet) {
      scores[NO_CHORD] = 1
      return scores
    }
    const from = Math.max(0, f - SMOOTH)
    const to = Math.min(chroma.length - 1, f + SMOOTH)
    low.fill(0)
    for (let pc = 0; pc < 12; pc++) {
      column.length = 0
      for (let g = from; g <= to; g++) {
        column.push(chroma[g][pc])
        low[pc] += bass[g][pc]
      }
      column.sort((a, b) => a - b)
      steady[pc] = column[column.length >> 1]
    }
    const norm = Math.hypot(...steady) || 1
    const lowTotal = low.reduce((a, b) => a + b, 0) || 1
    for (let root = 0; root < 12; root++) {
      const fifth = steady[(root + 7) % 12]
      const bassVote = (BASS_WEIGHT * low[root]) / lowTotal
      // Cosine similarity between the chroma and a root–third–fifth template.
      scores[root] = (steady[root] + steady[(root + 4) % 12] + fifth) / (norm * TEMPLATE_NORM) + bassVote
      scores[root + 12] = (steady[root] + steady[(root + 3) % 12] + fifth) / (norm * TEMPLATE_NORM) + bassVote
    }
    scores[NO_CHORD] = NO_CHORD_SCORE
    return scores
  })
}

/**
 * Picks the chord sequence that scores best overall while paying a price for
 * every change. Frame-by-frame "best match" flickers on every passing note;
 * this is what makes the result read like a chord chart.
 */
function viterbi(scores: Float32Array[]): number[] {
  const frames = scores.length
  if (!frames) return []
  let best = Float32Array.from(scores[0])
  const from: Uint8Array[] = []
  for (let f = 1; f < frames; f++) {
    let top = 0
    for (let s = 1; s < STATES; s++) if (best[s] > best[top]) top = s
    const next = new Float32Array(STATES)
    const back = new Uint8Array(STATES)
    for (let s = 0; s < STATES; s++) {
      // Either stay on the same chord, or jump from the best one and pay.
      const stay = best[s]
      const jump = best[top] - CHANGE_PENALTY
      back[s] = stay >= jump ? s : top
      next[s] = Math.max(stay, jump) + scores[f][s]
    }
    from.push(back)
    best = next
  }
  let state = 0
  for (let s = 1; s < STATES; s++) if (best[s] > best[state]) state = s
  const path = new Array<number>(frames)
  path[frames - 1] = state
  for (let f = frames - 2; f >= 0; f--) {
    state = from[f][state]
    path[f] = state
  }
  return path
}

function toSegments(path: number[], sampleRate: number, duration: number): Segment[] {
  const frameTime = HOP / sampleRate
  // A frame describes the window centred on it, not the instant it starts.
  const centre = FFT_SIZE / 2 / sampleRate
  const raw: { start: number; end: number; state: number }[] = []
  path.forEach((state, f) => {
    const last = raw[raw.length - 1]
    const end = Math.min(duration, (f + 1) * frameTime + centre - frameTime / 2)
    if (last && last.state === state) last.end = end
    else raw.push({ start: last ? last.end : 0, end, state })
  })
  if (raw.length) raw[raw.length - 1].end = duration

  const merged: typeof raw = []
  for (const seg of raw) {
    const last = merged[merged.length - 1]
    if (last && (seg.end - seg.start < MIN_SEGMENT || last.state === seg.state)) last.end = seg.end
    else merged.push({ ...seg })
  }
  return merged.map(({ start, end, state }) => ({ start, end, chord: labelOf(state) }))
}

// Krumhansl–Kessler key profiles: how strongly each scale degree is felt to
// belong to a major / minor key, from listening experiments.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlation(a: number[], b: number[]): number {
  const mean = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

function estimateKey(chroma: Float32Array[]): { tonic: number; minor: boolean } {
  const total = new Array<number>(12).fill(0)
  for (const frame of chroma) for (let pc = 0; pc < 12; pc++) total[pc] += frame[pc]
  let best = { tonic: 0, minor: false }
  let bestScore = -Infinity
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotated = total.map((_, i) => total[(i + tonic) % 12])
    for (const minor of [false, true]) {
      const score = correlation(rotated, minor ? MINOR_PROFILE : MAJOR_PROFILE)
      if (score > bestScore) {
        bestScore = score
        best = { tonic, minor }
      }
    }
  }
  return best
}

/** `samples` is mono. A low sample rate (≈ 11 kHz) is enough and much faster. */
export function analyseChords(samples: Float32Array, sampleRate: number): Analysis {
  const duration = samples.length / sampleRate
  const peaks = findPeaks(samples, sampleRate)
  const tuning = estimateTuning(peaks)
  const features = chromagram(peaks, tuning)
  const path = viterbi(scoreFrames(features))
  return {
    segments: toSegments(path, sampleRate, duration),
    key: estimateKey(features.chroma),
    tuningCents: tuning * 100,
    duration,
  }
}

export function chordName(chord: ChordLabel, noteNames: string[]): string {
  return `${noteNames[chord.root]}${chord.minor ? 'm' : ''}`
}
