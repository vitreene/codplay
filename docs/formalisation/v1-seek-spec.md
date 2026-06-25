# Seek spec V1 - relecture, horizons et policies

## Statut

Spec normative V1 pour le comportement de `seek` dans Codplay.

## Objectif

Figer de facon exhaustive comment le runtime:

- borne une demande de seek
- selectionne les events replayables deja materialises dans les tracks
- reconstruit l'etat et le rendu sans rejouer les straps
- applique les regles de master, de segment et de mode auteur

## Perimetre

- `seek` ne declenche jamais `init`
- `seek` ne rejoue jamais les straps
- `seek` ne rejoue jamais les `effects`
- `seek` ne joue pas `sequence:end` comme un event normal
- `seek` ne depend pas d'une couche runtime intermediaire

## Etat d'execution

- `seek` n'est accepté que lorsque le runtime est initialise et en `ready`, `paused` ou `playing`.
- si le player est en `playing`, le flux de lecture courant est suspendu avant la relecture.
- apres un seek reussi, le player reste en `paused` jusqu'a un `play` explicite.
- le curseur courant du player est positionne sur la cible bornee par la policy et, si besoin, par le segment.

## Contrat canonique

```ts
type SeekPolicy =
  | 'disabled'
  | 'played-only'
  | 'master-projected'
  | 'author-unrestricted'

type HorizonSnapshot = {
  playedEndMs: number
  projectedMasterEndMs: number
  authorEndMs: number
  progressEndMs: number
  seekEndMs: number
  segment?: {
    startMs: number
    endMs: number
  }
}
```

## Definitions

1. `playedEndMs`

- borne maximale effectivement atteinte par des events deja lus et appliques pendant la lecture courante.
- `playedEndMs` est monotone jusqu'a `rewind`, `restart` ou rechargement complet du runtime.

2. `projectedMasterEndMs`

- borne future garantie par les tracks `role: "master"`.
- inclut les events deja materialises sur ces tracks, meme s'ils n'ont pas encore ete traverses en lecture.
- inclut les media `master` et leur duree effective.
- ignore les tracks decoratives et les futures occurrences non master.

3. `authorEndMs`

- borne future totale connue en mode auteur.
- peut inclure toutes les occurrences deterministes deja materialisees dans les tracks, meme decoratives.

4. `progressEndMs`

- borne utilisee pour afficher la progression visible a l'utilisateur.
- en diffusion, elle ne doit pas etre polluee par les tracks d'accompagnement.
- en V1, elle suit la projection master quand elle existe, avec fallback legacy sinon.

5. `seekEndMs`

- borne effectivement autorisee pour le seek selon la policy active.
- `seekEndMs` n'est pas necessairement egal a `progressEndMs`.

6. `segment`

- borne optionnelle d'une lecture limitee a un fragment de sequence.
- `segment.startMs` et `segment.endMs` definissent une fenetre de lecture coherente pour `play` et `seek` quand ce mode est active.
- le segment sert d'abord a l'edition auteur; il peut aussi devenir une borne effective par configuration.

## Policies de seek

### `disabled`

- le seek est interdit.

### `played-only`

- le seek ne peut pas depasser `playedEndMs`.

### `master-projected`

- le seek peut aller jusqu'a `max(playedEndMs, projectedMasterEndMs)`.

### `author-unrestricted`

- le seek peut aller jusqu'a `authorEndMs`.

### Garantie du passe (toutes policies sauf `disabled`)

- le passe deja lu est **toujours** atteignable : `seekEndMs = max(playedEndMs, borne-future-de-la-policy)`. La policy ne borne que le futur au-dela de `playedEndMs` (cf. `v1-horizon-spec`).
- `playedEndMs` suit la position de lecture courante (pas seulement les events) : une animation `currentTime` (action-tween : `fn` + `duration`, sans event par tick) fait avancer `playedEndMs` via le tick, donc sa portion deja lue reste seekable en arriere. Voir la definition enrichie dans `v1-horizon-spec`.

## Regles normatives

1. Source de verite

- le seek lit uniquement les events deja materialises dans les tracks.
- le seek ne reexecute pas les straps pour reconstruire le passe.
- le seek ne reexecute pas les `effects`.
- le seek reconstruit l'etat visible par application du flux de tracks deja enregistre.
- pendant le replay interne du seek, aucun nouvel event n'est emis par les straps ou listen: la relecture applique uniquement les sorties deja materialisees dans les tracks.
- pendant `seek`, toute logique de `listen` / strap / emission reactive est hors champ de la relecture.
- les loops helper actifs sont suspendus pendant le seek et reprennent a la reprise de lecture (`play` ou `resume`); ils ne sont pas detruits.
- les events `persist-only` presentes dans les tracks sont rejoues normalement au seek: leur mode d'insertion ne s'applique que lors de l'emission live initiale.

