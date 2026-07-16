# ed2 — Chantier 2 (ordonnancement rebuild) + Chantier 3 (fin de phase) — plan d'exécution

Plan précis, pas de code à ce stade. Sous-chantier de `2026-07-16-gesture-rebuild-ordering-plan.md`
§5-6 (« Chantier 2 » et « Chantier 3 ») — l'analyse/justification reste dans ce document parent ;
celui-ci couvre le **comment**, une fois Chantier 1 (`2026-07-16-authoring-shared-tracking-layer-plan.md`)
posé et validé (fait — les 5 modules consomment la couche commune, 196/196 tests, cf. session du
2026-07-16).

**Portée** : `packages/editor/src/app/bridges/scene-player-bridge.ts` et
`packages/authoring/selection-frame` (extension ciblée, pas une réécriture). `packages/codplay` non
touché — contrainte reconduite.

---

## 1. Ce qui manque après Chantier 1 — le vrai point de blocage de ce chantier

Chantier 1 donne à `packages/authoring/selection-frame` un état « puis-je agir » interne à chaque
module, et un ancrage node-tracking partagé (`createMinimalAnchor`) entre `LibreAdapter` et
`SelectionFrame`. Mais **rien de ceci n'est visible depuis `scene-player-bridge.ts`** :

- `SelectionFrameHandle` n'expose aucune méthode d'observation de son état de geste — `csMachine`
  (actif/still/dragging/resizing/rotating) reste strictement interne à `selection-frame.ts`, jamais
  souscrit de l'extérieur (vérifié : aucun `actor.subscribe` dans le fichier).
- `LibreAdapter.onApplied` signale « un delta vient d'être appliqué », pas « le geste vient de
  commencer » ni « le geste vient de se terminer ».
