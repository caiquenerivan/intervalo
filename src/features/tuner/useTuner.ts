import { useCallback, useEffect, useRef, useState } from 'react'
import { detectPitch, median, rms } from '../../audio/pitch'
import { audioContext } from '../../audio/synth'

export type TunerStatus = 'idle' | 'listening' | 'denied' | 'unsupported'

/** 4096 samples ≈ 85 ms at 48 kHz: about 7 periods of the low E string. */
const WINDOW = 4096
/** Below this level it is room noise, not a string. */
const SILENCE_RMS = 0.01
/** YIN clarity below this is a guess (attack noise, two strings ringing). */
const MIN_CLARITY = 0.85
/** Readings kept for the median filter. */
const SMOOTHING = 5
/** Keep showing the last reading for a moment after the note fades. */
const HOLD_MS = 1200

export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>('idle')
  const [freq, setFreq] = useState<number | null>(null)
  const stopRef = useRef<() => void>(() => {})

  const stop = useCallback(() => {
    stopRef.current()
    stopRef.current = () => {}
    setFreq(null)
    setStatus((s) => (s === 'listening' ? 'idle' : s))
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    let stream: MediaStream
    try {
      // The browser's voice-call processing fights a tuner: noise suppression
      // treats a sustained string as noise and gain control pumps the level.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch {
      setStatus('denied')
      return
    }

    const ac = audioContext()
    const source = ac.createMediaStreamSource(stream)
    const analyser = ac.createAnalyser()
    analyser.fftSize = WINDOW
    // Not connected to the destination: we only read it, never play it back.
    source.connect(analyser)

    const buf = new Float32Array(WINDOW)
    const recent: number[] = []
    let lastHeard = 0
    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      analyser.getFloatTimeDomainData(buf)
      const now = performance.now()
      const pitch = rms(buf) > SILENCE_RMS ? detectPitch(buf, ac.sampleRate, { minFreq: 60, maxFreq: 1000 }) : null
      if (pitch && pitch.clarity >= MIN_CLARITY) {
        // A jump of more than a semitone means a different string: start over
        // instead of averaging the two.
        if (recent.length && Math.abs(Math.log2(pitch.freq / recent[recent.length - 1])) > 1 / 12) recent.length = 0
        recent.push(pitch.freq)
        if (recent.length > SMOOTHING) recent.shift()
        lastHeard = now
        setFreq(median(recent))
      } else if (now - lastHeard > HOLD_MS) {
        recent.length = 0
        setFreq(null)
      }
    }
    tick()

    stopRef.current = () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      stream.getTracks().forEach((track) => track.stop())
    }
    setStatus('listening')
  }, [])

  // Release the microphone when leaving the page.
  useEffect(() => () => stopRef.current(), [])

  return { status, freq, start, stop }
}
