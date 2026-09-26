# CodPlay V2 — calculs préparés ACE

## Périmètre vérifié

Cette spécification décrit les primitives de calcul pur exportées par ACE et
vérifiées dans ses tests isolés. Elle ne transforme pas chaque primitive en
syntaxe auteur ou en comportement de scène V2. Les contrats auteur de `move`,
des unités et des couleurs restent respectivement dans leurs
[spécifications dédiées](./move-v2-spec.md),
[unités](./unit-values-v2-spec.md) et [couleurs](./color-values-v2-spec.md).
L'intégration de `TweenAction` dans un rendu continu reste au
[plan d'acceptation](../plan/action-sequence-tween-plan.md).

ACE prépare les données de calcul hors résolution temporelle, puis évalue les
valeurs à un instant fourni. Ces primitives ne possèdent ni horloge, ni DOM, ni
cible de rendu. Le runtime les appelle depuis le pipeline existant ; la
présentation reste possédée par le matérialiseur ou le host concerné.

## Valeurs et tweens

`prepareInterval` prépare une paire de valeurs avant leur interpolation.
`resolveInterval` évalue l'intervalle à une progression fournie. Les valeurs
numériques, les structures composées et les couleurs prises en charge sont
détaillées par les spécifications dédiées ci-dessus.

`prepareTween` prépare un intervalle avec sa durée, son délai, ses répétitions,
son sens, son easing et, le cas échéant, un chemin préparé. Une durée nulle,
négative ou non finie est refusée. `resolveTween` reçoit un instant relatif au
tween : avant la fin du délai, la valeur source est tenue ; après la fin, la
valeur terminale est tenue. Les options `loop`, `loopDelay`, `reversed` et
`alternate` sont évaluées sans état mutable et le même instant produit la même
progression quelle que soit la direction d'appel.

`resolve` évalue à un instant une liste ordonnée de tweens ou de séquences de
keyframes préparées. Il ne définit pas une politique de composition entre
actions concurrentes.

## Courbes et séquences temporelles

`parseEase` résout les courbes nommées, y compris les formes paramétrées
testées. Un nom inconnu provoque une erreur. Le catalogue, les courbes de
Bézier, `steps` et `linear` passent les comparaisons de parité couvertes avec
anime.js 4.5.0.

`spring` construit un easing déterministe à partir de paramètres physiques ou
perceptuels et expose sa durée de stabilisation. Ses évaluations sont pures et
peuvent dépasser la valeur finale pendant le rebond. Le raccord automatique de
cette durée à `TweenInput.duration` n'est pas établi ici.

`prepareKeyframes` accepte une liste non vide d'intervalles explicites avec
`from`, `to`, `duration`, et éventuellement `delay` et `ease`. La préparation
place ces intervalles dans l'ordre ; `resolveKeyframes` tient la valeur
terminale précédente pendant le délai d'une frame suivante. Les raccourcis
d'écriture anime ne sont pas couverts par cette surface.

## Géométrie pure

Les chemins ACE préparés décrivent une géométrie normalisée et peuvent être
résolus dans le repère défini par deux points numériques. `preparePath` prépare
une courbe quadratique ; le parcours par longueur d'arc est le défaut testé et
le parcours paramétrique est également disponible. Les extrémités sont
conservées et la transformation vers le segment réel applique la même échelle
aux deux axes. Les entrées auteur de chemins SVG et leur compilation avant le
runtime sont définies par la spécification `move`.

`preparePolarTween` prépare ensemble un angle et une distance, puis
`resolvePolarTween` produit une paire ordonnée de coordonnées. Les angles CSS
testés sont convertis en radians ; l'origine conserve l'unité de la distance,
et un zéro sans unité peut adopter cette unité. Dans les coordonnées écran
testées, l'angle nul pointe vers `+x` et un angle positif tourne vers `+y`.

Les fonctions de matrice 2D créent, composent, inversent et appliquent des
matrices affines aux points. La composition testée `translate × scale` applique
d'abord l'échelle au point, puis la translation. Une matrice singulière n'a pas
d'inverse et retourne `null`.

## Limites de ce contrat

Les tests isolés des primitives ne certifient pas leur exposition comme
contrat auteur, leur sérialisation dans `CompiledScene`, ni leur parcours
complet à travers Player, Seek et un matérialiseur. En particulier, cette
spécification n'établit pas de comportement ACE `blend`, de composition
pondérée entre actions, ni l'emploi de `spring`, `polar` ou de keyframes par un
`TweenAction` auteur. Ces décisions restent au plan associé.

## Preuves

- Tweens et temps : [`tween.spec.ts`](../tests/ace/tween.spec.ts).
- Courbes et ressorts : [`easings-parity.spec.ts`](../tests/ace/easings-parity.spec.ts),
  [`spring.spec.ts`](../tests/ace/spring.spec.ts) et
  [`spring-parity.spec.ts`](../tests/ace/spring-parity.spec.ts).
- Keyframes : [`keyframes.spec.ts`](../tests/ace/keyframes.spec.ts).
- Chemins : [`path.spec.ts`](../tests/ace/path.spec.ts) et
  [`svg-path.spec.ts`](../tests/ace/svg-path.spec.ts).
- Coordonnées polaires : [`polar.spec.ts`](../tests/ace/polar.spec.ts).
- Matrices 2D : [`matrix-2d.spec.ts`](../tests/ace/matrix-2d.spec.ts).

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run tests/ace
15 fichiers, 154 tests réussis
```
