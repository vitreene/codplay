# Écrire une scène avec CodPlay V2

CodPlay joue une scène interactive dans une page. Vous déclarez les éléments
présents au départ, les événements qui surviennent pendant la lecture et les
changements que ces événements provoquent. Une scène peut contenir plusieurs
stories ; chacune regroupe ses éléments et ses événements locaux.

## Un premier exemple

Cette scène affiche un message, le remplace après une seconde et termine sa
lecture après deux secondes :

```ts
import { CodPlay, type SceneDoc } from 'codplay'

const scene: SceneDoc = {
  id: 'bonjour',
  stories: {
    main: {
      id: 'main',
      persos: [{
        id: 'message',
        type: 'tag',
        initial: {
          tag: 'p',
          content: 'Bienvenue',
          move: '@root',
        },
        actions: {
          saluer: { content: 'Bonjour, CodPlay !' },
        },
      }],
      eventimes: [{ name: 'saluer', startAt: 1_000 }],
    },
  },
  eventimes: [{ name: 'sequence:end', startAt: 2_000 }],
}

const root = document.getElementById('scene')
if (!root) throw new Error('Élément #scene introuvable')

const codplay = new CodPlay()
const result = codplay.build({ scene })
if (!result.ok) throw new Error('La scène est invalide')

const instance = codplay.instances.create({
  instanceId: 'bonjour-1',
  compiledScene: result.compiledScene,
  functions: result.functions,
  root,
})

await instance.telco.play()
```

La page doit contenir `<div id="scene"></div>`. `initial` détermine ce qui
apparaît avant la première action. L'eventime `saluer` déclenche l'action de
même nom sur le perso `message` à 1 000 ms. La telco de l'instance permet aussi
de mettre en pause, de reprendre et d'aller à un instant avec `seek(timeMs)`.
Appelez `codplay.destroy()` lorsque cette utilisation de CodPlay se termine.

Pour des images ou des médias, préparez les ressources demandées par la scène
avant de créer l'instance. Les [démos V2](../demos/src/v2/demos/) montrent des
scènes plus riches : [composants](../demos/src/v2/demos/components/components-scene.ts),
[événements](../demos/src/v2/demos/events/main.ts),
[mouvements](../demos/src/v2/demos/position/main.ts) et
[scroll](../demos/src/v2/demos/scroll-container/main.ts).
Les [spécifications auteur](./specs/) donnent les détails des capacités qui
disposent d'un contrat dédié.
