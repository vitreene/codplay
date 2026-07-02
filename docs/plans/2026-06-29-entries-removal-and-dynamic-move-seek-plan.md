# Cadrage — supprimer `entries` au profit de `move:'@root'`/`move:'@off'`, et compléter Phase 3 (écrire l'état résolu au seek, pas seulement le filtrer)

## Statut

**Défaut 2 implémenté et vérifié le 2026-06-29.** Défaut 1 (`entries`→`@root`/`@off`) volontairement
différé — l'audit des 52 fichiers concernés (voir « Risque » du défaut 1) en fait un chantier
séparé, dimensionné pour lui-même, décidé après mesure de l'ampleur réelle.

Implémentation du défaut 2 : `resolveMountedPersoIdsAtSeek` (`create-player.ts`) retourne maintenant
`{ mountedPersoIds, effectiveMoveByPersoId }` au lieu du seul Set — `effectiveMoveByPersoId` est
transmis jusqu'à `RuntimeComponentOrchestrator.loadPersos` (nouveau paramètre optionnel, propagé via
`RendererLoadInput.effectiveMoveByPersoId`). Dans `loadPersos`, tout perso présent dans cette map
(donc tout perso non-racine traité par un seek) est désormais appliqué via `onInitialPerso` avec sa
valeur résolue plutôt que son `initial.move` statique — y compris quand cette valeur est absente
(`null`), traduite en la commande de détachement (`DETACH_MOVE_COMMAND`) pour garantir un appel réel
à `applyMove`, dont l'idempotence existante évite tout travail DOM inutile. Aucun changement pour
les persos à `initial.move` statique (chemin historique conservé tel quel) ni pour les appels de
`loadPersos` hors seek (montage initial, rebuild).

Vérifié : test de régression dédié (`tests/v1/dynamic-mount-seek.spec.ts`, confirmé en échec sans le
correctif avant d'être validé avec), `move-off-detach.spec.ts` toujours vert (cas statique non
affecté), suite complète (256 tests) et gates verts. Revalidé sur la vraie scène quiz-hunt (mesure
de noeuds DOM réels, pas de set interne) : ouverture/fermeture réelle de deux trials → 43→90→43→90→43
nœuds, puis `seek({timelineMs:0})` revient à **43** (contre 90, figé, avant le correctif) et un
re-seek vers le ms courant confirme également 43.

## Contexte (cadrage initial)

Deux défauts distincts, découverts ensemble en investiguant
pourquoi le seek de `quiz-hunt` ne réduit ni le travail ni l'attachement DOM malgré la migration
`move:"off"` (`2026-06-28-unify-action-execution-and-move-off-plan.md` Phase 3). Ils se répondent :
le premier est une question d'autorat (comment un perso déclare qu'il est la racine permanente
d'une story), le second une question moteur (comment le seek reconstruit l'attachement d'un perso
qui n'a jamais de position statique). Traités ensemble parce qu'une moitié du second défaut ne sert
à rien sans le premier — voir « Pourquoi un seul document » plus bas.

## Défaut 1 — `entries` inverse le principe d'autorat et n'a pas de dimension temporelle

### Constat

Partout ailleurs dans CodPlay, un perso déclare **son propre** parent via `move` (`initial.move` au
démarrage, ou `move` dans une action, à un instant donné). `entries` (`SceneStoryDoc.entries:
string[]`) est la seule exception : c'est la **story** qui désigne ses persos-racine, dans le sens
inverse de toutes les autres relations de l'architecture. Et parce que `entries` est une liste
figée à la compilation, elle n'a **aucune dimension temporelle** — contrairement à `move`, qui peut
s'exprimer aussi bien en `initial` (« vrai depuis le début ») qu'en action (« vrai à partir de cet
event »).

`v1-story-spec.md:81,87` documente `entries` comme « les persos placés à la racine de la story »,
« montés directement dans ce story host ». `v1-perso-spec.md:141,143` documente la réciproque côté
perso : « quand un perso appartient à `entries`, son montage peut être résolu directement dans le
story host sans `move` explicite » et « `initial.move` d'un perso de `entries` peut cibler
`rootToken` pour se fixer sur le story host ». Ce dernier point est la clé : **le mécanisme proposé
existe déjà**, en doublon non exploité de `entries`.

