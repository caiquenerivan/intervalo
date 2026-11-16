import { useState } from 'react'
import { playNote } from '../../audio/synth'
import { Fretboard } from '../../components/Fretboard'
import { Keyboard } from '../../components/Keyboard'
import type { Marks } from '../../components/marks'
import { Button } from '../../components/ui'
import { useLang, useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { noteName, pitchClass } from '../../theory/notes'
import { cardId, labelKey, makeQuestion, playQuestion, type Question } from '../ear/questions'
import type { Diagram, Instrument, Step } from './content'

/** Called once per question: was it right on the first try? */
type OnAnswer = (firstTry: boolean) => void

interface StepProps<S> {
  step: S
  onAnswer: OnAnswer
  /** The step has nothing left to ask; the player may move on. */
  onSolved: () => void
}

interface InstrumentViewProps {
  instrument: Instrument
  marks: Marks
  onNote?: (midi: number) => void
  frets?: [number, number]
}

function InstrumentView({ instrument, marks, onNote, frets }: InstrumentViewProps) {
  const t = useT()
  const play = (midi: number) => {
    playNote(midi, instrument === 'fretboard' ? 'guitar' : 'piano')
    onNote?.(midi)
  }
  return instrument === 'fretboard' ? (
    <Fretboard marks={marks} onNote={play} label={t('explore.fretboard')} markFrets={frets} />
  ) : (
    <Keyboard marks={marks} onNote={play} label={t('explore.keyboard')} />
  )
}

function diagramMarks({ notes, flats }: Diagram): Marks {
  const marks: Marks = {}
  notes.forEach((pc, i) => (marks[pc] = { label: noteName(pc, flats), root: i === 0 }))
  return marks
}

export function InfoStep({ step }: { step: Extract<Step, { type: 'info' }> }) {
  const lang = useLang()
  return (
    <div>
      <h2 className="text-2xl font-semibold">{step.title[lang]}</h2>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-text/90">{step.body[lang]}</p>
      {step.diagram && (
        <div className="mt-6">
          <InstrumentView
            instrument={step.diagram.instrument}
            marks={diagramMarks(step.diagram)}
            frets={step.diagram.frets}
          />
        </div>
      )}
    </div>
  )
}

export function QuizStep({ step, onAnswer, onSolved }: StepProps<Extract<Step, { type: 'quiz' }>>) {
  const lang = useLang()
  const [wrong, setWrong] = useState<number[]>([])
  const [solved, setSolved] = useState(false)

  const choose = (i: number) => {
    if (solved || wrong.includes(i)) return
    if (i === step.answer) {
      setSolved(true)
      onAnswer(wrong.length === 0)
      onSolved()
    } else {
      setWrong((w) => [...w, i])
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">{step.prompt[lang]}</h2>
      <div className="mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
        {step.options.map((option, i) => {
          const isRight = solved && i === step.answer
          const isWrong = wrong.includes(i)
          return (
            <button
              key={i}
              type="button"
              disabled={isWrong || solved}
              onClick={() => choose(i)}
              className={`rounded-lg border px-4 py-3 text-left font-bold transition ${
                isRight
                  ? 'border-ok bg-ok/15 text-ok'
                  : isWrong
                    ? 'border-bad bg-bad/10 text-bad line-through'
                    : 'border-line bg-raised enabled:hover:border-accent disabled:opacity-50'
              }`}
            >
              {option[lang]}
            </button>
          )
        })}
      </div>
      <Feedback state={solved ? 'right' : wrong.length ? 'wrong' : null} />
    </div>
  )
}

export function FindStep({ step, onAnswer, onSolved }: StepProps<Extract<Step, { type: 'find' }>>) {
  const lang = useLang()
  const [misses, setMisses] = useState<number[]>([])
  const [solved, setSolved] = useState(false)

  const onNote = (midi: number) => {
    if (solved) return
    const pc = pitchClass(midi)
    if (pc === step.target) {
      setSolved(true)
      onAnswer(misses.length === 0)
      onSolved()
    } else {
      setMisses((m) => [...m, pc])
    }
  }

  // Once found, reveal every place the note lives — that is the real lesson.
  const marks: Marks = solved ? { [step.target]: { label: noteName(step.target), root: true } } : {}
  const lastMiss = misses[misses.length - 1]

  return (
    <div>
      <h2 className="text-2xl font-semibold">{step.prompt[lang]}</h2>
      <div className="mt-6">
        <InstrumentView instrument={step.instrument} marks={marks} onNote={onNote} />
      </div>
      <Feedback
        state={solved ? 'right' : misses.length ? 'wrong' : null}
        detail={!solved && lastMiss !== undefined ? noteName(lastMiss) : undefined}
      />
    </div>
  )
}

export function EarStep({ step, onAnswer, onSolved }: StepProps<Extract<Step, { type: 'ear' }>>) {
  const t = useT()
  const lang = useLang()
  const voice = useStore((s) => s.voice)
  const answerEar = useStore((s) => s.answerEar)
  const [round, setRound] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)

  const ask = (previous?: string) => {
    // Plain random here (no repeats): a lesson is a first taste, the
    // spaced-repetition scheduling lives in the ear training page.
    const pool = step.items.filter((item) => item !== previous)
    const q = makeQuestion(step.kind, pool[Math.floor(Math.random() * pool.length)], ['asc'])
    setQuestion(q)
    setChosen(null)
    playQuestion(q, voice)
  }

  const answer = (item: string) => {
    if (!question || chosen) return
    const correct = item === question.item
    setChosen(item)
    onAnswer(correct)
    answerEar(cardId(step.kind, question.item), correct)
    if (round + 1 >= step.rounds) onSolved()
  }

  const next = () => {
    setRound((r) => r + 1)
    ask(question?.item)
  }

  const lastRound = round + 1 >= step.rounds

  return (
    <div>
      <h2 className="text-2xl font-semibold">{step.prompt[lang]}</h2>
      <p className="mt-1 text-sm text-mute">{t('lessons.round', { n: round + 1, total: step.rounds })}</p>
      <div className="mt-5">
        {question ? (
          <Button variant="ghost" onClick={() => playQuestion(question, voice)}>
            ↻ {t('ear.replay')}
          </Button>
        ) : (
          <Button onClick={() => ask()}>▶ {t('lessons.listen')}</Button>
        )}
      </div>
      <div className="mt-5 grid max-w-xl gap-2 sm:grid-cols-3">
        {step.items.map((item) => {
          const isAnswer = chosen !== null && item === question?.item
          const isMiss = chosen === item && !isAnswer
          return (
            <button
              key={item}
              type="button"
              disabled={!question || chosen !== null}
              onClick={() => answer(item)}
              className={`rounded-lg border px-4 py-3 font-bold transition ${
                isAnswer
                  ? 'border-ok bg-ok/15 text-ok'
                  : isMiss
                    ? 'border-bad bg-bad/15 text-bad'
                    : 'border-line bg-raised enabled:hover:border-accent disabled:opacity-50'
              }`}
            >
              {t(labelKey(step.kind, item))}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex min-h-11 items-center gap-4" aria-live="polite">
        {chosen !== null && question && (
          <>
            <span className={`pop font-bold ${chosen === question.item ? 'text-ok' : 'text-bad'}`}>
              {chosen === question.item
                ? t('ear.correct')
                : t('ear.wrong', { answer: t(labelKey(step.kind, question.item)) })}
            </span>
            {!lastRound && (
              <Button variant="ghost" onClick={next}>
                {t('ear.next')} →
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Feedback({ state, detail }: { state: 'right' | 'wrong' | null; detail?: string }) {
  const t = useT()
  return (
    <p className={`mt-4 min-h-6 font-bold ${state === 'right' ? 'text-ok' : 'text-bad'}`} aria-live="polite">
      {state === 'right' && t('lessons.right')}
      {state === 'wrong' && `${detail ? `${detail} · ` : ''}${t('lessons.tryAgain')}`}
    </p>
  )
}
