# Plan V2 — éditeur de mouvement

**Statut : En cours — P0, P1, P3-C, P4 et P5 implémentés, P2 mouvement/ghosts avancé, P2-D et P2-E en cours, P6 en validation partielle**
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
- [Plan séparé du chantier builder Decor](./2026-09-04-decor-builder-projection-plan.md)

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
| Sur un KF réel, y compris le dernier | Mettre à jour le canal correspondant de ce KF au même `timeMs` (copy-on-write si nécessaire). Une édition de décor enrichit un KF `pose` existant ; un geste de pose promeut un KF `decor` existant. Ne pas créer ni remplacer de KF. |
| Entre deux KFs `pose` | Un geste du CS crée un KF `pose` au `timeMs` courant avec sa pose capturée et les propriétés de décor éventuellement modifiées. Son décor porte la transition entrante et son `path` éventuel. |
| Entre deux KFs `decor` | Une édition de décor crée un KF `decor` sparse au `timeMs` courant, sans contribution au canal `pose`, et ne coupe pas la trajectoire `pose`. |
| Nouveau geste sur le KF qui vient d’être créé | Mettre à jour le décor porté par ce KF au même `timeMs` (copy-on-write si nécessaire), sans remplacer ni dupliquer le KF. |
| Sur une borne virtuelle | La matérialiser en KF réel et raccourcir la vie de l’item. |

La règle d’édition couvre toute propriété de `Decor` (pose, taille, rotation,
couleur, styles, classes, zone, custom ou path), pas seulement le
repositionnement ; cette énumération est illustrative et ne constitue pas une
whitelist. À un temps intermédiaire, l’interface peut lire toutes les valeurs
interpolables présentes dans l’état résolu pour constituer son contexte d’édition ;
lorsque ce KF est effectivement créé, la capture ne sérialise que les propriétés
de décor réellement modifiées, chacune prenant pour base la valeur interpolée
courante. Une valeur non modifiée, y compris une valeur future ou non documentée,
reste absente du KF et suit la résolution habituelle. Le contenu reste une donnée
`Content` de l’item dans le modèle V2 ; sa variation temporelle nécessiterait un
contrat Content↔KF distinct, hors de cette tranche.

Le geste peut partir d’une pose temporaire ou interpolée : `isTemporary` n’est
pas un verrou de lecture. La capture devient persistante lors de la création du
KF ou du commit de la mise à jour de son décor.

### 2.2.1 Deux canaux temporels pour un item (P2-E — En cours)

Un item peut porter deux canaux de keyframes, sans devenir une interface à la
After Effects où chaque propriété aurait sa propre piste :

```ts
type KeyframeChannel = 'pose' | 'decor'
```

Le canal est une donnée explicite du KF ; il ne se déduit pas d’une whitelist
de propriétés `Decor`. Les documents existants qui n’ont pas encore ce champ
sont relus comme `pose` afin de préserver leur comportement historique ; toute
nouvelle écriture porte le canal explicitement.

- Un KF `pose` est un waypoint de la chaîne spatiale. Lorsqu’il est créé par un
  geste de pose au milieu d’un segment, il capture la pose complète exposée par
  le contrat de présentation, afin de fixer réellement le point de la
  trajectoire. Les champs actuellement projetés depuis `offset` en sont des
  exemples, pas une liste figée : la frontière des propriétés qui composent la
  pose reste ouverte et pourra évoluer (par exemple `rotation` peut sortir,
  `left` peut entrer). Il peut porter en plus un patch de décor sparse. Ce patch
  peut contenir toute propriété de `Decor`, présente ou future, sans liste
  fermée ; il reste absent pour une propriété non touchée.
- Tant qu’il reste `decor`, un KF ne contribue pas à la pose : il est un point
  de la chaîne d’habillage, pas un waypoint spatial. Cette règle est sémantique
  et ne fige pas aujourd’hui la liste des propriétés de pose. Il porte le patch
  de décor issu de l’édition utilisateur, avec la même règle sparse ouverte aux
  propriétés futures, et ne modifie ni la trajectoire ni les bornes de visibilité.
