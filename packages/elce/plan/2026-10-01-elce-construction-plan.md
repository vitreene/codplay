# Elcé — plan de construction

**Statut : fixe — ordre accepté ; réalisation du POC en cours.**

## Cadre retenu

- Elcé est une application métier distincte dans `packages/elce`. XState
  reçoit les commandes de l’application ; React rend son état.
- Le document et les médias sont conservés localement dans IndexedDB. Le POC
  porte un seul document et ne restaure pas la progression ni les réponses de
  lecture.
- La racine Sighty contient une liste ordonnée où pages et chapitres alternent.
  Les pages d’un chapitre restent sous ce chapitre. Déplacer une page reconstruit
  le scénario ; éditer une page reconstruit sa scène.
- CodPlay et Sighty portent la lecture et la navigation, en suivant la démo 5.
  Le builder de scène et le constructeur de scénario sont distincts. La lecture
  auteur commence à la page courante.
- L’éditeur est destiné à l’ordinateur ; le player doit fonctionner sur mobile.
  L’auteur n’écrit jamais de HTML. Le JSON reste la source et le builder produit
  le markup statique.
- Un BDC n’est utilisé qu’à un emplacement. Les images et médias sont des
  ressources réutilisables du catalogue.
- Le premier parcours comprend l’organisation, le Flux, les Questions et
  l’Évaluation. La Diapo vient après cette première démonstration.

Les contrats détaillés et vérifiés sont dans les
[spécifications Elcé](../specs/). Ce plan fixe leur ordre d’application et les
preuves qui permettent de fermer chaque tranche.

## Ordre et critères de sortie

