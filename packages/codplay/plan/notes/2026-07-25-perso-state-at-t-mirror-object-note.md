# Lire l'état d'un perso à `t` sans passer par le node — note de réflexion

## Constat de départ

`AuthorApi.getNodeSnapshot`/`getNodePose` (`packages/authoring/selection-frame/src/author-api.ts`,
implémentés dans `packages/codplay/src/player/player.ts:482-493` via `readNodePose`/
`readNodeSnapshot`, `packages/codplay/src/runtime/components/lib/dom.ts`) avaient pour intention
de renvoyer l'état ACTUEL d'un perso — la vérité à l'instant `t`, indépendamment de tout rendu.
En pratique, ces deux fonctions lisent le cache interne d'anime.js pour le node DOM réel
(`utils.get(nodeRef, prop[, false])`) — donc elles dépendent du DOM et du timing d'anime.js, pas
du modèle. Deux défauts distincts constatés en direct (session du 2026-07-25, côté `packages/
editor`) :
- `width`/`height` (vocabulaire de pose anime) : le cache pouvait contenir un nombre déjà en
  `cqw`, mal réinterprété comme du px par l'appelant.
- `background-color` (hors vocabulaire de pose) : le cache restait figé sur la valeur du
  keyframe précédent, jamais rafraîchi tant qu'aucun rendez-vous explicite (seek complété,
  sélection) ne redéclenchait la lecture.

**Position de l'auteur** : le node est un artifice de rendu, pas la source de vérité — c'est le
perso, résolu depuis le modèle (keyframes + timeline + interpolation), qui doit être la référence.
`getComputedStyle` a été explicitement écarté (session du 2026-07-25) : il convertit dans un
espace de résolution du navigateur (arrondis, quantification px), introduisant un écart de
réconciliation avec les valeurs d'origine du décor — insoluble pour rendre une valeur fidèle.

## Piste envisagée — objet miroir comme `target` anime.js

`packages/codplay/src/animation/adapter.ts` traite déjà `transition.target` de façon générique
(`resolveTargetKey`, `groupTransitions`, ligne ~285-370) — n'importe quel objet JS, pas seulement
un `Element`, peut être la cible d'un groupe de tweens anime.js. `toTransitionValue` (ligne
259-280) résout déjà `from`/`to` dans le même format qu'ils entrent (aucune conversion d'unité —
confirmé plus tôt dans la même investigation : la résolution cqw→px n'a lieu QUE pour un
`target instanceof Element`, `adapter.ts:12-18::resolveTransitionValue`).

**Idée** : pour répondre à « quel est l'état du perso P à l'instant t », construire — à la
demande, jamais pendant le rendu normal — un objet JS pur initialisé à l'état de départ du perso,
rejouer sur CET objet (jamais le node réel) les mêmes transitions que le perso a subies jusqu'à
`t`, positionner ces tweens à `t` via `seek()`, puis lire les valeurs finales sur l'objet. Aucune
conversion de résolution DOM (pas de `getComputedStyle`), aucune dépendance au cache du node réel
— l'objet miroir ne existe que pour cette lecture, jetable après usage.

## Ce que ça demanderait concrètement — et pourquoi ce n'est pas trivial

Le rejeu réel d'un seek (`Player.replayDueTimelineEventsForSeek`, `create-player.ts:1593-1648`)
n'est PAS isolable facilement pour un seul perso :
- Il itère `trackManager.collectNextDueEvent(...)` sur TOUTE la timeline (tous les persos, tous
  les tracks), pas un flux filtré par perso — `collectNextDueEvent` n'a pas de paramètre de
  filtrage par cible aujourd'hui.
- Chaque événement rejoué passe par `runTimelineEvent` (`create-player.ts:1758-1854`), qui appelle
  `director.runTimelineEvent` (résolution des listeners/straps), commit, puis
  `renderer.tick(event.ms)` — un chemin qui mute l'état interne complet du player
  (`trackManager`, `renderer`, `director`), pas un calcul pur isolable en lecture seule.