- Un KF `pose` qui porte aussi un patch de décor participe aux deux résolutions
  au même `timeMs`, mais il ne génère qu’un seul point visuel dans la timeline,
  dans la zone `pose`. Il n’existe pas de seconde pastille décor dupliquée pour
  ce KF.

Les chaînes sont résolues séparément :

- la chaîne `pose` relie uniquement les KFs `pose` adjacents ; un KF `decor`
  inséré entre `A` et `B` ne coupe donc jamais la trajectoire `A → B` ;
- la chaîne `decor` prend les KFs `decor` et les KFs `pose` qui portent un
  patch de décor. Un KF `pose` sans changement de décor n’y ajoute aucun état ;
- les bornes de visibilité restent celles de la chaîne `pose`. Un KF `decor`
  est borné par la durée de vie effective de l’item et ne peut ni l’ouvrir ni
  la prolonger.

Les gestes choisissent le canal sans ambiguïté :

- un geste du CS crée ou met à jour un KF `pose` ; s’il rencontre un KF
  `decor` au même instant, celui-ci est simplement transformé en KF `pose` au
  même instant, en conservant son patch de décor ;
- une édition de palette crée ou met à jour un KF `decor` lorsqu’il n’existe
  pas déjà un KF `pose` au même instant. Une édition de décor sur un KF `pose`
  enrichit ce KF au même instant ; elle ne crée pas de doublon ;
- à un temps strictement intermédiaire, la création d’un KF `pose` découpe la
  chaîne spatiale et celle d’un KF `decor` laisse la trajectoire inchangée.

La présentation conserve une seule ligne par item :

- lorsque les deux canaux sont présents, sa bande est divisée en une zone
  supérieure `decor` et une zone inférieure `pose` ;
- lorsqu’un seul canal est présent, aucune séparation n’est affichée et les
  points occupent la ligne normale ;
- les losanges gardent la même forme et le même langage visuel. La position
  verticale indique le canal uniquement lorsque les deux zones sont utiles ;
  aucun libellé ou habillage de propriété n’est ajouté ;
- seuls les KFs `pose` produisent des ghosts et des trajets géométriques. Les
  KFs `decor` restent des points temporels cliquables dans la timeline, pas des
  ghosts spatiaux.

La limite temporelle est donc locale au canal : le point d’une transition de
pose reste dans l’intervalle entre les deux KFs `pose` qui bornent le segment ;
une transition de décor reste dans l’intervalle entre ses deux événements de
`decor` (un KF `pose` portant du décor est un événement des deux chaînes).
Cette distinction ne permet pas de définir des sources et cibles discontinues :
chaque chaîne reste ordonnée et continue dans son propre domaine.

### 2.3.1 Projection du CS sur le content-box

Le CS, les ghosts et les chemins utilisent le `content-box` exposé par la pose
runtime : la bordure n'entre ni dans `width/height` ni dans le calcul des
dimensions du tracé. Le bridge projette l'inset physique gauche/haut dans la
matrice affine pour placer l'origine du contenu. Les `offset.x/y` restent dans
ce repère content-box ; le builder dérive la translation border-box nécessaire
au runtime et le bridge restaure ce repère lors de la lecture d'un snapshot.
Les variantes ouvertes `border`,
`border-width`, `border-style` et leurs déclarations physiques sont résolues
par un adaptateur pur de l'éditeur ; le core CodPlay et la carte ouverte de
`Decor` ne sont pas modifiés.

### 2.3 Transition de position

- Aux extrémités de vie, les transitions nommées restent dédiées à la visibilité.
- Entre deux KFs `pose` adjacents, il existe une seule transition de position,
  portée par le décor du KF `pose` aval avec son `Decor.path` éventuel. Les KFs
  `decor` intermédiaires sont ignorés par cette chaîne.
- Le point de début est facultatif et désigne la fenêtre de cette transition ;
  ce n’est pas une seconde structure documentaire.
- Sans point, l’interpolation couvre tout l’intervalle `A → B`.
- Avec point, `A` est maintenu jusqu’au point, puis la pose rejoint `B` ; la pose
  `B` reste ensuite stable jusqu’à la transition suivante.
