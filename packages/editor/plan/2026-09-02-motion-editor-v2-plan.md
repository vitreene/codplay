# Plan V2 — éditeur de mouvement

**Statut : En cours — P0, P1, P3-C, P4 et P5 implémentés, P2 mouvement/ghosts avancé, P6 en validation partielle**
**Cible :** `ed2` avec la façade CodPlay V2
**Périmètre :** déplacement d’un item à l’intérieur de sa capsule parente, sans
reparentage ; cette tranche ouvre aussi la mise en cohérence ciblée du
sequence-editor (P3-C), sans refonte générale.

## 1. Autorité et documents

- Les contrats V2/ed2 sont normatifs ; les versions V1, leurs API et leurs
  circuits ne le sont pas.
- [Modèle ed2](./app/2026-07-11-ed2-document-model.md)
- [Contrat `dedit` V2](./2026-07-07-dedit-spec.md)
- [Plan/spec du sequence-editor](./2026-06-11-sequence-editor-grid-spec.md)
- [Spec capsule](./2026-07-08-capsule-spec.md)
- [Contrat CodPlay V2 des trajectoires](../../codplay/plan/move-contract-plan.md)
- [Note de discussion et historique de la révision](./notes/2026-09-03-motion-editor-v2-discussion.md)

Le plan décrit les actions, les portes et les critères d’acceptation. Les
raisons, divergences et observations sont dans la note liée, pas dans ce fichier.

## 2. Contrat cible à valider

### 2.1 Vie de l’item

1. L’item est inséré dans une capsule qui fournit ses règles d’apparition et de
   disparition.
2. Si la capsule ne définit aucune contrainte particulière, l’insertion crée un
   KF réel d’apparition et une sortie virtuelle héritée.
3. Dans la capsule racine, la vie par défaut couvre toute la scène. Dans une
   capsule explicite, elle suit sa distribution `start`/`end`.
4. Les bornes héritées sont affichées sur la timeline comme une valeur spéciale.
   Elles ne deviennent des KFs appartenant à l’item qu’après un déplacement
   explicite ; ce déplacement raccourcit la vie de l’item.
5. Avec un seul KF réel, l’item conserve sa dernière pose jusqu’à la sortie
   virtuelle. Un décor de sortie peut donc ne porter qu’une transition de
   visibilité. Il ne reçoit une nouvelle pose qu’après édition explicite.
6. Un Play, un Seek, un rebuild ou une projection d’overlay ne matérialise jamais
   une borne virtuelle.

### 2.2 Geste et KFs

Le CS porte un seul geste d’édition. La séparation centrale/bord de 12 px
est neutralisée pour cette version ; le module est conservé, dormant et
réutilisable.

| Contexte du playhead | Opération documentaire |
| --- | --- |
| Sur un KF réel, y compris le dernier | Mettre à jour le décor de ce KF au même `timeMs` (copy-on-write si nécessaire). Ne pas créer ni remplacer de KF. |
| Entre deux KFs | Créer un KF au `timeMs` courant avec le décor capturé (pose et propriétés modifiées). Son décor porte la transition entrante et son `path` éventuel. |
| Nouveau geste sur le KF qui vient d’être créé | Mettre à jour le décor porté par ce KF au même `timeMs` (copy-on-write si nécessaire), sans remplacer ni dupliquer le KF. |
| Sur une borne virtuelle | La matérialiser en KF réel et raccourcir la vie de l’item. |

La règle d’édition couvre toute propriété de `Decor` (pose, taille, rotation,
couleur, styles, classes, zone, custom ou path), pas seulement le
repositionnement. À un temps intermédiaire, une modification peut constituer le
candidat d’un KF ; lorsque ce KF est effectivement créé, la capture réunit les
valeurs interpolées et toutes les propriétés de décor modifiées. Le contenu reste
une donnée `Content` de l’item dans le modèle V2 ; sa variation temporelle
nécessiterait un contrat Content↔KF distinct, hors de cette tranche.

Le geste peut partir d’une pose temporaire ou interpolée : `isTemporary` n’est
pas un verrou de lecture. La capture devient persistante lors de la création du
KF ou du commit de la mise à jour de son décor.

