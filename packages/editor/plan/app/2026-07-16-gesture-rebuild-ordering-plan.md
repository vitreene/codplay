# ed2 — Ordonnancement geste ↔ reconstruction (race condition CS/rebuild)

Analyse et plan, pas de code à ce stade. Fait suite à une investigation live (drag/resize/rotate dans
ed2, `localhost:5174`) qui a d'abord révélé un bug de timing `cqw`→px côté `packages/codplay` (résolu :
voir `packages/authoring/selection-frame/src/adapters/libre-adapter.ts::pinToResolvedPx`, garde
`isConnected`), puis un second problème structurel, plus profond, objet de ce document : le second
geste d'une séquence de manipulation (resize puis rotation puis déplacement, typiquement) se
repositionne mal, la rotation se perd de façon apparemment aléatoire, l'axe de rotation devient faux.

**Portée** : `packages/editor` et `packages/authoring/selection-frame`. `packages/codplay` n'est ni lu
ni modifié ici — contrainte déjà actée par `2026-07-13-controller-islands-bridge-plan.md` §2.1/§8,
reconduite explicitement par l'auteur pour ce chantier.

---

## 1. Constat — la race condition, précisément

### 1.1 Chaque commit persiste vers un **destroy + remount complet**, jamais un patch incrémental

`scene-player-bridge.ts::rebuild()` appelle `studio.load()`, qui appelle toujours
`this.player.init(...)` (`creator-facade.ts:39`). `PlayerFacade.init()` commence par
`this.resetRuntime()` (`create-player.ts:1716`) → `this.renderer.destroy()` →
`orchestrator.destroy()` (`runtime-component-orchestrator.ts:580-596`), qui notifie **tous** les
abonnés `subscribeToNode` avec `null` avant de vider les registres, puis reconstruit tout depuis zéro
(`mountLoadedRuntimeComponent`, pas un simple rafraîchissement). C'est un choix **déjà acté et
mesuré** (`2026-07-13-controller-islands-bridge-plan.md` §2.1 : 17–28ms à froid, 2–3ms ensuite,
« négligeable à cette échelle ») — ce n'est pas ce qui est remis en cause ici. Ce qui manque, c'est
une garantie sur **ce qui a le droit de se passer pendant que ce cycle est en vol**.

### 1.2 Deux abonnements indépendants réagissent à ce cycle, sans coordination ni garde

`selectItem()` (`scene-player-bridge.ts:118-164`) crée un `LibreAdapter` et un `SelectionFrame` qui
s'abonnent **chacun séparément** au même `itemId` via `authorApi.subscribeToNode` :

- `LibreAdapter` (`libre-adapter.ts:119-122`) : sa variable de fermeture `node` est réassignée à
  chaque notification (`null` au destroy, nouveau node au remount).
- `SelectionFrame` (`selection-frame.ts:1507-1521`, `handleElementNode`) : sa variable de fermeture
  `elementNode` (déclarée ligne 63) est réassignée de la même façon, et **appelle
  `positionCs()` sans aucune condition** — contrairement au `ResizeObserver` du même fichier
  (lignes 1498-1502), qui lui vérifie explicitement
  `!dragGesture.isActive() && !anyResizeActive && !rotateGesture.isActive()` avant d'agir.

### 1.3 Les gestionnaires de geste lisent ces variables en direct, jamais une référence figée

`dragGesture`, `resizeGestures`, `rotateGesture` sont construits via `bindGestureSession` et leurs
`onMove` lisent `elementNode` **en direct** depuis la fermeture (ex. lignes 1008, 1057-1058,
1174-1175) — pas une capture au `onStart`. Rien dans `gesture-session.ts` n'aborte un geste en cours
sur `NODE_DISAPPEARED`/`NODE_APPEARED` : ces events atteignent bien la machine `csMachine` (§3), mais
rien ne relie en retour cette transition au cycle de vie de la session pointeur elle-même.

### 1.4 Après résolution du rebuild, `selectItem()` est rappelé et **détruit** le frame en cours

