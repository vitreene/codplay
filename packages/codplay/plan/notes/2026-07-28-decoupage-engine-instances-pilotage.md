# Engine et instances — rationale du découpage CodPlay

> Rationale mise à jour le 2026-09-26. Les comportements vérifiés font foi dans
> les spécifications ; les décisions non prises ou non appliquées restent dans
> leurs plans actifs.

## Pourquoi deux niveaux

L'engine regroupe les déclarations et préparations réutilisables, comme le
catalogue de capacités et les bibliothèques tierces. Chaque instance possède
son player et son état d'exécution : journal, temps logique, cycle de vie,
composants et ressources propres. Ce découpage permet à plusieurs players de
partager les définitions préparées sans partager leur état mutable.

L'hôte de l'application possède les décisions qui coordonnent plusieurs
instances. CodPlay fournit les opérations locales sur chaque instance et le
Seek groupé synchrone, qui prépare les cibles puis les commit ensemble. Le
runtime ne déduit pas une instance « principale » et ne crée pas de canal
global implicite.

Ce découpage maintient également une frontière nette entre les faits de scène,
leur reconstruction au temps logique demandé et leur présentation. Une
projection HTML ou tierce ne devient pas la source de vérité de l'état.

## Contrats et suivi actuels

- Les surfaces Engine, Player, instances, événements et Seek groupé vérifiés
  sont décrits dans les spécifications de
  [façade](../../specs/facade-v2-spec.md) et
  [Engine/Player](../../specs/engine-player-v2-spec.md).
- La reconstruction des faits et leur séparation de la présentation sont dans
  la [spécification de reconstruction](../../specs/runtime-reconstruction-v2-spec.md).
- Les décisions sur `schedule`, le redémarrage terminal direct, la réutilisation
  logique, la lecture bornée et les événements après Seek arrière restent au
  [plan Player](../player-engine-plan.md).
- L'observation des changements de `snapshot` reste au
  [plan façade](../facade-engine-instance-plan.md).

Cette note explique le motif du découpage ; elle n'ajoute pas d'API ni de
contrat de portée.
