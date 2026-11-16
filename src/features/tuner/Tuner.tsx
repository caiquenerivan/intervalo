import { useEffect, useRef, useState } from 'react'
import { playReference } from '../../audio/synth'
import { Button, Chip, FieldLabel, PageHeader } from '../../components/ui'
import { useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { GUITAR_TUNING, nearestString } from '../../theory/instruments'
import { centsOff, midiLabel, midiToFreq } from '../../theory/notes'
import { useTuner } from './useTuner'

/** Within ±5 cents is closer than most ears (and most guitars) can tell. */
const IN_TUNE_CENTS = 5
/** The needle must stay in the green this long to count as tuned. */
const STABLE_MS = 800
const RANGE = 50

/** Strings listed the way guitarists number them: 6 (low E) to 1 (high E). */
const STRINGS = GUITAR_TUNING.map((midi, index) => ({ index, midi, number: 6 - index }))

export function Tuner() {
  const t = useT()
  const { status, freq, start, stop } = useTuner()
  const markTuned = useStore((s) => s.markTuned)
  const [manual, setManual] = useState<number | null>(null)
  const [tuned, setTuned] = useState<number[]>([])
  const inTuneSince = useRef<number | null>(null)

  const target = manual ?? (freq ? nearestString(freq) : null)
  const cents = freq && target !== null ? centsOff(freq, GUITAR_TUNING[target]) : null
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS

  useEffect(() => {
    if (!inTune || target === null) {
      inTuneSince.current = null
      return
    }
    inTuneSince.current ??= performance.now()
    if (performance.now() - inTuneSince.current >= STABLE_MS && !tuned.includes(target)) {
      setTuned((list) => [...list, target])
      markTuned()
    }
  }, [inTune, target, freq, tuned, markTuned])

  const clamped = cents === null ? 0 : Math.max(-RANGE, Math.min(RANGE, cents))
  const angle = (clamped / RANGE) * 60
  const colour = cents === null ? 'var(--color-mute)' : inTune ? 'var(--color-ok)' : 'var(--color-accent)'

  const hint =
    status !== 'listening'
      ? ''
      : cents === null
        ? t('tuner.listening')
        : inTune
          ? t('tuner.inTune')
          : cents < 0
            ? t('tuner.low')
            : t('tuner.high')

  return (
    <div>
      <PageHeader title={t('tuner.title')} intro={t('tuner.intro')} />

      <div className="rounded-xl border border-line bg-surface p-5 sm:p-8">
        <div className="mx-auto max-w-md text-center">
          <svg viewBox="0 0 300 175" className="w-full" role="img" aria-label={hint}>
            {Array.from({ length: 21 }, (_, i) => {
              const c = -RANGE + i * 5
              const a = ((c / RANGE) * 60 * Math.PI) / 180
              const major = c % 25 === 0
              const r1 = major ? 112 : 120
              const green = Math.abs(c) <= IN_TUNE_CENTS
              return (
                <line
                  key={c}
                  x1={150 + r1 * Math.sin(a)}
                  y1={160 - r1 * Math.cos(a)}
                  x2={150 + 130 * Math.sin(a)}
                  y2={160 - 130 * Math.cos(a)}
                  stroke={green ? 'var(--color-ok)' : 'var(--color-line)'}
                  strokeWidth={major || green ? 3 : 2}
                  strokeLinecap="round"
                />
              )
            })}
            <text x={34} y={112} fontSize={12} fill="var(--color-mute)" textAnchor="middle">
              −50
            </text>
            <text x={266} y={112} fontSize={12} fill="var(--color-mute)" textAnchor="middle">
              +50
            </text>
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '150px 160px', transition: 'transform 90ms linear' }}>
              <line x1={150} y1={160} x2={150} y2={42} stroke={colour} strokeWidth={3} strokeLinecap="round" />
            </g>
            <circle cx={150} cy={160} r={7} fill={colour} />
          </svg>

          <div className="mt-2 font-display text-6xl font-semibold" style={{ color: colour }}>
            {target !== null ? midiLabel(GUITAR_TUNING[target]) : '—'}
          </div>
          <div className="mt-1 min-h-6 text-sm text-mute tabular-nums">
            {freq && cents !== null
              ? `${freq.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} ${t('tuner.cents')}`
              : target !== null
                ? `${midiToFreq(GUITAR_TUNING[target]).toFixed(1)} Hz`
                : ''}
          </div>
          <div className="mt-2 min-h-7 text-lg font-bold" style={{ color: colour }} aria-live="polite">
            {hint}
          </div>

          <div className="mt-5">
            {status === 'listening' ? (
              <Button variant="ghost" onClick={stop}>
                ■ {t('tuner.stop')}
              </Button>
            ) : (
              <Button onClick={start} className="px-6 py-3 text-base">
                🎙 {t('tuner.start')}
              </Button>
            )}
          </div>
          {status === 'denied' && <p className="mt-4 text-sm text-bad">{t('tuner.denied')}</p>}
          {status === 'unsupported' && <p className="mt-4 text-sm text-bad">{t('tuner.unsupported')}</p>}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-1.5">
          <Chip active={manual === null} onClick={() => setManual(null)}>
            {t('tuner.auto')}
          </Chip>
          {STRINGS.map((s) => (
            <Chip
              key={s.index}
              active={manual === s.index}
              onClick={() => setManual(s.index)}
              title={t('tuner.string', { n: s.number })}
            >
              <span className="text-xs opacity-70">{s.number}</span> {midiLabel(s.midi)}
              {tuned.includes(s.index) && <span className="ml-1 text-ok">✓</span>}
            </Chip>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-mute">{t('tuner.privacy')}</p>
      </div>

      <div className="mt-6">
        <FieldLabel>{t('tuner.reference')}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {STRINGS.map((s) => (
            <Button key={s.index} variant="ghost" onClick={() => playReference(s.midi)}>
              ▶ {midiLabel(s.midi)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
