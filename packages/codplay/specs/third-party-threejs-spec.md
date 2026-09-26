# CodPlay V2 — première unité Three.js

## Périmètre vérifié

Cette spécification décrit la première unité Three.js exercée par les tests
d'intégration du package et par la démo V2 `threejs-grid`. L'acceptation
complète de l'intégration est décrite dans le
[plan des composants tiers](../plan/2026-09-18-third-party-components-v2-plan.md).

Cette spécification décrit la première unité Three.js externe. Elle ne change
pas le core en matérialiseur Three.js et ne réutilise pas le runtime V1.

## Composition

Le core Three.js fournit une déclaration d’engine réutilisable :

- une définition de bibliothèque `three`, chargée par `engine.prepareScene()` ;
- le composant HTML `three-scene-host`, qui possède le canvas, le renderer, la
  scène et le rendu final ;
- les composants génériques `three-camera` et `three-light`, qui reçoivent leur
  cible par `rel` ;
- la stratégie `THREE_PRELOAD_STRATEGIES`, qui prépare les ressources binaires
  Three.js avec le `FileLoader` ;
- les validateurs et les types propres à ces composants.

La grille `three-instanced-grid` est une déclaration spécialisée séparée. Elle
peut être ajoutée explicitement à la liste `engine.components.register` de
l'application qui l'emploie, sans faire partie du core Three.js.

Les composants sont des classes directement référencées par leurs définitions.
L'engine prépare Three.js et injecte sa valeur opaque dans leur contexte de
construction ; aucune factory ne fabrique une classe de composant et aucun
handle natif n'entre dans `CompiledScene`.

## Cible et responsabilités

L’hôte publie une cible opaque contenant la scène, la caméra courante et les
opérations de rendu.
La caméra et les lumières sont des persos distincts : elles ne sont pas
absorbées par l’hôte. La géométrie est également un perso distinct.

La relation d’une caméra, d’une lumière ou d’une géométrie suit la forme
commune et désigne le host Three :

```ts
rel: { host: 'three-scene' }
```

Le host est le seul composant Three matérialisé et le seul à recevoir `move`.
Le composant consommateur ne recherche pas l’hôte et ne reçoit pas de montage
DOM. Le runtime résout `rel` et livre la cible opaque dans
`ComponentUpdateInput.target`.

La cible du host expose `getCamera()` en lecture seule. Cette opération permet
à un composant rattaché au host — par exemple une capacité Avatar — de
consommer la caméra sélectionnée par `three-camera`. Elle ne donne pas au
consommateur la responsabilité de créer, remplacer ou rendre la caméra ;
`setCamera()` reste l'opération du composant caméra et le host reste
propriétaire du commit de rendu.

Les composants Three logiques déclarent le profil runtime `attached` dans leur
définition engine. Ils peuvent donc ne pas avoir de `move` tout en restant
disponibles pour le host et les composants qui leur sont rattachés. Le host
conserve le profil `placed` par défaut.

Lorsqu’un composant doit viser un objet ou une capacité publiée dans le host,
il ajoute `target`, par exemple `rel: { host: 'three-scene', target: 'grid' }`.
Cette clé désigne une publication de l’intégration ; elle ne désigne pas un
nœud interne Three que CodPlay devrait découvrir.

## Ressources binaires Three.js

Le module Three.js fournit les stratégies de preload `three-glb` et `three-fbx`.
Elles utilisent le `FileLoader` de Three.js pour charger les octets et relient
le `AbortSignal` du preload à l'abandon du loader. Le résultat reste dans le
cache de l'intégration Three.js, indexé par l'URL ; le core CodPlay ne connaît
ni ces formats, ni `ArrayBuffer`, ni les loaders natifs.

Le composant spécialisé consomme cette ressource préparée. Avatar remet les
octets à `GLTFLoader.parse` afin de construire une scène indépendante par
instance et de conserver la topologie de squelette nécessaire au retargeting.
Pour une animation externe, il remet les octets à `FBXLoader` ou
`GLTFLoader`, puis associe le clip au modèle Avatar déclaré. Il ne fait donc ni
`fetch`, ni cache de modèle ou d'animation, ni second circuit d'import.

Les types `three-glb` et `three-fbx` sont déclarés dans le manifeste de preload
de l'application ou du module qui utilise Three.js. Le builder générique ne
déduit pas un type Three.js à partir d'une extension et ne crée ainsi pas de
dépendance implicite envers une intégration externe.

## Temps et rendu

La grille calcule sa pose depuis le temps absolu reçu par CodPlay. Elle ne
lance ni `requestAnimationFrame`, ni horloge privée. Son `sample(t)` produit
les matrices correspondant à `t` ; le test vérifie qu'une autre valeur de `t`
produit une autre pose et que le même `t` la reproduit.

L’hôte enregistre une animation de présentation persistante en phase
`commit`. Le runtime applique d’abord les animations de contenu, puis cette
phase finale de l’hôte. Le rendu utilise donc la pose que les consommateurs
ont effectivement écrite pour la frame courante, y compris après un Seek.

Le même calcul est donc utilisé par Play et Seek. La grille possède sa
géométrie, son matériau et son `InstancedMesh`. L’hôte possède le renderer et
la scène, tandis que les ressources des consommateurs restent sous leur
responsabilité.

## États pilotés par les actions

La caméra accepte les mises à jour d’état de `position` et `lookAt`. Une lumière
accepte notamment `position`, `color` et `intensity`. Une mise à jour de ces
champs est appliquée à l’objet Three.js déjà possédé par le composant ; elle ne
recrée pas l’objet tant que son `kind` ne change pas.

Ces composants ne fabriquent pas chacun un flux d’animation concurrent. Une
action discrète produit un nouvel état, tandis qu’un `TweenAction` auteur
retourne un patch d’état à chaque temps logique. Le runtime résout alors le
patch, rappelle `update()` avec la nouvelle position ou couleur, puis l’hôte
effectue le rendu dans son commit final. La démo `threejs-grid` vérifie ce
parcours avec un recul puis une avancée de caméra sur une durée distincte des
rotations de la grille, le déplacement d’une lumière ponctuelle et la variation
des couleurs ambiante et ponctuelle.

## Limites de cette tranche

Les composants génériques ne décrivent pas les modèles, textures, avatars,
mixers natifs ou contrôleurs de features. Le preload binaire appartient à
l'intégration Three.js ; Avatar porte ensuite sa logique spécialisée. La caméra
et les lumières disposent d’un profil simple.
