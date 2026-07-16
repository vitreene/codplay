# selection-frame — couche commune de suivi de node + cycle de vie de geste

Plan précis, pas de code à ce stade. Sous-chantier de
`2026-07-16-gesture-rebuild-ordering-plan.md` §3-4 (« Chantier 1 ») — l'analyse et la justification
(pourquoi, quelle duplication, quel risque déjà réalisé) restent dans ce document parent ; celui-ci ne
couvre que le **comment**, étape par étape.

**Portée** : `packages/authoring/selection-frame` uniquement. `packages/codplay` et le reste de
`packages/editor` (bridges, machine centrale) ne sont pas touchés ici — ils sont le sujet des
chantiers 2/3 du plan parent, qui consommeront le résultat de ce sous-chantier sans le modifier.

---

## 1. Rappel du problème que ce sous-chantier ferme

Cinq modules (`LibreAdapter`, `SelectionFrame`, `FlexAnchorTool`, `ZoneEditor`,
`MultiSelectionFrame`) ré-implémentent chacun, séparément, le patron « s'abonner à
`authorApi.subscribeToNode`, garder une référence locale, réagir à son changement » —
détail complet et localisation exacte dans le plan parent §3.1. Deux d'entre eux (`csMachine`,
`zoneMachine`) sont en plus la même machine XState écrite deux fois (§3.2). Un précédent documenté
dans `multi-selection-frame.ts` (lignes 112-117, audit 2026-07-10) montre que cette duplication a déjà
produit un bug de robustesse réel (`lostpointercapture`), corrigé à moitié (la plomberie pointeur a
été unifiée, pas le suivi de node).

Ce sous-chantier livre la couche commune qui élimine cette duplication, sans fusionner les 5 modules
ni changer leur rendu/logique métier propre.

---

## 2. Contrat de la couche commune

### 2.1 Deux fabriques, pas une seule — la distinction "session complète" / "ancrage minimal" est un
premier choix de conception, pas un détail

Tranché dans le plan parent (§4) :

- **Session complète** (suivi de node + machine de cycle de vie avec sous-états de geste) — pour
  `SelectionFrame`, `MultiSelectionFrame`, `ZoneEditor`. Porte 1..N cibles (`persoId`).
- **Ancrage minimal** (suivi de node + décision « puis-je agir », sans sous-états de geste) — pour
  `FlexAnchorTool` et `LibreAdapter`. `LibreAdapter` n'a pas de geste propre à déclarer (il exécute des
  deltas produits par la session complète d'un autre module — `SelectionFrame`) ; il a seulement besoin
  de savoir, à chaque appel `applyMove`/`applyResize`/`applyRotate`, si l'état courant l'y autorise.

Les deux fabriques partagent le même suivi de node en interne (2.2) — seule la présence ou non de la
machine à sous-états les distingue.

### 2.2 Suivi de node (commun aux deux fabriques)

Pour chaque `persoId` déclaré à la construction :

- ouvre un abonnement `authorApi.subscribeToNode(persoId, ...)` ;
- garde le node courant, exposé comme accès direct (`getNode(persoId)`) et comme flux
  (`subscribe(cb)`) ;
- expose un état `isConnected`-safe — jamais un node détaché présenté comme valide (c'est
  exactement le correctif déjà fait ponctuellement sur `pinToResolvedPx`, désormais porté une fois ici
  plutôt que ré-appliqué module par module) ;
- ne déclenche **aucun** effet de bord visuel lui-même — il notifie, l'appelant décide (préserve la
  diversité : chaque module sait ce que « repositionner » veut dire pour lui, la couche ne le sait
  pas).

Pour une session à N cibles (`MultiSelectionFrame`), le suivi de node reste **par item** (un
abonnement, un état par `persoId`), mais la session expose un agrégat (« au moins un item présent »)
au même sens que le `anyPresent` actuel de `multi-selection-frame.ts:193`.

### 2.3 Machine de cycle de vie (session complète seulement)

Squelette unique, extrait de `csMachine`/`zoneMachine` (identiques à un vocabulaire d'événements
près — plan parent §3.2) :

```
idle ──(node présent)──▶ active
  active.still ──(<geste>_START, garde capability)──▶ active.<geste>
  active.<geste> ──(<geste>_END)──▶ active.still
  active ──(node absent)──▶ suspended
  suspended ──(node présent)──▶ active
```

Le vocabulaire des `<geste>` (`DRAG`/`RESIZE`/`ROTATE` pour le cs, `MOVE`/`RESIZE`/`TRACE` pour la
zone) reste un paramètre de construction — pas figé dans le squelette. Les gardes de capacité
(`canMove`/`canResize`/`canRotate` dans `machine.ts:79-92`) restent aussi de la responsabilité de
l'appelant : le squelette commun ne connaît pas le vocabulaire de capacités d'un outil donné.

