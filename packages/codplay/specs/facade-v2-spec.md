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
catalogue ; `register` et `override` sont disponibles jusqu'au premier `build`,
`instances.create` ou `load()`. `load()` verrouille les registres publics dès
l'appel, avant son travail asynchrone. Ensuite, la composition auteur est
verrouillée. Une opération de registre refusée renvoie son résultat structuré
et publie un diagnostic. Un paquet de scène ne modifie pas le catalogue ; les
composants et bibliothèques tiers nécessaires doivent déjà être configurés dans
l'engine partagé avant `load()`.
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

### Chargement d'un paquet de scène

`await player.prepare(scenePath, { root, cssSlot? })` valide un paquet et rend
son compilé, ses fonctions, ses ressources et son CSS disponibles sans créer
d'occurrence. Il utilise le même owner, moteur, preload et registre de ressources
que `load()`. Le résultat fournit les données nécessaires à
`instances.create()` ; si l'intégration choisit un `cssSlot`, elle en garde la
libération. Cette préparation permet à un runtime intégrateur de contrôler
séparément le moment de création de ses occurrences.

`await player.load(scenePath, { root })` charge une occurrence d'un paquet
média, CSS, fontes locales et fonctions auteur, avec feuille et module de
fonctions optionnels. `load()` réutilise `prepare()` puis crée et retourne son
`CodPlayInstance` après préparation.
`root` est un sélecteur CSS ou un
`HTMLElement`. `load()` réutilise le moteur, le service de preload,
l'enregistrement des ressources et le registre d'instances de ce même
propriétaire. Le CSS passe par le canal `preload.css.set()` existant : il est
installé dans le `head`, scoped au `root` et retiré quand l'occurrence est
détruite. Avant la création, `load()` vérifie les `@font-face` du manifeste et
attend leur chargement effectif ; une face absente ou en échec rejette l'appel.
Les stratégies de preload tierces sont fournies par l'intégration configurée
sur le même owner, comme les définitions correspondantes ; le paquet scène ne
les ajoute pas.
`load()` ne démarre pas la lecture ; l'appelant utilise ensuite
`await instance.telco.play()`. Plusieurs chargements retournent des instances
distinctes. Elles partagent l'engine du propriétaire : une avance de son
horloge fait avancer les occurrences actives ; `pause`, `seek` et la destruction
d'une occurrence ne stoppent ni ne déplacent les autres. Le test du chargeur et
le test d'acceptance du paquet vérifient ce parcours. La démo de diffusion
conservée vérifie une occurrence qui combine Rive et Three.js. Les familles et
les critères de disponibilité certifiés sont délimités par la
[spécification du paquet de scène](./scene-package-export-v1-spec.md).

### Identité des hosts HTML tiers

Une intégration qui fournit un host HTML doit employer l'unique
`BaseHTMLComponent` exporté par le même module `codplay` que celui qui construit
l'owner. `HtmlComponentMaterializer` reconnaît cette frontière par
`instanceof BaseHTMLComponent` ; si le bundle d'intégration embarque une seconde
copie de CodPlay, son host n'est pas matérialisable. Le bundle du site doit donc
laisser `codplay` externe et résoudre son import vers le fichier du player déjà
chargé. Les hosts spécialisés Rive et Three restent des classes distinctes,
mais héritent de cette même classe de base. Une intégration qui étend
`TagComponent` importe cette classe depuis l'entrée racine publique `codplay`,
comme `BaseHTMLComponent`, afin que sa chaîne d'héritage utilise la classe que
le player reconnaît. `TagComponent`, `sanitizeTagInitial` et
`validateTagInitial` sont exportés par cette entrée ; un import de
`codplay/runtime/components` peut sinon être embarqué dans le bundle d'engine
comme une seconde copie. La recette Safari de diffusion Sighty Demo 5 confirme
la matérialisation du scrollport dans ce montage séparé. L'acceptance navigateur R9 du
[plan d'export](../plan/2026-10-15-export-diffusion-plan.md#r9--composants-fournis-par-lengine)
vérifie leur matérialisation et une seule URL player.

Si le manifeste déclare `scene/functions.mjs`, `load()` l'importe et crée le
contexte de fonctions/straps vérifié avant `instances.create()`. Un même
propriétaire et une même URL canonique de paquet partagent ce contexte entre
leurs occurrences ; les propriétaires différents ont des closures isolées.
Le contexte est libéré par `codplay.destroy()`. Le navigateur vérifie
l'exécution de `scene.onStart` après `instance.telco.play()` ainsi qu'un clic
DOM traversant un transform de story, un strap externe de story, un événement
transformé vers la portée scène et un strap externe de scène. Les deux sorties
publiques arrivent dans `instance.events.onEvent`. La preuve couvre cette
verticale ; les autres callbacks, capture, Seek et replay restent au
[plan d'export R8](../plan/2026-10-15-export-diffusion-plan.md#r8--fonctions-codplay-et-imports).
Les suites
[`scene-package-loader.spec.ts`](../tests/facade/scene-package-loader.spec.ts)
et [`cli.spec.mjs`](../tools/scene-export/tests/cli.spec.mjs) vérifient le
transport, les références et les portées de ces contextes.

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
