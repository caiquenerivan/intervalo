import { useMemo } from 'react'
import type { ChordLabel, Segment } from '../../audio/chords'
import { playNote } from '../../audio/synth'
import type { TranscribedNote } from '../../audio/transcribe'
import { useT } from '../../i18n'
import { isBlackKey } from '../../theory/instruments'

/** Seconds shown at once. Short enough that a quick note is still wide enough to carry its name. */
const WINDOW_SECONDS = 10
/** Height of one semitone row, in px: enough for a legible note name. */
const ROW = 14
const GUTTER = 44

interface Props {
  notes: TranscribedNote[]
  segments: Segment[]
  time: number
  /** Note names in the song's spelling (F♯ in E major, G♭ in D♭ major). */
  names: string[]
  chordLabel: (chord: ChordLabel | null) => string
  onSeek: (seconds: number) => void
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/**
 * The notes of the stretch being played, laid out like a piano on its side:
 * one row per key, named on the left, with the black keys (sharps and flats)
 * shaded. Every note carries its own name, so nothing has to be counted.
 */
export function NoteRoll({ notes, segments, time, names, chordLabel, onSeek }: Props) {
  const t = useT()

  // One fixed range for the whole song: the rows must not jump from page to page.
  const range = useMemo(() => {
    let low = Infinity
    let high = -Infinity
    for (const note of notes) {
      low = Math.min(low, note.midi)
      high = Math.max(high, note.midi)
    }
    return { low: low - 1, high: high + 1 }
  }, [notes])

  const start = Math.floor(time / WINDOW_SECONDS) * WINDOW_SECONDS
  const end = start + WINDOW_SECONDS
  const lastStart = Math.floor((notes[notes.length - 1]?.end ?? 0) / WINDOW_SECONDS) * WINDOW_SECONDS
  const rows = range.high - range.low + 1
  const x = (seconds: number) => `${((seconds - start) / WINDOW_SECONDS) * 100}%`
  const y = (midi: number) => (range.high - midi) * ROW
  const name = (midi: number) => names[midi % 12]
  const octave = (midi: number) => Math.floor(midi / 12) - 1

  const visible = notes.filter((note) => note.end > start && note.start < end)

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold tracking-widest text-mute uppercase">
          {t('songs.notesTitle', { from: clock(start), to: clock(end) })}
        </div>
        <div className="flex items-center gap-3 text-xs text-mute">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-accent" /> {t('songs.natural')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded-sm bg-sharp" /> {t('songs.accidental')}
          </span>
          <span className="flex overflow-hidden rounded-md border border-line font-bold">
            <button
              type="button"
              disabled={start <= 0}
              onClick={() => onSeek(Math.max(0, start - WINDOW_SECONDS))}
              aria-label={t('songs.prevPage')}
              className="px-2.5 py-1 text-text enabled:hover:bg-raised disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              disabled={start >= lastStart}
              onClick={() => onSeek(end)}
              aria-label={t('songs.nextPage')}
              className="border-l border-line px-2.5 py-1 text-text enabled:hover:bg-raised disabled:opacity-30"
            >
              →
            </button>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {/* The chords of this stretch, on the same time scale as the notes below. */}
        <div className="relative h-7 border-b border-line" style={{ marginLeft: GUTTER }}>
          {segments.map((s, i) => {
            const from = Math.max(s.start, start)
            const to = Math.min(s.end, end)
            if (to <= from || !s.chord) return null
            return (
              <span
                key={i}
                className="absolute inset-y-0 flex items-center border-l border-line pl-1.5 text-sm font-bold"
                style={{ left: x(from), width: `${((to - from) / WINDOW_SECONDS) * 100}%` }}
              >
                {chordLabel(s.chord)}
              </span>
            )
          })}
        </div>

        <div className="relative flex" style={{ height: rows * ROW }}>
          {/* The keyboard, on its side: tap a key to hear it. */}
          <div className="shrink-0 border-r border-line" style={{ width: GUTTER }}>
            {Array.from({ length: rows }, (_, i) => {
              const midi = range.high - i
              const black = isBlackKey(midi)
              return (
                <button
                  key={midi}
                  type="button"
                  onClick={() => playNote(midi, 'piano')}
                  title={`${name(midi)}${octave(midi)}`}
                  className={`block w-full pr-1.5 text-right text-[10px] leading-none tabular-nums ${
                    black ? 'bg-ink text-sharp' : 'bg-raised text-text hover:bg-line'
                  } ${midi % 12 === 0 ? 'font-bold' : ''}`}
                  style={{ height: ROW }}
                >
                  {name(midi)}
                  {/* The octave number only on C, where each octave begins. */}
                  {midi % 12 === 0 && <span className="text-mute">{octave(midi)}</span>}
                </button>
              )
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            {Array.from({ length: rows }, (_, i) => {
              const midi = range.high - i
              return (
                <div
                  key={midi}
                  className={`absolute inset-x-0 ${isBlackKey(midi) ? 'bg-ink/70' : ''} ${
                    midi % 12 === 0 ? 'border-b border-line' : ''
                  }`}
                  style={{ top: i * ROW, height: ROW }}
                />
              )
            })}
            {Array.from({ length: WINDOW_SECONDS - 1 }, (_, i) => (
              <div key={i} className="absolute inset-y-0 w-px bg-line/60" style={{ left: `${(i + 1) * 10}%` }} />
            ))}

            {visible.map((note, i) => {
              const from = Math.max(note.start, start)
              const to = Math.min(note.end, end)
              const sounding = time >= note.start && time < note.end
              const black = isBlackKey(note.midi)
              return (
                <button
                  key={`${note.start}-${note.midi}-${i}`}
                  type="button"
                  onClick={() => playNote(note.midi, 'piano')}
                  title={`${clock(note.start)} · ${name(note.midi)}${octave(note.midi)}`}
                  className={`absolute overflow-hidden rounded-[3px] pl-0.5 text-left text-[10px] leading-none font-bold whitespace-nowrap text-ink ${
                    black ? 'bg-sharp' : 'bg-accent'
                  } ${sounding ? 'z-10 ring-2 ring-text' : ''}`}
                  style={{
                    left: x(from),
                    // Never narrower than the name it has to carry.
                    width: `max(${black ? 20 : 12}px, ${((to - from) / WINDOW_SECONDS) * 100}%)`,
                    top: y(note.midi) + 1,
                    height: ROW - 2,
                    // Fainter = the model was less sure of the note.
                    opacity: sounding ? 1 : 0.45 + 0.55 * Math.min(1, note.strength * 1.6),
                  }}
                >
                  {name(note.midi)}
                </button>
              )
            })}

            {time >= start && time < end && (
              <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-root" style={{ left: x(time) }} />
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-xs text-mute">{t('songs.notesLegend')}</p>
    </div>
  )
}
