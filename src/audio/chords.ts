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

export interface Key {
  tonic: number
  minor: boolean
}

export interface Analysis {
  segments: Segment[]
  key: Key
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
 * How finely to cut the song into chords. Without knowing where the beats
 * are, there is no single right answer: a bass run between two chords is a
 * "chord" at one setting and a passing note at another.
 */
export type Detail = 'simple' | 'detailed'

interface Preset {
  /**
   * Frames on each side for the median filter. A chord tone is there for the
   * whole chord; a melody or passing bass note is gone in a fraction of a
   * second and the median simply never sees it.
   */
  smooth: number
  /** Cost of changing chord between frames; higher = fewer, longer chords. */
  changePenalty: number
  /** Segments shorter than this (seconds) are absorbed by their neighbour. */
  minSegment: number
  /**
   * A chord shorter than this that sits between two stretches of the same
   * chord (E – C♯m – E) is a candidate fill: on a real recording that is
   * usually a guitar lick or a bass run over the held chord, not a change of
   * harmony. It is dropped when its notes fit the chord poorly (see
   * FILL_MAX_FIT). 0 keeps everything.
   */
  passing: number
}

const PRESETS: Record<Detail, Preset> = {
  simple: { smooth: 12, changePenalty: 1.2, minSegment: 1.2, passing: 2.6 }, // ≈ ±1.1 s
  detailed: { smooth: 6, changePenalty: 0.5, minSegment: 0.6, passing: 0 }, // ≈ ±0.55 s
}

/**
 * How well a candidate fill must match its chord (cosine, 0–1) to be kept.
 * A real chord has its three notes and little else; a lick read as a chord
 * has two of them plus loud notes from outside it.
 */
const FILL_MAX_FIT = 0.7

/** Extra score for chords that belong to the song's key. */
const KEY_BONUS = 0.1
/** Score given to "no chord"; a real chord has to beat it. */
const NO_CHORD_SCORE = 0.55
/** cos/sin tables per FFT size: computing them inside the butterflies is most of the cost. */
const twiddles = new Map<number, { cos: Float32Array; sin: Float32Array }>()

function twiddleTable(n: number) {
  let table = twiddles.get(n)
  if (!table) {
    table = { cos: new Float32Array(n / 2), sin: new Float32Array(n / 2) }
    for (let k = 0; k < n / 2; k++) {
      table.cos[k] = Math.cos((-2 * Math.PI * k) / n)
      table.sin[k] = Math.sin((-2 * Math.PI * k) / n)
    }
    twiddles.set(n, table)
  }
  return table
}

/** In-place radix-2 FFT. `re`/`im` must have a power-of-two length. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  const { cos, sin } = twiddleTable(n)
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
    const stride = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const c = cos[k * stride]
        const s = sin[k * stride]
        const a = start + k
        const b = a + half
        const tr = re[b] * c - im[b] * s
        const ti = re[b] * s + im[b] * c
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
      mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k])
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

/** The six triads built on the notes of a key (plus the major V in minor keys). */
function diatonicStates(key: Key): Set<number> {
  const degrees: [number, boolean][] = key.minor
    ? [[0, true], [3, false], [5, true], [7, true], [7, false], [8, false], [10, false]]
    : [[0, false], [2, true], [4, true], [5, false], [7, false], [9, true]]
  return new Set(degrees.map(([interval, minor]) => ((key.tonic + interval) % 12) + (minor ? 12 : 0)))
}

function scoreFrames({ chroma, bass, energy }: Chroma, key: Key, smooth: number): Float32Array[] {
  // A song mostly uses the chords of its key. This does not forbid the
  // others, it just asks for clearer evidence before showing one.
  const inKey = diatonicStates(key)

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
    const from = Math.max(0, f - smooth)
    const to = Math.min(chroma.length - 1, f + smooth)
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
    for (const state of inKey) scores[state] += KEY_BONUS
    scores[NO_CHORD] = NO_CHORD_SCORE
    return scores
  })
}

/**
 * Picks the chord sequence that scores best overall while paying a price for
 * every change. Frame-by-frame "best match" flickers on every passing note;
 * this is what makes the result read like a chord chart.
 */
