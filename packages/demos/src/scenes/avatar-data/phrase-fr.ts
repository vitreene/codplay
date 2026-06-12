export interface WordCue {
  word: string
  startMs: number
  endMs: number
  durationMs: number
}

function tc(timecode: string): number {
  const [h, m, s] = timecode.split(':')
  return Math.round((parseInt(h!) * 3600 + parseInt(m!) * 60 + parseFloat(s!)) * 1000)
}

const RAW = [
  { word: 'Vous',           start: '00:00:00.18', end: '00:00:00.33' },
  { word: "l'avez",         start: '00:00:00.33', end: '00:00:00.57' },
  { word: 'donc',           start: '00:00:00.57', end: '00:00:00.81' },
  { word: 'vu,',            start: '00:00:00.81', end: '00:00:01.20' },
  { word: "l'électricité",  start: '00:00:01.20', end: '00:00:01.89' },
  { word: 'présente',       start: '00:00:01.89', end: '00:00:02.34' },
  { word: 'des',            start: '00:00:02.34', end: '00:00:02.49' },
  { word: 'risques.',       start: '00:00:02.49', end: '00:00:03.00' },
  { word: 'Si',             start: '00:00:03.39', end: '00:00:03.63' },
  { word: 'nous',           start: '00:00:03.63', end: '00:00:03.81' },
  { word: 'connaissons',    start: '00:00:03.81', end: '00:00:04.29' },
  { word: 'ces',            start: '00:00:04.29', end: '00:00:04.44' },
  { word: 'risques,',       start: '00:00:04.44', end: '00:00:04.89' },
  { word: 'nous',           start: '00:00:04.89', end: '00:00:05.10' },
  { word: 'pouvons',        start: '00:00:05.10', end: '00:00:05.40' },
  { word: 'les',            start: '00:00:05.40', end: '00:00:05.49' },
  { word: 'prévenir.',      start: '00:00:05.49', end: '00:00:06.12' },
  { word: "C'est",          start: '00:00:06.48', end: '00:00:06.66' },
  { word: 'pourquoi',       start: '00:00:06.66', end: '00:00:06.96' },
  { word: 'il',             start: '00:00:06.96', end: '00:00:07.08' },
  { word: 'est',            start: '00:00:07.08', end: '00:00:07.20' },
  { word: 'essentiel',      start: '00:00:07.20', end: '00:00:07.74' },
  { word: "d'évaluer",      start: '00:00:07.74', end: '00:00:08.19' },
  { word: 'le',             start: '00:00:08.19', end: '00:00:08.31' },
  { word: 'risque',         start: '00:00:08.31', end: '00:00:08.61' },
  { word: 'électrique',     start: '00:00:08.61', end: '00:00:09.06' },
  { word: 'dans',           start: '00:00:09.06', end: '00:00:09.21' },
  { word: 'le',             start: '00:00:09.21', end: '00:00:09.30' },
  { word: 'travail',        start: '00:00:09.30', end: '00:00:09.69' },
  { word: 'que',            start: '00:00:09.69', end: '00:00:09.87' },
  { word: 'vous',           start: '00:00:09.87', end: '00:00:10.02' },
  { word: 'effectuez.',     start: '00:00:10.02', end: '00:00:10.68' },
  { word: 'Cette',          start: '00:00:11.22', end: '00:00:11.52' },
  { word: 'évaluation',     start: '00:00:11.52', end: '00:00:12.03' },
  { word: 'des',            start: '00:00:12.03', end: '00:00:12.15' },
  { word: 'risques',        start: '00:00:12.15', end: '00:00:12.45' },
  { word: 'en',             start: '00:00:12.45', end: '00:00:12.54' },
  { word: 'général',        start: '00:00:12.54', end: '00:00:13.17' },
  { word: 'et',             start: '00:00:13.17', end: '00:00:13.32' },
  { word: 'du',             start: '00:00:13.32', end: '00:00:13.44' },
  { word: 'risque',         start: '00:00:13.44', end: '00:00:13.74' },
  { word: 'électrique',     start: '00:00:13.74', end: '00:00:14.19' },
  { word: 'en',             start: '00:00:14.19', end: '00:00:14.28' },
  { word: 'particulier',    start: '00:00:14.28', end: '00:00:15.09' },
  { word: 'est',            start: '00:00:15.09', end: '00:00:15.33' },
  { word: 'obligatoire.',   start: '00:00:15.33', end: '00:00:16.17' },
  { word: 'Nous',           start: '00:00:16.56', end: '00:00:16.80' },
  { word: 'allons',         start: '00:00:16.80', end: '00:00:17.01' },
  { word: 'en',             start: '00:00:17.01', end: '00:00:17.07' },
  { word: 'parler.',        start: '00:00:17.07', end: '00:00:18.00' },
] as const