- Le point ne sort jamais de `[A.timeMs, B.timeMs]`, où `A` et `B` sont les KFs
  `pose` adjacents. Il suit le KF aval ; s’il
  est rapproché du KF amont, sa durée effective diminue au lieu d’inverser
  l’ordre temporel.
- La valeur provisoire de la fenêtre de mouvement est `500 ms`. Elle ne fixe
  jamais le `timeMs` d’un KF créé. Le défaut général SE de `400 ms` n’est pas
  réutilisé implicitement.
- L’easing et ses contrôles visuels seront ajoutés dans une tranche ultérieure.

### 2.4 Path, CS et artefacts

- `Decor.path` est optionnel et segment-local au décor du KF `pose` cible. Son
  absence signifie une droite ; un KF `decor` ne peut pas en porter.
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
- Tous les trajets entre KFs `pose` adjacents jusqu’au dernier KF `pose` sont
  visibles. Un seul path est actif et interactif ; les autres sont nettement
  plus discrets, avec une opacité basse et une couleur ambrée
  pâlie/désaturée, pointer-transparents et sans point médian.
- Pendant le geste de création d’un KF au milieu d’un segment `A → B`, l’aperçu
  remplace immédiatement ce trajet par les deux parties qui seront commitée :
  `A → C` puis `C → B`, où `C` est la pose déplacée. La première partie reste
  droite par défaut ; le path déjà porté par le KF `B` ne s’applique qu’à la
  seconde partie. Le tracé affiché avant le lâcher doit donc être identique au
  tracé projeté après la création de `C`, sans mutation documentaire pendant le
  geste.
- Tous les KFs réels `pose` de l’item sont projetés comme ghosts géométriques
  hors scène. Le ghost qui coïncide avec l’item présenté est masqué ; tous les
  autres restent visibles et cliquables pour rejoindre leur KF. Les KFs
  `decor` n’ont pas de ghost géométrique. La couleur conserve la même famille
  visuelle, devient pâle/désaturée et son opacité décroît avec la distance
  temporelle au KF courant dans la chaîne. Cette variation de rendu ne modifie
  ni l’interactivité ni les données documentaires ; le ghost initial suit la
  même règle et reste translucide lorsqu’il est inactif.
- L’overlay conserve l’outline pointillé et le fond transparent. Le double-clic
  du point géométrique du path restaure la droite implicite.

### 2.5 Cohérence du décor interpolé et édition au playhead (P2-D — En cours)

- Après un `Seek`, l'interface `dedit` doit refléter le même état logique que l'item
  présenté au temps auteur courant, pour toute valeur de `Decor` que l'état résolu
  fournit, y compris une propriété future qui n'est pas encore décrite dans cette
  documentation. La couleur de fond n'est qu'un cas révélateur. Le rendez-vous de
  référence est `seekApplied` : le signal de demande de seek ne doit jamais alimenter
  la palette avec le snapshot du temps précédent.
- `instance.snapshot.get()` est la source de vérité pour les valeurs logiques du décor
  qu'il expose ; `instance.presentation.get()` reste réservé à la pose numérique du CS
  lorsque cette pose est fournie par le canal de présentation. Le DOM, la couleur
  calculée du nœud et l'apparence de la palette ne sont pas des sources de lecture.
- La frontière runtime → `DecorPatch` doit être ouverte : elle parcourt et transporte
  les propriétés réellement présentes dans l'état résolu ou dans un patch, sans
  whitelist de chemins connue à l'avance. Elle conserve le chemin canonique attendu
  par `dedit` et convertit génériquement les valeurs structurées vers le format du
  contrôle concerné. Toute nouvelle propriété doit donc suivre le même circuit sans
  nécessiter une modification de la liste des champs interpolables.
- Pendant un temps intermédiaire, l'attache temporaire de `dedit` doit présenter une
  base complète : cascade du KF amont complétée par l'état logique interpolé au temps
  courant. Un candidat de preview éventuel est ensuite fusionné au-dessus de cette base.
  Le statut temporaire peut rester signalé visuellement, mais son fond de palette ne
  doit jamais remplacer la valeur du champ « Fond » par un gris de secours.