- Pour un objet miroir, il faudrait soit : (a) un second pipeline de rejeu, allégé, filtré sur un
  seul perso, écrivant vers un `target` objet au lieu du node réel — une vraie duplication de
  logique de rejeu, à maintenir en parallèle du chemin réel ; ou (b) instrumenter le chemin réel
  existant pour qu'il puisse, sur demande, écrire simultanément vers un second `target` miroir
  en plus du node — moins de duplication, mais touche le cœur du pipeline de rendu/tick.

Aucune des deux n'est un simple ajout de fonction — les deux touchent au chemin de rejeu de seek,
identifié par l'auteur comme du code sensible. Aucune esquisse n'a été écrite pour cette raison.

## Piste plus concrète — `activeAnimations` porte déjà `listenerId` (persoId)

Point de départ de l'auteur : le seek complet est de toute façon déjà exécuté (lourd, mais fait) —
la question n'est pas de le recalculer, mais d'ISOLER l'état d'un perso APRÈS coup, sans passer
par le node.

Trouvé en lisant `packages/codplay/src/animation/adapter.ts` (déjà exploré plus tôt dans la même
investigation, pour une autre raison) :

- `ActiveAnimation` (ligne 55-67) — état privé de `createAnimationAdapter`, une entrée par groupe
  de transitions en cours : `{ animation, target, operations, eventId, duration, … }`.
- `operations: AnimationOperation[]` = `transitionGroup.transitions` (ligne 543) — les
  `TransitionRequest[]` d'ORIGINE, pas une forme dégradée. Chaque `TransitionRequest`
  (`packages/codplay/src/animation/types.ts:69-92`) porte `listenerId` (le **persoId**, confirmé
  par `TweenRunner.trigger` qui utilise ce même champ comme `persoId`) et `property`
  (`AnimatedProperty`, ex. `background-color`, `width`).
- Donc **chaque animation active connaît déjà, sans jamais toucher au DOM, quel perso et quelle
  propriété elle anime** — `activeAnimations.filter(entry => entry.operations.some(op =>
  isTransitionRequest(op) && op.listenerId === persoId))` retrouve directement toutes les
  transitions en cours pour UN perso, après que le seek réel les a positionnées (via
  `activeAnimation.animation.seek(seekElapsedMs)`, déjà tracé dans cette investigation,
  `adapter.ts:686-721`).
- Reste à lire la valeur courante de chaque propriété depuis `entry.animation` — c'est l'instance
  anime.js retournée par `animeImplementation(...)`, déjà positionnée à `t` par le seek réel. Sa
  propre API de lecture de valeur courante par propriété n'a pas été vérifiée ici (l'auteur a
  explicitement écarté toute exploration du code source d'anime.js pendant cette session) — c'est
  le seul point encore à confirmer, probablement déjà accessible via `utils.get(target, prop)`
  UNE FOIS le tick/seek réel déjà passé (à ce moment précis, contrairement à un appel prématuré,
  le cache qu'`utils.get` lit a bien été mis à jour par ce même tick — c'est l'ordre d'appel qui
  posait problème jusqu'ici, pas l'API elle-même).

**Correction importante (2026-07-25, retour de l'auteur) : anime.js reste le moteur de calcul —
justement pour GARANTIR un résultat conforme.** Ce n'est ni le node, ni le cache interne d'anime
lié au node réel, ni une réimplémentation parallèle de la formule d'interpolation (risque de
divergence — arrondis, easing, règles de composition propres à anime) qui doivent être lus/écrits.
C'est **l'état du perso** qui compte — et anime.js est précisément l'outil déjà en place pour le
calculer correctement ; il faut seulement lui faire produire ce calcul sur un support qui n'est
pas le node.

Anime.js accepte déjà n'importe quel objet JS comme `target` (confirmé : `resolveTargetKey`,
`adapter.ts:285-302`, traite un objet non-Element distinctement, sans erreur). Le mécanisme :

- `ActiveAnimation.operations` = `TransitionRequest[]` d'origine (`listenerId`/persoId,
  `property`, `from`, `to`, `duration`, `easing`) — tout ce qu'il faut pour reconstruire, pour un
  perso donné, exactement les mêmes paramètres de transition qu'anime a déjà reçus pour le node
  réel.
