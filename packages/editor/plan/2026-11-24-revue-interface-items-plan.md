# Revue de l’interface items — plan de travaux

**Statut : Fixe** (plan accepté par l’utilisateur le 24 novembre 2026 ; exécution par tranches). Plan dédié aux points de la revue de code du 24 novembre 2026.
Il sera supprimé en fin de travaux, une fois chaque comportement vérifié reporté
dans sa spec propriétaire : [intégration](../specs/editor-v2-integration-spec.md),
[présentation](../specs/item-presentation-spec.md),
[orientation](../specs/path-tangent-orientation-spec.md) et
[interpolation](../specs/decor-style-interpolation-spec.md).

Périmètre : `src/app/bridges/` (surtout `decor-editor-bridge.ts`),
`src/decor-editor/`, `src/item-presentation/`, `src/motion-editor/`,
`src/app/commands/` et la résolution de décor de `src/builder-v2/`. Aucun
changement de `packages/codplay` ni des paquets partagés.

**Règle d’acceptation** : tout point qui touche l’interface est testé dans le
navigateur par Safari MCP, sur l’application Editor réelle. Le point n’est accepté
qu’après la revue manuelle et visuelle de l’utilisateur, qui suit ce test.

## Décisions

| Id | Décision | Statut |
| --- | --- | --- |
| D-A | Les gestes (angle au début du geste, découpe d’un waypoint, tangente) utilisent la fenêtre de transition du player, `resolveKeyframeTransition` (`builder-v2/keyframe-transition.ts`). Le pont supprime sa copie de l’easing (`resolveMotionEasing`) et sa progression calculée sur tout l’intervalle KF→KF. | Acceptée |
| D-B | Entre deux KF de pose, la rotation suit le plus court chemin. Un changement d’orientation entre deux KF ne produit jamais de saut brut de 180°. Les valeurs stockées restent normalisées dans [−180°, 180°). Rotations multi-tours : future option volontaire de l’interface, hors de ce plan. | Acceptée |
| D-C | Règle de contrat : éditer le décor d’un KF crée un nouveau décor pour porter la modification, dès que le décor attaché n’appartient pas en propre à ce KF (il est aussi utilisé par un autre KF, par le décor initial d’un item ou par `rootDecorId`). Une seule implémentation pour toutes les commandes, en remplacement des trois définitions actuelles (E6). Écart constaté : le pont ne crée pas ce décor quand l’autre utilisation est le décor initial ; un commentaire de code (non spécifié) invoque une exception « le premier KF partage volontairement `initialDecorId` ». **Exception retenue** : le premier KF de pose est toujours l’intro et modifie le décor initial. Elle se limite à ce KF ; aujourd’hui le pont l’applique à tous. Si un autre KF partage aussi ce décor initial, c’est lui qui reçoit d’abord sa copie, pour ne pas changer quand on édite l’intro. | Acceptée |
| D-E1 | Une exception de commande est un défaut : elle reste un arrêt, mais devient immédiatement visible dans l’interface (commande, message), sans état figé silencieux. Le défaut qui la provoque est corrigé (contrôle non désactivé, validation absente). | Acceptée |
| D-E2 | `Decor.zoneId` est une référence d’usage : l’item utilise une zone de son parent. Changer de parent libère les références aux zones de l’ancien parent. Après un déplacement dans la timeline, l’item suit le placement logique de la capsule (par ex. une rangée l’attribue selon l’ordre) ; une attribution faite par l’auteur le sort du placement automatique. Ce comportement correspond au modèle de Capsule Automation : placement explicite, ou placement automatique selon l’ordre (politique `auto`/`mixed`), ou zone fantôme pleine surface pour `card` (`explicit-only`). **Manque de contrat** : le document ne sait pas distinguer « automatique » d’« explicite » (`zoneId` absent ou `null` signifie aujourd’hui « surface pleine »), et le repli de `setCapsuleDef` écrit un `zoneId` explicite à chaque enfant. **Représentation retenue pour commencer** : `zoneId` absent = placement automatique par Capsule Automation ; `zoneId` présent = attribution explicite par l’auteur ; la pleine surface reste le comportement `card` (zone fantôme). Le repli de `setCapsuleDef` cesse d’écrire des `zoneId`. La « zone libre » et les autres types de placement pourront avoir leurs propres règles, à ajuster à l’usage. | Acceptée ; à réviser à l’usage |
| D-E7 | Le tracé d’une plage conserve les décors des bornes remplacées. | Acceptée |
| D-B2 | Une capsule est un item avec les mêmes caractéristiques que les autres : ses KF de pose et de décor sont compilés de la même façon, son composant `list` reçoit la même présentation Editor (`createItemComponent`) et son CS suit la même projection, sans branche dédiée dans le pont. | Acceptée |
| D-VIS | Masquer un item est une étape d’édition, pas une suppression : les positions des autres items ne bougent pas (rang de placement automatique, compte des grilles dérivées, distribution du temps) ; l’item masqué n’a pas besoin d’être rendu. **Approche retenue : `visibility:hidden`**. Le Builder compile l’item masqué comme les autres et lui ajoute une classe de cadre `visibility:hidden` ; il n’a plus de filtre de visibilité. Une capsule masquée masque son sous-arbre par héritage de la propriété. Aucune contradiction à gérer : l’item garde sa place dans la grille et dans le temps, comme dans la timeline. Aucun changement de Capsule Automation. Conséquences : (1) les items masqués sont validés et comptés dans `preRollMs` ; (2) **un item média masqué doit être silencieux** (décidé) : `visibility:hidden` ne coupe pas le son, le Builder doit donc aussi le couper. Le composant média de CodPlay connaît `muted` et `volume` comme propriétés d’une transition média ; l’existence d’un état initial `muted` n’est pas vérifiée. À qualifier à l’implémentation : si la surface actuelle ne suffit pas, c’est une demande de modification de CodPlay, soumise aux portes d’AGENTS.md (justification, absence d’alternative côté Editor, autorisation) ; (3) les tests et la spec d’intégration qui décrivent le retrait de la `SceneDoc` sont à réécrire avec l’implémentation. | Acceptée ; mise en œuvre du silence à qualifier |
| D-R | Refonte du pont Décor (lot 3). | A relire |

## Preuves acquises