- Une édition d'une valeur interpolable à ce temps distingue la base complète affichée
  par `dedit` du patch documentaire effectivement modifié. Le candidat de commit est
  donc `patch utilisateur sparse` : chaque propriété modifiée reçoit sa valeur finale
  calculée depuis l'état interpolé courant, mais une propriété interpolée non touchée
  reste absente du décor du nouveau KF. Le seek seul reste sans effet documentaire et
  `snapshot.set()` reste une preview.
- Lors du commit d’une édition de décor, la création matérialise exactement un KF
  `decor` au playhead (ou enrichit le KF `pose` déjà présent) avec uniquement les
  propriétés modifiées ; les autres valeurs restent résolues par la cascade et les
  règles habituelles du modèle KF, sans recevoir une assignation issue du snapshot
  intermédiaire. La capture d’un KF `pose` créé par le CS constitue l’exception
  contrôlée : elle fixe séparément la pose affine complète requise pour un waypoint,
  tandis que le patch de décor qui l’accompagne reste sparse. Le copy-on-write, la
  mise à jour d’un KF déjà présent et l’absence de doublon restent inchangés.
- Le bridge maintient un registre générique des modifications du décor courant,
  indexé au minimum par `(itemId, timeMs, propertyPath)`. Chaque entrée distingue la
  valeur de base observée au playhead et la valeur posée par l'utilisateur ; le
  registre porte des chemins ouverts (`style.*`, `offset.*`, racine ou toute future
  propriété) et ne dépend pas d'une whitelist. Il est la source du patch sparse et
  permet de savoir si un contrôle est effectivement modifié. Dès cette tranche,
  tout contrôle correspondant à une entrée modifiée affiche un outline sur la valeur
  touchée. Cet outline est le premier rendu du mécanisme ; sa forme pourra évoluer
  sans changer le registre ni le contrat de persistance.
- Une future action « retirer la modification » supprime l'entrée du registre au
  lieu d'écrire la valeur interpolée comme nouvelle valeur. Le contrôle est alors
  recalé sur la base interpolée courante et la propriété disparaît du patch sparse ;
  si le registre ne contient plus aucune modification, aucune valeur ne doit être
  matérialisée. Le mécanisme de retrait doit être prévu, mais sa forme d'action et
  son habillage pourront évoluer après cette première version de l'interface.
- Les propriétés discrètes ou segment-locales qui ne sont pas interpolées par le contrat
  V2 (par exemple classes, zone, custom ou `path` selon leur canal) ne reçoivent pas de
  valeur intermédiaire fabriquée. Si elles ne sont pas touchées, elles restent absentes
  du nouveau KF exactement comme toute autre valeur non modifiée et continuent de suivre
  leur règle documentaire propre. Si elles sont explicitement modifiées, leur capture
  suit leur canal documentaire dédié.
- Si le snapshot V2 ne contient pas réellement la propriété interpolée nécessaire,
  l'implémentation s'arrête à cette frontière et ouvre une correction CodPlay séparée
  soumise à autorisation explicite. Aucun repli DOM, `getComputedStyle` ou lecteur de
  trajectoire parallèle ne peut masquer ce manque dans l'éditeur.

Ordre d'exécution de la tranche P2-D :

1. Reproduire le cas sur `localhost:5174` et dans l'intégration V2 à un temps strictement
   intermédiaire ; relever ensemble `snapshot.timeMs`, la propriété de fond du snapshot,
   la valeur résolue par `dedit` et la valeur rendue par l'item. Cette étape tranche entre
   une valeur absente, un nom de propriété divergent et un simple habillage gris de la
   palette.
2. Fixer dans le bridge une seule projection snapshot → décor temporaire, synchronisée
   après `seekApplied`, avec un garde-fou sur le temps présenté. Réutiliser la conversion
   existante des valeurs structurées pour chaque type de propriété interpolable et
   compléter les propriétés absentes par la cascade documentée, sans lire le DOM.
3. Réattacher `dedit` avec l'état interpolé complet, puis conserver séparément dans le
   bridge la base d'affichage et le registre générique des modifications utilisateur.
   Afficher immédiatement un outline sur chaque valeur touchée à partir de ce registre.
   Vérifier que le signal temporaire reste uniquement un état de rendu et ne change pas
   la valeur du champ.
