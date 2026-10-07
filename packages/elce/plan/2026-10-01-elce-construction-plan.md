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
| 6 | Acceptation de la première démonstration | En cours | Un auteur réalise le parcours complet sur ordinateur ; le player fonctionne sur mobile. Vérifier la persistance, la lecture courante, l’organisation, les ancres, les Questions, les transitions et les scénarios dans Safari. **Vérifié antérieurement :** le bouton « Prévisualiser » occupe sa propre ligne au-dessus des titres et ouvrait la modale (Safari, 4 octobre 2026 ; détail dans la [spécification de preview](../specs/player-preview-spec.md)). Pour le POC en cours, la popup est maintenant le parcours actif et l’accès à la modale intégrée est désactivé (tranche 9). |
| 7 | Refonte du BDC Carousel vers les BDC Carte | En cours — modèle v3, commandes, éditeur, builders, tests, player et nouveau document vérifiés le 6 octobre 2026. Le POC v1/v2 est abandonné sans migration ; l’option de cadrage image et le multi-import restent à accepter dans le player réel. | Avant la Diapo, remplacer les vues embarquées par des BDC Carte identifiés, enfants ordonnés du BDC Carousel. Les quatre présentations actuelles deviennent des layouts d’un même BDC Carte. Le BDC conserve tous ses champs quand un layout les masque ; le changement de layout ne réinitialise aucune valeur. Le Carousel garde ses paramètres de lecture et la durée propre à chaque entrée de sa séquence. Sa liste d’enfants n’autorise que les BDC Carte dans cette tranche. Réorganiser le modèle, les commandes, l’éditeur et le builder sur ces propriétaires métier ; conserver le circuit CodPlay existant et ne pas ajouter de compatibilité locale pour l’ancien modèle de vues. Vérifier ajout, édition, suppression et réordonnancement des cartes, conservation de tous les champs lors des quatre changements de layout, import groupé depuis la zone image avec ordre et layout conservés, références média, modes manuel et automatique et rendu dans le player réel. Voir « Refonte Carousel vers BDC Carte » ci-dessous. |
| 8 | Page Diapo | En cours — Carousel par défaut, alternatives Quiz/Carte autonome et signal de fin vérifiés dans le player réel et Brave. Réduction de la profondeur DOM du Carousel Diapo implémentée et vérifiée le 7 octobre 2026 : cinq éléments jusqu’à `img.cp-img-inner` dans Safari, navigation aux points, replay de page stable ; 160 tests, typecheck et build Elcé passent. La voix facultative et son effet sur les durées restent à traiter. Le BDC séquence réunissant plusieurs types reste une proposition à évaluer. | Ajouter le type de page sans défilement et son builder distinct. Une Diapo porte un seul BDC direct : la création propose un Carousel ; l’auteur peut le supprimer et le remplacer par un BDC Question/Quiz ou un BDC Carte autonome réutilisant le modèle Carte du Carousel. Le Carousel porte la séquence de ses cartes. Plusieurs contenus de types différents et leur temporalité ne sont pas simulés par une composition locale ; évaluer séparément la proposition de BDC séquence. La fin fonctionnelle de Diapo publie le même événement que la fin de défilement d’une Page : `elce:page:finished` avec `pageId`, visibilité `public`, par le marqueur `emit.observe` partagé avec Flux ou par l’action de validation du Quiz. Le traitement Sighty existant met à jour le verrouillage global de la navigation ; l’événement ne déclenche pas lui-même la navigation. La Diapo garde son affichage sans défilement. Ne pas utiliser `scene:end` pour cet achèvement et ne pas modifier CodPlay. Le comportement vocal et ses règles de répartition de durée restent à appliquer selon le plan ci-dessous. |
| 9 | Acceptation finale du POC | En cours — fenêtre distincte, parcours de synchronisation manuelle, média après réouverture, mobile à 390 px, typecheck, 130 tests et build vérifiés avec Brave. Lors d’une sélection, Brave signale qu’un descendant garde le focus au moment où le tiroir reçoit `aria-hidden` ; ce transfert reste à corriger. L’incohérence ARIA observée au passage de 800 à 801 px est reportée à une évolution CodPlay indépendante de la matérialisation. L’intégration du focus reste en attente d’une décision sur l’état accessible du menu de bureau après retrait de son adaptateur impératif. | Rejouer les parcours auteur et player, y compris mobile, chargement après fermeture et lecture en fenêtre distincte. Conserver la modale intégrée désactivée afin de comparer les deux choix pendant le POC. Vérifier la synchronisation manuelle ; le signal de changement et le mode automatique restent des étapes ultérieures acceptées, non appliquées. Définir comment le menu reste accessible sur ordinateur sans logique DOM impérative, puis appliquer les actions de focus CodPlay et rejouer les vérifications concernées, le typecheck, les tests, le build et le navigateur. Le défaut 800/801 reste différé ; ne pas le résoudre par un patch local Elcé ou HTML. Documenter seulement les comportements effectivement vérifiés. |

Chaque tranche dépend des précédentes uniquement lorsqu’elle en utilise le
contrat. Un échec de preuve garde la tranche « En cours » et bloque son
intégration dépendante ; les travaux indépendants continuent.

### Catalogue responsive de l’éditeur — implémenté et vérifié

- À 1200 px et moins, le bouton icône du catalogue est dans la ligne du titre
  « Elcé » et ouvre le tiroir droit. À 800 px et moins, une icône Scénario la
  précède dans cette ligne et ouvre un tiroir gauche. Les tiroirs sont exclusifs,
  se ferment par leur bouton, Échap ou clic sur le fond, puis rendent le focus à
  leur bouton. Les icônes sont dans le flux normal, sans position fixe ni sticky.
