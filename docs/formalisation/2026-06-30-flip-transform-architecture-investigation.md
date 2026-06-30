# Enquete — architecture FLIP et usage de `transform`

## Statut

Enquete terminee, fix structurel a specifier avant implementation.

## Constat

Le runtime FLIP utilise aujourd'hui deux modeles d'animation differents :

1. FLIP local : animation via canaux Anime.js `x`/`y`/`rotate`/`scaleX`/`scaleY`, donc via `transform`.
2. `overlay-world` : clone `position: fixed`, ancre par `left/top`, matrice visuelle portee par `transform: matrix(...)`.

Ce melange explique pourquoi les trajectoires courbes posent une question d'architecture : pour une animation de mouvement, `transform` est le canal correct, mais `overlay-world` a historiquement anime `left/top` parce que ces proprietes representaient la position monde absolue du clone.

## Implementation courante pour `attraction`

Pour ne pas aggraver le probleme :

- `left/top` restent l'ancrage monde initial du clone overlay ;
- si `move.attraction === 0`, le comportement lineaire historique `left/top` est conserve ;
- si `move.attraction !== 0`, la trajectoire courbe est portee par les canaux transform `x`/`y` du clone ;
- Anime.js recoit une valeur de progression `0 -> 1` et un `modifier` qui calcule la coordonnee Bezier.

Cette implementation limite le changement au besoin courbe, mais ne resout pas encore l'incoherence globale du modele.

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
- **delta anime** : `transform` (`x`/`y`) uniquement ;
- **matrice visuelle** : rotation/scale/skew/transform auteur.

Objectif : tout mouvement FLIP doit etre exprime en transform, et `left/top` ne doivent plus etre animes sauf cas explicite d'ancrage/calibration.

## Plan de fix a specifier

1. Ajouter des tests caracterisant l'ordre de composition transform Anime.js avec un node qui a deja `transform: matrix(...)`.
2. Isoler une primitive `buildOverlayClonePose(...)` qui pose l'ancrage initial et la matrice visuelle sans animer `left/top`.
3. Convertir `overlay-world` lineaire (`attraction = 0`) vers `x/y` transform aussi, pas seulement le cas courbe.
4. Conserver une finalisation explicite qui nettoie/remet `x/y` a l'etat attendu avant de retirer les clones.
5. Verifier `seek` : replay partiel, replay apres fin, replay arriere.

## Hors scope de l'implementation courante

Le passage complet d'`overlay-world` lineaire de `left/top` vers `x/y` n'est pas inclus dans le changement `attraction`, car il modifie le comportement historique de tous les moves overlay-world et doit etre valide separement.