`scene-player-bridge.ts:166-172` : `machine.on('sceneCommitted', ...)` déclenche
`rebuild(scene).then(() => selectItem(selection.itemIds))`. `selectItem()` fait
`frame?.destroy(); frame = null` avant de recréer `LibreAdapter`+`SelectionFrame`. Si un geste est
encore actif à ce moment (pointeur toujours enfoncé), ses poignées DOM sont retirées — ce qui devrait
déclencher `lostpointercapture` et aborter proprement la session en cours (mécanisme prévu dans
`gesture-session.ts`) — mais tout mouvement de pointeur postérieur à cet instant ne produit plus
aucun effet tant que l'utilisateur ne relâche pas et ne redémarre pas un geste sur le **nouveau**
frame.

### 1.5 La fenêtre de risque concrète

`onApplied` (`scene-player-bridge.ts:151-154`) débounce `persistOffset` à 250ms — chaque
`pointermove` réarme ce minuteur, donc **pendant un geste continu, aucun rebuild ne peut démarrer**.
Le risque n'existe qu'**entre deux gestes séparés** : geste 1 se termine, 250ms plus tard
`persistOffset` s'exécute → `rebuild()` démarre (asynchrone, durée non bornée en pratique). Si
l'utilisateur démarre le **geste 2** avant que ce rebuild n'ait fini, il tombe dans la fenêtre décrite
en 1.2-1.4. C'est cette variabilité de timing qui produit l'aspect « aléatoire » observé.

**Aucun mécanisme de verrou n'existe pour empêcher ceci.** `codplay` expose bien
`enableInteractionLock` (`player.ts:145-154`), mais il est piloté par `player.status !== 'playing'` —
une sémantique lecture/pause, pas « reconstruction en cours » — et `scene-player-bridge.ts` ne
l'active de toute façon pas (`mode: 'author'` sans `enableInteractionLock: true`, lignes 71-80). Même
activé, ce verrou ne répondrait pas à la bonne question.

---

## 2. Constat — le contrat visé existe déjà dans les plans, jamais implémenté correctement

`2026-07-12-app-controller-definition.md` §4.3 (« Flux d'édition décor — preview live + commit
débouncé ») dit explicitement :

> Ce qu'il reçoit : une intention `setDecor(decorId, patch)` émise **une fois par salve de geste**,
> après débounce **ou fin de geste franche (`pointerup`/blur/Entrée)** côté module.

`2026-07-13-controller-islands-bridge-plan.md` §3.3 documente ce point comme **ouvert et jamais
tranché** :

> **Point ouvert** : le debounce entre geste utilisateur et `sceneCommitted`... son point d'insertion
> exact... reste à trancher à l'implémentation.

L'implémentation actuelle de `persistOffset` (un simple `setTimeout(250ms)` réarmé à chaque
`onApplied`) ne couvre que la moitié du contrat visé — la partie « débounce ». Elle n'a **aucune**
détection de « fin de geste franche » (`pointerup`) — alors que ce pattern existe déjà, correctement,
ailleurs dans la même base de code : `sequence-editor/mount.ts` écoute explicitement `pointerup` pour
appeler `ctrl.dragEnd()` (plusieurs occurrences, ex. lignes 222-230, 322-330, 398-411).

Par ailleurs, `ControllerContext.editGesture: 'zone' | 'offset' | null` (`controller/types.ts:40`,
événement `SET_EDIT_GESTURE`) existe dans le contrat de la machine centrale — mais **n'est envoyé
nulle part dans le code actuel** (vérifié par recherche exhaustive). Signe que la nécessité de
modéliser « un geste est en cours » a déjà été identifiée, puis jamais câblée.

---

## 3. Constat — les modules d'authoring dupliquent déjà, à la main, la même machine

Investigation plus poussée sur `packages/authoring/selection-frame` : la duplication n'est pas
seulement un pattern répété informellement, elle va jusqu'à **deux machines XState quasi
identiques**, écrites séparément.

### 3.1 Cinq implémentations indépendantes du même patron de suivi de node

Le patron « s'abonner à `subscribeToNode`, garder une référence locale au node, réagir à son
changement » existe **cinq fois**, sans aucun partage de code :

1. `LibreAdapter` (`libre-adapter.ts:119-122`) — pas de machine du tout, juste une fermeture `node`.
2. `SelectionFrame::handleElementNode` (`selection-frame.ts:1507-1521`) — pilote `csMachine`.
3. `FlexAnchorTool` (`flex-anchor-tool.ts:156-166`) — deux abonnements (élément + conteneur), pas de
   machine.
