# Plan — barre d’outils fixe dans une Section longue

**Statut : En cours.** La Section doit garder sa barre de mise en forme visible
pendant le défilement du texte, limitée à la durée de visibilité de ce même
bloc.

Le titre, les actions et la barre de mise en forme partagent maintenant un
seul conteneur adhérent, opaque, avec un espace sous les icônes intégré à ce
bloc pour ne pas laisser de jour sous la zone sticky. Le comportement
commun des en-têtes de BDC directs est suivi dans le
[`plan des en-têtes adhérents`](2026-11-03-bdc-headings-sticky-plan.md).

## Contrat accepté

- Réutiliser le scroll vertical existant de la colonne centrale de l’éditeur.
- Rendre le titre, les actions et la barre d’outils Section adhérents dans un
  conteneur unique et opaque, avec un retrait bas intégré, tant que cette
  Section est dans la zone défilée.
  La barre d’ajout BDC a été remplacée par le menu du rail ; elle n’occupe plus
  le haut de cette zone.
- Le conteneur adhérent cesse d’être visible à la fin de sa Section ; la
  Section suivante prend ensuite le relais.
- Les commandes de la barre gardent le focus dans l’éditeur sans faire défiler
  la colonne jusqu’à l’ancienne sélection.
- Ne pas créer de second scrollport, de gestionnaire de scroll JavaScript ou de
  barre partagée entre plusieurs Sections.

## Travail et acceptation

- [x] Regrouper le titre, les actions et la barre de mise en forme dans un
  conteneur `position: sticky` avec un fond opaque.
- [x] Intégrer l’espace sous les commandes au conteneur opaque, sans gap
  transparent entre ce conteneur et le texte.
- [x] Empêcher le retour de focus après une commande de barre de déplacer le
  scroll vers la sélection précédente : Tiptap active `scrollIntoView` par
  défaut pour `focus()`.
- [ ] Vérifier avec une Section longue que le bloc unique reste visible sans
  jour laissant passer le texte sous le titre ou la barre, s’efface à sa sortie,
  conserve le focus et la position de défilement après une commande, et
  n’empiète pas sur les commandes communes de l’éditeur ; vérifier aussi une
  seconde Section et une largeur étroite.
- [ ] Après validation, reporter le contrat vérifié dans la spécification
  Section et retirer ce plan.
