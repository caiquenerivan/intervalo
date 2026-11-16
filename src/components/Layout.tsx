import { useEffect } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useT, type Key } from '../i18n'
import { ACHIEVEMENTS } from '../store/achievements'
import { liveStreak } from '../store/streak'
import { useStore } from '../store/useStore'

const NAV: { to: string; key: Key }[] = [
  { to: '/lessons', key: 'nav.lessons' },
  { to: '/explore', key: 'nav.explore' },
  { to: '/ear', key: 'nav.ear' },
  { to: '/tuner', key: 'nav.tuner' },
  { to: '/songs', key: 'nav.songs' },
]

export function Layout() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const streak = useStore((s) => liveStreak(s.streak, new Date()))
  const xp = useStore((s) => s.xp)

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  }, [lang])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="font-display text-xl font-semibold">
            Inter<span className="text-accent">valo</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm sm:order-3">
            <span title={t('home.streak')} className="tabular-nums">
              🔥 {streak}
            </span>
            <span className="font-bold text-accent tabular-nums">
              {xp} {t('home.xp')}
            </span>
            <div className="flex overflow-hidden rounded-md border border-line text-xs font-bold" role="group" aria-label="Language">
              {(['en', 'pt'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 uppercase ${lang === l ? 'bg-accent text-ink' : 'text-mute hover:text-text'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <nav className="-mx-1 flex w-full gap-1 overflow-x-auto sm:order-2 sm:mx-0 sm:w-auto">
            {NAV.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                    isActive ? 'bg-raised text-text' : 'text-mute hover:text-text'
                  }`
                }
              >
                {t(key)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line px-4 py-5 text-center text-xs text-mute">
        {t('footer.local')} ·{' '}
        <a href="https://www.nerivan.site" className="underline hover:text-text">
          {t('footer.made')}
        </a>
      </footer>

      <Toasts />
    </div>
  )
}

function Toasts() {
  const t = useT()
  const id = useStore((s) => s.toasts[0])
  const dismiss = useStore((s) => s.dismissToast)

  useEffect(() => {
    if (!id) return
    const timer = window.setTimeout(dismiss, 4000)
    return () => window.clearTimeout(timer)
  }, [id, dismiss])

  if (!id) return null
  const achievement = ACHIEVEMENTS.find((a) => a.id === id)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4" role="status">
      <button
        key={id}
        type="button"
        onClick={dismiss}
        className="pop pointer-events-auto flex items-center gap-3 rounded-xl border border-accent bg-raised px-4 py-3 text-left shadow-xl"
      >
        <span className="text-3xl">{achievement?.icon}</span>
        <span>
          <span className="block text-xs font-bold tracking-widest text-accent uppercase">{t('ach.unlocked')}</span>
          <span className="block font-bold">{t(`ach.${id}.name` as Key)}</span>
        </span>
      </button>
    </div>
  )
}
