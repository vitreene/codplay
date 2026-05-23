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
- le contrat des helpers dans un `Strap` est distinct du contrat d'emission active de `player.schedule`.

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

type StrapStep = {
  event?: StoryEvent
  update?: Record<string, unknown>
}

type HelperHandle = {
  id: string
  cancel: () => void
}

type StrapHelpers = {
  delay: (ms: number, step: StrapStep | ((index: number) => StrapStep)) => HelperHandle
  repeat: (
    options: { everyMs: number | ((index: number) => number); times: number },
    step: StrapStep | ((index: number) => StrapStep)
  ) => HelperHandle
  loop: (
    options: { everyMs: number },
    factory: (index: number) => StoryEvent[]
  ) => HelperHandle
  stagger: (
    options: { stepMs: number },
    steps: StrapStep[]
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
- en `seek`, les helpers de strap ne sont pas rejoues comme execution de code.
- en `seek`, le runtime relit les `events` et `update` deja materialises dans les tracks.

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
- `cancel()` ne supprime ni ne desactive des entries deja materialisees dans les tracks.

6. Replay / seek

- `replay` regenere les emissions a partir du journal canonique ou du plan compile.
- `seek backward` render-only ne rejoue pas les `effects` helper.
- `scene:replay-from-zero` reconstruit integralement le plan helper.
- le replay `seek` ne neutralise pas artificiellement ces tracks materialisees pour simuler une annulation.

7. Effects

- les helpers n'executent pas de `effects` externes directement.
- les `effects` passent par emission d'events vers l'API runtime/scene.

8. Policy runtime

- les emissions helper passent par les policies runtime events actives.
- les garde-fous (`maxEventsPerTick`, `maxCascadeDepth`, validation payload) s'appliquent a l'identique.

## Semantique par helper

- `delay`: produit un `StrapStep` unique a `now + ms`.
- `repeat`: produit `times` occurrences d'un `StrapStep`.
- quand `everyMs` est une fonction, sa valeur est un offset absolu depuis le depart du `repeat`.
- `loop`: emet indefiniment toutes les `everyMs` jusqu'a annulation.
- `stagger`: produit une liste de `StrapStep` avec decalage progressif `index * stepMs`.
- la semantique "delai avant l'occurrence suivante" releve plutot de `stagger` que de `repeat`.

## Invariants helpers V1

- source unique d'horloge runtime.
- comportement deterministe a entree identique.
- annulation explicite par handle.
- dans un strap, les helpers finis ne jouent pas directement des `effects` runtime; ils construisent des sorties rejouables.
- une fois ces sorties finies materialisees dans les tracks, elles appartiennent au journal canonique de sequence.
- hors strap, `player.schedule` peut garder une semantique d'emission active.
- exposition publique via `player.schedule` sans acces direct au `Director`.
- execution helper alignee sur les transitions `play/pause/resume/stop` du `Player`; `destroy` reste un cas technique a part.
