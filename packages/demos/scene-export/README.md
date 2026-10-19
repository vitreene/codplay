# Export d’une démo CodPlay V2

Cette page charge deux occurrences d'un paquet construit depuis
`packages/demos/src/v2/demos/preload-media/main.ts`, avec sa feuille CSS, deux
images, un audio et une vidéo. Un seul owner `CodPlay` charge les deux
occurrences dans deux roots. Le script de build crée un adaptateur temporaire
pour appeler le CLI, puis le supprime.

```sh
npm run scene-export:build --workspace=@codplay/demos
npm run build --workspace=@codplay/demos
npm run preview --workspace=@codplay/demos
```

Ouvrir `/scene-export/` et attendre que A et B soient prêtes. « Lancer A et B »
démarre les deux occurrences. Pause, Seek au milieu de la vidéo (timeline CodPlay
à 5 000 ms) et Détruire ciblent A ; B continue sous l’engine partagé. Le paquet
scène contient la scène compilée, sa feuille CSS et les quatre médias locaux
sous `public/exports/scene-export/`. Le player est construit séparément dans
`public/codplay-player/codplay.js` et importé une seule fois par la page :

```ts
import { CodPlay } from '/codplay-player/codplay.js'

const player = new CodPlay()
const [instanceA, instanceB] = await Promise.all([
  player.load('/exports/scene-export/', { root: '#scene-root-a' }),
  player.load('/exports/scene-export/', { root: '#scene-root-b' }),
])
await Promise.all([instanceA.telco.play(), instanceB.telco.play()])
```
