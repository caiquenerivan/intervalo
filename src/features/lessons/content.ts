import type { Localized } from '../../i18n'
import type { EarKind } from '../ear/questions'

export type Instrument = 'keyboard' | 'fretboard'

/** Notes drawn on an instrument next to an explanation. */
export interface Diagram {
  instrument: Instrument
  /** Pitch classes to highlight; the first one is the root. */
  notes: number[]
  /** Spell black keys as flats (E♭) instead of sharps (D♯). */
  flats?: boolean
  /** Fretboard only: highlight just this range of frets, e.g. [0, 0] for open strings. */
  frets?: [number, number]
}

export type Step =
  | { type: 'info'; title: Localized; body: Localized; diagram?: Diagram }
  | { type: 'quiz'; prompt: Localized; options: Localized[]; answer: number }
  | { type: 'find'; prompt: Localized; instrument: Instrument; target: number }
  | { type: 'ear'; prompt: Localized; kind: EarKind; items: string[]; rounds: number }

export interface Lesson {
  id: string
  unit: Localized
  title: Localized
  summary: Localized
  steps: Step[]
}

const same = (text: string): Localized => ({ en: text, pt: text })
const opts = (...texts: string[]) => texts.map(same)

const [C, D, E, F, Fs, G, A, B] = [0, 2, 4, 5, 6, 7, 9, 11]

const UNIT_NOTES = { en: 'Notes', pt: 'Notas' }
const UNIT_INTERVALS = { en: 'Intervals', pt: 'Intervalos' }
const UNIT_CHORDS = { en: 'Chords', pt: 'Acordes' }
const UNIT_SCALES = { en: 'Scales', pt: 'Escalas' }