- Entre 801 et 1200 px, la colonne Scénario reste visible et la zone de travail
  centrale flexible utilise la largeur restante ; à 800 px et moins, elle prend
  toute la largeur disponible. À plus de 1200 px, les trois colonnes restent
  visibles et les icônes responsive sont masquées. Le bandeau ne montre que
  « Elcé », sans libellé POC ni état technique.
- Brave DevTools vérifie à 390 × 844 px les deux boutons en haut, l’ouverture
  indépendante des tiroirs gauche et droit, leur fermeture par Échap et le retour
  du focus. À 1024 px, le Scénario reste à 288 px et l’espace central atteint
  688 px ; à 1408 px, les trois colonnes mesurent 288/768/288 px. Le comportement
  appartient au layout React de l’éditeur, hors scène CodPlay.

### Sommaire responsive du player — décision acceptée, défaut détecté à la frontière

- Décision validée le 5 octobre 2026 : à 800 px et en dessous, une icône ouvre
  un tiroir latéral gauche superposé au contenu ; au-dessus, le sommaire reste
  dans la colonne latérale. Le tiroir se ferme par son icône de fermeture, un
  clic à l’extérieur, Échap ou le choix d’une page.
- Précision acceptée le 5 octobre 2026 : le bouton reprend le fond du sommaire
  (`#263b3a`) et CodPlay déclenche les animations d’entrée et de sortie par les
  événements et actions de style de la scène. Le tiroir garde les événements de
  navigation de page Sighty/CodPlay existants ; aucune navigation parallèle ni
  animation pilotée par React n’est ajoutée.
- Le sélecteur responsive reste dans la feuille du player pour fonctionner
  dans une fenêtre de preview distincte. L’implémentation remplace le premier
  montage en dialogue natif par le tiroir animé dans le circuit CodPlay ; les
  états accessibles et le retour du focus restent synchronisés avec les
  commandes.
- Brave DevTools, le 5 octobre 2026, vérifie à 390 × 844 l’ouverture du tiroir,
  la sélection de Page A et l’absence de débordement horizontal. À 800 × 900,
  le tiroir s’ouvre, son animation de CodPlay est visible, puis Échap et le
  bouton de fond le ferment et rendent le focus au bouton d’ouverture.
- Écart détecté lors du passage de 800 à 801 px avec le tiroir fermé : le
  bouton passe en `display: none` et le tiroir reste `data-open="false"`,
  `aria-hidden="true"` et `inert`, mais le bouton porte
  `aria-expanded="true"`. Cette incohérence garde l’acceptation en cours.
- Lors de la sélection d’une page dans le tiroir, le navigateur émet aussi un
  avertissement indiquant que le bouton de page garde le focus quand son
  ancêtre reçoit `aria-hidden`. Le focus finit sur le bouton d’ouverture, mais
  l’ordre de fermeture reste à corriger pour éviter cet état intermédiaire.
- Précision acceptée le 5 octobre 2026, non appliquée : le bouton du menu, le
  tiroir, ses commandes, le comportement responsive et la gestion du focus
  doivent être portés par des persos, événements et actions CodPlay dans la
  scène `layout`. Le tiroir ne doit pas être une scène séparée, et
  `ElcePlayerComposition` ne doit pas en reprendre l’état accessible ou le
  focus dans un adaptateur DOM impératif.
- Direction validée le 5 octobre 2026, application en attente : le materializer
  HTML reçoit `htmlElementMethod` dans les actions et appelle la méthode sur le
  nœud courant sélectionné (`focus`, `blur`, `preventscroll`). La combinaison
  `focus` avec `preventscroll` appelle
  `htmlElement.focus({ preventScroll: true })`, et `preventscroll` seul est
  invalide. Une action est exécutée une fois en lecture normale ; Seek et
  reconstruction ne lancent pas ces méthodes, et un perso démonté est ignoré.
  Les formes ambiguës ou répétées déclenchent un avertissement du compilateur
  auteur hors du core CodPlay, puis sont ignorées. À l’ouverture, les attributs
  précèdent le focus ; à la fermeture, le retour du focus précède
  `aria-hidden`/`inert`. Elcé n’appelle aucune méthode DOM et n’ajoute pas de
  scheduler RAF. La spécification Elcé sera mise à jour après validation réelle
  de la projection. Le détail de réalisation est dans le
  [plan de projection HTML](../../codplay/plan/node-method-capability-plan.md).
- Décision du 6 octobre 2026 : aucun traitement media query n’est ajouté par
  un patch local Elcé ni à la projection HTML dans cette tranche. L’évolution
  est reportée à une prochaine version de CodPlay et devra être étudiée à une
  frontière indépendante de la matérialisation, pertinente pour les cibles
  HTML comme canvas. L’incohérence ARIA constatée au passage de 800 à 801 px
  reste consignée comme travail différé et ne bloque pas la tranche actuelle.
  Ne pas ajouter de capacité de breakpoint au travail de focus.
- Point à résoudre avant l’intégration : `bindMenuDrawer()` retire actuellement
  `aria-hidden` et `inert` au menu visible sur ordinateur. Sans lui, les valeurs
  initiales du perso `layout` laissent ce menu visible mais inerte. La scène ne
  peut pas distinguer les breakpoints avec les capacités courantes. Définir
  l’état accessible de cette navigation dans la version présente, ou différer
  son intégration ; ne pas réintroduire un adaptateur DOM.
