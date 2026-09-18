# Three.js : propriété, animation et cible résolue

Note de réflexion corrigée le 2026-09-18.

> Statut : **orientation retenue, API à spécifier**.
>
> Cette note applique à Three.js le modèle de
> [projection tierce hébergée](./2026-07-29-projection-substrat-de-rendu.md).
> Elle ne propose plus un matérialiseur Three.js sélectionnable pour toute
> l'instance.

## 1. Ce que l'adaptateur Three.js d'Anime.js apprend

L'adaptateur Three.js d'Anime.js traduit un vocabulaire d'animation vers des
écritures natives : une rotation auteur devient une rotation Three.js, une
couleur devient un `THREE.Color`, une propriété d'instance est mise en lot avant
le rendu.

Cette idée est utile à CodPlay : un composant peut exposer un sous-ensemble
strict de propriétés de la bibliothèque et les convertir à la frontière de
matérialisation.

Ce qui n'est pas repris :

- une timeline Anime.js autonome ;
- la lecture d'une valeur Three.js comme source de vérité logique ;
- des chemins de propriété arbitraires ;
- la recherche magique de `mesh.material` ;
- un appel à `renderer.render()` depuis chaque composant.

CodPlay calcule l'état à `t`. L'intégration Three.js réalise cet état.

```text
events et temps CodPlay
  -> état résolu du perso
  -> composant Three.js spécialisé
  -> objet natif déjà ciblé
  -> commit unique du perso hôte
```

## 2. Possession des objets

Le perso hôte possède le canvas, le renderer, la scène et le matérialiseur
Three.js local. Chaque composant spécialisé possède uniquement les objets ou
ressources qu'il crée dans cette scène.

Exemples :

- le composant caméra possède sa caméra ;
- le composant lumière possède sa lumière ;
- le composant géométrie possède son mesh et, selon le profil retenu, sa
  géométrie et son matériau ;
- le composant avatar possède son modèle mutable ;
- le composant lipsync ne possède ni scène ni avatar : il contribue aux canaux
  publiés par l'avatar ciblé.

Le pont conserve l'association entre l'identité du perso et son handle natif.
Cette association n'est ni globale, ni recréée par chaque composant.

## 3. Liaison et hiérarchie Three.js

L'auteur de scène place l'hôte HTML avec `move`, puis relie les composants
spécialisés à leur fournisseur avec `rel`. Cette relation est déclarée dans
`initial` et reste immuable. `target.scene` désigne la scène ;
`target.perso` désigne éventuellement un perso de cette scène. L'intégration
peut typer des champs supplémentaires lorsque sa bibliothèque l'exige.

```ts
const threeScene = {
  id: 'three-scene',
  type: 'three-scene-host',
  initial: {
    move: '@root',
    style: { width: '100%', height: '100%' },
  },
}

const geometry = {
  id: 'grid',
  type: 'three-instanced-grid',
  initial: {
    rel: { target: { scene: 'three-scene' } },
    columns: 15,
    rows: 9,
    spacing: 0.12,
  },
}

const avatar = {
  id: 'guide',
  type: 'three-avatar',
  initial: {
    rel: { target: { scene: 'three-scene' } },
    src: '/assets/guide.glb',
  },
}

const lipsync = {
  id: 'guide-lipsync',
  type: 'avatar-lipsync',
  initial: {
    rel: { target: { scene: 'three-scene', perso: 'guide' } },
  },
}
```

Une action ne modifie pas `rel`. Les définitions TypeScript des intégrations
précisent les éventuels champs supplémentaires.

Si une relation est inconnue, incompatible ou cyclique, le composant reste
sans cible et sa contribution est sans effet. Cela ne bloque ni la construction
ni la lecture de la scène : l'auteur reçoit un warning, tandis que la diffusion
reste silencieuse. Une cible valide mais non montée est simplement attendue et
ne produit pas de warning.

Le host applique `style` à son élément HTML. Les autres composants ne voient
pas `style` et ne traitent directement ni la liaison ni `move`. Le runtime leur
fournit respectivement la scène Three.js ou la cible d'avatar résolue.