4. Faire converger le commit intermédiaire vers `resolveKeyframeInsertionPatch` : le
   nouveau KF reçoit uniquement les propriétés effectivement modifiées, exprimées à
   partir de l'état interpolé courant, à son `timeMs` exact. Les propriétés interpolées
   non modifiées ne doivent pas entrer dans `setDecor`. Les éditions suivantes ciblent
   ce même KF ; le copy-on-write et la transaction existants sont préservés.
5. Ajouter les tests purs de projection et de fusion sur des valeurs représentatives,
   sans transformer cet échantillon en whitelist, puis tester le passage d'une
   propriété inconnue du bridge. Ajouter l'intégration réelle du cycle seek → interface
   décor → édition → outline → commit → seek retour. La couleur sert de cas visible,
   sans limiter la couverture à ce champ. L'action de retrait de modification reste
   une évolution d'interface : le registre doit pouvoir la supporter sans figer une
   valeur interpolée, mais aucune forme d'action n'est imposée dans cette tranche.
   Rejouer ensuite la matrice de non-régression P2/P4/P5 et la validation Safari prévue
   par P6.

## 3. Hors périmètre de cette tranche

- Refonte générale du sequence-editor ; la correction ciblée des bornes
  virtuelles et de leur matérialisation relève de P3-C.
- Reparentage, déplacement vers une zone de capsule, orientation/taille suivant
  la tangente et extension du core CodPlay non prévue par le contrat existant.
- Choix d’easing dans le décor, collisions temporelles, undo/redo applicatif,
  multi-sélection et options avancées de path.
- Toute seconde voie V1, tout lecteur de trajectoire parallèle ou toute mesure
  DOM par frame.
- Une timeline par propriété de décor, une automation de type After Effects ou
  un panneau distinct par champ ; la tranche ne conserve que les deux canaux
  `pose` et `decor` par item.

## 4. Découpage et portes

| Étape | Statut | Livrable / porte |
| --- | --- | --- |
| P0 — Contrat | Fixe | Contrat validé pour cette tranche : vie capsule, KF au playhead, mise à jour du décor et transition unique. La validation native reste une porte distincte. |
| P1 — Domaine pur | Fixe | Résolveurs purs et testables de vie réelle/virtuelle, alignement exact/entre KFs et fenêtre bornée ajoutés et utilisés par la projection des bornes de timeline ; le branchement de la fenêtre sur la projection/runtime reste réservé à P4. Aucun DOM, player ou document mutable. |
| P2 — Adaptateur CS | En cours | Un geste exact met à jour le décor du KF au même temps ; un geste entre KFs matérialise au playhead, puis réédite ce KF sans doublon. Pendant ce geste intermédiaire, l’overlay prévisualise déjà la coupure `A → C → B` qui sera commitée. Toute propriété du décor reste capturable ; overlay et ghosts restent hors document. La projection de tous les ghosts de l’item, leur activation et leur hiérarchie visuelle (couleur/opacité réduites hors segment actif) sont implémentées. La validation native et les cas encore hors tranche maintiennent P2 ouvert. |
| P2-D — Interface décor au temps interpolé | En cours | Implémentation et tests réalisés : snapshot réellement présenté après `seekApplied`, projection ouverte vers `DecorPatch`, base complète séparée du registre générique, outline immédiat et matérialisation d’un KF sparse. L’action de retrait reste une évolution d’interface non imposée dans cette tranche. Porte restante : validation native complète des gestes et clôture P2 ; aucun changement core implicite. |
| P2-E — Deux canaux timeline pose/décor | En cours | Contrat implémenté dans le modèle, les commandes, le builder, le bridge, la machine et le rendu : lecture legacy sans `channel` comme `pose`, écritures nouvelles explicites, chaîne spatiale limitée aux KFs `pose`, chaîne décor alimentée par les KFs `decor` et les KFs `pose` qui portent du décor, promotion sans doublon et rendu d’une seule ligne avec séparation uniquement lorsque les deux canaux existent. Un KF de pose créé ou promu par mouvement capture la pose affine complète ; le patch décor reste sparse et ouvert aux propriétés futures. Tests ciblés et suite éditeur verts ; validation native Safari reste la porte de clôture. |
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
12. Entre deux KFs, après un seek appliqué, chaque contrôle `dedit` correspondant à
    une valeur de `Decor` présente dans l'état résolu affiche la valeur réellement
    présentée par l'item ; le champ « Fond » en est le cas de vérification visuelle,
    mais n'est pas le périmètre de la règle. Aucune whitelist ne limite le passage
    d'une future propriété et aucun contrôle ne retombe sur une valeur de secours
    lorsque le snapshot fournit la valeur courante.
