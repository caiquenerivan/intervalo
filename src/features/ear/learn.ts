import type { Localized } from '../../i18n'

export interface SoundNote {
  /** What it feels like — the thing to listen for. */
  feel: Localized
  /** A well-known tune or trick that starts with this sound. */
  hook: Localized
}

const both = (text: string): Localized => ({ en: text, pt: text })

/** What to listen for in each interval, and a tune to hang it on. */
export const INTERVAL_NOTES: Record<string, SoundNote> = {
  m2: {
    feel: {
      en: 'The smallest step there is. Tense and biting — the two notes rub against each other.',
      pt: 'O menor passo que existe. Tenso e áspero — as duas notas se esfregam uma na outra.',
    },
    hook: { en: 'The two-note “Jaws” theme.', pt: 'As duas notas do tema de “Tubarão”.' },
  },
  M2: {
    feel: {
      en: 'One whole step: the start of a scale. Neutral, like walking to the next stair.',
      pt: 'Um tom inteiro: o começo de uma escala. Neutro, como subir um degrau.',
    },
    hook: {
      en: '“Happy Birthday”: hap-py → BIRTH. Or simply do → re.',
      pt: '“Parabéns pra você”: pa-ra → BÉNS. Ou simplesmente dó → ré.',
    },
  },
  m3: {
    feel: {
      en: 'The sad third. Small, dark and a little bluesy — the heart of a minor chord.',
      pt: 'A terça triste. Pequena, escura e meio blues — o coração do acorde menor.',
    },
    hook: {
      en: 'The first two notes of the “Smoke on the Water” riff, or of “Greensleeves”.',
      pt: 'As duas primeiras notas do riff de “Smoke on the Water”, ou de “Greensleeves”.',
    },
  },
  M3: {
    feel: {
      en: 'The happy third. Bright and sweet — the heart of a major chord.',
      pt: 'A terça alegre. Clara e doce — o coração do acorde maior.',
    },
    hook: {
      en: '“Oh, When the Saints”: oh → WHEN. The first two notes of any major chord.',
      pt: '“Oh, When the Saints”: oh → WHEN. As duas primeiras notas de qualquer acorde maior.',
    },
  },
  P4: {
    feel: {
      en: 'Firm and open, like an announcement. It sounds like it is arriving somewhere.',
      pt: 'Firme e aberta, como um anúncio. Soa como quem está chegando a algum lugar.',
    },
    hook: {
      en: '“Here Comes the Bride”: here → COMES. Also “Amazing Grace”.',
      pt: 'A Marcha Nupcial (“lá vem a noiva”): as duas primeiras notas.',
    },
  },
  TT: {
    feel: {
      en: 'Exactly half an octave. Restless and unresolved — it begs to move somewhere else.',
      pt: 'Exatamente meia oitava. Inquieto e sem resolução — pede para ir a outro lugar.',
    },
    hook: {
      en: '“The Simpsons” theme: the → SIMP-sons. Or “Ma-RI-a” from West Side Story.',
      pt: 'O tema de “Os Simpsons”: the → SIMP-sons.',
    },
  },
  P5: {
    feel: {
      en: 'Wide, hollow and strong. Neither happy nor sad — the sound of a power chord.',
      pt: 'Larga, oca e forte. Nem alegre nem triste — o som do power chord.',
    },
    hook: {
      en: '“Twinkle, Twinkle, Little Star”: twinkle → TWINKLE. Or the “Star Wars” main theme.',
      pt: '“Brilha, brilha, estrelinha”: brilha → BRILHA. Ou o tema principal de “Star Wars”.',
    },
  },
  m6: {
    feel: {
      en: 'A wide, aching leap. Romantic and a bit dramatic.',
      pt: 'Um salto largo e dolorido. Romântico e um pouco dramático.',
    },
    hook: {
      en: 'The opening leap of “Manhã de Carnaval” (Black Orpheus).',
      pt: 'O salto que abre “Manhã de Carnaval”: ma → NHÃ.',
    },
  },
  M6: {
    feel: {
      en: 'A wide leap that lands somewhere warm and cheerful.',
      pt: 'Um salto largo que cai num lugar quente e alegre.',
    },
    hook: both('“My Bonnie Lies Over the Ocean”: my → BON-nie.'),
  },
  m7: {
    feel: {
      en: 'Almost an octave, but it falls short. Bluesy, open and unfinished.',
      pt: 'Quase uma oitava, mas fica devendo. Blues, aberta e inacabada.',
    },
    hook: {
      en: '“Somewhere” from West Side Story: there’s → A place. Or the original “Star Trek” theme.',
      pt: '“Somewhere”, de West Side Story: there’s → A place. Ou o tema original de “Jornada nas Estrelas”.',
    },
  },
  M7: {
    feel: {
      en: 'One semitone short of the octave. Sharp and yearning — it leans hard toward the note above.',
      pt: 'Um semitom antes da oitava. Aguda e cheia de anseio — puxa com força para a nota de cima.',
    },
    hook: {
      en: 'The chorus of “Take On Me”: take → ON.',
      pt: 'O refrão de “Take On Me”: take → ON.',
    },
  },
  P8: {
    feel: {
      en: 'The same note, higher. So smooth the two almost melt into one.',
      pt: 'A mesma nota, mais aguda. Tão liso que as duas quase viram uma só.',
    },
    hook: both('“Somewhere Over the Rainbow”: some → WHERE.'),
  },
}

