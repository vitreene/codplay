# Anime.js, Three.js et une story de cible de rendu

Note de réflexion (2026-07-30). Elle examine l'adaptateur Three.js d'Anime.js et
en tire un principe pour codplay. Elle ne prescrit aucune API ni aucun chantier.

> **Statut.** Non normatif. Le sujet du substrat canvas reste une extension
> v2.5/v3, après validation de la V2. Le mot « Projection » est réservé au haut
> niveau dans le corpus : les noms `threejs-projection` employés dans l'exemple
> sont des noms de rôle provisoires, pas une proposition de vocabulaire public.

## 1. Le mécanisme d'Anime.js

L'adaptateur Three.js d'Anime.js (depuis 4.5) est chargé par un import à effet de
bord :

```ts
import 'animejs/adapters/three'
```

Il enregistre un adaptateur global dont le moteur Anime se sert lorsqu'il reçoit
une cible. L'adaptateur ne construit pas une scène et ne rend pas une image. Son
seul rôle est de traduire un nom de propriété exposé à l'auteur en une lecture et
une écriture sur l'objet Three.js réel.

```text
animate(mesh, { rotateY: 60, opacity: 0.5 })
             │
             ▼
  resolveAdapterEntry(mesh, 'rotateY')
             │
             ▼
  get: mesh.rotation.y (radians -> degrés)
  set: mesh.rotation.y (degrés -> radians)
```

Il procède en trois étages :

1. **Détection de cible.** Un garde léger reconnaît les objets Three.js par leurs
   marqueurs (`isObject3D`, `isMaterial`, `isTexture`, `isColor`, `isVector*`,
   etc.), sans importer de type applicatif.
2. **Mappings statiques par classe.** `Object3D` reçoit par exemple `x/y/z`,
   `rotateX/Y/Z`, `scale`, `opacity`, `color`, `visible`; les caméras et lumières
   reçoivent leurs propriétés propres.
3. **Résolveurs dynamiques.** Lorsque le mapping n'est pas statique, Anime peut
   reconnaître à l'exécution une couleur, un axe de vecteur, un uniforme GLSL ou
   un slot TSL. Pour un mesh, il essaie aussi `mesh.material` si le mesh ne porte
   pas lui-même la propriété.

Le moteur Anime utilise ensuite ces getters/setters pour lire une valeur initiale,
interpoler à chaque frame, puis écrire le résultat. Par exemple :

```ts
animate(mesh, {
  x: 100,           // mesh.position.x
  rotateY: 60,      // mesh.rotation.y, API auteur en degrés
  opacity: 0.5,     // mesh.material.opacity
  uTint: '#0080ff', // mesh.material.uniforms.uTint.value
})
```

L'adaptateur prend aussi en charge les instances de `InstancedMesh` et
`BatchedMesh`. Il donne un proxy par instance, accumule les matrices modifiées,
puis les écrit en lot juste avant le rendu. C'est une optimisation de projection
utile, pas un mécanisme temporel.

### Ce qu'il ne fait pas

- Il ne monte ni ne démonte d'objets dans une scène.
- Il ne possède ni le renderer, ni le canvas, ni la caméra.
- Il n'appelle pas `renderer.render(scene, camera)` : l'application le fait dans
  son propre callback de frame.
- Il ne définit pas de système de coordonnées, de mesure ou de hit-testing.
- Il ne règle pas les conflits de propriété entre auteurs ou composants.
- Il ne garantit pas qu'un état soit reconstructible à un instant donné : son
  modèle usuel part d'une valeur native courante et la fait évoluer.

