# Elcé — agrandissement dans le viewport

> **Statut : En cours.** Images et Carousel intégrés. Les tests du player couvrent le Graphe direct, ancré et dans le Carousel. Typecheck et build passent ; suite Elcé : 302 réussites, 9 échecs (7 navigation/scroll, 1 assertion API sur `cache: no-store`, 1 SQLite `EPERM`). L’agrandissement vidéo attend un déclencheur séparé des commandes natives et le traitement des événements d’observation causés par `move`.

## Décisions retenues

- Périmètre : image, vidéo et Graphe. Le Graphe s’agrandit aussi bien directement que dans le Carousel. Les vues texte du Carousel sont ignorées ; ses vues image, vidéo et Graphe sont parcourues.
- Déplacer le contenu vers une cible `layout` `position: fixed`, dans la même scène ; `move` interpole entre la place d’origine et le viewport. L’image conserve son ratio. La cible couvre le viewport et les commandes Elcé sur un fond noir opaque.
- Garder la réserve de la source dans le Flux, neutraliser le scroll pendant l’agrandissement et utiliser `move` pour l’aller-retour. Un nouveau clic retargete immédiatement le mouvement.
- Fermer au clic ou avec Échap ; rendre le focus au média qui a ouvert l’agrandissement après le retour.
- Dans un Carousel agrandi, flèches et swipe parcourent les vues image, vidéo et Graphe, conservent la sélection à la fermeture et s’arrêtent aux extrémités. Suspendre l’auto à l’ouverture ; le reprendre à la fermeture si aucun choix manuel n’a eu lieu.
- Vidéo : un bouton distinct « Agrandir » apparaît au survol, en haut à droite de la vidéo ; son clic ouvre l’agrandissement sans détourner les commandes natives. Conserver `media.sync: 'independent'` ; l’agrandissement ne change ni lecture/pause, ni position, ni son. À la sortie de page, `STOP` arrête la vidéo et la remet à zéro.
- Graphe : agrandir seulement la visualisation — SVG ou Tableau — sans le titre ni le commentaire ; préserver son contenu accessible.
- Réutiliser le perso régulier `layout`, `move` et les événements existants. Ne modifier le cœur CodPlay qu’avec un plan propriétaire accepté et une autorisation explicite.
- Rive, Three.js et Lottie restent hors de cette tranche.

## Actions ordonnées

1. **Intégrer les images Flux et Diapo** via leur story et la cible viewport — fait ; tests joueur couvrent l’image directe, l’image ancrée, l’illustration Question et l’image de Carousel Diapo.
2. **Étendre le Carousel** avec flèches, swipe, limites et suspension/reprise de l’auto — fait ; tests joueur couvrent navigation image seule et reprise sans choix manuel.
3. **Valider le `move` après correction de l’alignement** : la cible fixed et le slot transmis comme root effectif sont en place ; les tests host/montage/position passent (`45/45`). Safari visible confirme l’aller et le retour : la cible reste à `(0, 0)`, `1024 × 664 px` ; le clone rejoint ces dimensions au cours des frames et revient à la source `(318, 206)`, `660 × 371 px`, sans cadre isolé ni saut observé. Il reste à valider les cas parent/enfant, reparent et resize. Les échecs Seek CodPlay restent suivis dans le [plan CodPlay motion](../../codplay/plan/motion-live-discovery-invalidation-plan.md).
4. **Étendre au média vidéo** avec le bouton « Agrandir » distinct en haut à droite au survol. Safari retargete les clics des commandes natives et de la surface vers `video` ; le bouton séparé porte donc l’ouverture. Préserver le nœud, les contrôles et l’état natifs ; vérifier leur usage en mode agrandi. Le `move` hors du root d’observation produit `leave`/`PAUSE`, puis `enter`/`START` au retour ; résoudre cet effet en gardant les pauses dues au scroll. Vérifier aussi `STOP` et le retour à zéro en sortie de page.
5. **Étendre au Graphe** pour les placements direct, ancré et Carousel ; agrandir seulement SVG ou Tableau. Les trois placements passent dans le player, avec texte éditorial conservé et navigation Carousel Graph↔image. La vérification visuelle Safari reste à faire dans un onglet visible.
6. **Après validation**, écrire la spécification Elcé avec le comportement vérifié et ses preuves, puis retirer ce plan et les notes préparatoires.

## Contrats à réutiliser

- Elcé : [ancre](../specs/anchor-spec.md), [Carousel](../specs/carousel-bdc-spec.md), [Graphe](../specs/statistical-graph-spec.md), [Flux](../specs/flux-scene-builder-spec.md), [Diapo](../specs/diapo-scene-builder-spec.md), [preview et STOP](../specs/player-preview-spec.md).
- CodPlay : [`img`](../../codplay/specs/image-component-v2-spec.md), [`media.sync`](../../codplay/specs/media-sync-v2-spec.md), [`move`](../../codplay/specs/move-v2-spec.md), [`layout`](../../codplay/specs/layout-component-spec.md), [événements](../../codplay/specs/event-pipeline-v2-spec.md), [capture](../../codplay/specs/capture-v2-spec.md), [straps](../../codplay/specs/strap-execution-v2-spec.md).
- Raisonnement et preuves de l’enquête : [notes](../notes/2026-10-14-elce-viewport-expansion-enquete.md).
