/// <reference lib="webworker" />
import { transcribe, type TranscribedNote } from './transcribe'

/**
 * The note model runs for a long time (tens of seconds to minutes). In a
 * worker the page keeps responding; TensorFlow.js still gets the GPU here
 * through an OffscreenCanvas where the browser supports it.
 */
export type TranscribeMessage =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; notes: TranscribedNote[] }
  | { type: 'error' }

// Basic Pitch reaches for `window` in a couple of places; in a worker the
// global object is `self`, which has everything it actually uses.
const scope = self as unknown as { window?: unknown }
scope.window ??= self

const post = (message: TranscribeMessage) => (self as DedicatedWorkerGlobalScope).postMessage(message)

self.onmessage = async (event: MessageEvent<Float32Array>) => {
  try {
    const notes = await transcribe(event.data, (fraction) => post({ type: 'progress', fraction }))
    post({ type: 'done', notes })
  } catch (error) {
    console.error(error)
    post({ type: 'error' })
  }
}