4. `ZoneEditor` (`zone-editor.ts:400`) — pilote sa propre `zoneMachine`. Le fichier le dit lui-même en
   en-tête (ligne 3) : *« ENRICHI du gabarit du cs (§Dispositifs communs) : même accrochage
   (`authorApi.subscribeToNode`) »* — la duplication est déjà nommée dans un commentaire, jamais
   résolue en module partagé.
5. `MultiSelectionFrame` (`multi-selection-frame.ts:189-197`) — cinquième copie, cette fois **en
   boucle** (un abonnement par item suivi), qui pilote elle aussi sa propre instance de `csMachine`
   et fait remonter `NODE_APPEARED`/`NODE_DISAPPEARED` selon qu'au moins un item de la sélection est
   présent (`anyPresent`, ligne 193-194).

`ResizeObserver` (`selection-frame.ts:1495-1505`) n'existe que dans ce seul fichier, nulle part
ailleurs — un garde-fou ad hoc ajouté à un seul des cinq modules, jamais généralisé.

**Précédent documenté, dans ce même package, pour exactement ce risque** — `multi-selection-frame.ts`
lignes 112-117 :

> « Wired through the shared `bindGestureSession` ... rather than a hand-rolled listener set, per the
> consolidation audit (2026-07-10): this file previously reimplemented that plumbing manually and,
> by coincidence, never carried the `lostpointercapture` bug the shared module once had — proof that
> duplicating this wiring is a real maintenance risk, not just a style preference. »

Un audit de consolidation (2026-07-10) a déjà traité **une partie** de ce risque — la plomberie
pointeur (`bindGestureSession`) est bien unifiée aujourd'hui, `MultiSelectionFrame` l'utilise comme
les autres plutôt que de la ré-implémenter. Mais le même audit n'a **pas** été refait sur le suivi de
node (`subscribeToNode` + machine de cycle de vie) — qui reste, lui, dupliqué cinq fois. Ce n'est donc
pas une préoccupation théorique : ce type de duplication a **déjà** produit un bug de robustesse
constaté dans ce package, et n'a été corrigé qu'à moitié.

### 3.2 `csMachine` et `zoneMachine` sont la même machine, écrite deux fois

Comparaison directe :

```
csMachine (machine.ts)                      zoneMachine (zone-machine.ts)
idle ──NODE_APPEARED──▶ active               idle ──NODE_APPEARED──▶ active
  active.still ──DRAG_START──▶ dragging        active.still ──MOVE_START──▶ moving
  active.still ──RESIZE_START──▶ resizing      active.still ──RESIZE_START──▶ resizing
  active.still ──ROTATE_START──▶ rotating      active.still ──TRACE_START──▶ tracing
  active ──NODE_DISAPPEARED──▶ suspended       active ──NODE_DISAPPEARED──▶ suspended
  suspended ──NODE_APPEARED──▶ active          suspended ──NODE_APPEARED──▶ active
```

Le commentaire d'en-tête de `zone-machine.ts` (ligne 6) le confirme explicitement : *« même
discipline que `csMachine` »*. **La machine qui modélise correctement « un geste est actif » /
« le node a disparu » existe déjà — deux fois, presque au caractère près.** Ce n'est donc pas une
machine à inventer (correction par rapport à une lecture antérieure de ce chantier) : c'est une
machine à **extraire en une seule définition**, paramétrée par les événements de geste propres à
chaque outil (`DRAG_START`/`RESIZE_START`/`ROTATE_START` côté cs, `MOVE_START`/`RESIZE_START`/
`TRACE_START` côté zone), plutôt que redérivée à la main deux fois — avec le risque déjà réalisé que
la troisième et quatrième implémentation (`LibreAdapter`, `FlexAnchorTool`) n'aient, elles, **aucune**
machine du tout.

### 3.3 Le vrai trou : la machine existe, mais rien ne la consulte au bon endroit

Le problème n'est donc pas absence de modélisation — il est que :

