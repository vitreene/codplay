# Rationale — comportements continus et usages V1

## Rôle

Cette note conserve la distinction qui a émergé de la lecture des comportements
V1. Elle n'introduit ni API `Behavior` ni contrat auteur V2. Les comportements
V2 vérifiés sont décrits dans les spécifications ; leur extension éventuelle
reste au [plan ActionSequence/TweenAction](../action-sequence-tween-plan.md).

## Distinction utile

Dans les usages V1, `context.live.loop` mélangeait une valeur visuelle qui
dépend du temps et des occurrences discrètes comme un timeout ou un arrêt. La
valeur visuelle se prête à un calcul pur en fonction du temps ; le timeout et
l'arrêt sont des faits qui doivent emprunter le pipeline événementiel.

V2 garde aussi séparées les données provenant d'échantillons externes, comme
une capture, et les capacités dont le calcul ou la présentation est spécialisé,
comme `move`, les médias et les composants. Ces chemins ont chacun leur
spécification et leur plan d'acceptation.

Cette séparation évite de faire dépendre une valeur logique de la cadence des
frames affichées ou de reconstruire une capture et une projection spécialisée
comme un `Behavior` générique. Les primitives de calcul ACE ne créent pas, à
elles seules, une syntaxe de scène : seule la surface actuellement vérifiée de
`TweenAction` est décrite par sa [spécification](../../specs/action-sequence-tween-v2-spec.md).

## Documents de référence

- Les calculs purs ACE et leurs limites d'exposition auteur :
  [spécification ACE](../../specs/ace-calculation-v2-spec.md).
- Les comportements `ActionSequence`/`TweenAction` et leurs décisions
  restantes : [spécification](../../specs/action-sequence-tween-v2-spec.md) et
  [plan d'acceptation](../action-sequence-tween-plan.md).
- Les occurrences planifiées, le journal et les extensions non décidées :
  [spécification straps](../../specs/strap-execution-v2-spec.md) et
  [plan d'acceptation](../strap-execution-plan.md).
- La capture à partir d'échantillons externes :
  [spécification capture](../../specs/capture-v2-spec.md), avec l'acceptance
  navigateur restante aux [plans S5](../capture-s5-validation-plan.md) et
  [S6](../drag-capture-list-s6-validation-plan.md).
