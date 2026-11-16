/**
 * Spaced repetition, Leitner style. Each thing to recognise (an interval, a
 * chord quality) is a card sitting in a box. A correct answer moves it up a
 * box and pushes the next review further away; a mistake sends it back to
 * box 1, due immediately.
 */

export interface Card {
  box: number
  /** Timestamp (ms) when the card should come back. */
  due: number
  seen: number
  correct: number
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Delay before a card in box N is due again. Box 0 = never seen. */
export const BOX_DELAYS = [0, MIN, 10 * MIN, DAY, 3 * DAY, 7 * DAY]
export const MAX_BOX = BOX_DELAYS.length - 1

export const NEW_CARD: Card = { box: 0, due: 0, seen: 0, correct: 0 }

export function review(card: Card | undefined, wasCorrect: boolean, now: number): Card {
  const c = card ?? NEW_CARD
  const box = wasCorrect ? Math.min(MAX_BOX, c.box + 1) : 1
  return {
    box,
    due: wasCorrect ? now + BOX_DELAYS[box] : now,
    seen: c.seen + 1,
    correct: c.correct + (wasCorrect ? 1 : 0),
  }
}

/**
 * Chooses what to ask next among `ids`.
 * Due cards go first, weakest box first. When nothing is due we still have to
 * ask something (the person is practising now), so weak cards get picked
 * more often: weight halves with each box.
 */
export function pickNext(
  ids: string[],
  cards: Record<string, Card>,
  now: number,
  last?: string,
  random: () => number = Math.random,
): string {
  const pool = ids.length > 1 ? ids.filter((id) => id !== last) : ids
  const card = (id: string) => cards[id] ?? NEW_CARD

  const due = pool.filter((id) => card(id).due <= now)
  if (due.length) {
    const lowest = Math.min(...due.map((id) => card(id).box))
    const weakest = due.filter((id) => card(id).box === lowest)
    return weakest[Math.floor(random() * weakest.length)]
  }

  const weights = pool.map((id) => 2 ** (MAX_BOX - card(id).box))
  let r = random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r < 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/** 0..1 — how well a set of cards is known. */
export function mastery(ids: string[], cards: Record<string, Card>): number {
  if (!ids.length) return 0
  return ids.reduce((sum, id) => sum + (cards[id]?.box ?? 0), 0) / (ids.length * MAX_BOX)
}
