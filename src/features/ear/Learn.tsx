import { useState } from 'react'
import { playChord, playNote, playSequence } from '../../audio/synth'
import { Keyboard } from '../../components/Keyboard'
import type { Marks } from '../../components/marks'
import { Button } from '../../components/ui'
import { useLang, useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { chordById, intervalById } from '../../theory/formulas'
import { noteName, prefersFlats } from '../../theory/notes'
import { CHORD_NOTES, INTERVAL_NOTES } from './learn'
import { labelKey, type EarKind } from './questions'

/**
 * Every example starts on the same note (middle C) so the only thing that
 * changes between two cards is the sound being taught.
 */
const ROOT = 60

function midisFor(kind: EarKind, item: string): number[] {
  return kind === 'chord'
    ? chordById(item).intervals.map((i) => ROOT + i)
    : [ROOT, ROOT + intervalById(item).semitones]
}

interface Props {
  kind: EarKind
  items: string[]
  onPractice: () => void
}

export function Learn({ kind, items, onPractice }: Props) {
  const t = useT()
  const lang = useLang()
  const voice = useStore((s) => s.voice)
  const [active, setActive] = useState(items[0])

  // The level can change under us; fall back to its first sound.
  const current = items.includes(active) ? active : items[0]
  const midis = midisFor(kind, current)
  // C minor-flavoured examples read as E♭/A♭/B♭, not D♯/G♯/A♯.
  const flats = kind === 'interval' || prefersFlats(0, chordById(current).minor)

  const marks: Marks = {}
  midis.forEach((m, i) => (marks[m % 12] = { label: noteName(m % 12, flats), root: i === 0 }))

  const play = (item: string, together: boolean) => {
    setActive(item)
    const notes = midisFor(kind, item)
    if (together) playChord(notes, voice, kind === 'chord' ? 0.02 : 0, 1.8)
    else playSequence(notes, voice, kind === 'chord' ? 0.4 : 0.75, 1.1)
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-mute">{t(kind === 'interval' ? 'ear.learn.intervals' : 'ear.learn.chords')}</p>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const note = (kind === 'interval' ? INTERVAL_NOTES : CHORD_NOTES)[item]
          const isActive = item === current
          return (
            <article
              key={item}
              className={`rounded-xl border bg-surface p-4 transition ${isActive ? 'border-accent' : 'border-line'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-sans text-lg font-bold">{t(labelKey(kind, item))}</h2>
                <span className="text-xs whitespace-nowrap text-mute">
                  {kind === 'interval'
                    ? t('ear.semitones', { n: intervalById(item).semitones })
                    : chordById(item).degrees.join(' – ')}
                </span>
              </div>
              <p className="mt-2">{note.feel[lang]}</p>
              <p className="mt-1.5 text-sm text-mute">
                <span className="font-bold text-accent">{t(kind === 'interval' ? 'ear.thinkOf' : 'ear.listenFor')}</span>{' '}
                {note.hook[lang]}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => play(item, false)}>
                  ▶ {t('ear.playMelodic')}
                </Button>
                <Button variant="ghost" onClick={() => play(item, true)}>
                  ▶ {t('ear.playHarmonic')}
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm text-mute">
          {t('ear.onKeyboard', { name: t(labelKey(kind, current)) })}
        </p>
        <Keyboard marks={marks} onNote={(m) => playNote(m, 'piano')} label={t('explore.keyboard')} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={onPractice} className="px-6 py-3 text-base">
          {t('ear.goPractice')} →
        </Button>
        <span className="text-sm text-mute">{t('ear.learn.tip')}</span>
      </div>
    </div>
  )
}
