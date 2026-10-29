# Synchronisation exclusive

Ce package aide une application à laisser une seule page modifier une valeur
partagée. L’application fournit elle-même le stockage, le transport et la
présentation.

```ts
import { ExclusiveSyncSession } from '@codplay/exclusive-sync'

const session = new ExclusiveSyncSession({
  acquire: async () => ({ grantId: 'droit-1' }),
  release: async () => {},
  stillHeld: async () => true,
  readConfirmed: async () => ({ revision: 1, value: 'Texte publié' }),
  publishPending: async () => {},
  installConfirmed: async ({ value }) => { console.log(value) },
  setEditable: (editable) => { console.log(editable) },
})

await session.refreshReader()
await session.requestEdit()
await session.yieldEdit()
```