13. La modification de n'importe quelle valeur interpolable à un temps intermédiaire
    reste une preview sans mutation documentaire jusqu'au commit, puis crée exactement
    un KF à ce temps avec uniquement la valeur (ou le sous-champ) modifiée. Une valeur
    interpolée non touchée n'est pas assignée au décor de ce KF et reste soumise à la
    cascade habituelle.
14. Une seconde modification au même temps met à jour le KF déjà créé, sans
    doublon ni perte des modifications déjà inscrites ; les propriétés interpolées
    non touchées restent absentes du patch documentaire. Un décor partagé est isolé
    par copy-on-write comme pour les gestes CS.
15. Des seeks intermédiaires successifs, un seek de retour, Play/pause et la
    restauration d'une preview ne laissent ni valeur de décor périmée ni candidat
    rattaché au mauvais temps. Les contrôles et l'item restent cohérents après
    `seekApplied`.
16. Toutes les valeurs structurées du snapshot sont transportées une seule fois vers
    les chemins et formats attendus par les contrôles `dedit`, sans liste fermée de
    propriétés ; la matrice utilise couleur avec alpha, unités de longueur, nombres,
    pose et une propriété supplémentaire inconnue du bridge comme exemples. Au commit,
    seules les valeurs effectivement modifiées sont sérialisées. Aucun DOM ou style
    calculé n'est lu pour reconstruire l'état.
17. Le registre du décor courant est indexé par item, temps et chemin de propriété ;
    il conserve séparément la base interpolée et la valeur utilisateur. Il accepte les
    chemins connus comme inconnus et permet d'identifier exactement les propriétés
    modifiées, sans comparer ou recopier tout le snapshot. Dès qu'une propriété est
    modifiée, le contrôle correspondant affiche un outline sur la valeur touchée.
18. L'action future « retirer la modification » supprime l'entrée du registre au lieu
    d'écrire la valeur interpolée comme nouvelle valeur ; le contrôle revient à la base
    interpolée courante et la propriété disparaît du patch sparse. Si aucune entrée ne
    subsiste, aucune valeur ne doit être matérialisée. La forme de cette action n'est
    pas figée par cette tranche.
19. Le signal visuel `isTemporary` demeure indépendant de la valeur des champs : le
    traitement graphique du conteneur de palette ne masque aucune valeur courante. Le
    choix d'un outline pour les contrôles modifiés constitue le rendu initial ; son
    évolution ultérieure ne change pas la map des propriétés modifiées.
20. Si une propriété de `Decor` attendue par l’état résolu n’est pas exposée par le
   snapshot V2 au temps présenté, la porte est bloquée et le manque est documenté
   comme besoin CodPlay séparé ; aucune whitelist ou compatibilité silencieuse n’est
   acceptée dans l’éditeur.
21. Le CS et les artefacts géométriques coïncident avec le `content-box` : la
    bordure n'augmente ni `width/height` ni les dimensions du path. Les
    `offset.x/y` et `offset.width/height` restent le repère de contenu ; seule
    la translation CSS border-box est dérivée pour le runtime, de sorte qu'une
    variation de bordure ne désynchronise ni CS, ni bords internes, ni ghosts.
22. Un KF `decor` placé entre deux KFs `pose` ne change ni les extrémités, ni le
   tracé, ni le ghost de la transition `pose` ; le mouvement continue directement
   de `A` vers `B`.
23. Un geste de pose au milieu d’un segment crée un KF `pose` avec sa pose affine
    capturée et découpe réellement le segment en `A → C → B`. Une édition de
    décor au même temps crée un KF `decor` sparse, sauf si un KF `pose` existe
    déjà, auquel cas elle enrichit ce KF.
