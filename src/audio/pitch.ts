/**
 * Pitch detection with the YIN algorithm (de Cheveigné & Kawahara, 2002).
 *
 * Why not just take the loudest FFT bin? A guitar's low E (82 Hz) often has a
 * second harmonic louder than its fundamental, and FFT bins at a 4096 window
 * are ~11 Hz wide — almost two semitones down there. YIN works in the time
 * domain: it looks for the lag (period) at which the signal best matches a
 * shifted copy of itself, which gives the fundamental directly and with
 * sub-sample precision.
 */

export interface PitchResult {
  /** Detected fundamental in Hz. */
  freq: number
  /** 0..1 — how periodic the signal is at that lag (1 = perfectly periodic). */
  clarity: number
}

export interface YinOptions {
  /** Lowest/highest frequency to look for. Defaults cover guitar with margin. */
  minFreq?: number
  maxFreq?: number
  /** Absolute threshold on the normalised difference (paper suggests 0.1–0.15). */
  threshold?: number
}

/** Root mean square level of a buffer — used to ignore silence. */
export function rms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  { minFreq = 60, maxFreq = 1200, threshold = 0.15 }: YinOptions = {},
): PitchResult | null {
  const half = Math.floor(buf.length / 2)
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq))
  const tauMax = Math.min(half - 1, Math.ceil(sampleRate / minFreq))
  if (tauMax <= tauMin) return null

  // Steps 1–3: difference function d(τ) = Σ (x[j] − x[j+τ])², then the
  // cumulative mean normalised difference d'(τ) = d(τ) · τ / Σ d(1..τ).
  // The normalisation removes the bias toward τ = 0 and makes the threshold
  // independent of signal level.
  const cmnd = new Float32Array(tauMax + 2)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let d = 0
    for (let j = 0; j < half; j++) {
      const delta = buf[j] - buf[j + tau]
      d += delta * delta
    }
    running += d
    cmnd[tau] = running === 0 ? 1 : (d * tau) / running
  }

  // Step 4: first dip below the threshold, followed down to its local minimum.
  // Taking the *first* dip (not the global minimum) is what avoids octave
  // errors: multiples of the true period dip just as low.
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  if (tau === -1) return null

  // Step 5: parabolic interpolation around the minimum for sub-sample accuracy.
  const a = cmnd[tau - 1]
  const b = cmnd[tau]
  const c = cmnd[tau + 1]
  const denom = a + c - 2 * b
  const shift = denom === 0 ? 0 : (a - c) / (2 * denom)
  const refined = tau + (Math.abs(shift) < 1 ? shift : 0)

  return { freq: sampleRate / refined, clarity: 1 - b }
}

/** Median of the last readings — kills single-frame outliers without lag. */
export function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
