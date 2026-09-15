# Reprise — reconstruction de la navigation Sighty

## Point d’arrêt

Session interrompue le 2026-09-15 pendant l’implémentation de la réécriture
complète de la navigation Sighty. Le travail reste **En cours**.

## État atteint

- Le runtime, le scénario, les types auteur et l’index ont été réécrits autour
  du graphe de vues.
- Les conditions auteur `accessBy`, `exitBy` et `onDenied` sont exécutées avec
  héritage par portée.
- Les données de scénario et les liaisons `entry`/`live` sont livrées aux
  scènes par le chemin d’événement CodPlay.
- `runtime.reset`, les sources de scènes différées et `runtime.mutate` sont
  présents.
- Les tests Sighty passent : 3 fichiers, 21 tests.
- Les typechecks Sighty et démos passent.

## Travail à reprendre

1. Mettre la spécification et le plan de référence en cohérence avec les
   comportements désormais exécutés : conditions, data, reset, lazy et
   mutations. Les deux documents contiennent encore des formulations disant
   que ces tranches ne sont pas exécutées.
2. Sécuriser le rollback d’une mutation : en cas d’échec après compilation,
   préchargement ou changement de composition, restaurer aussi les instances,
   ressources et composition physiques, pas seulement l’index logique.
3. Vérifier précisément la propriété/libération du cache de préchargement avant
   de finaliser ce rollback.
4. Relancer les validations d’intégration Sighty/CodPlay, le build des démos,
   puis le smoke test navigateur. Safari reste à vérifier séparément.
5. Conserver le statut **En cours** tant que les validations navigateur/Safari,
   la sauvegarde et les conventions éventuelles de fin de scène (`auto`,
   `scene:end`, `sequence:end`) ne sont pas décidées et couvertes.

## Fichiers principaux déjà engagés

- `packages/sighty/src/runtime.ts`
- `packages/sighty/src/scenario.ts`
- `packages/sighty/src/types.ts`
- `packages/sighty/src/navigation/conditions.ts`
- `packages/sighty/src/navigation/data.ts`
- `packages/sighty/tests/runtime-features.spec.ts`
- `packages/sighty/specs/authoring-library-spec.md`
- `packages/sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md`

Les autres modifications et suppressions présentes dans l’arbre de travail
étaient déjà engagées dans la même reprise et doivent être conservées jusqu’à
leur revue.
