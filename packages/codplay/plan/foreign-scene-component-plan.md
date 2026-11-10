# Stabilisation V2 — montage interinstances et contenu foreign

> Statut : En cours. Le slot et les capacités replace sont décrits dans les
> spécifications [slot](../specs/slot-component-spec.md),
> [façade](../specs/facade-v2-spec.md) et
> [présentation replace](../specs/replace-presentation-v2-spec.md).

## Périmètre restant

Fermer les preuves d’intégration du montage public existant. Les références
foreign génériques, représentations non clonables et nouveaux raccords
asynchrones sont séparés dans les
[évolutions à affecter](./evolutions/evolution-backlog.md#représentations-foreign-supplémentaires).
Les profils replace terminés et les observations historiques FLIP ne sont
pas des travaux à reprendre dans ce plan.

## Acceptation restante

- Vérifier le manifeste et les diagnostics : noms inconnus, ambigus ou sans
  déclaration, références actionnables et absence de sélection approximative.
- Compléter le parcours public multi-racines : ordre, détachement, remontage,
  destruction d’une instance sans détruire l’autre, players indépendants.
- Compléter le cycle consommateur A/B : pause/reprise, replay, fin de séquence,
  interruption et ressources, sans transférer la propriété du cycle au slot.
- Rejouer Safari et un navigateur complémentaire avec Play, Seek, resize et
  teardown. Une fixture à racine unique ne clôt pas le cas multi-racines.

## Clôture

Les tests de surface, de façade et de consommation gardent leurs fixtures.
Préserver les deux horloges replace et le propriétaire de chaque instance.
Retirer ce plan quand les validations ci-dessus sont closes ; toute extension
foreign conserve son cadrage et son autorisation séparés.
