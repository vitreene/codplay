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