24. Un KF `pose` qui porte du décor apparaît une seule fois dans la zone `pose` et
    participe aux deux chaînes ; un KF `decor` apparaît dans la zone supérieure
    uniquement lorsque la ligne contient aussi des KFs `pose`. Avec un seul canal,
    aucune ligne de séparation n’est rendue.
25. Les bornes de visibilité et les ghosts sont calculés uniquement depuis la
    chaîne `pose`. Un KF `decor` ne peut pas prolonger la vie de l’item et ne
    produit aucun ghost ; le clic d’un point `decor` reste une navigation
    temporelle vers son KF.
26. Le contrat des propriétés qui composent la pose reste évolutif et ne peut
    pas être figé par cette tranche : son remplacement (par exemple retirer
    `rotation` ou ajouter `left`) ne demande pas de créer une troisième piste ni
    une timeline par propriété. Le canal explicite et la promotion d’un KF
    `decor` en KF `pose` restent inchangés.

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
- Amélioration de base de déplacement au 2026-09-04 : sur le KF cible en fin de
  trajectoire, la surface unique reprend l’endpoint du segment actif comme base
  du geste. Elle ne dépend plus d’une présentation éventuellement décalée de
  l’item ; le `path` du KF cible reste donc la référence de la trajectoire après
  le déplacement. La régression d’intégration couvre la divergence entre ces
  deux cadres et vérifie la persistance de l’offset et du path.
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
- Implémentation P2-D au 2026-09-04 : `dedit` suit toutes les valeurs de `Decor`
  que V2 interpole après `seekApplied`, la couleur de fond n'étant qu'un exemple
  révélateur. Toute édition intermédiaire doit fusionner sa valeur modifiée avec la
  base affichée, mais ne sérialiser que cette modification (ou ce sous-champ) dans le
  KF du playhead ; une valeur interpolée non touchée ne doit pas être assignée. Le
  diagnostic à confirmer porte sur la frontière snapshot → `DecorPatch`, l'ouverture
  aux propriétés futures et la séparation entre la valeur du champ et le fond visuel
  `dedit-palette--temporary`. Le registre générique des propriétés modifiées pilote
  dès cette tranche l'outline ; une action future de retrait pourra supprimer une
  entrée et restaurer la base interpolée sans changer le contrat. Les tests purs,
  l'intégration V2 et le build passent ; la tranche reste `En cours` jusqu'à la
  validation native complète et la clôture P2. Aucun contrat core n'est modifié
  sans preuve et autorisation explicite.
- Correctif de couverture Decor au 2026-09-04 : le stress-test temporaire traverse le chemin
  `Decor → buildSceneDocV2 → CodPlay.build() → snapshot` pour les propriétés CSS ouvertes,
  y compris `border` et des clés futures, ainsi que `classes`, `offset`, `custom` et `path`.
  Le type `Decor` conserve désormais aussi les propriétés racine futures au bridge. `zone` reste
  volontairement diagnostiquée comme différée ; elle n’est pas présentée comme matérialisée par
  CodPlay. Le chantier de structure du builder est séparé dans son propre plan, statut `A relire` :
  cette passe ne crée pas de registre ni de nouvelle architecture de projection.
- Validation du correctif au 2026-09-04 : suite éditeur `41 fichiers / 442 tests`, typecheck
  `packages/editor`, build Vite et `git diff --check` passent ; la suite CodPlay de la frontière
  réellement appelée passe `87 fichiers / 547 tests` avec son typecheck. La validation native des
  gestes de pointeur reste la porte P6 déjà ouverte.
- Vérification Decor du 2026-09-04 : le cas « épaisseur de bord » sur un item produit par
  `Test position` transportait bien `style.border-width` dans la preview puis dans le KF `decor`.
  L’absence de changement visuel venait de CSS : le preset texte fournissait une largeur et une
  couleur de bord, mais aucun `border-style`, dont la valeur initiale `none` rend ces deux
  propriétés invisibles. Le preset porte désormais `border-style: solid`, tandis que le KF reste
  sparse et ne sérialise que `border-width`. Le contrôle numérique reste abstrait conformément au
  contrat cqw : une saisie `20` produit `5cqw`, elle n’est pas une valeur px fixe.
