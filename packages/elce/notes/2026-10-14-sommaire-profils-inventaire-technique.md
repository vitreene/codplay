# Elcé inventaire des éléments techniques à préciser

## Objet et portée

Le besoin fonctionnel du Sommaire, du profil et des contraintes est cadré.
Il manque encore les noms et structures de certains objets, leur stockage,
les éléments d’interface et les contrats d’échange nécessaires à leur
réalisation. Cet inventaire les rend explicites pour préparer le plan détaillé.

Les intitulés des objets manquants désignent leurs rôles ; ils ne sont pas
des noms SQL, types TypeScript ou API déjà validés. Les décisions ouvertes sont
suivies dans le
[plan de construction](../plan/2026-10-01-elce-construction-plan.md#étude-des-raccords-sans-réalisation).
Le [cadrage](2026-10-14-sommaire-profils-contraintes.md) conserve les intentions
et l’[étude des raccords](2026-10-14-sommaire-profils-etude-raccords.md)
explique les circuits à réutiliser.

## Vocabulaire à stabiliser

| Terme | Sens retenu pour le cadrage | Précision technique manquante |
| --- | --- | --- |
| Projet | Document éditorial Elcé identifié et versionné. | Version du document enrichi et traitement des documents existants. |
| Propriété de profil | Donnée définie par l’auteur, utilisable dans une condition ou une étiquette. | Identifiant, terme, type, choix, défaut et présence dans la page Profil sous une forme sérialisée. |
| Champ de formulaire | Présentation d’une propriété choisie pour la saisie initiale. | Relation à la propriété, ordre et configuration de son rendu. Une propriété comme `grade` peut ne pas avoir de champ. |
| Valeur de profil | Valeur effective d’une propriété pour un utilisateur et un projet. | Clé de stockage, types JSON et représentation de l’absence. |
| Consultation | Parcours avec profil, progression et réponses. | Identité de l’état persistant, propriétaire actif, chargement et restauration. |
| Utilisateur de test | Utilisateur persistant réglable par l’auteur. | Liaison au projet et stockage des valeurs, réponses et réglages de test. |
| Condition | Comparaison simple donnant une décision d’accès. | Format, opérateurs sérialisés et association à la cible et à sa famille. |
| Règle héritée | Règle du projet ou du chapitre applicable à ses descendants. | Résolution effective et représentation d’une exception ou suppression d’exception. |
| Ensemble retenu | Contenus conservés pour la consultation après profilage. | Représentation dérivée commune aux builders, au Sommaire et à l’Évaluation. |
| Qualification | Alimentation future d’une propriété à partir d’un résultat, avec accès évolutif. | Place dans le modèle, distincte de la présence d’un champ ; moteur et règles de plages différés. |

Le terme auteur d’une propriété et son identifiant technique ne doivent pas
être confondus. Le renommage et les références imposent de fixer leur relation,
leur unicité et leur stabilité avant de définir le format des étiquettes.

## Tables et rattachements de stockage

### Tables existantes à réutiliser

Les migrations et l’[API de projets](../specs/project-api-spec.md) établissent
les tables éditoriales suivantes : `projects`, `chapters`, `pages`,
`scenario_entries`, `catalog_pages`, `media_resources`, `content_blocks`,
`content_block_placements`, `sections`, `questions`, `question_answers`,
`evaluation_result_branches`, `carousels`, `cards` et `statistical_graphs`.
Les anciennes tables `graph_categories`, `graph_series` et `graph_values`
ont été supprimées par la migration vers le JSON du Graphe.

Le choix d’une table supplémentaire doit représenter un objet métier ou un
besoin de persistance distinct. Les nouvelles options du projet ne justifient
pas à elles seules un second registre de projets, de pages ou de médias.

### Objets dont le stockage reste à définir

| Objet à enregistrer | Rattachement connu | Ce qui manque pour définir les tables |
| --- | --- | --- |
| Réglages Sommaire | Un ensemble unique par projet ; titre, description, fond, menu/racine, niveaux/pages, accès permanent et issue de chapitre. | Colonnes de `projects` ou détail lié ; rapport entre titre de lecture et nom actuel du document ; référence média du fond ; défauts des options. |
| Définitions des propriétés | Appartiennent au projet, indépendamment de leur présence dans le formulaire. | Nom et forme du stockage, clé stable, ordre, unicité du terme, type, caractère obligatoire et option d’affichage. |
| Choix des propriétés | Appartiennent à une propriété à choix. | Identifiants stables, ordre, libellés, retrait d’un choix encore référencé et rangement relationnel ou structuré. |
| Défauts des propriétés | Facultatifs ; vide prend le défaut, sinon reste absent. | Stockage typé du défaut et vérification de sa compatibilité avec le type et les choix. |
| Contraintes éditoriales | Projet, chapitre, page ou BDC ; familles profil et lecture. | Stockage de la cible, de la condition, de l’héritage et des exceptions ; unicité des règles applicables ; intégrité des références. |
| Registre utilisateur | Table `user` demandée ; anonyme en test, utilisateur existant fourni dans le mode définitif. | Identité minimale du test, liaison à l’identité fournie ultérieurement et cycle de création/suppression. Aucun registre de comptes n’est décidé. |
| Valeurs de profil | Valeurs utilisateur rattachées au projet dont les propriétés sont issues. | Clé utilisateur/projet/propriété, portée de leur conservation, format des valeurs et traitement d’une propriété supprimée ou retypée. |
| Progression | Pages réellement achevées, sans faits fictifs pour les contenus masqués. | Clés, forme relationnelle ou structurée, remise à zéro et traitement des pages supprimées ou déplacées. |
| Réponses validées | Références à la Question et aux choix sélectionnés. | Stockage des sélections, compatibilité avec la Question courante, invalidation ciblée et conservation des autres réponses. |
| États et résultats d’Évaluation | Machine métier existante ; résultats de test précaires. | Part d’état à conserver et à recalculer, rangement, liens aux réponses, invalidation des résultats dépendants. L’historisation définitive des résultats reste un chantier ultérieur. |
| Réglages de test auteur | Profilage activé/désactivé, modale, RAZ profil et progression. | Stockage de ces réglages ou durée de vie locale ; rattachement à l’auteur, au projet ou à l’utilisateur de test. |

Il reste à choisir le lieu de sauvegarde de l’utilisateur de test, la part du
cache navigateur et la source persistante partagée avec le popup. L’état de
consultation ne doit pas être rangé dans la sauvegarde du document éditorial.

## Formats de données manquants

| Format | Données ou comportement déjà requis | Décision de format à prendre |
| --- | --- | --- |
| Configuration Sommaire | Configuration unique, deux présentations, bloc défilant en colonnes, options de parcours. | Noms des champs, valeurs d’options, média référencé et valeurs par défaut. |
| Définition de propriété | Texte, nombre, choix multiple ou unique ; terme, libellé, obligation, défaut et présence sur la page Profil. | Type sérialisé, identifiant, valeurs autorisées, représentation des choix et de l’absence de défaut. |
| Valeur de profil | Texte, nombre ou choix sélectionnés ; une valeur absente ne satisfait aucune comparaison. | Valeur d’un choix unique et liste d’un choix multiple ; absence par clé omise ou valeur dédiée ; conversion du nombre depuis la saisie. Distinguer vide et zéro. |
| Condition de profil | Une comparaison ; texte `=`/`!=`, nombre `<`/`>`/`=`/`!=`, choix « est »/« n’est pas ». | Discriminateur du type, référence de propriété, opérateur, valeur comparée et option de correspondance. « Au moins une » est le seul critère exposé actuellement. |
| Prérequis de lecture | Chapitre précédent retenu ou chapitre explicitement désigné. | Distinction sérialisée entre relation générale et référence explicite, liste des références autorisées et diagnostic d’incohérence. |
| Règle par cible | Héritage et remplacement dans la même famille ; un chapitre masqué ferme tout son contenu. | Adresse de cible, familles, règle locale, absence de règle, exception et suppression d’exception. |
| Sélection auteur | Chapitre entier, rien ou partiel ; entier inclut les futures pages, partiel vise les pages choisies. | État temporaire, cibles explicites, exclusions et conversion en commandes ; aucune sélection ne doit être enregistrée comme règle ambiguë. |
| Projection du parcours | Identifiants et ordre conservés ; BDC, pages et chapitres vides retirés de la consultation. | Structure commune consommée par scénario, scènes, Sommaire et calculs ; dépendances permettant de réutiliser le cache. |
| Projection de liste | Chapitres/pages, titres, sélection active et accès ; menu et racine partagent la source. | Forme reçue par le composant externe, identités de ses entrées et représentation des verrous. |
| Validation de formulaire | Plusieurs champs, validation globale, défauts et types, sans score. | Forme des valeurs validées et erreurs par champ ; publication au scénario seulement après validation réussie. |
| Étiquette de profil | Référence stable dans tous les champs textuels ; absence remplacée par texte vide. | Représentation dans une chaîne simple et dans le JSON Tiptap, rendu éditeur, sérialisation du HTML exporté et résolution commune. |
| État de consultation | Profil, progression, sélections validées et états métier utiles. | Format persistant indépendant des objets runtime ; restauration et compatibilité avec la révision éditoriale courante. |
| Compatibilité d’une réponse | Libellés modifiés : conserver ; choix, identités ou correction modifiés : invalider la réponse et ses résultats dépendants. | Informations permettant cette comparaison sans invalider tout le test à chaque révision du document. |

La représentation actuelle `questionResults` contient des booléens par page.
Elle ne suffit pas à restituer les choix d’un Quiz ordinaire. Le
[contexte d’Évaluation](../src/domain/evaluation/evaluation-machine-types.ts)
conserve déjà des identifiants sélectionnés et attendus ; il ne constitue pas
le format générique des valeurs d’un formulaire.

## Éléments d’interface à préciser

### Auteur

| Élément | Contenu attendu | Ce qui manque |
| --- | --- | --- |
| Entrée Sommaire dans l’éditeur | Accès à ses réglages uniques au niveau projet. | Rattachement à la sélection XState, emplacement et remplacement de la vue centrale. |
| Éditeur du Sommaire | Titre, description, fond et options de présentation/parcours. | Contrôles, recours au catalogue média existant, défauts et cohérence du retour de chapitre avec la racine activée. |
| Liste de propriétés | Définition et ordre des propriétés du projet. | Ajout, modification, retrait, validation des termes et références, gestion des choix et de leurs défauts. |
| Option de présence dans la page Profil | Choix des propriétés proposées à la saisie. | Présentation et effet sur l’ordre du formulaire ; distinction avec une propriété alimentée ultérieurement par évaluation. |
| Sélection des cibles de règles | Arborescence, sélection entière/partielle et retrait d’éléments. | Gestes, clavier, état à trois valeurs et présentation explicite de « Tout le projet » sans sélection. |
| Panneau de règle | Une condition de profil ou un prérequis de lecture. | Sélecteurs dépendant du type, choix des références, édition des exceptions et indication de l’héritage. |
| Édition sur plusieurs cibles | Appliquer une même règle aux éléments sélectionnés. | Affichage des valeurs différentes, remplacement/retrait et granularité de la commande et de l’Undo. |
| Modale de test | Paramètres du profil, activation du profilage et deux RAZ indépendantes. | Point d’ouverture, validation, sauvegarde, actualisation du lecteur et traitement des erreurs de restauration. |
| Insertion d’étiquette | Choix d’une propriété dans tout contenu textuel. | Commande de barre, présentation du jeton, suppression, copier/coller et compatibilité entre champs simples et Tiptap. |
| Diagnostics auteur | Dépendance explicite incompatible, références supprimées, cas limite de conteneur vidé. | Localisation, message et accès à la correction ; politique de refus ou signalement lorsque la référence n’est plus valide. |

Les modifications éditoriales doivent passer par les façades et commandes
existantes et rejoindre le même historique documentaire. Les réglages du test
modifient la consultation, pas l’Undo du projet.

### Lecteur

| Élément | Contenu attendu | Ce qui manque |
| --- | --- | --- |
| Page Profil ou Formulaire | Plusieurs saisies et validation globale, aucune correction ni score. | Choix Quiz enrichi/Formulaire externe, rendu, erreurs, focus et cycle d’admission. |
| Liste externe du Sommaire | Composant dans un slot ; liste défilante, colonnes et stylage facilité. | Propriétés exactes de la classe/fonction, frontière CSS, dimensions, ordre visuel et ordre clavier. |
| Présentations menu et racine | Même configuration et mêmes décisions d’accès. | Instances de rendu et cycle de mise à jour ; titres, description et fond selon l’espace. |
| Retour au Sommaire | Option d’accès permanent ; retour de fin de chapitre si racine activée. | Commandes visibles, routes, gardes applicables et destination de retour dans la consultation. |
| États d’accès | Exclus masqués ; prérequis de lecture non satisfaits visibles et verrouillés. | Indication du verrou, comportement du clic, accessibilité et actualisation après achèvement ou restitution. |
| Page exclue en preview auteur | Exclusion signalée, modale accessible pour ajuster le test. | Présentation de ce diagnostic dans le lecteur et action d’ouverture de la modale. |
| Parcours sans contenu retenu | Aucune page ou chapitre à lire après filtrage. | Raccord à la présentation vide existante et commandes utiles, sans progression fictive. |

## Échanges et signatures à arrêter

Les entrées doivent rester dans le circuit d’admission Sighty. Il manque les
formes des messages propres à l’extension, pas un nouveau routeur.

| Échange | Base existante | Contrat qui manque |
| --- | --- | --- |
| Vue auteur vers document | Façades, `document.apply`, historique. | Noms et payloads des commandes de propriété, règle, configuration et étiquette ; validation et regroupement des gestes. |
| Formulaire vers scénario | Événements publics ou `runtime.dispatch`. | Message de collecte validée, valeurs, provenance et vérification de l’activité du formulaire. |
| Scénario vers liste externe | Présentation calculée avec les gardes Sighty. | Livraison de la projection et cycle d’actualisation sans abonnement survivant à la sortie. |
| Liste externe vers scénario | Routes déclarées et `runtime.dispatch`. | Intention de sélection par identité stable ; distinction entre sélection de chapitre, page et retour au Sommaire. |
| Contexte vers scène | `entry` ou envoi explicite par action Sighty. | Correspondance propriété/cible de contenu, moment d’injection et contrat de restitution sans nouvelle validation. |
| Auteur vers popup | Instantané documentaire et page éditée. | Transport de l’état ou de l’identité du test, activation du profilage, reconfiguration et RAZ ; source unique de l’état actif. |
| Client vers stockage utilisateur | Routeur, serveur et migrations existants. | Routes de lecture/écriture et réponses, gestion des erreurs, droits applicables et source persistante. Aucun chemin HTTP nouveau n’est encore fixé. |

Le [protocole popup actuel](../src/app/player/popup-preview-messages.ts)
transporte le document et la page sélectionnée. L’
[API actuelle](../specs/project-api-spec.md) expose le stockage des projets et
médias. Aucun de ces contrats ne peut être considéré comme déjà étendu aux
données utilisateur.

## Cycle de vie et intégrité à définir

- Fournisseur externe : création, montage dans le slot, actualisation,
  détachement et destruction ; le slot ne possède pas le cycle du contenu.
- Page Profil : admission, saisies en cours, validation réussie, sortie et
  éventuelle réadmission sans édition manuelle du profil lecteur.
- Test auteur : conservation des données lors d’une reconfiguration, départ
  du parcours reconstruit et distinction entre RAZ profil et RAZ progression.
- Cache : dépendances de profil et de références textuelles, réutilisation des
  scènes inchangées et reconstruction des seules scènes affectées.
- Références : propriété ou choix renommé, supprimé ou retypé ; page/chapitre
  déplacé ; Question rendue incompatible avec une réponse persistée.
- Restitution : restaurer les décisions d’accès et les sélections visibles
  sans rejouer une réponse utilisateur ni republier son résultat.
- Preview réseau : déterminer si la nouvelle persistance la concerne ; elle
  est actuellement en lecture seule. Le test auteur ne décide pas à lui seul
  cette extension de périmètre.

Le [contrat slot](../../codplay/specs/slot-component-spec.md) et le
[contrat Sighty](../../sighty/specs/authoring-library-spec.md) fixent les
frontières actuelles. Leurs signatures publiques ne doivent pas être
complétées par supposition ; toute évolution nécessaire doit être décidée
dans son plan avant code.

## Préparation et fonctions différées

La préparation immédiate doit permettre que les propriétés du profil existent
sans champ de formulaire et puissent être amendées plus tard dans le contexte.
La réalisation des qualifications, des plages de résultats et du dévoilement
évolutif est différée. Leurs tables éventuelles et messages ne sont donc pas
des prérequis SQL ou API déjà arrêtés pour la première tranche.

Les variantes grammaticales de blocs de texte, les ACL et la gestion d’un lot
d’utilisateurs de test restent aussi différées. Cet inventaire ne les transforme
pas en fonctionnalités à réaliser maintenant.

## Éléments à obtenir pour un plan exécutable

Les études doivent aboutir à un schéma de données et ses références, une
stratégie de version, une carte des interfaces et commandes, les contrats
d’échange et de montage, ainsi que les fixtures d’acceptation. Le
[plan actif](../plan/2026-10-01-elce-construction-plan.md#étude-des-raccords-sans-réalisation)
porte leur ordre, les décisions à relire et les gates ; les spécifications
ne recevront les comportements qu’après réalisation et vérification.