## 4. Réconciliation et rendu

Pour une frame à `t`, le pont doit :

1. parcourir le graphe résolu parent avant enfant ;
2. monter l'hôte HTML et préparer son contexte si nécessaire ;
3. créer ou retrouver chaque handle natif sous le parent résolu ;
4. appliquer les états des composants spécialisés ;
5. composer les contributions de contrôleurs visant un même objet ;
6. flusher les écritures groupées, notamment les matrices d'instances ;
7. rendre chaque scène Three.js une seule fois.

Le même ordre s'applique à Play, Seek, reset et resize. Three.js ne lance pas de
RAF et n'accumule pas un delta privé.

## 5. Vocabulaire strict

Les composants Three.js ne connaissent pas une action générique `move` au sens
d'une propriété native. Ils acceptent uniquement les propriétés déclarées par
leur profil.

Exemples possibles :

| Composant | Propriétés de feature possibles |
| --- | --- |
| caméra | `position`, `rotation`, `fov`, `near`, `far`, `active` |
| lumière | `position`, `color`, `intensity` |
| objet | `position`, `rotation`, `scale`, `visible` |
| matériau | `color`, `opacity`, `roughness`, `metalness` |
| avatar | animation globale, regard ou paramètres explicitement retenus |
| lipsync | visèmes ou données phonétiques |

Les relations de placement et de liaison restent orthogonales au vocabulaire
Three.js : CodPlay les a consommées avant l'appel du composant.

## 6. ACE et moteurs natifs

ACE convient aux valeurs que CodPlay peut résoudre directement : position,
rotation, échelle, couleur, intensité ou autres scalaires déclarés.

Le moteur Three.js peut rester nécessaire pour un clip squelettique, un mixer,
des morphs ou une synchronisation labiale. Dans ce cas, l'intégration doit poser
son état depuis le temps CodPlay et les occurrences actives. Elle ne peut pas
dépendre du nombre de frames déjà jouées.

L'égalité visée reste :

```text
état observé après play(t) = état observé après seek(t)
```

pour toute action déclarée comme reconstructible.

## 7. Ressources et bibliothèque

Three.js est déclaré et chargé par l'engine avec son unité d'intégration. Les
modèles, textures et environnements de la scène passent par le preload de
ressources et sont disponibles avant la création des objets qui les emploient.

Le composant ne lance pas un import dynamique ou un chargement réseau dans sa
méthode de mise à jour. Il reçoit les dépendances préparées par l'intégration.

## 8. Première preuve : grille de pavés

La première preuve reprend le résultat de
`packages/demos/src/v1/scenes/threejs-anime-grid-scene.ts`, sans reprendre son
API `build`/`simulate` comme contrat.

- `three-scene-host` crée l'environnement ;
- `three-instanced-grid` crée la grille dans la cible résolue ;
- les dimensions, l'espacement et la loi de décalage deviennent des données
  validées ;
- les actions produisent les poses à partir du temps absolu ;
- l'hôte rend après la mise à jour de la grille ;
- Seek, retour, reset et destruction ne dupliquent aucun objet.

Cette verticale doit prouver le pont générique avant le travail avatar.

## 9. Étape suivante : avatar composable

La hiérarchie de référence est :

```text
three-scene-host
  -> avatar
       -> lipsync
       -> expression
       -> gesture
```

Chaque contrôleur reçoit ses propres events et matérialise une responsabilité.
L'avatar publie les canaux nécessaires et compose les contributions avant le
rendu. Une animation absente peut rester sans effet et produire un warning
dans le contexte auteur si Three.js ou TalkingHead permet de la détecter
proprement ; ce cas reste silencieux en diffusion.

`lipsync`, `expression` et `gesture` sont maintenus provisoirement comme persos :
ils portent des données, des actions et un état temporel, mais leur composant
contribue à un avatar au lieu de créer une représentation autonome. Le premier
chantier devra vérifier si cette différence reste une simple variante de
matérialisation ou fait apparaître une primitive distincte.

TalkingHead reste la référence fonctionnelle. Le composant V1 constitue un
retour d'expérience, pas une structure normative à recopier.
