# Stabilisation V2 — intégration des méthodes HTML dans Elcé

> Statut : En cours pour le menu Elcé. La projection CodPlay et la validation
> auteur sont implémentées ; leurs contrats sont dans les spécifications
> [méthodes HTML](../specs/html-element-method-spec.md),
> [matérialisation](../specs/component-materialization-v2-spec.md) et
> [motion](../specs/motion-frame-v2-spec.md).

## Travail restant

- [ ] Définir l’état accessible du menu de bureau avec les capacités actuelles :
      sans le binding, l’état initial laisse le menu visible mais inert.
      Ne pas supprimer le binding avant résolution de ce point.
- [ ] Placer focus/blur/preventscroll dans les actions du layout, puis retirer
      `ElcePlayerComposition.bindMenuDrawer()` sans circuit DOM concurrent.
- [ ] Vérifier dans le vrai runner l’ouverture, la fermeture, Échap, clic
      extérieur et sélection d’une page. Les attributs d’ouverture précèdent
      le focus ; le focus de retour précède les attributs de fermeture.
- [ ] Tester le menu réel dans Brave aux tailles concernées, sans avertissement
      de focus, puis fermer l’acceptation Elcé et sa documentation.

## Invariants

Le matérialiseur sélectionne le nœud courant à l’activation ; aucun handle DOM
ne traverse le cœur. Seek et geometry-capture inhibent les méthodes
ponctuelles sans empêcher la préparation motion. Les instances restent
isolées ; un perso démonté est ignoré. Aucun scheduler RAF n’est ajouté.

L’écart 800/801 et le futur point blur des inputs sont séparés dans les
[évolutions de projection](./evolutions/evolution-backlog.md#autres-extensions-de-projection).
Ils ne sont pas un correctif local de cette intégration. Toute modification
du cœur demeure soumise à son autorisation explicite.
