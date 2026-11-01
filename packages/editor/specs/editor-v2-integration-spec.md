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
- Dedit met à jour la preview pendant la saisie et les gestes. Le pont regroupe
  les changements en une transaction aux frontières de phase : changement ou
  effacement de sélection, seek, mutation documentaire externe, inactivité
  prolongée ou lancement de lecture. Échap abandonne les commandes en attente
  et efface leur preview sans commit. Un patch d'offset ne contient que les
  composantes touchées par le geste.
- La capture à un temps interpolé lit le snapshot logique après `seekApplied`,
  jamais la matrice de rendu du nœud. Un registre ouvert des chemins modifiés
  produit un patch sparse à la création du keyframe : seules les propriétés
  changées sont écrites. Aucune whitelist CSS ni timeline par propriété n'est
  ajoutée.
- L'acteur Editor entre dans `playing` sur la demande éditeur juste avant
  `telco.play()` et en sort sur pause ou seek ; le statut brut `isPlaying` ne
  pilote pas ce cycle. Pendant la lecture, dedit et le Selection Frame
  suspendent leurs previews et gestes. Un Play/Seek simple garde l'instance,
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