- Alignement CS/content-box du 2026-09-04 : la projection éditeur conserve les dimensions
  `pose.localWidth/localHeight` (et donc `offset.width/height`) sans y ajouter la bordure. Elle
  translate seulement l’origine par `border-left/top` dans la matrice affine, pour que les bords
  du CS coïncident avec les bords internes visibles ; la conversion inverse est appliquée aux
  gestes avant sérialisation de l’offset. Les ghosts et paths réutilisent la même projection, avec
  tests d’intégration sur le preset `Test position` et tests purs de l’inversion. Aucun changement
  du core CodPlay ni de la trajectoire documentaire.
- Validation de l’alignement au 2026-09-04 : suite éditeur `43 fichiers / 450 tests`, typecheck
  et build Vite passent, ainsi que `git diff --check`. L’intégration vérifie le décalage immédiat
  du CS lors d’une modification de bordure et la sérialisation inverse d’un déplacement ; la
  validation native du geste reste soumise à la porte P6 existante.
- Correctif final border/content-box au 2026-09-04 : la base d'une édition temporaire normalise
  la translation border-box du snapshot runtime vers le content-box avant de comparer le patch
  décor sparse. Pendant la preview, le builder reconstruit la translation CSS depuis l'ancre
  content-box courante ; une modification de `border-width` peut donc agrandir le border-box,
  sans déplacer le contenu, le CS ou les ghosts. En Safari Technology Preview, au playhead
  `2,5 s`, le style est passé de `translate(38.628px, 168.808px) + border 3px` à
  `translate(15.66px, 145.84px) + border 26px`, avec l'ancre content-box/CS maintenue à
  `41.76px / 171.94px`, avant le flush d'inactivité. La preview ne doit pas être évaluée après
  les 4 s de flush, qui matérialisent normalement le KF décor en attente.
- Correction de régression seek/CS au 2026-09-04 : une sélection explicite d'un KF reste l'ancre
  du path pendant le scrub, mais ne verrouille plus le CS sur son endpoint. Quand le temps recherché
  diffère de ce KF, le bridge reprend la pose runtime du temps courant (et, pour un item bordé, le
  snapshot du même temps pour reconvertir le border-box en content-box) sans modifier les endpoints
  documentaires. Le scénario `5 000 ms → 2 500 ms` sur `Test position` vérifie le retour du CS de
  `400/400 px` à `240/240 px` et la conservation du path. La suite éditeur compte maintenant
  `43 fichiers / 454 tests`.
- Décision d’architecture du 2026-09-04 : un item peut désormais exposer deux
  canaux temporels, `pose` et `decor`, sans descendre au niveau d’une timeline
  par propriété. Les KFs `pose` seuls forment la chaîne de trajectoire et les
  bornes de visibilité ; les KFs `decor` ne la coupent pas. Un KF `pose` peut
  porter un patch de décor et participe alors aux deux résolutions, mais reste
  affiché une seule fois dans la zone basse. Un KF `decor` est affiché dans la
  zone haute lorsque les deux canaux existent, sans distinction de losange ou
  de couleur. Le modèle, le builder, le bridge, la machine et le rendu sont
  maintenant alignés, et les tests de non-régression couvrent ce contrat ;
  P2-E reste `En cours` uniquement jusqu’à la validation native Safari et la
  clôture P2/P6.
- Correctif rotation CS au 2026-09-04 : le `onCommit` du Selection Frame est maintenant relié au
  même chemin de geste `pose` que le déplacement. Ainsi `offset.translate` (déplacement et
  compensation de pivot), `offset.width/height` (resize), `offset.rotate` (rotation) et
  `offset.rotationOrigin` (pivot) sont capturés au relâchement, sans attendre le flush d'inactivité
  et sans créer de KF `decor`. Les propriétés de palette (`style.*`, `classes`, `zone`, `custom` et
  les propriétés racine futures) restent des patches `decor` sparse ; le test d'intégration vérifie
  qu'une rotation à `2 500 ms` produit immédiatement un unique KF `pose` portant `offset.rotate`.
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