function viterbi(scores: Float32Array[], changePenalty: number): number[] {
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
      const jump = best[top] - changePenalty
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

function toSegments(path: number[], sampleRate: number, duration: number, minSegment: number): Segment[] {
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
    if (last && (seg.end - seg.start < minSegment || last.state === seg.state)) last.end = seg.end
    else merged.push({ ...seg })
  }
  return merged.map(({ start, end, state }) => ({ start, end, chord: labelOf(state) }))
}

const sameChord = (a: ChordLabel | null, b: ChordLabel | null) =>
  !!a && !!b && a.root === b.root && a.minor === b.minor

/** Cosine match between a chord and the average chroma of a stretch of the song. */
function chordFit(p: Prepared, seg: Segment): number {
  if (!seg.chord) return 0
  const frameTime = HOP / p.sampleRate
  const centre = FFT_SIZE / 2 / p.sampleRate
  const { chroma } = p.features
  const from = Math.max(0, Math.round((seg.start - centre) / frameTime))
  const to = Math.min(chroma.length, Math.round((seg.end - centre) / frameTime))
  const mean = new Float32Array(12)
  for (let f = from; f < to; f++) for (let pc = 0; pc < 12; pc++) mean[pc] += chroma[f][pc]
  const { root, minor } = seg.chord
  const tones = mean[root] + mean[(root + (minor ? 3 : 4)) % 12] + mean[(root + 7) % 12]
  return tones / ((Math.hypot(...mean) || 1) * TEMPLATE_NORM)
}

/** Folds A – x – A into one A when x is a short, poorly fitting fill. Silence is never folded away. */
function absorbPassing(p: Prepared, segments: Segment[], maxLength: number): Segment[] {
  if (maxLength <= 0) return segments
  const out: Segment[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const before = out[out.length - 1]
    const after = segments[i + 1]
    const isFill =
      before &&
      after &&
      seg.chord &&
      seg.end - seg.start < maxLength &&
      sameChord(before.chord, after.chord) &&
      chordFit(p, seg) < FILL_MAX_FIT
    if (isFill) {
      before.end = after.end
      i++ // `after` is now part of `before`
    } else if (before && sameChord(before.chord, seg.chord)) {
      before.end = seg.end
    } else {
      out.push({ ...seg })
    }
  }
  return out
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

function estimateKey(chroma: Float32Array[]): Key {
  const total = new Array<number>(12).fill(0)
  for (const frame of chroma) for (let pc = 0; pc < 12; pc++) total[pc] += frame[pc]
  let best: Key = { tonic: 0, minor: false }
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

/** Everything worked out from the audio once; cutting it into chords again is then instant. */
export interface Prepared {
  features: Chroma
  key: Key
  tuningCents: number
  duration: number
  sampleRate: number
}

/** `samples` is mono. A low sample rate (≈ 11 kHz) is enough and much faster. */
export function prepare(samples: Float32Array, sampleRate: number): Prepared {
  const peaks = findPeaks(samples, sampleRate)
  const tuning = estimateTuning(peaks)
  const features = chromagram(peaks, tuning)
  return {
    features,
    key: estimateKey(features.chroma),
    tuningCents: tuning * 100,
    duration: samples.length / sampleRate,
    sampleRate,
  }
}

export function segment(p: Prepared, detail: Detail = 'simple'): Segment[] {
  const preset = PRESETS[detail]
  const path = viterbi(scoreFrames(p.features, p.key, preset.smooth), preset.changePenalty)
  return absorbPassing(p, toSegments(path, p.sampleRate, p.duration, preset.minSegment), preset.passing)
}

export function analyseChords(samples: Float32Array, sampleRate: number, detail: Detail = 'simple'): Analysis {
  const p = prepare(samples, sampleRate)
  return { segments: segment(p, detail), key: p.key, tuningCents: p.tuningCents, duration: p.duration }
}

export function chordName(chord: ChordLabel, noteNames: string[]): string {
  return `${noteNames[chord.root]}${chord.minor ? 'm' : ''}`
}
