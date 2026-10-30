# Elcé — plan Sommaire et profils

**Statut : En cours — prérequis exclusifs, effet de Visibilité Masquer/Verrouiller
et flag de configuration du profil intégrés et vérifiés par tests, typecheck et
build. Le parcours navigateur persistant et la preview réseau restent à
vérifier.**

Les comportements vérifiés sont décrits dans la
[spécification Sommaire et profils](../specs/summary-profile-spec.md).

## Portée

Réaliser dans Elcé le Sommaire unique à deux présentations, le profil initial,
les contraintes de profil et de lecture, les étiquettes de profil et la
consultation de test persistante de l’auteur.

Qualifications dynamiques, variantes grammaticales, ACL et gestion d’un lot
d’utilisateurs restent différées. Le détail fonctionnel accepté reste dans le
[plan de construction](2026-10-01-elce-construction-plan.md#extension-sommaire-profils-et-contraintes).

## Contrats à conserver

- Le document auteur reste détenu par XState ; ses changements passent par les
  commandes, l’historique et la persistance existants.
- La consultation, ses valeurs, sa progression et ses réponses restent
  séparées du document et de son Undo.
- Sighty reste propriétaire des routes et gardes. Une projection filtrée
  commune alimente le Sommaire, la navigation, les scènes et l’Évaluation.
- Les médias, ancres, Questions et Graphes gardent leurs propriétaires Elcé.
  Les filtres ne modifient jamais le document auteur.
- Aucun changement du cœur CodPlay n’est inclus. Si le raccord public du
  composant externe l’exige, suspendre cet item et ouvrir son plan propriétaire
  avant toute modification.

## Décisions acceptées et formats internes retenus

### Présentation de la page Sommaire — accepté le 30 octobre 2026, En cours

- Pour le Sommaire racine du lecteur : présenter les entrées en liens sans
  soulignement, avec une surbrillance au survol et les couleurs sémantiques du
  document.
- Aligner les titres de chapitre dans la première colonne et les titres de
  page dans la seconde. Respecter « Niveaux seuls » / « Pages et niveaux » :
  « Niveaux seuls » affiche uniquement les chapitres dans le Sommaire, y compris
  dans le menu latéral ; les pages autonomes sont masquées. « Pages et niveaux »
  affiche les pages sous leur chapitre ou à la racine.
- Le réglage « Niveaux seuls » était visible dans l’éditeur, mais le document
  transmis au lecteur portait encore `displayMode: pages`. Après réapplication
  du changement, le document synchronisé portait `chapters` et la preview réelle
  affichait huit titres de chapitre et aucun titre de page.
- La page Sommaire n’affiche le titre que dans l’en-tête global du lecteur. Son
  contenu ne répète pas ce titre. Les chapitres portent à gauche une icône de
  progression : cadenas si l’accès au chapitre est bloqué, œil plein quand
  toutes ses pages retenues sont terminées, œil contour quand au moins une mais
  pas toutes le sont ; sans page terminée, aucune icône de progression.
- Les icônes utilisent l’état existant `finishedPages` et les gardes d’accès
  existantes. Elles restent à l’extérieur du flux du texte (`list-style-position:
  outside`). Aucun état de lecture parallèle n’est ajouté.
- Les tests ciblés vérifient le changement du sélecteur et l’absence de liens de
  page dans la racine et le menu, les quatre états de progression et le titre
  unique. La preview réelle confirme l’œil contour du chapitre partiel, le titre
  unique et l’alignement extérieur de l’icône. La spécification a été mise à jour.
  La validation visuelle des deux colonnes, du survol et de la palette en mode
  `pages` reste à faire.
- À 800 px et moins, le style générique mobile réappliquait deux colonnes aux
  rangées `chapters`, malgré leur classe une colonne. Une règle plus spécifique
  conserve désormais une colonne pleine largeur. Le test ciblé passe ; Brave
  confirme à 390 px que les rangées et leurs titres mesurent 318 px et que la
  page ne déborde pas horizontalement. La validation du rendu `pages` reste
  ouverte.
- En colonne étroite, la marge négative de l’icône la plaçait hors de la zone
  visible du contenu. Les liens de chapitre réservent maintenant une gouttière
  interne à l’icône positionnée hors du flux du texte ; les titres statiques
  utilisent le même placement. À 390 px, Brave confirme l’icône entièrement
  visible dans la zone de défilement et aucun débordement. Les 58 tests ciblés
  passent, dont le cas du titre statique.

### Bouton Sommaire dans la barre de navigation — accepté le 30 octobre 2026, En cours

- Ajouter le bouton « Sommaire » à côté de Précédent/Suivant. C’est un raccourci
  supplémentaire ; l’action Sommaire existante du menu reste disponible.
- Afficher le bouton uniquement quand « Afficher comme page » et « Accès au
  sommaire dans la navigation » sont cochés. Le second réglage reste désactivé
  si le premier ne l’est pas. Lorsqu’il est coché, le bouton interrompt la page
  en cours et ouvre le Sommaire, même si la page n’est pas terminée. Lorsqu’il
  est décoché, l’accès existant du menu conserve sa garde de fin de page.
- Implémentation ajoutée dans le builder de navigation : le bouton émet
  l’événement Sommaire existant et le layout le masque hors d’une page de
  contenu. Le lecteur masque aussi Précédent lorsqu’il est désactivé. Des zones
  de grille explicites gardent Suivant à sa largeur normale quand le bouton
  Sommaire est masqué.
- Les 71 tests ciblés des builders de scénario et de composition, le typecheck
  et la preview réelle passent. Sur la page Sommaire, Brave confirme qu’il ne
  reste que Suivant, à 104 px dans la fenêtre testée ; Précédent et Sommaire
  sont absents de l’arbre accessible. Le module reste En cours pour les autres
  validations visuelles listées plus haut.
- Sur la page Sommaire, masquer aussi « Précédent » lorsqu’il n’a aucune
  destination. Quand le bouton Sommaire est masqué, la grille libère sa colonne
  afin que « Suivant » conserve sa largeur de bouton.
- Réutiliser le routage Sommaire et sa garde existants. Valider la présentation
  et le clic dans la composition lecteur et le vrai lecteur, puis transférer le
  contrat vérifié à la [spécification Sommaire](../specs/summary-profile-spec.md#collecte-et-projection-de-lecture).

1. **Document existant. Décision acceptée :** aucune compatibilité legacy en
   phase de construction. Passer en v5 sans migration depuis v4 ; si nécessaire,
   réinitialiser la base de test et recréer le document. Le lecteur n’accepte
   que le modèle courant.
2. **Composants externes.** Raccord appliqué : liste du Sommaire et Formulaire
   Profil sont des scènes enfants CodPlay déclarées dans le graphe Sighty et
   montées dans leurs `slot`. Le Sommaire reçoit la projection retenue et émet
   des intentions routées par Sighty ; le Formulaire publie les valeurs
   validées au même contexte. Les tests de composition couvrent le montage et
   la destruction. Aucun changement du cœur CodPlay.
3. **État de consultation. Décision acceptée :** stockage serveur, séparé du
   document et de son historique. Un seul état de test auteur est rattaché au
   projet. La preview réseau lit et enregistre cet état. Une table SQLite et
   une route API dédiées le portent ; seule cette route autorise l’écriture
   depuis l’origine exacte de preview.
   Les mutations du projet et des médias restent refusées depuis cette origine.
   Le stockage utilise une ligne par projet avec état JSON versionné et entier
   `revision`. GET renvoie l’état et un ETag ; PUT exige `If-Match`, incrémente
   la révision de façon atomique, et répond `412` en cas de conflit sans écraser
   la version persistée. L’état initial absent est `{ schemaVersion: 1 }` à la
   révision 0. Le client recharge la valeur serveur avant de proposer une
   nouvelle écriture.
4. **Références et règles.** Le principe des références stables et de
   l’héritage par famille est vérifié dans le modèle courant. Les identifiants
   de propriété et de choix survivent au renommage. Décision
   acceptée : refuser la suppression ou le changement de type qui casse des
   références, et montrer à l’auteur leurs usages. Une propriété contient un
   identifiant stable, un nom interne, un libellé, un type (`text`, `number`,
   `choice-one`, `choice-many`), le caractère requis, une valeur par défaut
   optionnelle et, pour les choix, des options à identifiants stables. La liste
   des champs du Formulaire référence ces propriétés par identifiant.
5. **Prérequis — intégré.** Le refus d’une dépendance explicite vers un chapitre
   exclu est accepté. Une règle qui crée un cycle est refusée et montre à
   l’auteur la chaîne de chapitres à corriger. Chaque cible choisit « Précédent »
   ou un ou plusieurs chapitres nommés ; ces choix sont exclusifs, et tous les
   chapitres nommés doivent être terminés. Dans l’éditeur, `-` signifie ignorer
   et retire le prérequis. Seuls les chapitres cibles cochés reçoivent la règle.
6. **Sommaire.** Le document contient un unique objet `summary` : titre,
   description, média de fond optionnel, affichage du menu, affichage à la
   racine, mode `chapters | pages`, accès permanent et destination de fin
   `next | summary`.
7. **Étiquettes.** Une référence dans le texte est un nœud inline Tiptap avec
   attribut `profilePropertyId`. Son HTML statique sérialisé est un `span`
   portant `data-elce-profile-property`; l’identifiant, jamais le libellé, est
   la référence enregistrée. Le lecteur résout ce marqueur depuis le profil.
8. **État test.** La ligne serveur contient `schemaVersion`, `profileEnabled`,
   `profileValues` indexées par identifiant stable, les pages terminées, les
   réponses validées et les états d’évaluation. Sa révision HTTP est séparée du
   JSON. Les RAZ du profil et de la progression restent des opérations
   indépendantes.
9. **Visibilité — décision acceptée et appliquée.** Chaque cible porte
   une liste ordonnée de conditions ; chaque condition associe une propriété,
   une comparaison typée et une valeur. Une propriété peut apparaître plusieurs
   fois. Le connecteur ET ou OU s’applique entre deux conditions ; ET est
   prioritaire sur OU. La règle locale d’une page ou d’un BDC remplace toute la
   liste héritée. Sans règle locale, la cible hérite de la règle la plus proche.
   Enregistrer zéro condition supprime la règle locale et rétablit l’héritage.
10. **Accès à la suite des pages — décision acceptée et appliquée.** Le réglage
    global `endpage | free` figure dans les paramètres du Sommaire ; le défaut
    `endpage` conserve le comportement actuel. `free` autorise Suivant et l’accès
    direct aux pages sans attendre leur fin. La visibilité, les prérequis de
    chapitre, l’évaluation et le garde du BDC Résultat restent actifs. Réutiliser
    les gardes Sighty `canLeavePage` et `PAGE_ACCESS`. Les tests du builder et de
    la composition vérifient le maintien de ces contraintes en mode libre.

Ces formats sont des choix internes pour avancer et seront soumis à relecture.
Ils ne changent pas les comportements acceptés listés dans le plan de
construction.

## Étapes

1. **Modèle et compatibilité — intégré, vérifié par tests.** Document v5 sans
   migration v4.
   - Ajouter au document les réglages uniques du Sommaire, les propriétés et
     choix du profil, et les contraintes héritées. Séparer les propriétés des
     champs affichés afin qu’une propriété puisse être alimentée plus tard par
     une qualification sans moteur de qualification dans cette tranche.
   - Passer les changements par les commandes et l’historique XState.
   - Valider l’aller-retour du document neuf dans le modèle courant, les
     stockages local et serveur, Undo/Redo, renommage et déplacement sans casser
     les références. Ne pas migrer les documents v4 ; réinitialiser la base de
     test uniquement si ses données empêchent ce parcours propre.

2. **Règles et projection de consultation — intégrées, tests unitaires et
   composition passés.**
   - Résoudre valeurs par défaut, absence et listes de conditions de Visibilité
     (ET prioritaire sur OU, héritage par remplacement de liste) ; appliquer
     profil puis prérequis de lecture.
   - Produire une seule projection ordonnée pour pages racine, chapitres,
     pages, BDC directs, enfants Carousel et ancres.
   - Retirer les Carousels, pages et chapitres vides de cette projection, sans
     progression fictive ; conserver le document source intact.
   - Faire calculer gardes Sighty et Évaluation sur les mêmes pages et
     Questions retenues. Une règle générale de chapitre précédent vise le
     précédent chapitre retenu.
   - Vérifier racine/enfant, masquage, exception, dépendance générale ou
     explicite, ordre, pages vides et score ; refuser les cycles avec leur
     chaîne de chapitres, et une dépendance explicite vers un chapitre exclu.
     Vérifier l’invalidité d’une scène mise en cache quand ses contenus ou
     étiquettes changent.
   - Vérifier les opérateurs par type, la normalisation texte (casse et espaces
     de bord), la règle de choix « au moins une correspondance » et le fait
     qu’une valeur absente ne satisfait aucune condition.

3. **Configuration auteur — fonctions intégrées ; changements structurels encore en attente.**
   - Ajouter l’accès aux réglages uniques du Sommaire dans l’éditeur.
   - Éditer titre, description, fond, présentations menu/racine, niveaux/pages,
     accès permanent et destination de fin de chapitre.
   - **Appliqué et vérifié :** le réglage général « Accès à la suite » propose
     `endpage` ou `free`, avec `endpage` par défaut. La migration SQLite dédiée
     complète les réglages existants auxquels cette clé manque, sans écraser
     une valeur déjà choisie.
   - **Décision acceptée et appliquée :** le flag global
     `ELCE_FEATURE_FLAGS.summaryProfileEditing` dans
     `src/config/feature-flags.ts`, actif par défaut,
     autorise ou masque l’édition du profil et des contraintes. Désactivé, seuls
     les réglages généraux du Sommaire restent visibles ; les propriétés et
     règles déjà enregistrées restent intactes. Ce flag global de configuration
     n’implémente pas encore les ACL.
   - **Décision acceptée et appliquée :** « Image de fond » réutilise le
     contrôle média du Quiz ; il accepte les images, leur dépôt, leur aperçu,
     leur retrait et les références d’image du catalogue. L’import suit la file
     média existante. Validé par les tests ciblés, le typecheck et le build.
   - **Décision acceptée, bouton nav en cours :** « Accès au sommaire dans la
     navigation » affiche le raccourci Sommaire dans la barre de navigation ;
     ce raccourci interrompt la page en cours et ouvre le Sommaire. La case
     dépend de « Afficher comme page ». Le lien du menu conserve sa garde de fin
     de page quand cette option est décochée.
   - **Décision acceptée et appliquée :** « Afficher comme page » place le
     Sommaire en première page du parcours et rejoint la séquence
     Précédent/Suivant ; le contrat et les preuves sont dans la spécification.
   - **Décision acceptée et appliquée :** le bouton global « Enregistrer »
     soumet aussi les deux familles de contraintes ; les autres réglages sont
     déjà appliqués par les commandes documentaires existantes. Il fonctionne
     sans cible cochée quand aucune contrainte n’est modifiée. Si la validation
     réussit, l’écran revient au scénario ; sinon il reste ouvert et affiche
     l’erreur.
   - Définir, ordonner et éditer propriétés, choix, défauts, champs du profil,
     contraintes et étiquettes par les façades et commandes existantes.
   - **Décision acceptée et appliquée — sélection des cibles :** cocher ou
     décocher un chapitre coche ou décoche aussi toutes ses pages. Sélectionner
     des pages directement garde la cible chapitre décochée et la marque
     indéterminée tant qu’au moins une page l’est, même si toutes le sont ; une
     page reste donc sélectionnable sans sélectionner la cible chapitre. Une
     contrainte de profil enregistrée après un clic sur le chapitre s’applique
     au chapitre et à ses pages ; la règle du chapitre s’applique aux pages
     créées ensuite. Les prérequis de lecture restent limités aux chapitres
     cochés.
     Conserver les valeurs mixtes, l’héritage, les exceptions locales et le
     remplacement d’une règle de même famille.
   - **Décision acceptée et appliquée — prérequis :** remplacer l’action et le
     sélecteur de chapitre unique par une liste multisélection (`-`,
     « Précédent », puis les chapitres). « Précédent » est exclusif ; un ou
     plusieurs chapitres nommés sont tous requis. `-` seul signifie ignorer et
     supprime la règle locale. Une sélection de pages ne cible jamais les
     prérequis. Les tests couvrent l’exclusivité, les chapitres multiples,
     l’obligation de terminer chacun d’eux, les cycles par dépendance
     secondaire ou « Précédent » et le rejet d’une dépendance vers un chapitre
     filtré.
   - Renommer le panneau droit « Contenus ». Ajouter l’onglet « Profil »,
     visible uniquement lorsqu’un champ textuel compatible a le focus et
     qu’au moins une propriété existe.
   - Garder un seul contrôle d’insertion des propriétés de profil comme
     variables du contenu. Retirer l’accès global actuel ; réutiliser le contrat
     de cible et les références stables d’étiquette existants.
   - Le panneau « Profil » contient l’unique contrôle d’insertion. Les champs
     simples reçoivent `{{profile:<id>}}` ; Section insère le nœud Tiptap avec
     l’identifiant stable. L’onglet disparaît hors contexte pertinent.
   - Le bouton « Sommaire » et le bouton « Test auteur » de la preview partagent
     l’icône Lucide List.
   - Tests : [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx),
     [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx),
     [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
     et [`popup-player.test.tsx`](../src/app/player/popup-player.test.tsx).
   - **Décision acceptée et appliquée :** conserver les
     réglages de présentation du Sommaire et la définition des propriétés dans
     leurs sections. Présenter la zone de contraintes en deux colonnes : à
     gauche, l’arbre ordonné des pages et chapitres du scénario avec une case à
     cocher par ligne et la même indentation que le Sommaire ; à droite,
     l’édition des contraintes, désactivée tant qu’aucune cible n’est cochée.
     L’arbre n’expose aucune action d’ajout, déplacement ou suppression, et ne
     liste pas les BDC. L’édition des BDC reste dans leur page ; les contraintes
     BDC déjà enregistrées sont conservées sans être éditables ici. Un unique
     bouton « Enregistrer » en haut de l’écran valide les contraintes de profil
     et de lecture, puis revient au scénario ; il reste utilisable sans cible
     cochée pour terminer l’édition des autres réglages.
   - Tests automatisés de la sélection de toutes les pages par le chapitre,
     de la sélection directe de pages sans cocher la cible chapitre, de
     l’exception locale dans un chapitre à une page, de l’application aux pages
     présentes et de l’héritage vers une future page passés dans
     [`summary-profile-settings.test.tsx`](../src/app/remix/workspace/summary-profile-settings.test.tsx).
     Le test vérifie aussi que les deux groupes restent rendus mais désactivés
     sans cible, puis que leurs commandes s’activent après sélection d’un
     chapitre. La multisélection présente `-`, « Précédent » puis les chapitres.
   - **Décision acceptée et appliquée — présentation compacte :** les colonnes
     Sommaire et Contraintes sont des panneaux flex de même hauteur sur grand
     écran et s’empilent sous 700 px. Le cadre extérieur du formulaire et celui
     de la condition sont supprimés ; seuls les groupes Profil et Prérequis
     restent encadrés. Les explications redondantes sont retirées. L’éditeur
     de Visibilité utilise des lignes compactes ; le sélecteur de prérequis est
     une liste multisélection. Vérification Safari sur Projet 1 :
     hauteurs égales mesurées à 1024 px, panneaux empilés à 600 px, champs
     conditionnels cachés puis affichés par leur action.
   - **Décision acceptée et appliquée — Visibilité :** le sélecteur « Action »
     est supprimé. Chaque ligne édite une propriété, une comparaison typée et
     sa valeur ; la colonne de comparaison est plus étroite, et la corbeille
     reste compacte au bord droit. Les comparaisons de choix s’affichent `=` et
     `≠`. ET ou OU relie chaque paire de lignes, avec ET prioritaire. Une icône
     supprime une ligne, une autre en ajoute une. Une règle locale
     remplace toute la liste héritée ; supprimer toutes les lignes retire la
     règle locale et rétablit l’héritage.
   - **Décision acceptée et appliquée — effet de Visibilité :** si les
     conditions échouent, l’auteur choisit « Masquer » ou « Verrouiller ».
     « Masquer » garde le comportement actuel. « Verrouiller » garde le
     chapitre ou la page visible dans le Sommaire avec une icône cadenas et
     bloque son ouverture jusqu’à ce que la condition soit remplie. Ce réglage
     concerne seulement les cibles chapitre et page de cet éditeur ; les BDC
     sont hors périmètre du Sommaire. Le lecteur conserve la cible et son
     contenu dans sa projection, puis la garde de page bloque les routes ; les
     tests de composition vérifient le cadenas et le refus d’ouverture. Une
     page verrouillée demandée au démarrage retombe sur le Sommaire racine s’il
     est activé, sinon sur la première page accessible.
   - Vérifications ciblées : répétition d’une propriété, ET prioritaire dans
     les deux ordres ET/OU, remplacement complet par une règle locale et retour
     à l’héritage après suppression de toutes ses conditions. Validation
     complète le 15 octobre 2026 : 51 fichiers et 374 tests, typecheck et build
     réussis. Safari MCP sur Projet 1 confirme que cocher un chapitre coche
     ses pages et active les contraintes, puis que tout décocher les désactive.
     La règle Verrouiller reste vérifiée par les tests de composition.
   - Acceptation : ordre et indentation identiques à la hiérarchie du scénario ;
     seules les pages de scénario et les chapitres apparaissent ; aucune action
     de structure ni cible BDC n’est visible ; cocher un chapitre sélectionne
     ses pages sans confondre les cibles chapitre/page, et les pages sélectionnées
     directement signalent l’état partiel du chapitre ; les cases
     activent/désactivent l’éditeur ; l’enregistrement d’un chapitre s’applique
     aux pages présentes et aux pages créées ensuite ; un seul enregistrement
     met à jour les deux familles de règles et revient au scénario, y compris
     sans cible cochée si aucune règle ne change ; les deux panneaux sont de
     même hauteur en grand écran puis empilés sur petit écran, et les champs
     éditeur de Visibilité et les règles de lecture restent indépendants ; les
     prérequis ne s’appliquent qu’aux chapitres sélectionnés.
   - Tests passés : lignes de Visibilité, connecteurs ET/OU avec priorité ET,
     répétition d’une propriété, remplacement complet par une règle locale,
     héritage sans règle locale, retour à l’héritage après suppression de toutes
     les conditions et conservation des règles BDC non éditables ici.

4. **Collecte du profil et démarrage lecteur — intégrés, tests de composition
   passés.** Le Formulaire enfant est monté dans le `slot` Sighty ; les changements
   de champs sont conservés et une validation acceptée route vers le lecteur.
   - Construire la page de collecte multi-propriétés avec validation globale,
     champs obligatoires/facultatifs, défauts et valeurs absentes ; aucun
     résultat juste/faux ni score.
   - Après validation, fixer le profil pour la consultation. Ouvrir le
     Sommaire racine s’il est activé, sinon la première page retenue.
   - Accepter texte, nombre, choix simple/multiple, erreurs, défauts, absence,
     validation unique et admission Sighty.

5. **Sommaire lecteur — intégré ; affichage du menu vérifié sur ordinateur et
   mobile le 30 octobre ; page de Sommaire en tête du scénario et de la lecture,
   navigation retour/départ vérifiées le 30 octobre. Les autres parcours
   navigateur restent ouverts.**
   - Correction « Afficher le menu » terminée : 79 tests ciblés, 526 tests
     Elcé, typecheck, build et Brave passent. Contrat et preuves transférés à
     la [spécification Sommaire](../specs/summary-profile-spec.md#collecte-et-projection-de-lecture).
   - « Afficher comme page » : 87 tests ciblés, la suite Elcé complète
     (76 fichiers, 529 tests), typecheck, build et `git diff --check` passent.
     La composition réelle vérifie l’entrée fixe d’édition, le début Sommaire →
     première page, le compteur, Précédent/Suivant avant la fin de page et le
     parcours standard quand la case est désactivée. Brave confirme page 1/3,
     page 2/3, puis retour à 1/3.
   - Le composant externe est monté dans le `slot` persistent ; les tests
     vérifient le montage, les entrées, le lien du menu et la route vers la scène
     racine dans le slot contenu.
   - Alimenter le menu et la page Sommaire depuis la même projection et les
     mêmes décisions d’accès. Quand elle est activée, elle précède les pages
     dans la lecture et la séquence Précédent/Suivant.
   - Afficher une liste défilante en colonnes sur une page, sans pagination.
     En « niveaux seuls », afficher uniquement les chapitres ; un chapitre ouvre
     sa première page retenue si elle est accessible.
   - Accepter retour de chapitre, accès permanent, entrées masquées/verrouillées,
     commandes clavier, focus, longues listes, tailles de viewport et destruction
     sans écouteurs résiduels. Le retour de fin de chapitre vers le Sommaire
     n’est disponible que si sa présentation racine est activée.
   - **Appliqué et vérifié :** `endpage | free` utilise les gardes de sortie et
     d’accès existantes. `free` retire l’attente de fin de page pour Suivant et
     les accès directs, tout en gardant les règles de Visibilité, les prérequis
     de chapitre et les gardes d’Évaluation / BDC Résultat.

6. **Étiquettes de profil — intégrées, tests d’édition et de projection passés.**
   - Projeter les références stables dans les titres et champs textuels, y
     compris Sections Tiptap, Cartes et Questions ; garder l’étiquette dans le
     document auteur.
   - Résoudre les valeurs dans la scène et les titres au moment prévu par le
     contrat d’entrée Sighty. Une valeur absente sans défaut donne un texte vide.
   - Accepter renommage, texte littéral, caractères spéciaux, formatage Tiptap,
     ancres, réadmission, seek et reconstruction ciblée du cache.

7. **Utilisateur de test auteur et restitution — intégrés ; tests API, SQLite,
   session et player passés.** La vérification sur téléphone reste à faire.
   - Persister séparément profil, progression, réponses et réglages de test sur
     le serveur, dans un état distinct du document.
   - Ajouter la modale auteur : reconfiguration, activation/désactivation du
     profilage, RAZ profil et RAZ progression indépendantes.
   - Réadmettre les réponses dans les contrôles sans rejouer leur validation.
     Garder une réponse après changement de libellé ; invalider seulement la
     réponse incompatible et ses résultats si choix, identités ou correction
     changent.
   - Accepter fermeture/réouverture sur l’éditeur, la popup locale et le
     téléphone ; vérifier deux écritures concurrentes, les deux RAZ,
     reconfiguration sans RAZ et page éditée exclue sans l’afficher.

8. **Acceptation et clôture — tests automatisés terminés ; parcours navigateur
   et réseau restant.**
   - Exercer la composition réelle Sighty/CodPlay et les frontières
     document, commandes, stockage serveur, scène, Questions, Évaluation et
     popup.
   - Couvrir Play, navigation directe/précédente/suivante, seek, relecture,
     reset, resize, cache, persistance et cycle de vie selon les étapes touchées.
   - **Vérifié :** défaut `endpage`, accès libre aux pages ordinaires et maintien
     des contraintes de Visibilité, des prérequis et du BDC Résultat.
   - Exécuter les suites Elcé pertinentes, typecheck, build et navigateur ; les
     tests possèdent leurs propres documents et valeurs. Les 51 fichiers
     donnent 374 tests réussis dans l’exécution complète, avec le test SQLite
     exécuté grâce à l’accès autorisé à la boucle locale. Typecheck et build
     passent. Safari MCP sur Projet 1 vérifie que le clic sur « Chapitre 1 »
     coche ses deux pages, active les contraintes et que tout décocher les
     désactive. Les contrôles restent dans le rendu SPA. Safari confirme aussi
     le titre « Contenus » et le bouton « Sommaire » avec son icône. Le document
     est visible, mais l’application affiche « Lecture seule » et `#elce-main`
     est inerte ; la saisie et l’enregistrement ne sont donc pas vérifiés en
     direct.
     Depuis le téléphone,
     vérifier la lecture et l’écriture de l’état test, puis confirmer le refus
     des écritures document et média.
   - Après vérification, transférer les contrats et preuves dans les
     spécifications concernées, actualiser le statut du plan de construction,
     puis retirer ce plan et les notes préparatoires devenues inutiles.

## Gate de réalisation

Les étapes et raccords ci-dessus sont acceptés. Les formats internes sont
provisoires jusqu’à la relecture de l’auteur et ne bloquent pas l’intégration.
Toute divergence avec les spécifications existantes rouvre le contrat concerné
avant le code. Les spécifications ne décrivent que les comportements vérifiés.
