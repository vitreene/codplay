# Relevé de mesure — scène `position` V2

## Statut

> Type : note de mesure, non contractuelle
> Date : 2026-09-05
> Version CodPlay : V2 foundation

Cette note fige les observations faites dans Safari avant toute nouvelle
analyse de la correction motion. Elle ne propose aucun patch et ne transforme
pas une observation DOM en mécanisme runtime.

## Protocole

- serveur : `http://127.0.0.1:5173/` ;
- entrée : `/?demo=position` ;
- navigateur : Safari ;
- viewport CSS : `1024 × 664 px` ;
- `devicePixelRatio` : `2` ;
- navigation : passage manuel de la cellule 01 à la cellule 02 par le clavier,
  puis pause et lecture de la position logique affichée par la télécommande ;
- toutes les valeurs ci-dessous sont en pixels CSS et proviennent de
  `getBoundingClientRect()` et des styles calculés, uniquement pour le relevé.

Les six cellules du carousel sont montées en même temps dans le DOM. Une seule
est rendue visible par les classes de présentation du carousel.

## Séquence observée

| Temps logique | Observation dans le journal |
| ---: | --- |
| `985 ms` | navigation clavier vers la cellule 02 ; arrêt de la transition précédente ; outro de la cellule 01 et intro de la cellule 02 |
| `1000 ms` | événement temporel du `move` initial de la cellule 01 |
| `1435 ms` | événements de déplacement vertical de la source et de la cible de la cellule 02 |
| `2335 ms` | événement `move` de l’item de la cellule 02, avec reparenting overlay et transition de `2000 ms` |

Le nom exact de l’événement de démonstration n’est pas retenu comme contrat
CodPlay dans cette note. Seule sa portée temporelle et son payload observé
importent ici.

## Mesure à `2330 ms`, juste avant le `move` de la cellule 02

État de la télécommande : `paused`, temps logique `2330 ms`, cellule `02 / 06`.

### Cadre et cellules

| Élément | Rectangle |
| --- | --- |
| chaque cellule du carousel | `left=13.28125`, `top=150.421875`, `width=997.4375`, `height=364.953125` |
| cellule 01 | même rectangle, `visibility=hidden` |
| cellule 02 | même rectangle, `visibility=visible` |
| cellules 03 à 06 | même rectangle, `visibility=hidden` |
| scène de déplacement de la cellule 02 | `left=45.28125`, `top=182.421875`, `width=933.4375`, `height=245.640625`, `overflow=hidden` |

### Source, cible et item naturels de la cellule 02

| Élément | Rectangle / état |
| --- | --- |
| source | `left=46.28125`, `top=253.32309`, `width=327.375`, `height=146.078125`, transformée `translateY(21.119972)` |
| cible | `left=650.328125`, `top=211.08316`, `width=327.390625`, `height=146.078125`, transformée `translateY(-21.119972)` |
| item `main:position-view-two-item` | `left=171.5625`, `top=316.97934`, `width=76.796875`, `height=76.796875`, visible, dans `position-node__outlet` de la source |

À cet instant, l’item naturel de la cellule 01 est masqué :
`main:position-view-one-item`, `left=776.25`, `top=295.859375`,
`width=76.796875`, `height=76.796875`.

### Projection résiduelle

Un `DIV` de couche overlay est visible. Il est enfant direct de la cellule 02
(`position-view ... position-view--visible`) et non de la scène générale. À
cet instant précis, il n’est pas enfant de la scène de déplacement.

Il contient un seul ghost :

- identifiant logique : `main:position-view-one-item` ;
- rectangle : `left=685.22217`, `top=295.859375`,
  `width=76.796875`, `height=76.796875` ;
- visibilité : `visible` ;
- transform calculée : `matrix(1, 0, 0, 1, 671.940948, 145.4375)`.

Le constat est donc simultané : l’item naturel de la cellule 02 est visible,
et le ghost de l’item de la cellule 01 est encore projeté. Les identifiants
logiques des deux items sont distincts ; aucune collision d’identifiant n’est
mesurée.

## Mesure à la frontière `2335 ms`

Après l’ajout de l’événement `move` de la cellule 02, le snapshot relevé
montre :

- scène de déplacement : `left=45.28125`, `top=182.421875`,
  `width=933.4375`, `height=245.640625` ;
- couche overlay : `left=46.28125`, `top=183.421875`,
  `width=931.4375`, `height=243.640625`, enfant de la scène de déplacement ;
- ghost violet `main:position-view-one-item` :
  `left=720.244934`, `top=328.859375`, taille `76.796875 × 76.796875` ;
- ghost corail `main:position-view-two-item` :
  `left=204.5625`, `top=350.204041`, taille `76.796875 × 76.796875` ;
- les deux items naturels correspondants sont masqués pendant la projection.

Le parentage de la couche observée change donc entre les deux relevés. Ce
fait est conservé comme donnée à expliquer ; il ne suffit pas, à lui seul, à
identifier la correction à appliquer.

## Observation complémentaire d’une exécution précédente

Vers `4391 ms`, un relevé antérieur a trouvé le ghost de l’item de la cellule
02 sous une chaîne d’ancêtres terminant dans une cellule masquée. Sa visibilité
calculée était alors `hidden`. Cette observation est approximative dans le
temps, mais elle confirme qu’une projection motion peut rester rattachée à un
contexte devenu masqué.

## Ce que ces mesures établissent

1. Le carousel conserve les six cellules montées ; il ne fait pas d’unmount
   lors de la navigation.
2. Une seule cellule est visible par le carousel.
3. Les identifiants des items des cellules 01 et 02 sont distincts.
4. La source et la cible de la cellule 02 restent visibles et conservent les
   dimensions mesurées ci-dessus avant le `move`.
5. Une projection de la cellule 01 subsiste au moment où la cellule 02 est
   visible.
6. Le parent de l’overlay relevé n’est pas constant entre les deux frontières.

Ces mesures ne démontrent ni une collision entre les deux stories, ni une
cause dans le DOM, ni la correction à apporter au graphe. Le DOM a servi à
observer le résultat HTML, pas à proposer une détection runtime.

Le fait que les six cellules soient actuellement montées dans une même
instance décrit l’état de cette démo au moment du relevé ; ce n’est pas une
validation du modèle d’architecture cible. Le modèle à examiner est celui de
démos préconstruites isolées par duplication d’instances.

## Points à reprendre après `story.reset()`

- savoir quelles projections temporaires sont encore actives au moment du
  reset ;
- vérifier que le reset retire le ghost et la couche temporaire sans démonter
  les nœuds auteur ;
- vérifier que la story de démo courante (ici la cellule 02) revient à son
  état initial ; ce relevé ne définit pas un reset de la story `main` ;
- comparer un relevé avant/après reset, au même temps logique, puis après
  seek et replay.