- **B** : constaté dans Safari MCP, sur une scène de test supprimée ensuite. KF à
  0 ms = 167° et KF à 2 500 ms = 193°, enregistré −166°. À 1 250 ms, la rotation
  présentée vaut 0,5° au lieu d’environ 180,5° (`rotate(0.5deg)` sur le
  Selection Frame : cadre 167°, ancre −166,5°).
- **A** : écart constaté à la lecture du code
  (`decor-editor-bridge.ts`, `resolveMotionEasing`, `authoredRotationAtGestureStart`,
  `resolveTangentGestureProjection`, `splitProgress`). Il ne peut pas être reproduit
  depuis l’interface : aucun contrôle ne crée de transition de KF. Le défaut ne
  touche que les documents qui portent déjà une transition.
- **D-C** : constaté dans Safari MCP. Un KF créé depuis la timeline partage
  `initialDecorId`. Le geste de rotation sur ce KF a écrit dans le décor initial,
  car `isDecorSharedByAnotherReference` ne compte pas `initialDecorId` hors du
  champ `path`.

## Action transverse — spec Capsule Automation

**Faite** : [`capsule-automation-spec.md`](../../authoring/capsule-automation/specs/capsule-automation-spec.md)
(29 tests verts). Référence du placement automatique pour D-E2.

**Point examiné pour D-E2, sans suite** : le placement automatique ne dépend que
du rang de l’enfant et ignore les cases occupées par un placement explicite. Une
zone étant un placement CSS dans une grille, plusieurs items peuvent occuper la
même zone : ce recouvrement est un usage normal, aucune règle d’évitement n’est
nécessaire. D-E2 n’en dépend pas.

## Lot 0 — Base de tests verte (prérequis)

8 tests échouent sur `HEAD`. Avant toute modification, qualifier chaque échec :
test périmé, ou défaut du code.

1. `tests/builder-v2/tangent-reference.spec.ts:156` attend que `snapshot.get()`
   contienne la preview, alors que la [façade V2](../../codplay/specs/facade-v2-spec.md)
   l’exclut. Aligner le test sur la spec.
2. `tests/scene-player-bridge-v2.spec.ts:522` lit un `rotate()` dans la
   transformation du Selection Frame, qui n’en contient plus (`NaN`). Lire l’angle
   depuis la matrice.
3. Les six autres (`root-placement-commands`, `base-commands` assignType,
   `decor-editor-field-state` zone, `decor-editor-strip-inherited` zone,
   `decor-properties-stress` ×2) correspondent aux échecs connus du plan
   [décisions](./decisions-a-prendre.md) (zones, valeurs de décor, offset vide).
   Vérifier la correspondance, puis décider au cas par cas avant de corriger.

**Acceptation** : `npx vitest run` et `npx tsc --noEmit` passent depuis
`packages/editor`, ou chaque échec restant est rattaché à une décision ouverte.

**Fait** (601 tests verts, typecheck propre ; aucun fichier source modifié, huit
tests corrigés) : les huit échecs étaient des tests périmés.
- `zone` → `zoneId` : le champ désigne l’identité stable de la zone
  (`decor-editor-field-state`, `decor-editor-strip-inherited`, `decor-properties-stress`),
  et `resolveCurrentPatch` n’a plus de paramètre de scène.
- `decor-properties-stress` : les zones d’item sont compilées (le diagnostic
  `EDITOR_V2_ZONE_DEFERRED` ne concerne plus que le décor racine) et la scène
  compte une cible de zone.
- `base-commands` et `root-placement-commands` : `createItem` n’écrit plus
  d’`offset` vide (depuis le 1ᵉʳ novembre 2026).
- `tangent-reference` : `snapshot.get()` ne contient pas la preview active
  ([façade V2](../../codplay/specs/facade-v2-spec.md)).
- `scene-player-bridge-v2` : le Selection Frame écrit sa projection affine en
  `matrix(...)`. Limite : dans l’environnement de test, la pose terminale est
  l’identité, donc la comparaison de rotation y est faible ; la preuve réelle reste
  le parcours Safari MCP de la spec d’orientation.

## Lot 1 — Rotation au plus court chemin (D-B)

Propriétaire : le Builder Editor. La correction n’a besoin ni de la refonte ni
d’un nouveau circuit.

1. `builder-v2/build-scene.ts`, `buildStyleTransition` : pour `rotate` numérique,
   prendre comme cible du tween `from + delta`, avec
   `delta = normalizeAngleDegrees(to − from)`. Le décor et la valeur logique de
   fin restent normalisés.
2. Utiliser la même règle partout où l’éditeur interpole lui-même un angle
   entre deux KF : `authoredRotationAtGestureStart` dans
   `decor-editor-bridge.ts` aujourd’hui, puis la résolution partagée du lot 3.
3. Mode tangente : ne pas modifier la compensation `rotateOffset` existante.
   Vérifier seulement l’absence de régression.

**Invariants** : angles stockés normalisés, cqw, `move` et horloge inchangés,
pas de lecteur temporel ajouté, alignement du CS et de l’item, scale constant
pendant la rotation.

**Acceptation** :
- régression Builder : 167° → −166° donne un tween qui passe par environ 180,5°
  au milieu du segment ;
- non-régression des tests tangente et motion-path ;
- Safari MCP : même scénario que la preuve B, en Seek et en Play, avec CS
  aligné ; Undo/Redo et rechargement SQLite.

## Lot 2 — Points bénins hors refonte

À traiter seulement si le code concerné n’est pas réécrit au lot 3.

1. `DecorEditorController` et `decor-editor/machine.ts` : retirer l’API jamais
   appelée (`setChain`, `applyCard`, `setZones`, `setVisualPosition`,
   `setZoneMode`, `getResolvedDecors`, `setContext`) et l’état jamais lu
   (`visualPosition`, `zoneMode`, `CHAIN.SET`). Vérifier ensuite que
   `defaults`/`chain`/`zones` d’`AttachItemInput` restent utiles.
2. `sequence-editor-bridge.ts:133` : corriger le commentaire, qui cite
   `patchDiffersFromBase` alors que cette fonction n’est plus appelée.
3. `scene-selection.ts` et `applyFrameDelta` : une seule inversion de matrice
   partagée (`motion-editor/geometry.ts`).
4. `scene-player-bridge.ts` : factoriser le nettoyage d’échec du rebuild
   (feuille de style, ressources, journal) et la garde répétée de
   `startPlayback`.
