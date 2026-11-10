# Plan d'acceptation — exécution des straps V2

## Statut

> Status: En cours — les comportements prouvés sont dans la
> [spécification](../specs/strap-execution-v2-spec.md) ; des cas de frontière
> restent à valider.
> CodPlay version: V2 foundation

## Validation V2 restante

- [ ] Exercer `delay` et fixer sa relation à `wait`.
- [ ] Exercer une fabrique de pas et vérifier les valeurs fournies dans son
      contexte (`index`, `elapsedMs`, `currentTimeMs`, `startedAtMs`).
- [ ] Exercer `stagger` avec `count` explicite, une liste vide et des paramètres
      invalides ; vérifier aussi les valeurs non finies des offsets et durées.
- [ ] Vérifier qu'un strap qui lève une exception n'empêche pas les straps
      suivants de s'exécuter, tout en conservant l'ordre attendu.

Compléter ces tests avant d'étendre la [spécification](../specs/strap-execution-v2-spec.md)
ou de déclarer la tranche V2 `Fini`.

Les extensions sont suivies séparément en [V3](./evolutions/v3-plan.md)
et dans les [évolutions à affecter](./evolutions/evolution-backlog.md#extensions-du-transport-et-du-journal).