### 2.4 La décision « puis-je agir »

Point d'interrogation unique, dérivé de l'état de la machine (session complète) ou de l'état
`isConnected` seul (ancrage minimal) :

- vrai si le node est présent et attaché, et (pour une session complète) que la machine n'est pas
  `suspended` ;
- faux sinon.

Exposé à la fois en interrogation ponctuelle (avant d'écrire sur le DOM, ex. dans
`LibreAdapter::applyMove`) et en abonnement (pour que `gesture-session.ts`, §2.5, puisse réagir à un
changement).

### 2.5 Point d'abort externe pour `gesture-session.ts`

Aujourd'hui (`gesture-session.ts`), une session ne s'arrête que sur `pointerup`/`pointercancel`/
`lostpointercapture`/un `pointermove` avec `buttons===0`. Il manque un moyen pour la couche commune de
dire « arrête-toi maintenant, indépendamment de l'état du pointeur natif » — nécessaire pour que la
transition `active → suspended` (node disparu pendant un geste, cas central de la race condition,
plan parent §1.2-1.3) coupe réellement la session en cours plutôt que de la laisser produire des
deltas dans le vide.

Changement précis à `bindGestureSession` : le handle qu'elle retourne doit exposer une méthode
d'abandon externe, appelée par la couche commune sur la transition vers `suspended` — en plus des
canaux natifs existants, jamais à la place.

---

## 3. Ordre de migration — module par module, du plus simple au plus risqué

Chaque étape est validable et déployable seule (pas besoin d'attendre la fin du sous-chantier pour
observer une amélioration mesurable) — pas un big-bang sur les 5 fichiers à la fois.

### Étape 0 — construire la couche commune en isolation, sans rien migrer

Nouveau(x) module(s) internes à `packages/authoring/selection-frame/src/` (nommage exact à trancher à
l'implémentation — ex. `tracked-session.ts` pour le suivi de node + fabrique de session, ou scindé en
deux fichiers si la distinction session complète / ancrage minimal le justifie). Tests unitaires
dédiés, contre un `authorApi` de test (déjà le patron utilisé par `machine.spec.ts`/
`zone-editor.spec.ts`) — aucune dépendance sur les 5 modules existants à ce stade, code mort du point
de vue de l'app.

**Validation** : tests unitaires de la couche seule — comportement de suivi de node (apparition,
disparition, `isConnected`), transitions de la machine extraite (comparées aux transitions actuelles
de `csMachine`/`zoneMachine`, doivent produire des séquences d'états identiques pour les mêmes
événements), décision « puis-je agir » dans chaque cas.

### Étape 1 — migrer `LibreAdapter`