5. Écriture sans changement : voir E3 (cause établie).

**Acceptation** : tests et typecheck verts, aucun changement de comportement.

**Avancement du lot 2** (597 tests verts, typecheck et build propres) :
- Points 1, 2 et 3 faits. Point 1 : les sept méthodes et les trois éléments de
  machine sont retirés, ainsi que `getZones`/`onZonesChange` du contrôleur, que ce
  retrait rendait orphelines ; les tests de la machine qui exerçaient les
  événements supprimés sont retirés, ceux du rattachement gardent la vérification
  du panneau actif. Point 3 : `ace` fournit déjà `invertMatrix` (même seuil) :
  `scene-selection.ts` et `applyFrameDelta` l’utilisent, sans nouvelle fonction.
  Vérifié dans Safari MCP (en attente de revue manuelle) : le clic de sélection
  par la pose présentée, et un redimensionnement sous rotation (≈ −90°, déplacement
  de souris +36/+24 px → −24 en largeur, +36 en hauteur) annulé par Échap sans
  écriture.
- Point 4 reporté : le nettoyage de `scene-player-bridge.ts` est remplacé par la
  machine M5 (tranche 4 du lot 3).
- Point 5 reporté : voir E3, tranche 2 du lot 3.
- Vérification demandée au point 1 : le pont passe toujours `defaults: {}`,
  `chain: []` et `zones: []` à `attachItems`. `defaults` et `chain` ne servent donc
  à rien en pratique, et `zones` non plus. Les retirer (avec `resolveDecor`, la
  table de zones et ses tests) est une suite possible, non faite.

**Nettoyage du code mort (lot 2b, décidé par l’utilisateur)** : 579 tests verts
(18 tests retirés avec le code qu’ils couvraient), typecheck et build propres.
Comparaison Safari MCP avant/après sur la sélection d’« Tangente » : cadre
identique (62,64 × 41,76, même matrice), aucune écriture (en attente de revue
manuelle).
- Commandes jamais émises : `placeInZone` et `setRootZonesSurface` (fonctions,
  façade, union `Command`, tests).
- `sequence-editor` : `generateSnapPoints`, `clampMs` et les types hérités
  `ViewportState`, `SelectionTarget`, `InteractionState`, `SnapPoint`, `ViewMode`.
- `motion-editor` : `translateFrame`, `distanceToSegment`, `normalizeMotionControl`,
  `clampMotionDuration`, `presentationBorderBoxPoseToContentFrame`,
  `resolveMotionTransitionWindow` avec sa constante et ses types (P4 : troisième
  résolveur de fenêtre, de sémantique différente de `resolveKeyframeTransition`).
- Ancien modèle de zones et d’orientation de `decor-editor` : `zones.ts`,
  `ZoneDef`/`ZoneTable`/`ZoneCard`/`ZoneCoords`, `ZONES.SET`, contexte `zones`,
  `catalogs.cards`, `OrientationContext`, `orientationContext`, `CONTEXT.SET`,
  champs `zones` et `context` d’`AttachItemInput`.
- Vestige `DecorPatch.capsule` (les réglages de capsule sont sur l’item) : champ,
  `CapsulePatch`, groupe `capsule` de `mergePatch`, avertissement du pont.
- Trois barils jamais importés : `motion-editor/index.ts`,
  `sequence-editor/index.ts`, `decor-editor/index.ts`.
- Doublon : `multiplyAffine` et `AffineMatrix2D` de `item-style-projection.ts`
  remplacés par `multiplyMatrix` et `Matrix2D` d’`ace`.

**Fonctionnalités à construire dont le code a été retiré** (l’ancien code reste
récupérable avec `git show HEAD:<chemin>` tant que le nettoyage n’est pas commité,
puis dans l’historique) :

| Retiré (origine) | Fonctionnalité |
| --- | --- |
| `resolveMotionTransitionWindow`, `clampMotionDuration` (motion editor, 3-4 sept. 2026) | Édition des transitions de KF. Le document porte déjà `Transition` (durée, direction) et les commandes `setKeyframeTransitionIn/Out` existent, sans interface. À reconstruire avec cette interface, sur le résolveur unique de D-A. À arbitrer : fenêtre par défaut de 500 ms (code retiré) contre 400 ms (`DEFAULT_TRANSITION_DURATION_MS`). Le commentaire de `commitMotionDrop` renvoie encore à ce « futur résolveur ». |
| `distanceToSegment`, `translateFrame` (« visual move », 3 sept. 2026) | Sélection du tracé au clic et panneau secondaire d’un segment (`onPathActivate` est vide : seul le point de contrôle existe). |
| `orientationFromRatio`, `coordsForContext`, `updateZoneCoords`, `OrientationContext` (decor v1, 7 juil. 2026) | Choix de la surface de zone portrait ou paysage selon la forme de l’hôte. Le Builder ne compile que `landscape` (B3), et l’orientation reste à nommer (`portrait/landscape` contre `vertical/horizontal`). |
| `ZoneCard` et `applyCard` (decor v1) | Modèles de zones prêts à appliquer, non repris par le modèle actuel. |

**Chantiers retenus par l’utilisateur (à reprendre, hors tranches de la revue)** :

1. **Édition des transitions de KF.** Objectif : régler la durée, le type et la
   direction (`before`/`after`) de `transitionIn` et `transitionOut` depuis la
   timeline. Existant : le type `Transition`, les commandes
   `setKeyframeTransitionIn/Out`, `DEFAULT_TRANSITION_DURATION_MS`, le catalogue
   de transitions nommées de Capsule Automation. Prérequis : le résolveur unique
   du temps des segments (D-A, B1), pour que l’interface et le player lisent la
   même fenêtre ; la tranche 3 du lot 3. À décider avant de commencer : l’emplacement
   de l’interface et la durée par défaut (400 ou 500 ms). Les cas déjà refusés par le
   Builder (première intro interpolée, `EDITOR_V2_FIRST_INTRO_UNSUPPORTED`) doivent
   être rendus visibles à l’auteur. Validation : Safari MCP, puis revue manuelle.
