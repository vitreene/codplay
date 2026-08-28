# Lire l'état des persos à `t` — plan

## 1. Objectif

Exposer, pour l'instant courant du player (après un seek), l'état résolu de TOUS les persos — les
valeurs de propriétés (position, dimensions, couleur, etc.) telles que le modèle les porte, dans
leur unité d'origine (`cqw` ou nombre nu selon la propriété). Jamais une valeur lue sur le node DOM
ni reconstituée depuis lui (`getComputedStyle`, cache anime lié au node) : le node est un artefact
de rendu, pas la source de vérité — c'est l'état du perso qui doit être renvoyé, littéralement la
même donnée que celle qui finit sur le node, capturée avant/pendant qu'elle ne devienne
write-only vers le DOM.

Exposé comme un objet complet (tous les persos), pas un accès paramétré par un seul `persoId` —
la sélection dans Decor peut porter sur plusieurs items ; plus simple d'exposer une fois la
totalité et de laisser Decor filtrer/exploiter ce qui l'intéresse (§5).

Consommateur visé : Decor (`packages/editor`), pour remplacer les lectures actuelles via
`AuthorApi.getNodeSnapshot`/`getNodePose` (fragiles — voir §2) dans les résolutions de décor
temporaire (`resolveTemporaryPatch`, `packages/editor/src/app/bridges/decor-editor-bridge.ts`).

## 2. Pourquoi le mécanisme actuel ne convient pas

`AuthorApi.getNodeSnapshot`/`getNodePose` lisent le cache interne d'anime.js pour le node DOM réel
(`utils.get`). Deux défauts distincts, constatés en direct (session du 2026-07-25) :
- `width`/`height` : le cache pouvait contenir un nombre déjà en `cqw`, mal réinterprété comme du
  px par l'appelant (double conversion, effondrement géométrique à chaque cycle de seek).
- `background-color` : le cache restait figé sur la valeur du keyframe précédent, jamais rafraîchi
  tant qu'aucun rendez-vous explicite ne redéclenchait la lecture (course entre la demande de seek
  et son application réelle, asynchrone).

`getComputedStyle` a été explicitement écarté : il résout dans l'espace du navigateur (arrondis,
quantification px), introduisant un écart de réconciliation avec les valeurs d'origine du décor —
insoluble pour rendre une valeur fidèle à ce que le modèle porte réellement.

## 3. Où vivent les persos, où ils ne « disparaissent » jamais