export const phraseWordsFR: WordCue[] = RAW.map(r => {
  const startMs = tc(r.start)
  const endMs = tc(r.end)
  return { word: r.word, startMs, endMs, durationMs: endMs - startMs }
})

export const speakAudioFR = {
  words:      phraseWordsFR.map(w => w.word),
  wtimes:     phraseWordsFR.map(w => w.startMs),
  wdurations: phraseWordsFR.map(w => w.durationMs),
}

// ── Phonèmes Preston Blair → visèmes TalkingHead ──────────────────────────────
// Mapping conforme au plan Phase 3 (docs/formalisation/2026-06-11-avatar3d-poc-implementation-plan.md)
// null = silence/neutre → entrée ignorée, la bouche revient à zéro entre les phonèmes actifs

export const PRESTON_TO_TH: Record<string, string | null> = {
  A: 'PP',   // bilabial fermé        (poids 0.9 dans TH)
  B: null,   // repos / neutre        (saut — bouche neutre)
  C: 'aa',   // bouche ouverte "ah"
  D: 'aa',   // schwa ≈ aa
  E: 'E',    // voyelle antérieure
  F: 'O',    // voyelle arrondie
  G: 'FF',   // labiodental           (poids 0.9 dans TH)
  H: 'DD',   // dental/alvéolaire
  X: null,   // silence               (saut)
}