| Ordre | Tranche | État | Critère de sortie |
| --- | --- | --- | --- |
| 0 | Application et workspace | En cours | Lancement à froid, preview, typecheck, tests et build fonctionnent depuis le workspace Elcé ; le navigateur restaure le document et ses médias. |
| 1 | Modèle, commandes et organisation | En cours | Les commandes XState créent, nomment, déplacent et retirent pages/chapitres. Une page créée dans un chapitre standard reçoit un BDC Texte ; une page créée dans un chapitre d’évaluation reçoit un BDC Question. Les deux restent des pages Flux. Un chapitre d’évaluation reçoit le nom « Évaluation » sans libellé répété ; FilePlus et Trash2 font 14 px. L’icône de chapitre et son titre éditable restent sur la même ligne. L’ordre racine mixte, les pages de chapitre et les titres survivent au rechargement. Cliquer un chapitre ouvre ses réglages dans la zone centrale ; pour un chapitre Évaluation, le formulaire affiche le seuil POC fixe de 80 %, les tentatives illimitées et la reprise de toutes les questions par défaut, et permet de régler la limite d’essais ainsi que la reprise de toutes les questions ou des seules erreurs. Le catalogue « Contenus disponibles » occupe la colonne droite. Une page déplacée ne reconstruit pas les scènes. |
| 2 | Première lecture Flux dans Sighty/CodPlay | En cours | Une scène Flux réelle se lit via le scénario Sighty et son slot racine. Menu, lecture à la page courante, repère de fin, pages courtes et longues suivent les contrats de la démo 5. Un aller-retour A → B → A conserve chaque scène. |
| 3 | Éditeur Flux, médias et ancres | En cours | Tiptap exporte le HTML statique. La barre d’ajout présente les icônes de création des BDC. Le BDC Texte initial peut être supprimé par commande ; ses BDC média ancrés sont également supprimés, tandis que les ressources restent au catalogue. Dépôt depuis fichier ou catalogue passe par les commandes existantes ; un dépôt crée un BDC unique et conserve le média réutilisable. Un import identique (même type et mêmes octets, vérifiés par SHA-256) réutilise une seule ressource média, même si le nom du fichier diffère ; un fichier différent reste une ressource distincte. L’ancre reste visible à son point d’insertion, réserve l’espace du BDC sans casser le flux, et résiste à l’édition, au resize et au rechargement Safari. Les deux gestes de suppression — supprimer le BDC ou le rendre disponible — gardent leurs effets distincts. La preuve Safari reste à compléter pour le glisser-déposer physique, la réouverture et le déplacement d’un BDC, ainsi que le rendu persistant après l’effacement d’une ancre. La spécification note que l’éditeur utilise `contain` et le player `cover` ; réconcilier ce cadrage avec le comportement `cover` demandé avant de fermer la tranche. |
| 4 | Quiz simple | En cours | L’icône Quiz utilise un symbole de liste de réponses, pas un point d’interrogation. Une page créée dans un chapitre Évaluation propose une Question par défaut ; chaque page Flux n’en contient qu’une et celle-ci peut être supprimée. Vrai/Faux, Choix et Choix multiple sont éditables et validés dans le player réel. Aucune correction avant validation ; la correction apparaît après validation comme dans la démo 5. La navigation de page attend les conditions configurées, sans exiger une réponse juste par défaut. |
| 5 | Évaluation de chapitre | En cours — icône, édition, retrait et compilation CodPlay du BDC Résultat vérifiés ; intégration player restante. | Les pages restent des pages Flux ordinaires : une page créée dans un chapitre Évaluation reçoit une Question par défaut, supprimable comme les autres BDC. La barre de page offre une icône pour ajouter un BDC Résultat qui regroupe les issues Succès et Échec et rejoint Texte et Quiz. Il est relié à `EvaluationMachine` et au contexte Sighty existant. Le seuil POC reste 80 % ; les tentatives sont illimitées par défaut et la reprise porte toutes les Questions par défaut, avec l’option « erreurs seulement ». L’échec ne révèle pas les réponses. Si l’action Succès choisie est la relecture, elle ouvre toutes les Questions avec réponses données et attendues. Safari vérifie réussite 4/5, échec 3/5, reprise totale, reprise des seules erreurs et relecture après succès. |
| 6 | Acceptation de la première démonstration | En cours | Un auteur réalise le parcours complet sur ordinateur ; le player fonctionne sur mobile. Vérifier la persistance, la lecture courante, l’organisation, les ancres, les Questions, les transitions et les scénarios dans Safari. **Vérifié :** le bouton « Prévisualiser » occupe sa propre ligne au-dessus des titres et ouvre la modale (Safari, 4 octobre 2026 ; détail dans la [spécification de preview](../specs/player-preview-spec.md)). La lecture dans une fenêtre distincte est reportée à l’acceptation finale du POC (tranche 9). |
| 7 | BDC Carousel dans une page Flux | En cours — Safari confirme le cadre 16:9, la sélection par point et l’affichage de « Répéter 10 fois » ; le test player couvre une répétition finie. Le parcours image → Texte court → saisie → Texte avec image et son rendu sont vérifiés dans les tests d’interface et de builder. Restent 4:3, 1:1, l’aperçu d’un média chargé et le cycle temporisé. L’ouverture du sélecteur natif est vérifiée par l’auteur dans une fenêtre Safari non contrôlée avec `accept` explicite ; Safari MCP ne permet pas d’observer le panneau système. L’insertion dans un BDC Texte reste pour après. | Le BDC Carousel est un objet Elcé unique, ajouté par une icône à la suite des autres BDC de la page, édité dans la zone centrale et compilé en story CodPlay autonome. Il démarre en lecture manuelle ; la durée commune est réglable de 1 à 10 secondes, et chaque vue peut recevoir une durée auteur. Le ratio propose 16:9, 4:3 et 1:1. Chaque vue occupe seule le cadre de ce ratio ; les points de navigation restent à l’extérieur. Les points sélectionnent leur vue en modes manuel et automatique ; en mode automatique, les changements temporisés suivent leur programme. En lecture automatique, « Répéter [x] fois » règle de 0 à 10 passages supplémentaires après le premier, avec 10 par défaut ; 0 conserve un seul passage. La carte Texte avec image reprend les champs Texte court et permet de placer l’image à gauche ou à droite. Changer de carte conserve les valeurs communes ; une image attachée à une vue reste liée lorsqu’on passe provisoirement par une carte Texte court et redevient visible en Texte avec image. L’identifiant et la durée auteur restent inchangés. Pause/lecture reste hors du POC. Vérifier les autres comportements livrés dans le player réel avec Safari MCP. Ne pas créer ni activer le type de page Diapo dans cette tranche. Voir la [spécification du BDC Carousel](../specs/carousel-bdc-spec.md). |
| 8 | Page Diapo | Après le BDC Carousel — décisions d’interface encore ouvertes | Ajouter le type de page sans défilement et son builder distinct. Définir auparavant les BDC autorisés et le BDC initial. Vérifier le player réel sans détourner le builder Flux. |
| 9 | Acceptation finale du POC | À faire | Rejouer les parcours auteur et player, y compris mobile, chargement après fermeture, lecture intégrée et fenêtre distincte, puis typecheck, tests, build et vérifications navigateur. Documenter seulement les comportements effectivement vérifiés. |

