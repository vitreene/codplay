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
ne lit ni n'écrit les nodes du player et ne contient pas d'accès `codplay-v1`.

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
- Les parcours navigateur item, tangente, rotation, preview et lecture sont
  documentés dans les spécifications de
  [présentation](./item-presentation-spec.md),
  [interpolation de décor](./decor-style-interpolation-spec.md) et
  [orientation de trajectoire](./path-tangent-orientation-spec.md).
