# Plan — invalidation de présentation au reset d'une story

> Status: En cours — le reset logique est spécifié et vérifié ; les gates de
> présentation motion restent ouvertes.
> CodPlay version: V2 foundation
> Spécification logique: [`event-pipeline-v2-spec.md`](../specs/event-pipeline-v2-spec.md)
> Coordination motion: [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

Ce plan suit uniquement l'invalidation de présentation liée au reset d'une
story. Le dispatch, la frontière de projection, la conservation du journal et
le comportement logique au Seek sont définis dans la spécification
[événementielle](../specs/event-pipeline-v2-spec.md). Ils ne sont pas redéfinis
ici.

## Décisions retenues, application à fermer

- Un reset logique ne déclenche ni mesure ni capture motion ; l'état restauré
  est présenté sans transition depuis l'ancienne pose.
- Les groupes motion portent les stories qu'ils touchent. Un reset retire les
  groupes concernés, leurs frontières, leurs dépendances géométriques et leurs
  ressources overlay. Un groupe inter-story est retiré en entier si l'une des
  stories qu'il touche est réinitialisée.
- Une préparation motion en cours qui touche la story réinitialisée ne peut pas
  être committée après le reset. Elle est annulée ou ordonnée avant lui et ses
  ressources provisoires sont libérées.
- Après invalidation, Seek reconstruit un groupe antérieur seulement lorsqu'il
  doit présenter le move correspondant. Resize invalide les poses capturées et
  laisse la recapture au prochain besoin ; il ne relance pas une découverte
  globale du calendrier.

## Travail et gates restants

### 1. Fermer le retrait par groupe

La première passe transporte les stories source et destination et retire les
groupes concernés. Vérifier que le graphe et le host ne conservent aucune
géométrie, frontière ou ressource d'un groupe supprimé.

**Gate :** un groupe local et un groupe inter-story sont entièrement retirés
lorsqu'une story qu'ils touchent est réinitialisée.

### 2. Fermer l'ordre avec une préparation motion

Raccorder la frontière de reset au runner transactionnel. Vérifier qu'une
préparation concurrente concernant la story ne peut ni publier sa capture ni
committer son graphe après le reset ; libérer les ressources provisoires.

**Gate :** reset pendant un move ou un reparent sans ghost, masque, capture
tardive ou segment résiduel.

### 3. Fermer Seek, resize et cycle de vie

Vérifier que Seek avant et après le reset utilise la même instance et ne
réutilise pas un graphe supprimé. Vérifier que resize invalide les poses sans
recapture anticipée et que les ressources restantes sont détruites au teardown.

**Gate :** Play, Seek, replay, resize, persistence, lifecycle et destruction
restent cohérents autour d'un ou plusieurs resets, y compris à temps égal.

## Validation restante

- [x] Sur le chemin facade HTML, un reset retire l’overlay et le segment actif
      d’un move/reparent de la story ; Seek avant la frontière les restaure et
      Seek sur la frontière les retire de nouveau. Vérifié par
      [`facade.spec.ts`](../tests/facade/facade.spec.ts) le 2026-09-26.
- move local et reparent avant, pendant et après le reset ;
- groupe motion qui touche plusieurs stories ;
- Seek à froid et après capture, de part et d'autre de la frontière ;
- absence de mesure ou capture déclenchée par le reset seul ;
- parcours navigateur réel, y compris Safari, sans remount ni ressource overlay
  résiduelle. Le [relevé Safari de la scène position](./notes/2026-09-05-position-scene-measures.md)
  est un état de référence avant reset ; il ne prouve pas le résultat après reset.

Le plan reste `En cours` jusqu'à fermeture de ces gates et transfert des seuls
comportements démontrés dans une spécification motion ciblée. La spécification
du reset logique demeure dans `event-pipeline-v2-spec.md`.