### 2.3 Transition de position

- Aux extrémités de vie, les transitions nommées restent dédiées à la visibilité.
- Entre deux KFs, il existe une seule transition de position, portée par le
  décor du KF aval avec son `Decor.path` éventuel.
- Le point de début est facultatif et désigne la fenêtre de cette transition ;
  ce n’est pas une seconde structure documentaire.
- Sans point, l’interpolation couvre tout l’intervalle `A → B`.
- Avec point, `A` est maintenu jusqu’au point, puis la pose rejoint `B` ; la pose
  `B` reste ensuite stable jusqu’à la transition suivante.
- Le point ne sort jamais de `[A.timeMs, B.timeMs]`. Il suit le KF aval ; s’il
  est rapproché du KF amont, sa durée effective diminue au lieu d’inverser
  l’ordre temporel.
- La valeur provisoire de la fenêtre de mouvement est `500 ms`. Elle ne fixe
  jamais le `timeMs` d’un KF créé. Le défaut général SE de `400 ms` n’est pas
  réutilisé implicitement.
- L’easing et ses contrôles visuels seront ajoutés dans une tranche ultérieure.

### 2.4 Path, CS et artefacts

- `Decor.path` est optionnel et segment-local au décor du KF cible. Son absence
  signifie une droite.
- Le path, les ghosts et le CS sont des artefacts d’authoring hors scène ; ils
  ne sont ni des items ni des enfants de capsule.
- Le runtime CodPlay V2 reste l’unique résolveur de trajectoire. Le CS lit la
  pose affine numérique de `PresentationFrame` et ne reconstruit rien depuis le
  DOM, une AABB ou un lecteur de path parallèle.
- La sélection automatique d’un KF est différée à la fin d’un scrub ou à la
  pause : le contrôleur choisit le KF réel le plus proche dans une tolérance de
  `50 ms` pour l’unique item sélectionné, sinon il conserve l’item seul. Les
  seeks intermédiaires et Play ne ciblent aucun KF ; les bornes virtuelles sont
  exclues.
- Tous les trajets adjacents jusqu’au dernier KF sont visibles. Un seul path est
  actif et interactif ; les autres sont nettement plus discrets, avec une
  opacité basse et une couleur ambrée pâlie/désaturée, pointer-transparents et
  sans point médian.
- Pendant le geste de création d’un KF au milieu d’un segment `A → B`, l’aperçu
  remplace immédiatement ce trajet par les deux parties qui seront commitée :
  `A → C` puis `C → B`, où `C` est la pose déplacée. La première partie reste
  droite par défaut ; le path déjà porté par le KF `B` ne s’applique qu’à la
  seconde partie. Le tracé affiché avant le lâcher doit donc être identique au
  tracé projeté après la création de `C`, sans mutation documentaire pendant le
  geste.
- Tous les KFs réels de l’item sont projetés comme ghosts géométriques hors
  scène. Le ghost qui coïncide avec l’item présenté est masqué ; tous les autres
  restent visibles et cliquables pour rejoindre leur KF. Leur couleur conserve la
  même famille visuelle, devient pâle/désaturée et leur opacité décroît avec la
  distance temporelle au KF courant dans la chaîne. Cette variation de rendu ne
  modifie ni l’interactivité ni les données documentaires ; le ghost initial
  suit la même règle et reste translucide lorsqu’il est inactif.
- L’overlay conserve l’outline pointillé et le fond transparent. Le double-clic
  du point géométrique du path restaure la droite implicite.

## 3. Hors périmètre de cette tranche

- Refonte générale du sequence-editor ; la correction ciblée des bornes
  virtuelles et de leur matérialisation relève de P3-C.
- Reparentage, déplacement vers une zone de capsule, orientation/taille suivant
  la tangente et extension du core CodPlay non prévue par le contrat existant.
- Choix d’easing dans le décor, collisions temporelles, undo/redo applicatif,
  multi-sélection et options avancées de path.
- Toute seconde voie V1, tout lecteur de trajectoire parallèle ou toute mesure
  DOM par frame.

## 4. Découpage et portes

