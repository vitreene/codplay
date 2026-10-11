# Plan — unités logiques et forme publique des unités

> Statut : **En cours** — le comportement vérifié est dans la
> [spécification des unités](../specs/unit-values-v2-spec.md). La forme
> publique de `UnitValue` et le choix de l'unité logique à l'instanciation
> restent à décider.

## Décision ouverte

`UnitValue` est exporté par ACE et porte actuellement une partie numérique et
son unité. Le plan antérieur indique que sa forme exacte reste à stabiliser
comme contrat public.

L'unité logique des longueurs numériques est fixée à `cqw` par
`SCENE_BUILD_CONFIG.logicalLengthUnit` au build. `CodPlayInstanceOptions` ne
permet pas d'en choisir une autre. L'option runtime `numericLengthScale` est un
facteur de conversion vers les pixels, pas un choix d'unité. Le besoin demandé
est de pouvoir déclarer une autre unité logique à la création d'une instance.
Il reste à définir comment ce choix s'articule avec la qualification des
valeurs au build et le contrat de la `CompiledScene`; aucun nom d'option ni
ensemble d'unités autorisées n'est fixé ici.

## Travail restant

- Décider si la forme actuelle de `UnitValue` constitue une API publique
  stable ou reste un détail d'implémentation ACE.
- Aligner le type exporté, sa documentation et les tests avec cette décision,
  puis retirer ce plan lorsque le choix est appliqué et vérifié.
- Définir puis exposer, si le contrat le permet, le choix de l'unité logique
  par instance; préserver `cqw` comme valeur par défaut et distinguer ce choix
  du facteur `numericLengthScale`. Décrire l'effet sur le build, la scène
  compilée et le materializer, puis vérifier une unité alternative de bout en
  bout avant de mettre à jour la spécification.