- `handleElementNode` envoie bien `NODE_APPEARED`/`NODE_DISAPPEARED` à `csMachine` (`selection-frame.ts:1511,1518`),
  et la machine transite bien vers `suspended` (quel que soit le sous-état de geste en cours,
  `active.on.NODE_DISAPPEARED` est déclaré au niveau parent — `machine.ts:151`). Mais `positionCs()`
  est appelé **avant** l'envoi de l'événement, sans jamais consulter l'état résultant.
- `LibreAdapter`, qui est le module qui **écrit réellement** sur le DOM à chaque pas de geste
  (`applyMove`/`applyResize`/`applyRotate`), n'a **aucune** visibilité sur `csMachine` — c'est le
  module le plus déterminant pour la correction visuelle, et le moins gouverné par un état.
- `gesture-session.ts` (le moteur de capture pointeur réellement utilisé par tous les gestes, cs
  comme zone) n'a aucun canal pour être informé qu'une transition `suspended` vient de se produire —
  il ne réagit qu'aux événements natifs du pointeur (`pointerup`/`pointercancel`/
  `lostpointercapture`), aveugle à ce que la machine XState sait déjà.

C'est cette déconnexion — un état correct qui existe, mais que les modules qui agissent réellement
sur le DOM n'interrogent jamais — qui est la cause directe de §1.2-1.3.

### 3.4 Principe transverse rappelé par l'auteur — noms d'événements comme convention configurable

Point de méthode à ne pas perdre pour la suite : dans `codplay`, tout nom d'événement est une
convention, pas une valeur figée — un fichier de config fait le lien entre le nom et son usage
(patron déjà en place : `RUNTIME_CONFIG.move.rootToken`/`detachToken`, `player.ts`). Ce principe
s'applique en particulier si un futur travail venait à faire dépendre `ed2` des noms d'événements de
cycle de vie de `player.onTrace()` (`"player:init:started"`, etc., `create-player.ts:95-96`) : ces
chaînes ne sont aujourd'hui **pas** un contrat documenté (`v1-player-api.md` documente la forme de
`onTrace`, pas les noms d'événements précis) — les utiliser telles quelles serait s'appuyer sur un
détail d'implémentation. Non bloquant pour ce chantier (§4 ci-dessous montre que ce signal n'est de
toute façon pas nécessaire ici), mais à respecter si un besoin de ce type apparaît plus tard : passer
par une convention nommée et configurable, jamais une chaîne en dur.

---

## 4. Chantier 1 — unifier les modules d'authoring autour d'une machine et d'un suivi de node partagés

**Préalable réel aux chantiers 2 et 3** — la coordination geste↔rebuild (chantier 2) n'a nulle part
où lire un état fiable tant que cette unification n'est pas faite.

**Plan d'exécution précis (contrat de la couche commune, ordre de migration module par module,
validation, definition of done) : `2026-07-16-authoring-shared-tracking-layer-plan.md`.** Ce qui suit
reste l'analyse/conception qui justifie ce sous-chantier ; le document dédié couvre le « comment ».

### Objectif

Une seule primitive de « suivi de node » (subscribeToNode + état `isConnected`-safe + notification
uniforme), et une seule définition de machine « cycle de vie geste » (le squelette commun à
`csMachine`/`zoneMachine`), **consommées** par les cinq modules — sans fusionner les modules
eux-mêmes. Chaque module garde sa responsabilité propre (le cs dessine des poignées et applique des
deltas de transform libre ; l'outil flex dessine 11 points d'alignement ; l'éditeur de zone peint des
rectangles de grille ; `LibreAdapter` mute le style DOM) — seul le **comportement vis-à-vis du cycle
de vie du node et du geste** doit devenir identique et prévisible du point de vue de l'app, exactement
la distinction que l'auteur demande de préserver : construction modulaire, comportement unifié.

### Précision de conception — une couche d'appel possédée, pas seulement du code partagé

Distinction importante, actée par l'auteur : il ne s'agit pas de factoriser le motif de §3.1-3.2 en
simples fonctions/fabriques que chacun des 5 modules importerait et **cablerait indépendamment** —
cette forme-là laisserait subsister exactement le risque nommé : un correctif appliqué à l'usage que
`SelectionFrame` fait de la primitive n'a aucune raison de se propager à l'usage, séparé, que
`ZoneEditor` en fait. Deux implémentations qui partagent du code source ne partagent pas forcément un
comportement — seulement du texte.

