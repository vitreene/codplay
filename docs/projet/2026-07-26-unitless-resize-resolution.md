# Résolution des valeurs unitless au resize — cadre fixe, scale, whitelist

Note de réflexion (2026-07-26). Détail d'un point de la revue I/O V2
(`2026-07-26-conduite-chantier-v2.md` §10 #3) sorti en note propre vu sa densité. Traite : comment une
valeur *unitless* (px logique, resize-sensible) est résolue, par opposition au cq* passif. Aucun
code — trace de la réflexion. Périmètre codplay.

## Le contexte — deux façons d'être adaptatif

Le viewport/resize se traite en **deux couches** (§10 #3) :
- **passif** : les unités container-query (`cqw`…), résolues **nativement** par le substrat, sans event
  ni recalcul. Voie royale — l'éditeur privilégie cq* au maximum.
- **actif** : les valeurs *unitless*, qui ne sont PAS auto-adaptatives et demandent une résolution
  explicite. Cette note traite cette couche.

**Convention de marquage** : une mesure en px est donnée **unitless** = de facto resize-sensible. La
forme de la valeur porte sa sensibilité (cohérent avec « rien en dur, tout par convention »,
conduite §8).

## Le modèle — cadre unitless fixe + scale + recalcul ciblé

1. **La scène est conçue dans un cadre unitless FIXE** (ex. `160×90`) — le référentiel d'auteur,
   invariant. Tout se pense dans ce cadre, en nombres sans unité.
2. **Au lancement, le ratio est calculé UNE fois** : conteneur réel `548px` de large → ratio
   `548/160` (dimension réelle / dimension logique du cadre). Une valeur unitless `x` → `x × ratio` px.
3. **Au resize, ce n'est PAS le ratio qu'on recalcule — c'est le `scale`** qui passe de 1 à sa valeur
   cible. Le ratio de base reste ancré sur le cadre de lancement ; le redimensionnement s'exprime
   comme un **`scale` par-dessus**.
   - Les valeurs qui **suivent le scale** (la plupart : position/taille dans le cadre) sont portées
     **gratuitement** par le transform, sans recalcul.
   - Les valeurs **unitless resize-sensibles** (celles qui ne doivent PAS suivre le scale) sont
     **recalculées hors scale** contre le nouvel état.

## Pourquoi « hors scale »

L'unitless est précisément *ce qui ne doit pas être simplement mis à l'échelle* — sinon on le
laisserait dans le scale comme tout le reste. Résoudre l'unitless en incluant le `scale` dans le ratio
produirait un **double comptage** : une fois par le ratio scalé, une fois par le transform scale. Même
classe de piège que la double conversion cqw (`resolveContainerQueryValue`, historique). La conversion
se fait donc contre le **ratio de base du cadre** (unité-logique → pixel), le `scale` s'applique APRÈS
comme transform, jamais dans le ratio. Isoler ratio-de-base et scale, ne jamais les mélanger.

## Résolution au RENDER, pas dans solve

Contrairement au cq* (résolu passivement par le substrat), l'unitless reste **unitless dans le
`PersoState`** (solve, agnostique) et n'est converti en px qu'à la **projection** (S6), à chaque
render, contre l'état courant du cadre. L'unitless est même un bon *test* de la frontière solve/project :
il DOIT rester non résolu jusqu'au render, sinon on le fige contre un cadre périmé. Le ratio (cadre→px)
est une **capacité de Projection** — chaque substrat a le sien.

## Identification par whitelist — déclarée, pas détectée

La sensibilité au resize n'est PAS détectée par heuristique : elle est **déclarée** — une **liste
blanche** de propriétés/valeurs resize-sensibles, centralisée en config (conduite §8, rien-en-dur). La
whitelist EST la convention. Plus robuste qu'une heuristique : on sait exactement ce qui est recalculé
hors scale, et l'auteur peut l'étendre.

## Couverture partielle ASSUMÉE — jamais 100%

Point de conception, pas une limite honteuse : **la whitelist ne couvrira jamais tous les cas** — le
sujet est trop complexe côté DOM (combinaisons de layout, cas limites, propriétés qui interagissent).
Le mécanisme est **explicitement partiel** :
- un cas **hors whitelist** n'est **pas un bug** — c'est un cas connu-non-couvert ;
- il est traité par le **scale global** (dégradation visuelle acceptable, **échec propre**), ou ajouté
  à la whitelist si l'auteur le juge nécessaire.

Même honnêteté que `measure` (irréductible spatial) et que les effets à side-effect (irréductible
temporel, `f(t)`) : **nommer la limite plutôt que prétendre 100% et casser silencieusement.** Une
whitelist assumée partielle échoue proprement (le scale s'applique, dégradé mais pas cassé) ; un système
qui viserait 100% produirait un bug invisible dès le premier cas raté.

## Statut

Cas de la revue I/O V2 (#3) détaillé, non tranché dans ses valeurs (le ratio par défaut, le contenu
exact de la whitelist restent à convenir). Capacité de Projection (ratio + whitelist par substrat).
Aucun code. Lié : `2026-07-26-conduite-chantier-v2.md` §10 #3,
`2026-07-16-solve-project-moteur-custom.md` (S6 project, S8 Projection).
