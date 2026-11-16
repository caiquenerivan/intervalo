import { midiToFreq } from '../theory/notes'

export type Voice = 'guitar' | 'piano'

/**
 * Plucked string via Karplus–Strong: a burst of noise circulating in a delay
 * line one period long, low-pass filtered on each pass. Cheap, and sounds far
 * more like a guitar than any plain oscillator.
 */
export function pluckSamples(freq: number, sampleRate: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.floor(sampleRate * seconds))
  const period = sampleRate / freq
  const n = Math.floor(period)
  // Fractional delay (linear interpolation) keeps high notes in tune.
  const frac = period - n
  const line = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) line[i] = Math.random() * 2 - 1
  // Higher strings ring shorter; damping is per pass through the loop.
  const damping = 0.996 - Math.min(0.006, freq / 200000)
  let idx = 0
  let prev = 0
  for (let i = 0; i < out.length; i++) {
    const next = (idx + 1) % (n + 1)
    const sample = line[idx] * (1 - frac) + line[next] * frac
    out[i] = sample
    line[idx] = damping * 0.5 * (sample + prev)
    prev = sample
    idx = next
  }
  return out
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const pluckCache = new Map<number, AudioBuffer>()

export function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    // A compressor keeps six-note strums from clipping.
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)
  }
  // Browsers start the context suspended until a user gesture.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function playPluck(ac: AudioContext, midi: number, when: number, duration: number) {
  let buffer = pluckCache.get(midi)
  if (!buffer) {
    const samples = pluckSamples(midiToFreq(midi), ac.sampleRate, 2.5)
    buffer = ac.createBuffer(1, samples.length, ac.sampleRate)
    buffer.getChannelData(0).set(samples)
    pluckCache.set(midi, buffer)
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.9, when)
  gain.gain.setValueAtTime(0.9, when + duration)
  gain.gain.linearRampToValueAtTime(0, when + duration + 0.08)
  src.connect(gain).connect(master!)
  src.start(when)
  src.stop(when + duration + 0.1)
}

/** Piano-ish tone: a few decaying partials, the higher ones dying faster. */
function playPiano(ac: AudioContext, midi: number, when: number, duration: number) {
  const freq = midiToFreq(midi)
  const partials = [1, 0.5, 0.25, 0.12, 0.06]
  const out = ac.createGain()
  out.gain.setValueAtTime(0.0001, when)
  out.gain.exponentialRampToValueAtTime(0.5, when + 0.008)
  out.gain.exponentialRampToValueAtTime(0.12, when + duration)
  out.gain.exponentialRampToValueAtTime(0.0001, when + duration + 0.25)
  out.connect(master!)
  partials.forEach((amp, i) => {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    // Real strings are slightly inharmonic; a touch of stretch adds life.
    osc.frequency.value = freq * (i + 1) * (1 + 0.0004 * i * i)
    const g = ac.createGain()
    g.gain.setValueAtTime(amp, when)
    g.gain.exponentialRampToValueAtTime(amp * 0.05, when + duration / (i + 1) + 0.05)
    osc.connect(g).connect(out)
    osc.start(when)
    osc.stop(when + duration + 0.3)
  })
}

export function playNote(midi: number, voice: Voice = 'piano', delay = 0, duration = 1.2) {
  const ac = audioContext()
  const when = ac.currentTime + 0.02 + delay
  if (voice === 'guitar') playPluck(ac, midi, when, duration)
  else playPiano(ac, midi, when, duration)
}

/** Notes one after another. Returns the total time in seconds. */
export function playSequence(midis: number[], voice: Voice, step = 0.4, duration = 0.9): number {
  midis.forEach((m, i) => playNote(m, voice, i * step, duration))
  return (midis.length - 1) * step + duration
}

/** Notes together; `strum` staggers them slightly like a pick across strings. */
export function playChord(midis: number[], voice: Voice, strum = 0.03, duration = 1.6): number {
  midis.forEach((m, i) => playNote(m, voice, i * strum, duration))
  return duration + midis.length * strum
}

/** Steady reference tone for tuning by ear. */
export function playReference(midi: number, seconds = 2) {
  playNote(midi, 'guitar', 0, seconds)
}