La forme qui élimine réellement ce risque est une **couche d'appel possédée** : un service/façade,
une instance par cible suivie (par `persoId`), qui **possède** l'abonnement `subscribeToNode`, la
machine de cycle de vie, et surtout la **décision** « puis-je agir maintenant » — les 5 modules ne
répliquent plus cette décision chacun de leur côté, ils la **délèguent** en appelant dans cette
couche. Un bug trouvé et corrigé dans la logique de décision se corrige alors une seule fois, à un
seul endroit, et bénéficie automatiquement à tout module qui appelle cette même instance — pas parce
qu'un développeur s'est souvenu de répercuter le correctif ailleurs, mais parce qu'il n'existe qu'une
seule copie de cette logique.

### Surface de cette couche (esquisse, pas un contrat figé)

Ce que la couche **possède** et que les modules ne recréent plus chacun de leur côté :

- l'abonnement `authorApi.subscribeToNode(persoId, ...)` et l'état `isConnected`-safe du node
  courant (remplace les 5 implémentations locales de §3.1) ;
- une instance unique de la machine de cycle de vie (le squelette `idle → active(<gestes>) ⇄
  suspended` de §3.2 — `csMachine`/`zoneMachine` en deviennent des spécialisations, même squelette,
  vocabulaire de gestes propre à chaque outil) ;
