# Rationale — préparation motion déclenchée par occurrence `move`

## Rôle

Cette note conserve le motif de la migration motion en cours. Elle ne certifie
pas son avancement et ne remplace pas le
[plan de préparation par occurrence](../motion-live-discovery-invalidation-plan.md),
qui porte le contrat de travail et ses gates.

## Motif de la migration

L'ancien chemin préparait des frontières à l'initialisation ou pendant des
présentations ordinaires, puis pouvait relire le journal pour retrouver les
mouvements concernés. Cette découverte anticipée mélangeait le choix d'une
action avec la mesure de géométrie nécessaire à sa présentation.

Une occurrence `move` déjà résolue fournit le point où cette géométrie devient
utile. Préparer à partir de cette occurrence évite le travail motion pour les
événements qui n'en portent pas, tout en conservant le journal comme unique
historique logique. Play et Seek peuvent ainsi préparer la même présentation à
partir des mêmes faits. Le choix de story vient de la résolution logique ; la
parenté DOM ne constitue pas une source de vérité pour cette portée.

La sémantique de `move`, la préparation des groupes, les transactions de Seek,
le reset, l'invalidation au resize et les validations navigateur sont suivis
dans le [plan actif](../motion-live-discovery-invalidation-plan.md) et le
[plan d'intégration HTML](../runner-flip-integration-study.md). Cette note ne
répète ni leurs décisions ni leur historique d'implémentation.
