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

| Id           | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Statut                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| D-A          | Les gestes (angle au début du geste, découpe d’un waypoint, tangente) utilisent la fenêtre de transition du player, `resolveKeyframeTransition` (`builder-v2/keyframe-transition.ts`). Le pont supprime sa copie de l’easing (`resolveMotionEasing`) et sa progression calculée sur tout l’intervalle KF→KF.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Acceptée                                        |
| D-B          | Entre deux KF de pose, la rotation suit le plus court chemin. Un changement d’orientation entre deux KF ne produit jamais de saut brut de 180°. Les valeurs stockées restent normalisées dans [−180°, 180°). Rotations multi-tours : future option volontaire de l’interface, hors de ce plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Acceptée                                        |
| D-C          | Règle de contrat : éditer le décor d’un KF crée un nouveau décor pour porter la modification, dès que le décor attaché n’appartient pas en propre à ce KF (il est aussi utilisé par un autre KF, par le décor initial d’un item ou par `rootDecorId`). Une seule implémentation pour toutes les commandes, en remplacement des trois définitions actuelles (E6). Écart constaté : le pont ne crée pas ce décor quand l’autre utilisation est le décor initial ; un commentaire de code (non spécifié) invoque une exception « le premier KF partage volontairement `initialDecorId` ». **Exception retenue** : le premier KF de pose est toujours l’intro et modifie le décor initial. Elle se limite à ce KF ; aujourd’hui le pont l’applique à tous. Si un autre KF partage aussi ce décor initial, c’est lui qui reçoit d’abord sa copie, pour ne pas changer quand on édite l’intro.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Acceptée                                        |
| D-E1         | Une exception de commande est un défaut : elle reste un arrêt, mais devient immédiatement visible dans l’interface (commande, message), sans état figé silencieux. Le défaut qui la provoque est corrigé (contrôle non désactivé, validation absente).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Acceptée                                        |
| D-E2         | Placement automatique ou explicite dans une capsule. Déplacée dans le [plan Capsules et zones](./2026-11-25-capsules-zones-plan.md), action 4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Déplacée (2026-11-25)                           |
| D-E7         | Le tracé d’une plage conserve les décors des bornes remplacées.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Acceptée                                        |
| D-B2         | Une capsule est un item avec les mêmes caractéristiques que les autres : ses KF de pose et de décor sont compilés de la même façon, son composant `list` reçoit la même présentation Editor (`createItemComponent`) et son CS suit la même projection, sans branche dédiée dans le pont.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Acceptée                                        |
| D-NAISS      | Un item naît à la tête de lecture. Intro et outro sont toujours des KF ; leur placement est manuel (KF réel, l’item est « locké » sur cette borne) ou automatique (KF virtuel calculé par la distribution de la capsule), sans différence de nature ([spec de distribution](../../authoring/capsule-automation/specs/capsule-distribution-spec.md) §1 et §2 ; matérialisation : [intégration V2](../specs/editor-v2-integration-spec.md#interaction-des-bornes-de-capsule)). À la création, pour tout type d’item (la zone n’est qu’une propriété de placement), l’intro est matérialisée à la tête de lecture, comme la matérialisation d’une borne virtuelle, et l’outro reste en placement automatique ; le décor de l’intro est le décor initial. Avant son intro, l’item n’existe pas. Un geste du cadre de sélection dont la cible est l’état initial (avant l’intro, ou item existant sans KF) écrit le décor initial, comme la palette (D-C ; corrige E12).                                                                                                                                                                                                                                                                                                                                                                                                                                             | Acceptée (24 nov. 2026)                         |
| D-VIS        | Masquer un item est une étape d’édition, pas une suppression : les positions des autres items ne bougent pas (rang de placement automatique, compte des grilles dérivées, distribution du temps) ; l’item masqué n’a pas besoin d’être rendu. **Approche retenue : `visibility:hidden`**. Le Builder compile l’item masqué comme les autres et lui ajoute une classe de cadre `visibility:hidden` ; il n’a plus de filtre de visibilité. Une capsule masquée masque son sous-arbre par héritage de la propriété. Aucune contradiction à gérer : l’item garde sa place dans la grille et dans le temps, comme dans la timeline. Aucun changement de Capsule Automation. Conséquences : (1) les items masqués sont validés et comptés dans `preRollMs` ; (2) **un item média masqué doit être silencieux** (décidé) : `visibility:hidden` ne coupe pas le son, le Builder doit donc aussi le couper. Le composant média de CodPlay connaît `muted` et `volume` comme propriétés d’une transition média ; l’existence d’un état initial `muted` n’est pas vérifiée. À qualifier à l’implémentation : si la surface actuelle ne suffit pas, c’est une demande de modification de CodPlay, soumise aux portes d’AGENTS.md (justification, absence d’alternative côté Editor, autorisation) ; (3) les tests et la spec d’intégration qui décrivent le retrait de la `SceneDoc` sont à réécrire avec l’implémentation. | Acceptée ; mise en œuvre du silence à qualifier |
| D-HORS-PLAGE | Quand la tête de lecture est hors de la plage d’existence de l’item sélectionné (avant son intro ou après son outro, bornes réelles ou virtuelles), une action sur le Selection Frame ou sur la palette recale d’abord la tête de lecture sur la borne la plus proche (intro ou outro) ; le geste s’applique ensuite à cette borne. Le cadre reste affiché hors plage : il porte l’action. La palette suit la même règle (confirmé le 24 nov. 2026) : une édition hors plage recale la tête de lecture puis écrit à la borne, au lieu d’écrire le décor initial ou celui du dernier KF réel. Le recalage est un déplacement de tête de lecture, hors historique. Réalisation : tranche 3, comme phase « recalage en attente du seek » de la machine de geste (M1/M3) ; le démarrage de geste actuel du pont capture sa base avant tout seek. Action sur une borne héritée : tranchée par B-4 du [plan des bornes](./2026-11-25-bornes-intro-outro-plan.md) (KF lié avec décor propre, placement automatique) ; réalisation : action 4 de ce plan.                                                                                                                                                                                                                                                                                                                                                               | Décidée (24 et 25 nov. 2026)                    |
| D-R          | Refonte du pont Décor (lot 3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Acceptée avec le plan (24 nov. 2026)            |

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

**Fait — en attente de revue manuelle** (580 tests verts, typecheck et build
propres) :

- `buildStyleTransition` : pour `rotate` numérique, cible du tween
  `from + normalizeAngleDegrees(to − from)`. Précision : seuls le décor et
  l’angle auteur restent normalisés ; la cible du tween, et donc la valeur logique
  présentée en fin de segment, peut sortir de [−180°, 180°) (194° pour 167° →
  −166°), ce qui est visuellement identique.
- `authoredRotationAtGestureStart` (pont) applique la même règle.
- Mode tangente inchangé (le raccord `rotateOffset` normalisait déjà) ; tests
  tangente et motion-path verts.
- Tests : nouvelle régression dans `player-interpolation.spec.ts` (167° → −166°
  donne la cible 194°, 180,5° à mi-segment ; −170° → 170° donne −190°).
  `motion-path.spec.ts` attendait l’ancien chemin long d’un item manuel (−80° →
  120°, +200°) : l’attente devient −240° (−160°).
- Safari MCP, scène de test supprimée ensuite : KF à 167° et −166° ; en Seek,
  167° → 171,2° → 180,5° → −170,2° → −166° aux quarts du segment, CS aligné sur
  l’item ; en Play, progression dans un seul sens par pas de 2,3° au plus ; Undo
  ramène l’item à 167° sans rotation, Redo rétablit 180,5° ; après rechargement
  SQLite, 180,5° à mi-segment et −166° au KF 2.
- Constat revu : le geste au KF 2 a de nouveau écrit −166° dans le décor initial
  (D-C, corrigé en tranche 1).
- À faire après la revue manuelle : consolider la règle dans la
  [spec d’orientation](../specs/path-tangent-orientation-spec.md).

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

| Retiré (origine)                                                                                              | Fonctionnalité                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveMotionTransitionWindow`, `clampMotionDuration` (motion editor, 3-4 sept. 2026)                        | Édition des transitions de KF. Le document porte déjà `Transition` (durée, direction) et les commandes `setKeyframeTransitionIn/Out` existent, sans interface. À reconstruire avec cette interface, sur le résolveur unique de D-A. À arbitrer : fenêtre par défaut de 500 ms (code retiré) contre 400 ms (`DEFAULT_TRANSITION_DURATION_MS`). Le commentaire de `commitMotionDrop` renvoie encore à ce « futur résolveur ». |
| `distanceToSegment`, `translateFrame` (« visual move », 3 sept. 2026)                                         | Sélection du tracé au clic et panneau secondaire d’un segment (`onPathActivate` est vide : seul le point de contrôle existe).                                                                                                                                                                                                                                                                                               |
| `orientationFromRatio`, `coordsForContext`, `updateZoneCoords`, `OrientationContext` (decor v1, 7 juil. 2026) | Choix de la surface de zone portrait ou paysage selon la forme de l’hôte. Le Builder ne compile que `landscape` (B3), et l’orientation reste à nommer (`portrait/landscape` contre `vertical/horizontal`).                                                                                                                                                                                                                  |
| `ZoneCard` et `applyCard` (decor v1)                                                                          | Modèles de zones prêts à appliquer, non repris par le modèle actuel.                                                                                                                                                                                                                                                                                                                                                        |

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

3. **Saisie directe du texte** (décidé par l’utilisateur le 24 nov. 2026, non
   appliqué). Objectif : deux entrées de plus sur le même état du décor, avec
   effet immédiat : (a) saisie du texte directement dans le bloc sur la scène ;
   (b) champ Texte de la palette synchronisé en direct avec le rendu, à chaque
   frappe. Existant : le champ Texte de la palette n’applique sa valeur qu’à la
   validation (`change`, `render.ts`) ; `text` et `textAutoSize` sont routés vers
   `Content` par `patchToContentArgs` au commit. Prérequis : la machine de session
   Décor (étape 3d), qui accueille ces événements sans second circuit. À analyser
   avant de commencer : si la preview V2 (`snapshot.set`, façade V2) sait porter un
   changement de contenu texte, sans quoi la preview passerait par un autre
   moyen à décider ; la frontière de commit d’une saisie continue (validation,
   perte de focus ou Échap, en cohérence avec les frontières existantes) ; la
   cohabitation de la saisie dans le bloc avec le Selection Frame et ses gestes.
   Validation : Safari MCP, puis revue manuelle.

4. **Refonte de l’interface Décor** (décidé par l’utilisateur le 25 nov. 2026, non
   appliqué). L’interface actuelle (palette, onglets, barre Zone/Bloc, réglages
   racine) est provisoire et doit être revue entièrement. La tranche 3 n’y investit
   pas : elle sort seulement ces vues du pont et sépare leurs règles d’affichage
   (`decor-inspector-state.ts`) du rendu, base réutilisable pour la refonte.

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

## Lot 3 — Refonte du pont Décor

Objectif : réduire `createDecorEditorBridge` (une seule closure d’environ
3 000 lignes, une quarantaine de variables `let`) à une coordination de
propriétaires distincts, sans perdre les acquis vérifiés des specs.

**Principe directeur** (utilisateur, 24 nov. 2026 ; décrit dans la
[spec d’intégration](../specs/editor-v2-integration-spec.md), « Décor et item ») :
le décor est fortement couplé à l’item. Il comprend tout ce que la palette
règle et tout ce que les gestes du Selection Frame écrivent, et chaque
modification a un effet immédiat sur l’item présenté. Conséquences pour la refonte :

- palette et cadre entrent par les mêmes événements de la machine de session et
  suivent le même circuit (preview, puis commit à la frontière) ; aucun second
  chemin d’écriture ;
- la preview reste synchrone : aucune phase d’attente ne s’intercale entre
  l’intention de l’auteur et son effet sur l’item (c’est la seule justification
  de `lastPreviewAccepted` aujourd’hui, que la machine doit rendre explicite sans
  l’asynchroniser) ; seul le commit est différé à une frontière ;
- la session est liée à l’item sélectionné (type, contenu, décor cible) : la
  cible fait partie du contexte de la machine, pas d’une relecture à chaque appel ;
- le routage vers `Decor` ou `Content` (E13) reste une étape du commit, pas une
  distinction visible dans la session ; `text` et `textAutoSize` entrent dans la
  machine par les mêmes événements que les autres champs, pour que la saisie
  directe du texte (chantier 3, plus bas) n’exige aucun circuit nouveau.

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

| Cycle      | Machine explicite ?              | Où                                                                                                                                                                                                                                                                                     | Ce qu’elle remplace                                                                                |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| M1-M3      | Oui, priorité 1                  | `decorEditSessionMachine` (dossier `app/bridges/decor-edit/`) : `idle` · `editing.exact` / `editing.temporary` · `gesture.previewing` / `gesture.committing` · `awaitingPresentation` ; événements palette, CS, bloc, sélection, seek, Play, frontière d’historique, Échap, chargement | une vingtaine de variables, les 9 remises à zéro, `lastPreviewAccepted`                            |
| M6         | Oui, dans la même machine        | le candidat temporaire et sa capture à la création d’un KF par la timeline appartiennent à la même session d’édition                                                                                                                                                                   | la file `pendingSnapshotCaptures` et le port `decorPreview` dédoublé                               |
| M7         | Oui, priorité 1 (petite tranche) | `sequenceEditorMachine` : `DRAG.CANCEL`, état `scrubbing`, état `dragging-virtual` ; aucune commande émise pour un glisser sans déplacement ; `mount.ts` ne fait que traduire les événements DOM, via `bindGestureSession`                                                             | écouteurs DOM de `mount.ts` ; corrige E4 et en partie E3                                           |
| M5         | Oui, priorité 2                  | `scenePlayerMachine` : `empty` · `building` (acteurs `fromPromise` : build, preload, sonde) · `published.idle` / `.seeking` / `.starting`                                                                                                                                              | les trois compteurs de révision (une transition annule l’acteur appelé) et la garde répétée 4 fois |
| M8, M9, E1 | Oui, priorité 2                  | contrôleur : `playing.pausing`, `switchingScene` (appelle flush, chargement, activation), `failed` (arrêt explicite et visible, avec commande et message)                                                                                                                              | chaînes `.then` du pont de coordination, `switchingScene` local au menu, gel silencieux            |
| M4         | Non                              | lecture directe du snapshot du contrôleur                                                                                                                                                                                                                                              | les copies `playbackActive`, `activeCreationMode`, `suspended`                                     |
| M10        | Non                              | `EditorScenePersistence` reste une classe métier, avec un statut typé explicite, pilotée par l’état `switchingScene`                                                                                                                                                                   | —                                                                                                  |

### Découpage cible

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
3. Session Décor et découpage du pont (M1-M4), sur la cascade unique (G) et
   le temps des segments (B1, D-A) ; recalage de la tête de lecture hors plage
   (D-HORS-PLAGE).
4. Cycle du player (M5) et états du contrôleur (M8, M9) ; E15 (saut à la première
   lecture après une correction) ; M6 (capture différée de la timeline), reporté
   de la tranche 3 avec les autres changements de la coordination.
5. Builder : découpage, capsule traitée comme tout item (B2), placement
   automatique (D-E2, désormais dans le [plan Capsules et zones](./2026-11-25-capsules-zones-plan.md)), orientations (B3).

Le lot 1 (rotation au plus court chemin, D-B) reste indépendant et peut passer
avant.

### Tranche 1 — exécution (Faite — en attente de revue manuelle)

- **E1 — échec visible.** `commands/facade.ts` enveloppe toute exception de
  commande dans une `CommandError` qui nomme la commande. Le contrôleur l’attrape à
  la frontière (`runCommand`/`runTransaction`), mémorise `failure` (commande,
  message) et passe dans un état final `failed` : l’acteur s’arrête, comme
  aujourd’hui, mais `AppLayout` affiche un bandeau bloquant qui dit quelle commande a
  échoué et pourquoi. Cause corrigée : `canSetRootPlacementMode` (règle métier
  partagée par la commande et l’interface) désactive « Libre » quand des zones
  racine existent.
- **Un seul générateur d’id** : `commands/ids.ts` (`createId(prefix)`, UUID),
  utilisé par les commandes, la timeline et les ponts. Plus de convention implicite
  `decor-${keyframeId}`.
- **Une seule voie de création de KF** : `createNamedKeyframe` reçoit toujours un
  `decorId` explicite (partagé s’il existe, créé sinon). `createKeyframe` est
  retiré ; ses tests et fixtures passent à `createNamedKeyframe`.
- **Une seule règle de copy-on-write (D-C)** : `commands/decor-sharing.ts` liste les
  références d’un décor. Nouvelle commande `setItemDecor({ itemId, keyframeId |
null, patch, forkDecorId })` :
  - un KF qui n’est pas l’intro et dont le décor est utilisé ailleurs reçoit un
    nouveau décor (`forkDecorId`, patch clairsemé) ;
  - l’intro (premier KF de pose partageant le décor initial) ou le décor initial
    lui-même écrit dans le décor initial ; les autres références qui le partagent
    reçoivent d’abord une copie de l’ancien contenu.
    Le pont n’applique plus le copy-on-write lui-même. `setItemRotationMode` et
    `setCapsuleDef` utilisent la même liste de références.
- **Création d’items par la façade** : `createItem` et `createCapsule` acceptent
  un `itemId` fourni par l’appelant. `EditorActionsFacade` reçoit l’opération de
  création d’un bloc ou d’un texte (une transaction, puis la sélection) ; le menu
  et le pont l’appellent au lieu de retrouver l’item par différence d’ids.

**Acceptation** : tests, typecheck et build verts ; Safari MCP sur une scène de
test : « Libre » désactivé avec une zone racine ; bandeau d’échec sur une
commande refusée provoquée volontairement ; déplacer l’item au KF 2 ne déplace
plus le KF 1 et laisse le décor initial intact ; création d’un texte = une seule
étape Undo ; puis revue manuelle.

**Résultat** (587 tests verts, typecheck et build propres) :

- Nouveaux fichiers : `commands/ids.ts`, `commands/item-decor/decor-sharing.ts`,
  `commands/item-decor/item-decor-commands.ts` ; tests
  `commands/item-decor-commands.spec.ts`, `app/editor-actions-creation.spec.ts`,
  état `failed` dans `controller/controller-machine.spec.ts`.
- `createKeyframe` retiré ; le test d’unicité des ids après restauration passe par
  `createId` et `createNamedKeyframe`. Les tests qui attendaient des commandes de
  KF sans `decorId` attendent maintenant un id explicite. Une fixture du pont
  player reposait sur la convention implicite `decor-${keyframeId}` (`setDecor`
  sur `decor-middle`) : elle passe l’id explicitement.
- Safari MCP, scène de test supprimée ensuite :
  - « Créer un texte » en mode libre : une seule écriture SQLite, un seul Undo
    retire l’item entièrement ;
  - intro et KF 2 partageant le décor initial, déplacement de +60/+30 px au KF 2 :
    le KF 2 reçoit son propre décor (position seule), le décor initial est
    inchangé, l’item reste à (80, 100) au KF 1 et passe à (140, 130) au KF 2 ;
  - grille fine avec une zone racine : « Libre » désactivé, avec l’explication en
    survol ;
  - bouton réactivé de force puis cliqué : bandeau plein écran « L’éditeur s’est
    arrêté — la commande « setRootPlacementMode » a été refusée », document
    inchangé, plus aucune commande prise en compte ; le rechargement rétablit
    l’éditeur.
- Le message technique de la commande reste en anglais dans le bandeau.
- Non traité dans cette tranche : E7 (le tracé d’une plage efface encore les
  décors des bornes), E3 (tranche 2).
- Specs à consolider après la revue manuelle : modèle de document (règle de
  copy-on-write, ids), intégration (arrêt visible sur commande refusée).

### Tranche 2 — exécution (Faite en partie — en attente de revue manuelle)

Faite (597 tests verts, typecheck et build propres) :

- **E3 — une seule définition de « document modifié ».** Le comparateur de
  l’historique devient `commands/scene-equality.ts` ; la façade de commandes
  (`runCommand`, `transaction`) renvoie la référence précédente quand les valeurs
  sont inchangées. Contrôleur, historique, persistance et pont player n’ont plus de
  cas particulier : pas de commit, pas d’écriture, pas de reconstruction.
- **E4 — glisser de KF.** `sequence-editor/pointer-session.ts` : une session de
  pointeur sur la surface de glisser, avec capture du pointeur, `pointercancel`,
  Échap (qui ne vide pas la sélection de l’application) et fin unique ;
  `pointerup` et la perte de capture terminent le geste comme dans le Selection
  Frame. La machine de la timeline reçoit `DRAG.CANCEL`, `DRAG.END` n’émet plus de
  commande si le KF n’a pas bougé, et le garde `canCommitDrag` (qui laissait la
  machine bloquée dans `dragging-keyframe`) et l’état `dragging-playhead` jamais
  produit sont retirés.
- Tests : `sequence-editor/keyframe-drag.spec.ts` (clic, glisser, `pointercancel`,
  Échap, capture perdue) et `commands/unchanged-commands.spec.ts` (mêmes
  références, transaction sans effet, contrôleur sans `documentCommitted`).
- Safari MCP, scène de test supprimée ensuite : trois clics sur la poignée du KF 2
  sans aucune écriture (révision 4 avant et après) ; glisser annulé par Échap puis
  par `pointercancel`, KF et révision inchangés, événement tardif sans effet ;
  glisser complet de 2 500 à 1 500 ms avec une seule écriture, puis Undo.

Reportée, à valider : les états `scrubbing` et `dragging-virtual` de la machine
(M7). Le scrub de la tête de lecture n’écrit pas dans le document, et le glisser
d’un KF virtuel gère déjà annulation, `pointercancel` et Échap ; les passer dans la
machine apporterait de la lisibilité, sans corriger de défaut constaté. Les glissers
de marqueur, de panoramique et de tracé de plage gardent leur surface sans capture :
à passer par la même session si on les retient.

### Tranche 3 — exécution (En cours)

Cinq étapes livrées séparément ; chacune garde le comportement, passe tests,
typecheck, build et Safari MCP, puis attend la revue manuelle.

| Étape | Contenu                                                                                                                                                             | Statut                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 3a    | Lectures uniques : temps des segments (D-A, B1), cascade des couches (G), lecture de la présentation (I), constantes, code mort et démontage (C)                    | Faite — en attente de revue manuelle                                                                                                     |
| 3b    | Extraction : vues (onglets, barre Zone/Bloc, « Placement racine ») vers le layout ; `decor-target`, `frame-projection`, `motion-projection`, `zone-surface-binding` | Faite — en attente de revue manuelle (projections dépendant de l’état de geste reportées en 3d)                                          |
| 3c    | Façade : les `machine.send` du pont Décor deviennent des intentions nommées de `EditorActionsFacade`                                                                | Faite — en attente de revue manuelle                                                                                                     |
| 3d    | Machine `decorEditSessionMachine` (M1-M4, M6), selon le principe directeur ; projections et commits dépendant du geste, reportés de 3b                              | Pas 1 à 4 et reste reporté de 3b faits — Safari fait sauf offset en zone, puis revue manuelle ; pas 5 (M6) reporté en tranche 4 |
| 3e    | D-HORS-PLAGE : phase « recalage en attente du seek »                                                                                                                | Repris dans le [plan des bornes](./2026-11-25-bornes-intro-outro-plan.md), action 4                                                      |

**Étape 3a — actions** (aucun changement de comportement atteignable depuis
l’interface : les transitions personnalisées ne se saisissent pas encore) :

1. **Temps des segments (D-A, B1).** Existant : `resolveKeyframeTransition`
   (`builder-v2/keyframe-transition.ts`) pour les segments droits ; pour un segment
   à chemin (`decor.path` du KF d’arrivée, ou chemin droit implicite en mode
   tangente), `build-scene.ts` démarre au KF source et dure tout l’intervalle. Le
   pont recalcule une progression sur tout l’intervalle avec sa propre copie de
   l’easing (`resolveMotionEasing`, trois appels). Action : `keyframe-transition.ts`
   expose `resolveSegmentTiming(scene, item, source, destination)` (début, durée,
   easing, chemin oui/non, selon la règle actuelle du Builder) et
   `resolveSegmentProgress(timing, timeMs)` ; `build-scene.ts` et le pont les
   consomment ; `resolveMotionEasing` et les trois calculs locaux disparaissent.
2. **Cascade des couches (G).** Existant : `resolveKeyframeLayers` et
   `resolveLayerKeyframe` (Builder) ; `resolveEffectiveKeyframePatch` et
   `resolveEffectivePosePatch` (pont) choisissent leurs couches autrement (KF
   strictement antérieurs en temps, au lieu de l’ordre trié jusqu’au KF). Action :
   `decor-resolution.ts` expose une seule sélection des couches par canal
   (`decoration` : toutes les couches ; `pose` : décor initial et KF de pose) ; le
   Builder (style, offset, classes) et le pont l’utilisent. Chaque consommateur
   garde sa représentation : style compilé pour le Builder, `DecorPatch` pour la
   palette et le cadre. Seul écart corrigé : deux KF au même instant suivent l’ordre
   du Builder, donc la palette montre ce que le player présente.
3. **Lecture de la présentation (I).** Nouveau `app/bridges/presentation-reading.ts`,
   partagé par le pont Décor et `scene-selection` : état d’un item dans le
   snapshot, valeurs logiques (longueur, nombre, couleur, `transform-origin`), id
   runtime `${EDITOR_V2_STORY_ID}:${id}`. Remplace `snapshotState`,
   `formatSnapshotValue`, `readLogicalLength`, `readNumber`, le `parseCqw` local de
   `resolveTemporaryOffset` et les 9 reconstructions de l’id.
4. **Constantes (`app/config/`).** `AUTHOR_TIME_TOLERANCE_MS = 1` avec
   `isSameAuthorTime(a, b)` (18 comparaisons dans les ponts, la façade player et la
   timeline) ; couches de superposition (1050, 1101, 1160, 1161) ; taille minimale
   du cadre (4 px).
5. **Code mort et démontage (C).** Retirer `patchDiffersFromBase` (tests migrés vers
   `modificationsFromDecorPatch`), le paramètre `snapshot` inutile de
   `resolveKeyframeInsertionPatch`, les doublons `resolveDecorEditBase` /
   `resolveDocumentDecorBase` et les branches identiques de `syncSelection`, les
   commentaires périmés. `destroy()` appelle le démontage du Selection Frame
   (`unmountSelectionFrame`, qui détruit aussi `zoneEditor` et désabonne
   `machine.subscribe`) au lieu d’en recopier une partie. `onPathActivate` reste :
   point d’entrée de la sélection du tracé, à construire.

**Acceptation 3a** : tests ciblés (timing : segment droit, à chemin, mode tangente,
transition plus courte que l’intervalle et `before` ; couches : la valeur de palette
à chaque KF égale l’extrémité compilée, y compris deux KF au même instant ;
démontage : plus d’abonnement ni de `zoneEditor` après `destroy()`), suite complète,
typecheck, build ; Safari MCP sur une scène de test : édition palette sur un KF et
entre deux KF, déplacement au cadre sur un segment droit et sur un segment à chemin
(ghosts, tangente), rotation, puis Undo/Redo, Seek, Play et rechargement.

**Étape 3a — résultat** (617 tests verts, typecheck et build propres) :

- `keyframe-transition.ts` : `resolveSegmentMotionPath`, `resolveSegmentTiming`,
  `resolveSegmentProgress` ; le Builder (chemin et horloge du `move`) et le pont
  (découpe du tracé, tangente, angle au début du geste) les consomment ;
  `resolveMotionEasing` est retiré. Reste de B1, laissé au chantier des transitions
  (seul à le rendre atteignable) : dans un segment à chemin, les tweens de style
  démarrent au KF source avec la durée de la fenêtre de transition.
- `decor-resolution.ts` : `resolveDecorLayers(scene, item, keyframe, canal)`, seule
  sélection des couches, utilisée par le style, l’offset et les classes du Builder et
  par `resolveEffectiveKeyframePatch` / `resolveEffectivePosePatch` du pont.
- `app/bridges/presentation-reading.ts` (id runtime, entrée présentée au bon temps,
  état et style du snapshot, longueurs, nombres, `transform-origin`, formatage) ;
  `app/config/author-time.ts` (`isSameAuthorTime`, 18 comparaisons) ;
  `app/config/overlay-layers.ts` ; `MIN_FRAME_SIZE_PX`.
- Code mort retiré (`patchDiffersFromBase`, paramètre `snapshot`, branches
  identiques) ; `resolveDecorEditBase` = base documentaire + état présenté ;
  `destroy()` et le changement d’hôte passent par `unmountSelectionFrame()`.
- Tests : `builder-v2/segment-timing.spec.ts`, `builder-v2/decor-cascade.spec.ts`
  (accord palette/Builder à chaque KF, deux KF au même instant), démontage dans
  `decor-editor-bridge-integration-v2.spec.ts` (échoue avec l’ancien démontage).
- Safari MCP, copie de « Rotation — scène neuve » supprimée ensuite : cadre aligné
  sur l’item (segment droit, segments à chemin) ; palette entre deux KF → KF décor
  ne portant que l’épaisseur ; déplacement sur un KF, et entre deux KF d’un segment
  à chemin (KF créé, chemin découpé) ; rotation à l’intro (décor initial) ; Undo,
  Redo, Play, Pause, Seek sans écriture ; rechargement conservé.
- **Écart constaté, antérieur à 3a** : sur « Départ décalé » (mode tangente, KF de
  fin avec `rotationOrigin` 0,79/0,31 et hauteur différente), entre les KF le centre
  du cadre s’écarte de l’item (9 px à 3 s, 23 px à 4,2 s), à taille égale. Le même
  écart apparaît avec l’ancien lecteur du snapshot ; horloge et cascade sont
  inchangées pour ce segment. Piste : interpolation de l’origine de rotation dans la
  projection du cadre. À analyser avec `frame-projection` (3b).
- Specs à consolider après la revue manuelle : horloge des segments et cascade
  unique (spec d’intégration, « Autorité temporelle » et « Données et projection »).

**Étape 3b — avancement** (622 tests verts, typecheck et build propres) :

- Fonctions de module du pont réparties dans `app/bridges/decor-edit/` :
  `decor-target.ts` (cible, alignement), `decor-patches.ts` (cascade, patches du
  snapshot, insertion, lecture des zones), `decor-commands.ts` (commandes
  d’écriture), `frame-delta.ts` (géométrie des gestes du cadre). Les tests importent
  ces modules ; pas de baril.
- Vues retirées du pont : `DecorEditorRegion` possède la barre Zone/Bloc
  (`decor-inspector/authoring-tools.tsx`), les onglets Décor / Capsule-Scène, les
  réglages « Placement racine » (`decor-inspector/root-settings.tsx`) et les hôtes
  où le pont monte la palette et l’éditeur `CapsuleDef`. Règles d’affichage pures
  dans `decor-inspector/decor-inspector-state.ts` (testées) ; actions par la façade
  (`setAuthoringMode`, `toggleOffsetGesture`, `toggleZonesInBlockMode`,
  `toggleZonesVisible`, `setRootPlacementMode`). L’onglet affiché est un état de la
  région, transmis au pont par `setInspectorPanel` (visibilité de la grille de
  zones) ; verrouillage lu sur l’état `playing`/`creating` du contrôleur (M4 pour
  ces vues).
- Safari MCP, sans écriture : onglet « Scène » et réglages racine sans sélection,
  palette pour un item, bascule Zone/Bloc, outils verrouillés pendant la lecture.
  Non vérifié faute de capsule dans la scène : onglet « Capsule » et grille de
  zones de la capsule ; l’utilisateur fera une série de tests sur les capsules après
  ce plan (les défauts corrigés ici les empêchaient jusqu’à présent).
- `decor-edit/zone-surface-binding.ts` : classe `ZoneSurfaceBinding` (Zone Editor,
  état, visibilité, commits, sélection) avec ports explicites ; `activeZoneCapsuleId`
  et `hasZoneSurface` en fonctions pures. Safari MCP (copie en grille fine, supprimée
  ensuite) : en mode Zone, grille, zones et libellés visibles et éditables ; en mode
  Bloc, masqués et inertes ; aucune écriture.
- `decor-edit/frame-projection.ts` (cadre logique, pixels, patch d’offset) et
  `decor-edit/motion-projection.ts` (paire de KF du geste, `ActiveMotion`, commandes
  de chemin) : fonctions sans état de la closure ; `resolveDocumentDecorBase` rejoint
  `decor-patches.ts`. Pont : 3 524 → 2 560 lignes.
- Reportées en 3d : les projections qui lisent l’état du geste (`displayFramePx`,
  `authorFramePx`, insets, `activeMotion`, temps auteur : segments et ghosts,
  tangente, preview, commits de geste). Les extraire avant la machine figerait des
  signatures que la machine remplacera.
- Safari MCP après extraction (copie supprimée ensuite) : déplacements alignés au KF1
  et au KF2 pendant et après le geste, palette écrite dans le décor initial, lecture.

**Étape 3c — résultat** (625 tests verts, typecheck et build propres) : le pont Décor
et `ZoneSurfaceBinding` n’envoient plus aucun événement brut au contrôleur.
Opérations nommées de `EditorActionsFacade` : `commitDecorEdit` (une édition Décor,
une étape Undo), `abortDecorEdit`, `setCapsuleDef`, `setItemRotationMode`,
`setZonesSurface`, `selectZone` ; la sélection d’un KF avec seek est une seule
fonction du pont (`selectKeyframeAt` : façade + `requestAuthorSeek` de la
coordination). La façade devient un paramètre obligatoire du pont ; les tests la
fournissent. Test : `tests/app/editor-actions-decor.spec.ts`. Safari MCP (copie
supprimée ensuite) : déplacement, palette, deux Undo revenant à l’état initial.
Restent hors 3c : 5 envois de la coordination, 2 du pont player, 2 du pont de la
timeline (transport et cycle de vie : tranche 4).

**Étape 3d — design de la machine de session Décor** (à valider avant implémentation)

Fichier : `app/bridges/decor-edit/decor-edit-session-machine.ts` (machine XState pure,
sans DOM). Le pont la crée avec `machine.provide({ actions })` : les effets (preview
runtime, commit par la façade, palette, cadre) restent des fonctions du pont, appelées
comme actions de la machine. `actor.send` est synchrone : une intention de l’auteur
produit son effet sur l’item dans le même tour (principe directeur), seul le commit
attend une frontière.

Régions parallèles :

| Région         | États                                                                                 | Remplace                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `edit`         | `idle` · `pending` (édition palette en attente, cible exacte ou temporaire)           | `pendingCommands`, `pendingTemporaryDecorCommit`, `decorEditStates`, `snapshotPreviewActive`                                                                                      |
| `gesture`      | `idle` · `active` · `cancelled` (Échap pendant le geste, jusqu’au relâchement)        | `frameGestureBasePx`, `…Kind`, `…HasNetDelta`, `…Cancelled`, `…BaseDecorState`, `…BaseAuthorRotate`, `…BaseAuthorFrame` ; les 9 remises à zéro deviennent une seule sortie d’état |
| `presentation` | `live` · `awaitingPresentation` (commit envoyé, preview gardée jusqu’à `seekApplied`) | `snapshotCommitAwaitingPresentation`, `frameCommitCandidatePx`                                                                                                                    |
| `projection`   | `followsSelection` · `followsTime`                                                    | `seekProjectionActive`                                                                                                                                                            |

Contexte : `edit` (registre des modifications par `itemId`+temps, commandes en attente,
KF temporaire en attente), `gesture` (un objet unique : base affichée, type, delta net,
base de décor, angle et cadre auteur de départ), `commitCandidate`, `lastPreview`
(`accepted` : résultat de la dernière preview, lu par `previewFrame` après
`applyPatch` — le canal `lastPreviewAccepted` devient un champ explicite, toujours
synchrone).

Événements : `DECOR_CHANGED` (palette ou cadre, via `onDecorChange` de dedit : un seul
circuit), `INTERACTION_END`, `GESTURE_PREVIEW` / `GESTURE_DROP` / `GESTURE_CANCEL`,
`ESCAPE`, `SELECTION_CHANGED`, `DOCUMENT_CHANGED` (mutation externe), `SEEK`,
`SEEK_APPLIED`, `PLAY_REQUESTED`, `SCENE_LOADED`, `SCENE_REVERTED`. Les frontières
d’édition de la spec (sélection, seek, mutation externe, lancement de lecture,
`notifyInteractionEnd`) sont les transitions qui sortent de `edit.pending` avec
l’action `flush` ; Échap et `pointercancel` en sortent avec `abort`.

Restent hors machine : les projections (cadre auteur et affiché, insets, segments,
ghosts, `activeMotion`), recalculées par `syncSelection` ; montages et abonnements ;
`lastKnownTimelineMs` (temps auteur reçu). M4 : `playbackActive` et
`activeCreationMode` sont lus sur l’état du contrôleur, plus copiés.

Ordre (chaque pas garde le comportement, tests et Safari MCP) :

1. Région `gesture` : les 9 variables et leurs remises à zéro.
2. Région `edit` : registre des modifications, commandes et KF temporaire en attente
   dans le contexte ; `idle`/`pending` dérivé de ces données. `flushNow`/`abortPhase`
   lisent l’instantané, envoient `FLUSHED`/`ABORTED`, puis exécutent les effets dans
   le même ordre qu’aujourd’hui : le commit traverse le contrôleur et revient de façon
   synchrone dans le pont (`sceneCommitted` → `syncSelection`, qui relit le registre),
   donc l’entrée est effacée avant le commit. `DECOR_CHANGED` est reporté au pas 3,
   avec la preview explicite.
3. Région `presentation` et `lastPreview` explicite.
4. Région `projection`, et M4.
5. M6 : la capture différée du pont de la timeline (`pendingSnapshotCaptures`)
   passe par la même machine, via un port de la coordination qui remplace
   `decorPreview`.
   Reporté en tranche 4, avec les autres changements de la coordination.
6. 3e : D-HORS-PLAGE — repris dans le [plan des bornes intro/outro](./2026-11-25-bornes-intro-outro-plan.md)
   (B-5, action 4), avec le modèle des bornes dont il dépend. Design initial
   (remplacé par ce plan) :
   - **Plage d’existence** : bornes réelles (premier et dernier KF de pose) ou
     virtuelles. Les virtuelles ne sont calculées que par la timeline
     (`virtualKeyframes` de `sequenceEditorMachine`) ; un port en lecture de la
     coordination, `getItemLifetime(itemId)`, les expose au pont Décor (un seul
     calcul, pas de copie de `computeVirtualKeyframes`).
   - **Cadre** : au premier aperçu d’un geste hors plage, la session passe en
     `gesture.relocating`, ignore les aperçus, demande
     `coordination.requestAuthorSeek(borne)` ; à `SEEK_APPLIED`, la projection est
     recalée sur la borne, la base du geste est capturée et le geste continue avec
     le delta courant du pointeur.
   - **Palette** : une édition hors plage est retenue, la tête est recalée, puis
     l’édition est rejouée sur la borne à `SEEK_APPLIED`.
   - **Borne virtuelle** (point à confirmer, recommandation) : le commit la
     matérialise en KF réel par la timeline (`KEYFRAME.ADD`, comme le double-clic
     sur la borne, spec de distribution §9.2), puis écrit son décor propre.
   - Questions ouvertes : recaler dès le `pointerdown` (le cadre saute avant tout
     mouvement) ou au premier mouvement (un simple clic ne recale pas) ; pour la
     palette, recaler à `input` ou seulement à `change` (un champ couleur émet
     `input` en continu).

Avancement :

- Pas 1 fait (en attente de revue manuelle) : `decor-edit-session-machine.ts`, région
  `gesture` (`GESTURE_START`, `GESTURE_DELTA`, `GESTURE_ESCAPE`, `GESTURE_RESET`,
  `GESTURE_END`). Les 7 variables `frameGesture*` et leurs 9 remises à zéro sont
  remplacées par un objet `FrameGesture` et les sorties d’état. Le recalage de la
  projection (`GESTURE_RESET`) garde l’annulation par Échap tant que le pointeur est
  enfoncé ; le démontage du cadre termine le geste (avant : le drapeau d’annulation
  survivait et faisait ignorer le début du geste suivant). Tests :
  `tests/app/decor-edit-session-machine.spec.ts` ; 628 tests verts. Safari MCP (copie
  supprimée ensuite) : clic sans écriture, Échap puis mouvements ignorés et aucune
  écriture, `pointercancel` sans écriture ; déplacement, rotation et redimensionnement
  au KF2 (`source`) et déplacement au KF1 (`local`) alignés à chaque pas ; quatre Undo
  rendent une scène identique à l’originale.

- Pas 2 fait (en attente de revue manuelle) : région `edit` (registre, commandes et
  KF temporaire en attente dans le contexte ; `idle`/`pending` dérivé ; `FLUSHED`,
  `ABORTED`, `REVERTED`, `TEMPORARY_CLEARED`…). `flushNow`/`abortPhase` lisent
  l’instantané puis exécutent les effets dans l’ordre d’avant ;
  `temporaryEditPendingAt` remplace trois copies du même test. 632 tests verts.
  Safari MCP (copie supprimée ensuite ; « Fond » car seuls couleur et curseur
  prévisualisent à `input`, les champs numériques valident à `change`) : édition entre
  deux KF validée par changement de sélection (KF décor créé à 3,5 s), édition sur un
  KF validée par seek puis par Play, Échap sans écriture, trois Undo rendant la scène
  d’origine. Contrôle : même comportement avec le pont d’avant ce pas.

- Pas 3 fait (en attente de revue manuelle) : région `presentation` (`live` ·
  `awaitingPresentation`), `previewActive`, `commitCandidate` et
  `lastPreviewAccepted` dans le contexte (`DECOR_PREVIEW_REQUESTED` /
  `DECOR_PREVIEWED` : le résultat lu par `previewFrame` après `applyPatch` est un champ
  explicite, toujours synchrone). 635 tests verts. Safari MCP (copie supprimée
  ensuite) : cadre aligné sur l’item à 0, 40, 150, 600 et 1 200 ms après le relâchement
  au KF2 (`source`) et au KF1 (`local`) ; couleur temporaire en preview, KF décor créé
  par le seek suivant et couleur retrouvée au retour ; trois Undo rendent la scène
  d’origine.

- Pas 4 fait (en attente de revue manuelle) : région `projection`
  (`followsSelection` · `followsTime`) à la place de `seekProjectionActive` ; M4 :
  `playbackActive()` lit l’état `playing` du contrôleur et `activeCreationMode()` son
  contexte de création (XState livre les événements émis après la mise à jour de
  l’instantané). 636 tests verts. Safari MCP sur la scène de l’utilisateur, sans
  écriture : KF sélectionné par son ghost puis seek, cadre aligné ; cadre masqué
  pendant la lecture et réaligné après Stop ; mode création ouvert puis annulé par
  Échap. Le pont garde 22 `let` : montages, abonnements et projections.

- **Reste de 3d — fait, Safari fait sauf offset en zone, puis revue manuelle**
  (2026-11-25). Pont : 2 512 → 2 039 lignes ; tests, typecheck et build verts.
  - `motion-projection.ts` : paire du geste (`resolveGestureMotion`), segments et
    ghosts de l’overlay (`resolveMotionOverlaySegments`, `resolveMotionOverlayGhosts`,
    état du geste passé par `MotionProjectionView`), tangente et angle auteur
    (`targetUsesTangent`, `resolveTangentGestureProjection`,
    `displayFrameForAuthorFrame`, `authoredRotationAtGestureStart`, état passé par
    `GestureMotionContext`), découpe du chemin à l’insertion d’un point
    (`resolveWaypointSplit`).
  - `frame-projection.ts` : `authorFrameForGesture`, style de preview
    (`previewStyle`), candidat d’un geste (`resolveGestureCandidate` : cadre auteur,
    cadre affiché, base du patch).
  - `frame-delta.ts` : offset relatif à la zone (`zoneOffsetGesturePatch`).
  - Une seule voie de création de KF pour les quatre circuits de commit
    (`keyframeCreationAt`, `decor-commands.ts`) et une seule règle d’instant
    d’insertion pour les trois circuits du cadre (`temporaryInsertionTimeMs`,
    `decor-target.ts`) ; la palette garde sa règle (chaîne décor).
  - Reste dans le pont : l’orchestration (commits par la session et la façade,
    montage du cadre et des overlays, abonnements au contrôleur).
  - Safari sur « Test 3d (copie de Rotation) » : palette sur un KF et entre deux
    KF ; déplacement, redimensionnement, rotation au KF ; découpe d’un arc entre
    deux KF, en manuel et en tangente (rotation inerte entre KF en tangente,
    conforme à `path-tangent-orientation-spec.md`) ; Undo/Redo, Seek, Play.
    Document écrit identique à celui de HEAD pour les deux découpes. Reste :
    **offset en zone** (la copie n’a pas de zone).
  - Défaut préexistant relevé pendant ce contrôle et corrigé au Builder (décision
    utilisateur) : tween de couleur entre hex et oklch ; règle dans
    `editor-v2-integration-spec.md` (« Données et projection »), vérifiée en
    Safari (palette entre KF après une couleur oklch, Seek, Play sans erreur).

Acceptation à chaque pas : la suite complète, un test de la machine seule par
région (transitions et frontières), et Safari MCP sur une copie de scène :

- palette sur un KF et entre deux KF, puis frontière par sélection, seek et Play ;
- gestes de déplacement, rotation et redimensionnement, aux KF `local` et `source` ;
- Échap pendant un geste, `pointercancel` ;
- Undo et Redo ;
- KF créé depuis la timeline après une édition temporaire (pas 5).

### Machines d’état implicites à déclarer

Machines XState déjà déclarées : `controllerMachine` (`idle`/`creating`/`playing`),
`sequenceEditorMachine` et `decorEditorMachine`. Les cycles ci-dessous sont portés
par des variables mutables, des compteurs de révision ou des chaînes de promesses.

| #   | Cycle implicite                                                                                                                                                                                                                              | Porteur actuel                                                                                                                                                                                                                                                                                               | Proposition                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| M1  | Phase d’un geste de cadre ou de bloc : repos → preview → commit → attente de présentation, plus annulation                                                                                                                                   | pont Décor : `frameGestureBasePx`, `…Kind`, `…HasNetDelta`, `…Cancelled`, `…BaseDecorState`, `…BaseAuthorRotate`, `…BaseAuthorFrame`, `frameCommitCandidatePx`, `snapshotCommitAwaitingPresentation`, `snapshotPreviewActive`, `lastPreviewAccepted`, `blockMoveGestureActive` ; remise à zéro copiée 9 fois | Machine de geste du pont Décor (direction 1).                                                 |
| M2  | Édition Décor en attente : aucune → exacte en attente / temporaire en attente → flush aux frontières                                                                                                                                         | `pendingCommands`, `pendingTemporaryDecorCommit`, `decorEditStates` ; frontières dispersées dans six abonnements                                                                                                                                                                                             | Même machine que M1 (une phase d’édition avec ses frontières déclarées).                      |
| M3  | Projection du CS : suit la sélection ou suit le temps                                                                                                                                                                                        | `seekProjectionActive`, `lastKnownTimelineMs`, `lastSelectionKey`, `lastObservedScene`                                                                                                                                                                                                                       | État de la même machine.                                                                      |
| M4  | Copies locales d’états du contrôleur                                                                                                                                                                                                         | `playbackActive`, `activeCreationMode` (pont Décor), `suspended` (overlay)                                                                                                                                                                                                                                   | À lire depuis le snapshot du contrôleur, plus de copie locale.                                |
| M5  | Cycle de l’instance player : vide → construction(révision) → sonde des défauts → publiée → seek ; lecture en file                                                                                                                            | `scene-player-bridge` : `rebuildRevision`, `seekRevision`, `playbackRequestRevision`, `rebuildInFlight`, `pendingPlayRequest`, `seekInFlight` ; garde répétée 4 fois                                                                                                                                         | Machine de cycle de scène (acteur appelé, `fromPromise` pour build et seek).                  |
| M6  | Capture de KF différée jusqu’au seek acquitté                                                                                                                                                                                                | `sequence-editor-bridge` : file `pendingSnapshotCaptures`, `requestedSnapshotTimeMs`, `committingDeferredCapture`                                                                                                                                                                                            | État « attente de seek » déclaré.                                                             |
| M7  | Gestes de la timeline hors machine : glisser de KF (surface et écouteurs DOM en parallèle de l’état `dragging-keyframe`), scrub de la tête de lecture (le type `dragging-playhead` est déclaré mais jamais utilisé), glisser d’un KF virtuel | `sequence-editor/mount.ts`                                                                                                                                                                                                                                                                                   | Dans `sequenceEditorMachine`, avec annulation (corrige E4).                                   |
| M8  | Passage de main à la pause et au rewind : en lecture → en pause → temps adopté                                                                                                                                                               | `EditorCoordinationBridge` : chaînes `.then`, lecture de `machine.getSnapshot().value` dans la promesse                                                                                                                                                                                                      | Sous-état de `playing` dans le contrôleur.                                                    |
| M9  | Changement de scène : enregistrement → chargement → activation                                                                                                                                                                               | Trois endroits : `switchingScene` (local à `EditorMenuRegion`), `EditorActionsFacade.selectScene` (async), `EditorScenePersistence.flush` ; le contrôleur l’ignore                                                                                                                                           | État du contrôleur (la spec exige déjà de bloquer le catalogue pendant ce parcours).          |
| M10 | Persistance : prêt/erreur, écriture en cours/en attente par scène, suppression en cours                                                                                                                                                      | `EditorScenePersistence` : `status`, `writeQueues`, `pendingSnapshots`, `deletingSceneId`, `activation`                                                                                                                                                                                                      | À déclarer si M9 passe au contrôleur ; sinon garder la classe et rendre ses états explicites. |

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
  _Décision à prendre_ : refuser la commande en préservant l’acteur (résultat
  d’erreur ou diagnostic), et désactiver aussi les contrôles en amont.
- **E2 — Changement de parent d’un item placé en zone** (confirmé à la lecture,
  à confirmer dans le navigateur). `attachItem` ne touche pas à `Decor.zoneId`. Un
  bloc tracé en grille fine (racine, zone racine) et déposé dans une capsule
  produit `EDITOR_V2_ZONE_PARENT_MISMATCH` : le rebuild échoue, le player garde
  l’ancienne scène, et la validation SQLite lève une erreur. _Manque de contrat_ :
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
  _À qualifier par un test._
- **E6 — Le copy-on-write a trois définitions différentes du « décor
  partagé »** : `isDecorSharedByAnotherReference` (pont : ignore `rootDecorId` et,
  hors `path`, `initialDecorId`), `initialDecorIsShared` (`setCapsuleDef`) et
  `foreignDecorIds` (`setItemRotationMode`). Élargit D-C. De plus, `KEYFRAME.ADD`
  partage volontairement le décor adjacent, y compris `initialDecorId`.
- **E7 — Le tracé d’une plage efface les poses des bornes.** `CLIP.DRAW_END`
  supprime les KF d’entrée et de sortie, puis les recrée avec un décor vide :
  géométrie et habillage de ces bornes sont perdus. _Question_ : remplacement
  voulu, ou conservation des décors ?
- **E8 — La timeline recalcule la distribution des capsules à sa façon**
  (`computeVirtualKeyframes`, « même formule que `resolveCapsule` »).
  - La racine est codée en dur `card` / `stagger 0`, alors que le Builder lit
    `rootCapsule.kind` et `rootCapsule.distribution`.
  - L’ordre vient de `displayConfig.capsuleOrder` (constante `forward`), pas de
    `meta.capsuleOrder`, que ni le Builder ni la timeline ne lisent.
  - **Corrigé (2026-11-25)** par la résolution unique des bornes
    ([plan des bornes](./2026-11-25-bornes-intro-outro-plan.md), action 1).
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

- **E11 — Un seek vers le dernier temps relayé n’atteint jamais le player**
  (relevé par l’utilisateur lors de la revue manuelle, corrigé). Après une
  lecture complète, `lastPlayheadMs` (`sequence-editor/mount.ts`) restait au dernier
  temps relayé (0) pendant que le temps adopté en fin de lecture (5 000 ms) ne passait
  pas par le relais. Un clic sur le ghost du premier KF, ou un retour de la tête
  de lecture à 0, était jugé « inchangé » : la tête de lecture sautait, les items
  restaient à leur pose finale. Le commentaire du bouton Stop décrivait ce piège et
  ne le contournait que pour Stop. Correction : le temps adopté à la sortie de lecture
  (`playheadOrigin: 'reconciled'`) devient la référence du relais. Tests :
  `sequence-editor/playhead-relay.spec.ts`. Safari MCP : après une lecture complète,
  clic sur le ghost, Stop et retour de la tête de lecture à 0 replacent les trois
  items sur leurs poses initiales, sans écriture (en attente de revue manuelle).

- **E12 — Un geste du cadre de sélection sur un item sans KF réel est perdu** (corrigé avec D-NAISS)
  (relevé par l’utilisateur, confirmé dans Safari MCP). Texte créé en mode libre,
  sans KF, tête de lecture à 2 s : une édition de palette est bien écrite dans le
  décor initial (révision 2 → 3, aucun KF créé), mais un déplacement au cadre de
  sélection ne produit aucune écriture (révision inchangée, position inchangée).
  Cause : `commitMotionDrop` n’accepte une cible sans KF que « temporaire » (entre
  deux KF réels) et renvoie `null` pour la cible « état initial » (`keyframeId`
  nul, avant le premier KF ou sans KF), que `resolveTarget` produit pourtant et que
  la palette sait écrire. Même cause pour le redimensionnement et la rotation.
  Contredit D-C : l’état initial et l’intro sont un seul état. Voir D-NAISS.
  Correction : `commitMotionDrop` accepte la cible « état initial » et écrit le
  décor initial (`setItemDecor` avec `keyframeId` nul), comme la palette. Test
  d’intégration : `decor-editor-bridge-integration-v2.spec.ts`.
  Création à la tête de lecture : `EditorActionsFacade.createItem` écrit l’intro à
  `introTimeMs` (`EditorCoordinationBridge.getAuthorTimeMs`) en une seule
  transaction ; test `tests/app/editor-actions-creation.spec.ts`.
  Safari MCP (scène de test supprimée ensuite, en attente de revue manuelle) :
  texte créé avec la tête de lecture à 2 s → un KF d’intro réel à 2 000 ms sur le
  décor initial, outro virtuel ; déplacements au cadre de sélection à 2 s, 4 s et
  1 s (avant l’intro), puis édition de l’épaisseur par la palette à 1 s et à 4 s :
  chaque geste écrit dans le décor initial (une révision par geste), toujours un
  seul KF et un seul décor. Observation : avant son intro, le cadre de sélection
  suit encore l’item et accepte un geste, alors que l’item n’existe pas à ce temps ;
  la règle est décidée dans D-HORS-PLAGE.

- **E13 — Modifier le contenu d’un texte échoue à la sauvegarde** (relevé par
  l’utilisateur, corrigé). La persistance SQLite refusait le document :
  `$["scene"]["contents"][…]["source"] (undefined)`. Cause : `patchToContentArgs`
  (pont Décor) recopiait chaque champ du `Content` un par un, et écrivait ceux qui
  n’existent pas (`source`, `mediaId`, `lang`, `waveform`, `cues`) comme des clés
  valant `undefined` ; le garde `assertJsonCompatible` refuse ces clés. Défaut
  antérieur à la revue, présent dès qu’un contenu texte est modifié par la palette
  (texte ou `textAutoSize`). Correction : le patch est fusionné sur les champs
  existants du contenu (`{ ...existingFields, type, text?, textAutoSize? }`), sans
  énumération de champs ni clé absente. Test :
  `decor-editor-bridge-integration-v2.spec.ts` (« keeps the document
  JSON-compatible… », onglet Contenu, puis `assertJsonCompatible`). Safari MCP
  (scène de test supprimée ensuite, en attente de revue manuelle) : texte créé, puis
  modifié et « Auto » activé, « Modèle auteur sauvegardé dans SQLite. », contenu
  persisté `{ id, type, text, textAutoSize }`.

- **E14 — Au KF de fin d’un segment à chemin, le geste du cadre déplace l’item deux
  fois** (relevé par l’utilisateur sur « Nouveau texte », KF2 ; corrigé, en attente de
  revue manuelle). Régression déjà corrigée plusieurs fois : le test d’intégration
  exigeait la matrice en `source` et passait, car jsdom ne recalcule pas la pose
  runtime ; seul le navigateur montrait le double déplacement. Pendant un déplacement ou une rotation, le cadre suit le
  pointeur mais l’item bouge du double ; le commit au `pointerup` réaligne tout.
  Cause : à la fin d’un `move`, CodPlay présente l’item en représentation `source`,
  dans son nœud structurel, dont la pose suit les coordonnées du snapshot (`x`, `y`,
  `rotate`…). La preview envoie à la fois ces coordonnées (le cadre bouge) et la
  matrice `inverse(poseRuntime) × cadreAffiché` calculée contre la pose d’avant
  (l’ancre rebouge du même delta). En représentation `local` (rendu par le
  matérialiseur du `move`), le snapshot ne déplace pas le cadre et la matrice porte
  seule le candidat : aucun défaut. La spec de présentation (« Présentation et
  preview ») suppose une pose runtime inchangée par la preview ; ce n’est vrai qu’en
  `local`. Preuve (Safari MCP, copie de la scène supprimée ensuite) : écart cadre/item
  de 20 px par pas de 20 px en `source` au KF2, nul en `local` au KF1 et entre les KF ;
  sans la matrice en `source`, déplacement et rotation restent alignés pendant le
  geste. Correction : `itemPreviewTransform` (`item-presentation/item-preview.ts`)
  reçoit l’item présenté et porte seul la règle (aucune matrice en `source`) ; spec
  de présentation amendée (« Présentation et preview »). Tests : la règle par
  représentation (`item-component.spec.ts`), et les patches de preview en `source`
  sans matrice pour la rotation, le déplacement et le redimensionnement
  (`decor-editor-bridge-integration-v2.spec.ts`). Safari MCP sur une copie de la scène
  (supprimée ensuite) : au KF2, déplacement, rotation et redimensionnement alignés à
  chaque pas du geste ; au KF1 (`local`), déplacement aligné.

- **E15 — « Manuel » saute à la première lecture qui suit une correction**
  (relevé par l’utilisateur, fréquent, non reproduit). L’item n’est pas touché ;
  les lectures suivantes sont justes. Non reproduit dans Safari MCP (trajectoires
  de quatre items enregistrées image par image, première et deuxième lecture
  comparées, écart ≤ 1 px) : après rechargement ; après une édition, Stop puis
  lecture. Le cas « lecture lancée aussitôt après le geste, reconstruction en
  cours » n’a pas pu être mesuré jusqu’au bout. Piste principale : le cycle
  implicite de l’instance player (M5 : `rebuildInFlight`, `pendingPlayRequest`,
  sonde des défauts CSS sur une occurrence native) quand Play arrive pendant la
  reconstruction ; défaut dépendant du timing, cohérent avec son caractère rare.
  À instrumenter et à fermer avec la machine de cycle de scène (tranche 4), dont
  les transitions rendent cet ordre explicite. Après la correction E16 du cœur
  (interpolation des poses), première lecture juste après une édition au cadre,
  relevée à chaque image : échelle 1 pour les quatre items ; les mesures
  antérieures ne comparaient que les centres et ne pouvaient pas voir un
  rétrécissement. Hypothèse : le « saut » était ce rétrécissement transitoire. À
  confirmer par l’utilisateur à l’usage avant de clore.

- **E16 — L’item rétrécit quand il tourne, après le glisser d’un KF** (relevé par
  l’utilisateur sur « Tangente », régression récurrente ; reproduit). Tête de lecture
  sur le KF médian, KF glissé vers la gauche dans la timeline : la tête se retrouve
  entre deux KF, le cadre reste juste (121 × 81, rotation lue), mais la pose écrite
  par le player sur le cadre de mouvement a une échelle de 0,849 (0,132 à 3 s) ; un
  peu plus tard, aux mêmes instants, l’échelle redevient 1. Deux couches :
  - **Cœur CodPlay** : `interpolateMotionPose` (`runtime/motion/motion-pose.ts`)
    interpole la matrice 2×2 composante par composante entre les poses de borne ;
    `alignMotionPoseToTangent` la tourne ensuite sans corriger son échelle. Deux
    bornes de rotations différentes donnent une pose rétrécie (Δ = 64° à mi-course :
    cos 32° ≈ 0,848). Défaut général, indépendant de l’éditeur (tout `move` entre
    deux poses tournées différemment). Correction robuste : interpoler une
    décomposition (rotation au plus court arc, échelles, cisaillement) puis
    recomposer. **Corrigé dans le cœur** (autorisé, fait sur `develop`, remonté par
    rebase) : spec CodPlay `motion-frame-v2-spec.md`, « Interpolation de la pose ».
    Safari MCP (copie supprimée ensuite) : après le glisser du KF médian de
    « Tangente », échelle 1 à 1,9 s et à huit instants entre 1,3 et 4,5 s, boîte du
    cadre identique à celle de l’item.
  - **Éditeur** : en régime normal, les deux bornes ont la même rotation et l’échelle
    reste 1 ; juste après la reconstruction due au glisser, elles diffèrent
    (≈ 92° à 1,9 s). Capture des bornes dans un état transitoire après rebuild :
    même famille que E15 (saut à la première lecture après une correction), à
    instrumenter avec le cycle du player (M5, tranche 4). Après la correction du
    cœur, Safari MCP (copie supprimée ensuite) : glisser du KF médian de « Tangente »,
    puis deux passages de six seeks (0,6 à 4,4 s) sur quatre items (orientés sur la
    tangente et rotation manuelle) : rotation, échelle et position identiques entre le
    passage juste après la reconstruction et le suivant. La capture transitoire n’a
    plus d’effet visible ; E16 est clos.

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
  mais cela lie le pont au nœud rendu. _Pour le lot 3_ : faire publier cette
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
