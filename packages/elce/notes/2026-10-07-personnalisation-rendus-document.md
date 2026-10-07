# Elcé — personnalisation du rendu du document

## Portée

Ce chantier est différé après la transition en cours. Il ne fait pas partie du
POC ni des travaux de migration actuellement planifiés. Cette note fixe
l’orientation à reprendre au moment de préparer ce chantier ; elle ne constitue
pas une spécification d’implémentation ni un modèle de stockage.

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

## À préciser lors de la reprise

- La portée des réglages individuels : document, projet ou profil utilisateur.
- La priorité entre réglages individuels et valeurs du thème lorsqu’ils
  concernent la même propriété.
- Le jalon précis désigné par « après la transition » et le périmètre de la
  première version de personnalisation.