2. **Choix de la surface de zone portrait ou paysage.** Objectif : compiler et
   afficher la surface correspondant à la forme de l’hôte (B3). Existant : le
   modèle `Zone.surfaces` (portrait et paysage), `zoneOrientation` du pont (forme de
   la pose), l’éditeur Zone qui écrit déjà les deux surfaces. Prérequis : la
   tranche 5 (Builder), et le nommage de l’orientation à figer
   (`portrait/landscape` ou `vertical/horizontal`, question ouverte du modèle de
   document). À décider : ce qui détermine l’orientation (le ratio de la scène, ou
   un réglage de scène, lié au ratio configurable prévu). Validation : Safari MCP,
   puis revue manuelle.

Remplacés, rien à reconstruire : `generateSnapPoints` par `computeSnapGrid`,
`CapsulePatch` par `CapsuleDef`, `placeInZone` et `setRootZonesSurface` par la
commande de zone du pont et `setZonesSurface({ capsuleId: null })`, les modes
`visualPosition`/`zoneMode` par les modes Zone et Bloc.

Laissés volontairement :
- `createKeyframe` : le test d’unicité des ids après restauration, cité par la spec
  du modèle de document, passe par lui, et les tests d’intégration du pont player
  s’en servent comme fixture. À retirer en tranche 1 (un seul générateur d’id, une
  seule voie de création de KF), en migrant ces tests vers `createNamedKeyframe`.
- `poseFrameToContentBoxFrame` et `resolveBorderInsetsPx` : sans appel dans `src`,
  mais leurs tests servent d’oracle à du code vivant (aller-retour de
  `contentBoxFrameToPoseFrame`, lecture des bordures). Les retirer demande de
  réécrire ces tests.
- `emptyScene()` du contrôleur de séquence : pas du code mort, c’est le document de
  repli avant le premier chargement ; à traiter avec la machine de session (M7).
- `defaults` et `chain` d’`AttachItemInput` (toujours vides), le type `ItemType`
  redéclaré dans `decor-editor/types.ts`, et la branche inutile de
  `projectItemStyle` (P3).

## Lot 3 — Refonte du pont Décor (A relire)

Objectif : réduire `createDecorEditorBridge` (une seule closure d’environ
3 000 lignes, une quarantaine de variables `let`) à une coordination de
propriétaires distincts, sans perdre les acquis vérifiés des specs.

### Constats à résoudre

- **F — responsabilités mêlées.** Le pont construit des éléments d’interface que
  la table de la spec d’intégration ne lui attribue pas : onglets, barre
  Zone/Bloc, « Placement racine » (lignes ~1000-1215). Il câble le Zone Editor,
  la projection de trajectoire, la conversion des gestes, les commits et le
  cycle de vie.
- **Phases pilotées par des booléens.** Le geste repose sur
  `frameGestureBasePx`, `frameGestureCancelled`, `snapshotCommitAwaitingPresentation`,
  `seekProjectionActive` et `lastPreviewAccepted`. Ce dernier est un canal caché
  qui ne fonctionne que parce que l’émission de `applyPatch` est synchrone. Le
  bloc de remise à zéro est copié 9 fois, avec des divergences : `onCancel` ne
  remet pas `frameCommitCandidatePx`, `syncSelection` ne remet pas
  `frameGestureCancelled`.
- **G — double cascade.** `resolveEffectiveKeyframePatch` et
  `resolveEffectivePosePatch` (pont) dupliquent `decor-resolution.ts` (Builder),
  avec une autre sémantique de fusion et un autre traitement des `null` qui
  effacent la géométrie. Quatre listes de champs sont écrites à la main (pont
  l. 399 et 554, `merge.ts`, `decor-resolution.ts:75`). `patchToContentArgs`
  recopie champ par champ les propriétés de `Content` : un nouveau champ serait
  perdu au prochain `assignContent`.
- **Deux fusions de décor.** `mergePatch` (`merge.ts`) et `applyDecorPatch`
  (`modified-properties.ts`) traitent différemment `classes` en add/remove et
  `path`. Le risque d’écraser des classes reste à qualifier par un test.
- **H — création de KF quadruplée.** `buildTemporaryDecorCommit`,
  `commitMotionDrop`, `commitZoneAssignment` et `commitZoneOffsetGesture`
  utilisent quatre préfixes d’id (`decor-kf`, `motion-kf`, `zone-kf`,
  `offset-kf`). Elles dépendent toutes de la convention implicite
  `decor-${keyframeId}` de `createNamedKeyframe`
  (`sequence-editor/commands.ts:108`), utilisée à 5 endroits dans 2 ponts. Trois
  générateurs d’id coexistent.
- **I — lectures dupliquées.** Trois analyseurs de valeurs logiques du snapshot,
  l’id runtime `${EDITOR_V2_STORY_ID}:${id}` reconstruit 11 fois, le test de
  fraîcheur à 1 ms répété environ 17 fois.
- **A** (D-A) : progression des gestes calculée hors de `resolveKeyframeTransition`.
- **D-C** : copy-on-write du décor initial.
- **C — fuite à la destruction.** `destroy()` ne désabonne pas `machine.subscribe`
  (outils) et ne détruit pas `zoneEditor` ; seul `unmountSelectionFrame()` le fait.
- **Code mort et commentaires périmés du pont** : `patchDiffersFromBase`
  (utilisé seulement par les tests), paramètre `void snapshot` de
  `resolveKeyframeInsertionPatch`, branches identiques de `syncSelection`,
  `resolveDecorEditBase` et `resolveDocumentDecorBase` quasi identiques,
  `onPathActivate` vide, commentaire faux sur la création de capsule (l. 609-613),
  mentions « Signal 1/3/5/6 », commentaire orphelin l. 760, ternaires imbriqués
  sur 6-7 niveaux.

### Règles de code (critères d’acceptation de chaque tranche)

- Aucune logique métier dans un rendu d’interface : la vue lit l’état et émet des
  intentions ; la logique vit dans une fonction pure ou, mieux, une classe métier
  distincte.
- Constantes réutilisées dans une configuration ; constantes locales déclarées
  en tête de fichier.
- Pas de fichier trop long : un sujet par fichier, un dossier par fonctionnalité.
- DRY et KISS. Code clair, pas trop défensif : une valeur est validée une fois, à
  la frontière qui la possède. Fonctions et variables principales commentées.

