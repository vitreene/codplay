# Strap helpers spec V1 - scheduling runtime

## Statut

Spec normative V1 pour les helpers temporels utilises par les `Strap`.

## Objectif

Definir la source, la signature et les regles d'execution de `delay`, `repeat`, `loop`, `stagger` sans usage de timers JS applicatifs.

## Fournisseur runtime

- les helpers sont exposes dans `StrapContext.helpers`.
- ils sont fournis par le runtime `Director` via le scheduler pilote par `Ticker`.
- le runtime expose une facade publique `player.schedule` pour les usages hors strap.
- `Director` reste interne et n'est jamais adresse directement par l'API publique.

## Exposition facade Player

La facade `player.schedule` est destructurable.

```ts
const { delay, repeat, loop, stagger } = player.schedule
```

Les helpers sont aussi exposables en import direct.

```ts
import { delay, repeat, loop, stagger } from "codplay/schedule"
```

L'import direct est un alias de la facade runtime `player.schedule`.

Contrat:

- `player.schedule.*` appelle le meme scheduler runtime que `StrapContext.helpers`.
- `player.schedule.*` applique les memes policies runtime d'events.
- l'import direct `codplay/schedule` appelle ce meme scheduler runtime.
- `schedule` est agnostique de la diffusion: il ne decide ni le domaine event, ni la portee.
- le contexte d'appel determine le domaine de diffusion:
  - appel depuis `StrapContext.helpers`: domaine story local
  - appel depuis `player.schedule`: domaine scene/system
- `cascade` porte la remontee de portee, pas `schedule`.

## Contrat canonique

```ts
type StoryEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

type HelperHandle = {
  id: string
  cancel: () => void
}

type StrapHelpers = {
  delay: (ms: number, event: StoryEvent) => HelperHandle
  repeat: (
    options: { everyMs: number; times: number },
    factory: (index: number) => StoryEvent[]
  ) => HelperHandle
  loop: (
    options: { everyMs: number },
    factory: (index: number) => StoryEvent[]
  ) => HelperHandle
  stagger: (
    options: { stepMs: number },
    events: StoryEvent[]
  ) => HelperHandle[]
}
```

## Regles normatives

1. Horloge

- tous les helpers utilisent la meme reference temporelle runtime.
- aucune implementation helper ne s'appuie sur `setTimeout`/`setInterval` applicatifs.

2. Couplage lifecycle Player

- le scheduler helper est synchronise avec le cycle de vie `Player`.
- en `play` et `resume`, les plans helper continuent selon l'horloge runtime.
- en `pause`, les plans helper sont geles sans perte d'ordre.
- en `stop`, les plans helper en attente sont annules.
- en `destroy`, si cette commande technique est utilisee, les plans helper en attente sont annules.
- en `seek`, le comportement suit les regles runtime de replay/seek de la sequence.

3. Validation

- `ms`, `everyMs`, `stepMs` doivent etre >= 0.
- `times` doit etre >= 1.
- valeur invalide: rejet `AUTHOR_HELPER_INVALID_ARG`.

4. Ordre

- emissions a timestamp egal: ordre de declaration stable.
- emissions d'un meme helper: ordre d'index croissant.

5. Cancelation

- chaque helper retourne un handle annulable.
- `cancel()` empeche les emissions futures du handle.

6. Replay / seek

- `replay` regenere les emissions a partir du journal canonique ou du plan compile.
- `seek backward` render-only ne rejoue pas les side-effects helper.
- `scene:replay-from-zero` reconstruit integralement le plan helper.

7. Side-effects

- les helpers n'executent pas de side-effects externes directement.
- les side-effects passent par emission d'events vers l'API runtime/scene.

8. Policy runtime

- les emissions helper passent par les policies runtime events actives.
- les garde-fous (`maxEventsPerTick`, `maxCascadeDepth`, validation payload) s'appliquent a l'identique.

## Semantique par helper

- `delay`: emet un event unique a `now + ms`.
- `repeat`: emet `times` fois toutes les `everyMs`.
- `loop`: emet indefiniment toutes les `everyMs` jusqu'a annulation.
- `stagger`: emet une liste d'events avec decalage progressif `index * stepMs`.

## Invariants helpers V1

- source unique d'horloge runtime.
- comportement deterministe a entree identique.
- annulation explicite par handle.
- aucune emission helper hors scheduler runtime.
- exposition publique via `player.schedule` sans acces direct au `Director`.
- execution helper alignee sur les transitions `play/pause/resume/stop` du `Player`; `destroy` reste un cas technique a part.
