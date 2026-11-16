/// <reference lib="webworker" />
import { prepare, type Prepared } from './chords'

/**
 * The chord analysis takes a second or more on a full song. Running it here
 * keeps the page responsive; on the main thread the tab would freeze meanwhile.
 */
export interface AnalysisRequest {
  samples: Float32Array
  sampleRate: number
}

export type AnalysisMessage = { type: 'done'; prepared: Prepared } | { type: 'error' }

const post = (message: AnalysisMessage) => (self as DedicatedWorkerGlobalScope).postMessage(message)

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    post({ type: 'done', prepared: prepare(event.data.samples, event.data.sampleRate) })
  } catch {
    post({ type: 'error' })
  }
}
