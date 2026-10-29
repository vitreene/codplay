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

Pour le mode auteur, préparez les ressources demandées par la scène avant de
créer l'instance. Pour la diffusion, construisez le player une fois, puis
exportez chaque scène dans son propre dossier :

```sh
npm run build:player --workspace=codplay
npm run export --workspace=codplay -- \
  --scene ./src/scene.ts \
  --export ./public/exports/ma-scene
```

Le player est produit dans `packages/codplay/dist/codplay.js`. Déployez-le une
fois, par exemple à `/vendor/codplay/codplay.js` dans le site, puis déployez les
dossiers de scènes séparément.

Le module source exporte le `SceneDoc` sous `scene` ou comme export par défaut.
Il peut fournir le CSS éditorial sous forme d'une chaîne `styleSheet` et
importer des feuilles `.css` locales :

```ts
export const scene: SceneDoc = { /* scène décrite ci-dessus */ }
export const styleSheet = '.bonjour-message { font-weight: 700; }'
```

Le site importe le player déployé séparément, appelle `load()` pour charger le
paquet scène et installer sa feuille scoped, puis lance cette occurrence :

```ts
import { CodPlay } from '/vendor/codplay/codplay.js'

const player = new CodPlay()
const instance = await player.load('/exports/ma-scene/', { root: '#scene' })
await instance.telco.play()
```

Le même player peut charger plusieurs dossiers de scènes depuis un site. Le
code de la scène, son CSS et ses ressources restent dans chaque paquet scène.

L'export conserve les classNames CSS et limite la feuille au conteneur donné à
`load()`. Il empaquette aussi les images, l'audio, la vidéo et les fontes locales
déclarées par `@font-face`, puis attend leur disponibilité avant de retourner
l'instance. Consultez la spécification du
[paquet de diffusion](./specs/scene-package-export-v1-spec.md) pour les formes
de ressources prises en charge.

Les [démos V2](../demos/src/v2/demos/) montrent des scènes plus riches :
[composants](../demos/src/v2/demos/components/components-scene.ts),
[événements](../demos/src/v2/demos/events/main.ts),
[mouvements](../demos/src/v2/demos/position/main.ts) et
[scroll](../demos/src/v2/demos/scroll-container/main.ts).
Les [spécifications auteur](./specs/) donnent les détails des capacités qui
disposent d'un contrat dédié.
