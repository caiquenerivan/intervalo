/// <reference lib="webworker" />
import { prepare, type Prepared } from './chords'
import { extractMelody, type MelodyNote } from './melody'

/**
 * The analysis takes several seconds on a full song. Running it here keeps
 * the page responsive; on the main thread the tab would freeze meanwhile.
 */
export interface AnalysisRequest {
  samples: Float32Array
  sampleRate: number
}

export type AnalysisMessage =
  | { type: 'progress'; stage: 'chords' | 'melody' }
  | { type: 'done'; prepared: Prepared; melody: MelodyNote[] }
  | { type: 'error' }

const post = (message: AnalysisMessage) => (self as DedicatedWorkerGlobalScope).postMessage(message)

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    const { samples, sampleRate } = event.data
    post({ type: 'progress', stage: 'chords' })
    const prepared = prepare(samples, sampleRate)
    post({ type: 'progress', stage: 'melody' })
    const melody = extractMelody(samples, sampleRate, prepared.tuningCents)
    post({ type: 'done', prepared, melody })
  } catch {
    post({ type: 'error' })
  }
}
