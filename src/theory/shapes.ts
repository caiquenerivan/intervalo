/**
 * Guitar fingerings for major and minor chords.
 * A shape lists the fret for each string, low E first; -1 = string not played.
 */
export type Shape = number[]

const X = -1

/** The open-position shapes every beginner learns; preferred when they exist. */
const OPEN: Record<string, Shape> = {
  '0-maj': [X, 3, 2, 0, 1, 0], // C
  '2-maj': [X, X, 0, 2, 3, 2], // D
  '4-maj': [0, 2, 2, 1, 0, 0], // E
  '7-maj': [3, 2, 0, 0, 0, 3], // G
  '9-maj': [X, 0, 2, 2, 2, 0], // A
  '2-min': [X, X, 0, 2, 3, 1], // Dm
  '4-min': [0, 2, 2, 0, 0, 0], // Em
  '9-min': [X, 0, 2, 2, 1, 0], // Am
}

/**
 * Everything else is a barre chord: the E shape moved up the 6th string or
 * the A shape moved up the 5th, whichever sits lower on the neck.
 */
export function chordShape(root: number, minor: boolean): Shape {
  const open = OPEN[`${root}-${minor ? 'min' : 'maj'}`]
  if (open) return open
  const onE = (root - 4 + 12) % 12 || 12
  const onA = (root - 9 + 12) % 12 || 12
  if (onE <= onA) {
    return [onE, onE + 2, onE + 2, onE + (minor ? 0 : 1), onE, onE]
  }
  return [X, onA, onA + 2, onA + 2, onA + (minor ? 1 : 2), onA]
}