- Après correction, rejouer le typecheck, la suite Elcé, le build et le
  parcours Brave sur les tailles concernées par le transfert de focus.
  Confirmer l’animation, Échap, le clic extérieur, la sélection d’une page et
  le retour du focus sans avertissement console avant d’enregistrer le
  comportement dans la spécification. Le défaut 800/801 reste non résolu et
  sera réexaminé avec l’évolution CodPlay indépendante de la matérialisation.

### Lecture dans une fenêtre distincte — tranche 9 en cours

- Décision du 5 octobre 2026 : la popup devient le parcours de
  preview actif. Le code de la modale intégrée reste disponible mais son accès
  est désactivé pour comparer les choix pendant le POC. Le mode de diffusion
  qui projette le projet derrière l’éditeur viendra après la popup.
- À l’ouverture, la popup présente la page affichée dans l’éditeur. Sa
  navigation Sighty/CodPlay reste ensuite indépendante. Une commande distincte
  permet de réafficher la page éditée. Une synchronisation affiche également
  cette page. Si cette page a été créée depuis la dernière synchronisation,
  cette commande synchronise automatiquement une fois pour pouvoir l’afficher.
- Première étape : une commande de synchronisation manuelle au-dessus du rendu
  transmet le document courant de l’éditeur et reconstruit le projet selon la
  règle déjà retenue : une édition ne reconstruit que la scène de sa page ; un
  changement d’organisation reconstruit le scénario entier en réutilisant les
  scènes inchangées. La popup monte sa propre composition Sighty/CodPlay et
  possède son cycle de vie. La lecture repart de la page éditée avec temps,
  réponses et historique remis à zéro ; le POC ne persiste pas ces éléments.
- Étapes suivantes, non appliquées : signaler visuellement sur la commande
  qu’une mise à jour est demandée, puis proposer un mode automatique
  débrayable qui calcule le nouvel état du projet. Ne pas confondre ce mode
  avec la lecture automatique d’un BDC Carousel.
- Le document XState de l’éditeur reste la source unique. Les deux contextes
  navigateur imposent un transport entre eux ; aucune voie équivalente
  n’existe actuellement dans Elcé. Ce transport ne possède ni document, ni
  navigation, ni catalogue parallèles. Les médias continuent de passer par le
  stockage IndexedDB existant et sont chargés dans le contexte de la popup.
- Brave DevTools, le 5 octobre 2026, vérifie l’ouverture d’une popup depuis la
  page éditée, la navigation indépendante A → B, l’attente d’une synchronisation
  après correction, le retour à la page éditée et la synchronisation unique
  lorsqu’elle a été créée depuis le dernier instantané. Après réorganisation,
  le nouveau scénario commence sur la page éditée en première position ; le
  test de composition vérifie l’identité des sources de scènes inchangées.
  Brave vérifie aussi les icônes et les noms accessibles des commandes : les
  libellés sont masqués avec `title` à 390 px et 800 px, puis visibles à 801 px.
- Un fichier image de test chargé par l’événement `change` de l’input produit
  une image décodée dans la popup après synchronisation, puis après fermeture
  et réouverture depuis IndexedDB. Le MCP a refusé le chemin local pour son
  action `upload_file` ; la boîte de dialogue système n’est donc pas couverte
  par cette preuve.
- Typecheck réussi, suite Elcé réussie (130/130) et build réussi le
  5 octobre 2026. Le build signale un chunk supérieur à 500 kB.
- Avant de clore cette tranche, corriger l’écart `aria-expanded` et l’ordre de
  transfert du focus du sommaire décrits ci-dessus, puis rejouer l’acceptation
  responsive. Le signal visuel de synchronisation et le mode automatique
  restent des étapes ultérieures non appliquées.

## BDC Carousel — périmètre en cours

### Direction des transitions de glissement — acceptée, preuve restante

- Décision du 5 octobre 2026 : pour un glissement vers la gauche, la vue
  entrante et la vue sortante se déplacent toutes deux vers la gauche sans se
  croiser. La même règle directionnelle s’applique aux glissements vers la
  droite, vers le haut et vers le bas.
- Le réglage reste porté par AutoCapsule et les actions de style CodPlay déjà
  utilisées par le builder du Carousel. Corriger les définitions nommées
  existantes ; ne pas ajouter un second circuit de transition.
- La preuve d’acceptation devra contrôler des instants intermédiaires des
  deux vues dans le player Elcé réel pour les quatre directions. La
  spécification du Carousel reste inchangée jusqu’à cette vérification.

### Comportements retenus

- Le travail courant construit le BDC Carousel dans la séquence des BDC d’une
  page Flux, ajouté par l’icône de la barre de page. Son insertion ultérieure
  dans le contenu d’un BDC Texte reste prévue, mais ne fait pas partie de cette
  première version à la suite. La page reste une page Flux défilante ; le type
  de page Diapo et son builder ne font pas partie de cette tranche.
- Le BDC Carousel est un objet Elcé placé dans une page Flux. Chaque vue de sa
  séquence est un BDC Carte identifié, enfant unique du Carousel. Les BDC ne
  sont pas des objets CodPlay ; les images et vidéos restent des ressources
  réutilisables du catalogue.
- La création ou la réouverture d’un BDC Carousel ouvre directement son espace
  d’édition au centre. L’entête identifie « Carousel » et place la suppression
  en haut à droite. La création ajoute une première Carte en layout Texte
  court. L’auteur choisit un layout pour chaque BDC Carte, puis peut
  revenir à la page et prévisualiser celle-ci en entier ; aucun preset des vues
  suivantes n’est défini globalement.