- Ces MÊMES paramètres (`from`/`to`/`duration`/`ease`/etc., inchangés) peuvent être passés à
  `animeImplementation(...)` une seconde fois, mais avec `target` pointant vers un objet JS pur
  (ex. `{}`) au lieu du node — un second tween, éphémère, jamais rattaché au DOM.
- Ce second tween est positionné à `t` (`.seek(t, …)`), exactement comme le tween réel l'a déjà été
  par le seek — anime fait le calcul (interpolation + easing), garanti IDENTIQUE au tween réel
  puisque c'est le même moteur, avec les mêmes paramètres.
- La valeur résultante se lit alors sur l'objet miroir lui-même (`mirror.property`) — jamais sur
  le DOM, jamais sur le cache lié au node réel, jamais par un calcul réimplémenté à la main.

Ceci correspond exactement à l'idée initiale de l'auteur (« l'objet target peut être un objet
plutôt qu'un node ») — la correction de compréhension porte seulement sur le POURQUOI : réutiliser
anime, pas s'en passer, précisément pour la garantie de conformité qu'aucune réimplémentation
parallèle ne peut offrir aussi sûrement.

**Ce que ça donnerait, concrètement, sans dupliquer le seek réel** :
1. Exposer `activeAnimations` (ou une projection filtrée par `listenerId`) — ex.
   `getActiveTransitionsForPerso(persoId: string): TransitionRequest[]`, retournant les paramètres
   `from`/`to`/`duration`/`easing`/`startMs`/`property` en clair (déjà le cas, rien à changer côté
   stockage).
2. Une fonction qui, pour un `persoId` et un `timelineMs` donnés, construit un objet miroir vide,
   rejoue CES transitions dessus via `animeImplementation` (même fonction déjà utilisée par le
   chemin réel), positionne le tween résultant à `timelineMs`, puis lit les valeurs sur l'objet.
3. `Player`/`AuthorApi` expose une méthode (ex. `getPersoStateAtT(persoId)`) qui appelle ce
   mécanisme — jamais de lecture DOM, jamais de dépendance au timing du tween réel (le miroir est
   construit et résolu à la demande, pas lu passivement).

Aucun second pipeline de REJEU de la TIMELINE (le seek réel reste inchangé, jamais recalculé) —
seulement un second tween anime, ÉPHÉMÈRE et localisé à un perso, construit à partir de paramètres
déjà connus (`activeAnimations`), garanti conforme puisqu'il utilise le même moteur que le rendu
réel.

## État de cette réflexion (première version — dépassée, voir §ci-dessous)

Piste affinée trois fois, toujours aucun code écrit (règle explicite de l'auteur : pas d'esquisse
sur `codplay`, code de production). Point clé retenu : anime.js reste l'outil de calcul — jamais
contourné ni réimplémenté — mais appliqué à un `target` objet-miroir au lieu du node réel, pour
lire l'état du PERSO sans dépendre du DOM ni du timing du tween déjà en cours. Reste à la
responsabilité de l'auteur de trancher la conception exacte (où vit cette fonction, coût de
construire un tween éphémère par appel, etc.), quand mûrement étudiée de son côté.

## Reformulation exacte (2026-07-25, suite) — où vivent les persos, où ils « disparaissent »

Question posée directement : où sont les persos, à quel moment disparaissent-ils ?

