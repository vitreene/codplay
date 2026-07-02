# Enquete — architecture FLIP et usage de `transform`

## Statut

Premiere phase implementee : le deplacement `overlay-world` est porte par la propriete transform individuelle `translate`.
Les autres points de consolidation restent a specifier avant implementation.

## Constat

Le runtime FLIP utilise aujourd'hui deux modeles d'animation differents :

1. FLIP local : animation via canaux Anime.js `x`/`y`/`rotate`/`scaleX`/`scaleY`, donc via `transform`.
2. `overlay-world` : clone `position: fixed`, ancre par `left/top`, matrice visuelle portee par `transform: matrix(...)`.

Ce melange explique pourquoi les trajectoires courbes posent une question d'architecture : pour une animation de mouvement, `transform` est le canal correct, mais `overlay-world` a historiquement anime `left/top` parce que ces proprietes representaient la position monde absolue du clone.

## Implementation courante

Pour reduire le melange de modeles :

- `left/top` restent l'ancrage monde initial du clone overlay ;
- le deplacement lineaire est porte par `translate` sur le clone ;
- si `move.attraction !== 0`, Anime.js recoit une valeur de progression `0 -> 1` et un `modifier` qui calcule la coordonnee Bezier.
- `translate` est prefere aux canaux Anime.js `x`/`y` parce que le clone possede deja un `transform: matrix(...)` pour sa matrice visuelle ; `x`/`y` peuvent entrer en concurrence avec cette matrice selon la composition Anime.js.

Cette implementation resout le canal de mouvement `overlay-world`, mais ne resout pas encore toute l'incoherence globale du modele transform.

## Risques identifies

- Le clone overlay a deja un `transform: matrix(...)` pour restituer rotation/scale monde. Ajouter `x`/`y` via Anime.js compose sur ce transform ; il faut verifier precisement l'ordre de composition Anime.js/CSS.
- `readElementTransformValue(...)` lit le transform calcule, mais `utils.get(node, 'x')` lit les canaux Anime.js. Les deux sources peuvent diverger quand un element a a la fois un transform CSS auteur et des canaux Anime.js.
- `captureCombinedMatrixForNode(...)` ignore les translations layout (`offsetLeft`, flow layout) et s'appuie sur `getBoundingClientRect` pour la position. C'est acceptable pour certains calculs, mais fragile pour un modele transform-first complet.
- `overlay-world` calibre des ghosts en modifiant `left/top/width/height`; si le mouvement devient transform-first partout, cette calibration doit distinguer ancrage fixe et delta anime.
- La finalisation/seek doit toujours poser explicitement l'etat final, car un seek a mi-transition peut laisser des canaux `x`/`y` residuels si la finalisation depend uniquement du moteur externe.

## Direction recommandee

Creer un modele explicite de pose visuelle pour FLIP :

```ts
type VisualPose = {
  anchorLeft: number
  anchorTop: number
  width: number
  height: number
  matrix: Matrix2D
  translateX: number
  translateY: number
}
```

Puis separer :

- **ancrage** : position fixe/layout servant a placer le clone ou le node ;
- **delta anime** : transform individuel (`translate`) ou canaux transform normalises, sans remplacer la matrice visuelle ;
- **matrice visuelle** : rotation/scale/skew/transform auteur.

Objectif : tout mouvement FLIP doit etre exprime en transform, et `left/top` ne doivent plus etre animes sauf cas explicite d'ancrage/calibration.

## Plan de fix a specifier

1. Ajouter des tests caracterisant l'ordre de composition transform Anime.js avec un node qui a deja `transform: matrix(...)`.
2. Isoler une primitive `buildOverlayClonePose(...)` qui pose l'ancrage initial et la matrice visuelle sans animer `left/top`.
3. Verifier et consolider la composition entre matrice visuelle (`transform: matrix(...)`) et canaux Anime.js `x/y`.
4. Conserver une finalisation explicite qui nettoie/remet `x/y` a l'etat attendu avant de retirer les clones.
5. Verifier `seek` : replay partiel, replay apres fin, replay arriere.

## Reste hors scope de l'implementation courante

La refonte complete du modele `VisualPose` et la consolidation des matrices transform FLIP locales restent a traiter separement.
