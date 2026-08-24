# Graphe de mouvement V2

> Statut : Fini — graphe de mouvement V2 foundation
> Version CodPlay : V2 foundation
> Relecture : frontières move/action, résolution Play/Seek et absence de lecture géométrique par frame validées le 2026-08-23

## Rôle

Le module de mouvement transforme les changements de structure et de position
en une description temporelle immuable. Cette description permet de connaître la
pose d'un élément à n'importe quel instant, pour Play comme pour Seek.

Le module ne possède ni nœud DOM, ni état de transport, ni animation mutable.
Il produit uniquement des données consommées par le runner et le materializer.

## Fonctionnement

```text
Intentions de mouvement compilées
  + géométrie avant et après la frontière
  -> MotionGraph
  -> resolvePresentationFrame(graph, layoutCourant, t)
```

Une frontière correspond à un changement précis de la scène. Le graphe conserve
les poses de départ et d'arrivée, puis calcule la pose demandée à partir du
temps absolu `t`.

## Organisation interne

- `LayoutSnapshot` contient les éléments mesurés, leur cible, leur parent
  logique et leurs poses relatives au parent et à la racine. La pose relative
  au parent est la seule référence locale publiée ; le runner ajoute seulement
  les ancêtres nécessaires au calcul ;
- `MotionBoundary` contient les layouts exacts avant et après un événement. Pour
  une transition portée par une action, l'après est capturé à
  `start + delay + duration` ;
- `ItemMotionTrack` contient les segments chronologiques d'un élément ;
- `MotionAttachment` décrit le parent, la cible, la pose locale et le fallback
  vers la racine ;
- `MotionGraph.presentationItemIds` liste uniquement les éléments qui possèdent
  une trajectoire à présenter ;
- `PresentationFrame` contient la pose et la représentation demandées pour ces
  éléments à un instant donné.

Lors d'un `move` structurel, la capture inclut tous les éléments des cibles
source et destination. Un élément qui possède aussi un mouvement direct ultérieur
reste disponible pour animer le reflow de la liste, mais son instantané naturel
ne peut pas écraser sa propre trajectoire. Un élément capturé seulement comme
ancêtre reste une dépendance de calcul et ne devient pas automatiquement
propriétaire d'un segment.

## Planification

À chaque frontière, le planificateur ferme la portée sur les éléments en
mouvement, les éléments réordonnés et les ancêtres jusqu'à la racine. Il compare
les attaches locales sélectionnées, mais seuls les mouvements directs et les
éléments du reflow possèdent un segment. Les ancêtres restent disponibles pour
composer leur propre trajectoire si nécessaire.

Le runner peut produire deux plannings à partir du même journal :

- le planning de présentation courante exclut les faits `persist-only` ;
- le planning de reconstruction les inclut.

Les deux utilisent les mêmes `MotionBoundary` et le même graphe. Ainsi, un
`endEmit` live conserve la première géométrie visible, tandis qu'un seek utilise
la frontière logique persistée sans conserver une branche spéciale de capture.

Le planning est compilé à l'initialisation du journal visible, après une capture
live terminée et après un resize. Il contient les transitions `move.transition`
et les transitions d'action qui produisent une pose géométrique. La géométrie
naturelle est capturée aux frontières FIRST/LAST correspondantes ou après une
invalidation structurelle explicite, puis conservée comme donnée.

Une intention directe conserve son délai et son timing. Les éléments réordonnés
utilisent le timing effectif le plus long de la frontière. Un changement de
cible ou de parent impose le mode `reparent`; sinon l'indication de l'auteur
peut choisir `local` ou `reparent`.

Lorsqu'une frontière recouvre un segment existant, le segment est recalé sur la
pose visuelle déjà résolue. Sa phase, sa trajectoire et sa date de fin restent
inchangées. Aucun segment actif n'est redémarré à zéro, annulé globalement ou
remplacé par un simple point final.

## Résolution

La résolution est pure et limitée aux éléments qui possèdent une trajectoire :

1. sélectionner les identifiants préparés dans `presentationItemIds` ;
2. trouver le dernier segment actif à l'instant `t` ;
3. calculer la pose de l'élément, en utilisant si nécessaire le contexte privé
   de ses parents en mouvement ;
4. interpoler les attaches avec l'easing et le chemin ACE ;
5. produire uniquement l'entrée de présentation de l'élément.

Un parent en mouvement ne peut pas être ignoré : il modifie la pose mondiale de
son enfant. Cependant, sa présence dans le calcul ne crée pas de nouvelle entrée
de présentation s'il ne possède pas son propre segment. Le graphe prépare cette
dépendance à l'avance et la frame ne parcourt pas toute la mise en page.

Le même graphe et la même géométrie naturelle produisent toujours la même frame.
Résoudre une frame ancienne ne modifie pas les résolutions suivantes.

Une transition de pose HTML portée par une action reste dans le graphe pour la
composition des descendants, mais son service possède la pose du nœud auteur.
Le host HTML ne lui applique donc pas une seconde matrice locale.

## Inférence de la présentation

- même cible : `local` par défaut ;
- cible ou parent logique différent : `reparent` ;
- `flipMode: 'overlay-world'` : `reparent`, même si la cible ne change pas ;
- `local` ne peut pas annuler un véritable changement de cible ou de parent.

## Contrat et limites

- aucune lecture du DOM pendant la résolution d'une frame ;
- aucune création d'arbre de mesure ;
- les instantanés de géométrie contiennent des données, jamais des références
  DOM ;
- chaque élément possède ses segments temporels indépendamment ;
- l'influence des parents est composée récursivement ;
- une trajectoire locale recouverte conserve sa phase d'interpolation ;
- une seule source ou représentation indépendante est visible par élément ;
- les poses HTML utilisent des origines affines et des matrices ;
  `rect.left/top` restent de simples valeurs AABB dérivées.