- `createMinimalAnchor` (ce que `scene-player-bridge.ts::selectItem()` construit et partage
  aujourd'hui) n'a pas de notion de geste du tout — seulement `canAct()`/`getNode()`.

Chantier 2 (« un rebuild ne démarre jamais tant qu'un geste est actif », « le remplacement de frame
attend `idle`/`still` ») et Chantier 3 (« un seul commit par phase, pas par micro-geste ») dépendent
tous les deux d'un signal que `scene-player-bridge.ts` peut lire : *« un geste est-il actif sur cet
item, en ce moment »*. Ce signal n'existe pas encore côté bridge. C'est le premier problème à
résoudre, avant tout câblage de rebuild/commit.

---

## 2. Décision de conception à trancher avant d'écrire du code

Deux façons de faire remonter ce signal à `scene-player-bridge.ts`. Aucune n'est un détail —
`SelectionFrameHandle` est un contrat public consommé ailleurs (au minimum ce pont), le choix
engage la forme de ce contrat.

### Option A — étendre `SelectionFrameHandle` avec une méthode d'observation

`SelectionFrameHandle` gagne `subscribeToGestureActive(cb: (active: boolean) => void): () => void`,
branchée sur `actor.subscribe()` (le `csMachine` interne à `selection-frame.ts`) : `active` vrai dès
que la machine est dans `active.dragging`/`active.resizing`/`active.rotating`, faux sinon (y compris
`active.still` et `suspended`). `LibreAdapter` n'a rien à exposer de plus — le geste est piloté par
`SelectionFrame` (les poignées/l'aiguille lui appartiennent), `LibreAdapter` ne fait qu'exécuter les
deltas qu'on lui donne.

- Avantage : ne touche pas au contrat `TrackedTarget`/`TrackedSession` de la couche commune (Chantier
  1 reste inchangé) — c'est une addition locale à `SelectionFrameHandle`, dans le même esprit que
  `getNodePose` a été ajouté à `AuthorApi` (additive, pas de rupture).
- Inconvénient : encore une méthode d'observation ad hoc sur UN SEUL des 5 modules — si
  `MultiSelectionFrame`/`ZoneEditor` ont un jour besoin du même signal côté app, il faudrait la
  répliquer, pas la réutiliser (retour partiel au risque que Chantier 1 vient d'éliminer pour le
  node-tracking).

### Option B — le geste rejoint la couche commune : `SelectionFrame` déclare ses gestes sur la session partagée, pas seulement sur `csMachine`

`scene-player-bridge.ts::selectItem()` construit une **session complète** (`createTrackedSession`,
pas `createMinimalAnchor`) avec le vocabulaire de gestes du cs (`move`/`resize`/`rotate`/`scale`),
partagée entre `LibreAdapter` et `SelectionFrame` exactement comme l'ancrage l'est aujourd'hui
(`TrackedSession` est structurellement un `TrackedTarget` — `LibreAdapter`/`SelectionFrame` continuent
de fonctionner sans changement sur ce plan). `SelectionFrame` continue de piloter son propre
`csMachine` pour son rendu interne (poignées, capacités, mode création — inchangé, précédent de
l'Étape 2), mais à chaque `DRAG_START`/`DRAG_END`/`RESIZE_START`/... envoyé à `csMachine`, envoie
**aussi** `session.startGesture(kind)`/`session.endGesture(kind)` sur la session partagée (si
l'ancrage reçu en est une — cf. §2.3).

- Avantage : le signal vit dans la couche commune (`tracked-session.ts`), pas dans un contrat
  spécifique à `SelectionFrame` — `isGestureActive()`/`onSuspend()` existent déjà, testés, depuis
  Chantier 1. Si `MultiSelectionFrame`/`ZoneEditor` sont un jour câblés dans `ed2`, le même mécanisme
  s'applique sans rien ajouter.
- Inconvénient : `SelectionFrameOptions.anchor`/`LibreAdapterOptions.anchor` sont aujourd'hui typés
  `TrackedTarget` (pas `TrackedSession`) — accepter optionnellement le sur-ensemble `TrackedSession`
  et détecter les méthodes de geste (`'startGesture' in anchor`) est un peu plus de surface de type
  qu'Option A, pour un module (`SelectionFrame`) qui n'en a besoin que parce que le **bridge**, pas
  lui-même, veut observer ses gestes.

### Recommandation

Option B — le signal doit vivre dans la couche commune, pas devenir une sixième méthode ad hoc sur un
seul module, symétrique à la décision déjà actée pour le node-tracking (Chantier 1, « couche d'appel
possédée », `2026-07-16-authoring-shared-tracking-layer-plan.md` §2). Reste un point à valider par
l'auteur avant implémentation (cf. §2.1 de ce fichier).

**Point à trancher avec l'auteur avant d'écrire du code.**

---

## 3. Chantier 2 — ordonnancement rebuild ↔ geste (dépend de §2)

Une fois le signal choisi et câblé (`session.isGestureActive()` accessible depuis
`scene-player-bridge.ts`) :

### 3.1 Un rebuild ne démarre jamais pendant un geste actif

Aujourd'hui implicite (le debounce 250ms de `persistOffset` ne réarme jamais tant qu'un
`pointermove` continue d'arriver). À rendre explicite : `persistOffset`/le déclenchement de
`RUN_TRANSACTION` doit lire `session.isGestureActive()` — dernière garde avant l'écriture, pas
seulement une coïncidence de timing. N'introduit pas de nouveau comportement observable dans le cas
normal (le debounce empêche déjà cette fenêtre) — c'est une garantie structurelle qui remplace une
garantie accidentelle.

### 3.2 Le remplacement `frame`/`adapter` attend `idle`/`still`

`selectItem()` fait aujourd'hui `frame?.destroy(); frame = null` puis reconstruit immédiatement,
inconditionnellement — y compris si un geste est en cours au moment de l'appel (cas : rebuild
déclenché par un AUTRE item pendant qu'un geste tourne sur celui-ci — rare mais possible dès qu'il y
a plusieurs items édités en rafale). Avec la session partagée, `selectItem()` doit attendre
`!session.isGestureActive()` (ou consommer `session.onSuspend`) avant de détruire l'ancien
frame/adapter — pas un `.then()` aveugle sur la promesse de `rebuild()`.

### 3.3 Un `pointerdown` pendant un rebuild en vol n'ouvre pas de nouveau geste

`ed2` sait déjà, par construction, quand un rebuild est en vol (`rebuild()` est `async`, le bridge
`await`e `studio.load()`). Pendant cette fenêtre, tout `pointerdown` qui démarrerait un nouveau geste
sur le frame en cours de remplacement doit être coupé — via le point d'abort externe de
`gesture-session.ts` (déjà construit, Chantier 1 §2.5 : `GestureSessionHandle.abort()`), appelé par
la session partagée quand elle transite vers `suspended` (le node disparaît réellement le temps du
destroy+remount) — **jamais un nouveau flag/verrou ajouté dans `scene-player-bridge.ts`**, c'est
exactement le mécanisme déjà prévu pour ce cas.

### Ce que ce chantier ne touche pas

- Le rebuild complet (destroy+remount) — décision déjà actée (plan parent §5, « Ce que ce chantier ne
  doit pas faire »).
- `packages/codplay`.

---

## 4. Chantier 3 — fin de phase de manipulation (dépend de §2, coordonne avec §3)

### 4.1 Distinction déjà lisible une fois §2 câblé

- **Fin de micro-geste** : `active.<geste> → active.still` sur la session partagée — signal déjà
  disponible (`session.endGesture(kind)` vient d'être appelé).
- **Fin de phase** : l'utilisateur a fini d'éditer cet item — changement de sélection (`SELECT_ITEM`
  vers un autre id, `CLEAR_SELECTION`), `Échap`, clic hors du CS, ou inactivité au-delà d'un délai
  après le dernier micro-geste.

### 4.2 Mécanique de flush

- Sur `active.<geste> → active.still` (fin de micro-geste), armer un flush différé (même pattern que
  `sequence-editor/mount.ts::onUp` — délai court, réarmé si un NOUVEAU micro-geste démarre avant
  d'expirer).
- Un enchaînement resize→still→rotate (sans jamais repasser par `suspended`) ne doit **pas** produire
  de commit intermédiaire — le flush différé, réarmé à chaque nouveau `<geste>_START`, couvre déjà ce
  cas naturellement (pas de logique supplémentaire à écrire, conséquence directe de la session unique
  du chantier 1).
- Fin de phase explicite (changement de sélection, Échap, clic hors CS) : flush immédiat, pas
  d'attente du délai — ces événements sont déjà observables côté `controller-machine.ts`
  (`SELECT_ITEM`, et `CLEAR_SELECTION` s'il existe déjà ; à vérifier à l'implémentation) ou côté DOM
  (`Échap`/clic hors CS, à câbler si absent).

### 4.3 Remplace `persistOffset`'s debounce actuel

Le `setTimeout(persistOffset, 250)` réarmé à chaque `onApplied` (`scene-player-bridge.ts:158-160`)
est remplacé par ce mécanisme — pas ajouté à côté. Un seul chemin de déclenchement du commit.

---

## 5. Ordre d'implémentation

1. Valider §2 (choix Option A/B) avec l'auteur.
2. Câbler le signal choisi — testé en isolation (`selection-frame.spec.ts` ou `tracked-session.spec.ts`
   selon l'option retenue) avant tout câblage côté `scene-player-bridge.ts`.
3. Chantier 2 (§3) : rebuild-gating, frame-replacement-gating, pointerdown-during-rebuild.
4. Chantier 3 (§4) : flush différé + fin de phase explicite, remplace `persistOffset`.
5. Test manuel Safari décisif : resize → rotate → move enchaînés rapidement (sans pause), **un seul**
   rebuild/commit à la fin de la séquence — pas un par outil. Puis la même séquence avec un rebuild
   externe (déclenché par un AUTRE item) survenant pendant un geste sur celui-ci — pas de
   repositionnement erroné, pas de frame orphelin.

## 6. Ce qui ne bouge pas

- Le rendu propre à chaque module, les calculs de geste — inchangés (même périmètre que Chantier 1
  §4).
- `packages/codplay`.
- Le contrat `AuthorApi`/`PlayerApi` posé pour `getNodePose` — sans rapport avec ce chantier.
