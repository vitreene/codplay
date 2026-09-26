# CodPlay V2 — façade publique et instances

## Périmètre vérifié

Cette spécification décrit la surface publique actuellement exposée par
[`CodPlay`](../src/facade/codplay-facade.ts) et ses
[types](../src/facade/facade-types.ts). Les décisions d'extension non prises
restent dans le [plan façade](../plan/facade-engine-instance-plan.md). Les profils
de scène relèvent de la
[spécification de compilation](./scene-authoring-spec.md).

## Propriétaire, préparation et instances

Un `CodPlay` possède un catalogue de capacités, un engine, un service preload,
un registre de ressources et un registre d'instances. Les options `engine`
composent les définitions initiales des familles `components`, `services`,
`modules` et `libraries`. Les registres publics `codplay.components`,
`codplay.services`, `codplay.modules` et `codplay.libraries` partagent ce même
catalogue ; `register` et `override` sont disponibles jusqu'au premier `build`
ou `instances.create`. Ensuite, la composition est verrouillée. Une opération
de registre refusée renvoie son résultat structuré et publie un diagnostic.
Les options `htmlHost` relient les sources propres au navigateur sans les
inscrire dans le catalogue de modules.

```ts
import { CodPlay, type SceneDoc } from 'codplay'

const codplay = new CodPlay()
const scene: SceneDoc = {
  id: 'salutation',
  stories: { main: { id: 'main', persos: [] } },
}
const build = codplay.build({ scene })
if (!build.ok) throw new Error('Scène invalide')

await codplay.engine.prepareScene(build.compiledScene)
const instance = codplay.instances.create({
  instanceId: 'salutation-1',
  compiledScene: build.compiledScene,
  functions: build.functions,
  root: document.getElementById('scene') ?? undefined,
})
await instance.telco.play()
```

`build` compile sans créer d'instance. Le résultat réussi fournit le
`CompiledScene`, les fonctions compilées et les diagnostics. `engine.prepareScene`
prépare les bibliothèques requises avant la création de l'instance. Pour les
médias, l'hôte appelle séparément
`codplay.preload.load`, enregistre son résultat par
`codplay.resources.register`, puis crée l'instance. `instances.create` crée
et initialise une occurrence avec un `CompiledScene` validé ; en l'absence de
`root`, elle utilise un conteneur de matérialisation interne détaché. Le
propriétaire appelle `codplay.destroy()` à la fin de son propre cycle de vie.
Le
[registre d'instances](../src/facade/engine-facade/instance-registry.ts) et le
[plan média](../plan/media-preload-plan.md) donnent les détails de ces chemins.
Le [test de façade](../tests/facade/facade.spec.ts) et le
[test de transfert média](../tests/facade/media-preload-handoff.spec.ts) les
exercent.

`codplay.instances.get`, `destroy` et `mount` sont les opérations publiques du
registre. `mount` adresse un perso hôte `slot` dans une instance et y attache
les racines matérialisées d'une instance enfant ; le handle retourné détache
la relation. Cette opération ne décide pas du temps ni de la survie de
l'enfant. Son contrat est décrit dans la
[spécification slot](./slot-component-spec.md) et le
[plan foreign](../plan/foreign-scene-component-plan.md), avec le
[test de montage](../tests/facade/foreign-mount.spec.ts).

## Temps, événements et observation

`instance.telco` pilote une occurrence : `play`, `pause`, `reset`, `seek`,
`rewind`, `togglePlay`, `setRate`, `getState`, `getProgress`, `onChange` et
`onProgress`. La progression expose le temps logique et la durée ; son
pourcentage est une présentation éventuelle de l'application. Le contrôle
global de l'horloge est sur `codplay.engine` (`start`, `pause`, `stop`,
`advance`) ; `advance` appartient au mode de frames fournies par l'hôte et ne
doit pas être combiné au ticker autonome. La
[spécification Engine/Player](./engine-player-v2-spec.md), le
[plan Engine/Player](../plan/player-engine-plan.md) et les [tests telco](../tests/runtime/telco/runtime-telco.spec.ts)
précisent les comportements vérifiés et les validations de lecture, de seek et
de reset encore ouvertes.

`instance.events.emit(eventime, target)` et `codplay.events.emit(input)`
rejoignent le même player et son journal. La cible est séparée de l'eventime :
elle désigne une portée `scene` ou `story`, et éventuellement une track.
Les observations publiques sont filtrées par la visibilité `public` ; la
trace diagnostique est une autre sortie. La [spécification événementielle](./event-pipeline-v2-spec.md),
le [contrôleur d'événements](../src/runtime/player/runtime-player/event-controller.ts)
et le [test du dispatcher](../tests/runtime/player/runtime-event-dispatcher.spec.ts)
documentent le circuit unique.

## Lecture et projection d'état

`instance.snapshot.get()` lit l'état logique de base du temps présenté, sans
inclure les patches temporaires. `set(patches)` remplace atomiquement la
preview courante et n'accepte que des patches valides pour le temps présenté et
des cibles présentes. Les patches restent associés à leur temps logique : ils
sont visibles lorsque ce temps est présenté, puis peuvent être réappliqués si
la lecture y revient. `clear()` retire la preview. Les refus sont renvoyés avec
un code et publiés comme diagnostics. Ce circuit ne lit pas le DOM pour
reconstruire l'état logique.

`instance.projection.setInputValue()` projette une valeur transitoire sur un
composant `input` monté ; son contrat vérifié est dans la
[spécification de projection input](./input-projection-spec.md).
`instance.presentation.get()` lit le cadre numérique courant produit par le
runner, avec le temps et les poses des éléments présentés. Il ne publie aucun
nœud DOM. Snapshot, projection et présentation sont des surfaces de lecture ou
de preview et n'ajoutent pas d'entrée au journal.

Leurs preuves ciblées sont les [tests snapshot](../tests/facade/snapshot.spec.ts),
[projection](../tests/facade/input-projection.spec.ts) et
[façade](../tests/facade/facade.spec.ts).

## Invariants

- Les classes `RuntimeEngine`, `RuntimePlayer`, le catalogue et le runner HTML
  restent internes à la façade publique.
- Le journal et la reconstruction appartiennent à l'instance CodPlay ; ni
  l'application ni Sighty ne créent de dispatcher concurrent.
- Le modèle logique ne se reconstruit pas depuis le DOM. Les données de
  présentation servent à l'affichage et aux outils qui l'observent.
- Les opérations snapshot et projection ne deviennent pas des faits runtime ;
  elles ne modifient pas le journal d'events.
- `codplay.destroy()` termine les instances et les ressources du propriétaire.
  Une relation `mount` ne transfère pas la propriété d'une instance enfant.

## Preuves ciblées

Les suites de façade, de montage interinstances, de telco, de snapshot, de
projection input et de dispatch couvrent les parcours cités ci-dessus.

Validation exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/facade/facade.spec.ts \
  tests/facade/foreign-mount.spec.ts \
  tests/runtime/telco/runtime-telco.spec.ts \
  tests/facade/snapshot.spec.ts \
  tests/facade/input-projection.spec.ts \
  tests/runtime/player/runtime-event-dispatcher.spec.ts
6 fichiers, 56 tests réussis
```
