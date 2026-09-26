# CodPlay V2 — ActionSequence et TweenAction

## Périmètre certifié

Cette spécification décrit uniquement les comportements logiques vérifiés pour
les séquences d'actions et les `TweenAction`. L'extension vers un rendu continu
reste suivie dans le [plan associé](../plan/action-sequence-tween-plan.md).

Les actions sont reconstruites par le circuit commun du player :

```text
CompiledScene + journal + position temporelle
    -> materialize
    -> resolve
    -> état logique résolu
```

La [spécification de scène](./scene-authoring-spec.md) décrit la compilation et
le transfert des fonctions ; la présente spécification porte sur leur
interprétation logique.

## Comportements vérifiés

### Séquence d'actions

Une valeur d'action peut contenir une séquence de `{ action, durationMs? }`.
Dans le cas testé, la durée explicite du premier pas place le pas statique
suivant à la fin de cette durée. Le player reconstruit l'état au franchissement
de cette frontière interne.

Une occurrence ultérieure de la même clé d'action invalide les pas de séquence
précédents qui n'ont pas encore commencé. Les pas précédents déjà actifs restent
dans la reconstruction.

### TweenAction

La forme compilée exercée est `{ duration, fn: { ref } }`. Pour une durée de
100 ms sans `ease`, le résolveur appelle la fonction de la collection de build
avec une progression temporelle bornée : à 50 ms écoulées, la progression vaut
`0.5`, puis elle vaut `1` à l'échéance. Le payload retourné est appliqué à
l'état par le même résolveur d'action que les autres actions.

Une référence de fonction absente de la collection provoque une erreur explicite.
Le test player confirme que la reconstruction par Seek et celle de Play
produisent le même état logique pour cette forme de `TweenAction`.

### Arrêt direct

Dans le cas vérifié, un événement `tween:stop` retire de la reconstruction une
`TweenAction` directe déjà commencée à partir de la frontière d'arrêt. Le test
ne couvre pas encore l'arrêt d'une `TweenAction` contenue dans une séquence.

## Preuves

- [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts) vérifie le
  chaînage par durée explicite, le remplacement des pas différés, le progrès et
  le remplacement d'une `TweenAction` directe, ainsi que `tween:stop` direct.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  vérifie la même résolution logique en Seek et Play et le franchissement d'une
  frontière interne de séquence.
- [`chrono-demo.spec.ts`](../tests/facade/chrono-demo.spec.ts) exerce l'arrêt
  d'une `TweenAction` via la façade et l'émission DOM de la fixture chrono.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/player/pipeline.spec.ts \
  tests/runtime/player/runtime-player.spec.ts \
  tests/scene/compiled/scene-builder.spec.ts \
  tests/facade/chrono-demo.spec.ts
4 fichiers, 85 tests réussis
```

## Limite de certification

La forme `startAt`, la durée implicite d'un `TweenAction` dans une séquence,
`durationMs` qui remplace cette durée implicite, l'arrêt d'un pas séquencé et
les sorties invalides ou les exceptions de fonction ne sont pas couverts par
ces preuves. Ils restent dans le [plan d'acceptation](../plan/action-sequence-tween-plan.md)
et ne sont pas établis ici comme contrat certifié.
