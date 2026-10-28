# Saut à l’extrémité d’un path avec bordure

**Date :** 2026-10-28  
**Statut :** correction CodPlay autorisée et commitée séparément (`df51bda4`) ; saut supprimé dans Safari et confirmé par l’utilisateur. Le raccord CS applique désormais les insets dans la matrice affine. La précision physique de bordure reste suivie dans P6.

## Observation Safari

Sur la scène Editor persistée, au même temps auteur `4,9 s` :

- pendant Play, l’item est rendu par une matrice CSS et son rectangle commence à
  `x=485,05 px` ;
- après Seek à `4,9 s`, l’item utilise la pose CSS auteur et son rectangle
  commence à `x=508,55 px` ;
- le rectangle du lecteur reste identique (`x=221 px`, `826 × 464,625 px`) et la
  région de scène ne bouge pas.

À la fin du Play, le dernier échantillon matriciel commence à `x=486,16 px`.
L’échantillon suivant, toujours à `5,0 s`, repasse à la transformation auteur et
commence à `x=510,53 px`, soit `24,37 px` plus à droite. Le bouton revient à
Play au même échantillon. La région et le lecteur restent fixes.

À l’arrivée, la largeur/hauteur CSS de contenu sont `330,58 × 209,50 px`, la
bordure vaut `18,5 px` de chaque côté et la rotation `41°`. Le défaut de borne
gauche lié aux deux bordures verticales vaut `37 × sin(41°) ≈ 24,3 px`, ce qui
correspond au saut observé.

Le seek statique atteint la pose auteur correcte. Le décalage existe dans la
présentation animée avant la fin ; le retour à la représentation `source` le
rend visible.

## Preuve directe par capture et réapplication

Dans la page Editor à la pose finale, les fonctions réelles `captureHtmlPose()`
et `deriveRelativeMotionPose()` ont été importées depuis les modules Vite de
CodPlay. La matrice capturée a été appliquée au même item avec une origine CSS
`0 0`, puis son style initial a été restauré dans la même tâche JavaScript,
avant le rendu suivant. Le document et les sources CodPlay n’ont pas changé.

| État | Rectangle x | Rectangle y |
| --- | --- | --- |
| CSS auteur final | `510,530273 px` | `110,294235 px` |
| Matrice issue de la capture actuelle | `486,256104 px` | `110,294235 px` |
| Même matrice avec bornes de bordure pour reconstruire l’origine | `510,530273 px` | `110,294235 px` |

La capture seule reproduit donc un écart de `-24,274170 px` ; sa correction
géométrique donne `0 px` sur les deux axes. La largeur et la hauteur rendues
restent identiques, à la précision de la matrice CSS. Les dimensions CSS valent
`330,578125 × 209,5 px` en `content-box`, contre
`367,578125 × 246,5 px` pour la boîte de bordure. Les `24,37 px` relevés pendant
Play comprennent aussi le petit déplacement restant avant l’extrémité exacte.

L’origine auteur est déjà centrée (`183,789063px 123,25px`). L’expliciter en
`center center` conserve exactement le rectangle auteur. La matrice runtime
est exprimée pour une origine `0 0` ; réutiliser cette même matrice avec
`center center` déplace le rectangle à `x=612,187378 px`,
`y=19,975386 px`. Convertir aussi sa translation pour cette nouvelle origine
retrouve la pose capturée décalée d’environ `24,27 px`. Changer la convention
d’origine ne corrige donc pas la mesure de boîte ; le style initial a été
restauré dans la même tâche JavaScript après ces comparaisons.

## Reproduction indépendante du circuit Editor

Un `div` temporaire a été créé dans Safari avec des styles explicites :
`width:200px; height:120px; transform:translate(300px,100px) rotate(40deg)`
et une origine centrée. Son host fixe est neutre, les deux éléments ont leurs
styles réinitialisés et sont invisibles. Les fonctions réelles CodPlay
`captureHtmlPose()` et `resolveLocalPresentationMatrix()` capturent puis
réappliquent sa transformation avec une origine `0 0`. Aucun modèle, builder,
transport, CS ou ghost Editor n’est utilisé. La fixture a été retirée ensuite.

| Bordure par côté | Rotation | box-sizing | Écart x après réapplication |
| --- | --- | --- | --- |
| `0 px` | `40°` | `content-box` | `0 px` |
| `10 px` | `40°` | `content-box` | `-12,855774 px` |
| `20 px` | `40°` | `content-box` | `-25,711517 px` |
| `10 px` | `0°` | `content-box` | `0 px` |
| `10 px` | `40°` | `border-box` | `0 px` |

Calculer les bornes extérieures pour reconstruire l’origine ramène les écarts
x/y à `0 px` dans les cinq cas. Cela isole le défaut dans la capture et la
réapplication CodPlay, indépendamment de la scène produite par Editor. Les
spécifications CodPlay consultées n’imposent pas `box-sizing:border-box` aux
éléments auteur. L’acceptation du correctif complet dans les parcours motion
reste à effectuer après autorisation.

## Circuit Editor observé