- la décision « puis-je agir maintenant » — un point d'interrogation unique, jamais réimplémenté par
  chaque module (c'est cette réimplémentation locale, présente sur le `ResizeObserver` et absente
  ailleurs, qui a produit l'incohérence de §3.1).

Ce que chaque module continue de posséder en propre (la diversité à garder) :

- son propre rendu (poignées du cs, points de l'outil flex, tracé des zones) ;
- ses propres calculs de geste (delta de transform libre, alignement flex, géométrie de zone) ;
- la décision de **quand** déclarer un geste démarré/terminé — la couche commune ne devine rien,
  chaque module l'informe explicitement (« je démarre un resize », « je termine »).

Un module n'appelle donc plus `authorApi.subscribeToNode` ni ne construit sa propre machine — il
demande une cible suivie à la couche commune, déclare ses gestes au fil de l'eau, et interroge (ou
s'abonne à) la décision « puis-je agir » avant chaque effet de bord DOM. `LibreAdapter` en particulier
(§3.3 — le module le plus déterminant, le moins gouverné aujourd'hui) devient un simple exécutant de
deltas **gardé** par cette couche, au lieu d'agir en aveugle sur sa propre fermeture `node`.

`gesture-session.ts` doit pouvoir être avorté depuis l'extérieur — un point d'entrée explicite (pas
seulement l'attente d'un `pointerup`/`lostpointercapture` natif) pour que la transition vers
`suspended`, décidée dans la couche commune, puisse couper une session pointeur en cours plutôt que
de la laisser produire des deltas dans le vide.

### Une session par outil actif, portant 1..N cibles suivies — pas une instance par module

**Tranché par l'auteur** : un seul outil est actif à la fois (exclusivité confirmée — pas besoin
d'arbitrage entre deux modules sur le même item), mais cet outil peut porter sur une **multisélection**
— déjà le cas aujourd'hui : `MultiSelectionFrame` (§3.1, point 5) pilote une seule session de geste
sur N nodes suivis en parallèle, chacun avec son propre `CsValueAdapter`. La couche commune doit donc
distinguer deux niveaux, déjà visibles dans `multi-selection-frame.ts` mais jamais formalisés comme
contrat partagé :

- **le suivi de node** est par item (1 abonnement `subscribeToNode` par `persoId`, 1 état
  `isConnected`-safe par item) ;
- **la session de geste et la décision « puis-je agir »** sont portées une seule fois, au niveau de
  l'outil actif — qu'il porte sur 1 item (`LibreAdapter`+`SelectionFrame` aujourd'hui) ou sur N
  (`MultiSelectionFrame`). C'est exactement le repli déjà fait à la main dans `multi-selection-frame.ts`
  (`anyPresent`, ligne 193 : la présence d'un seul item suffit à faire vivre la session), à généraliser
  en un seul mécanisme plutôt qu'à le recopier une sixième fois si un nouvel outil multi-cible apparaît.

Concrètement : la couche commune expose une fabrique de **session** (1..N `persoId`), qui possède en
interne autant de suivis de node que de cibles, mais une seule machine de cycle de vie et une seule
décision « puis-je agir » pour l'ensemble de la session. `LibreAdapter`/`SelectionFrame` (cas 1) et
`MultiSelectionFrame` (cas N) deviennent deux façons de construire la même session, pas deux
mécanismes séparés.

`LibreAdapter` et `SelectionFrame` restent par ailleurs co-construits par le même appelant
(`scene-player-bridge.ts::selectItem()`, qui connaît déjà le même `itemId` pour les deux) — point
naturel où faire créer **une seule** session par la couche commune et la transmettre aux deux, au lieu
que chacun ouvre son propre abonnement séparé sur le même id.

### `FlexAnchorTool` — ancrage minimaliste, tranché

**Tranché par l'auteur** : `FlexAnchorTool` n'a pas besoin du squelette complet de sous-états de geste
(son interaction est purement au clic, pas de geste continu) — seulement d'un ancrage minimaliste au
même dispositif commun : le suivi de node (élément + conteneur) et la décision « puis-je agir »,
sans déclarer de sous-état `dragging`/`resizing`/`rotating`. L'uniformité qui compte est celle du
**comportement observable** (ne jamais réagir sur un node dans un état incohérent), pas l'obligation
que les cinq modules invoquent XState de façon identique — la couche commune doit donc exposer cet
ancrage minimal comme un mode d'usage à part entière, pas comme un cas dégradé.

### Où vit cette couche

Dans `packages/authoring/selection-frame` lui-même (déjà le package qui héberge les 5 modules et
dépend déjà de `xstate` — `package.json`, confirmé). Pas besoin d'un nouveau package générique :
cohérent avec le principe rappelé par l'auteur (« ils peuvent rester couplés à ce projet ») — cette
couche n'a pas vocation à devenir une bibliothèque publique indépendante, seulement à cesser d'être
ré-écrite cinq fois à l'intérieur du même package.

---

## 5. Chantier 2 — machine de reconstruction déterministe (geste ↔ rebuild)

Une fois le chantier 1 en place (session de la couche commune,
`2026-07-16-authoring-shared-tracking-layer-plan.md` §2 — suivi de node, machine de cycle de vie,
décision `canAct`), ce chantier consiste à faire lire, côté `scene-player-bridge.ts` (ou un acteur
dédié au pont `scenePlayer`), cette **même** décision pour arbitrer dans les deux sens :

- Un rebuild ne démarre **jamais** tant que la session signale un geste actif (déjà vrai aujourd'hui
  via le débounce réarmé — à rendre explicite en consultant `canAct`/l'état de la session plutôt
  qu'implicite via un minuteur).
- Le remplacement `frame`/`adapter` dans `selectItem()` n'a lieu **qu'après** confirmation que la
  session est revenue à `idle`/`still` — pas un simple enchaînement `.then()` qui ignore l'état du
  pointeur. C'est la session elle-même (chantier 1) qui doit porter cette confirmation, pas une
  vérification ad hoc ajoutée dans `scene-player-bridge.ts`.
- Réciproquement, si un rebuild est en vol (ed2 le sait directement : c'est lui qui `await` la
  promesse de `studio.load()`/`player.init()` — aucun signal supplémentaire de `codplay` n'est
  nécessaire pour ça, voir §3.4), tout `pointerdown` qui tenterait de démarrer un nouveau geste
  pendant cette fenêtre doit être explicitement mis en attente ou ignoré — le point d'abort externe
  de `gesture-session.ts` (chantier 1, §2.5) est le mécanisme déjà prévu pour couper une session
  qui démarrerait malgré tout, jamais laissée à interagir avec un frame en cours de remplacement.

### Ce que ce chantier ne doit pas faire

- Ne pas remettre en cause le rebuild complet (destroy+remount) — décision déjà actée et mesurée
  (§2.1 du bridge plan). Le chantier porte sur l'**ordonnancement**, pas sur l'incrémentalité.
- Ne pas toucher `packages/codplay` — `subscribeToNode`/`orchestrator.destroy()` restent tels quels ;
  la coordination se fait strictement côté consommateur (`ed2`).
- Ne pas ajouter de mode/état côté `codplay` (« rebuild on edit », etc.) — non nécessaire : `ed2` a
  déjà, par construction, une visibilité complète sur ses propres appels `await player.init()`/
  `await player.destroy()`. Si un besoin de signal *externe* apparaît un jour (un module tiers sans
  accès direct à cette promesse), la bonne forme resterait un callback documenté et nommé par
  convention (§3.4), jamais une state machine côté `codplay`.

---

## 6. Chantier 3 — fin de phase de manipulation, pas fin de micro-geste

### Objectif

Une séquence composite (resize → rotation → déplacement, enchaînée par le même utilisateur sur le
même item sans changer de sélection) doit produire **un seul commit** à la fin de la séquence
complète — pas un commit (et donc un rebuild) après chaque outil pris isolément. C'est le contrat
déjà écrit dans `app-controller-definition.md` §4.3 (« une fois par salve de geste »).

### Ce qu'il faut distinguer

- **Fin d'un micro-geste** (`pointerup` après un seul drag/resize/rotate) — signal déjà disponible
  via la session du chantier 1 (transition `active.<geste> → active.still`).
- **Fin de la phase de manipulation** — l'utilisateur a fini d'éditer cet item pour l'instant : change
  de sélection, appuie sur Échap, clique ailleurs, ou reste inactif au-delà d'un certain délai après
  le dernier micro-geste. Concept absent aujourd'hui — le débounce à 250ms en est une approximation
  grossière, pas une détection réelle.

### Piste de conception

- Flush immédiat sur `pointerup` d'un micro-geste **si** aucun autre micro-geste ne démarre dans une
  fenêtre courte (pattern déjà utilisé par `sequence-editor/mount.ts::onUp`, à répliquer plutôt qu'à
  réinventer).
- Le passage d'un outil à l'autre (resize → rotate) dans la foulée ne doit **pas** déclencher de
  commit intermédiaire — la session unifiée du chantier 1 (un seul état macro `active` englobant
  tous les sous-gestes) rend cette continuité directement lisible : un changement de sous-état
  `resizing → still → rotating` sans jamais repasser par `suspended` (donc sans perte de node) est
  une même phase, pas une nouvelle salve. Pour une session à N cibles (multisélection), la même
  continuité s'applique tant que l'agrégat « au moins un item présent » reste vrai.
- Fin de phase explicite : changement de sélection (`SELECT_ITEM` vers un autre id, ou
  `CLEAR_SELECTION`), `Échap`, ou clic hors du CS — chacun devant, côté pont `scenePlayer`, clore la
  session en cours plutôt que de la laisser expirer par timeout.

Ce chantier dépend directement du 1 (la session porte l'information nécessaire) et coordonne avec le
2 (c'est la fin de phase, pas la fin de micro-geste, qui doit déclencher le commit → rebuild).

---

## 7. Risques — pourquoi un patch localisé ne suffira probablement pas

Le point le plus dur du message initial : *« Eddy a été abandonné à cause de cela »*. Sans plus de
détail sur ce précédent, la leçon à en tirer structurellement est claire : une race condition entre
un cycle de reconstruction asynchrone et une surface de manipulation directe sur le DOM vivant n'est
pas le genre de bug qu'on ferme avec un flag booléen de plus. Deux signes déjà observés dans CE
chantier confirment le risque si on se contente de rustines locales plutôt que de l'unification du
chantier 1 :

- Le garde `isConnected` posé sur `pinToResolvedPx` (chantier précédent, déjà fait) est un correctif
  ponctuel, pas une garantie structurelle.
- `editGesture` (§2) et `csMachine`/`zoneMachine` (§3.2) montrent que la modélisation de « un geste
  est en cours » a déjà été pensée, **deux fois**, et à chaque fois laissée insuffisamment reliée au
  reste (soit jamais câblée, soit câblée seulement à moitié — la machine transite mais rien
  n'écoute). Un chantier 1 mal exécuté referait probablement la même chose une troisième fois.

C'est précisément pour cette raison que ce chantier ne doit pas être traité comme un correctif parmi
d'autres. Le CS (cadre de sélection / manipulation directe) est une **interface centrale de l'app** —
la voie par laquelle l'auteur interagit visuellement avec ce qu'il construit. Une fragilité résiduelle
sur cette interface, après ce chantier, n'est pas un défaut mineur reporté au sprint suivant : c'est,
au niveau de gravité déjà vécu par le passé (« Eddy »), un risque d'abandon du projet. En conséquence,
la portée définie ici (chantiers 1 à 3) doit être réalisée **intégralement et correctement** — jamais
partiellement, jamais par un correctif de contournement pris en cours de route parce que la version
complète paraîtrait trop coûteuse dans l'instant. Aucune stratégie de repli n'est envisagée (§8).

---

## 8. Portée engagée — aucun repli, aucun patch superficiel

Deux pistes ont été envisagées puis **explicitement écartées**, pas gardées en réserve.

### Écartée — surface de manipulation dissociée de la scène jouée (overlay approximatif)

L'idée : le CS ne toucherait plus jamais le node DOM produit par `codplay`, mais une représentation
locale légère (rect + transform) en overlay, pendant que la scène réelle reste figée. Manipuler une
approximation plutôt que le rendu réel romprait la garantie WYSIWYG qui fait la valeur de cette
interface — et recréerait, sous une autre forme, **exactement** le problème que le chantier 1 corrige :
une deuxième implémentation, séparée, du comportement d'un item (l'overlay) qui doit rester en phase
avec la première (le rendu réel, avec sa résolution `cqw`/`cqh` dépendante du conteneur, son
auto-size de texte, etc.). Deux implémentations d'un même comportement qui peuvent diverger — l'anti-
patron identifié et éliminé, à cinq reprises, par le chantier 1. Une option qui réintroduit la classe
de bug qu'on vient de corriger n'est pas une alternative recevable.

### Écartée — verrou dur + file d'attente

Geler l'interaction CS pendant tout rebuild en vol, mettre en file toute tentative de geste. Ne
corrige pas le couplage, le **masque** sous charge normale — un gel perceptible de l'UI lors de
manipulations rapprochées est un symptôme différent du même défaut de fond, pas une résolution.
Définition même du patch superficiel : une réaction au symptôme sans toucher à sa cause (l'absence,
avant le chantier 1, d'un état de geste partagé et effectivement consulté).

### Ce que « chantiers 1-3 correctement exécutés » signifie déjà

Une session unique, du premier `pointerdown` jusqu'à la fin de phase détectée, gouvernant à la fois le
geste (chantier 1, `2026-07-16-authoring-shared-tracking-layer-plan.md`), le rebuild (chantier 2) et
le commit (chantier 3) — ce n'est pas une variante à activer en réserve, c'est la cible normale du
travail déjà engagé quand il est mené avec la rigueur déjà posée pour le chantier 1.

### S'il reste un écart après 1-3

La réponse n'est pas de reculer vers l'overlay ou le verrou, mais d'**approfondir le même modèle** :
élargir ce que la session couvre (un cas de geste non anticipé, un point de rebuild non gardé) plutôt
qu'introduire un mécanisme parallèle. Le risque nommé en §7 (« Eddy ») est un risque de précipitation
— traiter un signal de fragilité comme une invitation à contourner plutôt qu'à corriger à la racine —
pas un argument pour préparer d'avance une porte de sortie moins ambitieuse.

---

## 9. Ordre de travail proposé

1. Valider ce document (portée, contraintes, silence sur `codplay`).
2. **Chantier 1 d'abord, isolément** — `2026-07-16-authoring-shared-tracking-layer-plan.md` détaille
   le contrat de la couche commune et l'ordre de migration des 5 modules (`LibreAdapter` en premier).
   Validable indépendamment des chantiers 2/3 — un module qui refuse d'agir sur un node `suspended`
   est déjà une amélioration mesurable seule.
3. Chantier 2 (ordonnancement rebuild) — dépend de 1.
4. Chantier 3 (fin de phase) — dépend de 1, coordonne avec 2.
5. Si 2/3 s'avèrent encore fragiles à l'usage réel (test Safari, geste enchaîné resize→rotate→move, y
   compris en rafale) : **ne pas contourner** — revenir sur la portée de la session (chantier 1) pour
   couvrir le cas manqué, avec la même rigueur qu'à l'étape 2. Aucun repli vers une architecture
   différente (§8).
