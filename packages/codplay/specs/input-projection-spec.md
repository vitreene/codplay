# CodPlay V2 — projection vivante des composants `input`

## Périmètre vérifié

Cette spécification décrit le contrat vérifié de projection scalaire vivante
vers un composant `input` déjà monté.

Cette spécification décrit la frontière utilisée lorsqu'une observation vivante
doit atteindre un contrôle déjà matérialisé, notamment la progression d'une
telco. Elle complète le pilotage `instance.telco` sans transformer une valeur
continue en événement runtime.

## Rôle

Une instance expose une surface de présentation dédiée :

```ts
instance.projection.setInputValue(
  { storyId: 'main', persoId: 'progress-control' },
  2_500,
)
```

La surface résout la cible dans la scène actuellement présentée, vérifie que
le perso est de type `input`, puis remet la valeur au composant `InputComponent`
monté. L'appelant ne reçoit ni référence DOM, ni composant, ni runner.

## Invariants

- la cible est adressée par `{ storyId, persoId }` et doit appartenir à la
  scène actuellement présentée ;
- la valeur acceptée est une chaîne ou un nombre fini ;
- la projection met à jour la représentation du contrôle, mais ne modifie pas
  l'état logique du perso ;
- elle n'ajoute aucun event, ne change pas la révision du journal et ne publie
  pas de trace ;
- une présentation logique normale (Play, Seek ou event) peut remplacer cette
  valeur transitoire ;
- une instance détruite ou non présentée refuse la projection avec un résultat
  structuré ;
- l'absence de cible, le mauvais type et l'absence de surface matérialisée sont
  également signalés par un résultat structuré et un diagnostic de façade ;
- la surface ne possède ni ticker ni mémoire de progression : le consommateur
  fournit la source, la cadence et le cycle d'abonnement.

Les codes publics sont `INSTANCE_DESTROYED`, `TIME_NOT_PRESENTED`,
`TARGET_NOT_PRESENT`, `TARGET_NOT_INPUT`, `PROJECTION_UNAVAILABLE` et
`INVALID_VALUE`.

## Relation avec la telco et l'`idle`

La telco reste la source publique de lecture : `onProgress()` observe et
`seek()` commande une nouvelle position. La projection ne remplace ni l'un ni
l'autre et ne doit pas être envoyée par `events.emit()`.

La politique `idle` est indépendante. Elle est désactivée explicitement dans
le propriétaire CodPlay de Demo 4 (`engine.idle: false`) ; la telco ne reçoit
donc pas l'`idle` par défaut. `pauseOnDocumentHidden` constitue une autre
option, relative à la politique de visibilité du document.

## Validation

- `tests/facade/input-projection.spec.ts` vérifie la projection montée,
  l'absence d'effet logique ou journalisé, le remplacement par un Seek et les
  erreurs de cible et de teardown ;
- `tests/facade/sighty-demo4.spec.ts` vérifie le progress vivant pendant Play,
  sa stabilité en pause, le Seek, le changement A/B et l'invalidation de la
  scène sortie ;
- Demo 4 conserve un seul contrôle `input` dans la telco de scène et utilise le
  chemin public `onProgress` → `instance.projection.setInputValue()`.
