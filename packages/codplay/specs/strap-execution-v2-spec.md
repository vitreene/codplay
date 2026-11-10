# CodPlay V2 — exécution des straps et helpers planifiés

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification couvre l'appel ordonné des straps, l'aplatissement de leurs
résultats et les helpers temporels effectivement exercés. Le dispatch,
l'inscription des sorties dans le journal et leur relecture sont décrits par la
[spécification du pipeline événementiel](./event-pipeline-v2-spec.md).

## Collections de straps

Les collections scène et story sont résolues séparément : une entrée présente
dans l'une ne sert pas de fallback à l'autre. Une déclaration locale compilée
peut remplacer une entrée de même nom dans la collection réutilisable. Les noms
déclarés absents sont remontés avec leur portée et leur nom.

Ces règles sont couvertes par
[`strap-collections.spec.ts`](../tests/runtime/player/strap-collections.spec.ts).

## Exécution ordonnée

`executeStrapsSequentially` attend les straps dans leur ordre de déclaration.
Les tableaux de résultats imbriqués sont aplatis en conservant l'ordre. Les
sorties exercées sont les événements immédiats, les occurrences planifiées, les
mises à jour et les avertissements. Un strap absent ou une exception produit
une issue associée au nom du strap.

Les fonctions reçoivent `context.planned`. Les événements et mises à jour
produits par les occurrences sont ensuite traités par le journal et le
dispatcher communs ; la présente spécification ne redéfinit pas cette
inscription.

[`strap-executor.spec.ts`](../tests/runtime/player/strap-executor.spec.ts)
vérifie l'attente séquentielle, l'aplatissement imbriqué, les issues d'absence
et d'exception ainsi que l'accès à `context.planned`.

## Helpers temporels vérifiés

Les helpers testés retournent des occurrences portant un `offsetMs` et un pas :

- `wait(25, step)` retourne une occurrence à l'offset `25` ;
- `repeat({ eachMs: 10, times: 3 }, step)` retourne des offsets `0`, `10` et
  `20` ;
- `stagger({ stepMs: 5 }, [first, second])` associe ces pas aux offsets `0` et
  `5` ;
- `sequence` chaîne les pas à partir de zéro, d'une durée déclarée, ou d'un
  `startAt` explicitement donné. Le test obtient `0`, `10`, puis `30` pour les
  trois formes.

Les paramètres testés rejettent un offset négatif pour `wait` et un nombre
fractionnaire de répétitions. La surface exercée n'expose pas de helper `loop`.
`planned-helpers.spec.ts` vérifie ces résultats ; `runtime-event-dispatcher.spec.ts`
vérifie l'intégration d'une sortie planifiée dans le circuit commun.

## Limites de certification

Le comportement de `delay`, les fonctions fabriques de pas, le comptage
personnalisé de `stagger`, les autres frontières numériques et la poursuite de
la chaîne après l'exception d'un strap sont exclus de ce contrat.
L'invalidation ou l'annulation d'un résultat asynchrone arrivé après une
opération plus récente n'est pas garantie par cette version.