Trouvé par lecture de code (`packages/codplay/src/runtime/components/runtime-component-orchestrator.ts:442-449`,
`lib/base-component.ts:12`) : le perso NE disparaît jamais en tant qu'identité — `componentByPersoId:
Map<string, RuntimeComponent>` le référence en permanence, et chaque composant garde
`this.perso` (readonly) toute sa vie. Ce qui n'existe nulle part, c'est son ÉTAT COURANT résultant
des mutations : chaque `update()` (signature commune à tous les composants, `RuntimeComponentUpdateInput`
— `persoId`, `action: Record<string, unknown>`, `serviceContext`) écrit directement et
UNIQUEMENT sur `this.node` via `services.apply(this.node, input.action, ...)`
(`component-services.ts:89-96`, `CORE_SERVICES.style.apply`, ligne 56-58) — jamais retenu
ailleurs. Le node est donc, aujourd'hui, le seul endroit où l'état appliqué persiste après
écriture — pas parce que c'est la source de vérité, mais parce que rien d'autre ne le capture.

**Invariant posé par l'auteur, qui cadre la solution** : si le player rendait un item à `t` via
`seek(t)`, puis qu'on lui redemandait séparément les données du perso pour ce même `t`, les deux
chemins produiraient EXACTEMENT le même résultat (le même node, au même état). Autrement dit :
l'état « perso » recherché n'est pas une abstraction distincte à calculer différemment — c'est
LITTÉRALEMENT la même donnée que celle qui finit sur le node, seulement capturée au moment où
`codplay` la produit, avant/pendant qu'elle ne devienne write-only vers le DOM. Pas de
recalcul séparé, pas de relecture après coup (ni du node, ni d'anime.js) — une capture EN MÊME
TEMPS que l'écriture réelle, « en miroir, à côté ».

### Deux points d'écriture distincts à couvrir, un seul patron déjà en place pour l'un

1. **`TweenRunner.evaluateAt`** (`tween-runner.ts:188-223`) — DÉJÀ un calcul pur, indépendant
   d'anime.js et du DOM : `tween.fn({ progress, data })` produit `output: Record<string,
   unknown>`, immédiatement passé à `component.update({ persoId, action: output, ... })`
   (ligne 201-211) — rappelé à CHAQUE frame (`tick`/`seek` du `RenderAdapter`, ligne 169-178).
   Le patch complet, par perso, à `t`, existe déjà ici, en clair, à chaque frame. Ajouter une
   capture miroir à ce point précis (juste avant ou dans `update()`, ou dans `evaluateAt`
   lui-même) couvrirait ce mécanisme immédiatement — aucun nouveau calcul, juste un second
   récepteur alimenté par une valeur déjà produite.

2. **Transitions anime.js standard** (`style` avec `duration`/`ease` classiques, le cas du bug
   constaté cette session — couleur, dimensions) — PAS le même patron : `update()`
   (`RuntimeComponentUpdateInput`) n'est appelé qu'UNE FOIS, au déclenchement (trigger) de la
   transition (confirmé : tous les composants suivent `this.services.apply(this.node, input.action,
   input.serviceContext)` dans `update()`, jamais rappelé frame par frame pour ce chemin). Les
   frames intermédiaires du tween sont ensuite calculées et écrites par anime.js lui-même, en
   interne, sans jamais repasser par `update()` ni par aucun point `codplay` observable
   directement — SAUF le callback `onUpdate` déjà câblé (`adapter.ts:522-528`,
   `transitionGroup.parameters.onUpdate`, actuellement utilisé seulement pour relayer
   `transition.onFrame` — un callback SANS PARAMÈTRE aujourd'hue, `types.ts:86`, donc ne transmet
   aucune valeur).
   - **Point déterminant, exemple de l'auteur qui tranche la conception** : un item animé
     `x:0 → x:100` (unité perso, ex. cqw) doit rendre `x:50` à `t` mi-parcours pour le PERSO,
     jamais `translate: 50px` (le node) ni une reconstitution depuis cette valeur px. Vérifié :
     `resolveTransitionValue` (`adapter.ts:12-18`) ne convertit `cqw→px` QUE `si target instanceof
     Element` — no-op explicite pour tout autre target (commentaire ligne 8-10 : « no-op for any
     other target »). Donc un **`targets: [node, mirrorObject]` PARTAGÉ serait FAUX** : la
     conversion s'applique par transition (une fois pour tout le groupe, `toTransitionValue`
     appelée par `transition` — ligne 259-280), donc les deux targets recevraient soit tous les
     deux la version convertie (px), soit tous les deux la version brute — jamais l'un dans
     chaque unité séparément.
   - **Conception correcte : une transition-miroir SÉPARÉE**, pas un target ajouté à la
     transition existante. Pour un perso donné, construire un second `TransitionRequest` (même
     `from`/`to` BRUTS, avant toute résolution — donc `x:0`/`x:100`, jamais les valeurs déjà
     passées par `resolveTransitionValue` pour le node réel), avec `target: mirrorObject` (un
     objet simple, jamais un `Element`) — sa propre résolution devient un no-op PAR CONSTRUCTION
     (le garde `target instanceof Element` l'exclut automatiquement), donc anime interpole et
     écrit `x:50` sur l'objet miroir, dans l'unité perso native, intacte.
   - Cette transition-miroir tourne dans le MÊME `run()`/le même appel `animeImplementation`
     (même moteur, mêmes paramètres de timing/easing que la transition réelle — seul le target et
     la non-résolution changent), donc garantie de conformité avec l'interpolation réelle, sans
     jamais lire le node ni relire anime après coup.

### Ce que ça donnerait, concrètement

- Une nouvelle map côté `codplay`, tenue par `persoId` (ex. dans l'orchestrateur, à côté de
  `componentByPersoId`) : `Map<string, Record<string, unknown>>` — l'état résolu courant de
  chaque perso, mise à jour :
  - par `TweenRunner.evaluateAt`, au même point que `component.update(...)` est déjà appelé ;
  - par le tween anime.js standard, via un second `target` objet-miroir par perso (voie a),
    identifié par `listenerId` déjà porté par chaque `TransitionRequest`.
- Une nouvelle méthode publique (`Player`/`AuthorApi`, ex. `getPersoStateAtT(persoId)`) qui lit
  simplement cette map — jamais de calcul à l'appel, jamais de lecture DOM, jamais de lecture
  d'API anime.js après coup.

### Écart possible Item/Perso sur l'attribution des unités cq*

Point soulevé par l'auteur, à traiter avec le même soin que le bug déjà corrigé cette session
(`formatLiveValueForCssProperty` traitant à tort une valeur déjà en cqw comme du px) — même
famille de défaut, pas un sujet distinct.

Vérifié : le Builder (`resolveDecorStyle`/`resolveOffsetAsStyle`, `build-scene.ts`) ne convertit
jamais cqw→px — le Perso (`ItemDoc.initial`/`.actions`) porte encore les grandeurs en `cqw`
(chaîne suffixée), comme l'Item. Mais `NUMBER_FORMAT_BY_PROPERTY`
(`decor-editor/css-value-format.ts:26-35`) montre que la correspondance valeur-saisie-par-l'auteur
↔ valeur-portée-par-le-Perso n'est pas uniforme :
- certaines propriétés (`order`/`z-index`/`opacity`/`font-weight`/`line-height`) sont `format:
  'raw'` — le Perso les porte en nombre nu, SANS unité cq* du tout ;
- les autres (défaut `cqw`) portent un facteur d'échelle variable selon la propriété
  (`border-width`/`border-radius`/`padding` à `×0.25`, le reste à `×1`) appliqué à la saisie AVANT
  qu'elle ne devienne la chaîne cqw stockée.

Conséquence directe pour tout mécanisme de capture (miroir ou autre) : la valeur brute que le
Perso porte à `t` (le résultat interpolé, en cqw déjà échelonné, ou en nombre nu selon la
propriété) n'est PAS directement la valeur que Decor doit afficher — il faut la même
réinterprétation par propriété (`NUMBER_FORMAT_BY_PROPERTY`/l'inverse de `formatNumberForCssProperty`,
déjà existant côté dedit sous `parseNumberFromCssValue`) qu'applique déjà la lecture d'un décor
persisté normal, jamais une lecture directe supposant une unité uniforme. Une future méthode
`getPersoStateAtT` devrait donc soit renvoyer la valeur BRUTE du Perso (charge à l'appelant de
réinterpréter, cohérent avec « Decor est le lecteur, pas `codplay` »), soit exposer explicitement
le format attendu par propriété — à trancher par l'auteur, pas déduit ici.

## État de cette réflexion (version courante)

Piste reformulée avec le bon niveau (perso, pas node) et le bon principe (capture EN MÊME TEMPS
que l'écriture réelle, jamais une relecture a posteriori d'anime.js ou du DOM). Toujours aucun
code écrit — deux points d'accroche identifiés avec précision (`TweenRunner.evaluateAt` déjà pur ;
`onUpdate`/targets multiples pour le chemin anime.js standard, restant à confirmer côté (a) vs
(b)). Reste à la responsabilité de l'auteur de trancher la conception exacte et le moment
d'implémenter, ce code étant reconnu sensible.
