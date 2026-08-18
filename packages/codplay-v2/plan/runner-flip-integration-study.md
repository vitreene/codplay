# Etude d'integration FLIP dans le runner HTML V2

Status: A relire
CodPlay version: V2 foundation

## Decision

Le bridge FLIP direct actuellement branche dans `HtmlPlayerRunner` est une preuve
de principe. Il n'est pas un contrat d'integration valide et ne doit pas servir de
base normative a `flip-stress`.

La raison n'est pas seulement le seek. Le bridge actuel ne possede pas la frontiere
de transaction necessaire entre etat logique, ecriture composant, mutation de
parentage, lecture DOM FIRST/LAST et projection temporaire. Il fabrique parfois une
nouvelle capture depuis le DOM courant au lieu de lire une capture persistante issue
de l'occurrence `move` qui a produit la transition.

Cette etude fixe la cible avant toute nouvelle modification fonctionnelle. Le code
du bridge direct devra etre remplace ou promu uniquement apres les gates definis ici.

## Contrat a respecter

Pour toute valeur temporelle `t` et un meme `CompiledScene`:

```text
Play jusqu'a t
  == evaluation logique a t
  + captures FLIP actives a t
  + resolution de pose a t
  + commit DOM a t

Seek(t)
  == evaluation logique a t
  + memes captures FLIP actives a t
  + meme resolution de pose a t
  + meme commit DOM a t
```

La comparaison ne porte pas sur l'historique d'execution. Un seek ne rejoue ni
events ni straps et ne reconstruit pas une baseline arbitraire depuis le DOM courant.
Il peut realiser froidement une capture absente, mais cette realisation doit partir
de l'occurrence historique et de ses bornes logiques, pas de l'etat accidentel au
moment de l'appel.

## Etat actuel du flux

### Init

`RuntimePlayer.init()` valide les capacites, cree les services player-scoped,
reconstruit plusieurs fois `t=0`, synchronise les composants, puis projette le
parentage via `LayoutDomBackend`.

La repetition de reconstruction existe parce que la materialisation d'un layout
enregistre des outlets dans `markup`, qui deviennent ensuite des mount targets.
Cette dependance doit devenir une initialisation en deux phases explicite; elle ne
doit pas rester une suite de reconstructions implicites.

Ordre actuel:

```text
create module services
  -> materialize/update components
  -> register markup outlets
  -> reconstruct again
  -> LayoutDomBackend.project
```

### Frame de lecture

Le chemin actuel est:

```text
reconstruct next scene
  -> diff previous/next
  -> MoveFlipLayoutProjection.project
       -> HtmlFlipRuntime.run
             -> FIRST
             -> authored sync
             -> LayoutDomBackend.project
             -> LAST
       -> pose initiale
  -> MoveFlipLayoutProjection.advance(t)
```

La synchronisation auteur est maintenant appelee par `LayoutDomBackend` dans la
mutation de capture, apres FIRST et avant l'ecriture du parentage. FIRST represente
donc l'etat DOM precedent lorsque le move change en meme temps la couleur, la
taille, le contenu ou une propriete de layout.

De plus, `run()` presente la pose a `startAt`, puis `advance(t)` la represente une
seconde fois au meme frame. Cette double presentation est un symptome d'une
frontiere de transaction incomplete.

### Seek actuel apres le garde-fou

Le chemin actuel est:

```text
reconstruct target scene
  -> MoveFlipLayoutProjection.project(phase=seek)
       -> cancel FLIP actif
       -> authored sync + base projection
       -> seekCached()
```

Ce garde-fou respecte la partie essentielle: un seek ne lance plus une capture et
ne transforme pas le DOM courant en FIRST implicite. Il reste incomplet:

- une capture absente n'est realisee froidement que pour une occurrence de move
  compilee a un instant strictement positif;
- il depend du `previousScene` endpoint et perd les occurrences intermediaires;
- il peut effectuer deux commits DOM;
- `captureWindows` du wrapper duplique l'historique de `FlipCaptureCache`;
- les styles temporaires peuvent restaurer un snapshot auteur obsolescent.

### Destroy et invalidation

Le runner invalide l'epoch mais ne reprojette pas systematiquement le temps logique
courant. Le wrapper conserve aussi des fenetres locales qui ne sont pas le cache
FLIP canonique. Le teardown doit annuler les transactions, detruire les overlays,
vider les captures de projection et detacher les composants dans un ordre garanti.

### Tranche implemente apres relecture

