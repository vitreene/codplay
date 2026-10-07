# Elcé — édition d’une Section

## Statut

**En cours — édition WYSIWYG, ancres de média et suppression du BDC Section
implémentées et vérifiées.**

Cette tranche couvre l’édition et la suppression d’une Section Flux. Les
parcours d’ancrage sont décrits dans la [spécification des ancres](./anchor-spec.md).

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
La corbeille du titre envoie `bdc.section.delete` au même contrôleur. Cette
commande retire la Section de sa page, supprime les Cartes ancrées qui lui
appartiennent et conserve leurs ressources média réutilisables.

## Preuves

- [`section-editor.test.tsx`](../src/app/editor/section/section-editor.test.tsx) vérifie
  le montage de la surface Tiptap dans un DOM réel de test et l’actualisation
  des commandes actives lorsque la sélection passe d’un titre italique à un
  paragraphe.
- [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
  vérifie la conservation conjointe du JSON et du HTML exporté, ainsi que la
  suppression de la Section et de ses BDC ancrés en conservant les médias.
- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie que la
  suppression du BDC Texte initial passe par la commande documentaire XState.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie que le builder porte le markup statique dans la scène Flux.

## Limites de la tranche

Le JSON est conservé dans IndexedDB avec le document Elcé. Une migration
complète des anciennes versions de document devra être ajoutée si le schéma
riche évolue ; la lecture actuelle fournit un contenu Section vide lorsqu’un
ancien bdc n’en possède pas encore.