```ts
// runtime/config.ts
rootToken: 'root',
detachToken: 'off',
```

`move: 'root'` (ou `{parentId:'root'}`) est déjà reconnu par `isStoryHostMove` et
`resolveMoveTargetNode` aussi bien en `initial` qu'en action — c'est l'exact réciproque de
`entries`, déjà fonctionnel, juste jamais promu comme la façon canonique de l'exprimer.

### Pourquoi ça casse aujourd'hui

`build-reading-quiz.ts`/`final-story.ts` (panneaux trial/final de `quiz-hunt`) déclarent
`entries: [panelId]` alors que le panneau n'est pas un élément permanent — il ne doit exister
qu'entre son `:show` et son `:hide`. `entries` ne sachant pas exprimer « parfois racine, parfois
pas », le panneau est **toujours** considéré monté par `isRoot`
(`create-player.ts:1014`, `runtime-component-orchestrator.ts:435,467`), peu importe son état réel
— neutralisant silencieusement tout le travail de `move:"off"` posé par-dessus. Mesuré : sur
`resolveMountedPersoIdsAtSeek`, `mountedPersoIdsCount` restait égal à `totalPersos` (602/602) tant
que `entries` listait les 64 panneaux.

### Correction proposée

1. Retirer `entries` du contrat `SceneStoryDoc` (et toute sa lecture : `entriesByStoryId`,
   `isStoryEntry`/`isRootEntry` dans `loadPersos`/`resolveMountedPersoIdsAtSeek`,
   `mountStoryEntriesToStoryHosts`).
2. Adopter la convention `@` pour tout token symbolique de `move` (réservée, jamais un id auteur) :
   `rootToken: 'root'` → `'@root'`, `detachToken: 'off'` → `'@off'`. `isMoveCommand`/
   `normalizeMoveCommand`/`isStoryHostMove`/`isDetachMove` mis à jour en conséquence.
3. Tout perso aujourd'hui listé dans `entries` reçoit explicitement `initial.move: '@root'`
   (`game-layout-root`, `game-grid-root`, `game-basket-root`, `game-timer-root`,
   `game-extra-token`, `game-result-overlay`, `move-off-root` dans `move-off-story.ts`, etc.) — un
   audit de toutes les démos existantes est nécessaire avant de retirer `entries` du type.
4. `move: '@root'` doit pouvoir être posé en action, pas seulement en `initial` — un perso pourrait
   devenir racine permanente seulement à partir d'un certain event (cas non couvert par `entries`,
   qui ne dit jamais "quand").

### Risque

Tous les `SceneDoc`/`SceneStoryDoc` existants (démos, fixtures de test) utilisent `entries`
aujourd'hui — c'est un changement d'autorat qui touche large, pas un ajout localisé. À auditer
exhaustivement avant retrait effectif du champ.

## Défaut 2 — Phase 3 spécifiait la résolution dynamique *et* son écriture ; seule la résolution a été livrée

### Ce qui a été demandé (`2026-06-28-unify-action-execution-and-move-off-plan.md`, Phase 3, point 3)

Citation exacte :

> Seuls les persos résolus "montés à `targetMs`" passent par `loadPersos` (reset `initial.move`
> puis rafraîchissement, lignes 422-462) ; les autres sont **entièrement ignorés** — aucune
> écriture d'état, pas seulement un rafraîchissement sauté. [...] Un perso destiné à être
> attaché/détaché dynamiquement ne doit pas porter d'`initial.move` vers son emplacement de contenu
> si l'objectif est qu'il soit ignoré par défaut — **son attache initiale doit elle-même être un
> event de `move` résolu normalement par le mécanisme ci-dessus**, pas un passage à part (lignes
> 447-462 actuelles) qui le réattacherait inconditionnellement avant tout replay.

