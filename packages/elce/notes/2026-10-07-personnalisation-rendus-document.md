# Elcé — personnalisation du rendu du document

## Portée

Cette note conserve l’orientation explorée le 7 octobre 2026. La préparation
du chantier reprend le 22 octobre dans l’[analyse de l’onglet Style](./2026-10-22-style-tab-analysis.md)
et son [plan dédié](../plan/2026-10-22-elce-style-tab-plan.md), **A relire**.
Elle ne constitue pas une spécification d’implémentation ni un modèle de stockage.

Le rendu du document reste principalement défini par CSS. L’effet de titre de
Section qui reste en haut pendant la lecture, puis cède la place au titre de la
Section suivante, relève du layout CSS de la Section.

## Trois niveaux de personnalisation

1. **Réglages individuels** — quelques choix simples laissés à l’utilisateur,
   comme la couleur principale ou un en-tête personnalisé avec son logo.
2. **Thème** — une sélection unique choisit un ensemble coordonné de styles,
   notamment les couleurs, la typographie et les effets de transition. Choisir
   un thème ne demande pas de régler ensuite chaque propriété. À terme, le
   catalogue pourra proposer des gammes de thèmes ou un thème personnalisé.
3. **Invariants de style** — le layout et ses règles responsive restent
   identiques pour tous les thèmes et réglages utilisateur. Seul le niveau
   administrateur, c’est-à-dire le développement du projet, peut les modifier.

Le titre sticky d’une Section appartient à ces invariants de layout. Un thème
pourra en modifier l’apparence, mais pas le comportement de maintien et de
relais entre Sections.

## Raccord au chantier Style

Les décisions sur la portée, les priorités, le premier périmètre et son ordre
de réalisation sont désormais suivies exclusivement dans le
[plan de l’onglet Style](../plan/2026-10-22-elce-style-tab-plan.md).
L’orientation antérieure qui associait les transitions au thème reste une
piste d’élaboration ; elle n’ajoute pas les transitions au périmètre de ce plan.