La premiere tranche d'integration applique deja quatre garde-fous sans promouvoir
le bridge direct au rang de contrat normatif:

- `flipMode` est conserve de la policy de `move` jusqu'a `SolvedPlacement` et
  `MoveStateDelta`;
- le builder HTML derive les ancetres de la chaine `perso` / `outlet` et capture
  leur pose numerique comme ancetres `stable`;
- `ListCapabilityState` publie un ordre et un touched set consommes par le player;
  le builder conserve un fallback before/after pour les moves hors list;
- `authoredSync` est execute par `LayoutDomBackend` apres FIRST et avant la
  mutation structurelle lorsqu'une projection FLIP est active;
- `projectSeek` ne lance plus `flip.run()` et ne presente qu'une capture deja
  persistante via `seekCached`.
- la transaction historique du cold resolver est extraite dans une fonction
  runner-scoped testable, avec restauration `finally` de la scene courante.

Le journal et le resolver couvrent maintenant les occurrences de move compilees
avec une duree positive. Les presentations historiques reconstruisent aussi les
snapshots des modules structurels, notamment l'ordre `list`, en rejouant les
frontieres d'evenements compilees depuis `t=0` dans des instances temporaires.
Les evenements live et les occurrences commencant a `0` restent sans capture
froide plutot que de recevoir une baseline DOM accidentelle.

## Donnees perdues aux frontieres

| Frontiere | Donnees disponibles | Donnees necessaires mais perdues |
|---|---|---|
| `RuntimePlayer` -> projection | `SolvedScene`, `previousScene`, deltas endpoint | occurrences intermediaires, identite event/action, etat DOM historique |
| component runtime -> projection | state et `timeMs` | placement, move, ordre de mutation, ownership FLIP |
| `LayoutDomBackend` -> projection | parentage et ordre logique | geometrie, transition, touched set, ancetres |
| move policy -> `MoveStateDelta` | cible, operation, transition | identite stable de l'occurrence, `flipMode` complet, batch de mutation |
| `HtmlFlipRuntime` -> host | capture numerique et progression | transaction logique qui a produit FIRST/LAST |
| host DOM -> FLIP | handles et geometrie courante | scene logique et temps historique |

Le bridge ne peut pas etre rendu propre par une condition supplementaire dans
`projectSeek`. Il faut restaurer ces donnees au bon niveau de responsabilite.

## Architecture cible

```text
CompiledScene
  -> TransitionSchedule
  -> RuntimePlayer logical evaluation
  -> PresentationTransaction
       -> component authored state
       -> structural parentage
       -> DOM read phase
       -> transient projection phase
  -> FlipCaptureJournal
       -> current epoch FlipCapture cache
       -> consumer-owned cold resolver
  -> HtmlFlipRuntime
       -> HtmlPoseProjection
```

### 1. TransitionSchedule

Le player doit deriver un schedule immuable des occurrences discretes, sans
rejouer leur execution au seek. Une occurrence `MoveTransitionOccurrence` doit
porter au minimum:

```ts
type MoveTransitionOccurrence = Readonly<{
  captureId: string
  eventId?: string
  eventSeq?: number
  declarationPath: readonly number[]
  persoKey: string
  startAt: number
  endAt: number
  sourceTimeMs: number
  destinationTimeMs: number
  transition: MoveTransition
  fromTargetId?: string
  toTargetId?: string
}>
```

`transitionStartAt` est une information necessaire, mais elle ne suffit pas a
identifier une occurrence. L'identite doit resister a deux moves du meme perso au
meme instant et a un touched set different.

Le schedule doit aussi propager `flipMode` de l'auteur vers la placement resolue,
`SolvedPlacement`, `MoveStateDelta` et le builder de capture. Une declaration
`overlay-world` ne doit jamais etre silencieusement convertie en `local`.

### 2. FlipCaptureJournal

Il faut separer trois responsabilites:

```text
FlipCaptureJournal
  = descripteurs historiques immuables des captures

FlipCaptureCache
  = captures numeriques realisees pour un hostContext + epoch

active projection ownership
  = overlays et poses temporaires actuellement ecrits
```

Le journal doit etre profondement immutable, serialisable et indexe par
`captureId`. L'invalidation d'epoch supprime les poses numeriques du cache, mais
conserve le descripteur permettant une realisation froide dans le nouvel epoch.

Le journal doit avoir une politique de retention explicite. La fin d'une projection
active ne doit pas supprimer une capture encore necessaire au seek.