/** What to listen for in each chord quality. */
export const CHORD_NOTES: Record<string, SoundNote> = {
  maj: {
    feel: { en: 'Bright, stable, at rest.', pt: 'Claro, estável, em repouso.' },
    hook: {
      en: 'Listen to the middle note: it sits high (a major third above the root).',
      pt: 'Ouça a nota do meio: ela fica alta (uma terça maior acima da tônica).',
    },
  },
  min: {
    feel: { en: 'Darker and more wistful, but just as stable.', pt: 'Mais escuro e melancólico, mas igualmente estável.' },
    hook: {
      en: 'Same outer notes as major — only the middle note drops a semitone. Play both back to back.',
      pt: 'As notas de fora são as mesmas do maior — só a do meio desce um semitom. Toque os dois em seguida.',
    },
  },
  dim: {
    feel: { en: 'Tight and nervous. It cannot stay still.', pt: 'Apertado e nervoso. Não consegue ficar parado.' },
    hook: {
      en: 'A minor chord with the top note also lowered: everything is squeezed together. Silent-film suspense.',
      pt: 'Um acorde menor com a nota de cima também abaixada: tudo fica espremido. Suspense de cinema mudo.',
    },
  },
  aug: {
    feel: { en: 'Floating and strange, like a question left hanging.', pt: 'Flutuante e estranho, como uma pergunta no ar.' },
    hook: {
      en: 'A major chord with the top note raised: stretched open. Dream-sequence sound.',
      pt: 'Um acorde maior com a nota de cima levantada: esticado. Som de cena de sonho.',
    },
  },
  dom7: {
    feel: {
      en: 'Major, but restless: it wants to resolve to another chord. The sound of the blues.',
      pt: 'Maior, mas inquieto: quer resolver em outro acorde. O som do blues.',
    },
    hook: {
      en: 'A major chord plus a slightly “dirty” note on top.',
      pt: 'Um acorde maior com uma nota meio “suja” em cima.',
    },
  },
  maj7: {
    feel: { en: 'Soft, dreamy and sophisticated. Bossa nova and jazz.', pt: 'Macio, sonhador e sofisticado. Bossa nova e jazz.' },
    hook: {
      en: 'A major chord with a sweet, close note on top that does not ask to move.',
      pt: 'Um acorde maior com uma nota doce e próxima em cima, que não pede para sair do lugar.',
    },
  },
  min7: {
    feel: { en: 'Mellow and smooth — minor without the sadness.', pt: 'Suave e aveludado — menor sem a tristeza.' },
    hook: {
      en: 'First decide major or minor from the bottom three notes, then listen for the extra note on top.',
      pt: 'Primeiro decida maior ou menor pelas três notas de baixo, depois ouça a nota extra em cima.',
    },
  },
  m7b5: {
    feel: { en: 'Dark and ambiguous, with tension inside.', pt: 'Escuro e ambíguo, com tensão por dentro.' },
    hook: {
      en: 'A diminished chord with a softer top: less alarming than the diminished, more uneasy than the minor 7th.',
      pt: 'Um diminuto com o topo mais suave: menos alarmante que o diminuto, mais inquieto que o menor com sétima.',
    },
  },
}