| Étape | Statut | Livrable / porte |
| --- | --- | --- |
| P0 — Contrat | Fixe | Contrat validé pour cette tranche : vie capsule, KF au playhead, mise à jour du décor et transition unique. La validation native reste une porte distincte. |
| P1 — Domaine pur | Fixe | Résolveurs purs et testables de vie réelle/virtuelle, alignement exact/entre KFs et fenêtre bornée ajoutés et utilisés par la projection des bornes de timeline ; le branchement de la fenêtre sur la projection/runtime reste réservé à P4. Aucun DOM, player ou document mutable. |
| P2 — Adaptateur CS | En cours | Un geste exact met à jour le décor du KF au même temps ; un geste entre KFs matérialise au playhead, puis réédite ce KF sans doublon. Pendant ce geste intermédiaire, l’overlay prévisualise déjà la coupure `A → C → B` qui sera commitée. Toute propriété du décor reste capturable ; overlay et ghosts restent hors document. La projection de tous les ghosts de l’item, leur activation et leur hiérarchie visuelle (couleur/opacité réduites hors segment actif) sont implémentées. La validation native et les cas encore hors tranche maintiennent P2 ouvert. |
| P3-A — Audit SE existant | Fixe | Audit statique terminé : capsule racine et capsules explicites, 0/1/2 KFs réels, bornes virtuelles, affichage, matérialisation et absence d’écriture lors de Play/Seek/resize sont distingués. |
| P3-B — Contrat SE | Fixe | Contrat validé après l’audit statique : valeurs spéciales, KF réel d’apparition + sortie virtuelle, transition unique, point facultatif et plateau. |
| P3-C — Implémentation SE | Fixe | Implémentation et tests terminés : capsule racine implicite, 0/1/2 KFs réels, matérialisation par double-clic ou glisser-déposer et non-écriture pendant Play/Seek/resize. La validation native reste P6. |
| P4 — Builder/runtime | Fixe | Compilation vers le graphe CodPlay V2 existant, `Decor.path` cible préparé par ACE et `PresentationFrame` commune à Play/Seek. Aucun `{to}` sans `from`, aucun `Move` structurel. La validation native reste P6. |
| P5 — Persistance | Fixe | Copy-on-write du décor cible, sérialisation, suppression/réordonnancement, capsules imbriquées et diagnostics de données invalides vérifiés. La validation native reste P6. |
| P6 — Validation native | En cours | Matrice réelle rejouée dans Safari Technology Preview sur l’unique serveur `localhost:5174` : scène, seek, ghost-click, Play/pause, resize, console et réseau validés ; la preuve native du drag/double-clic reste ouverte car le relais MCP ne les expose pas. |

## 5. Critères d’acceptation

1. Une insertion sans contrainte capsule produit un KF réel d’apparition et une
   sortie virtuelle ; une capsule spécialisée conserve ses propres règles.
2. Déplacer une borne virtuelle la matérialise et raccourcit la vie ; Play/Seek
   seuls ne l’écrivent pas.
3. Un geste ou une édition de décor sur un KF réel met à jour son décor au même
   temps. Entre deux KFs, toute propriété modifiée peut être capturée ; le KF
   créé au playhead est ensuite mis à jour par les gestes suivants, sans
   remplacement ni duplication du KF.
4. Un décor de sortie sans pose conserve la dernière pose définie jusqu’à la fin
   de vie ; l’édition explicite de la sortie est la seule exception.
5. La transition entre deux KFs est unique, optionnellement raccourcie par son
   point, et reste bornée par les KFs. Sans point, elle couvre tout l’intervalle.
6. Le décor du KF cible contient le `path` uniquement pour un trajet non droit ;
   aucune droite ne sérialise de champ `path`.
7. Le centre visuel de l’item, le CS, les ghosts et le path restent confondus
   après rotation, resize, seek et redimensionnement de page.
8. Tous les trajets sont visibles ; un seul est actif. Les trajets et ghosts
   non actifs sont nettement plus discrets par une opacité basse et une couleur
   ambrée pâlie/désaturée. Tous les ghosts des KFs réels sont projetés : celui
   qui est sous l’item est masqué, les autres sont visibles et cliquables, avec
   une variation légère et monotone de couleur/opacité selon leur distance
   temporelle au KF courant ; le ghost initial inactif conserve le même
   traitement réduit.