Chaque tranche dépend des précédentes uniquement lorsqu’elle en utilise le
contrat. Un échec de preuve garde la tranche « En cours » et bloque son
intégration dépendante ; les travaux indépendants continuent.

## BDC Carousel — périmètre en cours

### Comportements retenus

- Le travail courant construit le BDC Carousel dans la séquence des BDC d’une
  page Flux, ajouté par l’icône de la barre de page. Son insertion ultérieure
  dans le contenu d’un BDC Texte reste prévue, mais ne fait pas partie de cette
  première version à la suite. La page reste une page Flux défilante ; le type
  de page Diapo et son builder ne font pas partie de cette tranche.
- Le BDC Carousel est un objet Elcé unique qui transporte une séquence ordonnée
  de vues. Une vue utilise un preset de carte Elcé. Les BDC restent uniques et
  ne sont pas des objets CodPlay ; les images et vidéos restent des ressources
  réutilisables du catalogue.
- La création ou la réouverture d’un BDC Carousel ouvre directement son espace
  d’édition au centre. L’entête identifie « Carousel » et place la suppression
  en haut à droite. L’auteur choisit un preset pour chaque vue, puis peut
  revenir à la page et prévisualiser celle-ci en entier ; aucun preset des vues
  suivantes n’est défini globalement.
- Le Carousel s’étend dans les limites de son parent. Le ratio se choisit parmi
  16:9, 4:3 et 1:1 ; il détermine le cadre de lecture, sans inclure la rangée de
  points. Une vue à la fois occupe ce cadre, sans défilement ni empilement
  vertical.
- Une seule vue est visible à la fois. Les points sont cliquables dans les deux
  modes et sélectionnent la vue correspondante. En mode automatique, les
  changements temporisés restent actifs après une sélection par point. Chaque
  vue utilise
  la durée commune choisie pour le carousel ; une durée auteur peut définir la
  durée de cette vue. La durée totale est la somme des durées des vues. Le mode
  manuel avance par les points du mini-navigateur uniquement. Le carousel
  expose son choix de transition dans ses paramètres. En lecture automatique,
  « Répéter [x] fois » accepte de 0 à 10 passages supplémentaires après le
  premier ; la valeur par défaut est 10 et 0 désactive les répétitions.
  Pause/lecture reste hors du POC.
- Le Carousel commence avec une vue Texte court. Ses champs sont surtitre,
  titre, description, message (250 caractères maximum) et note. Texte avec
  image reprend ces champs et propose une image à gauche ou à droite, affichée
  en mode cover dans la zone prévue par la carte. Les autres presets initiaux
  sont Photo/vidéo plein cadre et Image avec légende. Le preset Question et son
  comportement de questions-réponses sont reportés à la tranche dédiée.
  Changer de carte conserve les valeurs communes aux deux presets. Une image
  reste attachée à la vue quand l’auteur passe par Texte court pour saisir ses
  champs ; cette carte ne l’affiche pas, mais elle redevient visible en Texte
  avec image. Modifier une autre vue sans image ne retire pas cette référence.
  Les champs texte propres au preset quitté reprennent les valeurs
  initiales du preset cible.
  Les zones et leur markup appartiennent aux presets déclarés en configuration ;
  les contenus saisis appartiennent au BDC Carousel.
- Dans une carte média, la zone vide et l’aperçu image sont un label associé à
  l’input natif ; `accept` fournit extensions explicites et types MIME depuis la
  configuration. Le dépôt reste accepté ; les commandes de lecture vidéo et le
  bouton de retrait gardent leur action distincte. Safari MCP confirme le clic
  natif label → input, mais n’expose pas le panneau système. L’auteur confirme
  que le sélecteur s’ouvre dans une fenêtre Safari non contrôlée avec les
  extensions explicites de `accept` ; le contrôle MCP ne permet pas de valider
  l’ouverture du panneau système.

### Contrat technique et preuves à établir

