import { describe, expect, it } from 'vitest'
import { buildTones, chordById, formulaMidis, scaleById } from './formulas'
import { fretMidi, nearestString } from './instruments'
import { centsOff, midiLabel, midiToFreq, nearestNote, pitchClass } from './notes'

const names = (tonic: number, id: string, kind: 'chord' | 'scale') =>
  buildTones(tonic, kind === 'chord' ? chordById(id) : scaleById(id))
    .map((t) => t.name)
    .join(' ')

describe('notes', () => {
  it('converts MIDI to frequency and labels', () => {
    expect(midiToFreq(69)).toBe(440)
    expect(midiToFreq(40)).toBeCloseTo(82.41, 2)
    expect(midiLabel(60)).toBe('C4')
    expect(midiLabel(40)).toBe('E2')
    expect(pitchClass(-1)).toBe(11)
  })

  it('finds the nearest note and its deviation in cents', () => {
    expect(nearestNote(440)).toEqual({ midi: 69, cents: 0 })
    const sharp = nearestNote(445)
    expect(sharp.midi).toBe(69)
    expect(sharp.cents).toBeCloseTo(19.56, 1)
    expect(centsOff(midiToFreq(70), 69)).toBeCloseTo(100, 6)
  })
})

describe('formulas', () => {
  it('spells chords', () => {
    expect(names(0, 'maj', 'chord')).toBe('C E G')
    expect(names(9, 'min', 'chord')).toBe('A C E')
    expect(names(7, 'dom7', 'chord')).toBe('G B D F')
    expect(names(2, 'maj7', 'chord')).toBe('D F♯ A C♯')
  })

  it('picks flats or sharps from the key signature', () => {
    expect(names(5, 'major', 'scale')).toBe('F G A B♭ C D E')
    expect(names(7, 'major', 'scale')).toBe('G A B C D E F♯')
    expect(names(0, 'minor', 'scale')).toBe('C D E♭ F G A♭ B♭')
    expect(names(4, 'minor', 'scale')).toBe('E F♯ G A B C D')
    expect(names(9, 'minPent', 'scale')).toBe('A C D E G')
  })

  it('builds playable MIDI notes from a base octave', () => {
    expect(formulaMidis(0, chordById('maj'), 60)).toEqual([60, 64, 67])
    expect(formulaMidis(9, chordById('min'), 48)).toEqual([57, 60, 64])
    expect(formulaMidis(4, chordById('maj'), 40)).toEqual([40, 44, 47])
  })
})

describe('instruments', () => {
  it('maps frets to MIDI', () => {
    expect(fretMidi(0, 0)).toBe(40)
    expect(fretMidi(0, 5)).toBe(45) // 5th fret of low E = A
    expect(fretMidi(5, 12)).toBe(76)
  })

  it('guesses the string being tuned', () => {
    expect(nearestString(80)).toBe(0)
    expect(nearestString(112)).toBe(1)
    expect(nearestString(200)).toBe(3)
    expect(nearestString(340)).toBe(5)
  })
})
