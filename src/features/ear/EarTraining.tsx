import { useEffect, useRef, useState } from 'react'
import { Button, Chip, Meter, PageHeader } from '../../components/ui'
import { useT, type Key } from '../../i18n'
import { MAX_BOX, mastery, pickNext } from '../../store/srs'
import { useStore } from '../../store/useStore'
import { LEVELS, cardId, labelKey, makeQuestion, playQuestion, type EarKind, type Question } from './questions'

const MODE_KEY: Record<string, Key> = {
  asc: 'ear.ascending',
  desc: 'ear.descending',
  harm: 'ear.harmonic',
}

export function EarTraining() {
  const t = useT()
  const voice = useStore((s) => s.voice)
  const cards = useStore((s) => s.cards)
  const answerEar = useStore((s) => s.answerEar)

  const [kind, setKind] = useState<EarKind>('interval')
  const [levelIndex, setLevelIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [session, setSession] = useState({ correct: 0, total: 0 })
  const nextRef = useRef<HTMLButtonElement>(null)

  const level = LEVELS[kind][levelIndex]
  const ids = level.items.map((item) => cardId(kind, item))

  const reset = (k: EarKind, l: number) => {
    setKind(k)
    setLevelIndex(l)
    setQuestion(null)
    setChosen(null)
  }

  const ask = () => {
    // Read the freshest cards: the answer that was just given already moved one.
    const next = pickNext(ids, useStore.getState().cards, Date.now(), question ? cardId(kind, question.item) : undefined)
    const q = makeQuestion(kind, next.split(':')[1], level.modes)
    setQuestion(q)
    setChosen(null)
    playQuestion(q, voice)
  }

  const answer = (item: string) => {
    if (!question || chosen) return
    const correct = item === question.item
    setChosen(item)
    setSession((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }))
    answerEar(cardId(kind, question.item), correct)
  }

  useEffect(() => {
    if (chosen) nextRef.current?.focus()
  }, [chosen])

  const isRight = chosen !== null && chosen === question?.item

  return (
    <div>
      <PageHeader title={t('ear.title')} intro={t('ear.intro')} />

      <div className="grid gap-5 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex gap-1.5">
          <Chip active={kind === 'interval'} onClick={() => reset('interval', 0)}>
            {t('ear.intervals')}
          </Chip>
          <Chip active={kind === 'chord'} onClick={() => reset('chord', 0)}>
            {t('ear.chords')}
          </Chip>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS[kind].map((l, i) => {
            const m = mastery(
              l.items.map((item) => cardId(kind, item)),
              cards,
            )
            return (
              <button
                key={i}
                type="button"
                aria-pressed={i === levelIndex}
                onClick={() => reset(kind, i)}
                className={`rounded-lg border p-3 text-left transition ${
                  i === levelIndex ? 'border-accent bg-raised' : 'border-line hover:border-mute'
                }`}
              >
                <div className="text-sm font-bold">{t('ear.level', { n: i + 1 })}</div>
                <div className="mt-0.5 mb-3 min-h-10 text-sm text-mute">{t(l.desc)}</div>
                <Meter value={m} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-center sm:p-8">
        {!question ? (
          <Button onClick={ask} className="px-8 py-3 text-base">
            ▶ {t('ear.begin')}
          </Button>
        ) : (
          <>
            <h2 className="text-2xl font-semibold">{t(kind === 'interval' ? 'ear.q.interval' : 'ear.q.chord')}</h2>
            {kind === 'interval' && level.modes.length > 1 && (
              <p className="mt-1 text-sm text-mute">({t(MODE_KEY[question.mode])})</p>
            )}
            <div className="mt-4">
              <Button variant="ghost" onClick={() => playQuestion(question, voice)}>
                ↻ {t('ear.replay')}
              </Button>
            </div>

            <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
              {level.items.map((item) => {
                const box = cards[cardId(kind, item)]?.box ?? 0
                const isAnswer = chosen !== null && item === question.item
                const isMiss = chosen === item && !isRight
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={chosen !== null}
                    onClick={() => answer(item)}
                    className={`rounded-lg border px-3 py-3 text-sm font-bold transition ${
                      isAnswer
                        ? 'border-ok bg-ok/15 text-ok'
                        : isMiss
                          ? 'border-bad bg-bad/15 text-bad'
                          : 'border-line bg-raised enabled:hover:border-accent disabled:opacity-50'
                    }`}
                  >
                    {t(labelKey(kind, item))}
                    <span className="mt-1.5 flex justify-center gap-1" aria-label={`${t('ear.mastery')}: ${box}/${MAX_BOX}`}>
                      {Array.from({ length: MAX_BOX }, (_, i) => (
                        <span key={i} className={`h-1 w-3 rounded-full ${i < box ? 'bg-accent' : 'bg-line'}`} />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex min-h-12 items-center justify-center gap-4" aria-live="polite">
              {chosen !== null && (
                <>
                  <span className={`pop font-bold ${isRight ? 'text-ok' : 'text-bad'}`}>
                    {isRight ? t('ear.correct') : t('ear.wrong', { answer: t(labelKey(kind, question.item)) })}
                  </span>
                  <Button ref={nextRef} onClick={ask}>
                    {t('ear.next')} →
                  </Button>
                </>
              )}
            </div>
          </>
        )}
        {session.total > 0 && <p className="mt-4 text-sm text-mute">{t('ear.session', session)}</p>}
      </div>

    </div>
  )
}
