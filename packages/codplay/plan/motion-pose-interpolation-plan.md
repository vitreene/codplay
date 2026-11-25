# Interpolation des poses motion — rotation et échelle découplées

Statut : **Fixe** (correction du cœur autorisée par l’utilisateur le 2026-11-25 ; limite du retarget acceptée).

## Défaut

`interpolateMotionPose` (`src/runtime/motion/motion-pose.ts`) interpole la matrice
linéaire 2×2 des poses de borne composante par composante. Entre deux bornes de
rotations différentes, la matrice intermédiaire rétrécit :
`|(1−p)·R(θ0) + p·R(θ1)|` vaut `cos(Δ/2)` à mi-course. `alignMotionPoseToTangent`
tourne ensuite cette matrice vers la tangente sans corriger son échelle.

Preuve, sans l’éditeur (`tests/runtime/motion/motion-pose.spec.ts`, cas
« differently rotated endpoints », en échec sur le code actuel) :
- 0° → 90°, sans chemin, à 0,5 : échelle 0,707 au lieu de 1 ;
- −60° → 120°, orienté sur la tangente, à 0,3 : échelle 0,4 au lieu de 1 ;
- identité → rotation 90° et échelles 2 × 0,5, à 0,5 : échelle x 1,118 au lieu
  de 1,5 (rotation et échelle couplées).

Symptôme constaté dans l’éditeur : un item en mode tangente rétrécit (0,85, puis
0,13) entre deux KF après le glisser d’un KF, quand ses deux bornes capturées ont
des rotations différentes (`packages/editor/plan/2026-11-24-revue-interface-items-plan.md`,
E16). Le défaut est général : tout `move` ou reparent entre deux poses tournées
différemment le présente.

## Correction

1. Décomposer chaque matrice linéaire en `R(θ) · [[sx, k], [0, sy]]` :
   `θ = atan2(b, a)`, `sx = hypot(a, b)`, `k = (a·c + b·d) / sx`,
   `sy = (a·d − b·c) / sx` (signé : une réflexion reste représentée).
2. `interpolateMotionPose` interpole `θ` au plus court arc
   (`Δ = wrap(θ1 − θ0)` dans ]−π, π]), puis `sx`, `sy` et `k` linéairement, et
   recompose la matrice. Aux progressions 0 et 1, les matrices de borne sont
   rendues telles quelles (contrat « pose présentée au KF cible »).
3. `extrapolateMotionPoseAtProgress` (source virtuelle du retarget) inverse la
   même interpolation : `sx`, `sy`, `k` par la formule linéaire actuelle, et
   `θsource = θdest − wrap(θdest − θcourant) / (1 − p)`, pour que l’interpolation
   depuis la source virtuelle rejoue exactement la pose courante.
4. Spec `motion-frame-v2-spec.md` : préciser l’interpolation de la pose
   (rotation au plus court arc, échelles et cisaillement découplés).

Hors périmètre : la position (chemin et centre visuel) garde son calcul ; seule la
partie linéaire de la matrice change.

## Décision acceptée

- **Limite du retarget** : la source virtuelle n’est exacte que si la rotation
  restante vers la nouvelle destination ne dépasse pas `π·(1 − p)` (sinon
  l’interpolation prendrait l’autre arc). Pour un retarget vers la même
  destination, c’est toujours vrai. Limite acceptée et documentée (cas d’une
  destination déplacée et fortement tournée en fin de segment).

## Invariants

- Bornes exactes à 0 et 1 ; pose orientée inchangée au KF cible.
- Une pose sans différence de rotation ni d’échelle donne le même résultat
  qu’aujourd’hui (aux arrondis près).
- Le retarget rejoue la pose courante depuis sa source virtuelle.

## Acceptation

- Les quatre cas « differently rotated endpoints » passent ; la suite
  `motion-pose`, puis toute la suite `codplay`, typecheck et build.
- Suites des paquets dépendants, lancées depuis chaque paquet : `editor`, `demos`,
  `elce`, `sighty`, `authoring/component-v2`, `authoring/selection-frame`,
  `authoring/story`.
- Navigateur : sur la branche `editor` après rebase, le scénario E16 (KF médian de
  « Tangente » glissé) garde une échelle de 1 ; une démo V2 avec reparent tourné
  garde l’échelle de ses items.

## Avancement

- Fait : correction dans `motion-pose.ts` (`interpolateLinearMatrix`,
  `decomposeLinearMatrix`, `composeLinearMatrix`, `wrapAngle` ; extrapolation du
  retarget inversée de même) ; spec `motion-frame-v2-spec.md` (« Interpolation de
  la pose »). Suite `codplay` : 975 verts, 2 échecs antérieurs sans rapport
  (`sighty-layout.spec.ts`, `localStorage` absent), identiques sans la correction ;
  typecheck propre. Paquets dépendants : `demos`, `elce`, `sighty`, `component-v2`,
  `story` verts ; `editor` (10) et `selection-frame` (35) ont exactement les mêmes
  échecs avec et sans la correction (échecs antérieurs de `develop`).
- Reste : vérification navigateur sur la branche `editor` après rebase (scénario
  E16) ; puis retirer ce plan, la spec portant le comportement.

