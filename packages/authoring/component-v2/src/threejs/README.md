# Ajouter un composant Three.js sur mesure

Un composant Three.js sur mesure crée ou anime un objet dans une scène déjà
hébergée par `three-scene-host`. Il ne crée pas de canvas, ne lance pas de
boucle `requestAnimationFrame` et ne déclenche pas lui-même le rendu.

Les composants génériques de l'intégration se trouvent dans `threejs/core` :

- `three-scene-host` possède le canvas, le renderer et la scène ;
- `three-camera` et `three-light` ajoutent leurs objets à cette scène ;
- l'hôte effectue le rendu final après la mise à jour de ses composants.

Les ressources binaires passent par `THREE_PRELOAD_STRATEGIES` (`three-glb` ou
`three-fbx`). Cette stratégie utilise le `FileLoader` de Three.js ; un
composant spécialisé consomme ensuite les octets préparés et peut les remettre
au loader Three.js approprié pour créer sa propre instance.

```ts
import { CodPlay } from 'codplay'
import {
  THREEJS_CORE_ENGINE,
  THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: THREEJS_CORE_ENGINE,
  preload: { strategies: THREE_PRELOAD_STRATEGIES },
})

await codplay.preload.load({
  manifest: {
    entries: [{
      url: '/avatars/example.glb',
      type: 'three-glb',
      policy: { cache: 'default', priority: 'normal' },
    }],
  },
})
```

Un composant spécialisé possède son propre dossier. La grille procédurale est
un exemple : `threejs/instanced-grid`.

## 1. Créer le dossier du composant

Pour un composant `three-ring`, utilisez une structure de ce type :

```text
threejs/ring/
  index.ts
  three-ring-component.ts
  three-ring-definition.ts
  three-ring-types.ts
  three-ring-validation.ts
```

Le profil initial et les actions restent des données sérialisables :

```ts
// three-ring-types.ts
import type { PersoInitialCommon } from 'codplay'
import type { ThreeColorValue } from '../core'

export type ThreeRingInitial = PersoInitialCommon & Readonly<{
  radius?: number
  color?: ThreeColorValue
  rotationPeriodMs?: number
}>

export type ThreeRingAction = Readonly<{
  animate?: boolean
}>
```

`rel` n'est pas redéfini dans chaque type : il fait partie des données
initiales communes. L'auteur l'utilise pour désigner le host Three cible.

## 2. Écrire la classe

Une déclaration de composant référence directement une classe. Il n'y a pas de
factory qui fabrique une nouvelle classe pour chaque scène.

```ts
// three-ring-component.ts
import { BaseThreeComponent } from '../core'
import type { ComponentAnimation, ComponentUpdateInput } from 'codplay'
import type { BufferGeometry, Material, Mesh, Scene } from 'three'
import type { ThreeSceneTarget } from '../core'
import type { ThreeRingInitial } from './three-ring-types'

export class ThreeRingComponent extends BaseThreeComponent<ThreeRingInitial> {
  static readonly declaredServices = [] as const

  private mesh: Mesh | undefined
  private geometry: BufferGeometry | undefined
  private material: Material | undefined
  private attachedScene: Scene | undefined

  update(input: ComponentUpdateInput<ThreeRingInitial>): void {
    const target = input.target as ThreeSceneTarget

    if (this.mesh === undefined) this.createMesh(input.state)
    if (this.mesh === undefined) return
    if (this.mesh.parent !== target.scene) target.scene.add(this.mesh)
    this.attachedScene = target.scene

    const action = input.activeActions?.find(
      (candidate) => candidate.action.animate === true,
    )
    if (action === undefined) return

    const animation: ComponentAnimation = {
      id: 'three-ring-animation',
      startAt: action.startAt,
      endAt: Number.MAX_SAFE_INTEGER,
      sample: (timeMs) => ({
        value: timeMs,
        apply: () => {
          if (this.mesh === undefined) return
          const period = input.state.rotationPeriodMs ?? 4_000
          this.mesh.rotation.y = ((Math.max(0, timeMs - action.startAt) / period)
            * Math.PI * 2) % (Math.PI * 2)
        },
      }),
    }
    input.registerAnimation?.(animation)
  }

  destroy(): void {
    this.detach()
    this.geometry?.dispose()
    this.material?.dispose()
    this.geometry = undefined
    this.material = undefined
    this.mesh = undefined
  }

  private createMesh(state: ThreeRingInitial): void {
    const geometry = new this.runtime.TorusGeometry(state.radius ?? 0.8, 0.12, 16, 48)
    const material = new this.runtime.MeshStandardMaterial({
      color: state.color ?? '#38bdf8',
    })
    this.geometry = geometry
    this.material = material
    this.mesh = new this.runtime.Mesh(geometry, material)
  }

  private detach(): void {
    if (this.mesh !== undefined && this.attachedScene !== undefined) {
      this.attachedScene.remove(this.mesh)
    }
    this.attachedScene = undefined
  }
}
```

