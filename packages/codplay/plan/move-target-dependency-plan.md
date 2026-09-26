# Plan d’acceptation — dépendance d’un move à sa cible

## Statut

En cours — le sous-ensemble vérifié est décrit dans la
[spécification](../specs/move-target-dependency-v2-spec.md). La validation
complète sur le runner HTML reste ouverte.

La surface auteur de move est définie par sa
[spécification](../specs/move-v2-spec.md). Le mouvement visuel et sa
préparation par occurrence restent coordonnés par le
[plan motion](./motion-live-discovery-invalidation-plan.md).

## Gates restantes

### 1. Interaction réelle et sources d’événement

- Valider dans un navigateur qu’un déplacement continu de la cible ne lance
  aucune capture ni aucun recalcul, puis qu’un relâchement provoque un seul
  retarget sans saut.
- Valider qu’un move équivalent produit par une autre source emprunte le même
  circuit et donne le même résultat.
- Vérifier qu’un déplacement de la source seule ne change pas le trajet vers la
  cible.

### 2. Composition des mouvements

- Valider plusieurs items dépendant d’une même cible dans une préparation
  cohérente, avec les mesures partagées dédupliquées.
- Couvrir les placements locaux et reparent, les targets-perso, les relations
  parent/enfant, les reflows simultanés et les conflits entre mouvements.
- Vérifier le chemin quadratique au point de contrôle unique aux frontières de
  retarget.
- Vérifier qu'un retarget de target seul conserve la phase, l'endpoint, l'easing
  et le path de l'item, ainsi que l'atomicité de la publication si une capture
  échoue.

### 3. Temps et lifecycle

- Comparer Play et Seek avant, à et après la frontière de retarget.
- Rejouer les cas de reset, replay, isolation et occurrences repeat, sans
  dépendance ni segment devenu obsolète.
- Vérifier resize, persistance, teardown et destruction sur le runner réel.

### 4. Validation finale

Après fermeture des gates ci-dessus, exécuter les tests CodPlay, le typecheck,
le build et l’acceptation navigateur applicable. Le plan restera En cours
jusqu’à ce que ces preuves couvrent les frontières concernées.
