# SCORM pour Sighty

`@codplay/sighty-scorm` est le package compagnon qui apporte SCORM aux projets
construits avec Sighty. Il est distinct du runtime `@codplay/sighty` : Sighty
gère la navigation et les actions de page, tandis que ce package gère la session
LMS et les appels CMI. Il n’est pas propre à Elcé ; chaque application fournit
son adaptateur métier pour traduire son état vers les types SCORM partagés.

Dans Elcé, les actions de page Sighty appellent `ElceScormAdapter`, qui traduit
l’état Elcé avant de le transmettre à `ScormSession`. Un autre projet basé sur
Sighty peut réutiliser `ScormSession` avec son propre adaptateur.

```ts
import { ScormSession } from '@codplay/sighty-scorm'

const session = new ScormSession({ version: '2004v4' })
const saved = await session.initialize()
await session.saveReaderState({
  location: saved.location || null,
  suspendData: saved.suspendData,
})
await session.close()
```