- `AutoCapsule` fournit le type `carousel` et sa grille forcée 1×1. Il exige
  une plage `timeRange` déjà résolue pour chaque vue et transmet ces plages ;
  il ne calcule pas la durée cumulée des vues. Les transitions disponibles
  sont les définitions nommées de la bibliothèque.
- Le builder traduit la durée par vue et sa durée auteur optionnelle en bornes
  séquentielles explicites, puis utilise `CapsuleDistribution` dans
  `packages/authoring/scene-factory` pour résoudre les plages transmises à
  `AutoCapsule`. La durée totale est la somme des durées de chaque vue ; il n’y
  a pas de minuteur ou de calcul de redistribution parallèle dans Elcé.
- La sélection par point passe par un événement, un strap et des actions
  CodPlay dans les deux modes. Le test de composition exécute le runtime player
  et vérifie les clics en manuel et automatique ; Safari MCP confirme le clic
  automatique dans la preview. Aucun état de navigation ni minuteur parallèle
  n’est ajouté dans React.
- L’ajout à la suite doit conserver le BDC unique et sa place dans l’ordre des
  BDC. Son insertion ultérieure dans le texte pourra réutiliser le circuit
  d’ancre. Le cadre du Carousel reste responsive selon son parent et son ratio ;
  aucun code CodPlay core ne change.
- Le builder construit séparément la story autonome du BDC Carousel et
  l’assemble à la scène Flux. La story donne accès à ses persos et à son état ;
  elle n’est pas un élément DOM. Les actions et événements sont déclarés dans
  les persos et utilisent les circuits CodPlay documentés.
- Le contrat `AutoCapsule` résout des durées finies. La répétition demandée est
  elle aussi finie : le builder répète les occurrences CodPlay selon le nombre
  choisi, en décalant chaque passage par la durée totale du premier. Aucun
  minuteur local ni changement CodPlay core n’est prévu. Pause/lecture reste
  différée.
- Les comportements vérifiés et leurs tests sont consignés dans la
  [spécification du BDC Carousel](../specs/carousel-bdc-spec.md). L’insertion
  dans un BDC Texte reste une décision retenue mais non appliquée.

## Page Diapo — décisions reportées

- Une nouvelle page Diapo crée-t-elle un BDC Carousel par défaut ou reste-t-elle
  vide ? Quels autres BDC, s’il y en a, la barre d’ajout propose-t-elle ? La
  Section en est exclue.
- La voix facultative appartient à la page Diapo : elle démarre au lancement et
  s’arrête en quittant la page. En mode automatique, sa durée peut fournir la
  durée totale répartie entre les vues ; les durées auteur par vue la remplacent
  pour les vues concernées. Le mode manuel remplace les avances temporisées sans
  boucler ni couper la voix avant la sortie de la page.

## Suite différée après le BDC Carousel

- La scène Questions-Réponses complète, avec son comportement player et ses
  règles de correction, sera traitée dans une tranche ultérieure.
- Les commandes pause/reprise locale du Carousel sont reportées hors du POC.
- Le bouclage sans fin est remplacé par le nombre fini de répétitions réglé dans
  la tranche Carousel. La lecture s’arrête après le dernier passage.
- Le réglage fin des durées auteur par vue restera dans le circuit existant
  Capsule Automation ; il ne bloque pas l’édition et l’insertion du BDC
  Carousel dans le POC.

## Décisions ouvertes

- Les documents déjà enregistrés avec un ratio personnalisé qui n’est ni 16:9,
  ni 4:3, ni 1:1 doivent-ils être convertis au ratio le plus proche, ou en 16:9 ?
- Le Carousel pourra être inséré dans un BDC Texte, mais la spécification de sa
  version en séquence l’exclut. Confirmer si cette insertion est requise avant
  la fin du POC ou si elle reste après.
- Vérifier dans Safari MCP que le cadre, la zone de dépôt et l’aperçu chargé
  respectent les trois ratios hors navigation et que la vue active seule occupe
  le cadre.

Pour finaliser les icônes Image et Vidéo de la barre, préciser si leur action
crée un BDC vide à compléter ou lance le choix du média. Le dépôt direct d’un
fichier ou d’une référence du catalogue dans le texte reste le parcours existant
qui crée ou attache média, BDC et ancre par les commandes.
