# Plan — forme publique ACE des unités

> Statut : **En cours** — le comportement vérifié est dans la
> [spécification des unités](../specs/unit-values-v2-spec.md). La forme
> publique de `UnitValue` reste à stabiliser.

## Décision ouverte

`UnitValue` est exporté par ACE et porte actuellement une partie numérique et
son unité. Le plan antérieur indique que sa forme exacte reste à stabiliser
comme contrat public. Cette revue documentaire conserve ce point ouvert sans
figer les noms de champs ni modifier le code.

## Travail restant

- Décider si la forme actuelle de `UnitValue` constitue une API publique
  stable ou reste un détail d'implémentation ACE.
- Aligner le type exporté, sa documentation et les tests avec cette décision,
  puis retirer ce plan lorsque le choix est appliqué et vérifié.
