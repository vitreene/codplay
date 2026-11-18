# Éditeur — intégration V2 du player et des ponts

## Rôle

Cette verticale relie le document `EditorScene`, le player CodPlay V2, la
timeline et l'édition visuelle. Chaque responsabilité a un propriétaire unique :

| Propriétaire | Responsabilité |
| --- | --- |
| Acteur du contrôleur Editor | `EditorScene`, sélection, commandes documentaires, historique et commit |
| `scene-player-bridge` | Compilation V2, création/remplacement de l'instance et cycle de vie de scène |
| `EditorPlayerCommandFacade` | Instance, `preRollMs`, transport `instance.telco` et abonnements de lecture |
| `EditorCoordinationBridge` | Raccord des ports de timeline, de décor et du player ; aucune mutation documentaire |
| `sequence-editor` | Temps auteur pendant l'édition et intentions de seek/play/pause/stop |
| `decor-editor` | Apparence de l'item, preview, conversion des gestes et intégration du Selection Frame |

Le Selection Frame est un outil d'interaction du `decor-editor`. Le présentateur
CodPlay V2 reste la source de l'état logique et de la trajectoire. La verticale
utilise les contrats V2 du player et ne lit ni n'écrit ses nœuds.

Le Builder traduit `EditorScene` en `SceneDoc` V2. Il délègue la construction
du document à `SceneDocEditor`, la distribution temporelle à
`CapsuleDistribution` et la résolution de grilles/placements aux capacités de
Capsule Automation ; il ne crée pas de second calcul de timing ou de placement.
La compilation et la présentation restent sur le chemin V2 `CodPlay.build()` →
instance. Le test [`build-scene.spec.ts`](../tests/builder-v2/build-scene.spec.ts)
vérifie la projection réelle vers ce contrat.

Le Builder projette uniquement les items visibles et dont tous les ancêtres
capsules sont visibles. `visible: false` retire l'item de la `SceneDoc` V2 ; une
capsule masquée retire aussi son sous-arbre pour ne pas produire de persos sans
parent. Cette projection laisse le document auteur et sa persistance intacts.
Les items exclus ne contribuent pas à la validation ni au calcul du `preRollMs`
de la scène compilée.

## Répartition verticale du layout Editor

Dans le layout principal, le player de scène garde son ratio auteur et prend
l’espace maximal disponible dans la région centrale. La région timeline reçoit
la hauteur restante sous la scène. Un séparateur horizontal règle la hauteur
de la timeline par drag souris ; il n’a pas de commande clavier. La hauteur
minimale de la timeline est 160 px et la région de scène conserve au moins
200 px. La limite supérieure de la timeline dépend donc de la hauteur
disponible de la page.

Editor calcule la hauteur initiale de la timeline depuis le ratio effectif du
player. Le séparateur met ensuite à jour la grille sans modifier le document ni
son historique. La hauteur choisie est mémorisée sous la préférence navigateur
`editor.timeline-height`, hors `EditorScene`, SQLite et Undo/Redo ; elle est
restaurée au rechargement puis bornée par l’espace courant. En l’absence de
préférence, le calcul automatique de la scène et du reliquat est repris. Les
redimensionnements de page et du player recalculent la répartition.

Le propriétaire du partage et de la préférence est
[`AppLayout`](../src/app/layout/app-layout.tsx) ; sa grille et son séparateur
sont définis dans [`app-layout.css`](../src/app/layout/app-layout.css).

## Données et projection

- Le Builder Editor produit des nombres unitless pour les longueurs structurées
  et passe la configuration au compilateur CodPlay. CodPlay applique la
  qualification `cqw` une fois. Le builder n'émet pas de chaîne CSS ni d'objet
  de longueur `cqw`.
- Les longueurs auteur, la palette et les valeurs sauvegardées restent en
  `cqw`. Les mesures utilisées pour dessiner l'overlay restent dans la
  projection DOM et ne deviennent pas des données auteur.
- La projection média utilise `initial.sync`, selon le contrat
  [CodPlay media-sync V2](../../codplay/specs/media-sync-v2-spec.md).
- Le mode de rotation est statique et propre à l’item. La bascule par la
  commande centrale, le reset des angles et la projection du décalage initial
  constant suivent la [spec d’orientation](./path-tangent-orientation-spec.md).
- Le cadre et la palette partagent le même état du décor. L'interpolation d'un
  décor et de sa position/taille ne crée pas d'action de pose supplémentaire.
- La palette Décor suit l’item sélectionné et le même état logique que son
  élément natif présenté. Un fond absent reste transparent des deux côtés ; une
  couleur choisie s’applique à l’élément au fil de la preview et la valeur
  committée réapparaît après seek et rebuild.