- `sequence-editor/mount.ts` demande l’auto-pause dès que la progression atteint
  `scene.meta.durationMs`. La requête passe par
  `EditorCoordinationBridge.requestPause()` vers
  `EditorPlayerCommandFacade.execute({ type: 'pause' })` et `telco.pause()`.
  À exactement `5 000 ms`, le clamp ne demande pas de seek supplémentaire ; le
  handoff `finishPause()` ferme l’état `playing` et réactive les overlays.
- Indépendamment de cette demande, `resolveMotionItem()` retourne la
  représentation `source` lorsque la progression du segment atteint `1`.
  `HtmlMotionPresentationHost.commit()` cesse alors de classer l’item comme
  `local`; `LocalMotionPresenter.removeInactive()` efface le transform
  transitoire et le style CSS auteur reprend. Le saut apparaît à ce bord de
  représentation, lorsque le ghost revient.
- `builder-v2/build-scene.ts` construit le diff complet de pose et émet, dans la
  même action, `style.interpolated` ainsi que `move.transition.path` lorsqu’un
  path est présent. Avec des translations numériques aux deux keyframes, le
  style contient aussi `x` et `y`.
- La scène observée a bien des translations numériques et un `Decor.path` sur
  le KF cible. Le test de builder vérifie la présence de `style` sur l’action
  avec path, mais ne vérifie pas une lecture Play au même temps qu’un Seek.

Une expérience consistant à retirer `style.x/y` du tween a été rechargée dans
une nouvelle instance Safari : à `5,0 s`, l’item retombait sur la translation
initiale avec la rotation cible. Cette modification a été annulée ; l’omission
n’est pas un correctif acceptable. La coexistence des canaux n’explique donc pas
à elle seule le saut.

## Cause localisée

Dans CodPlay, `measureLocalBox()` de `runtime/motion/html-pose.ts` garde les
dimensions `computed.width/height` (la boîte de contenu). Mais
`resolveMeasuredWorldOrigin()` soustrait à `getBoundingClientRect()` — qui
mesure la boîte de bordure — les bornes transformées calculées avec ces seules
dimensions de contenu. Sur l’item testé, les `37 px` de bordure verticale
omis, projetés par la rotation de `41°`, déplacent l’origine reconstruite
d’environ `37 × sin(41°) = 24,3 px`. `interpolateMotionPose()` utilise ensuite
cette origine pour présenter l’extrémité du path. Au passage de la progression
`< 1` à `1`, le graphe bascule vers `source`, le présentateur retire le transform
local, et la pose CSS auteur révèle le décalage.

Le report d’auto-pause d’une frame a été essayé dans Editor puis retiré : il ne
change pas le calcul d’extrémité ni le bord de représentation. Le défaut
appartient à la capture de pose du host CodPlay ; un correctif au contrat Editor
masquerait cette divergence au lieu de la corriger.

L’utilisateur a autorisé le correctif CodPlay dans un commit distinct le
28 octobre 2026. Ce correctif est isolé dans `df51bda4` ; sa preuve et son
contrat vérifié sont dans la spécification motion CodPlay.

## Correction selon le circuit de mesure établi

Le [guide Selection Frame](../../../authoring/selection-frame/GUIDE.md#overlay-posets--pose-visuelle-et-conversions-matricielles)
réserve `getBoundingClientRect()` à l’ancrage monde initial et à la calibration.
Les dimensions, fractions et conversions passent par les styles calculés et
les matrices. La consigne utilisateur du 28 octobre confirme que cette API ne
doit pas servir à mesurer la géométrie des items dans le correctif étudié.

Les essais de compensation des bornes extérieures ci-dessus identifient la
cause du décalage ; ils ne définissent pas le correctif à implémenter. La
proposition antérieure de conserver `resolveMeasuredWorldOrigin()` et de lui
fournir de meilleures bornes est retirée.

`captureWorldGeometry()` calcule déjà une origine affine à partir de
`captureLayoutOffset()`, `captureOwnTransform()` et de la matrice du parent.
Cette origine, actuellement nommée `fallbackOrigin`, est ensuite remplacée par
le calcul issu du rectangle mesuré. La proposition révisée réutilise ce
circuit existant pour la pose des items et retire la réinférence depuis leur
rectangle. `measureLocalBox()` perd également son repli sur le
rectangle mesuré ; ses dimensions CSS/layout restent distinctes des dimensions
extérieures et conservent la sémantique utilisée par `applyLocalSize()`.

L’ancrage monde initial doit rester dans sa frontière dédiée conformément au
guide, sans devenir une mesure géométrique par item. Les cas de placement
fractionnaire, scroll, racine décalée, ancêtres transformés, pivot, bordures
asymétriques, deux box-sizing et raccord local/reparent sont des portes
obligatoires de la correction séparée. Les tests correspondants passent ; la
capture des items utilise le circuit affine existant.

Critère d’acceptation du correctif séparé : à `5,0 s`, la frame Play et la pose
auteur/Seek correspondent au KF cible avant la réapparition du ghost, sans saut.
Seek, Stop, parent/enfant, bordures, tailles et lecteur restent corrects. Le
plan P6 reste `En cours` pour ses autres gates d’intégration et de précision.
