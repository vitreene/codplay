# Plan — Presse-papiers dans le panneau droit

**Statut : En cours.** Le catalogue de Pages, BDC et Médias a été regroupé dans
une palette flottante. La décision acceptée replace cette fonctionnalité dans
le panneau droit de l’éditeur.

## Décisions acceptées

- Le panneau droit propose « Presse-papiers », « Variables » et « Style ».
- « Presse-papiers » reprend les sous-rubriques Pages, BDC et Médias et leurs
  commandes existantes de sélection, déplacement et glisser-déposer.
- « Variables » remplace « Contenus ». Son contenu est directement la fonction
  Variables : quand un champ textuel compatible est actif, afficher ses
  contrôles d’insertion ou d’édition sans bouton intermédiaire « Variables ».
- Dans le panneau Variables, le libellé de l’onglet sert de titre accessible ;
  ne pas répéter « Variables » ni « Variables et liens » dans le contenu.
- Dans Presse-papiers, le libellé de l’onglet sert de titre ; retirer l’en-tête
  interne et les libellés visibles du catalogue de pages quand il est vide.
- Le bouton Catalogue à côté de « Prévisualiser » et la surface flottante
  disparaissent. Le panneau droit et ses commandes responsives restent en place.
- « Style » conserve son circuit et sa sélection de cible existants.

## Circuit et invariants

Réutiliser `renderLearningClipboardPanel` et ses actions documentaires pour
Pages, BDC et Médias ; les monter dans le panneau droit au lieu de l’overlay.
Le dépôt de Pages et de BDC sur le Presse-papiers doit continuer d’appeler les
commandes de placement existantes. Les interactions du rail BDC, les commandes
de suppression et le glisser-déposer entre catalogue et page gardent leur
contrat. Ne pas ajouter de service de catalogue ni modifier CodPlay core.

Le panneau partagé `EditorFrame` continue d’héberger l’action « Prévisualiser »
et les commandes responsives. Elcé n’y fournit plus d’action de catalogue ni
d’overlay flottant.

## Ordre et acceptation

- [x] Mettre les trois catalogues dans le panneau droit sous « Presse-papiers »
  et conserver Pages, BDC, Médias et leurs gestes de dépôt.
- [x] Remplacer « Contenus » par « Variables » et supprimer son bouton interne ;
  la sélection de Variables affiche immédiatement la fonction contextuelle.
- [x] Retirer la bascule Catalogue voisine de « Prévisualiser » ainsi que l’état
  et le positionnement de palette flottante.
- [x] Retirer les titres internes redondants du panneau Variables et s’appuyer
  sur le libellé de l’onglet pour son nom accessible ; le typecheck Elcé passe.
- [x] Retirer le titre interne « Presse-papiers », « Catalogue de pages » et
  « Déposer une page ici » ; garder l’onglet comme nom accessible et le séparateur
  de dépôt sans texte. Le typecheck Elcé passe.
- [ ] Vérifier les trois onglets du panneau droit, l’ouverture de Style depuis
  une cible, l’insertion de variables dans un champ actif, le dépôt de pages et
  BDC dans les catalogues, la réduction responsive du panneau et l’absence de
  débordement.
- [ ] Consolider la spécification d’organisation avec les comportements
  vérifiés. Les retours au catalogue par la cible du rail BDC et la suppression
  des corbeilles de lignes de page restent des points séparés et non résolus.