Le « mécanisme ci-dessus » : résoudre `parentId`/`mounted` à `targetMs` par un parcours en cascade
depuis les racines, mémoïsé, lecture de registre uniquement (`nodeByPersoId`,
`componentIdByOutletId` — décrit comme restant à construire à l'époque).

### Ce qui a été livré

`resolveMountedPersoIdsAtSeek` (`create-player.ts:1006`) calcule correctement, pour chaque perso,
son état monté résolu à `targetMs` — la moitié « résolution » est livrée et juste. Mais son seul
usage est de construire `mountedPersoIds`, un filtre consommé uniquement pour **sauter** le
rafraîchissement d'un perso non-monté (`runtime-component-orchestrator.ts:436,468`,
`if (!mountedPersoIds.has(perso.id)) continue;`). Rien ne consomme ce résultat pour **appliquer**
le rattachement d'un perso résolu monté mais actuellement détaché (ou l'inverse). Le « passage à
part » que Phase 3 demandait de remplacer — `onInitialPerso` lisant `perso.initial.move`
(`runtime-component-orchestrator.ts:472-484`) — est resté intact, inchangé depuis avant Phase 3.

### Pourquoi ça casse, précisément

Pour un perso **avec** `initial.move` statique (le cas testé par `move-off-detach.spec.ts`),
`onInitialPerso` réapplique ce move statique à **chaque** `loadPersos` (mount ou seek), sans
condition — une vraie remise à un baseline. Le replay réel (`replayDueTimelineEventsForSeek`)
applique ensuite, par-dessus ce baseline, les vrais events de move dus jusqu'à `targetMs`. Seek
arrière, seek avant : ça fonctionne, parce qu'il y a toujours un baseline à reposer.

Pour un perso **sans** `initial.move` (panneaux quiz-hunt, après migration `move:"off"`),
`normalizeMoveCommand(undefined, true)` renvoie `null` → `onInitialPerso` n'est **jamais** appelé,
à aucun `loadPersos`, jamais. Aucun baseline n'existe. Le replay réel n'applique quoi que ce soit
pour ce perso sauf si un event réel de move concernant précisément ce perso est dû avant
`targetMs` — et s'il ne l'est pas (ex. `seek()` vers un instant avant son ouverture), rien ne le
détache de l'état où il se trouvait **avant l'appel à `seek()`** : ni le DOM ni le bookkeeping
(`mountedByPersoId`/`parentListByPersoId`) ne sont jamais remis à zéro pour ce perso. Mesuré : sur
une vraie partie quiz-hunt (deux trials ouverts puis fermés en lecture réelle, 43 nœuds DOM après
fermeture), un `seek()` vers n'importe quelle cible — y compris `seek(0)`, avant même l'ouverture du
premier trial — laisse le compte à 90 nœuds, inchangé depuis l'état de lecture réelle précédent.

### Correction proposée

Compléter Phase 3 comme spécifié à l'origine : faire de `resolveMountedPersoIdsAtSeek` (ou d'un
mécanisme qui en réutilise le résultat) la **seule** source de vérité pour l'attachement au seek,
pour tout perso sans `initial.move`/`@root` — c'est-à-dire, en plus de filtrer qui rafraîchir,
**appliquer** (via `applyMove`, comme `onInitialPerso` le fait pour le cas statique) la cible
dynamique déjà résolue (`effectiveMoveByPersoId`) pour tout perso résolu monté mais pas encore
attaché à l'identique, et **détacher** tout perso résolu non-monté mais actuellement attaché. Ne
remplace pas le mécanisme existant pour les persos à `initial.move` statique (qui fonctionne déjà
correctement) — l'étend au cas dynamique que Phase 3 avait explicitement anticipé sans le finir.

### Pourquoi un seul document

Compléter ce mécanisme sans régler le Défaut 1 ne suffit pas : un perso mal classé "racine
permanente" via `entries` ne passera jamais par cette résolution dynamique (`isRoot` court-circuite
tout, `effectiveMoveByPersoId` est mis à `null` sans jamais consulter le track — voir
`create-player.ts:1014-1020`). Les deux corrections sont nécessaires ensemble pour que les
panneaux quiz-hunt (et tout futur perso du même type) soient à la fois correctement classés
(Défaut 1) et correctement reconstruits au seek (Défaut 2).

## Périmètre explicitement hors de ce document

- L'implémentation elle-même (ce document ne contient aucun code).
- L'audit exhaustif de toutes les démos/fixtures utilisant `entries` aujourd'hui (à faire avant
  retrait effectif, mentionné comme risque du Défaut 1, pas détaillé ici).
- Toute décision sur la syntaxe exacte du préfixe `@` au-delà de `@root`/`@off` (d'autres tokens
  symboliques pourraient émerger ailleurs — pas anticipé ici).