Le plus contenu (pas de rendu, pas de machine propre aujourd'hui), et celui dont le bug corrigé
pendant l'investigation (`pinToResolvedPx`) est le plus directement lié à ce sous-chantier — la
migration remplace le correctif ponctuel (`if (!node.isConnected) return`) par un usage réel de la
couche commune (ancrage minimal).

**Validation** : `tests/adapters.spec.ts` (existant) doit continuer de passer sans modification de son
contrat observable — c'est un refactor interne, pas un changement de comportement pour l'appelant.
Test manuel Safari : reproduire le scénario qui produisait `width:8px`/`0px` (drag → persist → rebuild
→ re-drag rapide) et confirmer l'absence de régression déjà obtenue, cette fois via la couche commune
plutôt que le correctif local.

### Étape 2 — migrer `SelectionFrame`

Plus gros morceau : `SelectionFrame` possède aujourd'hui sa propre instance `csMachine` (`machine.ts`)
et son propre suivi de node (`handleElementNode`). Il devient consommateur d'une session complète de
la couche commune au lieu d'instancier sa machine en propre. Point de câblage à ajuster côté
`scene-player-bridge.ts::selectItem()` (`scene-player-bridge.ts:118-164`) : `LibreAdapter` et
`SelectionFrame` doivent désormais partager **une seule** session (même `persoId`), construite une
fois et transmise aux deux — plutôt que deux abonnements séparés comme aujourd'hui.

`positionCs()` (appelée depuis `handleElementNode`, `selection-frame.ts:1512`) doit désormais être
gardée par la décision « puis-je agir » de la session, pas appelée inconditionnellement — c'est le
correctif central de ce sous-chantier, celui qui ferme réellement §1.2-1.3 du plan parent.

Le `ResizeObserver` (`selection-frame.ts:1495-1505`) et son garde `isActive()` existant doivent lire
le même état partagé que `positionCs()`, pas leur propre logique séparée.

**Validation** : `tests/selection-frame.spec.ts` (existant, couvre aussi `MultiSelectionFrame` — voir
étape 3) doit continuer de passer. Test manuel Safari : la séquence complète qui a révélé le bug
(resize → pause > 250ms pendant qu'un rebuild est possiblement en vol → rotation) ne doit plus
produire de repositionnement erroné ni de perte de rotation — c'est le test de non-régression décisif
pour ce sous-chantier, à mener une fois cette étape posée, avant de continuer vers 3-5.

### Étape 3 — migrer `MultiSelectionFrame`

Généralise l'usage à une session N cibles, qui existe déjà dans la couche commune depuis l'étape 0 —
cette étape est surtout une preuve que la généralisation 1..N (plan parent §4, section « Une session
par outil actif ») tient en pratique, pas une nouvelle conception.

**Validation** : `tests/selection-frame.spec.ts` (couvre `createMultiSelectionFrame`) doit continuer
de passer. Test manuel Safari : geste de déplacement sur une multisélection pendant/juste après un
rebuild déclenché par un autre item.

### Étape 4 — migrer `ZoneEditor`

`zoneMachine` (`zone-machine.ts`) devient une spécialisation du squelette commun (vocabulaire
`MOVE`/`RESIZE`/`TRACE`) au lieu d'une redéfinition complète. Le suivi de `containerNode`
(`zone-editor.ts:400`) passe par la couche commune.

**Validation** : `tests/zone-editor.spec.ts` et `tests/zone-editor-gestures.spec.ts` (existants)
doivent continuer de passer.

### Étape 5 — migrer `FlexAnchorTool`

Dernier, parce que c'est le seul des cinq qui utilise le mode « ancrage minimal » (§2.1) — le valider
en dernier confirme que ce mode, conçu sur le papier aux étapes 0-1, couvre réellement un usage
distinct (clic seul, deux cibles suivies — élément et conteneur, `flex-anchor-tool.ts:156-166`) sans
avoir eu besoin d'être retouché entre-temps.

**Validation** : `tests/flex-anchor-tool.spec.ts` (existant) doit continuer de passer.

---

## 4. Ce qui ne bouge pas dans ce sous-chantier

- Le rendu propre à chaque module (poignées du cs, points de l'outil flex, tracé des zones) — inchangé.
- Les calculs de geste propres à chaque module (delta de transform libre, alignement flex, géométrie
  de zone) — inchangés.
- `scene-player-bridge.ts::rebuild()`/`persistOffset` — la logique de rebuild elle-même n'est pas
  touchée ici ; seul le point de construction de `LibreAdapter`+`SelectionFrame` dans `selectItem()`
  change (une session partagée au lieu de deux abonnements séparés), préparant le terrain pour le
  chantier 2 sans l'implémenter.
- `packages/codplay` — non lu, non modifié (contrainte reconduite du plan parent).

---

## 5. Risques spécifiques à cette migration

- **Parité de comportement** : chaque étape doit faire passer les tests existants du module concerné
  sans modification de leur contrat observable — c'est un refactor, la seule différence de
  comportement voulue est le nouveau garde (ne pas agir sur un node incohérent), qui n'a par
  construction aucun test existant puisqu'il n'existait pas avant. Prévoir un test nouveau, par
  module migré, qui vérifie spécifiquement ce garde (node suspendu → aucun effet de bord) — pas
  seulement la non-régression de l'existant.
- **Hypothèse d'exclusivité des outils** (« un outil actif à la fois », tranché dans le plan parent) —
  si elle s'avère un jour fausse (deux outils actifs simultanément sur la même cible), la couche
  commune telle que conçue ici ne l'arbitre pas et le symptôme réapparaîtrait sous une autre forme.
  Sans conséquence pour ce sous-chantier tant que l'hypothèse tient dans l'UI actuelle — à revérifier
  si un nouveau mode d'édition composite apparaît.
- **`FlexAnchorTool` en dernier** : si son mode « ancrage minimal » s'avère insuffisant à l'usage
  (besoin découvert d'un sous-état de geste après tout), les étapes 0-1 devront être révisées a
  posteriori — accepté comme risque contenu (une seule étape à refaire, pas les cinq).

---

## 6. Definition of done

- Les cinq modules consomment la couche commune ; aucun n'appelle plus `authorApi.subscribeToNode`
  directement, aucun n'instancie plus sa propre machine de cycle de vie en doublon d'un autre.
  `csMachine`/`zoneMachine` restent, mais comme spécialisations déclarées du squelette commun, pas
  comme définitions indépendantes.
- Tous les tests existants des 5 modules passent sans modification de contrat, plus un test par
  module validant explicitement le nouveau garde.
- Test manuel Safari décisif (étape 2) : séquence resize → pause → rotation sans repositionnement
  erroné ni perte de rotation, reproductible plusieurs fois de suite.
- Le plan parent (`2026-07-16-gesture-rebuild-ordering-plan.md`) peut alors s'appuyer sur cette
  couche pour les chantiers 2 (ordonnancement rebuild) et 3 (fin de phase) sans redécouvrir ce
  travail.
