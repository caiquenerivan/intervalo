export interface Streak {
  current: number
  best: number
  /** Local date of the last practice, YYYY-MM-DD. */
  lastDay: string | null
}

export const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: null }

/** Local calendar day, so the streak turns over at the user's midnight. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** Call whenever the person practises. */
export function registerPractice(streak: Streak, now: Date): Streak {
  const today = dayKey(now)
  if (streak.lastDay === today) return streak
  const gap = streak.lastDay ? daysBetween(streak.lastDay, today) : Infinity
  const current = gap === 1 ? streak.current + 1 : 1
  return { current, best: Math.max(streak.best, current), lastDay: today }
}

/** What to display: a streak not continued yesterday or today is already lost. */
export function liveStreak(streak: Streak, now: Date): number {
  if (!streak.lastDay) return 0
  return daysBetween(streak.lastDay, dayKey(now)) <= 1 ? streak.current : 0
}
