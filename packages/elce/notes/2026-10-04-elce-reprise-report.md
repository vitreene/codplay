# Reprise du POC Elcé — 4 octobre 2026

Cette note est un point de reprise ponctuel. Le document de référence pour
l’ordre, les critères de sortie et les décisions ouvertes reste le
[plan de construction Elcé](../plan/2026-10-01-elce-construction-plan.md) ; les
contrats vérifiés restent dans [`specs/`](../specs/).

## État au moment de la reprise

L’application Elcé est dans `packages/elce`. L’éditeur, l’organisation du
scénario, les pages Flux, les BDC Question et Résultat, le Carousel, les
builders Sighty/CodPlay et la preview en modale existent. Les spécifications
décrivent les circuits déjà vérifiés. Le POC n’est pas terminé : plusieurs
tranches sont encore marquées « En cours », et la Page Diapo reste à construire.

Le sélecteur natif de fichiers s’ouvre dans Safari non contrôlé avec l’attribut
`accept` explicite. Safari MCP ne montre pas le panneau système ; ce contrôle ne
doit donc pas être repris comme défaut du sélecteur.

## Travaux restants, dans l’ordre du plan

1. **Fermer le socle et l’organisation (tranches 0–1).** Vérifier le lancement
   à froid et la restauration après fermeture du document et des médias
   IndexedDB. Vérifier après rechargement la restauration des titres de page et
   de chapitre, et confirmer que les commandes de déplacement respectent la
   séparation entre reconstruction du scénario et scènes existantes.

2. **Valider le parcours Flux dans le player réel (tranche 2).** Vérifier le
   départ à la page courante, le repère de fin sur pages courtes et longues,
   l’ordre mixte pages/chapitres et la navigation visible entre pages racine
   et pages de chapitre. Le cycle A → B → A doit conserver le contenu de chaque
   scène.

3. **Achever l’acceptation des ancres (tranche 3).** Compléter les essais
   Safari du glisser-déposer physique, de la réouverture et du déplacement d’un
   BDC, et de la suppression d’une ancre après sauvegarde/rechargement. Vérifier
   le rendu de plusieurs ancres après resize, le texte édité près d’une ancre et
   le Seek direct des contrôles vidéo. La spécification relève aussi un
   cadrage différent entre éditeur (`contain`) et player (`cover`) ; le plan
   demande de le réconcilier avec le rendu `cover` demandé.

4. **Fermer Quiz et Évaluation dans le player (tranches 4–5).** Le Quiz simple
   a déjà été exercé dans Safari ; compléter l’acceptation réelle des types
   Vrai/Faux, Choix et Choix multiple. Raccorder `EvaluationMachine`, les
   actions des branches Succès/Échec du BDC Résultat et l’affichage des Questions
   dans le player. Vérifier seuil 80 %, échec sans révélation, reprises de
   toutes les questions ou des seules erreurs, puis relecture après succès
   avec les réponses données et attendues.

5. **Finir les preuves du Carousel (tranche 7).** Dans Safari, vérifier les
   ratios 4:3 et 1:1 avec média chargé, le cadre hors des points de navigation,
   et le cycle automatique dans un onglet visible. Le sélecteur de fichier est
   vérifié par l’auteur dans Safari non contrôlé. L’insertion du Carousel dans
   un BDC Texte n’est pas incluse dans la version séquentielle de la
   spécification ; son inclusion avant la clôture du POC reste à décider.

6. **Construire la Page Diapo (tranche 8).** Avant le builder, fixer quels BDC
   une page Diapo autorise et si elle reçoit un Carousel par défaut ou reste
   vide. Puis construire la page sans scroll et son builder distinct, selon le
   comportement de voix et d’avancement déjà décrit dans le plan, et vérifier
   le player réel.

7. **Accepter le POC au complet (tranches 6 et 9).** Rejouer le parcours auteur
   et player, vérifier le fonctionnement mobile, la persistance, l’organisation,
   les ancres, Quiz, Évaluation, Carousel et Diapo, puis lancer typecheck,
   tests, build et contrôles navigateur. L’ouverture du player dans une fenêtre
   distincte est reportée à cette acceptation finale ; la preview actuelle en
   modale est déjà vérifiée.

## Décisions à reprendre avant les tranches concernées

- Pour Diapo : quels BDC sont autorisés et quel contenu est créé par défaut ?
- Pour les icônes Image et Vidéo de la barre de page : créent-elles un BDC vide
  ou ouvrent-elles le choix du média ? Le dépôt direct depuis fichier ou
  catalogue reste le parcours existant pour créer/attacher un média, un BDC et
  une ancre.
- Pour les documents persistés avec un ratio Carousel personnalisé : convertir
  vers le ratio prédéfini le plus proche, ou vers 16:9 ?
- L’insertion du Carousel dans un BDC Texte est-elle requise pour fermer le
  POC ou reste-t-elle après ? La spécification actuelle ne couvre que l’ajout
  à la suite d’une page Flux.

## Éléments reportés

- La lecture dans une fenêtre distincte se traite à l’acceptation finale ; la
  modale demeure le parcours courant jusque-là.
- La politique alternative de navigation à rebours aux frontières de chapitre
  est post-POC.
- Pause/reprise locale du Carousel et édition des presets sont hors de la
  version actuelle.
