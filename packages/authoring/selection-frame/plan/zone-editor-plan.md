# Plan — intégration et acceptation de l’éditeur de zones

> Statut : **En cours**. Le modèle et l’éditeur ont un périmètre vérifié dans
> la [spécification zone-editor](../specs/zone-editor-spec.md). Le noyau de
> gestes/modèle est maintenant partagé par des hôtes numérique et historique ;
> Editor monte l’entrée V2 sur la capsule racine et écrit par sa transaction
> existante. Le navigateur accepte désormais la déclaration d’une zone seule,
> sa sélection stable et la création d’un bloc dans cette zone sans nouvelle
> zone. Le panneau zone complet de dedit (nommage, suppression et cartes) reste
> à raccorder. Cette interface
> est décrite au §7 du [contrat dedit](../../../editor/plan/2026-07-07-dedit-spec.md)
> et au §3 du [plan UI dedit](../../../editor/plan/modules/2026-07-08-dedit-shadcn-ui-plan.md) ;
> aucun contrôle de layout général ne doit être ajouté. L’intégration reste
> limitée à la surface racine : les enfants persistés des `container`, les
> surfaces des capsules imbriquées, le drop, la palette et les cards restent à
> intégrer. Editor ne lit ni ne transmet de node player.

## Décisions acceptées — travaux et validation

| Décision | Travail restant | Parcours d’acceptation |
|---|---|---|
| La capsule est l’unique propriétaire de sa grille. La capsule racine existe sans être matérialisée comme item ; elle sert de surface de placement. Une zone est distincte d’un bloc et se définit dans l’éditeur de zones. Après raccord, le parcours par défaut crée un bloc dans une zone existante choisie. | Le parcours racine V2 et l’exposition de l’`id` sélectionné au menu de création sont codés et acceptés. Raccorder encore le panneau zone de dedit (nommage/suppression), puis réconcilier ses rectangles libres avec les emprises en pistes de selection-frame. Capsule Automation reste propriétaire de l’attribution des emprises CSS ; l’emprise de zone est le défaut du bloc. | Le parcours racine a été vérifié dans Editor : déclarer une zone sans bloc, la sélectionner, créer un bloc qui la référence sans augmenter le nombre de zones, vérifier l’emprise, Undo et recharger SQLite après avoir annulé les gestes de vérification. Le tracé zone+bloc reste un repli à réexaminer, pas le défaut. |
| Les divisions `container` restent internes au zone-editor ; les placements fournis à capsule-automation sont plats. | Définir et appliquer dans l’hôte la conversion requise avant qu’une zone enfant devienne un placement réel. | Un test d’intégration prouve que l’hôte ne transmet que des placements feuilles et que casser un container conserve l’attachement de chaque enfant par son `id`. |
| Une attache persistante cible l’`id` stable d’une zone, pas son nom modifiable. | `DecorPatch.zoneId`, le bridge et `ZoneDef.id` utilisent maintenant l’identifiant. Il reste à raccorder la palette et la sauvegarde hôte à cette table; sa géométrie dedit est encore en rectangles cqw. | Une intégration crée une attache, renomme la zone, puis vérifie qu’elle reste liée au même `id`, y compris après `breakContainer()`. |
| Le déplacement entre zones reste dans la capsule de l’item ; la création de bloc reprend par défaut l’`id` de la zone sélectionnée. | La création racine par `Zone.id` est acceptée. Il reste à éditer `Decor.zoneId` sur un keyframe pose dans l’interface et à accepter le `move` V2 de la cible de zone ; Capsule Automation calcule l’emprise. | Créer un bloc dans une zone, l’affecter à une autre zone de la même capsule sur un keyframe pose, puis vérifier la trajectoire calculée par `move`, Seek et Undo/Redo ; aucun circuit parallèle ou changement CodPlay. |
| Les surfaces conditionnées (par exemple par orientation) sont choisies et stockées par l’éditeur hôte ; zone-editor reçoit l’état d’une seule surface à la fois. | La surface racine portrait/paysage est raccordée au bridge et à `setState()`. Étendre aux capsules imbriquées et raccorder le format complet au [plan orientation](../../../editor/plan/modules/2026-07-11-zone-orientation-variants-plan.md). | Changer l’orientation charge la surface correspondante dans Editor ; le même contrat reste à prouver pour les capsules imbriquées, sans ajouter cette connaissance à `createZoneEditorV2()`. |
| Les catalogues de cards et de grilles appartiennent à l’éditeur hôte ; zone-editor ne reçoit que des valeurs de modèle. | Garder `ZoneCard` comme alias local tant que le format du catalogue, la sauvegarde et la réapplication côté hôte ne sont pas réconciliés avec le modèle dedit. | Une intégration sauvegarde puis réapplique une card et vérifie l’état complet, sans catalogue interne à selection-frame. |
| Dans la capsule racine fine, le déplacement d’un item par le Selection Frame réassigne sa zone. Le centre visuel du cadre identifie la zone avec le hit-test de pistes du zone-editor ; la cible doit appartenir à la capsule de l’item. Pour des zones superposées, la zone sélectionnée est retenue si elle fait partie des candidates, sinon une candidate unique est requise. Une cible absente, ambiguë ou inchangée annule le déplacement sans écrire d’offset. Le mode transform conserve le déplacement géométrique existant ; redimensionnement et rotation restent des gestes géométriques. | Exposer le hit-test en coordonnées viewport depuis le handle partagé et le réutiliser dans `decor-editor-bridge`. Dans la surface racine fine, le drag de l’item écrit uniquement `Decor.zoneId` au KF pose courant (création entre KFs, promotion d’un KF décor si nécessaire) par la transaction et le copy-on-write existants. Le Selection Frame passe au-dessus de l’overlay de zones pour recevoir le pointerdown de l’item. Le Builder V2 consomme ensuite le `move` déjà généré par changement de zone. | Dans Editor, faire glisser un bloc d’une zone visible vers une autre : l’affectation change sans offset ni zone créée, la présentation rejoint la cible par `move`, et l’objet reste dans la même capsule. Vérifier les KFs pose exacts et intermédiaires, l’Undo/Redo, le cas d’une zone superposée sélectionnée, puis confirmer qu’un drop absent/ambigu ne modifie pas le document. |
| L’intégration des zones dans Editor utilise exclusivement l’interface V2 numérique ; aucune pose de nœud player n’entre dans ce circuit. | Le contrôle d’affichage racine et l’overlay numérique sont raccordés au menu existant, sans modifier le layout général ni le cœur CodPlay. Le panneau complet dedit et les surfaces de capsules imbriquées restent à intégrer. | Depuis le parcours racine, créer, sélectionner et déplacer des zones ; seek, rebuild, resize et détachement resynchronisent leur surface. Vérifier que le bridge Editor appelle l’entrée V2 à pose numérique et n’accède pas aux nœuds du player. |

