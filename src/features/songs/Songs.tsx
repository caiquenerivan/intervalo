import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { analyseChords, chordName, type Analysis, type ChordLabel } from '../../audio/chords'
import { playNote } from '../../audio/synth'
import { Fretboard } from '../../components/Fretboard'
import { Keyboard } from '../../components/Keyboard'
import { marksFromTones } from '../../components/marks'
import { Button, Chip, FieldLabel, PageHeader } from '../../components/ui'
import { useT } from '../../i18n'
import { buildTones, chordById } from '../../theory/formulas'
import { FLAT_NAMES, SHARP_NAMES, prefersFlats } from '../../theory/notes'

/**
 * Chords live below ~2 kHz, so the file is decoded straight to a low sample
 * rate: a quarter of the data, and each FFT window covers four times as long.
 */
const ANALYSIS_RATE = 11025
const MAX_MB = 60
const PX_PER_SECOND = 44

type State =
  | { phase: 'idle' }
  | { phase: 'decoding' | 'analysing'; name: string }
  | { phase: 'error'; message: string }
  | { phase: 'done'; name: string; url: string; analysis: Analysis }

async function decodeToMono(file: File): Promise<Float32Array> {
  // decodeAudioData resamples to the context's rate, so an offline context
  // at 11 kHz gives us the downsampled signal for free.
  const ctx = new OfflineAudioContext(1, 1, ANALYSIS_RATE)
  const audio = await ctx.decodeAudioData(await file.arrayBuffer())
  const mono = new Float32Array(audio.length)
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const data = audio.getChannelData(ch)
    for (let i = 0; i < mono.length; i++) mono[i] += data[i] / audio.numberOfChannels
  }
  return mono
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export function Songs() {
  const t = useT()
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Free the previous file's blob when it is replaced or the page is left.
  const url = state.phase === 'done' ? state.url : null
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const load = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      setState({ phase: 'error', message: t('songs.tooBig', { n: MAX_MB }) })
      return
    }
    setState({ phase: 'decoding', name: file.name })
    try {
      const mono = await decodeToMono(file)
      setState({ phase: 'analysing', name: file.name })
      // Let the "analysing" message paint before the main thread gets busy.
      await new Promise((resolve) => setTimeout(resolve, 30))
      const analysis = analyseChords(mono, ANALYSIS_RATE)
      setState({ phase: 'done', name: file.name, url: URL.createObjectURL(file), analysis })
    } catch {
      setState({ phase: 'error', message: t('songs.error') })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void load(e.dataTransfer.files[0])
  }

  const busy = state.phase === 'decoding' || state.phase === 'analysing'

  return (
    <div>
      <PageHeader title={t('songs.title')} intro={t('songs.intro')} />

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          void load(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {state.phase === 'done' ? (
        <Result
          key={state.url}
          name={state.name}
          url={state.url}
          analysis={state.analysis}
          onAnother={() => inputRef.current?.click()}
        />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragging ? 'border-accent bg-raised' : 'border-line bg-surface'
          }`}
        >
          {busy ? (
            <p className="text-lg" role="status">
              <span className="mr-2 inline-block animate-pulse">🎧</span>
              {t(state.phase === 'decoding' ? 'songs.decoding' : 'songs.analysing')}
              <span className="mt-1 block text-sm text-mute">{state.name}</span>
            </p>
          ) : (
            <>
              <Button onClick={() => inputRef.current?.click()} className="px-6 py-3 text-base">
                {t('songs.choose')}
              </Button>
              <p className="mt-3 text-sm text-mute">{t('songs.drop')}</p>
              {state.phase === 'error' && (
                <p className="mt-4 text-sm text-bad" role="alert">
                  {state.message}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-6 max-w-2xl text-sm text-mute">{t('songs.limits')}</p>
      <p className="mt-2 text-xs text-mute">{t('songs.privacy')}</p>
    </div>
  )
}

interface ResultProps {
  name: string
  url: string
  analysis: Analysis
  onAnother: () => void
}

function Result({ name, url, analysis, onAnother }: ResultProps) {
  const t = useT()
  const audioRef = useRef<HTMLAudioElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const [time, setTime] = useState(0)
  const [pinned, setPinned] = useState<ChordLabel | null>(null)

  const { segments, key, tuningCents, duration } = analysis
  // Spell the chords the way the song's key would: B♭ in F major, A♯ never.
  const names = prefersFlats(key.tonic, key.minor) ? FLAT_NAMES : SHARP_NAMES
  const label = (chord: ChordLabel | null) => (chord ? chordName(chord, names) : '—')

  // The <audio> element only reports time a few times a second; reading it
  // every frame keeps the playhead and the current chord in step.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = audioRef.current?.currentTime ?? 0
      setTime((prev) => (Math.abs(prev - now) > 0.02 ? now : prev))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const index = Math.max(
    0,
    segments.findIndex((s) => time < s.end),
  )
  const current = segments[index]
  const next = segments.slice(index + 1).find((s) => s.chord)

  // Keep the playhead in view without fighting someone who is scrolling by hand.
  const playheadX = time * PX_PER_SECOND
  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    if (playheadX < strip.scrollLeft || playheadX > strip.scrollLeft + strip.clientWidth - 60) {
      strip.scrollLeft = Math.max(0, playheadX - 60)
    }
  }, [playheadX])

  const used = useMemo(() => {
    const totals = new Map<string, { chord: ChordLabel; seconds: number }>()
    for (const s of segments) {
      if (!s.chord) continue
      const id = `${s.chord.root}-${s.chord.minor}`
      const entry = totals.get(id) ?? { chord: s.chord, seconds: 0 }
      entry.seconds += s.end - s.start
      totals.set(id, entry)
    }
    return [...totals.values()].sort((a, b) => b.seconds - a.seconds)
  }, [segments])

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds + 0.01
    setPinned(null)
    void audio.play()
  }

  const shown = pinned ?? current?.chord ?? null
  const marks = shown
    ? marksFromTones(buildTones(shown.root, chordById(shown.minor ? 'min' : 'maj')), 'notes')
    : {}
  const same = (a: ChordLabel | null, b: ChordLabel | null) => !!a && !!b && a.root === b.root && a.minor === b.minor
  const offTune = Math.abs(tuningCents) >= 10

  return (
    <div>
      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-sans text-lg font-bold">{name}</h2>
          <Button variant="ghost" onClick={onAnother}>
            {t('songs.another')}
          </Button>
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-mute">{t('songs.key')}</dt>
            <dd className="font-bold">
              {t(key.minor ? 'songs.keyMinor' : 'songs.keyMajor', { note: names[key.tonic] })}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-mute">{t('songs.tuning')}</dt>
            <dd className={offTune ? 'font-bold text-accent' : ''}>
              {offTune
                ? t('songs.tuningOff', { n: `${tuningCents > 0 ? '+' : ''}${Math.round(tuningCents)}` })
                : t('songs.tuningStd')}
            </dd>
          </div>
        </dl>
        <audio ref={audioRef} src={url} controls className="mt-4 w-full" />
      </div>

      <div className="mt-5 grid grid-cols-[2fr_1fr] gap-3">
        <div className="rounded-xl border border-accent bg-surface p-5">
          <FieldLabel>{t('songs.now')}</FieldLabel>
          <div className="font-display text-6xl font-semibold text-accent" aria-live="off">
            {current?.chord ? label(current.chord) : <span className="text-3xl text-mute">{t('songs.noChord')}</span>}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <FieldLabel>{t('songs.next')}</FieldLabel>
          <div className="font-display text-4xl font-semibold">{next ? label(next.chord) : '—'}</div>
          {next && <div className="mt-1 text-sm text-mute tabular-nums">{clock(next.start)}</div>}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>{t('songs.timeline')}</FieldLabel>
        <div ref={stripRef} className="overflow-x-auto rounded-xl border border-line bg-surface">
          <div className="relative h-20" style={{ width: Math.max(1, duration) * PX_PER_SECOND }}>
            {segments.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => seek(s.start)}
                title={`${clock(s.start)} · ${label(s.chord)}`}
                className={`absolute top-2 bottom-6 overflow-hidden rounded-md border text-sm font-bold transition ${
                  i === index
                    ? 'border-accent bg-accent text-ink'
                    : s.chord
                      ? 'border-line bg-raised hover:border-mute'
                      : 'border-transparent text-mute'
                }`}
                style={{ left: s.start * PX_PER_SECOND + 1, width: Math.max(2, (s.end - s.start) * PX_PER_SECOND - 2) }}
              >
                {s.chord ? label(s.chord) : ''}
              </button>
            ))}
            {Array.from({ length: Math.floor(duration / 10) + 1 }, (_, i) => (
              <span
                key={i}
                className="absolute bottom-1 text-[10px] text-mute tabular-nums"
                style={{ left: i * 10 * PX_PER_SECOND + 3 }}
              >
                {clock(i * 10)}
              </span>
            ))}
            <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-root" style={{ left: playheadX }} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>{t('songs.used')}</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {used.map(({ chord }) => (
            <Chip
              key={label(chord)}
              active={same(shown, chord)}
              onClick={() => setPinned(same(pinned, chord) ? null : chord)}
            >
              {label(chord)}
            </Chip>
          ))}
        </div>
      </div>

      {shown && (
        <div className="mt-5 grid gap-4 [&>*]:min-w-0">
          <Fretboard marks={marks} onNote={(m) => playNote(m, 'guitar')} label={t('explore.fretboard')} />
          <Keyboard marks={marks} onNote={(m) => playNote(m, 'piano')} label={t('explore.keyboard')} />
        </div>
      )}
    </div>
  )
}