Le perso ne disparaît jamais en tant qu'identité : `componentByPersoId: Map<string,
RuntimeComponent>` (`runtime-component-orchestrator.ts`) le référence en permanence, et chaque
composant garde `this.perso` (readonly, `lib/base-component.ts:12`) toute sa vie.

Ce qui n'existe nulle part aujourd'hui, c'est son ÉTAT COURANT résultant des mutations
appliquées au fil du temps. Chaque `update()` (signature commune à tous les composants,
`RuntimeComponentUpdateInput` — `persoId`, `action: Record<string, unknown>`, `serviceContext`)
écrit directement et UNIQUEMENT sur `this.node`, via `services.apply(this.node, input.action, …)`
(`component-services.ts:89-96`) — jamais retenu ailleurs. Le node est donc, aujourd'hui, le seul
endroit où l'état appliqué persiste après écriture — pas parce que c'est la source de vérité, mais
parce que rien d'autre ne le capture.

## 4. Principe retenu : capturer EN MÊME TEMPS que l'écriture réelle, jamais après coup

Pas de second pipeline de rejeu de la timeline (le seek réel — lourd mais déjà exécuté — n'est
jamais recalculé). Pas de réimplémentation parallèle de la formule d'interpolation (risque de
divergence avec ce qu'anime calcule réellement — arrondis, easing, composition). Anime.js reste le
moteur de calcul, pour garantir la conformité — mais appliqué en parallèle à un support qui n'est
pas le node, au même instant que l'écriture réelle.

### 4.0 Portée du calcul : seek en mode auteur uniquement, pas d'écriture continue

Décision de l'auteur : soit une écriture continue et parallèle de l'état perso (à chaque frame,
en permanence), soit un calcul limité au `seek`, en mode auteur seulement — préférence explicite
pour la seconde option, sauf besoin continu avéré côté Decor.

Vérifié dans le code existant (pas supposé) : ce besoin continu N'EXISTE PAS. `decor-editor-
bridge.ts` (`machine.on('playbackActiveChanged', …)`, ligne ~593-601) suspend explicitement la
preview live de dedit dès l'entrée en lecture réelle (`mountHandle.setPreviewSuspended(true)`) et
ne la reprend qu'à la sortie, avec UNE SEULE resynchronisation (`setPreviewSuspended(false)`,
commentaire : « déclenche une seule écriture, déjà à jour »). Decor n'observe donc jamais l'état
d'un perso frame par frame pendant une vraie lecture — seulement en mode auteur (édition), à
chaque `seek`.

**Conséquence sur la conception** : puisque le seek réel (`Player.seek()`) rejoue déjà, une fois,
TOUS les persos concernés jusqu'à `t` (§2 du constat, `replayDueTimelineEventsForSeek`), le
mécanisme de capture (§4.1/§4.2 ci-dessous) n'a besoin de tourner QU'À CE MOMENT — jamais en
continu, jamais à chaque frame de lecture normale (`RendererFacade.tick()` pendant `playing`).
Une map `persoId → état`, reconstruite/mise à jour uniquement pendant le passage de seek, suffit —
exposée telle quelle (`getPersoStates()`, §5), Decor filtrant lui-même les persos qui
l'intéressent, pas un flux à maintenir à jour en permanence.

Deux points d'écriture distincts existent aujourd'hui, avec des propriétés différentes :

### 4.1 `TweenRunner` (`tween-runner.ts`) — déjà un calcul pur, à exploiter directement

`TweenRunner.evaluateAt` (ligne 188-223) est DÉJÀ indépendant d'anime.js et du DOM :
`tween.fn({ progress, data })` produit `output: Record<string, unknown>`, immédiatement passé à
`component.update({ persoId, action: output, … })`. `evaluateAt` est appelé aussi bien par
`tick()` (lecture normale, à chaque frame) que par `seek()` (`RenderAdapter`, ligne 169-178) — un
paramètre `isSeek` distingue déjà les deux cas (ligne 188, 173-177).

Conformément à §4.0 (capture limitée au seek, jamais en continu) : la capture miroir ne doit
écrire dans la map `persoId → état` QUE lorsque `isSeek === true` (le passage de `seek`, ligne
173-177) — jamais depuis `tick()` (ligne 169-171, lecture normale). Le patch complet, par perso, à
`t`, existe déjà en clair à cet endroit ; il suffit de le capturer conditionnellement, sans aucun
nouveau calcul — un second récepteur alimenté par une valeur déjà produite, actif uniquement
pendant un seek.

### 4.2 Transitions anime.js standard (`style`, `duration`/`ease` classiques) — le cas du bug de cette session

`update()` n'est appelé qu'UNE FOIS, au déclenchement (trigger) de la transition — les frames
intermédiaires sont ensuite calculées et écrites par anime.js en interne, jamais en repassant par
un point `codplay` observable directement.

**Contrainte déterminante (exemple validé)** : un item animé `x:0 → x:100` (unité perso, `cqw`)
doit rendre `x:50` au milieu du parcours pour le PERSO — jamais `translate: 50px` (le node), ni
une reconstitution depuis cette valeur px. Vérifié : `resolveTransitionValue` (`adapter.ts:12-18`)
ne convertit `cqw→px` QUE si `target instanceof Element` — no-op explicite pour tout autre target.

Conséquence sur la conception : un `targets: [node, mirrorObject]` **partagé** sur la même
transition serait FAUX (`toTransitionValue` résout une fois par transition — les deux targets
recevraient soit tous les deux la version convertie, soit tous les deux la version brute, jamais
chacun dans sa propre unité).

**Conception retenue : une transition-miroir SÉPARÉE**, pas un target ajouté à la transition
existante :
- Construire un second `TransitionRequest`, avec les mêmes `from`/`to` BRUTS (avant toute
  résolution — donc `x:0`/`x:100`, jamais les valeurs déjà résolues pour le node réel), mêmes
  `duration`/`easing`/timing que l'original.
- `target: mirrorObject` — un objet JS simple, jamais un `Element` — sa résolution devient un
  no-op PAR CONSTRUCTION (le garde `target instanceof Element` l'exclut automatiquement).
- Passée au même `animeImplementation(...)` que la transition réelle (même moteur, mêmes
  paramètres de timing/easing — seul le target et la non-résolution changent) : anime interpole
  et écrit `x:50` sur l'objet miroir, dans l'unité perso native, intacte. Garantie de conformité
  avec l'interpolation réelle, jamais un calcul réimplémenté à la main.
- `ActiveAnimation.operations` (`adapter.ts:55-67`) porte déjà les `TransitionRequest[]` d'origine,
  chacune avec `listenerId` (le persoId) et `property` — tout ce qu'il faut pour reconstruire, à
  la demande, les paramètres de la transition-miroir d'un perso donné. Conforme à §4.0 : cette
  reconstruction n'a besoin d'avoir lieu QUE pendant le passage de seek, pas en continu — elle
  s'exécute une fois, pour les persos concernés, au même moment que le seek réel les rejoue.

## 5. Ce que ça donne, assemblé

- Une map côté `codplay` (ex. dans l'orchestrateur, à côté de `componentByPersoId`) :
  `Map<persoId, Record<string, unknown>>` — l'état résolu de chaque perso AU DERNIER SEEK (pas un
  flux continu, cf §4.0) :
  - reconstruite/mise à jour par `TweenRunner.evaluateAt` uniquement quand `isSeek === true`
    (§4.1) ;
  - reconstruite/mise à jour par la transition-miroir (§4.2), déclenchée uniquement pendant le
    passage de seek — jamais maintenue à jour frame par frame en dehors de ce moment.
- **La méthode publique expose la map ENTIÈRE, pas un accès paramétré par un seul `persoId`.**
  Décision de l'auteur : un paramètre `persoId` unique ne couvre pas la sélection multiple (il
  faudrait boucler côté appelant, un appel par item sélectionné) — plus simple d'exposer l'objet
  complet une fois par seek, charge à Decor de filtrer/exploiter ce qui l'intéresse. Construire
  cette map n'est pas jugé coûteux (elle existe déjà, il s'agit de la capturer, pas de la
  recalculer — §4). Nom probable, plus proche de l'existant que `getPersoStates` : une
  extension de `getNodeSnapshot`/une nouvelle méthode de même forme mais sans relecture DOM (ex.
  `getPersoStates(): Record<persoId, Record<string, unknown>>`), jamais de calcul à l'appel,
  jamais de lecture DOM, jamais de lecture d'API anime.js après coup.

## 6. Écart d'unité Item/Perso — ce que `getPersoStates` doit renvoyer

Même famille de défaut que le bug déjà corrigé cette session côté `packages/editor`
(`formatLiveValueForCssProperty` traitant à tort une valeur déjà en cqw comme du px) — à ne pas
répéter à ce nouveau point de lecture.

Vérifié : le Builder (`resolveDecorStyle`/`resolveOffsetAsStyle`, `packages/editor/src/builder/
build-scene.ts`) ne convertit jamais cqw→px — le Perso (`ItemDoc.initial`/`.actions`) porte encore
les grandeurs en `cqw` (chaîne suffixée), comme l'Item. Mais la correspondance
valeur-saisie-par-l'auteur ↔ valeur-portée-par-le-Perso n'est pas uniforme
(`NUMBER_FORMAT_BY_PROPERTY`, `packages/editor/src/decor-editor/css-value-format.ts:26-35`) :
- certaines propriétés (`order`/`z-index`/`opacity`/`font-weight`/`line-height`) sont en nombre nu,
  sans unité cq* du tout ;
- les autres portent un facteur d'échelle variable selon la propriété (`border-width`/
  `border-radius`/`padding` à `×0.25`, le reste à `×1`) appliqué à la saisie AVANT qu'elle ne
  devienne la chaîne cqw stockée.

**Décision** : `getPersoStates` renvoie la valeur BRUTE du Perso, telle qu'elle y est portée
(chaîne cqw ou nombre nu selon la propriété) — jamais réinterprétée côté `codplay`. La
réinterprétation par propriété (facteur d'échelle, présence/absence d'unité) reste entièrement la
responsabilité de Decor (`packages/editor`), qui possède déjà ce savoir
(`NUMBER_FORMAT_BY_PROPERTY`/`parseNumberFromCssValue`) — `codplay` ne doit pas dupliquer cette
connaissance, propre au domaine dedit.

## 7. Hors périmètre de ce plan

- L'intégration côté `packages/editor` (remplacement de `resolveTemporaryPatch`/
  `AuthorApi.getNodeSnapshot` par `getPersoStates`) — chantier séparé, une fois ce mécanisme
  construit et validé côté `codplay`.
- Le point non encore vérifié : le déclenchement exact de la transition-miroir (§4.2) pendant le
  passage de seek — combien de transitions-miroir construire par perso concerné (une par
  propriété active ? groupées ?), et l'ordre exact par rapport au reste du rejeu — à étudier à
  l'implémentation. Le coût est jugé non significatif (§4.0/§5 : une fois par seek, jamais par
  frame de lecture normale).

## 8. Statut — implémenté et vérifié

Câblé de bout en bout, suite complète verte (`packages/codplay` 69/69 fichiers, 342/342 tests ;
gates verts) :

- `AnimationAdapter.getActiveTransitions()` (`animation/adapter.ts`/`types.ts`) — expose les
  `TransitionRequest[]` actives, brutes, jamais résolues.
- `RendererFacade.getActiveTransitions()` (`renderer/create-renderer.ts`) — délégation symétrique
  aux autres méthodes de la façade (`syncAnimationsToTimeline`, etc.).
- `TweenRunner.getPersoStatesAtLastSeek()` (`tween/tween-runner.ts`) — capture conditionnée à
  `isSeek === true` dans `evaluateAt`, jamais pendant `tick()` (§4.0/§4.1).
- `createRealAnimeImplementation()` extraite de `createDefaultAnimationAdapter`
  (`animation/create-default-adapter.ts`) — un seul point de vérité pour le pont anime.js réel,
  partagé par l'adapter de production ET le mécanisme miroir.
- `capturePersoStatesMirror()` (nouveau fichier `animation/perso-state-mirror.ts`) — construit une
  transition-miroir par transition active (même `from`/`to` bruts, `target` objet simple), les
  exécute via un adapter éphémère dédié, lit les valeurs AVANT `stop()` (`stop()` appelle
  `animation.revert()`, qui aurait effacé la valeur capturée — piège identifié et évité).
- `PlayerFacade.capturePersoStatesAtSeek()`/`persoStatesAtLastSeek` (`player/create-player.ts`) —
  fusionne les deux sources, appelée une fois dans `seek()` juste après
  `renderer.syncAnimationsToTimeline`/`renderSync.seek()` (qui positionnent déjà tout à `t`).
- `PlayerFacade.getPersoStates()` / `Player.getPersoStates()` / `PlayerApi.getPersoStates`
  (`player/create-player.ts`, `player/player.ts`, `player/types.ts`) — API publique, renvoie
  `ReadonlyMap<persoId, Record<string, unknown>>` (§5, objet complet, pas paramétré par un seul
  `persoId`).

**Tests écrits, tous avec une vraie interpolation anime.js (jamais de mock du moteur) :**
- `tests/v1/perso-state-mirror-transition.spec.ts` — fidélité du mécanisme miroir isolé (le
  premier incrément, node vs objet simple, même ratio de progression, unités distinctes).
- `tests/v1/capture-perso-states-mirror.spec.ts` — `capturePersoStatesMirror` avec plusieurs
  persos/propriétés, cas vide, non-conversion cqw confirmée.
- `tests/v1/player-get-perso-states.spec.ts` — intégration bout-en-bout : `PlayerFacade` réel,
  scène réelle, `seek()` réel, `getPersoStates()` confirmé identique à la valeur reçue par le node
  réel au même instant (la preuve de fidélité demandée par l'auteur : « un test doit vérifier que
  les deux canaux renvoient bien un état similaire »).

## 9. Intégration `packages/editor` — faite

`AuthorApi.getPersoStates()` (`packages/authoring/selection-frame/src/author-api.ts`) — délégation
directe à `player.getPersoStates()`, symétrique aux autres getters (`getNodePose`/`getNodeSnapshot`).

`resolveTemporaryPatch` (`packages/editor/src/app/bridges/decor-editor-bridge.ts`) réécrite pour
lire `authorApi.getPersoStates().get(itemId)` au lieu de `authorApi.getNodeSnapshot` — `syncSelection`
n'a plus besoin de `referenceWidthPx` pour ce chemin (retiré de la destructuration locale et de
l'appel).

**Nouvelle fonction `formatPersoValueForCssProperty`** (`decor-editor/css-value-format.ts`),
distincte de `formatLiveValueForCssProperty` : `getPersoStates()` ne renvoie JAMAIS du px (contrairement
à `getNodeSnapshot`, lu sur le node), donc un nombre nu qu'elle renvoie est TOUJOURS déjà en cqw —
`formatLiveValueForCssProperty` aurait reconverti ce nombre via `pxToCqw` (son test `typeof
liveValue === 'string'` pour détecter un cqw déjà résolu ne couvre pas le cas nombre, seulement
chaîne suffixée) — bug qui aurait été réintroduit silencieusement si cette distinction n'avait pas
été faite. `formatPersoValueForCssProperty` ne fait plus aucune conversion physique.

**Régression de test détectée et corrigée en cours de route** : les mocks `fakeAuthorApiWithNodes`/
`fakeAuthorApi` (`packages/editor/tests/decor-editor-bridge.spec.ts`, `offset-editor-bridge.spec.ts`)
ne fournissaient pas `getPersoStates` — ajoutés avec `getPersoStates: () => new Map(Object.entries(snapshots))`
(dérivé du même paramètre déjà utilisé par `getNodeSnapshot`), pas une map vide. Sans cette
correction, deux tests existants (« affiche la couleur live... » et « reste fiable pendant un
geste CS actif ») auraient continué de passer silencieusement malgré la disparition de la lecture
live — leurs assertions (`not.toBe('#808080')`, égalité à soi-même) étaient trop faibles pour la
détecter. Confirmé en re-testant délibérément avec une map vide (échec observé), puis restauré.
Le premier test a aussi été renforcé (comparaison stricte à la couleur de kf1, pas seulement « pas
la valeur par défaut »).

**Vérifié en direct dans l'éditeur** (scénario exact des deux bugs de la session — sélection sans
keyframe + déplacements répétés du seek) : `width`/`height` restent stables (`93.96px`, jamais de
retour à `Ncqw` ni d'effondrement géométrique) sur 5 déplacements successifs ; la couleur progresse
continûment sans jamais se figer sur le keyframe précédent.

Suite complète verte après intégration : `packages/editor` 468/468, `packages/codplay` gates
verts.

## 10. Écart d'unité Item/Perso — résolu par construction

Le §6 (écart d'unité) est traité par `formatPersoValueForCssProperty` (§9) : `getPersoStates()`
renvoie la valeur brute, réinterprétée uniquement côté Decor selon `NUMBER_FORMAT_BY_PROPERTY` —
jamais dupliquée côté `codplay`.

## 11. Bug distinct trouvé et corrigé — dérive de couleur vers le noir près de `t=0`

Signalé par l'auteur après le §9 : la couleur interpolée dérivait vers le noir en rapprochant le
seek de `t=0` — potentiellement toute valeur interpolée, pas seulement la couleur.

**Méthode de diagnostic** : l'auteur a demandé de repasser la scène de démo de test
(`packages/editor/src/app/layout/DemoMenuRegion.tsx::createPositionColorTestScene`) sur des
couleurs RGB simples plutôt qu'`oklch`, pour isoler la cause. Un test isolé (anime.js seul, en
dehors de tout code du projet, `from`/`to` en `oklch` explicites) a d'abord confirmé qu'anime.js
interpole correctement `oklch()` — la cause n'était donc PAS un défaut d'interpolation de ce
format de couleur.

**Cause réelle, confirmée en direct avec RGB** : `buildKeyframeDecorActions`
(`packages/editor/src/builder/build-scene.ts:672-675`, AVANT correctif) ne construisait jamais de
`from` explicite pour une transition inter-keyframes — seulement `{ to, duration, ease }`. Anime.js
déduit alors le `from` implicite depuis l'état ACTUEL de son `target` au moment du trigger. Pour le
node réel, cet état existe déjà (le premier keyframe est fusionné dans le style initial statique du
perso, `buildItemPerso`, ligne 603-607) — fiable par coïncidence. Pour l'objet miroir de
`capturePersoStatesMirror` (§4.2/§5), fraîchement créé et vide à chaque capture, cet état n'existe
PAS — anime.js retombe sur une valeur par défaut (transparent/noir pour une couleur), d'où la
dérive observée UNIQUEMENT via `getPersoStates()`/la palette, jamais sur le node lui-même (confirmé
par mesure directe : le node affichait déjà la bonne couleur, seule la palette dérivait).

**Correctif, à la source (`build-scene.ts`), pas seulement dans le mécanisme miroir** — décision
explicite de l'auteur : *« les données `from` sont exclusivement des données du perso, et surtout
pas du node »*. `resolveKeyframeCascadeStyle(item, scene, prevKf)` (l'état du perso juste AVANT la
transition, déjà calculé ligne 660 pour construire le diff, mais jusqu'ici jamais conservé) est
maintenant transmis comme `from` explicite dans `stylePayload[prop]`, propriété par propriété (une
propriété absente du `prevKf` cascade — jamais posée avant, ex. `rotate` sur un premier écart —
reste sans `from`, laissant l'ancien comportement implicite pour ce cas précis, inchangé). Corrige
les deux chemins EN MÊME TEMPS, à la racine : le node réel n'est plus fiable "par coïncidence", et
le miroir reçoit désormais la même donnée perso que le node.

4 tests de `packages/editor/tests/builder/build-scene.spec.ts` mis à jour (valeurs `from`
attendues, dérivées des fixtures `d-a`/`d-b` déjà existantes — jamais devinées). Suite complète
verte après correctif : `packages/editor` 468/468, gates verts. Vérifié en direct dans les DEUX
modes de couleur (RGB puis `oklch` restauré) : plus de dérive, palette et DOM cohérents à `t`
proche de 0.

**Défaut distinct découvert au passage, non corrigé ici** : `toHexForPicker`
(`packages/editor/src/decor-editor/render.ts:265-270`) ne parse QUE le format `oklch(...)` via une
regex dédiée — toute autre syntaxe de couleur CSS valide (`rgb()`, `rgba()`, hex, nom de couleur)
échoue silencieusement et retombe sur `'#808080'` (gris par défaut) dans le picker de la palette,
alors que le DOM affiche la bonne couleur. Révélé par le passage temporaire en RGB pour ce
diagnostic, pas un effet du chantier `getPersoStates` — préexistant, indépendant. Pas traité dans
ce tour (la démo a été restaurée en `oklch`, le format normal du projet) ; à consigner comme
chantier séparé si le support d'autres formats de couleur dans la palette est souhaité.
