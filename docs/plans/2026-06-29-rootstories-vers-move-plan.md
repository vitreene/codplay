# Plan — `Scene.rootStories` souffre-t-il du même défaut que l'ancien `Story.entries` ?

## Contexte

Suite au retrait de `Story.entries` (remplacé par `move: '@root'` porté par le perso lui-même),
question posée : `Scene.rootStories: string[]` a-t-il le même défaut architectural et doit-il
subir le même traitement ?

Rappel du défaut qui justifiait le retrait d'`entries` :
1. **Sens de déclaration inversé** : déclaré par le conteneur (la story) à propos de ses membres
   (les persos), alors que toute autre relation de placement part du membre lui-même
   (`perso.initial.move` désigne SON parent).
2. **Pas de dimension temporelle** : liste figée à la compilation, incapable d'exprimer
   "devient racine plus tard" (alors que `move` accepte `initial` ET action).
3. **Redondance silencieuse** : un perso listé dans `entries` mais déjà doté d'un `move` réel
   rendait cette appartenance inerte — source de confusion sans bénéfice.

## Constats factuels sur `rootStories`

### Définition et validation (build-time uniquement)

- `Scene.rootStories: string[]` — `builder/types.ts:65`, `player/types.ts:103`.
- Validation (`builder-validation.ts:49-69`, code `AUTHOR_ROOT_STORIES_INVALID`) :
  tableau non vide, chaque id doit exister dans `scene.stories`. Aucune validation temporelle.

### Seul usage fonctionnel réel : `deriveRootNodeIds` (builder/create-builder.ts:31-47)

```ts
function deriveRootNodeIds(scene: SceneDef): string[] {
  return scene.rootStories.flatMap((storyId) => {
    const story = scene.stories[storyId]
    if (story === undefined) return []
    return story.persos
      .filter((perso) => {
        const move = (perso.initial as Record<string, unknown> | undefined)?.move
        return move === undefined || isStoryHostMove(move)
      })
      .map((perso) => perso.id)
  })
}
```

`rootStories` sert UNIQUEMENT à scoper quelles stories sont scannées pour calculer
`CompiledScene.rootNodeIds` — la liste de nodes que `Player.mountRootNodes()` (player.ts)
monte directement comme enfants du `mountTarget` de la page. C'est la seule conséquence
runtime réelle d'être (ou non) listé dans `rootStories`.

### Le player N'UTILISE PAS `rootStories` pour activer/monter les stories

`activateAllSceneStories()` (`create-player.ts:830-845`) active **toutes** les stories de la
scène (`Object.keys(this.scene.stories)`), sans filtrer par `rootStories`. Le montage effectif
passe par `options.mount(storyId)` (`mountStory()`, `create-player.ts:1124-1155`), qui :
- accepte n'importe quel id de story, **sans vérifier son appartenance à `rootStories`** ;
- est appelable à tout moment (`init`, `onStart`, ou pendant la lecture via un event) — donc
  PAS figé à l'init contrairement à `rootStories` lui-même.

Donc : rien n'empêche aujourd'hui de `options.mount()` une story absente de `rootStories` — la
seule perte serait que ses persos racines n'apparaîtraient pas dans `rootNodeIds`, donc pas
montés directement sous le `mountTarget` de la page par la classe `Player`.

### Spec normative — `rootStories` est *délibérément* une autorisation, pas un placement

`v1-scene-spec.md` (§3, lignes 99-103) est explicite :
> `rootStories` designe les stories autorisees a etre placees a la racine de la scene... est une
> structure d'autorisation scene-level, pas un declencheur temporel implicite... n'impose ni
> visibilite immediate, ni montage implicite, ni demarrage automatique.

Ce n'est donc pas une omission de la spec : `rootStories` a été conçu pour ne PAS jouer le rôle
de placement que jouait `entries`. Le placement réel d'une story (où son `story host` s'attache)
passe déjà par `story.initial.move`, porté par la story elle-même — c'est-à-dire que l'équivalent
« perso-side » existe déjà pour les stories, séparément de `rootStories`.

### Usage dans les démos