- Un champ de couleur sans valeur auteur ne montre pas son gris interne de
  repli comme couleur de l'item. Un fond non défini est signalé comme
  transparent ; une couleur présente affiche sa valeur résolue.
- Une multi-sélection dont les couleurs divergent signale un état mixte et ne
  présente pas le gris interne du picker comme valeur commune.

## Interaction des bornes de capsule

- Chaque piste montre au plus une borne d'intro et une borne d'outro. Les bornes
  réelles viennent du premier et du dernier KF de pose ; les bornes manquantes
  viennent de la distribution virtuelle. Elles apparaissent en demi-losanges
  ouvrant vers la droite et fermant vers la gauche, sans libellé `intro` ou
  `outro` sur les KFs. Créer ou matérialiser une borne produit un KF sans nom ;
  les noms personnalisés des KFs intermédiaires restent affichés.
- Un drag commencé sur une poignée de KF déplace uniquement le KF visé via le
  circuit de drag de la timeline. Pour une capsule à deux bornes, déplacer la
  borne de sortie conserve donc la borne d'entrée et n'émet pas de création ou
  suppression de KF.
- Le tracé d'une plage de capsule ne démarre que depuis la ligne de capsule,
  hors d'une poignée de KF. Ce geste de tracé conserve son circuit de
  remplacement des bornes.
- Les commandes restent émises par la machine `sequence-editor` et appliquées
  par le contrôleur central ; la machine ne modifie pas la scène localement.

## Hiérarchie et ordre des items

- La liste de pistes affiche les items frères du premier plan en haut vers
  l'arrière-plan en bas. Le Builder trie les frères par clés ascendantes et
  projette leur rang dans une classe de cadre privée qui règle leur pile de
  rendu ; un rang plus élevé est au premier plan. Cette projection ne change ni
  les clés d'ordre auteur ni `Decor.style`.
- Un glisser-déposer entre les bords d'une ligne déplace l'item comme frère
  avant ou après la cible ; déposer au centre d'une capsule le rattache comme
  enfant. Le déplacement passe par `TRACK.MOVE` et la commande centrale
  `attachItem`, avec des ancres de frères adjacents. Les cycles de parenté et
  les dépôts sans changement d'ordre sont refusés.
- Les clés d'ordre restent des chaînes fractionnaires triées lexicalement.
  L'insertion entre deux clés préfixées doit fournir une clé strictement dans
  l'intervalle ; si aucun suffixe disponible ne permet un intervalle strict,
  Editor rebalancera uniquement la fratrie concernée. Le rebalancement produit
  une clé distincte pour chacun de ses items.
- Le bouton de suppression d'une ligne passe par `TRACK.REMOVE` et
  `deleteItem`. Cette commande supprime en cascade les descendants d'une
  capsule. Si la sélection appartient au sous-arbre supprimé, Editor la vide
  avant le commit afin que l'historique restaure un état de sélection valide.
- [`sequence-editor/tree-reorder.spec.ts`](../tests/sequence-editor/tree-reorder.spec.ts),
  [`sequence-editor/machine.spec.ts`](../tests/sequence-editor/machine.spec.ts)
  et [`commands/base-commands.spec.ts`](../tests/commands/base-commands.spec.ts)
  couvrent le calcul des déplacements, leur routage central, les ancres
  d'ordre, le refus des cycles et l'action de suppression dans la liste.