### 3. FlipCaptureResolver

Le resolver est la responsabilite du consumer HTML/runner, pas de `HtmlFlipRuntime`.
Il doit resoudre toutes les captures actives manquantes, pas une seule:

```ts
type FlipCaptureResolver = (input: Readonly<{
  captures: readonly MoveTransitionOccurrence[]
  hostContextId: string
  projectionEpoch: number
  timeMs: number
}>) => readonly FlipCapture[]
```

La realisation froide suit ce flux:

```text
occurrence historique
  -> scene logique FIRST
  -> presentation historique FIRST
  -> mesures DOM FIRST
  -> presentation historique LAST
  -> mesures DOM LAST
  -> restauration garantie de la presentation courante
  -> capture numerique profondement immuable
  -> un seul resolve/commit a t
```

Elle ne doit pas appeler `flip.run()` et ne doit pas utiliser le DOM courant comme
FIRST implicite.

### 4. PresentationTransaction

Le runner doit posseder une transaction capable de materialiser temporairement une
scene logique sans rejouer events ni straps:

```ts
type PresentationTransaction = Readonly<{
  present: (scene: SolvedScene) => void
  read: (items: readonly string[]) => ReadonlyMap<string, HtmlPose>
  restore: () => void
}>
```

La transaction doit:

1. memoriser la scene et la presentation courantes;
2. synchroniser l'etat auteur des composants;
3. projeter le parentage;
4. forcer la frontiere de lecture DOM;
5. mesurer FIRST ou LAST;
6. restaurer dans un `finally` la scene, les styles auteur et le parentage courants.

Les services de modules et de liste doivent avoir un mode transactionnel. Une
realisation historique ne doit pas notifier un faux move public ni modifier le
journal logique courant.

### 5. Play et Seek communs

Le player doit exposer un seul orchestrateur de presentation:

```text
evaluate(t)
  -> resolve logical scene
  -> identify active occurrences
  -> obtain captures from cache or resolver
  -> project authored state and structural state
  -> resolve pose graph at t
  -> one DOM commit
```

Play peut utiliser la capture realizee pendant le frame, mais passe ensuite par le
meme `resolve active captures at t` que Seek. Seek ne doit jamais appeler `run()`;
il appelle uniquement `seekCached()` apres realisation eventuelle par le resolver.

### 6. Frontiere authored/transient DOM

La projection temporaire ne doit pas restaurer un snapshot complet du `style`
qui pourrait etre obsolete. L'invariant est:

```text
cancel/finish FLIP
  -> retire seulement la contribution transitoire
  -> conserve l'etat auteur actuellement remis par le composant
```

La solution doit etre tranchee par le host contract. Options admissibles:

- wrapper DOM dedie portant la projection temporaire;
- slots CSS separes pour transform auteur et transform FLIP;
- couche de projection explicite qui ne modifie jamais le style auteur.

Une restauration aveugle de la chaine `style` n'est pas admissible.

### 7. Phases de lecture/ecriture HTML

Le host doit distinguer:

```text
read FIRST: toutes les geometries necessaires
write authored + structural mutation
read LAST: toutes les geometries necessaires
resolve numeric pose graph
write toutes les poses temporaires
flush unique
```

`flush()` ne doit pas etre une fonction vide si le contrat exige une frontiere de
layout. Les lectures `getComputedStyle`, `offset*` et `getBoundingClientRect`
doivent etre regroupees et documentees.

### 8. Contrat precis de la frontiere runner/render

La frontiere ne doit pas transmettre des handles DOM au coordinateur FLIP. Elle
doit transmettre un arbre numerique produit par une transaction synchrone du
runner HTML:

```ts
type HtmlMeasurementTree = Readonly<{
  hostContextId: string
  projectionEpoch: number
  logicalTimeMs: number
  items: readonly Readonly<{
    itemId: string
    ancestorIds: readonly string[]
    mode: HtmlFlipMode
    first: HtmlPose
    last: HtmlPose
  }>[]
  ancestors: readonly Readonly<{
    ancestorId: string
    parentId?: string
    regime: FlipAncestorRegime
    first: HtmlPose
    last: HtmlPose
  }>[]
}>
```

Cet arbre est la sortie de `read FIRST` + mutation + `read LAST`. Il est:

- profondement immutable avant d'entrer dans le journal/cache;
- indexe par l'identite logique de l'occurrence et non par le seul `startAt`;
- complet pour tout le touched set et toute la chaine d'ancetres necessaire;
- independant des nodes, closures, composants et valeurs de style temporaires.