9. Play, Seek, rebuild et reprise après édition utilisent la même résolution
   runtime ; aucune instance n’est remplacée pour une simple lecture et aucune
   erreur de reconstruction n’apparaît en console. Play ne dérive pas de KF ; à
   la pause ou au relâchement du seek, le KF réel le plus proche est sélectionné
   dans la tolérance de `50 ms`, sinon seul l’item reste sélectionné.
10. Le parentage et l’ordre restent inchangés ; la persistance et le copy-on-write
    ne créent pas de path partagé par inadvertance.
11. L’échappement avant le lâcher n’écrit aucun KF, décor ou path. Les tests
    natifs de pointeur et tablette sont exécutés dans Safari Technology Preview.

## 6. Suivi

- Le baseline d’overlay/path existant est à requalifier contre ce contrat ; il ne
  constitue pas une implémentation acceptée.
- P3-A est terminé sur le périmètre statique : les cas racine/explicite et
  0/1/2 KFs sont distingués ; la spécification SE porte désormais ce contrat.
- Évidence au 2026-09-03 : les contrôles ciblés et la suite complète de
  l’éditeur (38 fichiers, 429 tests) passent avec la
  configuration Vitest de `packages/editor` ; le typecheck
  `packages/editor/tsconfig.json`, le build Vite et `git diff --check` passent
  également. La suite CodPlay V2 passe aussi (87 fichiers, 547 tests) avec son
  typecheck.
- La sortie naturelle de lecture est désormais réconciliée sur
  `scene.meta.durationMs` avant la réactivation du CS : une queue virtuelle de
  capsule ne peut plus laisser la projection sur un temps hors scène. La
  régression couvre cinq KFs réels créés par le chemin de création de l’overlay,
  leur déplacement et la fin de lecture ; cette reprise est couverte par la
  suite complète actuelle.
- La sélection temporelle est maintenant recalculée uniquement sur
  `SEEK_RELEASED` ou `TELCO_PAUSE_REQUEST` avec le temps auteur final ; Play et
  les seeks intermédiaires ne la dérivent pas. La tolérance de proximité est de
  `50 ms`, les bornes virtuelles sont exclues, et les régressions du geste unique,
  timeline et fin naturelle couvrent ce contrat.
- Le geste de déplacement unique est maintenant routé par l’alignement courant : un KF réel,
  y compris le dernier, est édité à son `timeMs` avec copy-on-write ; un playhead
  strictement intermédiaire crée un KF à son temps auteur, sans utiliser la
  fenêtre provisoire de `500 ms` comme temps de création. Le test d’intégration
  couvre aussi le geste répété sur ce KF, Échap, path, resize et conservation du
  parentage.
- Amélioration de preview au 2026-09-03 : lors de la création d’un KF au milieu
  d’une transition, le path source → cible est remplacé pendant le drag par les
  deux paths source → nouveau KF et nouveau KF → cible. Le premier est droit par
  défaut ; le second reprend le path segment-local de la cible, comme après le
  commit. Les tests overlay et intégration comparent le rendu avant le lâcher au
  rendu final et couvrent aussi une cible déjà courbe.
- Correction de hit-test au 2026-09-04 : au milieu d’une transition, la surface
  unique suit la pose interpolée visible et passe devant le point médian lorsque
  leurs zones se recouvrent. Le drag de l’item atteint ainsi le commit qui crée
  le KF au playhead et projette réellement `A → C → B`, au lieu d’être absorbé
  par l’édition du path.
- Hiérarchie CS au 2026-09-04 : la couche du `Selection Frame` passe au-dessus
  de l’overlay de déplacement. Le corps du CS reste pointer-transparent afin
  que la surface unique conserve le geste de déplacement, tandis que ses
  poignées de rotation, pivot et redimensionnement restent pointer-actives ;
  aucune zone de mouvement ne recouvre donc les contrôles ni les points du CS.