- Le Carousel s’étend dans les limites de son parent. Le ratio se choisit parmi
  16:9, 4:3 et 1:1 ; il détermine le cadre de lecture, sans inclure la rangée de
  points. Une vue à la fois occupe ce cadre, sans défilement ni empilement
  vertical.
- Une seule carte est visible à la fois. Les points sont cliquables dans les deux
  modes et sélectionnent la vue correspondante. En mode automatique, les
  changements temporisés restent actifs après une sélection par point. Chaque
  entrée utilise la durée commune choisie pour le Carousel ; une durée
  particulière peut remplacer cette durée. La durée totale est la somme des
  durées d’entrée. Le mode manuel avance par les points du mini-navigateur
  uniquement. Le Carousel
  expose son choix de transition dans ses paramètres. En lecture automatique,
  « Répéter [x] fois » accepte de 0 à 10 passages supplémentaires après le
  premier ; la valeur par défaut est 10 et 0 désactive les répétitions.
  Pause/lecture reste hors du POC.
- Le premier BDC Carte commence en layout Texte court. Chaque carte conserve
  surtitre, titre, description, message (250 caractères maximum), note,
  légende, position et cadrage de l’image et référence média dans le même BDC,
  quel que soit son layout actif. Le cadrage choisit `contain` ou `cover` et
  vaut `cover` par défaut afin de garder le rendu existant ; il concerne les
  images, pas les vidéos. Les anciens documents v3 qui n’ont pas encore ce
  champ reçoivent `cover` à la lecture, sans réintroduire le support v1/v2.
  Texte avec image reprend ces champs et propose une image à gauche ou à droite,
  cadrée selon ce réglage dans la zone prévue par la carte. Les autres presets initiaux
  sont Photo/vidéo plein cadre et Image avec légende. Le preset Question et son
  comportement de questions-réponses sont reportés à la tranche dédiée.
-  Le changement de layout masque les valeurs qui ne sont pas projetées sans
  les effacer ; les quatre présentations modifient le même BDC Carte. Photo ou
  vidéo plein cadre accepte image ou vidéo ; Texte avec image et Image avec
  légende acceptent l’image ; Texte court ne projette pas de média. Une
  référence média déjà présente reste attachée même dans un layout qui ne la
  projette pas. Les zones et le markup sont ceux des presets de configuration.
- Dans une carte média, la zone vide et l’aperçu sont un label associé à
  l’input natif ; `accept` fournit extensions explicites et types MIME depuis la
  configuration. Le dépôt et les médias du catalogue utilisent les commandes
  média de la Carte ; le bouton de retrait reste distinct.

### Circuit technique et état des preuves

- `AutoCapsule` fournit le type `carousel` et sa grille forcée 1×1. Il exige
  une plage `timeRange` déjà résolue pour chaque BDC Carte et transmet ces
  plages ; il ne calcule pas la durée cumulée. Les transitions disponibles
  sont les définitions nommées de la bibliothèque.
- Le builder traduit la durée d’entrée et son éventuelle durée particulière en bornes
  séquentielles explicites, puis utilise `CapsuleDistribution` dans
  `packages/authoring/scene-factory` pour résoudre les plages transmises à
  `AutoCapsule`. Il projette chaque enfant par ID avec
  `ElceCardBdcSceneBuilder`. Il n’y a pas de minuteur parallèle dans Elcé.
- La sélection par point passe par un événement, un strap et des actions
  CodPlay dans les deux modes. Les tests de composition exécutent le runtime
  player ; Brave DevTools confirme la sélection et l’avance automatique dans la
  fenêtre de lecture. Aucun état de navigation ni minuteur parallèle n’est
  ajouté dans React.
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
- Les comportements vérifiés, dont l’identité Carte, la conservation des
  champs, l’absence de migration v1/v2 et l’acceptation player, sont consignés
  dans la [spécification du BDC Carousel](../specs/carousel-bdc-spec.md). L’insertion
  dans un BDC Texte reste une décision retenue mais non appliquée.

### Refonte Carousel vers BDC Carte — implémentation vérifiée, stockage existant à décider

- Le BDC Carousel reste le conteneur de lecture : il porte le mode, les
  répétitions, le ratio, la transition et la durée commune. Sa séquence ordonnée
  référence des BDC Carte enfants ; chaque entrée porte sa durée particulière.
- Chaque carte devient un BDC identifié du document avec un parent unique. Le
  conteneur possède l’ordre de ses enfants. Les quatre formes actuelles — Texte
  court, Texte avec image, Photo/vidéo plein cadre, Image avec légende — sont
  des choix de layout d’un même BDC Carte, pas quatre types de BDC.
- Le BDC Carte garde son jeu de champs complet indépendamment du layout choisi.
  Le layout sélectionne les champs projetés ; il ne supprime ni ne réinitialise
  les champs masqués. Les références média restent attachées au BDC. Les règles
  d’acceptation et de projection d’un média restent propres au layout.
- Décision acceptée et implémentée, validation manuelle en attente : « Ajouter
  une vue » reprend le layout et ses options de présentation depuis la dernière
  vue du Carousel. Pour les options actuelles, cela reprend `imagePosition` et
  `imageFit` ;
  le contenu texte, la légende, le média et la durée propre à l’entrée ne sont
  pas copiés. La nouvelle carte reste vide et sa durée suit le défaut commun.
  La première carte créée avec le Carousel conserve son layout initial
  configuré. Vérifier dans le player l’ajout après plusieurs layouts, les deux
  positions et les deux cadrages d’image avant de reporter ces comportements
  dans la spécification.
