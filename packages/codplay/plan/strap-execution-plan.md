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

## Extensions reportées

- L'invalidation et l'annulation des résultats asynchrones devenus obsolètes
  sont reportées à V3 ; le runtime V2 attend le résultat du strap appelé.
- Une API `live`, une répétition conditionnelle ou un scheduler de frames ne
  sont pas décidés pour cette surface. Les ouvrir nécessite une décision et un
  plan d'acceptation dédiés.