export const MOUTH_CUES: Array<{ start: number; end: number; value: string }> = [
  { start: 0.0,   end: 0.08,  value: 'X' }, { start: 0.08,  end: 0.15,  value: 'B' },
  { start: 0.15,  end: 0.29,  value: 'F' }, { start: 0.29,  end: 0.5,   value: 'B' },
  { start: 0.5,   end: 0.57,  value: 'E' }, { start: 0.57,  end: 0.71,  value: 'B' },
  { start: 0.71,  end: 0.92,  value: 'F' }, { start: 0.92,  end: 1.15,  value: 'A' },
  { start: 1.15,  end: 1.32,  value: 'B' }, { start: 1.32,  end: 1.53,  value: 'C' },
  { start: 1.53,  end: 2.09,  value: 'B' }, { start: 2.09,  end: 2.23,  value: 'F' },
  { start: 2.23,  end: 2.3,   value: 'B' }, { start: 2.3,   end: 2.44,  value: 'C' },
  { start: 2.44,  end: 2.93,  value: 'B' }, { start: 2.93,  end: 3.3,   value: 'X' },
  { start: 3.3,   end: 3.54,  value: 'B' }, { start: 3.54,  end: 3.89,  value: 'F' },
  { start: 3.89,  end: 4.1,   value: 'B' }, { start: 4.1,   end: 4.17,  value: 'E' },
  { start: 4.17,  end: 4.8,   value: 'B' }, { start: 4.8,   end: 4.94,  value: 'F' },
  { start: 4.94,  end: 5.02,  value: 'A' }, { start: 5.02,  end: 5.17,  value: 'F' },
  { start: 5.17,  end: 5.24,  value: 'G' }, { start: 5.24,  end: 5.31,  value: 'F' },
  { start: 5.31,  end: 5.52,  value: 'B' }, { start: 5.52,  end: 5.59,  value: 'G' },
  { start: 5.59,  end: 5.8,   value: 'C' }, { start: 5.8,   end: 6.01,  value: 'B' },
  { start: 6.01,  end: 6.39,  value: 'X' }, { start: 6.39,  end: 6.49,  value: 'B' },
  { start: 6.49,  end: 6.57,  value: 'A' }, { start: 6.57,  end: 6.89,  value: 'E' },
  { start: 6.89,  end: 7.24,  value: 'B' }, { start: 7.24,  end: 7.31,  value: 'E' },
  { start: 7.31,  end: 7.38,  value: 'F' }, { start: 7.38,  end: 7.45,  value: 'B' },
  { start: 7.45,  end: 7.59,  value: 'C' }, { start: 7.59,  end: 7.8,   value: 'B' },
  { start: 7.8,   end: 7.87,  value: 'G' }, { start: 7.87,  end: 8.08,  value: 'B' },
  { start: 8.08,  end: 8.22,  value: 'E' }, { start: 8.22,  end: 8.64,  value: 'B' },
  { start: 8.64,  end: 8.72,  value: 'A' }, { start: 8.72,  end: 8.85,  value: 'C' },
  { start: 8.85,  end: 8.92,  value: 'B' }, { start: 8.92,  end: 9.0,   value: 'A' },
  { start: 9.0,   end: 9.13,  value: 'D' }, { start: 9.13,  end: 9.2,   value: 'F' },
  { start: 9.2,   end: 9.41,  value: 'D' }, { start: 9.41,  end: 9.48,  value: 'H' },
  { start: 9.48,  end: 9.55,  value: 'C' }, { start: 9.55,  end: 9.9,   value: 'F' },
  { start: 9.9,   end: 10.04, value: 'B' }, { start: 10.04, end: 10.11, value: 'G' },
  { start: 10.11, end: 10.39, value: 'F' }, { start: 10.39, end: 10.46, value: 'C' },
  { start: 10.46, end: 10.53, value: 'B' }, { start: 10.53, end: 11.16, value: 'X' },
  { start: 11.16, end: 11.46, value: 'B' }, { start: 11.46, end: 11.53, value: 'G' },
  { start: 11.53, end: 11.6,  value: 'C' }, { start: 11.6,  end: 11.88, value: 'B' },
  { start: 11.88, end: 11.95, value: 'C' }, { start: 11.95, end: 12.09, value: 'B' },
  { start: 12.09, end: 12.16, value: 'C' }, { start: 12.16, end: 12.23, value: 'B' },
  { start: 12.23, end: 12.44, value: 'E' }, { start: 12.44, end: 12.51, value: 'F' },
  { start: 12.51, end: 12.58, value: 'B' }, { start: 12.58, end: 12.72, value: 'C' },
  { start: 12.72, end: 12.82, value: 'D' }, { start: 12.82, end: 12.86, value: 'C' },
  { start: 12.86, end: 12.93, value: 'A' }, { start: 12.93, end: 12.99, value: 'B' },
  { start: 12.99, end: 13.07, value: 'A' }, { start: 13.07, end: 13.16, value: 'B' },
  { start: 13.16, end: 13.3,  value: 'F' }, { start: 13.3,  end: 13.38, value: 'A' },
  { start: 13.38, end: 13.68, value: 'B' }, { start: 13.68, end: 13.75, value: 'C' },
  { start: 13.75, end: 14.03, value: 'F' }, { start: 14.03, end: 14.1,  value: 'B' },
  { start: 14.1,  end: 14.18, value: 'A' }, { start: 14.18, end: 14.3,  value: 'C' },
  { start: 14.3,  end: 14.44, value: 'B' }, { start: 14.44, end: 14.58, value: 'F' },
  { start: 14.58, end: 14.86, value: 'B' }, { start: 14.86, end: 15.06, value: 'X' },
  { start: 15.06, end: 15.26, value: 'B' }, { start: 15.26, end: 15.34, value: 'A' },
  { start: 15.34, end: 15.6,  value: 'B' }, { start: 15.6,  end: 15.74, value: 'H' },
  { start: 15.74, end: 15.88, value: 'C' }, { start: 15.88, end: 15.95, value: 'E' },
  { start: 15.95, end: 16.02, value: 'B' }, { start: 16.02, end: 16.46, value: 'X' },
  { start: 16.46, end: 16.53, value: 'B' }, { start: 16.53, end: 16.6,  value: 'A' },
  { start: 16.6,  end: 16.65, value: 'F' }, { start: 16.65, end: 16.77, value: 'B' },
  { start: 16.77, end: 16.84, value: 'F' }, { start: 16.84, end: 16.91, value: 'B' },
  { start: 16.91, end: 16.99, value: 'A' }, { start: 16.99, end: 17.15, value: 'D' },
  { start: 17.15, end: 17.19, value: 'C' }, { start: 17.19, end: 17.38, value: 'B' },
  { start: 17.38, end: 17.39, value: 'X' },
]

// Filtre les silences/neutres (B, X) — la bouche revient à zéro entre les actifs
const activeCues = MOUTH_CUES.filter(c => PRESTON_TO_TH[c.value] !== null)

export const speakWithPhonemesFR = {
  audio:      undefined as AudioBuffer | undefined, // à remplir dans le demo
  words:      phraseWordsFR.map(w => w.word),
  wtimes:     phraseWordsFR.map(w => w.startMs),
  wdurations: phraseWordsFR.map(w => w.durationMs),
  visemes:    activeCues.map(c => PRESTON_TO_TH[c.value]!),
  vtimes:     activeCues.map(c => Math.round(c.start * 1000)),
  vdurations: activeCues.map(c => Math.round((c.end - c.start) * 1000)),
}