Écarts relevés : interface et commandes construites dans le pont Décor (onglets,
barre Zone/Bloc, « Placement racine ») ; logique de création d’un texte dans le
rendu `EditorMenuRegion` ; gestes de la timeline dans `mount.ts`. Constantes
dispersées : tolérance de 1 ms recopiée 21 fois, 50 ms à deux endroits, couches
de superposition codées en dur dans trois fichiers (1050, 1101, 1160, 1161, 1200,
9999). Fichiers longs : `decor-editor-bridge.ts` (3 737 lignes),
`build-scene.ts` (1 173), `sequence-editor/machine.ts` (890), `mount.ts` (800),
`overlay.ts` (722), `geometry.ts` (644), `render.ts` (582),
`scene-player-bridge.ts` (506). Code défensif : la cible et la scène sont
recalculées avant et après chaque flush, avec des replis `?? 0` / `?? 1` à
chaque lecture.

### Machines explicites — évaluation

Critère : une machine XState se justifie quand un cycle combine plusieurs étapes,
de l’asynchrone, une annulation ou des frontières entre modules. Sinon, une
fonction ou une classe suffit.

| Cycle | Machine explicite ? | Où | Ce qu’elle remplace |
| --- | --- | --- | --- |
| M1-M3 | Oui, priorité 1 | `decorEditSessionMachine` (dossier `app/bridges/decor-edit/`) : `idle` · `editing.exact` / `editing.temporary` · `gesture.previewing` / `gesture.committing` · `awaitingPresentation` ; événements palette, CS, bloc, sélection, seek, Play, frontière d’historique, Échap, chargement | une vingtaine de variables, les 9 remises à zéro, `lastPreviewAccepted` |
| M6 | Oui, dans la même machine | le candidat temporaire et sa capture à la création d’un KF par la timeline appartiennent à la même session d’édition | la file `pendingSnapshotCaptures` et le port `decorPreview` dédoublé |
| M7 | Oui, priorité 1 (petite tranche) | `sequenceEditorMachine` : `DRAG.CANCEL`, état `scrubbing`, état `dragging-virtual` ; aucune commande émise pour un glisser sans déplacement ; `mount.ts` ne fait que traduire les événements DOM, via `bindGestureSession` | écouteurs DOM de `mount.ts` ; corrige E4 et en partie E3 |
| M5 | Oui, priorité 2 | `scenePlayerMachine` : `empty` · `building` (acteurs `fromPromise` : build, preload, sonde) · `published.idle` / `.seeking` / `.starting` | les trois compteurs de révision (une transition annule l’acteur appelé) et la garde répétée 4 fois |
| M8, M9, E1 | Oui, priorité 2 | contrôleur : `playing.pausing`, `switchingScene` (appelle flush, chargement, activation), `failed` (arrêt explicite et visible, avec commande et message) | chaînes `.then` du pont de coordination, `switchingScene` local au menu, gel silencieux |
| M4 | Non | lecture directe du snapshot du contrôleur | les copies `playbackActive`, `activeCreationMode`, `suspended` |
| M10 | Non | `EditorScenePersistence` reste une classe métier, avec un statut typé explicite, pilotée par l’état `switchingScene` | — |

### Découpage cible (à valider)

- **Commandes** (`app/commands/`), couche métier :
  - une seule voie de création de KF, avec un id de décor explicite ;
  - une seule règle de copy-on-write (D-C) ;
  - un seul générateur d’id ;
  - les commandes sans effet renvoient la même référence (E3) ;
  - une commande de création qui renvoie l’id créé ;
  - la création d’un texte en une seule transaction.
- **Résolution** (`builder-v2/`) :
  - `decor-resolution.ts` reste l’unique cascade (G) ;
  - un résolveur unique du temps des segments (B1, D-A), consommé par le pont et par la timeline (E8) ;
  - `build-scene.ts` est découpé : validation, capsules, persos, actions d’interpolation.
- **Pont Décor** (`app/bridges/decor-edit/`) :
  - la machine de session ;
  - `decor-target.ts` (cible et alignement) ;
  - `frame-projection.ts` (cadre logique, pixels et cadre affiché) ;
  - `motion-projection.ts` (segments et ghosts) ;
  - `presentation-reading.ts` (valeurs logiques, id runtime, fraîcheur), partagé avec `scene-selection` ;
  - `zone-surface-binding.ts`.
  `decor-editor-bridge.ts` ne garde que la composition et un seul chemin de démontage (C).
- **Façades entre modules** : les grandes opérations d’un module à l’autre passent
  par les façades existantes.
  - `EditorActionsFacade` pour les intentions documentaires et de sélection :
    commit d’une édition Décor, création d’un KF avec son décor, sélection d’un KF
    avec seek, changement de parent, création d’item.
  - `EditorPlayerCommandFacade`, à travers les ports de `EditorCoordinationBridge`,
    pour le transport.
  - `commands/facade.ts` pour l’écriture du document.
  Aujourd’hui, les ponts envoient 31 événements directement au contrôleur
  (`machine.send`) : 22 dans le pont Décor (9 `RUN_TRANSACTION`, 5 `SELECT_ITEM`,
  3 `RUN_COMMAND`, …), 5 dans la coordination, 2 dans le pont player et 2 dans le
  pont de la timeline. Chaque opération reçoit un nom métier dans la façade ; les
  événements bruts du contrôleur restent internes aux façades.
- **Vues** : la barre Zone/Bloc et les réglages racine deviennent des composants
  du layout qui lisent le contrôleur et appellent la façade.
- **Configuration** (`app/config/`) : tolérances temporelles, couches de
  superposition, ratio temporaire de la scène.

### Ordre des tranches (chacune : tests, typecheck, build, Safari MCP, puis revue manuelle)

1. Commandes (fondation) et état `failed` (E1).
2. Gestes de la timeline (M7) et commandes sans effet (E3).
3. Session Décor et découpage du pont (M1-M4, M6), sur la cascade unique (G) et
   le temps des segments (B1, D-A).
4. Cycle du player (M5) et états du contrôleur (M8, M9).
5. Builder : découpage, capsule traitée comme tout item (B2), placement
   automatique (D-E2), orientations (B3).

Le lot 1 (rotation au plus court chemin, D-B) reste indépendant et peut passer
avant.

### Machines d’état implicites à déclarer

Machines XState déjà déclarées : `controllerMachine` (`idle`/`creating`/`playing`),
`sequenceEditorMachine` et `decorEditorMachine`. Les cycles ci-dessous sont portés
par des variables mutables, des compteurs de révision ou des chaînes de promesses.

