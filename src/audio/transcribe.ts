/**
 * Polyphonic note transcription with Basic Pitch, Spotify's open-source model
 * (Bittner et al., 2022; Apache-2.0). Unlike a pitch tracker it reports every
 * note sounding at once, which is what a fingerpicked guitar needs.
 *
 * The model and TensorFlow.js are loaded on demand, so they only cost
 * anything to someone who actually analyses a song.
 */

export interface TranscribedNote {
  /** Seconds. */
  start: number
  end: number
  midi: number
  /** 0–1: how confident / loud the model found the note. */
  strength: number
}

/** The sample rate the model was trained on; other rates give wrong pitches. */
export const TRANSCRIBE_RATE = 22050

// The model's own defaults: how sure it must be that a note starts / continues,
// and the shortest note it may report (11 frames ≈ 0.13 s).
const ONSET_THRESHOLD = 0.5
const FRAME_THRESHOLD = 0.3
const MIN_NOTE_FRAMES = 11
/** About 20 s of model output per step (the model works in windows of 172 frames). */
const CHUNK_FRAMES = 172 * 10

/** `samples` is mono at TRANSCRIBE_RATE. `onProgress` receives 0–1. */
export async function transcribe(
  samples: Float32Array,
  onProgress: (fraction: number) => void,
): Promise<TranscribedNote[]> {
  const { BasicPitch, outputToNotesPoly, noteFramesToTime } = await import('@spotify/basic-pitch')
  const model = new BasicPitch(`${import.meta.env.BASE_URL}basic-pitch/model.json`)

  const frames: number[][] = []
  const onsets: number[][] = []
  await model.evaluateModel(
    samples,
    (f, o) => {
      frames.push(...f)
      onsets.push(...o)
    },
    onProgress,
  )

  // Turning the model's output into notes gets much slower as the input grows,
  // so it is done a stretch at a time and the frame numbers shifted back.
  const events = []
  for (let from = 0; from < frames.length; from += CHUNK_FRAMES) {
    const to = from + CHUNK_FRAMES
    const chunk = outputToNotesPoly(
      frames.slice(from, to),
      onsets.slice(from, to),
      ONSET_THRESHOLD,
      FRAME_THRESHOLD,
      MIN_NOTE_FRAMES,
    )
    for (const event of chunk) events.push({ ...event, startFrame: event.startFrame + from })
  }
  const notes = noteFramesToTime(events).map((note) => ({
    start: note.startTimeSeconds,
    end: note.startTimeSeconds + note.durationSeconds,
    midi: note.pitchMidi,
    strength: note.amplitude,
  }))
  return removeGhosts(notes)
}

/** C2 … E6: the bottom of a guitar to above anything sung or fretted. */
const LOWEST = 36
const HIGHEST = 88
/** Intervals at which a note's overtones sit: octave, octave + fifth, two octaves, two octaves + third. */
const OVERTONES = [12, 19, 24, 28]
/** Two notes this close in time (seconds) started together. */
const TOGETHER = 0.07

/**
 * The model sometimes reports a note's overtones as extra notes: a quieter
 * note an octave (or an octave and a fifth…) above, starting at the same
 * instant. This drops those, and anything outside a sensible range.
 */
export function removeGhosts(notes: TranscribedNote[]): TranscribedNote[] {
  const sorted = notes.filter((n) => n.midi >= LOWEST && n.midi <= HIGHEST).sort((a, b) => a.start - b.start)
  return sorted.filter((note, i) => {
    // Only neighbours in time can have started together; the list is sorted.
    for (let j = i - 1; j >= 0 && note.start - sorted[j].start < TOGETHER; j--) {
      if (isOvertoneOf(note, sorted[j])) return false
    }
    for (let j = i + 1; j < sorted.length && sorted[j].start - note.start < TOGETHER; j++) {
      if (isOvertoneOf(note, sorted[j])) return false
    }
    return true
  })
}

const isOvertoneOf = (note: TranscribedNote, base: TranscribedNote) =>
  OVERTONES.includes(note.midi - base.midi) && note.strength < base.strength

/**
 * Halves the sample rate (22 050 → 11 025 Hz) for the chord analysis.
 * The small three-tap average before dropping samples keeps content above
 * the new Nyquist from folding back as false notes.
 */
export function halveRate(samples: Float32Array): Float32Array {
  const out = new Float32Array(samples.length >> 1)
  for (let i = 0; i < out.length; i++) {
    const j = i * 2
    out[i] = 0.25 * (samples[j - 1] ?? samples[j]) + 0.5 * samples[j] + 0.25 * (samples[j + 1] ?? samples[j])
  }
  return out
}
