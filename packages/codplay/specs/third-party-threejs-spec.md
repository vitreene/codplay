# CodPlay V2 — première unité Three.js

## Statut

> En cours — hôte, caméra, lumières et grille procédurale implémentés ; le
> calcul temporel de la grille, le rejeu de présentation au Seek et l'ordre
> de commit de l'hôte sont couverts par des tests déterministes. Le chemin
> réel de la démo a été exercé dans Safari pour Play, pause, Seek
> arrière/reprise et resize. Le cycle complet de destruction reste à valider.

Cette spécification décrit la première unité Three.js externe. Elle ne change
pas le core en matérialiseur Three.js et ne réutilise pas le runtime V1.

## Composition

`createThreejsIntegration()` crée une unité liée à un engine :

- une définition de bibliothèque `three`, chargée par `engine.prepareScene()` ;
- le composant HTML `three-scene-host`, qui possède le canvas, le renderer, la
  scène et le rendu final ;
- les composants `three-camera`, `three-light` et
  `three-instanced-grid`, qui reçoivent leur cible par `rel` ;
- les validateurs et les types de données de ces composants.

La factory garde la namespace Three.js dans une closure propre à l’intégration.
Le core ne reçoit aucun type Three.js et ne conserve aucun handle natif dans
`CompiledScene`.

## Cible et responsabilités

L’hôte publie une cible opaque contenant la scène et les opérations de rendu.
La caméra et les lumières sont des persos distincts : elles ne sont pas
absorbées par l’hôte. La géométrie est également un perso distinct.

La relation d’une caméra, d’une lumière ou d’une géométrie suit la forme
commune :

```ts
rel: { target: { scene: 'three-grid' } }
```

Le composant consommateur ne recherche pas l’hôte. Le runtime résout `rel` et
livre la cible dans `ComponentUpdateInput.target`.

## Temps et rendu

La grille calcule sa pose depuis le temps absolu reçu par CodPlay. Elle ne
lance ni `requestAnimationFrame`, ni horloge privée. Son `sample(t)` produit
les matrices correspondant à `t` ; le test vérifie qu'une autre valeur de `t`
produit une autre pose et que le même `t` la reproduit.

L’hôte enregistre une animation de présentation persistante en phase
`commit`. Le runtime applique d’abord les animations de contenu, puis cette
phase finale de l’hôte. Le rendu utilise donc la pose que les consommateurs
ont effectivement écrite pour la frame courante, y compris après un Seek.

Le même calcul est donc utilisé par Play et Seek. La grille possède et libère
sa géométrie, son matériau et son `InstancedMesh`. L’hôte possède et libère le
renderer et la scène, mais ne détruit pas les ressources appartenant aux
consommateurs.

La démo utilise un horizon ouvert : elle ne déclare pas de `sequence:end` pour
fabriquer une durée. La télécommande découvre l’horizon au fur et à mesure que
la tête de lecture avance et conserve le plus grand horizon déjà découvert
lorsqu’un Seek revient en arrière. Le transport Safari a été exercé après deux
Seek arrière puis une reprise ; la preuve de la pose ne repose pas sur une
capture visuelle, mais sur le calcul du composant et le test d'ordre du runtime.

## Limites de cette tranche

Les modèles, textures, avatars, mixers natifs et contrôleurs de features ne
sont pas encore inclus. La caméra et les lumières disposent d’un profil simple.
La validation du cycle de destruction et d’un second navigateur doit encore
compléter cette tranche.