| # | Cycle implicite | Porteur actuel | Proposition |
| --- | --- | --- | --- |
| M1 | Phase d’un geste de cadre ou de bloc : repos → preview → commit → attente de présentation, plus annulation | pont Décor : `frameGestureBasePx`, `…Kind`, `…HasNetDelta`, `…Cancelled`, `…BaseDecorState`, `…BaseAuthorRotate`, `…BaseAuthorFrame`, `frameCommitCandidatePx`, `snapshotCommitAwaitingPresentation`, `snapshotPreviewActive`, `lastPreviewAccepted`, `blockMoveGestureActive` ; remise à zéro copiée 9 fois | Machine de geste du pont Décor (direction 1). |
| M2 | Édition Décor en attente : aucune → exacte en attente / temporaire en attente → flush aux frontières | `pendingCommands`, `pendingTemporaryDecorCommit`, `decorEditStates` ; frontières dispersées dans six abonnements | Même machine que M1 (une phase d’édition avec ses frontières déclarées). |
| M3 | Projection du CS : suit la sélection ou suit le temps | `seekProjectionActive`, `lastKnownTimelineMs`, `lastSelectionKey`, `lastObservedScene` | État de la même machine. |
| M4 | Copies locales d’états du contrôleur | `playbackActive`, `activeCreationMode` (pont Décor), `suspended` (overlay) | À lire depuis le snapshot du contrôleur, plus de copie locale. |
| M5 | Cycle de l’instance player : vide → construction(révision) → sonde des défauts → publiée → seek ; lecture en file | `scene-player-bridge` : `rebuildRevision`, `seekRevision`, `playbackRequestRevision`, `rebuildInFlight`, `pendingPlayRequest`, `seekInFlight` ; garde répétée 4 fois | Machine de cycle de scène (acteur appelé, `fromPromise` pour build et seek). |
| M6 | Capture de KF différée jusqu’au seek acquitté | `sequence-editor-bridge` : file `pendingSnapshotCaptures`, `requestedSnapshotTimeMs`, `committingDeferredCapture` | État « attente de seek » déclaré. |
| M7 | Gestes de la timeline hors machine : glisser de KF (surface et écouteurs DOM en parallèle de l’état `dragging-keyframe`), scrub de la tête de lecture (le type `dragging-playhead` est déclaré mais jamais utilisé), glisser d’un KF virtuel | `sequence-editor/mount.ts` | Dans `sequenceEditorMachine`, avec annulation (corrige E4). |
| M8 | Passage de main à la pause et au rewind : en lecture → en pause → temps adopté | `EditorCoordinationBridge` : chaînes `.then`, lecture de `machine.getSnapshot().value` dans la promesse | Sous-état de `playing` dans le contrôleur. |
| M9 | Changement de scène : enregistrement → chargement → activation | Trois endroits : `switchingScene` (local à `EditorMenuRegion`), `EditorActionsFacade.selectScene` (async), `EditorScenePersistence.flush` ; le contrôleur l’ignore | État du contrôleur (la spec exige déjà de bloquer le catalogue pendant ce parcours). |
| M10 | Persistance : prêt/erreur, écriture en cours/en attente par scène, suppression en cours | `EditorScenePersistence` : `status`, `writeQueues`, `pendingSnapshots`, `deletingSceneId`, `activation` | À déclarer si M9 passe au contrôleur ; sinon garder la classe et rendre ses états explicites. |

Restent locaux et acceptables : le séparateur de `AppLayout`, la session de
`block-move-control` (passe par `bindGestureSession`) et le glisser de l’overlay.
Le `GestureSession` partagé est la brique commune des gestes de pointeur.

Constat associé : en mode `transform`, la création d’un texte (`EditorMenuRegion`)
fait deux commits successifs (`createItem`, puis `assignType` + `assignContent`).
Cela donne deux étapes Undo, un item `bloc` intermédiaire et deux rebuilds. La
même section retrouve le nouvel item par différence d’ids, faute d’une commande
qui renvoie l’id créé à travers le contrôleur (même schéma dans
`commitItemCreation`).

### Prérequis et acceptation

- Lot 0 vert. Plan relu et validé ; découpage en tranches livrables
  indépendamment, chacune gardant le comportement.
- Pour chaque tranche : tests de régression ciblés, non-régression
  parent/enfant et reparent, Play/Seek/replay, resize, Undo/Redo, persistance
  SQLite, cycle de vie, typecheck, tests, build et Safari MCP sur la scène
  Editor (rotation, resize, pivot, waypoint, zone, décalage, palette).
- Mise à jour des specs propriétaires dans la même tâche, puis suppression de
  ce plan.

## Revue étendue — étape 1 : producteurs du document

Lu en entier : `app/commands/` (hors `editor-player-command-facade.ts`),
`app/controller/`, `app/history/`, `sequence-editor/commands.ts`, `machine.ts`,
`controller.ts`, `tree-reorder.ts`, `decor-editor/` (sauf `palette-panel.ts`,
`color-adapter.ts`, `icons.ts`, `default-palette.ts` survolés) et `capsule-editor/`.
Lu en partie : `sequence-editor/mount.ts` et `render/` (glisser des KF, double-clic,
réordonnancement des pistes).

### Défauts

- **E1 — Une commande qui lève une exception tue le contrôleur** (confirmé sur
  l’acteur réel, en isolation). `runCommand` et `runTransaction` s’exécutent dans
  une action XState sans protection : l’acteur passe en `error` et ignore ensuite
  tout événement, et l’éditeur ne répond plus jusqu’au rechargement. Cas atteignable :
  en grille fine avec une zone racine, cliquer « Libre » fait lever
  `setRootPlacementMode`, et le bouton n’est désactivé que pendant la lecture ou la
  création. Autres commandes qui lèvent : `setZonesSurface`, `createRootZone`,
  `attachItem`, `assignType`, `setCapsuleDef`, `createItem`, `setDecor`.
  *Décision à prendre* : refuser la commande en préservant l’acteur (résultat
  d’erreur ou diagnostic), et désactiver aussi les contrôles en amont.
