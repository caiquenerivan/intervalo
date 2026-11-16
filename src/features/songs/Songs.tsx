import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { chordName, prepare, segment, type ChordLabel, type Detail, type Prepared } from '../../audio/chords'
import { playChord } from '../../audio/synth'
import { ChordBox } from '../../components/ChordBox'
import { Button, Chip, FieldLabel, PageHeader } from '../../components/ui'
import { useT } from '../../i18n'
import { GUITAR_TUNING } from '../../theory/instruments'
import { FLAT_NAMES, SHARP_NAMES, prefersFlats } from '../../theory/notes'
import { chordShape } from '../../theory/shapes'

/**
 * Chords live below ~2 kHz, so the file is decoded straight to a low sample
 * rate: a quarter of the data, and each FFT window covers four times as long.
 */
const ANALYSIS_RATE = 11025
const MAX_MB = 60
/** Seconds of music per row of the chart. Rows instead of one long strip: the whole song fits on screen. */
const ROW_SECONDS = 20
/** A chord heard for less than this share of the song is left out of the summary: usually a misreading. */
const MIN_SHARE = 0.03

type State =
  | { phase: 'idle' }
  | { phase: 'decoding' | 'analysing'; name: string }
  | { phase: 'error'; message: string }
  | { phase: 'done'; name: string; url: string; prepared: Prepared }

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
      const prepared = prepare(mono, ANALYSIS_RATE)
      setState({ phase: 'done', name: file.name, url: URL.createObjectURL(file), prepared })
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
          prepared={state.prepared}
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
  prepared: Prepared
  onAnother: () => void
}

function Result({ name, url, prepared, onAnother }: ResultProps) {
  const t = useT()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [time, setTime] = useState(0)
  const [detail, setDetail] = useState<Detail>('simple')

  const { key, tuningCents, duration } = prepared
  // The heavy work is done once; re-cutting at another level of detail is instant.
  const segments = useMemo(() => segment(prepared, detail), [prepared, detail])
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

  const used = useMemo(() => {
    const totals = new Map<string, { chord: ChordLabel; seconds: number }>()
    for (const s of segments) {
      if (!s.chord) continue
      const id = `${s.chord.root}-${s.chord.minor}`
      const entry = totals.get(id) ?? { chord: s.chord, seconds: 0 }
      entry.seconds += s.end - s.start
      totals.set(id, entry)
    }
    return [...totals.values()]
      .filter((entry) => entry.seconds >= duration * MIN_SHARE)
      .sort((a, b) => b.seconds - a.seconds)
  }, [segments, duration])

  const seek = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds + 0.01
    void audio.play()
  }

  const strum = (chord: ChordLabel) => {
    // Hearing the chord only makes sense when the song is not playing over it.
    if (!audioRef.current?.paused) return
    const midis = chordShape(chord.root, chord.minor).flatMap((fret, string) =>
      fret < 0 ? [] : [GUITAR_TUNING[string] + fret],
    )
    playChord(midis, 'guitar', 0.04, 2)
  }
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold tracking-widest text-mute uppercase">{t('songs.timeline')}</div>
          <div className="flex gap-1.5">
            <Chip active={detail === 'simple'} onClick={() => setDetail('simple')} title={t('songs.simpleHint')}>
              {t('songs.simple')}
            </Chip>
            <Chip active={detail === 'detailed'} onClick={() => setDetail('detailed')} title={t('songs.detailedHint')}>
              {t('songs.detailed')}
            </Chip>
          </div>
        </div>
        <div className="grid gap-1 rounded-xl border border-line bg-surface p-2">
          {Array.from({ length: Math.ceil(duration / ROW_SECONDS) }, (_, row) => {
            const rowStart = row * ROW_SECONDS
            const rowEnd = rowStart + ROW_SECONDS
            const inRow = time >= rowStart && time < rowEnd
            return (
              <div key={row} className="flex items-center gap-2">
                <span className={`w-9 shrink-0 text-right text-xs tabular-nums ${inRow ? 'font-bold text-accent' : 'text-mute'}`}>
                  {clock(rowStart)}
                </span>
                <div className="relative h-9 flex-1">
                  {segments.map((s, i) => {
                    // A chord that crosses the end of a row is drawn in both rows.
                    const from = Math.max(s.start, rowStart)
                    const to = Math.min(s.end, rowEnd)
                    if (to <= from) return null
                    const continues = s.start < rowStart
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => seek(from)}
                        title={`${clock(s.start)} · ${label(s.chord)}`}
                        className={`absolute inset-y-0 overflow-hidden rounded-md border px-1.5 text-left text-sm font-bold whitespace-nowrap transition ${
                          i === index
                            ? 'border-accent bg-accent text-ink'
                            : s.chord
                              ? 'border-line bg-raised hover:border-mute'
                              : 'border-transparent'
                        }`}
                        style={{
                          left: `calc(${((from - rowStart) / ROW_SECONDS) * 100}% + 1px)`,
                          width: `calc(${((to - from) / ROW_SECONDS) * 100}% - 2px)`,
                        }}
                      >
                        {s.chord && <span className={continues ? 'opacity-40' : ''}>{label(s.chord)}</span>}
                      </button>
                    )
                  })}
                  {inRow && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-root"
                      style={{ left: `${((time - rowStart) / ROW_SECONDS) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>{t('songs.used')}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {used.map(({ chord }) => (
            <ChordBox
              key={label(chord)}
              name={label(chord)}
              shape={chordShape(chord.root, chord.minor)}
              active={same(current?.chord ?? null, chord)}
              onClick={() => strum(chord)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
