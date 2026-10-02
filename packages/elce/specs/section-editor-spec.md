# Elcé — édition d’une Section

## Statut

**En cours — première surface WYSIWYG implémentée et vérifiée.**

Cette tranche couvre l’édition d’une Section Flux existante. L’insertion des
bdc par ancre, les médias et la sélection de presets restent dans les étapes
suivantes du plan. Le nœud d’ancre partagé par l’éditeur est décrit dans la
[spécification des ancres](./anchor-spec.md).

## Contrat

Le JSON riche de la Section est la source éditable du document métier. Le
builder conserve aussi le HTML statique exporté dans `section.markup` pour la
projection CodPlay. L’auteur ne saisit pas de HTML. Le composant émet la
description d’une transaction d’éditeur ; `ElceAnchorDropService` porte les
commandes documentaires et la sauvegarde des médias hors de la surface React.

La surface Tiptap propose dans le POC :

- les paragraphes et les niveaux de titre `h1` à `h6` ;
- gras, italique, souligné, indice et exposant ;
- alignements gauche, centré, droite et justifié ;
- une barre de commandes compacte en icônes Lucide, avec `aria-label` et
  infobulle pour chaque commande. Les boutons exposent l’état actif de la
  sélection courante via Tiptap (`aria-pressed` et `data-active`) ; un titre H3
  et un texte italique marquent donc simultanément leurs commandes respectives ;
- un champ de titre séparé et facultatif, présenté comme un placeholder
  discret ;
- un placeholder discret dans la zone de contenu vide.

Chaque modification passe par la commande `bdc.section.update` du contrôleur
XState, avec le JSON éditable et le HTML statique correspondant.

## Preuves

- [`SectionEditor.test.tsx`](../src/app/editor/SectionEditor.test.tsx) vérifie
  le montage de la surface Tiptap dans un DOM réel de test et l’actualisation
  des commandes actives lorsque la sélection passe d’un titre italique à un
  paragraphe.
- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie la conservation conjointe du JSON et du HTML exporté.
- [`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts)
  vérifie que le builder porte le markup statique dans la scène Flux.

## Limites de la tranche

Le JSON est conservé dans IndexedDB avec le document Elcé. Une migration
complète des anciennes versions de document devra être ajoutée si le schéma
riche évolue ; la lecture actuelle fournit un contenu Section vide lorsqu’un
ancien bdc n’en possède pas encore.