Le contexte `input.runtime` est fourni par l'engine. La classe ne charge donc
pas Three.js et ne lit pas de variable globale. `input.target` est la cible
résolue à partir de `rel` ; la classe n'a pas à rechercher l'hôte.

Le composant calcule sa pose à partir de `timeMs`. Le même calcul est donc
utilisé pendant Play et pendant Seek. Le rendu est laissé à l'hôte.

## 3. Déclarer la classe

Le dossier possède une définition qui relie le type auteur, la classe, la
validation et la bibliothèque requise :

```ts
// three-ring-definition.ts
import type { RuntimeComponentDefinition } from 'codplay'
import { ThreeRingComponent } from './three-ring-component'
import { validateThreeRing } from './three-ring-validation'

export const THREE_RING_DEFINITION: RuntimeComponentDefinition = {
  type: 'three-ring',
  component: ThreeRingComponent,
  modules: [],
  libraries: ['three'],
  validateInitial: validateThreeRing,
  validateAction: validateThreeRing,
}
```

`libraries: ['three']` demande à l'engine de préparer Three.js avant la
création des composants. Il ne faut pas ajouter un chargement dans le
constructeur, `update()` ou `destroy()`.

`index.ts` réexporte la classe, la définition, les types et le validateur du
composant. Le validateur ne contrôle que les données comprises par ce
composant ; une donnée Three.js native ne doit pas entrer dans la scène
compilée.

## 4. Enregistrer le composant dans l'engine

L'application compose la déclaration générique Three.js et les composants
spécialisés dont elle a besoin :

```ts
import {
  THREEJS_CORE_ENGINE,
  THREE_RING_DEFINITION,
} from '@codplay/component-v2'

const engine = {
  ...THREEJS_CORE_ENGINE,
  components: {
    register: [
      ...(THREEJS_CORE_ENGINE.components?.register ?? []),
      THREE_RING_DEFINITION,
    ],
  },
}
```

Le core Three.js reste ainsi réutilisable, tandis que `three-ring` n'est
disponible que dans les scenes qui l'enregistrent explicitement.

## 5. Utiliser le composant dans une scène

L'hôte et l'objet animé sont deux persos distincts. Le host est le seul à
recevoir `move` et l'objet y est attaché par `rel` :

```ts
{
  id: 'three-scene',
  type: 'three-scene-host',
  initial: { width: 720, height: 540 },
},
{
  id: 'ring',
  type: 'three-ring',
  initial: {
    rel: { host: 'three-scene' },
    radius: 0.8,
    color: '#38bdf8',
  },
  actions: {
    spin: { animate: true },
  },
}
```

L'événement qui déclenche `spin` suit le circuit habituel de CodPlay :

```ts
eventimes: [{ name: 'spin', startAt: 0 }]
```

Une relation inconnue produit un diagnostic auteur non bloquant et reste
silencieuse en diffusion. Une cible valide mais momentanément absente est
attendue jusqu'à ce qu'elle soit montée.

## À retenir

- placez les composants génériques dans `threejs/core` et chaque composant
  sur mesure dans son propre dossier ;
- déclarez une classe, pas une factory de classe ;
- déclarez `libraries: ['three']` et laissez l'engine préparer la bibliothèque ;
- utilisez `rel` et `input.target` pour la relation avec l'hôte ;
- calculez les poses à partir du temps CodPlay ;
- laissez l'hôte effectuer le rendu final ;
- libérez dans `destroy()` toutes les ressources natives créées par le
  composant ;
- testez au moins deux temps différents, la répétition d'un même temps et le
  parcours réel de préparation par l'engine.