Sources : [documentation Three.js](https://animejs.com/documentation/adapters/threejs-adapter),
[registre d'adaptateurs](https://github.com/juliangarnier/anime/blob/master/src/adapters/registry.js),
[résolveurs Three.js](https://github.com/juliangarnier/anime/blob/master/src/adapters/three/resolvers.js),
[instances](https://github.com/juliangarnier/anime/blob/master/src/adapters/three/instance.js).

## 2. Ce qui est transférable à codplay

Le transfert pertinent n'est pas « employer Anime pour animer Three.js ». C'est
le patron suivant : **un vocabulaire déclaré est converti, à la frontière du
substrat, en écritures natives ciblées**.

Dans codplay, le sens doit être inversé par rapport à Anime :

```text
temps et événements
       │
       ▼
solve(scene, t)
       │
       ▼
PersoState @ t, en unités d'auteur
       │
       ▼
project vers les handles Three.js
       │
       ▼
flush de la cible, puis un render partagé
```

`PersoState @ t` est la vérité. Three.js est la réalisation mutable de cette
vérité. La cible ne lit donc jamais `mesh.position` pour décider de la prochaine
pose ou pour reconstruire un seek; elle reçoit et écrit la pose résolue. Une
lecture native ne reste justifiée que pour une capacité de mesure, donnée
jetable et re-dérivable, jamais pour relire une intention d'auteur.

Le sous-ensemble à reprendre est :

- une table de mappings explicites entre propriétés auteur et propriétés natives;
- des codecs locaux au substrat : degrés vers radians, couleur auteur vers
  `THREE.Color`, coordonnées de l'hôte vers espace Three.js;
- un handle opaque par objet réalisé;
- un batching spécifique aux instances, flushé avant l'unique rendu de la cible;
- une passe de rendu unique, partagée par tous les persos utilisant la même
  surface.

Le sous-ensemble à ne pas reprendre est :

- les getters natifs comme source de la valeur de départ;
- l'introspection générale des propriétés et les chemins magiques vers
  `mesh.material`;
- les timelines Anime et leur horloge;
- un `renderer.render()` depuis chaque composant;
- les raccourcis qui cachent une propriété partagée, en particulier
  `mesh.opacity -> material.opacity`.

La réflexion permissive d'Anime est nécessaire à une bibliothèque qui accepte
n'importe quel objet muté par du code tiers. Codplay peut être plus strict : un
composant sait le type de handle qu'il projette et le vocabulaire qu'il autorise.

## 3. Deux intégrations distinctes

La même bibliothèque Three.js recouvre deux modèles qui ne doivent pas être
fusionnés.

| Modèle | Possession de l'arbre Three.js | Usage |
| --- | --- | --- |
| Média / composant hôte | Le composant Three.js construit et possède sa scène interne. Codplay ne connaît que le perso hôte. | Usage direct actuel : avatar, grille, effet autonome. |
| Cible de rendu | Codplay possède l'arbre logique; la cible réalise les persos en `Object3D`, matériau, caméra, lumière, etc. | Usage différé : contenu Three.js adressable par plusieurs persos. |

Le prototype `threejs` actuel relève du premier modèle : `build()` construit une
scène libre, `refs` expose des objets internes et `simulate()` les modifie. La
démo `threejs-anime-grid` calcule déjà une pose à partir du temps absolu, mais
reste une scène interne d'un seul composant.

Une cible de rendu ne s'obtient donc pas en ouvrant progressivement `build`,
`refs` et `simulate` à d'autres persos. Il faut un second contrat : le montage,
la destruction et la projection des objets relèvent de la cible partagée, pas de
fonctions arbitraires enfermées dans un perso.

## 4. Capacités minimales d'une cible Three.js

La forme reste à concevoir lorsque le besoin V3 existera. Le rôle minimal se lit
néanmoins ainsi :

```ts
type ThreejsRenderTarget<Handle, State> = {
  mount(parent: Handle | null, description: unknown): Handle
  unmount(handle: Handle): void
  project(handle: Handle, state: State): void
  measure?(handle: Handle): Rect
  render(): void
}
```

Cette forme est intentionnelle, non une signature à adopter :

- `mount` traduit la structure des persos vers le graphe Three.js;
- `project` reçoit une pose complète et résolue, sans durée ni progression;
- `measure` peut fournir une bounding box ou une géométrie de hit-testing, sans
  remonter une description d'auteur;
- `render` n'est appelé qu'après la projection de tous les handles de la cible;
- la cible possède le cycle de vie GPU et dispose chaque ressource une seule fois.

La cible peut aussi intégrer les **définitions statiques** qu'elle réalise :
géométries, matériaux, textures, shaders, sources GLB et sous-arbres immuables.
Elles sont préparées une fois au montage de la cible et peuvent être référencées
par plusieurs persos. Les persos restent responsables de leurs états variables :
transformation, visibilité, intensité de lumière, sélection d'une pose, ou toute
autre valeur qui dépend de `t`.

Les matériaux, géométries et textures sont des ressources à identité propre. Une
spécification future devra donc dire quand une ressource est partagée, clonée ou
possédée par un seul perso. Sans cela, le raccourci `opacity` peut modifier
silencieusement plusieurs figures partageant le même matériau.

## 5. Story illustrative : surface, caméra et cube

L'exemple ci-dessous montre la **forme sémantique** attendue d'une story où trois
persos s'adressent à la même cible Three.js : une surface, une caméra et un cube.

Ce n'est pas du TypeScript exécutable et ce n'est pas une proposition de syntaxe
V2. En particulier, la forme des trajectoires et des actions est encore un point
bloquant du noyau `solve`; les clés `to` et `transition` ci-dessous servent
uniquement à rendre l'intention lisible. Les noms de type sont provisoires.

```ts
const cubeStory = {
  id: 'threejs-cube-story',
  initial: { move: '@root' },
  persos: [
    {
      id: 'three-stage',
      type: 'threejs-projection', // Nom de rôle provisoire : la cible canvas.
      initial: {
        move: '@root',
        surface: {
          width: 960,
          height: 540,
          pixelRatio: 'device',
          background: '#101827',
        },
        // Ressources définies une fois, immuables pendant cette story.
        definitions: {
          geometries: {
            heroCube: { kind: 'box', width: 1, height: 1, depth: 1 },
          },
          materials: {
            heroBlue: { kind: 'standard', color: '#38bdf8', roughness: 0.3, metalness: 0.1 },
          },
          assets: {
            // Exemple d'une ressource possible pour une autre figure statique.
            environment: { kind: 'glb', src: '/assets/studio.glb' },
          },
        },
      },
      actions: {},
    },
    {
      id: 'main-camera',
      type: 'threejs-perspective-camera',
      initial: {
        // `move` exprime l'appartenance au graphe de la cible, comme pour un layout.
        move: { parentId: 'three-stage' },
        fov: 45,
        near: 0.1,
        far: 100,
        position: { x: 0, y: 1.5, z: 7 },
        lookAt: { x: 0, y: 0, z: 0 },
        active: true,
      },
      actions: {
        'camera:approach': {
          to: { position: { z: 4.5 } },
          transition: { duration: 1200, ease: 'inOutQuad' },
        },
      },
    },
    {
      id: 'hero-cube',
      type: 'threejs-cube',
      initial: {
        move: { parentId: 'three-stage' },
        geometry: { ref: 'three-stage/geometries/heroCube' },
        material: { ref: 'three-stage/materials/heroBlue' },
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }, // Degrés dans le vocabulaire auteur.
        scale: { x: 1, y: 1, z: 1 },
      },
      actions: {
        'cube:enter': {
          to: {
            position: { y: 0 },
            rotation: { y: 360 },
            scale: { x: 1, y: 1, z: 1 },
          },
          from: {
            position: { y: -2 },
            rotation: { y: 0 },
            scale: { x: 0.2, y: 0.2, z: 0.2 },
          },
          transition: { duration: 900, ease: 'outBack' },
        },
      },
    },
  ],
  eventimes: [
    { name: 'cube:enter', startAt: 0 },
    { name: 'camera:approach', startAt: 600 },
  ],
}
```

La story ne contient ni `THREE.Scene`, ni `WebGLRenderer`, ni `Object3D`, ni
callback `simulate`. Elle ne décrit que des persos, leur parenté et leur état
animable. À l'exécution, la cible réaliserait par exemple :

```text
three-stage  -> WebGLRenderer + Scene + canvas + registre de ressources statiques
main-camera  -> PerspectiveCamera ajouté à Scene
hero-cube    -> Mesh qui référence la géométrie et le matériau de three-stage
```

À un instant `t`, le moteur produit les deux états résolus de la caméra et du
cube. La cible applique leurs codecs : `rotation.y: 180` devient `Math.PI` dans
Three.js; puis elle rend une seule image de la scène. Les définitions de la cible
ne sont ni recalculées ni animées. Un seek à `t` calcule et projette directement
les mêmes états, sans rejouer `cube:enter` ni dépendre de la pose actuelle du
mesh.

## 6. Questions à résoudre avant toute API

1. **Grain de la cible.** Une surface est-elle toujours exclusive à une story,
   ou plusieurs stories peuvent-elles y monter leurs persos ? Le partage impose
   des règles d'ordre, de mesure et de destruction.
2. **Vocabulaire auteur.** Les composants déclarent-ils des propriétés strictes
   (`position`, `rotation`, `material.color`) ou un adaptateur générique
   accepte-t-il un dictionnaire de propriétés ? La première option est cohérente avec le
   contrat strict V2.
3. **Coordonnées et unités.** Comment une boîte DOM qui héberge la surface se
   convertit-elle en viewport, caméra et unités Three.js ? Cette frontière doit
   rester dans la cible, jamais dans `solve`.
4. **Ressources.** Géométrie, matériau, texture et shader sont-ils des détails
   de composant, des persos, ou des ressources de cible partageables ?
5. **Interactions et accessibilité.** Le hit-testing et l'éventuelle couche DOM
   accessible sont des capacités propres à cette cible; elles ne doivent pas être
   supposées par le coeur.

## Synthèse

Anime.js valide qu'une même API d'animation peut adresser des objets Three.js au
moyen de petits codecs de propriétés. Pour codplay, cette idée s'arrête à la
frontière d'écriture : le moteur calcule l'état, la cible le projette et le player
ordonne le rendu. Les deux modèles Three.js - composant média immédiat et cible
de rendu différée - doivent rester explicitement séparés.