export const LESSONS: Lesson[] = [
  {
    id: 'alphabet',
    unit: UNIT_NOTES,
    title: { en: 'The musical alphabet', pt: 'O alfabeto musical' },
    summary: { en: 'Twelve notes, and how they sit on a keyboard.', pt: 'Doze notas e como elas ficam no teclado.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Seven letters', pt: 'Sete letras' },
        body: {
          en: 'Western music names its notes with seven letters: C D E F G A B. After B it starts again at C, one octave higher. On a keyboard these are the white keys — C is always the white key just left of a group of two black keys.',
          pt: 'A música ocidental nomeia as notas com sete letras: C D E F G A B (dó ré mi fá sol lá si). Depois do B começa de novo no C, uma oitava acima. No teclado, são as teclas brancas — o C é sempre a tecla branca logo à esquerda de um grupo de duas pretas.',
        },
        diagram: { instrument: 'keyboard', notes: [C, D, E, F, G, A, B] },
      },
      {
        type: 'quiz',
        prompt: { en: 'Which note comes right after G?', pt: 'Que nota vem logo depois de G?' },
        options: opts('H', 'A', 'F', 'C'),
        answer: 1,
      },
      {
        type: 'info',
        title: { en: 'Twelve notes in all', pt: 'Doze notas ao todo' },
        body: {
          en: 'The black keys fill the gaps. Each one has two names: the key between C and D is C♯ (“C sharp”, a step above C) or D♭ (“D flat”, a step below D). There is no black key between E and F, nor between B and C. Count them all and you get 12 notes per octave. The distance from one key to the very next is called a semitone, or half step.',
          pt: 'As teclas pretas preenchem os espaços. Cada uma tem dois nomes: a tecla entre C e D é C♯ (“dó sustenido”, um passo acima do C) ou D♭ (“ré bemol”, um passo abaixo do D). Não há tecla preta entre E e F, nem entre B e C. Contando todas, são 12 notas por oitava. A distância de uma tecla para a seguinte chama-se semitom.',
        },
        diagram: { instrument: 'keyboard', notes: [1, 3, 6, 8, 10] },
      },
      {
        type: 'quiz',
        prompt: { en: 'How many semitones are there in one octave?', pt: 'Quantos semitons há em uma oitava?' },
        options: opts('7', '8', '10', '12'),
        answer: 3,
      },
      {
        type: 'find',
        prompt: { en: 'Play any C on the keyboard.', pt: 'Toque qualquer C (dó) no teclado.' },
        instrument: 'keyboard',
        target: C,
      },
      {
        type: 'find',
        prompt: { en: 'Now play an F♯.', pt: 'Agora toque um F♯ (fá sustenido).' },
        instrument: 'keyboard',
        target: Fs,
      },
    ],
  },
  {
    id: 'guitar-notes',
    unit: UNIT_NOTES,
    title: { en: 'Notes on the guitar', pt: 'Notas no violão' },
    summary: { en: 'Open strings, frets and where the notes live.', pt: 'Cordas soltas, casas e onde ficam as notas.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Six open strings', pt: 'Seis cordas soltas' },
        body: {
          en: 'From the thickest (6th) string to the thinnest (1st), a guitar in standard tuning is E A D G B E. In the diagram the thinnest string is on top, just like a chord chart. Click the open strings on the left to hear them.',
          pt: 'Da corda mais grossa (6ª) para a mais fina (1ª), o violão na afinação padrão é E A D G B E (mi lá ré sol si mi). No diagrama a corda mais fina fica em cima, como num diagrama de acordes. Clique nas cordas soltas, à esquerda, para ouvir.',
        },
        diagram: { instrument: 'fretboard', notes: [E, A, D, G, B], frets: [0, 0] },
      },
      {
        type: 'quiz',
        prompt: { en: 'Which note is the open 5th string?', pt: 'Que nota é a 5ª corda solta?' },
        options: opts('E', 'A', 'D', 'G'),
        answer: 1,
      },
      {
        type: 'info',
        title: { en: 'One fret, one semitone', pt: 'Uma casa, um semitom' },
        body: {
          en: 'Each fret raises the string by one semitone — exactly one key on the piano. So on the low E string: open is E, fret 1 is F, fret 2 is F♯, fret 3 is G. At fret 12 you are back to the same note, an octave up, which is why the 12th fret has two dots.',
          pt: 'Cada casa sobe a corda em um semitom — exatamente uma tecla do piano. Na corda E grave: solta é E, casa 1 é F, casa 2 é F♯, casa 3 é G. Na casa 12 você volta à mesma nota, uma oitava acima; por isso a casa 12 tem duas bolinhas.',
        },
        diagram: { instrument: 'fretboard', notes: [E] },
      },
      {
        type: 'quiz',
        prompt: {
          en: 'The 6th string is E. Which note is at its 5th fret?',
          pt: 'A 6ª corda é E. Que nota está na casa 5 dela?',
        },
        options: opts('G', 'A', 'B', 'C'),
        answer: 1,
      },
      {
        type: 'find',
        prompt: { en: 'Find a G anywhere on the fretboard.', pt: 'Encontre um G (sol) em qualquer lugar do braço.' },
        instrument: 'fretboard',
        target: G,
      },
      {
        type: 'find',
        prompt: { en: 'Now find a C.', pt: 'Agora encontre um C (dó).' },
        instrument: 'fretboard',
        target: C,
      },
    ],
  },
  {
    id: 'steps',
    unit: UNIT_INTERVALS,
    title: { en: 'Distances between notes', pt: 'Distâncias entre notas' },
    summary: { en: 'What an interval is, and how to count one.', pt: 'O que é um intervalo e como contá-lo.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Intervals', pt: 'Intervalos' },
        body: {
          en: 'An interval is the distance between two notes, counted in semitones. Music is made of these distances far more than of the notes themselves: a melody played starting on another note is still the same melody, because the intervals did not change.',
          pt: 'Intervalo é a distância entre duas notas, contada em semitons. A música é feita muito mais dessas distâncias do que das notas em si: uma melodia tocada a partir de outra nota continua sendo a mesma melodia, porque os intervalos não mudaram.',
        },
      },
      {
        type: 'info',
        title: { en: 'Three to know first', pt: 'Três para conhecer primeiro' },
        body: {
          en: 'From C: up to E is 4 semitones, a major third — bright and sweet. Up to G is 7 semitones, a perfect fifth — open and strong, the sound of a power chord. Up to the next C is 12 semitones, an octave — the same note, higher.',
          pt: 'A partir do C: até o E são 4 semitons, uma terça maior — clara e doce. Até o G são 7 semitons, uma quinta justa — aberta e forte, o som do power chord. Até o próximo C são 12 semitons, uma oitava — a mesma nota, mais aguda.',
        },
        diagram: { instrument: 'keyboard', notes: [C, E, G] },
      },
      {
        type: 'quiz',
        prompt: { en: 'How many semitones is a perfect fifth?', pt: 'Quantos semitons tem uma quinta justa?' },
        options: opts('4', '5', '7', '12'),
        answer: 2,
      },
      {
        type: 'quiz',
        prompt: {
          en: 'Starting on D, which note is a major third (4 semitones) above?',
          pt: 'Partindo do D, que nota fica uma terça maior (4 semitons) acima?',
        },
        options: opts('F', 'F♯', 'G', 'A'),
        answer: 1,
      },
    ],
  },
  {
    id: 'first-intervals',
    unit: UNIT_INTERVALS,
    title: { en: 'Your first intervals by ear', pt: 'Seus primeiros intervalos de ouvido' },
    summary: { en: 'Tell a third, a fifth and an octave apart.', pt: 'Diferencie terça, quinta e oitava.' },
    steps: [
      {
        type: 'info',
        title: { en: 'A song for each interval', pt: 'Uma música para cada intervalo' },
        body: {
          en: 'The classic trick is to tie each interval to the opening of a tune you know. The octave is the leap in “Some-where over the rainbow”. The perfect fifth opens “Twinkle, twinkle, little star” (second “twinkle”). The major third is the first two notes of a major chord going up. Don’t worry about getting it right at first — guessing, hearing the answer and trying again is exactly how the ear learns.',
          pt: 'O truque clássico é ligar cada intervalo ao começo de uma música conhecida. A oitava é o salto de “Some-where over the rainbow”. A quinta justa abre “Brilha, brilha, estrelinha” (o segundo “brilha”). A terça maior são as duas primeiras notas de um acorde maior subindo. Não se preocupe em acertar de início — chutar, ouvir a resposta e tentar de novo é exatamente como o ouvido aprende.',
        },
      },
      {
        type: 'ear',
        prompt: { en: 'Which interval do you hear?', pt: 'Que intervalo você ouve?' },
        kind: 'interval',
        items: ['M3', 'P5', 'P8'],
        rounds: 5,
      },
    ],
  },
  {
    id: 'triads',
    unit: UNIT_CHORDS,
    title: { en: 'Major and minor chords', pt: 'Acordes maiores e menores' },
    summary: { en: 'Three notes, and the one that changes the mood.', pt: 'Três notas, e a que muda o clima.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Stacking thirds', pt: 'Empilhando terças' },
        body: {
          en: 'A chord is three or more notes together. The basic one, the triad, takes a root, the note 4 semitones above (the third) and the note 7 semitones above (the fifth). C major is C – E – G.',
          pt: 'Um acorde são três ou mais notas juntas. O básico, a tríade, usa a tônica, a nota 4 semitons acima (a terça) e a nota 7 semitons acima (a quinta). C maior é C – E – G.',
        },
        diagram: { instrument: 'keyboard', notes: [C, E, G] },
      },
      {
        type: 'info',
        title: { en: 'One semitone changes everything', pt: 'Um semitom muda tudo' },
        body: {
          en: 'Lower the third by one semitone — E becomes E♭ — and C major turns into C minor. Root and fifth stay put. Major tends to sound bright and settled; minor, darker and more wistful. That middle note is what your ear will learn to listen for.',
          pt: 'Abaixe a terça em um semitom — E vira E♭ — e C maior se torna C menor. Tônica e quinta ficam onde estão. O maior tende a soar claro e resolvido; o menor, mais escuro e melancólico. É essa nota do meio que seu ouvido vai aprender a procurar.',
        },
        diagram: { instrument: 'keyboard', notes: [C, 3, G], flats: true },
      },
      {
        type: 'quiz',
        prompt: { en: 'Which notes make a G major chord?', pt: 'Que notas formam o acorde de G maior?' },
        options: opts('G – B – D', 'G – B♭ – D', 'G – A – D', 'G – C – E'),
        answer: 0,
      },
      {
        type: 'quiz',
        prompt: { en: 'And A minor?', pt: 'E o de A menor?' },
        options: opts('A – C♯ – E', 'A – C – E', 'A – D – E', 'A – C – F'),
        answer: 1,
      },
      {
        type: 'ear',
        prompt: { en: 'Major or minor?', pt: 'Maior ou menor?' },
        kind: 'chord',
        items: ['maj', 'min'],
        rounds: 5,
      },
    ],
  },
  {
    id: 'chords-guitar',
    unit: UNIT_CHORDS,
    title: { en: 'Chords across the fretboard', pt: 'Acordes pelo braço' },
    summary: { en: 'Why one chord has so many shapes.', pt: 'Por que um acorde tem tantos formatos.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Same three notes, everywhere', pt: 'As mesmas três notas, em todo lugar' },
        body: {
          en: 'Here is every C, E and G on the neck. Any chord shape you have learned for C major — the open one, the barre at fret 3, the one at fret 8 — is just a different way of grabbing these same three notes. The red dots are the root, C.',
          pt: 'Aqui estão todos os C, E e G do braço. Qualquer formato de C maior que você aprendeu — o aberto, a pestana na casa 3, o da casa 8 — é só um jeito diferente de pegar essas mesmas três notas. As bolinhas vermelhas são a tônica, C.',
        },
        diagram: { instrument: 'fretboard', notes: [C, E, G] },
      },
      {
        type: 'find',
        prompt: {
          en: 'C major is C – E – G. Play its third anywhere on the fretboard.',
          pt: 'C maior é C – E – G. Toque a terça dele em qualquer lugar do braço.',
        },
        instrument: 'fretboard',
        target: E,
      },
      {
        type: 'quiz',
        prompt: {
          en: 'A chord with the notes D – F♯ – A is…',
          pt: 'Um acorde com as notas D – F♯ – A é…',
        },
        options: [
          { en: 'D major', pt: 'D maior' },
          { en: 'D minor', pt: 'D menor' },
          { en: 'A major', pt: 'A maior' },
          { en: 'F♯ minor', pt: 'F♯ menor' },
        ],
        answer: 0,
      },
      {
        type: 'find',
        prompt: {
          en: 'A minor is A – C – E. Play its fifth.',
          pt: 'A menor é A – C – E. Toque a quinta dele.',
        },
        instrument: 'fretboard',
        target: E,
      },
    ],
  },
  {
    id: 'major-scale',
    unit: UNIT_SCALES,
    title: { en: 'The major scale', pt: 'A escala maior' },
    summary: { en: 'One pattern of steps that builds every major key.', pt: 'Um padrão de passos que monta qualquer tom maior.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Whole and half steps', pt: 'Tons e semitons' },
        body: {
          en: 'A whole step is two semitones. The major scale is always the same recipe: whole, whole, half, whole, whole, whole, half. Start on C and you land only on white keys: C D E F G A B. The half steps are E→F and B→C — exactly where the keyboard has no black key.',
          pt: 'Um tom são dois semitons. A escala maior é sempre a mesma receita: tom, tom, semitom, tom, tom, tom, semitom. Comece no C e você cai só em teclas brancas: C D E F G A B. Os semitons são E→F e B→C — exatamente onde o teclado não tem tecla preta.',
        },
        diagram: { instrument: 'keyboard', notes: [C, D, E, F, G, A, B] },
      },
      {
        type: 'quiz',
        prompt: { en: 'What is the 5th note of the C major scale?', pt: 'Qual é a 5ª nota da escala de C maior?' },
        options: opts('E', 'F', 'G', 'A'),
        answer: 2,
      },
      {
        type: 'info',
        title: { en: 'Same recipe, another start', pt: 'Mesma receita, outro começo' },
        body: {
          en: 'Start the recipe on G: G A B C D E… and the next whole step from E lands on F♯, not F. That one sharp is the whole difference between the keys of C and G. Every major key is this pattern started somewhere else.',
          pt: 'Comece a receita no G: G A B C D E… e o próximo tom a partir do E cai em F♯, não em F. Esse único sustenido é toda a diferença entre os tons de C e G. Todo tom maior é esse padrão começado em outro lugar.',
        },
        diagram: { instrument: 'keyboard', notes: [G, A, B, C, D, E, Fs] },
      },
      {
        type: 'quiz',
        prompt: { en: 'Which note belongs to G major?', pt: 'Qual nota pertence a G maior?' },
        options: opts('F', 'F♯', 'B♭', 'C♯'),
        answer: 1,
      },
      {
        type: 'find',
        prompt: {
          en: 'Play the 7th note of the C major scale on the keyboard.',
          pt: 'Toque a 7ª nota da escala de C maior no teclado.',
        },
        instrument: 'keyboard',
        target: B,
      },
    ],
  },
  {
    id: 'pentatonic',
    unit: UNIT_SCALES,
    title: { en: 'The minor pentatonic', pt: 'A pentatônica menor' },
    summary: { en: 'Five notes behind countless solos.', pt: 'Cinco notas por trás de incontáveis solos.' },
    steps: [
      {
        type: 'info',
        title: { en: 'Five safe notes', pt: 'Cinco notas seguras' },
        body: {
          en: 'Take the natural minor scale and drop the two notes that clash most easily. What is left is the minor pentatonic: root, minor third, fourth, fifth, minor seventh. In A that is A C D E G. On guitar it falls into a comfortable box at the 5th fret, which is why it is the first scale most guitarists improvise with.',
          pt: 'Pegue a escala menor natural e tire as duas notas que mais facilmente soam tensas. O que sobra é a pentatônica menor: tônica, terça menor, quarta, quinta e sétima menor. Em A, fica A C D E G. No violão ela cai num desenho confortável na casa 5, e por isso é a primeira escala com que a maioria dos guitarristas improvisa.',
        },
        diagram: { instrument: 'fretboard', notes: [A, C, D, E, G], frets: [5, 8] },
      },
      {
        type: 'quiz',
        prompt: { en: 'How many different notes does a pentatonic scale have?', pt: 'Quantas notas diferentes tem uma escala pentatônica?' },
        options: opts('4', '5', '6', '7'),
        answer: 1,
      },
      {
        type: 'quiz',
        prompt: { en: 'Which note is NOT in A minor pentatonic?', pt: 'Qual nota NÃO está na pentatônica de A menor?' },
        options: opts('C', 'D', 'F', 'G'),
        answer: 2,
      },
      {
        type: 'find',
        prompt: {
          en: 'Play the root of A minor pentatonic on the fretboard.',
          pt: 'Toque a tônica da pentatônica de A menor no braço.',
        },
        instrument: 'fretboard',
        target: A,
      },
      {
        type: 'ear',
        prompt: { en: 'One last check: which interval?', pt: 'Uma última checagem: que intervalo?' },
        kind: 'interval',
        items: ['m3', 'P4', 'P5'],
        rounds: 4,
      },
    ],
  },
]

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)

/** Number of answers a lesson asks for (info screens don't count). */
export function questionCount(lesson: Lesson): number {
  return lesson.steps.reduce((n, s) => n + (s.type === 'info' ? 0 : s.type === 'ear' ? s.rounds : 1), 0)
}