19 scènes démo déclarent `rootStories`. 4 l'utilisent explicitement comme source pour
`options.mount(scene.rootStories[0])` dans leur `init`. Les autres le déclarent sans jamais le
relire (le builder le lit pour `deriveRootNodeIds`, c'est tout).

## Où le parallèle avec `entries` tient — et où il ne tient pas

| Critère | `Story.entries` (retiré) | `Scene.rootStories` (actuel) |
|---|---|---|
| Sens de déclaration | Conteneur → membres (inversé) | Conteneur → membres (même sens) |
| Rôle réel | Déclenchait le montage (implicite, `mountStoryEntriesToStoryHosts`) | N'autorise rien au runtime ; seul effet = scope de `deriveRootNodeIds` |
| Équivalent self-déclaré déjà existant | Aucun (c'est précisément le trou comblé par `move:'@root'`) | Oui : `story.initial.move` (absent ou `'@root'`) joue déjà ce rôle pour le placement réel |
| Dimension temporelle | Manquante et nécessaire (cas réels : perso devient racine plus tard) | Manquante mais sans cas d'usage identifié (une story devient rarement "racine" en cours de scène — son montage dynamique passe déjà par `options.mount()`, qui n'est PAS bloqué par `rootStories`) |
| Redondance silencieuse constatée | Oui, dans plusieurs démos (perso déjà pourvu d'un move réel) | Partielle : `rootStories` duplique une information dérivable de `story.initial.move` (story sans move de nesting = candidate racine), mais sert un usage propre (scope de `rootNodeIds`) que `story.initial.move` seul ne couvre pas |

**Verdict factuel** : le défaut n°1 (sens inversé) existe structurellement, mais son IMPACT est
beaucoup plus faible que pour `entries`, parce que `rootStories` ne fait already pas le travail
de placement (qui est déjà self-déclaré via `story.initial.move`) — son seul rôle restant est de
scoper un calcul de manifeste (`rootNodeIds`), pas de décider qui est monté ou comment.

## Le vrai gap identifié

Un `Scene.rootStories` qui omettrait une story réellement "racine" (par oubli) ne casserait rien
à la validation ni au montage (`options.mount()` fonctionne quand même) — mais cette story
resterait **invisible à l'écran** via la classe `Player` (ses persos `move:'@root'`/sans `move`
n'entreraient jamais dans `rootNodeIds`, donc jamais montés sous `mountTarget`). C'est un mode
d'échec silencieux structurellement identique à celui qu'avait `entries` (une omission dans une
liste annexe casse le rendu sans erreur explicite) — sauf qu'ici la validation builder
(`AUTHOR_ROOT_STORIES_INVALID`) attrape déjà les ids invalides/inconnus, pas les oublis d'ids
valides.

## Options pour avancer (à trancher avant toute implémentation)

**Option A — Ne rien changer.** `rootStories` n'a pas le défaut n°1 dans les faits (le placement
réel est déjà self-déclaré via `story.initial.move`) ; son rôle restant (scoper `rootNodeIds`) est
documenté et délibéré. Le risque d'oubli silencieux existe mais est mineur (peu de stories root
par scène, erreur visible immédiatement à l'écran en dev).

**Option B — Dériver `rootNodeIds` depuis TOUTES les stories sans `story.initial.move` de
nesting, au lieu de scoper via `rootStories`.** Supprime la redondance : une story devient
implicitement candidate au calcul `rootNodeIds` dès qu'elle n'est pas composée ailleurs (absence
de `story.initial.move`, ou `'@root'` explicite) — symétrique avec la règle perso. `rootStories`
serait alors réduit à son seul rôle de validation/inventaire (catalogue explicite des stories que
l'auteur a l'intention de monter en root), ou purement retiré si ce rôle catalogue n'est pas jugé
utile.

**Option C — Retirer `rootStories` entièrement**, en s'appuyant uniquement sur
`story.initial.move` pour décider qui est racine (`deriveRootNodeIds` scanne alors
`scene.stories` en entier). Plus proche en esprit du traitement appliqué à `entries`/`move`, mais
perd la validation explicite "cette story doit exister et est volontairement une racine" — à moins
de la remplacer par une validation équivalente basée sur `story.initial.move` absent +
appartenance à un cycle de composition valide (aucune story ne doit finir sans parent ET hors de
toute liste explicite, ce qui demanderait une nouvelle règle de validation).

## Mise à jour (2026-06-29, suite) — `options.mount()` est aujourd'hui du code mort

Le constat initial sous-estimait l'ampleur réelle de la dispersion. Vérification directe du code :

`PlayerFacade.prepareSceneRuntime()` (`create-player.ts:1742-1771`, appelée par `init()`) exécute,
**dans cet ordre** :
1. `this.activateAllSceneStories()` (`create-player.ts:833-845`) — ajoute **sans condition**
   l'id de **toutes** les stories de `scene.stories` à `this.mountedStoryIds` ET
   `this.scheduledStoryIds`. Commentaire en place : "Marks all authored stories as active for
   the current runtime cycle."
2. **Ensuite seulement**, `runtimeScene.init?.(runtimeScene, this.createLifecycleOptions())` —
   c'est l'auteur qui, à cet instant, peut appeler `options.mount(scene.rootStories[0])`.
3. À la fin de `prepareSceneRuntime()`, `createMountedRuntimePlan()` +
   `applyMountedRuntimePlan()` + `loadMountedRuntimePersos()` s'exécutent **automatiquement**,
   à partir de `this.getMountedStoryIds()` — qui contient déjà tout depuis l'étape 1.

Or `mountStory()` (`create-player.ts:1124-1155`, l'implémentation réelle d'`options.mount`)
commence par :
```ts
if (this.mountedStoryIds.has(nextStory.id)) {
  return;   // <- toujours vrai à ce stade, pour N'IMPORTE QUEL storyId existant
}
```
Donc **tout appel à `options.mount(storyId)` depuis `init()` est un no-op aujourd'hui** : la
story est déjà dans `mountedStoryIds` avant que le hook auteur ne s'exécute, et rien ne retire
jamais un id de `mountedStoryIds` à la pièce (seul `.clear()` existe, jamais `.delete()`). Le
même `resetSceneForReplay()` (seek/rewind) ré-appelle `activateAllSceneStories()` (ligne 949) —
donc même constat après un seek.

**Vérification empirique** : sur 20 fichiers de scène démo (`packages/demos/src/scenes/*.ts`),
seuls 4 (`s1-canari-scene.ts`, `s3-robustesse-scene.ts`, `s5-drag-scene.ts`,
`s6-dnd-list-scene.ts` — les démos les plus anciennes) définissent encore un hook `init` qui
appelle `options.mount(...)`. Les 16 autres (quiz-hunt, mashup, avatar-poc, chrono, etc. — tout
le travail récent) n'en définissent **aucun**, et s'affichent correctement : la suite du projet a
déjà organiquement convergé vers "ne pas s'en servir", confirmant qu'il ne fait plus rien d'utile.

Donc la dispersion réelle, c'est **trois mécanismes pour un seul besoin** ("quelles stories sont
à la racine, et comment s'y attachent-elles") :
- `rootStories` (autorisation déclarée par la scène, lue uniquement pour scoper `rootNodeIds`) ;
- `options.mount()` (geste auteur explicite, **mort** dans les faits) ;
- `move:'@root'`/absence de `move` côté perso (le seul des trois qui fonctionne réellement et
  porte la vraie sémantique de placement).

## Proposition retenue — un mécanisme unique, enfant → parent, symétrique à `move:'@root'`

**Principe** : une `Story` se déclare elle-même, comme le fait déjà un perso, via
`story.initial.move` (déjà existant, déjà self-déclaré — pas une nouveauté à inventer) :
- `move: { parentId: 'un-outlet-d-une-autre-story' }` → composition (déjà le cas aujourd'hui,
  ex. `quiz-question-story` embarquée dans le mashup via `options.parentId`) ;
- `move: '@root'` (ou absence de `move`, par symétrie avec la règle perso "absence ≠ racine
  implicite" — **à trancher**, voir plus bas) → la story est une racine : son `story host` est
  monté **directement sous le point de montage de la page** ;
- pas de `move` du tout, et la règle choisie est "absence = non montée" (cohérent avec
  `v1-perso-spec.md` 4bis) → la story existe (état, peut recevoir des events) mais son `story
  host` reste orphelin jusqu'à ce qu'une action lui donne un `move` — symétrie complète avec un
  perso non monté par défaut.

**Ce qui disparaît** :
- `Scene.rootStories` (champ auteur) — plus besoin : chaque story porte sa propre réponse.
- `AUTHOR_ROOT_STORIES_INVALID` / sa validation — remplacée, si une validation équivalente est
  voulue, par une vérification que toute story réferencée par un `move.parentId` (composition)
  existe bien — déjà couvert par la validation générique des cibles de `move`.
- `options.mount` / `PlayerSceneLifecycleOptions.mount` — déjà mort, retrait sans perte
  fonctionnelle. Les 4 démos qui l'appellent encore perdent simplement leur hook `init` (devenu
  inutile, comme les 16 autres démos le montrent déjà).
- `deriveRootNodeIds()` actuel (scanne `rootStories` → liste des **persos** sans move/`@root`
  dans CES stories) — remplacé par une dérivation qui scanne **toutes** les stories et retient
  celles dont le **`story.initial.move`** est absent/`@root` (et non plus les persos
  individuellement) : ce sont des **story host ids**, pas des perso ids.

**Ce qui doit être ajusté au runtime (point de vérification technique, pas encore implémenté)** :
- `RuntimeComponentOrchestrator.getRuntimeRegistry().getNodeById(id)` ne résout aujourd'hui que
  `nodeByPersoId` (`runtime-component-orchestrator.ts:759`) — les `story host` nodes vivent dans
  une map séparée (`storyHostNodeByStoryId`), non exposée. Si `rootNodeIds`/l'équivalent devient
  une liste de **story ids**, il faut une méthode de lookup dédiée (ex.
  `getStoryHostNodeById`), exposée par le registry, que `Player.mountRootNodes()` (player.ts)
  utiliserait pour les entrées "story racine" au lieu de `getNodeById`.
- `mountStoryHosts()` (`runtime-component-orchestrator.ts:926-946`) résout déjà
  `resolveStoryMountTargetNode(parentId)` → `null` quand `parentId === rootToken`, et la boucle
  appelante fait alors `continue` (aucun rattachement). C'est exactement le point où le host
  d'une story racine reste aujourd'hui orphelin — c'est ce non-rattachement qui doit être
  remplacé par "exposer ce host comme candidat au montage page-level", pas par une tentative de
  rattachement interne (le point de montage réel de la page n'est connu que par la classe
  `Player`, pas par l'orchestrateur — séparation à préserver, cf. architecture
  Builder/Player/Runtime de `CLAUDE.md`).

**Point ouvert à trancher avant implémentation** : une story sans AUCUN `move` doit-elle être
(a) non montée par défaut (symétrie stricte avec les persos), ou (b) traitée comme racine par
défaut (compatibilité avec le fait qu'aujourd'hui, dans les faits, toutes les stories sont déjà
rendues sans qu'aucune n'ait jamais eu besoin de déclarer quoi que ce soit) ? L'option (a) est la
plus cohérente avec le principe déjà adopté pour les persos, mais elle est **non rétro-compatible
sans migration** : les 16 démos qui ne déclarent aujourd'hui aucun `story.initial.move` sur leurs
stories racines devraient toutes recevoir un `move:'@root'` explicite — migration du même ordre de
grandeur que celle déjà faite pour `entries` → `move:'@root'` côté perso.

## Recommandation de méthode (pas de décision prise, ni d'implémentation)

Deux décisions à figer avant tout code :
1. Le point ouvert ci-dessus (absence de `move` au niveau story = non montée, ou racine par
   défaut).
2. Si la validation "catalogue explicite de stories racines" doit être conservée sous une autre
   forme une fois `story.initial.move` pris comme unique source de vérité, ou si elle est jugée
   superflue.

Une fois ces deux points tranchés, l'implémentation suit exactement le même schéma que celui déjà
exécuté pour `entries` → `move:'@root'` (specs d'abord, runtime/builder ensuite, démos, tests),
avec un ajout technique précis : exposer les `story host` nodes via le registry pour que
`Player.mountRootNodes()` (ou son équivalent renommé) puisse les monter au lieu des persos
individuels.
