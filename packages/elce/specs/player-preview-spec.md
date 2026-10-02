# Elcé — surface de preview

## Statut

**Fixe — surface complète du document implémentée et vérifiée.**

## Contrat

L’éditeur conserve une seule surface WYSIWYG. La lecture n’est pas ajoutée à
cette surface : elle s’ouvre dans une modale dédiée depuis l’action
« Prévisualiser ». Cette surface monte `ElcePlayerComposition` avec le
document courant et la page sélectionnée comme page de départ.

La composition utilise le scénario Sighty et les scènes CodPlay réelles. Le
rendu complet contient le menu, le titre de page, la zone de contenu et la
navigation précédente/suivante. La zone de contenu Flux occupe l’espace
disponible ; son article s’étend lorsque son texte dépasse la hauteur visible
et son scrollport conserve le repère de fin utilisé par le scénario.

Dans le menu, chaque chapitre non vide affiche son libellé une seule fois : le
markup fournit l’hôte de titre et le perso bouton CodPlay monté dans cet hôte
porte le texte et l’action. Le markup statique ne répète donc pas le nom du
chapitre.

La modale est une décision de POC réversible. Une fenêtre séparée pourra être
ajoutée plus tard sans changer le builder de document ni le scénario.

## Preuves

- [`AppLayout.tsx`](../src/app/layout/AppLayout.tsx) expose l’action de
  preview et la modale sans créer une seconde zone d’édition.
- [`app-layout.css`](../src/app/layout/app-layout.css) réserve la surface de
  la modale et laisse le cadre de lecture remplir cette surface.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage réel du menu, du titre, du contenu et de la navigation
  par Sighty/CodPlay, ainsi que l’unicité du libellé de chapitre.
