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

## 8. Statut

Conception posée, aucun code écrit (code de production, `packages/codplay` — pas d'esquisse).
Reste à la responsabilité de l'auteur de valider cette conception et de décider du moment
d'implémenter.
