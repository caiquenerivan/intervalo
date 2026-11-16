import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'
import { useLang, useT } from '../../i18n'
import { useStore } from '../../store/useStore'
import { LESSONS } from './content'

export function LessonList() {
  const t = useT()
  const lang = useLang()
  const completed = useStore((s) => s.lessons)

  return (
    <div>
      <PageHeader title={t('lessons.title')} intro={t('lessons.intro')} />
      <ol className="grid max-w-2xl gap-2">
        {LESSONS.map((lesson, i) => {
          const done = completed[lesson.id]
          const unlocked = i === 0 || !!done || LESSONS[i - 1].id in completed
          const newUnit = i === 0 || LESSONS[i - 1].unit.en !== lesson.unit.en
          const card = (
            <div
              className={`flex items-center gap-4 rounded-xl border p-4 transition ${
                unlocked ? 'border-line bg-surface hover:border-accent' : 'border-line/60 opacity-50'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  done ? 'bg-ok text-ink' : unlocked ? 'bg-accent text-ink' : 'bg-raised text-mute'
                }`}
              >
                {done ? '✓' : unlocked ? i + 1 : '🔒'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{lesson.title[lang]}</span>
                <span className="block text-sm text-mute">
                  {unlocked ? lesson.summary[lang] : t('lessons.locked')}
                </span>
              </span>
              {unlocked && (
                <span className="text-sm font-bold whitespace-nowrap text-accent">
                  {done ? `${Math.round(done.score * 100)}% · ${t('lessons.review')}` : `${t('lessons.begin')} →`}
                </span>
              )}
            </div>
          )
          return (
            <li key={lesson.id}>
              {newUnit && (
                <h2 className="mt-5 mb-2 font-sans text-xs font-bold tracking-widest text-mute uppercase">
                  {lesson.unit[lang]}
                </h2>
              )}
              {unlocked ? <Link to={`/lessons/${lesson.id}`}>{card}</Link> : card}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