- **E2 — Changement de parent d’un item placé en zone** (confirmé à la lecture,
  à confirmer dans le navigateur). `attachItem` ne touche pas à `Decor.zoneId`. Un
  bloc tracé en grille fine (racine, zone racine) et déposé dans une capsule
  produit `EDITOR_V2_ZONE_PARENT_MISMATCH` : le rebuild échoue, le player garde
  l’ancienne scène, et la validation SQLite lève une erreur. *Manque de contrat* :
  la spec ne dit pas ce que devient la zone lors d’un changement de parent.
- **E3 — Trois définitions de « document modifié »** (confirmé). Le contrôleur
  émet `documentCommitted` dès que la référence de l’objet scène change ;
  l’historique compare en profondeur ; la persistance et le pont player comparent
  les références. Or `moveKeyframe` (comme d’autres commandes) renvoie un nouvel
  objet même sans changement. Un simple clic sur la poignée d’un KF
  (`DRAG.START` → `DRAG.END` au même instant) produit donc une écriture SQLite et
  une reconstruction complète du player, sans étape Undo. Remplace le point 5 du
  lot 2.
- **E4 — Glisser d’un KF sans annulation** (constaté lors de la reproduction).
  La surface de glisser n’écoute que son propre `pointerup` : il n’y a ni
  `pointercancel`, ni capture du pointeur, ni Échap. Si le relâchement lui échappe,
  le glisser reste ouvert et le clic suivant déplace le KF.
- **E5 — Glisser d’un KF sans garde de canal ni de collision.** `DRAG.END` ne
  vérifie que [0, durée]. Un KF `decor` peut sortir de la fenêtre de pose (la spec
  l’interdit), et un KF peut tomber, par aimantation, sur l’instant d’un autre KF
  du même item. Or le pont suppose les instants uniques par item. Dépasser un autre
  KF de pose change aussi le segment auquel s’applique son `path`.
  *À qualifier par un test.*
- **E6 — Le copy-on-write a trois définitions différentes du « décor
  partagé »** : `isDecorSharedByAnotherReference` (pont : ignore `rootDecorId` et,
  hors `path`, `initialDecorId`), `initialDecorIsShared` (`setCapsuleDef`) et
  `foreignDecorIds` (`setItemRotationMode`). Élargit D-C. De plus, `KEYFRAME.ADD`
  partage volontairement le décor adjacent, y compris `initialDecorId`.
- **E7 — Le tracé d’une plage efface les poses des bornes.** `CLIP.DRAW_END`
  supprime les KF d’entrée et de sortie, puis les recrée avec un décor vide :
  géométrie et habillage de ces bornes sont perdus. *Question* : remplacement
  voulu, ou conservation des décors ?
- **E8 — La timeline recalcule la distribution des capsules à sa façon**
  (`computeVirtualKeyframes`, « même formule que `resolveCapsule` »).
  - La racine est codée en dur `card` / `stagger 0`, alors que le Builder lit
    `rootCapsule.kind` et `rootCapsule.distribution`.
  - L’ordre vient de `displayConfig.capsuleOrder` (constante `forward`), pas de
    `meta.capsuleOrder`, que ni le Builder ni la timeline ne lisent.
  - Divergence latente, à rattacher à la résolution unique du lot 3.
- **E9 — Le type `classes` diffère entre le document et le décor.** Document :
  `string | string[]` ; `DecorPatch` : `string | { add, remove }`. Des
  conversions `as unknown as` dans le pont masquent l’écart.
  `normalizeClassName` (Builder) appelle `.trim()` : un objet `{ add }` persisté
  le ferait planter. Latent, car aucun contrôle ne produit ce cas aujourd’hui.
  Précise le point « deux fusions » du lot 3.
- **E10 — La multi-sélection de dedit n’est jamais utilisée par l’application.**
  Le pont n’attache que `selection.itemIds[0]`, et aucun geste ne sélectionne
  plusieurs items. Les états « mixte » décrits par la spec d’intégration ne sont
  vérifiés que par un test de rendu.

### Duplications et code mort

- Ids : quatre générateurs différents (`base-commands` UUID,
  `sequence-editor/machine` et pont `Date.now + random`,
  `sequence-editor/controller` `Math.random` seul), plus la convention implicite
  `decor-${keyframeId}`.
- Arbre : `collectDescendantIds` (`base-commands`), `descendantIds`
  (`sequence-editor/commands` et `utils`) ; `requireItem` et `updateItem` en
  double ; trois comparateurs d’ordre ; `timelineBoundaryKeyframes` en double
  (machine et contrôleur de séquence).
- Chemins de décor : `readDecorPath`, `readPath` (`field-state`), la boucle de
  `hasOwnPatch`, `buildPatchFromPath` et `writeDecorPath` ; deux fonctions de clonage.
- Invariant « KF triés » tenu par certaines commandes (`createNamedKeyframe`,
  `moveKeyframe`) mais pas par d’autres (`moveMarker`, `createKeyframe`).
  Les consommateurs retrient partout.
- Code mort : `createKeyframe` et `placeInZone` (commandes jamais émises),
  `setRootZonesSurface` (jamais émise), `generateSnapPoints` et `clampMs`
  (`utils`), `decor-editor/zones.ts` et les types `ZoneDef`/`ZoneTable`/`ZoneCard`
  (ancien modèle de zones en cqw, parallèle à `Zone`), `CapsulePatch`, et le
  `ItemType` redéclaré dans `decor-editor/types.ts`.
- `emptyScene()` du contrôleur de séquence : sans document, la timeline affiche
  un faux document « Untitled ».
- `groupTypoIconFields` (`decor-editor/mount.ts`) réorganise le DOM en comptant
  les lignes sans libellé : une mise en page fragile, qui devrait être déclarée
  dans la configuration de la palette.
- Palette : `parseNumberFromCssValue` ignore l’unité (une valeur en `px` saisie
  dans Custom est relue comme si elle était en cqw, puis réécrite en cqw).
  Capsule : vider le champ Lignes/Colonnes ramène la grille à 1.

## Revue étendue — étape 2 : Builder

Lu en entier : `builder-v2/build-scene.ts`, `decor-resolution.ts`,
`keyframe-transition.ts` et `item-rotation/tangent-reference.ts`.

