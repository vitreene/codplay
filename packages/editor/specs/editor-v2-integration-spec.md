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
- Le cadre et la palette partagent le même état du décor. L'interpolation d'un
  décor et de sa position/taille ne crée pas d'action de pose supplémentaire.

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
  couvre la projection Editor vers `SceneDoc` V2.
- [`editor-player-command-facade-v2.spec.ts`](../tests/editor-player-command-facade-v2.spec.ts),
  [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  et [`controller-machine.spec.ts`](../tests/controller/controller-machine.spec.ts)
  couvrent le transport, le cycle d'instance, le seek et les frontières du
  document.
- [`decor-editor-bridge-integration-v2.spec.ts`](../tests/decor-editor-bridge-integration-v2.spec.ts)
  couvre l'édition, le snapshot, la preview et le commit/rebuild.
  Safari MCP a confirmé le 1 novembre 2026 le parcours palette réel : `input`
  garde la preview hors document, `change` crée immédiatement un KF décor au
  playhead (75 ms pour une couleur et 99 ms pour un nombre), Undo le retire,
  Redo le rétablit, et Échap abandonne une preview sans modifier le décor auteur.
- [`scene-selection.spec.ts`](../tests/scene-selection.spec.ts) vérifie qu'un
  clic item ne crée pas d'étape Undo et qu'un clic sur le fond vide garde le
  tracé de zone et son commit. Safari a confirmé le 1 novembre 2026, dans
  l'application et sa scène SQLite, la sélection de l'item, Undo désactivé,
  zones inchangées et aucune requête PUT sur le clic.
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
