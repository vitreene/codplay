# Plan — intégration et acceptation de l’éditeur de zones

> Statut : **En cours**. Le modèle et l’éditeur ont un périmètre vérifié dans
> la [spécification zone-editor](../specs/zone-editor-spec.md). Les raccords
> avec l’éditeur hôte ne sont pas validés.

## Décisions acceptées mais non appliquées

| Décision | Travail restant | Parcours d’acceptation |
|---|---|---|
| Les divisions `container` restent internes au zone-editor ; les placements fournis à capsule-automation sont plats. | Définir et appliquer dans l’hôte la conversion requise avant qu’une zone enfant devienne un placement réel. | Un test d’intégration prouve que l’hôte ne transmet que des placements feuilles et que casser un container conserve l’attachement de chaque enfant par son `id`. |
| Une attache persistante cible l’`id` stable d’une zone, pas son nom modifiable. | Aligner `DecorPatch.zone`, dedit et les chemins de sauvegarde/restauration sur cette identité ; les documents d’éditeur encore basés sur le nom doivent être réconciliés avant le code. | Une intégration crée une attache, renomme la zone, puis vérifie qu’elle reste liée au même `id`, y compris après `breakContainer()`. |
| Le cadre doit pouvoir déposer un item dans une zone valide quand les zones existent. | Définir la forme de cible transmise entre selection-frame, l’éditeur et capsule-automation. `DecorPatch.zone` référence encore une zone par nom alors que l’identité retenue pour les attaches est l’`id` stable. | Un scénario réel de drag du cadre montre le survol, la sélection et le commit de la même zone par `id`, sans cible parallèle. |
| Les surfaces conditionnées (par exemple par orientation) sont choisies et stockées par l’éditeur hôte ; zone-editor reçoit l’état d’une seule surface à la fois. | Raccorder le modèle de l’éditeur à cette séparation et fournir la surface active à `setState()`. La forme des variantes reste au [plan orientation](../../../editor/plan/modules/2026-07-11-zone-orientation-variants-plan.md). | Changer le contexte d’orientation dans l’éditeur charge la surface correspondante sans ajouter de connaissance des contraintes dans `createZoneEditor()`. |
| Les catalogues de cards et de grilles appartiennent à l’éditeur hôte ; zone-editor ne reçoit que des valeurs de modèle. | Garder `ZoneCard` comme alias local tant que le format du catalogue, la sauvegarde et la réapplication côté hôte ne sont pas réconciliés avec le modèle dedit. | Une intégration sauvegarde puis réapplique une card et vérifie l’état complet, sans catalogue interne à selection-frame. |
| Les zones destinées au placement utilisent les coordonnées de pistes `row`, `col`, `rowSpan`, `colSpan` prises en charge par le chemin existant de capsule-automation. | Conserver ce chemin direct pour les placements plats ; ne pas dépendre du champ `AutoCapsuleChildPlacementInput.area`, dont la génération CSS n’est pas vérifiée. Réconcilier cette décision avec le drop live avant son intégration. | Un test d’intégration vérifie le CSS du placement produit par les champs de pistes et le parcours retenu pour la cible de drop. |

## Décisions ouvertes et validations restantes

- **Validation navigateur** : les anciennes références à une démo `zone-editor`
  ne correspondent plus à un fichier de démo présent dans `packages/demos`.
  Décider si cette feature doit retrouver une fixture navigateur ; si oui,
  l’utiliser pour valider visibilité, géométrie et lisibilité à l’échelle réelle.
- **Disponibilité du placement par cellule** : le code appelle
  `measureGridTracks()` et compare la taille aux `minCellSizePx`, mais les tests
  couvrent seulement le repli `true` lorsque la géométrie n’est pas mesurable.
  Vérifier la branche mesurée dans un navigateur et décider le seuil utile.
- **`fineDisplayThreshold`** : ce paramètre reste exposé mais le rendu actuel ne
  l’utilise pas. Décider s’il doit piloter une capacité de lisibilité, être
  supprimé ou recevoir une autre définition avant toute modification de code.
- **Gap par défaut des divisions** : le code tente d’aligner le gap local sur la
  taille des pistes de la grille parente si elle est mesurable. Ajouter une
  preuve de ce chemin ou réviser la décision de défaut et de repli.
- **Cassure et géométrie** : `breakContainer()` partage actuellement l’emprise
  par `rows` et `cols` sans tenir compte du `gap` CSS local. Si l’emprise ne se
  divise pas exactement, les placements produits peuvent aussi avoir des
  coordonnées ou spans fractionnaires. Décider si la cassure doit conserver les
  écarts visibles, les convertir en pistes réservées, ou appliquer une autre
  règle ; définir aussi le comportement pour les divisions non entières. Le
  tester avant de présenter la géométrie cassée comme une reproduction exacte.
- **`ZoneGridModel.padding`** : le champ est encore déclaré mais n’est ni lu
  par le rendu ni couvert par les tests. Décider s’il a un rôle, puis le
  spécifier dans un plan accepté avant de modifier le code, ou le retirer par
  un plan.
- **Noms lors d’une cassure** : `breakContainer()` produit des noms à partir du
  nom du parent et des coordonnées, sans contrôler leur collision avec une
  autre zone. Décider la règle de collision avant de garantir l’unicité des
  noms après cassure.
- **Collision de nom à la fusion** : `addZone()` et `renameZone()` rejettent les
  noms déjà présents ; `mergeZones()` n’a pas de test ni de rejet vérifié quand
  son nom explicite entre en collision avec une zone non fusionnée. Décider si
  l’unicité s’applique aussi à la fusion avant d’en faire une garantie générale.
  Le parcours d’acceptation doit couvrir cette collision.
- **Card** : `ZoneCard` est un alias du modèle de zones ; le catalogue, la
  sauvegarde et l’application des cards dans l’éditeur hôte restent à définir.
- **Utilitaire de pistes réservées** : `adjustFineGridForReservedTracks()` est
  exportée et testée, mais n’a pas d’appelant ; le rendu actuel n’utilise pas
  de cellules macro. Déterminer si l’utilitaire reste une API, est supprimé
  via un plan, ou retrouve un consommateur validé.
- **Noms des enfants avant cassure** : les libellés calculés existent, mais le
  hit-test et la sélection d’un enfant avant `breakContainer()` ne sont pas
  décidés.
- **Taille maximale des divisions** : aucune limite n’est appliquée au nombre
  de cellules d’un `container`. Décider si un plafond est nécessaire et quelle
  validation protège l’éditeur contre une grille locale excessive.
- **État hérité de `splitZone`** : déterminer si des données persistées issues
  de l’ancien modèle plat existent et si une migration est nécessaire.
- **Unités adaptatives** : le passage des pixels du mode libre à `cqw`/`cqh` a
  été reporté ; le propriétaire de cette conversion (hôte, middleware ou
  capsule-automation) n’est pas décidé.
- **Cycle de vie du listener Delete/Backspace** : `destroy()` enlève le
  listener des flèches mais pas celui de suppression. Le test actuel vérifie
  seulement qu’une frappe après destruction ne mute pas l’état grâce au garde
  `destroyed`; il ne prouve pas le retrait de l’écoute. Corriger dans un plan
  accepté et vérifier explicitement le retrait des deux listeners.

Les pistes de grille de taille variable, la fusion d’enfants d’un même
container, le réglage graphique du gap et l’undo/redo ne font pas partie du
contrat vérifié. Leur intérêt et leur parcours d’acceptation restent à décider
avant d’en faire un plan de réalisation.
