# Plan — points de suite dans une Section

**Statut : En cours. Proposition acceptée, implémentation demandée le 3 novembre 2026.**

## Décisions et invariants

- Un paragraphe entier porte deux zones de texte éditables, séparées au curseur
  par un filet pointillé extensible. Le texte final s’aligne à droite.
- La commande « Points de suite », avec l’icône « … », active ou retire ce
  format. Le retrait réunit les contenus en conservant les marques de texte.
- Le filet est un span vide avec une bordure basse et un alignement baseline,
  sans calcul de métriques ni mesure JavaScript.
- Réutiliser SectionTiptapAdapter → bdc.section.update → historique et
  persistance existants ; conserver JSON et HTML. Aucun changement CodPlay.
- Le rendu commun est porté dans les feuilles de scène Flux existantes pour
  la preview et l’export, et dans la vue Section pour l’édition.

## Exécution et acceptation

1. [x] Ajouter l’extension et ses styles dans `section/dot-leader/`, puis la
   raccorder aux extensions et à la barre Section. Prouver séparation au
   curseur, marques, retrait, parcours clavier, JSON/HTML et réouverture.
2. [x] Porter les mêmes styles par le builder Flux. Vérifier bouton Remix →
   XState → Undo/Redo → réouverture → vrai player Sighty/CodPlay, ainsi que le
   transport des styles dans l’export existant.
3. [x] Exécuter tests ciblés, suite Elcé, typecheck et build depuis le package.
   Build réussi ; 18 tests ciblés Section et export réussis dans cinq fichiers.
   La suite générale
   n’est pas verte : dix échecs fonctionnels sont reproduits sur une copie
   isolée conservant les autres changements du workspace, sans cette tranche
   (99 tests de comparaison : 89 passent, 10 échouent). Ils concernent
   catalogue/workspace, réglages de révélation, Question Diapo, assertions
   d’actions viewport Flux, empreinte CSS et observation de fin de page.
   Les deux suites serveur/SQLite passent hors sandbox (24 tests) ; le bac à
   sable refusait leurs ports locaux avec `EPERM`.
   Le typecheck Elcé passe maintenant après suppression de la variable `title`
   redondante dans `statistical-graph-scene-builder.ts`.
4. [ ] Vérifier dans le navigateur baseline, resize, textes longs, focus,
   styles enrichis, persistance et preview. Brave est configuré localement,
   mais aucun outil de navigateur n’est exposé dans cette session ; cette
   acceptation reste en attente tant que ces outils ne sont pas disponibles.
5. [x] Reporter le comportement et les preuves dans `section-editor-spec.md`
   et la [spécification dédiée](../specs/section-dot-leader-spec.md).
   Garder ce plan ouvert pour l’acceptation navigateur manquante.

Le format est un contenu statique : aucun changement de transport, de durée,
de reparent ou de cycle média. Play/Seek/rejeu concernent la conservation du
markup et des styles par le vrai player, pas une animation du filet.