Le coordinateur FLIP transforme ensuite cet arbre en `FlipCapture`, l'enregistre
dans `FlipCaptureCache`, puis appelle `seek(capture, timeMs)`. Une capture produite
par la transaction courante et une capture realisee froidement suivent exactement
le meme chemin numerique. `HtmlFlipRuntime` ne doit pas recevoir une callback
`mutate` dans ce chemin cible et ne doit pas appeler le runner pour inventer FIRST.

#### Responsabilites

```text
RuntimePlayer
  -> determine SolvedScene, occurrence, time et touched set logique

HtmlPlayerRunner / RenderTransaction
  -> presente une scene auteur
  -> projette le parentage et l'ordre
  -> lit FIRST et LAST dans le DOM
  -> restaure une presentation precedente en cas d'echec

FlipCaptureCoordinator
  -> associe l'arbre numerique a captureId/startAt/endAt
  -> conserve journal et cache
  -> resout la pose a t

HtmlFlipRuntime
  -> applique local ou overlay-world
  -> gere ownership, interruption et destruction
  -> execute un flush de commit
```

Le player ne doit donc plus appeler `componentRuntime.sync(next)` avant une
capture qui depend de l'ancien rendu. Pour une transition, la synchronisation
du nouvel etat auteur doit etre incluse entre FIRST et LAST. Apres la resolution
numerique, la presentation `next` reste installee et recoit les poses temporaires
dans le meme commit. En l'absence de capture FLIP, le chemin direct
`present(nextScene)` reste autorise.

#### Transaction historique et restauration

Une realisation froide ne rejoue ni events, ni straps, ni callbacks publics. Elle
utilise le meme primitive de presentation que le chemin courant:

```text
save presentation courante
  -> present(scene FIRST historique)
  -> read FIRST
  -> present(scene LAST historique)
  -> read LAST
  -> finally present(scene courante)
```

La restauration est obligatoire meme si une lecture, une synchronisation de
composant ou une mutation de parentage leve une exception. La transaction doit
restaurer l'etat auteur et la structure, mais ne doit pas restaurer aveuglement
une chaine `style` prise avant un changement auteur concurrent. Les contributions
FLIP doivent etre separees de l'etat auteur par le host contract: wrapper dedie,
slots CSS distincts ou couche de projection qui ne remplace jamais le style
auteur.

#### Regle de reinjection

Les valeurs `HtmlPose` mesurees ne sont pas ecrites dans `SolvedScene` et ne
deviennent pas un nouvel etat auteur. Elles sont reinjectees dans le coordinateur
via le resultat de transaction, puis associees a l'occurrence historique:

```text
RenderTransactionResult
  = { measurementTree, restored: true }
    -> FlipCaptureCoordinator.record(captureId, measurementTree)
    -> FlipCaptureCache.set(capture)
    -> HtmlFlipRuntime.seek(capture, logicalTimeMs)
```

Le runner conserve uniquement la presentation DOM necessaire pour mesurer et
committer. Le journal FLIP conserve les nombres et la provenance necessaires a
un seek futur. Aucun retour DOM -> logique n'est permis.

#### Atomicite observable

Entre le premier read FIRST et le commit final, la transaction ne doit franchir
aucune frontiere asynchrone (`await`, `requestAnimationFrame`, ticker ou callback
public). Elle peut forcer une lecture de layout au point documente par le host,
mais elle ne doit produire aucun repaint intermediaire volontaire. L'ordre
observable cible est donc:

```text
read all FIRST
  -> write authored state and structural parentage
  -> read all LAST
  -> build immutable numeric capture
  -> write transient poses
  -> flush once
```

Un `flush` vide n'est pas une preuve de cette atomicite. Le test de frontiere
doit compter les lectures et les commits, et verifier qu'un seek froid restaure
la scene courante apres chaque tentative.

## Ancetres, reflow et overlay

Le touched set est fourni par le consumer, jamais devine par FLIP depuis le DOM.
Pour une mutation de liste, il doit contenir le perso deplace, les siblings qui
reflowent et les dependants dont la pose change.

Le graphe doit etre construit root-to-leaf avec:

- regime `stable` verifie comme pose settlee;
- regime `composited` compose par matrice;
- regime `layout` mesure historiquement;
- detection du plus haut ancetre causant le reflow;
- mesures repositionnees des descendants sous la coupe;
- timing propre a chaque ancetre lorsque leurs fenetres different.