- Décision acceptée et implémentée, validation visuelle en attente : l’éditeur
  offre aux layouts qui projettent une image le cadrage « Contenir » (`contain`)
  ou « Couvrir » (`cover`). La valeur est portée par le BDC Carte et projetée
  par une classe CSS de l’image ; le rendu de vidéo plein cadre reste inchangé.
  L’éditeur place représentation, durée, cadrage et position de l’image dans la
  barre supérieure en une seule rangée, chaque libellé au-dessus de son
  contrôle. Les colonnes ne sont présentes que pour les réglages du layout
  courant. Vérifié dans Brave pour Photo/vidéo plein cadre à un viewport de
  1408 px (barre de 704 px) ; l’acceptation visuelle des autres layouts reste
  à faire.
- Décision acceptée et implémentée, acceptation navigateur en attente : le
  multi-import commence dans la zone image d’une carte, comme l’import unitaire
  actuel. Pour N images,
  l’image 1 est affectée à la carte ciblée et N−1 nouvelles cartes sont créées
  immédiatement après, dans l’ordre des fichiers sélectionnés. Elles reprennent
  le même layout et les mêmes réglages de présentation ; leur texte, légende,
  média antérieur et durée particulière ne sont pas copiés. Le flux réutilisera
  les commandes de création de BDC Carte et l’import média existant ; il
  n’ajoute pas de circuit d’import parallèle. Vérifier avec la sélection de
  fichiers et le glisser-déposer que le nombre, l’ordre, le layout, les réglages,
  l’attachement des médias et la persistance après rechargement sont corrects
  dans le player et l’éditeur réels.
- Le Carousel n’accepte que des BDC Carte dans cette tranche. Les autres types
  enfants seront décidés pour la Diapo dans sa tranche ; la Question reste hors
  du périmètre Carousel actuel.
- Les réglages Lecture, Répéter, Durée par vue, Transition et Ratio restent sur
  une rangée. Dans Brave, cette rangée tient sur 704 px de largeur.
- Correction autorisée et implémentée : le perso layout Capsule matérialise
  l’article de la carte et reprend maintenant les classes racines et de zones du
  preset. Avant correction, Brave observait un hôte média de 916 × 644 px et une
  image de 412 × 640 px dans un cadre de 916 × 515 px. Après correction, le
  layout Photo/vidéo plein cadre garde l’article, l’hôte média et l’image dans
  le même cadre : 916 × 515 px sur ordinateur et 298 × 168 px à 390 px. Le
  cadrage de l’image utilise `object-fit` ; le typecheck Elcé passe et aucun
  changement du core CodPlay n’est requis.
  Vérifier visuellement le confinement des contenus dans les trois autres
  layouts avant de clore cette acceptation.
- Étendre le modèle documentaire et ses invariants de placement unique aux
  relations parent/enfant, puis aligner les commandes, la sélection d’édition,
  l’éditeur Carousel, le traitement des médias et la composition de scène sur
  ces identifiants de BDC. Chaque layout de Carte est décrit comme une grille
  CSS de type `card`, avec des zones nommées. Les items du contenu sont placés
  dans ces zones. `capsule-automation` doit produire les styles qui adaptent
  leurs positions à l’orientation (par exemple, une image à gauche en horizontal
  se place en haut en vertical). Le builder Elcé consommera cette description
  et ces styles, sans circuit local parallèle de placement.
- Décision acceptée, application en attente : reprendre le mécanisme du
  [plan Editor des variantes d’orientation](../../editor/plan/modules/2026-07-11-zone-orientation-variants-plan.md).
  `capsule-automation` produit les styles CSS conditionnels de la grille `card`
  et de ses zones nommées. `@container (orientation: landscape | portrait)`
  évalue le ratio largeur/hauteur de la propre boîte du BDC Carte ; le rendu ne
  dépend donc pas de l’orientation du téléphone ou de l’ordinateur. Les mêmes
  règles CSS responsive doivent fonctionner dans le player Elcé sur les deux
  types d’appareil. Le contrat actuel de `capsule-automation` ne fournit pas
  encore ces variantes : l’entrée `orientation` ne pilote que le mode de grille
  `derived`. Implémenter d’abord le plan Editor dans `capsule-automation`, puis
  adapter le builder Elcé ; ne pas contourner ce manque par des règles de layout
  locales dans Elcé.
- La durée particulière appartient à l’entrée de séquence du Carousel, car
  elle règle le temps de présentation dans ce conteneur et non le contenu
  intrinsèque de la carte. Le service de distribution Capsule reste le seul
  circuit de résolution temporelle.
- Acceptation exécutée le 6 octobre 2026 : créer, éditer, supprimer,
  réordonner et déplacer un BDC Carte ; conserver ses champs et média parmi
  les quatre layouts ; lire dans le player en manuel et en automatique. Le
  contrôle Brave vérifie aussi l’ordre persisté dans IndexedDB v3, le
  rechargement, la lecture distincte et le ratio 16:9 à 390 px. Les tests
  couvrent le montage média image dans le player ; aucun fichier média n’a été
  importé pendant le parcours navigateur.
- Acceptation restante pour les variantes d’orientation : dans le player réel,
  vérifier qu’une même carte change le placement de ses zones nommées lorsque
  le ratio largeur/hauteur de son propre conteneur passe de paysage à portrait,
  sur smartphone et ordinateur. Le test ne doit pas dépendre de l’orientation
  physique de l’appareil.
