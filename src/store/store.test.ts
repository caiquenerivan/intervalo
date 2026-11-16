import { describe, expect, it } from 'vitest'
import { BOX_DELAYS, MAX_BOX, mastery, pickNext, review, type Card } from './srs'
import { EMPTY_STREAK, liveStreak, registerPractice } from './streak'

describe('spaced repetition', () => {
  it('promotes on success and schedules further away', () => {
    let c = review(undefined, true, 1000)
    expect(c).toMatchObject({ box: 1, due: 1000 + BOX_DELAYS[1], seen: 1, correct: 1 })
    c = review(c, true, 2000)
    expect(c.box).toBe(2)
    expect(c.due).toBe(2000 + BOX_DELAYS[2])
  })

  it('sends a missed card back to box 1, due now', () => {
    const c = review({ box: 4, due: 0, seen: 5, correct: 5 }, false, 5000)
    expect(c).toEqual({ box: 1, due: 5000, seen: 6, correct: 5 })
  })

  it('caps at the last box', () => {
    expect(review({ box: MAX_BOX, due: 0, seen: 9, correct: 9 }, true, 0).box).toBe(MAX_BOX)
  })

  it('asks due cards first, weakest first, never the same twice in a row', () => {
    const cards: Record<string, Card> = {
      a: { box: 3, due: 100, seen: 3, correct: 3 },
      b: { box: 1, due: 100, seen: 2, correct: 1 },
      c: { box: 2, due: 9999, seen: 2, correct: 2 },
    }
    expect(pickNext(['a', 'b', 'c'], cards, 500)).toBe('b')
    expect(pickNext(['a', 'b', 'c'], cards, 500, 'b')).toBe('a')
    // unseen cards count as due
    expect(pickNext(['a', 'b', 'c', 'new'], cards, 500)).toBe('new')
  })

  it('favours weak cards when nothing is due', () => {
    const cards: Record<string, Card> = {
      strong: { box: 5, due: 9999, seen: 5, correct: 5 },
      weak: { box: 1, due: 9999, seen: 5, correct: 1 },
    }
    let weak = 0
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 1000; i++) if (pickNext(['strong', 'weak'], cards, 0, undefined, rand) === 'weak') weak++
    expect(weak).toBeGreaterThan(900)
  })

  it('reports mastery', () => {
    expect(mastery(['a', 'b'], {})).toBe(0)
    expect(mastery(['a'], { a: { box: MAX_BOX, due: 0, seen: 1, correct: 1 } })).toBe(1)
  })
})

describe('streak', () => {
  const day = (d: number, h = 12) => new Date(2026, 10, d, h)

  it('counts consecutive days and keeps the best', () => {
    let s = registerPractice(EMPTY_STREAK, day(1))
    s = registerPractice(s, day(1, 23)) // same day: no change
    expect(s.current).toBe(1)
    s = registerPractice(s, day(2, 0))
    s = registerPractice(s, day(3))
    expect(s).toEqual({ current: 3, best: 3, lastDay: '2026-11-03' })
    s = registerPractice(s, day(6)) // missed two days
    expect(s).toEqual({ current: 1, best: 3, lastDay: '2026-11-06' })
  })

  it('crosses month boundaries', () => {
    let s = registerPractice(EMPTY_STREAK, new Date(2026, 9, 31))
    s = registerPractice(s, new Date(2026, 10, 1))
    expect(s.current).toBe(2)
  })

  it('shows zero once a day has been skipped', () => {
    const s = registerPractice(EMPTY_STREAK, day(1))
    expect(liveStreak(s, day(1))).toBe(1)
    expect(liveStreak(s, day(2))).toBe(1) // still time to practise today
    expect(liveStreak(s, day(3))).toBe(0)
  })
})