## Décisions ouvertes et validations restantes

- **Acceptation du drop vers une zone** : l’API de hit-test, le raccord à
  `Decor.zoneId` et le routage Builder `move` sont codés ; le typecheck et le
  build Editor passent. Le serveur Safari est configuré et expose ses outils,
  mais l’onglet de validation renvoie `document.hidden === true` même après
  sélection. Aucune interaction browser n’a été simulée et aucune scène SQLite
  de l’application n’a été modifiée ; vérifier Play, Seek et Undo/Redo quand
  l’onglet sera réellement visible.
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
- **Unités auteur** : décision utilisateur (2026-10-31) : les longueurs du
  mode libre restent en `cqw` dans le document, la palette et la sauvegarde ;
  les pixels ne sont pas une unité auteur. Les coordonnées DOM physiques sont
  internes aux calculs de présentation et de hit-test. Les zones de grille
  gardent leurs indices de pistes (`row`, `col`, `rowSpan`, `colSpan`), qui ne
  sont pas des longueurs CSS. La conversion cqw ↔ présentation reste dans
  l’hôte Editor.
- **Identité des enfants d’un container** : `EditorScene.ZoneContainer.children`
  et SQLite stockent des rectangles sans `id`, alors que `createZoneEditor()`
  garantit des identifiants d’enfants stables qui doivent survivre à l’attache,
  au redimensionnement et à `breakContainer()`. Réconcilier la forme persistée
  avant d’exposer les cellules internes comme cibles.
- **Cycle de vie du listener Delete/Backspace** : `destroy()` enlève le
  listener des flèches mais pas celui de suppression. Le test actuel vérifie
  seulement qu’une frappe après destruction ne mute pas l’état grâce au garde
  `destroyed`; il ne prouve pas le retrait de l’écoute. Corriger dans un plan
  accepté et vérifier explicitement le retrait des deux listeners.

Les pistes de grille de taille variable, la fusion d’enfants d’un même
container, le réglage graphique du gap et l’undo/redo ne font pas partie du
contrat vérifié. Leur intérêt et leur parcours d’acceptation restent à décider
avant d’en faire un plan de réalisation.
