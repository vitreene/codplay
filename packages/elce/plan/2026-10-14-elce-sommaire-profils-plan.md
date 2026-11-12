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

### Position du Sommaire dans la racine

- Décision acceptée, non implémentée : considérer le Sommaire comme une page
  racine déplaçable parmi les pages et chapitres de ce niveau. Il n’est plus
  nécessairement la page de lancement ; son placement dans un chapitre est exclu
  du périmètre actuel.
- Écart actuel : la [spécification Sommaire](../specs/summary-profile-spec.md#collecte-et-projection-de-lecture)
  décrit une entrée fixe en tête et une page 1 imposée. Conserver ce contrat
  vérifié dans la spécification jusqu’à réalisation et validation du correctif.
- Action à réaliser : adapter l’ordre documentaire, les commandes et les
  invariants d’organisation, le déplacement dans l’éditeur et la génération du
  parcours/départ dans les propriétaires Learning existants. Préserver les accès
  au Sommaire et la collecte du profil. Ce correctif général est distinct du mod
  Quiz Hunt ; il ne doit pas être compensé dans ce dernier.
- Acceptation : placer une page d’accueil avant le Sommaire, déplacer le
  Sommaire à un autre emplacement racine, vérifier Undo/Redo et la restitution
  après sauvegarde/réouverture, puis le départ et les accès au Sommaire dans le
  lecteur réel. Aucun dépôt du Sommaire dans un chapitre.

### Conservation du profil de preview — implémentée localement le 3 novembre 2026,
acceptation en attente

- Après validation de la page Profil, enregistrer ses valeurs et son état
  soumis dans l’état test séparé du document. La fermeture puis la réouverture
  d’une preview ne redemande pas un profil déjà soumis et compatible.
- Le bouton de remise à zéro du profil efface aussi ces valeurs enregistrées
  et rouvre la collecte. Une définition modifiée qui exige des valeurs
  manquantes rouvre le formulaire en conservant les réponses encore compatibles.
- Cette conservation concerne le profil uniquement. La progression, les
  réponses Question, les états d’Évaluation et la navigation restent propres à
  la session de consultation.
- Le raccord d’écriture doit pouvoir fonctionner dans le popup local et la
  preview réseau sans autoriser cette dernière à modifier le reste de l’état
  test. Utiliser la ressource et la révision test existantes ; conserver le
  compare-and-swap.
- Brave, sur « Test Elcé — liens et date » : la soumission de « Profil test »
  a envoyé `PUT /test-state/profile` (`200`). Le `GET` suivant, révision 14,
  contient `profileSubmitted: true` et la valeur saisie, tout en gardant les
  pages terminées et la réponse Question existantes. Un nouvel appel à
  « Prévisualiser » a ouvert directement la page de contenu et y a résolu
  « Profil test » ; la page Profil n’est pas réapparue. Le premier essai avait
  reçu `404`, car l’API déjà lancée ne contenait pas cette route. Le redémarrage
  du serveur sur 5175/5181 a chargé la correction.
- La fermeture/réouverture du popup local est vérifiée. L’acceptation de la
  preview réseau, de la remise à zéro persistée et de la réouverture après
  ajout d’une propriété requise reste en attente ; le plan demeure En cours.
- Acceptation : valider le profil dans chacune des deux previews, fermer puis
  rouvrir, et confirmer l’accès direct au lecteur avec les valeurs conservées ;
  vérifier que la progression reste inchangée, que la remise à zéro est
  persistée et que l’ajout d’une propriété requise rouvre le formulaire avec
  les valeurs compatibles préremplies.

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
- L’ancienne implémentation du lecteur Elcé créait ce bouton dans la barre de
  navigation, le masquait hors d’une page de contenu et réutilisait l’événement
  Sommaire existant. Ses 71 tests ciblés, le typecheck et la preview réelle
  étaient passés avant la fusion.
- Le portage vers Learning avait omis ce bouton. Le raccord est rétabli le
  3 novembre 2026 dans le constructeur de navigation, la projection de
  présentation et l’action de rafraîchissement ; il réutilise l’événement et la
  garde Sommaire existants. La validation ciblée du code porté et le parcours
  dans le lecteur réel restent à faire ; les preuves d’avant fusion ne valident
  pas cette version. Le module reste En cours.
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
11. **Sommaires intermédiaires par BDC — décisions acceptées, réalisation en
    cours.** Le Sommaire intermédiaire est un BDC de liste seule, ajoutable aux
    pages Flux et Diapo ; ce n’est pas un nouveau type de page. Il n’a pas de
    titre ni de description propres. Le Sommaire principal et les BDC lisent et
    éditent le même réglage `displayMode` dans `SummarySettings`, via la commande
    documentaire existante ; aucun état parallèle n’est créé. Chaque vue
    fournit une portée à la projection commune. L’analyse du Sommaire principal
    part de la racine ; celle du BDC part du chapitre contenant sa page hôte,
    sans remonter vers les chapitres ancêtres. Sur une page racine, le BDC
    analyse tout l’arbre racine. Le mode `chapters` montre les chapitres un
    niveau sous le point de départ ; le mode `pages` ajoute les pages de cette
    portée. Le BDC peut proposer l’action « Retour au Sommaire principal » quand
    la route du Sommaire principal existe (`showAtRoot`). L’usage du BDC
    Sommaire dans la composition de lecture du Sommaire principal est accepté
    pour une évolution ultérieure et n’est pas inclus dans cette tranche.
    La navigation vers les pages listées réutilise les événements et routes
    Sighty existants. À la fin de portée, `next` continue selon l’ordre normal
    et s’arrête naturellement sans page suivante. Le retour automatique vers
    le BDC d’origine en fin de portée est différé par décision explicite ; la
    navigation `summary` existante du Sommaire principal reste inchangée. Le
    positionnement éditorial général des BDC est une amélioration Elcé distincte
    et n’entre pas dans cette tranche.
    **Direction acceptée pour une évolution ultérieure :** conserver la page de
    réglages du Sommaire et composer sa vue de lecture racine avec le BDC
    Sommaire. Une Carte BDC pourrait fournir le titre. Le type d’hôte racine et
    la source canonique du titre restent à décider ; cette composition n’est
    pas incluse dans la tranche BDC Sommaire.

Les décisions du BDC Sommaire ci-dessus sont acceptées pour la réalisation de
cette tranche. Les autres formats internes restent provisoires. Cette tranche
réutilise les contrats vérifiés listés dans le plan de construction et ne les
remplace pas.

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
   - **Décision acceptée, application en cours (3 novembre 2026) :** les
     réglages de « Présentation du Sommaire » s’appliquent immédiatement par
     commande documentaire. Une seconde partie « Sommaire et profil » regroupe
     les propriétés du profil et les contraintes de visibilité et de lecture.
     Son bouton « Enregistrer » est placé dans son en-tête sticky et ne valide
     que ces brouillons, regroupés dans une mise à jour de définition du profil.
     Sans modification des contraintes, il enregistre tout de même les
     propriétés. Après validation, l’écran revient au scénario ; en cas
     d’erreur, il reste ouvert avec les brouillons. Le bouton supérieur
     « Enregistrer » est retiré ; si l’édition du profil est désactivée, le
     titre garde une commande « Fermer ». Vérifier le placement sticky et le
     parcours réel d’enregistrement sur le document de test autorisé.
     - [x] Créer la partie « Sommaire et profil » et y déplacer le bouton
       « Enregistrer » dans un en-tête sticky.
     - [x] Laisser « Présentation du Sommaire » hors de cette soumission et
       garder une commande « Fermer » lorsque l’édition du profil est désactivée.
     - [ ] Vérifier dans l’éditeur réel que l’en-tête reste visible pendant le
       défilement de cette partie et que l’enregistrement conserve son circuit.
   - **Sélecteurs du formulaire — cause trouvée et correction en cours
     (3 novembre 2026) :** le document et le cache local conservaient bien
     `displayMode: pages`, mais le panneau remonté affichait la première option,
     « Niveaux seuls ». Le runtime monte la valeur du `<select>` avant ses
     options ; sans option marquée comme sélectionnée, le navigateur retient la
     première. Les options reflètent maintenant la valeur du document. Après
     réouverture du panneau sur « Test Elcé — liens et date », Brave affiche
     « Pages et niveaux », ainsi que les valeurs conservées « Fin de page »,
     « Ouvrir le chapitre suivant » et « Texte ». L’éditeur est ensuite passé en
     lecture seule après un refus `409` du renouvellement d’accès ; le test
     d’édition, de sauvegarde et de réouverture des sélecteurs reste à faire
     lorsque l’accès au document de test sera libre.
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
     bouton « Enregistrer » en haut de l’écran valide les propriétés du profil
     et les contraintes de profil et de lecture, puis revient au scénario. La
     « Présentation du Sommaire » s’applique immédiatement et ne dépend pas de
     ce bouton. L’enregistrement reste utilisable sans cible cochée si aucune
     contrainte n’a été modifiée.
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
   mobile le 30 octobre ; entrée Sommaire permanente dans le scénario, page de
   lecture en tête quand elle est activée, et navigation retour/départ vérifiées
   le 30 octobre. Les autres parcours
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
   - **Décision acceptée le 3 novembre 2026, application en cours — entrée du
     Sommaire dans le Scénario :** retirer le bouton Sommaire de la rangée
     d’actions en haut du panneau et conserver une entrée Sommaire permanente,
     toujours en première position de la liste du Scénario, même si
     « Afficher comme page » est décoché. Cette option continue uniquement de
     décider si le Sommaire ouvre le parcours lecteur comme première page.
     Présenter l’icône et le titre sur une même ligne. Quand l’auteur sélectionne
     une autre page ou un chapitre, fermer l’éditeur du Sommaire et afficher
     l’élément sélectionné. La spécification actuelle décrit encore l’ancienne
     règle conditionnelle ; elle sera mise à jour après validation intégrée.
     - [x] Retirer l’action Sommaire de la rangée supérieure et garder sa ligne
       à la première place du Scénario, quel que soit « Afficher comme page ».
     - [x] Fermer l’éditeur du Sommaire à la sélection d’une page ou d’un
       chapitre et présenter l’icône avec son titre sur la même ligne.
     - [ ] Vérifier dans l’éditeur réel la ligne persistante, le changement de
       sélection et le rendu horizontal de l’icône et du titre ; mettre ensuite
       à jour la spécification Sommaire et celle du Scénario.
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

7. **État de test auteur et restitution — En cours.** L’isolation du cache de
   consultation et l’absence d’écriture serveur depuis la preview sont
   appliquées et vérifiées dans l’écart du 27 octobre ci-dessous. La
   vérification du parcours sur téléphone reste à faire.
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

8. **Acceptation et clôture — En cours ; vérification sur téléphone restante.**
   - Exercer la composition réelle Sighty/CodPlay et les frontières
     document, commandes, stockage serveur, scène, Questions, Évaluation et
     popup.
   - Couvrir Play, navigation directe/précédente/suivante, seek, relecture,
     reset, resize, cache, persistance et cycle de vie selon les étapes touchées.
   - **Vérifié :** défaut `endpage`, accès libre aux pages ordinaires et maintien
     des contraintes de Visibilité, des prérequis et du BDC Résultat.
   - Exécuter les suites Elcé pertinentes, typecheck, build et navigateur ; les
     tests possèdent leurs propres documents et valeurs. La suite actuelle
     passe 504 tests sur 505 ; le test SQLite bloqué par `listen EPERM` passe
     seul avec accès à la boucle locale (16/16). Typecheck et build passent.
     Safari MCP sur Projet 1 vérifie que le clic sur « Chapitre 1 »
     coche ses deux pages, active les contraintes et que tout décocher les
     désactive. Les contrôles restent dans le rendu SPA. Safari confirme aussi
     le titre « Contenus » et le bouton « Sommaire » avec son icône. Le document
     est visible, mais l’application affiche « Lecture seule » et `#elce-main`
     est inerte ; la saisie et l’enregistrement ne sont donc pas vérifiés en
     direct.
     Depuis le téléphone, confirmer que la preview peut lire l’état test sans
     écrire les réponses ou la progression sur le serveur, puis confirmer le
     refus des écritures document et média.
   - Après vérification, transférer les contrats et preuves dans les
     spécifications concernées, actualiser le statut du plan de construction,
     puis retirer ce plan et les notes préparatoires devenues inutiles.

9. **BDC Sommaire — Fini.**
   - [x] Ajouter le BDC direct dans Learning et ses commandes, invariants,
     Undo/Redo et persistance. Le créer depuis le menu de page Flux ou Diapo ;
     respecter la limite Diapo d’un BDC de contenu plus son Avatar facultatif.
     Le BDC ne porte aucun texte propre.
   - [x] Ajouter son entrée d’édition et partager `displayMode` avec le
     Sommaire principal par `summary.settings.update`.
   - [x] Projeter la portée racine ou le chapitre de la page hôte sans inclure
     les chapitres ancêtres ; `chapters` affiche un niveau sous le point de
     départ et `pages` suit l’ordre des pages descendantes.
   - [x] Composer la liste via `BuildAdditionalBdc` pour Flux et Diapo. Les
     liens utilisent les routes Sighty existantes. L’action « Retour au
     Sommaire principal » utilise `MENU_SUMMARY` et n’existe que si
     `showAtRoot` active cette destination. Ne créer ni route locale, ni
     navigation parallèle, ni modification CodPlay.
   - [x] Différer le retour automatique vers le BDC d’origine en fin de portée,
     conformément à la décision acceptée. Ce report ne concerne pas le
     positionnement éditorial général des BDC, qui est une amélioration Elcé
     distincte et hors du périmètre de cette tranche.
   - [x] Ajouter les tests du projection builder, de l’éditeur, des commandes,
     des invariants, du cache, de la composition Player Flux/Diapo, d’Undo/Redo
     et de la persistance SQLite.
   - [x] Exécuter les suites concernées, dont l’intégration HTTP/SQLite avec
     l’accès loopback requis, ainsi que le build et le contrôle des frontières
     de modules.
   - [x] Vérifier le lecteur réel : rendu Flux et Diapo, navigation des pages,
     action conditionnelle vers le Sommaire principal, réglage `displayMode`
     partagé, et rendu mobile sans débordement horizontal.
   - [x] Aligner la spécification Sommaire et les spécifications Flux/Diapo sur
     les comportements vérifiés.

## Cache preview et état de consultation — appliqué et vérifié le 27 octobre 2026

Les sources de scènes Question restent neutres et réutilisables ; le circuit
Sighty restitue la réponse issue du contexte courant sans nouvelle validation.
La composition conserve la page active de Sighty lors d’une reconstruction ;
« Synchroniser » utilise la sélection de page de l’éditeur. La session de
preview garde réponses, profil, progression, évaluations et navigation sans
écrire l’état test sur le serveur. L’API de preview réseau lit l’état initial
et refuse le prévol `PUT`.

Preuves : [`player-preview-spec.md`](../specs/player-preview-spec.md),
[`question-bdc-spec.md`](../specs/question-bdc-spec.md) et
[`summary-profile-spec.md`](../specs/summary-profile-spec.md) décrivent le
contrat vérifié. Les tests couvrent réponses restaurées, modifiées et
supprimées en Flux/Diapo, seek, reset, synchronisation explicite et absence
d’écriture API. La validation typecheck/build passe ; Safari sur une base
temporaire a affiché la réponse en session, puis une preview rouverte sans
réponse, tandis que l’état serveur est resté vide à la révision 0. Le prévol
réseau `PUT` a reçu `403`.

La synchronisation permanente débrayable reste une étape ultérieure du
[plan de construction](2026-10-01-elce-construction-plan.md#lecture-dans-une-fenêtre-distincte--tranche-9-en-cours).

## Gate de réalisation

Les étapes et raccords ci-dessus sont acceptés. Les décisions du BDC Sommaire
sont relues et acceptées ; les autres formats internes restent provisoires et
ne bloquent pas l’intégration.
Toute divergence avec les spécifications existantes rouvre le contrat concerné
avant le code. Les spécifications ne décrivent que les comportements vérifiés.