- **B1 — Horloge des segments à chemin (précise D-A).** Sur un segment avec
  `path`, le `move` reçoit tout l’intervalle entre les KF et l’action démarre au
  KF source. Les tweens de style de la même action gardent la durée de la fenêtre
  de transition, mais démarrent eux aussi au KF source. Sur un segment droit, les
  tweens suivent `startAtMs` de `resolveKeyframeTransition`. Le Builder applique
  donc deux horloges selon le type de segment, et elles divergent dès qu’une
  transition est plus courte que l’intervalle ou en `direction: 'before'` (latent :
  aucune transition ne se saisit dans l’interface). D-A doit reprendre ce choix
  par type de segment, et le Builder devrait l’exposer comme résolution unique,
  consommée par le pont.
- **B2 — Les capsules n’interpolent pas leur pose.** `buildNestedCapsulePerso` ne
  produit que le style initial, les transitions nommées et les `move` de zone. Les
  décors des KF suivants d’une capsule (position, taille, rotation, habillage) ne
  sont jamais compilés, alors que le pont en permet l’édition au CS et à la
  palette : ces éditions restent sans effet au runtime. Décidé (D-B2) : la capsule
  est traitée comme tout item. Écarts à supprimer : `EDITOR_ENGINE_OPTIONS` ne
  recompose pas `list` avec `createItemComponent` (seulement `tag`, `img` et
  `media`), et le pont projette le CS d’une capsule par une branche à part
  (`presentedContentBoxFrameForItem`, `toSnapshotPatches`).
- **B3 — Seule l’orientation paysage des zones est compilée.**
  `resolveZoneTargetPlacements` lit `surfaces.landscape`. Or l’éditeur Zone écrit
  la surface `portrait` dès qu’une capsule est plus haute que large
  (`zoneOrientation`). Dans ce cas, modifier une zone existante n’a aucun effet
  visible. Lié à la décision ouverte sur le nommage des orientations (modèle de
  document).
- **B4 — Pas de validation des instants de KF.** Le Builder ne refuse ni deux KF
  au même instant pour un item, ni un KF `decor` hors de la fenêtre de pose.
  `motion-editor/timing.ts` qualifie pourtant les instants dupliqués de « données
  invalides ». Renforce E5.
- **B8 — Un item masqué décale les autres (écart avec D-VIS).**
  `itemsForCompilation` retire les items masqués (et leurs descendants) **avant**
  la résolution des capsules : le rang des items suivants change, donc leur case
  automatique, le compte des grilles dérivées et leur distribution du temps. La
  timeline, elle, garde les items masqués (`computeVirtualKeyframes` ne filtre pas
  la visibilité) : elle et le player divergent déjà dès qu’une capsule contient un
  item masqué. Le retrait de la `SceneDoc` était voulu ; D-VIS change le calcul
  des positions. Correction (appelant) : compiler les items masqués avec une
  classe `visibility:hidden`, et supprimer `itemsForCompilation`. Ne pas utiliser
  `visible: false` de Capsule Automation : il retire aussi le rang.
- **B5 — Dépendances inversées.** Le Builder importe des fonctions pures depuis
  des modules d’interface : `motion-editor/geometry` (`normalizeAngleDegrees`,
  géométrie du chemin), `decor-editor/units` (`OFFSET_STYLE_PROPERTIES`),
  `item-presentation`. Les fonctions partagées gagneraient à vivre dans un module
  neutre.
- **B6 — Deux analyseurs du CSS `custom`** (`resolveCustomStyle`,
  `missingZoneFillStyle`), qui découpent tous deux naïvement sur `;` (une valeur
  `url(data:…;…)` serait coupée).
- **B7 — Trois fusions de l’offset** (`mergeOffsetData` dans le Builder,
  `mergePlacementGeometry` dans les commandes, `mergePatch` dans dedit), et une
  double représentation de la position (`offset.x` et `offset.translate.x`),
  rejoignant la décision ouverte sur `width`/`height`.

## Revue étendue — étape 3 : présentation

Lu en entier : `item-presentation/`, `motion-editor/timing.ts` et
`border-insets.ts` (première moitié). Lu en partie : `motion-editor/geometry.ts`
(projections et poses ; les calculs de découpe et d’arc, l. 240-644, n’ont été
que survolés) et `overlay.ts` (gestion des événements seulement).
`content-box.ts`, `geometry-store.ts` et `easing.ts` n’ont pas été relus.

- **P1 — Lecture du transform dans le DOM.** `recordItemTransformProjection` stocke
  la matrice dans une `WeakMap` de module, indexée par un nœud DOM, que le pont relit
  en cherchant le nœud (`presentedItemPose`). La spec de présentation l’autorise,
  mais cela lie le pont au nœud rendu. *Pour le lot 3* : faire publier cette
  contribution par le port de présentation plutôt que par le DOM.
- **P2 — Trois analyseurs de `transform-origin`** (`parseRotationOrigin` du pont,
  `parseTransformOrigin` de la projection, celui de `tangent-reference`, qui
  ignore les mots-clés comme `center`), plus `readTransformOriginCoordinate`.
- **P3 — Branche morte** dans `projectItemStyle` : le test
  `property === 'transform-origin'` se trouve dans une branche qui ne peut pas
  recevoir cette propriété. L’ancre de transformation est aussi écrite deux fois
  (par le service de style, puis par `style.transform`).
- **P4 — Troisième résolveur de fenêtre de transition, inutilisé** :
  `resolveMotionTransitionWindow` (défaut 500 ms, durée bornée à l’intervalle),
  dont la sémantique diffère de `resolveKeyframeTransition`. À supprimer, ou à
  confondre avec la résolution unique de B1.
- **P5 — Exports sans appel dans `src`** (à vérifier dans les tests avant de les
  retirer) : `translateFrame`, `distanceToSegment`, `clampMotionDuration`,
  `presentationBorderBoxPoseToContentFrame`, `normalizeMotionControl`,
  `poseFrameToContentBoxFrame`, `resolveBorderInsetsPx`.
- **P6 — Deux circuits de geste.** L’overlay de trajectoire utilise
  `bindGestureSession` (avec annulation), contrairement au glisser des KF de la
  timeline (E4). Corriger E4 en réutilisant ce circuit.

## Hors plan

- Sélection quand deux items se recouvrent : `scene-selection.ts` renvoie
  `null` et vide la sélection. Ce point est couvert par la sélection cyclique,
  déjà identifiée comme manquante.
- Sémantique des angles multi-tours (option future de l’interface).