2. Role du master

- une track non master peut nourrir `playedEndMs` si ses events ont deja ete lus.
- une track non master ne doit pas etendre `projectedMasterEndMs`.
- une track `role: "master"` peut faire avancer `projectedMasterEndMs` et donc la borne de seek en mode `master-projected`.
- si aucune track `role: "master"` n'est declaree, le runtime peut conserver un fallback legacy pour `progressEndMs`, sans changer la regle de policy du seek.

3. Reconstruction

- le runtime repart du debut des tracks concernes.
- il collecte les events actifs dont `ms <= targetTimelineMs`.
- il applique les events dans un ordre deterministe base sur l'ordre des tracks et l'ordre stable des events.
- les mutations d'etat deja materialisees sont rejouees comme donnees, pas comme code.
- le replay `seek` ne desactive pas artificiellement un media pour forcer son rechargement; il preserve la logique de synchronisation et de repositionnement runtime.

4. `sequence:end`

- `sequence:end` est terminal en `play`.
- en `seek`, si la borne `sequence:end` est franchie, l'event n'est pas joue.
- en `seek`, `sequence:end` borne seulement la projection du replay.
- le cleanup terminal associe a `sequence:end` ne doit pas etre execute pendant un seek.

5. `state`

- `story.state` reste la surface auteur.
- le runtime recoit et relit l'etat depuis les tracks deja materialises.
- les `update` et les donnees associees aux events sont rejouees pour reconstruire l'etat visible a l'instant `T`.

6. Segment

- le segment est une fenetre de lecture et d'edition auteur.
- si la configuration active le segment comme borne, le seek est clamped dans cette fenetre.
- le segment ne cree pas de moteur de replay distinct.

## Selection des events a rejouer

Le seek selectionne uniquement des entries deja presentes dans les tracks:

1. verifier la policy active et calculer `seekEndMs`
2. borner la cible demandee par `seekEndMs`
3. si un segment actif est configure comme borne, borner aussi par le segment
4. remettre les curseurs de tracks au debut
5. parcourir toutes les tracks actives
6. garder les events dont `ms <= cible`
7. les trier selon l'ordre de track puis l'ordre stable d'insertion
8. appliquer les donnees et mutations dans l'ordre
9. arreter la projection avant `sequence:end` sans declencher sa logique terminale
10. positionner le curseur courant sur la cible bornee (ou sur le dernier instant replayable avant `sequence:end`)

## Mode auteur et segment

- le mode auteur est configurable et peut etre aligne sur le mode diffusion pour tester une scene dans des conditions identiques.
- lorsque le mode auteur est aligne sur la diffusion, il respecte les memes bornes de seek, de progress et de segment que la policy active.
- en mode auteur, `authorEndMs` peut ouvrir plus large que `projectedMasterEndMs`.
- le mode segment est le mode auteur privilegie pour tester des `effects` localises en jouant une fenetre de sequence.
- quand un seek reste dans la fenetre de segment, le runtime peut reutiliser l'etat de depart du segment au lieu de le recalculer integralement a chaque fois.
- le seek reste un replay de tracks, pas un re-execution de straps, meme en mode auteur.

## Notes d'implementation

- la forme interne des tracks peut utiliser une `Map` indexee par `ms` si cela aide les performances.
- cette spec contraint le comportement, pas la structure memoire exacte.
- la progression visible peut etre recalculée quand de nouveaux events master arrivent; l'UI de seek peut verrouiller temporairement son echelle pendant une interaction utilisateur pour eviter des sauts visuels.

## Exemple s4

- le compteur peut avancer `playedEndMs` au fur et a mesure de la lecture.
- si le compteur n'est pas sur une track `master`, il ne doit pas faire avancer `projectedMasterEndMs`.
- en mode auteur, il peut quand meme faire avancer `authorEndMs` si ses events sont materialises dans les tracks.

## Appendice V1 — cas ouvert : invalidation des events utilisateur apres seek-back

Cas non couvert en V1 : lecture partielle avec interaction utilisateur, puis seek-back avant la position de l'interaction, puis nouvelle lecture.

Les events utilisateur (et leurs cascades) deja persistees dans les tracks subsistent apres le seek-back. Si l'utilisateur interagit differemment lors de la seconde lecture, les anciens events entrent en conflit avec les nouveaux.

