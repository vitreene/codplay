# Options FLIP sur `move`

## Statut

- `duration` + `easing`/`ease` : implemente.
- trajectoire courbe par attraction/repulsion : implemente pour `overlay-world`.

## Objectif

Permettre aux moves animes par FLIP (`local` et `overlay-world`) de porter leurs parametres visuels au meme endroit que le changement de parent, sans passer par une action `style` separee.

## Timing FLIP implemente

Contrat auteur :

```ts
move: {
  parentId: 'target-list',
  flipMode: 'overlay-world',
  duration: 740,
  easing: 'easeInOutQuad'
}
```

Aliases supportes :

- `easing`
- `ease`

Regles :

- `duration` est un nombre en millisecondes, non negatif.
- Si `duration` est absent, le moteur garde la duree FLIP par defaut.
- Si `easing`/`ease` est absent, le moteur garde l'easing FLIP par defaut.
- `move.flip === false` desactive toujours le FLIP, donc la duree du move ne contribue pas a l'horizon de l'event.
- La duree d'un `move` contribue a la duree resolue de l'event, comme une transition `style.duration`.

## Trajectoire courbe — proposition

Besoin auteur : rendre le deplacement moins rectiligne. La trajectoire parait attiree ou repoussee par le centre de la scene.

Contrat auteur :

```ts
move: {
  parentId: 'target-list',
  flipMode: 'overlay-world',
  duration: 740,
  easing: 'easeInOutQuad',
  attraction: 45
}
```

Semantique :

- `attraction` est optionnel et vaut `0` par defaut.
- `attraction` est un entier auteur clampé dans `[-100, 100]`.
- `attraction = 0` : trajectoire lineaire, sans modifier de trajectoire.
- `attraction > 0` : la courbe est attiree vers le centre du contexte runtime.
- `attraction < 0` : la courbe est repoussee du centre du contexte runtime.
- `attraction = 100` : le point de controle de la courbe est le centre du contexte runtime.
- `attraction = -100` : le point de controle est symetriquement repousse depuis le centre runtime par rapport au midpoint.

Modele geometrique propose : courbe quadratique de Bezier.

Soit :

- `P0` : position monde de depart du perso deplace ;
- `P1` : position monde d'arrivee ;
- `M = midpoint(P0, P1)` ;
- `C` : centre du contexte runtime ;
- `A` : `move.attraction / 100`.

Point de controle :

```ts
control = M + A * (C - M)
```

Position a la progression `t` :

```ts
position(t) = (1 - t)^2 * P0 + 2 * (1 - t) * t * control + t^2 * P1
```

Implementation :

- Le clone overlay reste ancre en `position: fixed` via `left/top` au point de depart.
- Le deplacement, lineaire ou courbe, est anime via la propriete transform individuelle `translate`.
- Avec `attraction = 0`, `translate` va directement de `0px 0px` au delta final.
- Avec `attraction !== 0`, `translate` utilise un `modifier` Anime.js qui calcule la coordonnee Bezier ; `left/top` ne servent plus qu'a l'ancrage initial.
- `translate` est utilise plutot que les canaux Anime.js `x`/`y` pour ne pas remplacer le `transform: matrix(...)` qui porte deja la matrice visuelle du clone.
- Le centre utilise est le centre du contexte runtime resolu depuis le node deplace, avec fallback viewport si le contexte n'est pas mesurable.

## Contraintes d'architecture

- Le module `list-flip` ne doit pas connaitre les demos ni les composants applicatifs.
- La resolution du contexte runtime doit rester generique : node player/contexte DOM mesurable, pas id de scene code en dur.
- Le chemin `overlay-world` doit rester seek-safe : au replay de seek, seul l'overlay du perso deplace peut etre reconstruit ; les voisins de liste ne doivent pas recevoir de transform residuel.

## Validation automatisee actuelle

- `tests/v1/overlay-world-seek-baseline.spec.ts` verifie que `duration` et `easing` d'un move `overlay-world` sont transmis aux transitions produites.
- Le meme fichier verifie qu'une trajectoire avec `attraction` produit une transition transform `translate` avec modifier.
