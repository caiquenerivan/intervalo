import type { Card } from './srs'
import type { Streak } from './streak'

export interface Snapshot {
  lessons: Record<string, { score: number }>
  lessonCount: number
  earCorrect: number
  cards: Record<string, Card>
  streak: Streak
  tuned: number
  explored: string[]
}

export interface Achievement {
  id: string
  icon: string
  earned: (s: Snapshot) => boolean
}

const done = (s: Snapshot) => Object.keys(s.lessons).length

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstLesson', icon: '🎵', earned: (s) => done(s) >= 1 },
  { id: 'perfect', icon: '✨', earned: (s) => Object.values(s.lessons).some((l) => l.score === 1) },
  { id: 'graduate', icon: '🎓', earned: (s) => done(s) >= s.lessonCount },
  { id: 'ear10', icon: '👂', earned: (s) => s.earCorrect >= 10 },
  { id: 'ear100', icon: '🏅', earned: (s) => s.earCorrect >= 100 },
  // Box 4+ means the card survived a multi-day gap.
  { id: 'mastered', icon: '🧠', earned: (s) => Object.values(s.cards).filter((c) => c.box >= 4).length >= 5 },
  { id: 'streak3', icon: '🔥', earned: (s) => s.streak.best >= 3 },
  { id: 'streak7', icon: '📅', earned: (s) => s.streak.best >= 7 },
  { id: 'inTune', icon: '🎸', earned: (s) => s.tuned >= 1 },
  { id: 'explorer', icon: '🧭', earned: (s) => s.explored.length >= 10 },
]

/** Ids earned by `s` that are not in `already`. */
export function newlyEarned(s: Snapshot, already: Record<string, number>): string[] {
  return ACHIEVEMENTS.filter((a) => !(a.id in already) && a.earned(s)).map((a) => a.id)
}
