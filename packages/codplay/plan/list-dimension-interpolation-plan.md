# Interpolation des dimensions d’une liste et de ses items V2

> Status: En cours — `resize` est implémenté dans la compilation, le graphe et
> le host HTML ; la validation complète des variantes de liste reste ouverte.
> CodPlay version: V2 foundation

Ce document traite uniquement de `width` et `height` pour une liste et pour les
items qu’elle contient. Les trajectoires, les matrices de position et le choix
de représentation d’un item appartiennent aux contrats de `move` et du runner.

## Contrat de dimensionnement

Lorsqu’un ajout, un retrait ou un réordonnancement modifie la taille naturelle
d’une liste, le runtime conserve les dimensions naturelles avant et après la
modification. Les valeurs intermédiaires sont interpolées sur les axes qui
participent à la transition.

La liste reste responsable de son contenu et de ses règles CSS. Le materializer
mesure le résultat du CSS après l’état structurel ; il ne reconstruit pas la
taille à partir d’une accumulation de mutations précédentes.

La capture porte sur :

- la largeur et la hauteur naturelles de la liste ;
- la largeur et la hauteur naturelles des items affectés ;
- les contraintes CSS qui déterminent ces dimensions (`min-*`, `max-*`, gaps,
  flex, grid et contenu intrinsèque).

Elle ne capture ni trajectoire, ni ancre, ni déplacement d’un item.

## `move.resize`

La propriété `resize` de `move` est facultative. Chaque axe absent vaut
`auto` :

- `auto` utilise les dimensions naturelles FIRST et LAST produites par le CSS,
  puis interpole ces deux valeurs ;
- `preserve` conserve la dimension naturelle de l’item dans son emplacement
  matérialisé après la frontière structurelle pendant la transition. Cette
  réservation empêche le conteneur de la comprimer pendant qu’il interpole sa
  propre dimension ; la pose visuelle de l’item continue l’interpolation
  FIRST/LAST habituelle ; la contribution est retirée après la dernière frame
  active et l’état CSS naturel reprend la main ;
- `container` calcule la dimension à partir de la place disponible dans le
  conteneur, après ses contraintes et ses autres enfants.

La propriété ne porte que sur `width` et `height`. Elle ne modifie ni la
destination, ni l’ordre, ni les règles CSS de débordement.

```ts
move: {
  target: 'list-target',
  resize: {
    width: 'auto',
    height: 'preserve',
  },
  transition: { duration: 400 },
}
```

Une déclaration CSS suffisante ne reçoit pas de propriété supplémentaire.
`overflow`, `overflow-x`, `overflow-y`, `width`, `height`, `min-*`, `max-*`,
les gaps et les règles flex/grid restent dans le CSS de la liste et de ses
items. En particulier, `overflow: scroll` ne demande aucune configuration
`list` dédiée.

Une propriété de liste n’est justifiée que si le runtime doit appliquer une
opération supplémentaire : désactiver ou créer une interpolation de dimension,
réserver une dimension capturée à un item, ou calculer la place restante du
mode `resize: 'container'`.

## Ordre de calcul

```text
état structurel après ajout/retrait
  -> CSS de la liste et des items
  -> mesure des dimensions naturelles FIRST/LAST
  -> application de la règle resize par axe
  -> interpolation width/height
```

Le CSS fournit donc les bornes naturelles. Le runtime ne relit pas le DOM à
chaque frame et ne déduit aucune position à partir d’une variation de taille.

L’implémentation actuelle porte la réservation `preserve` sur la source
matérialisée (`min-width`/`min-height`) ; la pose présentée continue les bornes
FIRST/LAST mesurées. La réservation est restaurée avec la couche de styles
transitoires. Le mode `container` dérive la
place disponible du parent et des dimensions naturelles capturées ; il ne
déclenche pas de mesure supplémentaire pendant la frame.

Pour une transition structurelle, le conteneur cible reste positionné par son
CSS. Le host lui applique seulement la dimension interpolée ; le contexte de
mise en page peut donc recalculer sa position à chaque écriture de taille. Le
conteneur n’est pas translaté une seconde fois par le graphe, ce qui évite un
saut au début ou au retrait de l’overlay.

## Validation attendue

- ajout et retrait avec variation de hauteur seulement ;
- ajout et retrait avec variation de largeur seulement ;
- variation simultanée de largeur et de hauteur ;
- contraintes `min-*` et `max-*` appliquées par le CSS ;
- `auto`, `preserve` et `container` sur chaque axe indépendamment ;
- `overflow: clip`, `auto` et `scroll` sans propriété de configuration
  supplémentaire ;
- mêmes dimensions finales et intermédiaires en Play et Seek.

## Fixture navigateur obligatoire

La démo `flip-nested` (`packages/demos/src/v2/demos/runner`) est la fixture
réelle de cette tranche. Elle doit être nettoyée avant l’implémentation afin de
faire apparaître le contrat :

- l’action qui déplace `P` déclare explicitement le mode `resize` non par défaut
  requis par le cas (`height: 'preserve'`) ;
- les dimensions, contraintes, gaps, flex/grid et overflow de la liste restent
  lisibles dans sa feuille CSS ; aucune propriété `list` ne répète une règle CSS
  suffisante ;
- les règles mortes ou les commentaires qui décrivent un ancien circuit sont
  retirés sans modifier la scène de validation ;
- la démonstration conserve un cas `auto` implicite pour vérifier que l’absence
  de `resize` garde le comportement existant.

L’acceptation se fait dans le navigateur sur la route `?demo=flip-nested`, avant
la frontière (`750 ms`), au démarrage (`800 ms`), pendant (`1500 ms`) et à la
fin (`2200 ms`, puis la frame suivante), en Play puis en Seek. Le contrôle de la
démo avance par pas de `10 ms`.
Elle vérifie la continuité des dimensions de la liste et de `P`, l’absence de
contraction imprévue des frères, la restauration des styles à LAST et
l’absence de régression sur `flip-stress` et `position`.

## Validation réalisée — 2026-09-10

- `npm run typecheck --workspace=codplay` et
  `npm run typecheck --workspace=@codplay/demos` passent ;
- la suite CodPlay complète passe (`94 fichiers`, `609 tests`), dont les tests
  ciblés motion, host HTML et compilation ;
- `npm run build --workspace=@codplay/demos` passe ;
- Firefox, route `?demo=flip-nested` : Seek à `750`, `800`, `850`, `1500`, `2200`
  et `2210 ms` conserve la pose visuelle interpolée de `P` et la réservation de
  son slot naturel ; la liste cible reste à `y=406,38 px` au démarrage, évolue
  progressivement (`y=404,33 px` à `850 ms`, `y=377,73 px` à `1500 ms`) et
  atteint `y=349,07 px` sans saut à LAST ; la réservation est retirée à la
  frame suivante ; Play atteint `3000 ms` sans erreur ;
- Firefox, routes `?demo=flip-stress` et `?demo=position` : état initial prêt,
  scène rendue, aucune erreur visible.
- Firefox, `?demo=flip-nested` en fenêtre compacte (`500×300`) : Seek à `750`,
  `800`, `850`, `1500`, `2200` et `2210 ms` garde `transform: none`, reste
  stable jusqu’à `800 ms`, puis fait évoluer progressivement `y` et la hauteur
  jusqu’à LAST ; Play de `0` à `3000 ms` termine sans erreur. La fenêtre a été
  restaurée à `1280×877` et la route laissée à l’état prêt (`0 ms`).

La validation des variantes autonomes `width`, `container`, des contraintes
`min/max` et des modes d’overflow reste à effectuer avant de passer le plan à
`Fini`.
