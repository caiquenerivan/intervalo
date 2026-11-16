import { useEffect, useMemo, useState } from 'react'
import { playChord, playNote, playSequence } from '../../audio/synth'
import { Fretboard } from '../../components/Fretboard'
import { Keyboard } from '../../components/Keyboard'
import { marksFromTones } from '../../components/marks'
import { Button, Chip, FieldLabel, PageHeader } from '../../components/ui'
import { useT, type Key } from '../../i18n'
import { useStore } from '../../store/useStore'
import { CHORDS, SCALES, buildTones, formulaMidis } from '../../theory/formulas'
import { FLAT_NAMES, SHARP_NAMES } from '../../theory/notes'

type Kind = 'chord' | 'scale'

export function Explorer() {
  const t = useT()
  const voice = useStore((s) => s.voice)
  const setVoice = useStore((s) => s.setVoice)
  const markExplored = useStore((s) => s.markExplored)

  const [tonic, setTonic] = useState(0)
  const [kind, setKind] = useState<Kind>('chord')
  const [chordId, setChordId] = useState('maj')
  const [scaleId, setScaleId] = useState('major')
  const [show, setShow] = useState<'notes' | 'degrees'>('notes')

  const list = kind === 'chord' ? CHORDS : SCALES
  const id = kind === 'chord' ? chordId : scaleId
  const formula = list.find((f) => f.id === id)!
  const tones = useMemo(() => buildTones(tonic, formula), [tonic, formula])
  const marks = useMemo(() => marksFromTones(tones, show), [tones, show])

  useEffect(() => {
    markExplored(`${kind}:${tonic}:${id}`)
  }, [kind, tonic, id, markExplored])

  const play = () => {
    // Guitar starts on the low E string's octave; piano around middle C.
    const midis = formulaMidis(tonic, formula, voice === 'guitar' ? 40 : 48)
    if (kind === 'chord') {
      playSequence(midis, voice, 0.28, 0.8)
      window.setTimeout(() => playChord(midis, voice), midis.length * 280 + 150)
    } else {
      playSequence([...midis, midis[0] + 12], voice, 0.3, 0.7)
    }
  }

  const name = t(`${kind}.${id}` as Key)

  return (
    <div>
      <PageHeader title={t('explore.title')} intro={t('explore.intro')} />

      <div className="grid gap-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div>
          <FieldLabel>{t('explore.tonic')}</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {SHARP_NAMES.map((sharp, pc) => (
              <Chip key={pc} active={tonic === pc} onClick={() => setTonic(pc)}>
                {sharp === FLAT_NAMES[pc] ? sharp : `${sharp}/${FLAT_NAMES[pc]}`}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex gap-4">
            {(['chord', 'scale'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`border-b-2 pb-1 text-xs font-bold tracking-widest uppercase ${
                  kind === k ? 'border-accent text-text' : 'border-transparent text-mute hover:text-text'
                }`}
              >
                {t(k === 'chord' ? 'explore.chords' : 'explore.scales')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {list.map((f) => (
              <Chip
                key={f.id}
                active={f.id === id}
                onClick={() => (kind === 'chord' ? setChordId(f.id) : setScaleId(f.id))}
              >
                {t(`${kind}.${f.id}` as Key)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <FieldLabel>{t('explore.labels')}</FieldLabel>
            <div className="flex gap-1.5">
              <Chip active={show === 'notes'} onClick={() => setShow('notes')}>
                {t('explore.labelNotes')}
              </Chip>
              <Chip active={show === 'degrees'} onClick={() => setShow('degrees')}>
                {t('explore.labelDegrees')}
              </Chip>
            </div>
          </div>
          <div>
            <FieldLabel>{t('explore.sound')}</FieldLabel>
            <div className="flex gap-1.5">
              <Chip active={voice === 'guitar'} onClick={() => setVoice('guitar')}>
                {t('voice.guitar')}
              </Chip>
              <Chip active={voice === 'piano'} onClick={() => setVoice('piano')}>
                {t('voice.piano')}
              </Chip>
            </div>
          </div>
        </div>
      </div>

      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            {tones[0].name} <span className="text-mute">{name}</span>
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tones.map((tone) => (
              <span
                key={tone.interval}
                className="flex items-baseline gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1"
              >
                <span className={`font-bold ${tone.interval === 0 ? 'text-root' : 'text-accent'}`}>{tone.name}</span>
                <span className="text-xs text-mute">{tone.degree}</span>
              </span>
            ))}
          </div>
        </div>
        <Button onClick={play}>▶ {t('explore.play')}</Button>
      </div>

      <div className="grid gap-5 [&>*]:min-w-0">
        <section>
          <FieldLabel>{t('explore.fretboard')}</FieldLabel>
          <Fretboard marks={marks} onNote={(m) => playNote(m, 'guitar')} label={t('explore.fretboard')} />
        </section>
        <section>
          <FieldLabel>{t('explore.keyboard')}</FieldLabel>
          <Keyboard marks={marks} onNote={(m) => playNote(m, 'piano')} label={t('explore.keyboard')} />
        </section>
      </div>
    </div>
  )
}