- Décisions acceptées pour le responsive du Carousel, application en attente :
  le ratio largeur/hauteur est celui du cadre du BDC. La réponse de chaque
  layout se traite au cas par cas ; les layouts étagés simples restent tels
  quels, et le layout Texte avec image place l’image sur le côté en paysage puis
  en haut en portrait. Ces placements et leurs variantes responsive sont
  produits par `capsule-automation`; des profils C-A peuvent être ajoutés ou
  complétés selon les besoins. Les vues du Carousel sont bornées au cadre de la
  scène et ne défilent jamais à l’intérieur, dans aucun ratio. L’acceptation
  demande des essais visuels conduits avec l’auteur sur smartphone et ordinateur,
  avec les ratios portrait et paysage.
- Le Carousel doit utiliser une piste de défilement et
  `scroll-snap-type`, avec les propriétés CSS adjointes nécessaires pour
  l’alignement et le comportement responsive. « 100 % » désigne la taille du
  viewport de lecture du Carousel : chaque vue en occupe 100 %, et la piste
  s’étend selon le nombre de vues. La scène et le player exposent cette taille
  avec des unités de viewport mobiles, sans faire dépasser aux vues la zone de
  scène qui leur est allouée. `dvh`/`dvw` suivent le viewport dynamique quand
  l’interface du navigateur mobile se replie ou se déploie ; `svh`/`svw` gardent
  la taille sûre correspondant à l’interface déployée. Choisir le profil au
  cours des essais visuels sur mobile. Chaque vue reste à 100 % du viewport de
  lecture, et seul le conteneur externe défile. Définitions :
  [CSS Values and Units, §6.1.2](https://www.w3.org/TR/css-values-4/#viewport-relative-lengths).
- `scroll-snap-type` sert d’abord au passage manuel par geste, surtout au doigt
  sur mobile. L’approche recommandée est d’abord de l’exprimer dans les profils
  CSS de `capsule-automation`, en préservant les actions, commandes, événements
  et transitions CodPlay qui fonctionnent déjà. Retirer les règles Elcé qui
  feraient doublon, et privilégier le nettoyage à l’ajout. Cette préférence
  n’exclut pas un autre changement si l’analyse montre qu’il est nécessaire ;
  tout écart devra être justifié dans le plan avant implémentation.
  La spécification CSS Scroll Snap autorise le défilement libre à l’intérieur
  d’une zone de snap plus grande que son viewport, ce qui ne convient pas à la
  contrainte « sans scroll dans ces vues » :
  [CSS Scroll Snap, §5.2.2](https://www.w3.org/TR/css-scroll-snap-1/#snap-overflow).
- Acceptation restante pour le Carousel responsive : dans le player réel,
  vérifier le snap tactile, le respect du cadre et l’absence de défilement
  intérieur dans les orientations portrait et paysage. Vérifier aussi que les
  commandes et transitions existantes gardent leur comportement. Les profils
  CSS doivent être éprouvés visuellement avec l’auteur sur smartphone et
  ordinateur ; ces essais ne sont pas encore validés. Si le rendu révèle un
  conflit fonctionnel, arrêter et revoir la spécification avant d’ajouter une
  logique d’exécution.
- `npm run typecheck --workspace=@codplay/elce` réussit ; les 140 tests Elcé
  passent dans 20 fichiers ; `npm run build --workspace=@codplay/elce` réussit
  avec l’avertissement existant sur un chunk JavaScript supérieur à 500 kB.
  L’application Elcé n’expose pas de commande Seek distincte ; cette tranche
  conserve le circuit temporel Capsule existant et n’ajoute pas de contrôle de
  recherche temporelle.
- Le détail du modèle v3, des relations parent/enfant, des layouts et des
  preuves figure dans la [spécification du BDC Carousel](../specs/carousel-bdc-spec.md),
  la [spécification du modèle de document](../specs/document-model-spec.md) et
  la [spécification du builder Flux](../specs/flux-scene-builder-spec.md).
- Les documents v1/v2 ne sont pas migrés. Le chemin actuel rejette leur
  réhydratation ; `main.tsx` journalise l’erreur, l’éditeur reste sur son
  document initial en mémoire, la persistance n’est pas attachée et
  l’enregistrement IndexedDB antérieur reste intact. Le parcours avec nouveau
  document v3 est vérifié, mais le comportement de démarrage face à cet ancien
  enregistrement attend la réponse à la question posée le 6 octobre 2026 :
  réinitialiser automatiquement en v3 vierge ou conserver et bloquer jusqu’à un
  effacement manuel. Ne pas déclarer la tranche terminée avant ce choix et sa
  vérification.

## Page Diapo — décisions et tranche active

- Décision acceptée le 6 octobre 2026 : quand une Diapo contient un BDC
  Carousel, celui-ci reste propriétaire de l’ordre et des durées de sa séquence
  de BDC Carte. Une nouvelle Diapo propose le Carousel comme BDC par défaut,
  avec sa première Carte selon le défaut déjà configuré. Une Diapo contient un
  seul BDC direct : l’auteur peut supprimer le Carousel et le remplacer par le
  BDC Question/Quiz existant ou par le même BDC Carte que celui du Carousel,
  utilisé seul. La Carte autonome conserve son modèle, ses layouts et ses
  champs. Aucun empilement, overlay ou autre circuit de composition n’est
  ajouté.
- Le Carousel garde seul son modèle de séquence temporisée et sa lecture. Une
  proposition à évaluer plus tard consiste à créer un BDC séquence spécialisé
  capable d’enchaîner plusieurs types existants dans une même présentation
  (par exemple vidéo, Question, puis Résultat et explication). Ce BDC n’est ni
  décidé ni implémenté dans la tranche Diapo.
- Convention acceptée le 6 octobre 2026 : dans l’interface, les types sont
  nommés « Page » et « Diapo ». Le code conserve les types internes `flux` et
  `diapo` ; `Page` désigne le type utilisateur correspondant à Flux. Aucun
  renommage de modèle n’est requis à ce stade.
- Exigence responsive acceptée le 6 octobre 2026, application et arbitrage
  visuel en attente : quand le conteneur de lecture est portrait, le Carousel
  vise à occuper toute la scène, qu’il se trouve dans une Page ou une Diapo.
  Dans un conteneur paysage, le plein écran ne s’applique qu’à la Diapo ; le
  Carousel d’une Page garde son cadre de contenu. Il reste à comparer deux
  rendus : inversion du ratio choisi (par exemple 16:9 vers 9:16) et adaptation
  du contenu à la taille disponible. Ces comportements ne sont pas équivalents :
  à 350 px de large, un cadre 9:16 mesure environ 622 px de haut et ne remplit
  pas un viewport portrait de 1016 px.
- Vérification Brave du 6 octobre 2026 sur la preview existante de 5175 : dans
  un viewport de 442 × 1016 px, le Carousel de Page garde son ratio 16:9 ; son
  cadre mesure 350 × 197 px. Le builder passe le ratio choisi en style inline.
  `AutoCapsule` n’utilise `orientation` que pour dériver les grilles de type
  `derived` ; le Carousel force une grille 1×1. La génération CSS actuelle ne
  produit pas de variante `@container (orientation: ...)`, et le layout Texte
  avec image reste en deux colonnes. Ni l’inversion du ratio ni l’adaptation
  portrait demandée ne sont donc implémentées. L’orientation des zones nommées
  reste suivie dans le plan actif Capsule Automation ci-dessus ; ne pas ajouter
  de règles locales parallèles dans Elcé.
- Modèle temporel accepté le 6 octobre 2026 : la séquence temporisée des BDC
  Carte est portée par le BDC Carousel enfant. Ce choix fixe le parent des
  cartes, le contenu initial et le circuit de lecture ; il ne restreint pas les
  autres BDC page de la Diapo.
- Décision appliquée et vérifiée le 6 octobre 2026 : la progression
  de page reste globale et appartient à Sighty, selon les règles définies par
  l’application pour toutes les pages. À la fin fonctionnelle d’une Diapo, la
  scène publie exactement l’événement de fin des Pages Flux :
  `elce:page:finished`, visibilité `public`, données `{ pageId }`. Sighty réutilise
  son action existante pour réévaluer l’accès à « Page suivante ». Cet événement
  ne déclenche pas lui-même la navigation. `scene:end` et `sequence:end` gardent
  leur sémantique CodPlay distincte et ne servent pas au déverrouillage de page.
- `sequence:end` est le signal technique distinct indiquant que CodPlay a
  terminé la lecture de la séquence. Le player arrête sa lecture, termine son
  cycle et nettoie ses captures actives ; l’occurrence reste montée et devient
  « prête au démontage ». CodPlay ne détruit ni l’instance, ni le montage, ni
  ses ressources : Sighty garde la décision de les démonter. Voir la
  [spécification Engine/Player CodPlay](../../codplay/specs/engine-player-v2-spec.md)
  et la [spécification Sighty](../../sighty/specs/authoring-library-spec.md).
- Décision du 6 octobre 2026 : pour une Diapo Quiz, l’événement commun
  `elce:page:finished` est envoyé après validation de la réponse, quelle que soit
  sa justesse. « Page suivante » se déverrouille alors ; la scène reste montée
  et le Quiz continue de s’afficher.
- Règle appliquée et vérifiée le 6 octobre 2026 : chaque type de BDC Diapo
  publie le même événement public `elce:page:finished` avec `{ pageId }` au
  moment où sa fin fonctionnelle est atteinte. La Carte autonome le publie dès
  son affichage ; le Quiz après validation ; le Carousel quand sa dernière
  vue apparaît. Sighty réutilise son action existante. Aucun changement
  CodPlay n’est requis. Voir la [spécification Diapo](../specs/diapo-scene-builder-spec.md).
- Travail appliqué et vérifié le 7 octobre 2026 : les markup Elcé emploient les
  commentaires `<!-- data-part="…" -->` comme ancres CodPlay d’insertion. Un
  commentaire remplace l’hôte vide ; lorsqu’un conteneur porte une fonction
  sémantique ou visuelle, il reste en place et reçoit le commentaire. Les
  éléments texte vides en doublon sont retirés afin que le perso inséré soit
  lui-même le titre, le paragraphe ou le pied de carte. Le preset Question ne
  garde pas de conteneur vide dédié à ses contrôles de validation. Les 158 tests,
  le typecheck et le build Elcé passent ; Safari MCP vérifie le montage d’une
  image de Carousel dans une Diapo par la composition réelle Sighty/CodPlay et
  une console sans erreur ni avertissement. Les conteneurs nécessaires au rendu
  (cadres, grilles, régions sémantiques et contrôles) restent présents.
- Changement implémenté et vérifié le 7 octobre 2026 — **DOM du Carousel Diapo** :
  la région `content` du layout et son slot sont une seule `section` portant les
  attributs et classes de la région ; la racine du Carousel Diapo réunit le
  layout, le cadre, la grille Capsule et le `scroll-container` observé, sans
  hôte Diapo ni wrappers `frame`/`completion-root` supplémentaires. Les cartes
  ciblent cette racine directement par son ID de perso. La racine Photo reste
  présente et porte les classes de la vue (l’`article` extérieur est retiré
  pour ce cas) ; elle pourra évoluer vers `<picture>` avec légende. Le
  conteneur vidéo peut accueillir des éléments `<track>`. Le BDC Carte qui porte
  le marqueur final reste présent, ainsi que le conteneur média CodPlay et
  `img.cp-img-inner` requis par le composant `img`.
  Acceptance vérifiée : Safari MCP observe cinq éléments entre la région de
  contenu et l’image, son chargement, le changement de carte par les points,
  une seule vue visible, la grille en deux lignes et une console sans erreurs.
  Les tests player vérifient le signal de fin, la chaîne de six éléments au
  maximum et le replay A → B → A : structure et source de l’image identiques au
  retour, première carte réactivée. Les parcours Flux et Carte/Question Diapo
  sont couverts par la suite Elcé (22 fichiers, 160 tests réussis) ; typecheck
  et build passent. Le build conserve son avertissement existant de chunk
  supérieur à 500 kB. Voir les preuves dans les spécifications du
  [builder Diapo](../specs/diapo-scene-builder-spec.md) et du
  [Carousel](../specs/carousel-bdc-spec.md).
- Revue transversale acceptée le 7 octobre 2026 — **structure DOM des BDC,
  Fini** : seuls restent les éléments HTML qui remplissent une fonction
  vérifiée (sémantique, mise en page/cadrage, interaction ou montage CodPlay).
  Les parts de montage seules sont des commentaires. Les contenus texte
  facultatifs vides ne produisent pas de perso ni de balise ; un hôte Question
  n’est présent que si son titre ou son illustration existe. Le paragraphe de
  retour du Quiz reste un perso caché `aria-live`, car CodPlay y affiche le
  résultat après validation. Les branches et titres du BDC Résultat, le
  formulaire/fieldset, les médias, grilles, cadres de ratio et boutons gardent
  leur rôle. Le wrapper `body` de Section est la frontière contractuelle du HTML
  Tiptap et reste en place. Le wrapper Photo reste disponible pour un futur
  `<picture>`/une légende ou des `<track>` vidéo. Le wrapper `frame` du Carousel
  Flux a été retiré : le commentaire d’insertion Capsule suffit et la grille
  garde Capsule et navigation comme enfants directs ; les règles CSS dédiées à
  l’ancien wrapper et ses classes obsolètes du root Diapo ont aussi été
  retirés. Le preset `Message`, qui
  n’était ni sélectionnable ni pris en charge par le builder, a été retiré ; la
  configuration contient maintenant seulement les quatre layouts Carte
  contractuels et les presets consommés par les autres BDC. Les tests vérifient
  les sorties vides et remplies, et les variantes Flux/Diapo. 22 fichiers de
  tests (163 tests), typecheck et build passent. Safari MCP vérifie une vraie
  composition Sighty/CodPlay du Carousel Flux : Capsule et `nav` sont enfants
  directs de sa racine, aucun wrapper `frame` n’existe, le ratio calculé est
  16:9, l’image charge et les points sélectionnent les deux vues. Le build garde
  son avertissement de chunk supérieur à 500 kB. Les preuves détaillées sont
  dans les spécifications [Question](../specs/question-bdc-spec.md),
  [Résultat](../specs/chapter-evaluation-spec.md), [Carte/Carousel](../specs/carousel-bdc-spec.md),
  [Flux](../specs/flux-scene-builder-spec.md) et [Diapo](../specs/diapo-scene-builder-spec.md).
- Acceptation du 6 octobre 2026 : Brave DevTools sur le serveur de référence
  5175 vérifie les trois chemins avec une page suivante : la Carte autonome
  déverrouille « Suivant » dès son affichage, le Quiz après validation et le
  Carousel manuel à deux vues après sélection de la dernière vue. Le Carousel
  garde le bouton verrouillé avant cette sélection. Les parcours restent sur
  la scène Diapo et ne produisent pas d’erreur console. Un test player vérifie
  le nom exact `elce:page:finished`, la visibilité publique, `{ pageId }` et
  l’absence de `scene:end` pour le Carousel. Les tests ciblés (30/30) et le
  typecheck passent. La frontière de compilation CodPlay est respectée par un
  `scroll-container` dans la story Carousel ; aucun changement CodPlay ni
  relais Elcé distinct n’est nécessaire. La tranche reste en cours pour le
  comportement vocal décrit ci-dessous.
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

- Le Carousel pourra être inséré dans un BDC Texte, mais la spécification de sa
  version en séquence l’exclut. Confirmer si cette insertion est requise avant
  la fin du POC ou si elle reste après.
- Vérifier dans Brave DevTools que le cadre, la zone de dépôt et l’aperçu chargé
  respectent les ratios 4:3 et 1:1, et que seule la carte active occupe le
  cadre. La version 16:9 a été vérifiée dans le parcours d’acceptation du
  6 octobre 2026.

Pour finaliser les icônes Image et Vidéo de la barre, préciser si leur action
crée un BDC vide à compléter ou lance le choix du média. Le dépôt direct d’un
fichier ou d’une référence du catalogue dans le texte reste le parcours existant
qui crée ou attache média, BDC et ancre par les commandes.
