# Lecteur runtime V2

> Statut : Fixe
> Version CodPlay : V2 foundation
> Relecture : contrat Engine/Player et seek groupé validés le 2026-08-20 ; renderer de production et capacités supplémentaires restent ouverts

## Rôle

`RuntimePlayer` évalue une scène compilée à un instant logique donné. Il pilote
le cycle de vie, synchronise les composants et demande au materializer d'appliquer
la structure résolue.

Il ne mesure pas la géométrie du navigateur et ne possède pas l'horloge
d'animation. Ces responsabilités restent au runner, au materializer et aux
capacités spécialisées.

## Fonctionnement

Le chemin commun à Play, Seek et à la capture de géométrie est :

```text
CompiledScene + temps
  -> materialize
  -> resolve
  -> solve
  -> SolvedScene + SolvedGraph
```

Le player synchronise chaque composant une fois, puis transmet la scène complète
au materializer pour le commit structurel et l'éventuelle présentation de
mouvement. Il n'existe pas de chemin visuel spécial pour `advance`, de replay
historique séparé ou de carte d'ordre possédée par un module.

`SolvedGraph` est la source unique pour le parent logique, la cible opaque,
l'ordre complet des enfants, les racines montées et la révision structurelle.
`flipMode` reste une indication de présentation ; il ne modifie ni la résolution
des cibles ni l'ordre structurel.

## Organisation interne

`RuntimePlayer` reste la façade publique du cycle de vie. Ses dossiers internes
ont des responsabilités distinctes :

- `capture/` résout les cibles d'actions compilées, applique les actions live,
  fusionne l'état de capture et porte ses types ;
- `scene/` contient la reconstruction pure `materialize -> resolve -> solve` ;
- `modules/` délègue les notifications, l'horloge native, l'ordre structurel,
  les deltas de mouvement et l'annulation du seek ;
- `diagnostics/` transforme les problèmes de mouvement en rapports détachés.

Ces fonctions reçoivent leurs dépendances depuis le player. Elles ne créent ni
player, ni journal, ni registre de modules, ni circuit de seek parallèle.

`StructuralTimeline` produit les instantanés immuables d'ordre des enfants à
partir des frontières d'événements compilées. Il remplace la relecture d'une
liste mutable et l'état historique de modules.

La timeline distingue exactement les deux côtés d'une frontière :

- `resolveAt(t)` inclut les événements à `t` ;
- `resolveBefore(t)` les exclut.

`materializeSceneBeforeBoundary()` applique directement le côté gauche, sans
epsilon numérique. Un événement à `0 ms` possède donc un état initial réel et un
état post-événement distinct.

## Événements et capture

`RuntimePlayer.emit()` est l'entrée live. Il ajoute l'événement au
`RuntimeTrackJournal`, choisit les règles de story avant le fallback de scène,
exécute les transforms et les straps attendus, persiste les sorties sur leurs
tracks et ne réinjecte que les `emit` déclarés, avec une profondeur bornée.

Un seul allocateur d'identifiants est partagé par les dispatchers ; un événement
de début et son événement de fin ne peuvent donc pas entrer en collision.

Le runner visible possède le journal. Play peut mettre à jour l'affichage
immédiatement, puis un Seek relit les mêmes événements, sorties de straps et
mises à jour d'état sans rappeler les straps ni les transforms. La capture de
géométrie utilise le même hôte de composants persistant et ne crée pas un second
player.

La façade de capture (`beginCapture`, `trackCapture`, `endCapture`,
`cancelCapture`) ne dépend pas de la source. Les samples ne sont pas des
événements. `endEmit` suit le circuit normal et transporte `data.captureState`
à travers `listen -> strap -> state`. Les événements de `endCapture` suivent le
même dispatch avec la position implicite `persist-only` et l'ancrage `now -
duration`.

Un fait `persist-only` est journalisé, mais reste hors de la tête de lecture
pendant la fermeture courante ; une reconstruction ultérieure peut l'inclure.
`beginCompiledCapture()` résout les fonctions compilées et utilise l'index fixe
`actionTargetIndex` produit par le builder. Les références directes sont
préparées à la construction ; une action live ne fait que lire cet index.

Après l'ajout d'un eventime au journal, le player appelle un raccord interne du
runner. Ce raccord ne mesure rien et n'ajoute aucune API publique : le runner
recompile le planning et ne recapture que si les données de l'eventime
introduisent effectivement un `move`. Ainsi, un eventime sans `move` ne crée pas
de graphe, tandis qu'un `move` ajouté après `init()` suit le même chemin de
capture que `resize()` et reste disponible pour Play, Seek et replay.

## Actions temporelles

`ActionSequence` est développé pendant `materialize` en actions directes
appartenant au `perso` qui a déclaré la clé. Cette expansion est pure : elle
n'ajoute pas d'événement de continuation et ne crée pas de circuit de replay.
Une occurrence plus récente remplace les étapes en attente de la même clé ; les
étapes statiques déjà appliquées restent des faits et un `TweenAction` remplacé
n'est plus évalué à sa cible.

`TweenAction` est résolu depuis la collection de fonctions compilées avec
`progress = ease(clamp(elapsed / duration))`. Son résultat est appliqué comme une
action statique. `tween:stop` est une frontière logique et ne devient pas un
patch de perso.

## Contrat et limites

- l'état logique n'est jamais reconstruit à partir du DOM ;
- une cible contient chaque enfant monté exactement une fois ;
- l'évaluation d'une frontière est explicite et indépendante de l'échelle ;
- les services des composants sont les seuls écrivains de l'état DOM auteur ;
- les modules peuvent observer les deltas, mais ne peuvent pas créer une autre
  histoire de layout pour Play ou Seek ;
- `RuntimeTrackJournal` est le seul historique live ;
- `seek()` ne fait que matérialiser les événements, transforms et straps ;
- `ActionSequence` et `TweenAction` utilisent le même chemin de reconstruction
  pour Play et Seek.
