import { useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { buttonClass } from '../../components/buttonClass'
import { Button, Meter } from '../../components/ui'
import { useLang, useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { LESSONS, questionCount } from './content'
import { EarStep, FindStep, InfoStep, QuizStep } from './steps'

export function LessonPlayer() {
  const { id } = useParams()
  const index = LESSONS.findIndex((l) => l.id === id)
  const completed = useStore((s) => s.lessons)

  if (index === -1) return <Navigate to="/lessons" replace />
  // A lesson opens once the one before it is done.
  if (index > 0 && !(LESSONS[index - 1].id in completed) && !(LESSONS[index].id in completed)) {
    return <Navigate to="/lessons" replace />
  }
  // The key restarts the player from scratch when moving to the next lesson.
  return <Player key={id} index={index} />
}

function Player({ index }: { index: number }) {
  const t = useT()
  const lang = useLang()
  const completeLesson = useStore((s) => s.completeLesson)
  const lesson = LESSONS[index]
  const next = LESSONS[index + 1]

  const [stepIndex, setStepIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [result, setResult] = useState<{ score: number; xp: number } | null>(null)
  const firstTry = useRef(0)

  const step = lesson.steps[stepIndex]
  const isLast = stepIndex === lesson.steps.length - 1
  const canContinue = step.type === 'info' || solved

  const advance = () => {
    if (!isLast) {
      setStepIndex((i) => i + 1)
      setSolved(false)
      return
    }
    const total = questionCount(lesson)
    const score = total ? firstTry.current / total : 1
    setResult({ score, xp: completeLesson(lesson.id, score) })
  }

  if (result) {
    return (
      <div className="pop mx-auto max-w-md rounded-xl border border-line bg-surface p-8 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-3 text-3xl font-semibold">{t('lessons.complete')}</h1>
        <p className="mt-1 text-mute">{lesson.title[lang]}</p>
        <p className="mt-5 text-lg">{t('lessons.score', { n: Math.round(result.score * 100) })}</p>
        {result.xp > 0 && <p className="mt-1 text-xl font-bold text-accent">{t('lessons.xp', { n: result.xp })}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/lessons" className={buttonClass('ghost')}>
            {t('lessons.back')}
          </Link>
          {next && (
            <Link to={`/lessons/${next.id}`} className={buttonClass()}>
              {t('lessons.nextLesson')} →
            </Link>
          )}
        </div>
      </div>
    )
  }

  const props = {
    onAnswer: (ok: boolean) => {
      if (ok) firstTry.current += 1
    },
    onSolved: () => setSolved(true),
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/lessons" className="text-sm text-mute hover:text-text" aria-label={t('lessons.exit')}>
          ✕
        </Link>
        <Meter value={stepIndex / lesson.steps.length} />
        <span className="text-sm whitespace-nowrap text-mute tabular-nums">
          {stepIndex + 1} / {lesson.steps.length}
        </span>
      </div>
      <p className="mb-2 text-xs font-bold tracking-widest text-accent uppercase">{lesson.title[lang]}</p>

      {/* Keyed by step so each one starts with clean state. */}
      <div key={stepIndex} className="pop">
        {step.type === 'info' && <InfoStep step={step} />}
        {step.type === 'quiz' && <QuizStep step={step} {...props} />}
        {step.type === 'find' && <FindStep step={step} {...props} />}
        {step.type === 'ear' && <EarStep step={step} {...props} />}
      </div>

      <div className="mt-8">
        <Button onClick={advance} disabled={!canContinue} className="px-6">
          {isLast ? t('lessons.finish') : t('lessons.continue')} →
        </Button>
      </div>
    </div>
  )
}