- [`commands/order-key.spec.ts`](../tests/commands/order-key.spec.ts) vérifie
  l'insertion entre des clés où l'une est préfixe de l'autre et le rebalancement
  d'une fratrie de 100 items. [`builder-v2/build-scene.spec.ts`](../tests/builder-v2/build-scene.spec.ts)
  vérifie la projection CSS du rang ; [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  vérifie le rebuild et l'ordre des cadres après `attachItem`.
- Le parcours Safari MCP exerce le dépôt réel avec son repère visuel, l'action
  de réorganisation, le changement visible de pile pour deux items superposés,
  la sauvegarde SQLite et le rechargement du document dans le même onglet.

## Création tracée d'une capsule

- L'action « Créer une capsule » ouvre le mode de tracé du Selection Frame
  existant. Le rectangle tracé devient une géométrie `cqw` en mode racine
  `transform`. En mode racine `fine-grid`, une transaction crée une zone
  racine pour la surface tracée et une capsule dont le décor initial référence
  cette zone.
- La capsule créée reprend le type et la distribution de `rootCapsule`. Sa
  grille locale reste omise pour que Capsule Automation applique les dimensions
  par défaut de ce type ; la grille racine ne devient pas celle de la capsule.
- Le commit passe par `EditorActionsFacade`, sélectionne la capsule, termine le
  mode de tracé et ouvre son éditeur `CapsuleDef`. Un item existant peut ensuite
  devenir son enfant par dépôt au centre de sa ligne, selon la règle de
  hiérarchie ci-dessus.
- [`block-creation-v2.spec.ts`](../tests/block-creation-v2.spec.ts) valide les
  deux modes de tracé, le décor et la sélection de la capsule ainsi que Undo et
  Redo. [`sequence-editor/tree-reorder.spec.ts`](../tests/sequence-editor/tree-reorder.spec.ts)
  valide le dépôt central sur une capsule et son routage vers `attachItem`.

## Snapshot et preview

- `snapshot.get()` lit l'état logique de base au temps présenté ; il n'inclut
  pas la preview active. `snapshot.set()` remplace atomiquement cette preview
  et `snapshot.clear()` l'abandonne, conformément à la
  [façade CodPlay V2](../../codplay/specs/facade-v2-spec.md).
- Le `decor-editor-bridge` conserve le candidat accepté par `set()` pour
  afficher la preview. Il ne relit pas `get()` en espérant y trouver cette
  valeur.
- Après sélection, seek acquitté, rebuild ou abandon de preview, l'éditeur
  relit le snapshot de base. Le commit efface la preview, envoie la commande au
  contrôleur puis reconstruit l'instance depuis le document.
- Cette intégration n'utilise pas `snapshot.onChange`. Aucun changement de base
  hors de ces rendez-vous n'a été établi dans le périmètre vérifié ; les
  notifications `telco` restent la responsabilité de la façade player et ne
  deviennent pas un second flux de géométrie ou de progression auteur.

## Sélection, phases et lecture

- Le Selection Frame se réattache à l'item sélectionné après un rebuild réel.
  Un clic sur un item sélectionne son frame ; un clic hors du frame termine la
  phase avant d'effacer la sélection. Un réattachement du même ensemble d'items
  conserve le panneau et les réglages actifs. Resize et scroll reprojettent le
  frame depuis la géométrie courante, sans mutation du document.
- En mode Bloc, quand le hit-test de scène résout un item, le handler de capture
  Editor consomme son `pointerdown` avant qu'il atteigne la grille Zone superposée.
  Le clic sélectionne donc l'item sans tracer une zone ni committer le document.
  Un pointeur résolu sur le fond vide continue vers le circuit de tracé Zone V2.
- En mode Bloc, le clic scène et la sélection du nom dans la timeline convergent
  vers la sélection du contrôleur central. Si un `move` rend l'item visible dans
  l'overlay player plutôt que dans son élément structurel, le pont cible son
  identité depuis la pose affine publiée. Pour un item dont le placement effectif
  suit une zone, le CS dédié est une bordure sans poignées ; l’icône Déplacement
  rend cette surface interactive. Le Selection Frame général reste masqué pour
  ce placement. L'overlay Zone reste visible selon son réglage, mais devient inerte.
- La palette Décor reste dans le flux de sa région, dans la colonne droite du
  layout Editor ; sa position ne dépend ni du viewport ni de l’item sélectionné.
- Un champ couleur sans valeur auteur est signalé comme non défini ; pour
  `background-color`, l’absence correspond au fond transparent. Le gris requis
  par le picker natif ne représente pas la couleur effective de l’item. Le
  montage de la palette charge `decor-editor.css` afin que les états `unset` et
  `mixed` affichent leur motif de transparence au lieu du swatch natif.
- Chaque contrôle d’action à icône ou glyphe dans Editor expose un `title`
  descriptif au survol.
- Dedit met à jour la preview pendant `input` et les gestes. Le signal explicite
  `notifyInteractionEnd`, émis après le patch final du contrôle, committe aussitôt
  la transaction en attente ; le geste de cadre garde son commit au relâchement.
  Sélection, seek, mutation documentaire externe et lancement de lecture restent
  des frontières immédiates. Aucun délai d'inactivité ne retarde ou ne déclenche
  un commit. Échap abandonne les commandes en attente et efface leur preview sans
  commit. Un patch d'offset ne contient que les composantes touchées par le geste.
- La capture à un temps interpolé lit le snapshot logique après `seekApplied`,
  jamais la matrice de rendu du nœud. Un registre ouvert des chemins modifiés
  produit un patch sparse à la création du keyframe : seules les propriétés
  changées sont écrites. Aucune whitelist CSS ni timeline par propriété n'est
  ajoutée.
- L'acteur Editor entre dans `playing` sur la demande éditeur juste avant
  `telco.play()` et en sort sur pause ou seek ; le statut brut `isPlaying` ne
  pilote pas ce cycle. Pendant la lecture, dedit, le Selection Frame et
  l'overlay de trajectoire suspendent leurs previews et gestes ; le point central
  est masqué avec l'overlay. Un Play/Seek simple garde l'instance,
  réapplique la pose par le seek de présentation puis reprend la lecture. Un
  rebuild n'a lieu que si une scène différente a effectivement été commitée.
  À la sortie, dedit se resynchronise et reprend sa preview sans rebuild.

## Autorité temporelle

- En mode édition, `sequence-editor.playheadMs` est la référence. Un seek suit
  le chemin `SEEK` → `SEEK_APPLIED` avant la relecture du snapshot.
- En mode lecture, `instance.telco` commande l'animation et publie sa
  progression à la façade player. Le Selection Frame et la palette ne suivent
  pas la progression d'animation comme une seconde source d'état.
- Au retour à l'édition, la coordination adopte une fois le temps de lecture
  puis reprend les seeks auteur. Les commandes de transport n'entrent pas dans
  l'historique documentaire.

## Preuves

- [`builder-v2/build-scene.spec.ts`](../tests/builder-v2/build-scene.spec.ts)
  couvre la projection Editor vers `SceneDoc` V2, l'exclusion d'un item masqué,
  l'exclusion du sous-arbre d'une capsule masquée et la compilation du résultat
  par le vrai `CodPlay.build()`.
- [`editor-player-command-facade-v2.spec.ts`](../tests/editor-player-command-facade-v2.spec.ts),
  [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  et [`controller-machine.spec.ts`](../tests/controller/controller-machine.spec.ts)
  couvrent le transport, le cycle d'instance, le seek et les frontières du
  document.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  couvre l'édition, le snapshot, la preview et le commit/rebuild.
- [`decor-editor-render.spec.ts`](../tests/decor-editor-render.spec.ts) vérifie
  que le gris interne du picker n'est pas présenté comme un fond auteur absent,
  qu'une valeur grise explicite reste affichée comme telle et que les couleurs
  divergentes sont indiquées comme mixtes. Dans Safari Technology Preview, la
  sélection d'un item depuis la timeline active son panneau Décor ; l'absence
  de fond apparaît en damier, et la sélection d'un item coloré affiche ses
  couleurs de fond et de bord.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  vérifie que le style natif après seek correspond exactement à la valeur
  committée dans le Decor cible, en relisant l’élément remplacé par le rebuild.
  Safari MCP a confirmé le 1 novembre 2026 le parcours palette réel : `input`
  garde la preview hors document, `change` crée immédiatement un KF décor au
  playhead (75 ms pour une couleur et 99 ms pour un nombre), Undo le retire,
  Redo le rétablit, et Échap abandonne une preview sans modifier le décor auteur.
- [`scene-selection.spec.ts`](../tests/scene-selection.spec.ts) vérifie qu'un
  clic item ne crée pas d'étape Undo et qu'un clic sur le fond vide garde le
  tracé de zone et son commit. Safari a confirmé le 1 novembre 2026, dans
  l'application et sa scène SQLite, la sélection de l'item, Undo désactivé,
  zones inchangées et aucune requête PUT sur le clic.
- [`sequence-editor/clip-boundary-drag.spec.ts`](../tests/sequence-editor/clip-boundary-drag.spec.ts)
  vérifie le routage du pointerdown sur une poignée vers le KF ciblé ;
  [`sequence-editor/machine.spec.ts`](../tests/sequence-editor/machine.spec.ts)
  vérifie que déplacer la borne de sortie n'émet que son `moveKeyframe`.
- [`sequence-editor/virtual-keyframes.spec.ts`](../tests/sequence-editor/virtual-keyframes.spec.ts)
  vérifie les demi-losanges uniques pour les bornes réelles et virtuelles, y
  compris un ancien KF nommé `outro`, et vérifie que matérialiser une borne ne
  nomme pas le nouveau KF. Safari Technology Preview confirme l'absence des
  libellés répétés et l'affichage d'une borne d'intro et d'une borne d'outro
  par piste.
- [`decor-editor-bridge-v2.spec.ts`](../tests/decor-editor-bridge-v2.spec.ts),
  [`decor-editor-field-state.spec.ts`](../tests/decor-editor-field-state.spec.ts),
  [`decor-editor-machine.spec.ts`](../tests/decor-editor-machine.spec.ts) et
  [`controller-machine.spec.ts`](../tests/controller/controller-machine.spec.ts)
  couvrent les frontières de phase, l'abandon, l'état du panneau, la sélection
  et la suspension de lecture. Safari a confirmé le 17–18 juillet le commit
  unique d'une séquence composite, l'abandon sans commit, le clic item/hors-frame,
  la conservation du panneau et le cycle Play/Pause/Stop.
- Les parcours navigateur item, tangente, rotation, preview et lecture sont
  documentés dans les spécifications de
  [présentation](./item-presentation-spec.md),
  [interpolation de décor](./decor-style-interpolation-spec.md) et
  [orientation de trajectoire](./path-tangent-orientation-spec.md).