Ce cas necessite un mecanisme d'invalidation des events persistees apres le point de seek. Il touche le contrat du track manager (suppression retroactive, marquage de revision, ou snapshot isole). Non adresse en V1.

## Appendice V1 — le detach-all du refresh est une fausse optimisation ; l'invariant reel est « refresh entre deux repaints »

Constat (2026-06-23) : `RuntimeComponentOrchestrator.loadPersos()` detache tous les nodes montes du DOM avant de rafraichir chaque composant (`runtime-component-orchestrator.ts:413-418`, + per-perso :476/:485), a chaque `seek()`/`rewind()`/`rebuild()`, quel que soit le nombre de personas dont l'etat resolu a reellement change.

Correction d'analyse (2026-06-25) : ce detach a longtemps ete justifie comme une protection anti-flicker (un node visible ne doit jamais montrer un etat reset-mais-pas-encore-reapplique). **C'est une fausse optimisation.** Tout l'enchainement d'un `seek()` — `loadPersos` (reset) → reattach → `replayDueTimelineEventsForSeek` (boucle sans `await`, `create-player.ts:1215-1251`) → `syncAnimationsToTimeline` — s'execute dans **une seule tache JS synchrone**. Le navigateur ne peint qu'en fin de tache : il n'y a donc **jamais** de repaint de l'etat intermediaire, et donc **rien a masquer**. L'intention reelle n'a jamais ete « sortir le node du DOM » mais « faire le refresh entre deux repaints », propriete deja garantie par l'atomicite synchrone du batch. Trace explicite de cette intention : commentaire `create-player.ts:1254-1256` (« sync … before any async boundary, preventing the browser from painting »).

Les deux priorites d'origine, et ou elles sont reellement garanties :
1. **Refresh entre deux repaints** (pas de saut d'image) : par l'atomicite synchrone du bloc reset→replay, pas par le detach.
2. **Ne pas recreer le node a chaque seek** : par `buildNode` qui reutilise `this.node` (`base-component.ts:56-69`, identite preservee, reset des styles en place).

Le detach n'apporte ni l'une ni l'autre. Il **casse activement** la priorite 1 sur les media : un cycle `removeChild`/`appendChild` sur un `<img>`/`<video>` interrompt le pipeline de decodage du navigateur. Sous scrubbing rapide (un `seek()` par `pointermove`), ces cycles trop rapproches empechent le decodage de se terminer — `naturalWidth`/`complete` restent a zero meme quand `src` n'est pas reassigne. `apply-split-cells.ts` lit alors `naturalWidth` en direct (`apply-split-cells.ts:155`), retombe sur le fallback de `computeObjectFitRect` (`:58-60`) qui etire l'image en ignorant le ratio → geometrie de cellules faussee, mosaique deformee, flick. Observe sur `replace-carousel-demo` (`replace: { split: 'cells' }`).

Pistes ecartees ou deja appliquees :
- `mountRootNodes()` (`player.ts:116-122`) corrige le 2026-06-23 pour ne plus refaire `replaceChildren()` quand la liste des root nodes n'a pas change — utile mais marginal une fois le detach-all retire.
- cache local de `naturalWidth`/`naturalHeight` dans `apply-split-cells.ts` : masquerait le symptome sans traiter la cause. Ecarte comme solution definitive.

Fix : **retirer le detach-all**, en rendant explicite et garde l'invariant qu'il remplacait — reset et replay doivent rester dans la **meme tache synchrone** (aucun `await`/`rAF`/`img.decode()` glisse entre `loadPersos` et le `syncAnimationsToTimeline` final). Le diffing d'etat par persona (cf. `2026-06-23-orchestrator-refresh-diffing-plan.md`) reste pertinent pour **sauter** les personas stables et reduire le travail de refresh, mais ce n'est plus la justification anti-flicker — celle-ci tombe avec le detach.

Resolu (2026-06-25). En plus du retrait du detach-all et de l'idempotence de `applyMove`/des passes de mount, l'implementation a revele que la **cause dominante** du churn media carousel etait `LayoutComponent.render()` qui recreait son node racine a chaque seek (`parseLayoutMarkup`), re-parentant tout enfant (dont l'`<img>` d'une cellule `type: layout`). Corrige : le layout reutilise desormais son node et restaure le baseline d'attributs du markup au lieu de recreer (markup statique). `ImageComponent` etait deja correct. Voir `2026-06-25-orchestrator-remove-detach-all-plan.md` (statut implemente) et `tests/v1/seek-no-detach.spec.ts`.

Plan d'implementation : `2026-06-25-orchestrator-remove-detach-all-plan.md`.