`overlay-world` doit etre propage depuis l'auteur et calibre dans le repere du root
du host. Les ghosts parents doivent masquer et restaurer les descendants qui
possedent leur propre overlay. La destruction doit supprimer la couche overlay et
tous les ghosts, pas seulement les projections actives visibles.

## Epoch, scroll et destruction

Un resize ou scroll avance l'epoch de projection, annule les poses temporaires,
invalide les mesures numeriques et reprojette le meme `logicalTime` dans le nouvel
espace. Les descripteurs historiques restent disponibles pour une realisation
froide.

L'ordre de destruction cible est:

```text
abort pending seeks
  -> unregister player
  -> stop render adapters/clock
  -> cancel and destroy FLIP host
  -> destroy layout projection
  -> destroy component instances
  -> destroy module services
  -> clear node maps and capture journal ownership
```

Chaque etape doit etre idempotente et rollback-safe en cas d'echec d'init.

## Plan de refonte

### P0 - Contrats et schedule

- Propager `flipMode`, identite event/action, `startAt`, `endAt` et provenance.
- Remplacer l'identite derivee `host:startAt:itemIds`.
- Definir resolver multi-captures et retention journal/cache.
- Deprecier `captureWindows` local au wrapper.

### P0 - Orchestration de presentation

- Introduire `PresentationTransaction` entre player, composants, backend et host.
- Definir `HtmlMeasurementTree` comme resultat numerique immutable de la transaction.
- Reinjecter cet arbre dans le coordinateur par `captureId`, sans retour DOM -> logique.
- Faire passer Play et Seek par le meme resolver de captures actives.
- Interdire `flip.run()` dans le chemin seek.
- Garantir un seul commit DOM par seek.

### P0 - DOM auteur/transitoire

- Remplacer les restaurations aveugles de style.
- Definir les slots ou wrapper de projection.
- Implementer la vraie phase read/write et la restauration transactionnelle.
- Garantir l'ordre synchrone `FIRST -> authored/structural writes -> LAST -> poses -> flush`.

### P1 - Realisation froide directe

- Implementer le journal et le resolver runner-scoped pour les moves compiles.
- Conserver les evenements live et les occurrences commencant a `0` hors de cette
  tranche; les reorders `list` compiles passent par le replay historique du player.
- Mesurer FIRST/LAST depuis les bornes logiques, jamais depuis le DOM courant.
- Tester seek initial, seek-back, start/middle/end, resize et repeated seek.

### P1 - Ancetres et overlays

- Construire le touched set et la chaine d'ancetres.
- Implementer historical layout realization, reflow cut et mesures repositionnees.
- Propager et tester `overlay-world`, calibration et ghosts imbriques.

### P1 - List et stress

- Brancher la capacite list comme producer du touched set et de l'ordre.
- Convertir `flip-stress` en `SceneDoc` uniquement apres les gates P0/P1.
- Supprimer son render loop, ses captures et son cleanup manuel.

## Gates de validation

Le stress-test ne peut pas devenir normatif avant ces scenarios:

1. Capture JSON round-trip sans DOM, handle ni closure.
2. Identite stable d'une occurrence repetee au meme instant.
3. Seek froid depuis un runner neuf a `start`, `middle` et `end`.
4. Seek-back depuis apres la transition vers son milieu.
5. Play et Seek produisent la meme pose et un seul commit.
6. Deux captures actives et realisation froide simultanee.
7. Modification d'un style auteur pendant FLIP sans restauration obsolete.
8. Parent et grand-parent composites avec repere local exact.
9. Ancetre `layout` realise historiquement et restaure sans effet de bord.
10. Overlay local/world, ghosts imbriques et absence de doublons.
11. Resize et scroll invalident puis reprojettent le meme temps logique.
12. Destruction sans ghost, couche overlay, style temporaire ou listener residuel.
13. Reorder list avec touched siblings et reflow interne.
14. A/B/C/D et Q/K declaratifs sans logique FLIP dans la demo.

## References

- `plan/flip-list-coordination-plan.md`
- `plan/move-contract-plan.md`
- `src/runtime/player/runtime-player.ts`
- `src/runtime/player/flip/move-flip-layout-projection.ts`
- `src/runtime/flip/html-flip-runtime.ts`
- `src/runtime/flip/html-dom-projection.ts`
- `src/runtime/runner/html-player-runner.ts`
- `projet/notes/2026-08-18-reprise-runner-html-declaratif-v2.md`
