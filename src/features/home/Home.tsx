import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass } from '../../components/buttonClass'
import { Meter } from '../../components/ui'
import { useLang, useT, type Key } from '../../i18n'
import { ACHIEVEMENTS } from '../../store/achievements'
import { liveStreak } from '../../store/streak'
import { useStore } from '../../store/useStore'
import { LESSONS } from '../lessons/content'

const FEATURES: { to: string; icon: string; title: Key; desc: Key }[] = [
  { to: '/lessons', icon: '📘', title: 'nav.lessons', desc: 'home.lessons.desc' },
  { to: '/explore', icon: '🎹', title: 'nav.explore', desc: 'home.explore.desc' },
  { to: '/ear', icon: '👂', title: 'nav.ear', desc: 'home.ear.desc' },
  { to: '/tuner', icon: '🎸', title: 'nav.tuner', desc: 'home.tuner.desc' },
]

export function Home() {
  const t = useT()
  const lang = useLang()
  const completed = useStore((s) => s.lessons)
  const streak = useStore((s) => s.streak)
  const xp = useStore((s) => s.xp)
  const cards = useStore((s) => s.cards)
  const unlocked = useStore((s) => s.achievements)

  const doneCount = LESSONS.filter((l) => l.id in completed).length
  const nextLesson = LESSONS.find((l) => !(l.id in completed))
  // Read the clock once per visit so rendering stays pure.
  const [now] = useState(() => new Date())
  const due = Object.values(cards).filter((c) => c.due <= now.getTime()).length

  return (
    <div>
      <section className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{t('home.title')}</h1>
          <p className="mt-4 max-w-xl text-lg text-mute">{t('home.subtitle')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {nextLesson ? (
              <Link to={`/lessons/${nextLesson.id}`} className={buttonClass('primary', 'px-6 py-3 text-base')}>
                {doneCount === 0 ? t('home.start') : `${t('home.continue')}: ${nextLesson.title[lang]}`} →
              </Link>
            ) : (
              <Link to="/ear" className={buttonClass('primary', 'px-6 py-3 text-base')}>
                {t('home.practice')} →
              </Link>
            )}
          </div>
          {!nextLesson && <p className="mt-3 text-sm text-mute">{t('home.allDone')}</p>}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <span className="text-5xl">🔥</span>
            <div>
              <div className="font-display text-4xl font-semibold tabular-nums">{liveStreak(streak, now)}</div>
              <div className="text-sm text-mute">
                {t('home.streak')} · {t('home.best', { n: streak.best })}
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-raised p-3">
              <div className="text-2xl font-bold text-accent tabular-nums">{xp}</div>
              <div className="text-xs text-mute">{t('home.xp')}</div>
            </div>
            <div className="rounded-lg bg-raised p-3">
              <div className="text-2xl font-bold tabular-nums">
                {doneCount}/{LESSONS.length}
              </div>
              <div className="text-xs text-mute">{t('home.lessons')}</div>
            </div>
          </div>
          <div className="mt-4">
            <Meter value={doneCount / LESSONS.length} />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group rounded-xl border border-line bg-surface p-5 transition hover:border-accent"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{f.icon}</span>
              <h2 className="font-sans text-lg font-bold">{t(f.title)}</h2>
              {f.to === '/ear' && due > 0 && (
                <span className="ml-auto rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                  {t('home.due', { n: due })}
                </span>
              )}
            </div>
            <p className="mt-2 text-mute">{t(f.desc)}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-2xl font-semibold">
          {t('home.achievements')}{' '}
          <span className="font-sans text-base font-normal text-mute">
            {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
          </span>
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const got = a.id in unlocked
            return (
              <li
                key={a.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  got ? 'border-accent/60 bg-surface' : 'border-line opacity-55'
                }`}
              >
                <span className={`text-2xl ${got ? '' : 'grayscale'}`}>{a.icon}</span>
                <span>
                  <span className="block text-sm font-bold">{t(`ach.${a.id}.name` as Key)}</span>
                  <span className="block text-xs text-mute">{t(`ach.${a.id}.desc` as Key)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
