import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Voice } from '../audio/synth'
import { LESSONS } from '../features/lessons/content'
import { newlyEarned } from './achievements'
import { review, type Card } from './srs'
import { EMPTY_STREAK, registerPractice, type Streak } from './streak'

export type Lang = 'en' | 'pt'

export const XP_PER_LESSON = 20
export const XP_PERFECT_BONUS = 10
export const XP_PER_EAR = 2

interface Progress {
  lang: Lang
  voice: Voice
  xp: number
  streak: Streak
  /** Spaced-repetition state per sound, e.g. "interval:P5", "chord:min". */
  cards: Record<string, Card>
  lessons: Record<string, { score: number; completedAt: number }>
  achievements: Record<string, number>
  earCorrect: number
  earTotal: number
  tuned: number
  explored: string[]
}

interface Actions {
  setLang: (lang: Lang) => void
  setVoice: (voice: Voice) => void
  answerEar: (cardId: string, correct: boolean) => void
  completeLesson: (id: string, score: number) => number
  markExplored: (key: string) => void
  markTuned: () => void
  dismissToast: () => void
}

interface State extends Progress, Actions {
  /** Achievements waiting to be announced (not persisted). */
  toasts: string[]
}

const defaultLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'

/** Applies a progress change, then unlocks whatever it earned. */
function withAchievements(state: State, patch: Partial<Progress>): Partial<State> {
  const next = { ...state, ...patch }
  const earned = newlyEarned({ ...next, lessonCount: LESSONS.length }, next.achievements)
  if (!earned.length) return patch
  const now = Date.now()
  return {
    ...patch,
    achievements: { ...next.achievements, ...Object.fromEntries(earned.map((id) => [id, now])) },
    toasts: [...state.toasts, ...earned],
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      lang: defaultLang(),
      voice: 'guitar',
      xp: 0,
      streak: EMPTY_STREAK,
      cards: {},
      lessons: {},
      achievements: {},
      earCorrect: 0,
      earTotal: 0,
      tuned: 0,
      explored: [],
      toasts: [],

      setLang: (lang) => set({ lang }),
      setVoice: (voice) => set({ voice }),

      answerEar: (cardId, correct) =>
        set((s) =>
          withAchievements(s, {
            cards: { ...s.cards, [cardId]: review(s.cards[cardId], correct, Date.now()) },
            earTotal: s.earTotal + 1,
            earCorrect: s.earCorrect + (correct ? 1 : 0),
            xp: s.xp + (correct ? XP_PER_EAR : 0),
            streak: registerPractice(s.streak, new Date()),
          }),
        ),

      completeLesson: (id, score) => {
        // Repeating a lesson is welcome but only pays XP the first time.
        const first = !(id in get().lessons)
        const gained = first ? XP_PER_LESSON + (score === 1 ? XP_PERFECT_BONUS : 0) : 0
        set((s) =>
          withAchievements(s, {
            lessons: {
              ...s.lessons,
              [id]: { score: Math.max(score, s.lessons[id]?.score ?? 0), completedAt: Date.now() },
            },
            xp: s.xp + gained,
            streak: registerPractice(s.streak, new Date()),
          }),
        )
        return gained
      },

      markExplored: (key) =>
        set((s) => (s.explored.includes(key) ? s : withAchievements(s, { explored: [...s.explored, key] }))),

      markTuned: () => set((s) => withAchievements(s, { tuned: s.tuned + 1 })),

      dismissToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
    }),
    {
      name: 'intervalo-progress',
      version: 1,
      partialize: ({ toasts: _toasts, ...rest }) => rest,
    },
  ),
)