- Une régression d’intégration couvre désormais le dernier KF quand son décor est partagé : le
  déplacement conserve les deux KFs, ne modifie pas le décor du KF amont et crée le décor cible
  isolé par copy-on-write. La même vérification confirme qu’une seule surface de déplacement est
  montée et qu’aucune zone bord distincte n’est exposée.
- P4 est fixé côté builder/runtime : `buildSceneDocV2` produit le graphe V2 sans forme V1, le
  décor du KF cible porte le path préparé et `pathAnchor: 'center'`, tandis que la façade player
  adapte une `PresentationFrame` numérique commune à Play et Seek. Les tests builder, compilateur,
  player, bridge et rebuild couvrent aussi les tweens sans source et l’absence de déplacement
  structurel ; la preuve native reste la porte P6.
- P5 est fixé côté persistance : les suppressions de KF, d’item et de capsule ne retirent un décor
  ou un contenu que s’il n’existe plus aucune référence restante (`initialDecorId`, `rootDecorId`,
  KF ou item). Le round-trip contrôleur conserve le `Decor.path` segment-local, et le réordonnancement
  conserve son association avec le KF cible. Les cas de décor partagé, de capsule imbriquée et de
  données invalides sont couverts par les tests de commandes, builder et runtime.
- Correction d’interface au 2026-09-03 : le routage historique centre/bord de
  12 px reste conservé comme compatibilité dormante, mais l’overlay ne monte
  qu’une seule surface de déplacement pleine (`data-motion-move-zone`, sans
  découpe active ni zone de bord distincte).
- Correction de navigation au 2026-09-03 : les ghosts d’extrémité et les ghosts
  de chaîne convergent vers l’identifiant du KF, puis vers le même propriétaire
  de playhead que la timeline. La régression scene-player + sequence-editor
  vérifie sélection du KF, progression à `1 000 ms` et chrono à `1.0 s`.
- Le résolveur pur `resolveMotionTransitionWindow` formalise la fenêtre de
  mouvement : `500 ms` par défaut, clampée à l’intervalle source→cible, ou
  positionnée juste avant la cible avec `direction: 'before'`. Son branchement
  au builder/runtime est réservé à P4.
- P1 est désormais fermé côté domaine pur : `resolveMotionKeyframeAlignment`
  couvre les positions avant/exactes/entre/après les KFs sans muter l’entrée,
  `resolveMotionLifetime` distingue les bornes réelles des bornes virtuelles,
  et le calcul des bornes virtuelles de la timeline consomme ce résolveur. Les
  tests dédiés couvrent aussi les entrées vides/invalides, l’ordre non trié et
  les durées bornées ; aucune connexion builder/runtime n’a été introduite.
- La reprise native dans Safari Technology Preview sur le serveur existant
  `http://localhost:5174/` couvre le chargement réel de la démo, sélection et
  seek, Play/Stop/reprise après Stop, édition d’un décor sur KF réel, preview
  interpolée, restauration après seek, abandon par Échap, clic d’un ghost,
  chaîne de paths/ghosts, resize puis fin naturelle à `5.0 s`. Le cadre reste
  aligné sur l’item après resize ; le path actif est seul interactif ; la
  console et les requêtes HTTP en erreur restent vides.
- La porte native complète reste ouverte : le relais MCP disponible expose
  `click`, `type`, `keyPress` et `scroll`, mais pas de double-clic ni de drag de
  pointeur explicites. Deux clics relais n’ont pas créé de KF ; un événement
  DOM synthétique a vérifié la création au playhead et la matérialisation de la
  borne virtuelle, puis un clic natif a confirmé le KF `outro`. La création et
  le déplacement par pointeur/tablette ne sont donc pas qualifiés comme preuve
  native P6.
- P0, P1, P3-C, P4 et P5 sont implémentés et documentés. Le plan reste `En cours`
  jusqu’à la porte native P6 et à la clôture P2 ; aucun module n’est marqué
  `Fini` sur la seule base de tests jsdom.
- Après chaque étape, mettre à jour la spécification concernée, le statut de ce
  plan et les preuves d’acceptation. Ne pas marquer `Fini` sur un simple smoke
  test ou une simulation jsdom.
