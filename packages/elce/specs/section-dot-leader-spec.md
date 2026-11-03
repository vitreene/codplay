# Section — points de suite

## Rôle et circuit

La commande « Points de suite », représentée par l’icône Lucide `Ellipsis`
(« … »), convertit le paragraphe courant en deux zones de texte éditables.
Elle partage son contenu au début de la sélection, sans supprimer le texte
sélectionné. La zone gauche conserve le texte précédent ; la zone droite
conserve le texte suivant. Les marques et les nœuds inline sont conservés.

L’extension appartient à
[`section/dot-leader/`](../src/resources/bdcs/section/dot-leader/).
Elle utilise les transactions de `SectionTiptapAdapter`, la commande
`bdc.section.update`, la sérialisation documentaire et l’historique commun
décrits dans la [spécification Section](./section-editor-spec.md).

## Structure et édition vérifiées

- `dotLeaderParagraph` est un bloc contenant exactement deux `dotLeaderText`.
  Chaque côté contient les nœuds inline ordinaires de la Section.
- La commande s’applique à un seul paragraphe ; elle refuse un titre ou une
  sélection couvrant plusieurs paragraphes. Les paragraphes voisins restent
  inchangés. Un côté peut être vide et recevoir du texte.
- Après activation, le curseur est placé au début du texte droit. Le bouton
  expose l’état actif avec `aria-pressed` et `data-active`.
- Un second clic réunit les deux contenus dans un paragraphe ordinaire,
  sans ajouter de caractère ni retirer de marque.
- Entrée insère un paragraphe ordinaire après le bloc et y place le curseur.
  Retour arrière au début d’un côté ou Suppr à sa fin retire le format.
- Les identifiants des conteneurs sont conservés dans les attributs JSON et
  le HTML. Le passage JSON → HTML → JSON conserve les deux contenus ; la
  décoration n’est jamais réimportée comme contenu éditorial.

## Markup et feuille commune

Le bloc exporte un `p[data-elce-dot-leader]`. Son conteneur de contenu porte
deux spans éditables ; un troisième span, vide et `aria-hidden="true"`, porte
le filet. Il n’y a pas de caractère « … » dans le contenu documentaire.

[`DOT_LEADER_STYLE_SHEET`](../src/resources/bdcs/section/dot-leader/dot-leader-style.ts)
est la même source CSS pour l’éditeur et la lecture. Elle déclare un layout
Flex aligné sur `baseline`, avec les zones de texte aux deux extrémités et un
span extensible de hauteur nulle muni de `border-block-end: 1px dotted
currentColor`. Le texte conserve ses marques et peut se replier dans chaque
zone. Aucun calcul `lh`/`cap`, mesure DOM ou écouteur de resize n’est ajouté.

La vue Section porte cette feuille dans son style local. Le builder Flux
l’ajoute après les feuilles déjà produites, par le canal `styleSheets`
existant. La preview et le package exporté reçoivent ainsi les mêmes règles,
sans ajout de comportement au runtime CodPlay.

## Preuves automatisées

- [`dot-leader-extension.test.ts`](../src/resources/bdcs/section/dot-leader/dot-leader-extension.test.ts) :
  séparation, marques, retrait, côtés vides, voisins, clavier natif,
  refus hors paragraphe, JSON/HTML et identifiants.
- [`section-editor-tiptap-adapter.test.ts`](../src/resources/bdcs/section/authoring/section-editor-tiptap-adapter.test.ts) :
  conservation d’une ancre existante lors de la conversion et du retrait.
- [`remix-section-production.test.tsx`](../src/mods/learning/integration/remix-section-production.test.tsx) :
  vrai bouton Remix → contrôleur XState → Undo/Redo → sérialisation et
  réouverture → player Sighty/CodPlay, puis Seek et Play. Le style de lecture
  est vérifié après destruction des éditeurs pour exclure leur feuille CSS.
- [`elce-scenario-exporter.test.ts`](../src/export/elce-scenario-exporter.test.ts) :
  présence des règles communes dans la feuille du package de page exporté.

L’acceptation visuelle dans le navigateur et le suivi des vérifications
restantes appartiennent au [plan actif](../plan/2026-11-03-section-dot-leader-plan.md).
