# Elcé — surface de preview

## Statut

**En cours — preview complète et ordre de menu mixte vérifiés ; la navigation
linéaire précédente/suivante suit les gardes d’accès du scénario. Une politique
alternative de retour aux frontières de chapitre reste au plan post-POC.**

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

La modale est la surface de lecture utilisée pendant l’édition du POC.

Dans l’éditeur, le bouton « Prévisualiser » occupe une ligne à part,
immédiatement au-dessus de la ligne des titres de chapitre et de page. Il reste
dans le flux normal de la page. La modale de lecture s’affiche sur un niveau
supérieur à celui de l’éditeur.

Le menu et l’ordre courant de lecture reprennent la séquence racine du
document : les pages autonomes sont au même niveau que les chapitres. Une page
autonome choisie comme départ est ouverte dans le slot de contenu et son rang
est calculé avec les pages des chapitres. Le montage et le sommaire sont
vérifiés ; le passage effectif par les boutons entre une page d’un chapitre et
une page autonome suit l’ordre linéaire courant. Une page autonome demandée
directement comme départ ne marque pas les pages précédentes comme lues : les
gardes d’accès du scénario continuent de les bloquer. Après parcours des pages
précédentes, le retour depuis une page autonome sélectionne la page qui la
précède dans l’ordre du scénario, même si elle appartient à un chapitre.

## Preuves

- [`AppLayout.tsx`](../src/app/layout/AppLayout.tsx) expose l’action de
  preview et la modale sans créer une seconde zone d’édition.
- [`app-layout.css`](../src/app/layout/app-layout.css) réserve la surface de
  la modale et laisse le cadre de lecture remplir cette surface.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie le montage réel du menu, du titre, du contenu et de la navigation
  par Sighty/CodPlay, ainsi que l’unicité du libellé de chapitre.
- Le 4 octobre 2026, Safari MCP confirme l’ordre mixte du menu, le démarrage
  sur une page autonome et son rang dans le document. Le test direct sur Page F
  n’avait pas parcouru les pages précédentes ; l’auteur a confirmé qu’après
  leur parcours, « Précédent » depuis Page F revient à la page E du chapitre.
  Les gardes d’accès empêchent ainsi de remonter dans une page qui n’a pas été
  parcourue.
- Le 4 octobre 2026, Safari MCP vérifie que le bouton « Prévisualiser » occupe
  une ligne distincte au-dessus de la ligne des titres, puis ouvre et ferme la
  modale depuis ce bouton.
