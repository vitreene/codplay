# Elcé — organisation et titres dans l’éditeur

## Statut

**En cours — création contextualisée des chapitres et des pages Flux/Diapo,
ordre mixte page/chapitre, déplacement par séparateurs, sélection centrale d’un
chapitre et catalogue dans la colonne droite. Le geste de retour d’un BDC posé
au catalogue vient d’être remplacé ; son parcours de validation reste ouvert
dans le plan de construction.**

Cette spécification décrit les commandes visibles pour créer des pages et des
chapitres, ainsi que l’édition de leurs titres dans la zone centrale.

## Ordre du scénario

La racine du scénario est une seule liste ordonnée. Une page autonome et une
entrée de chapitre y sont des éléments frères et peuvent alterner. Les pages
d’un chapitre restent regroupées sous cette entrée et gardent leur ordre
propre. Faire glisser une page racine au-dessus ou au-dessous d’une page ou
d’un chapitre la réordonne dans la liste racine ; faire glisser un chapitre
réordonne son entrée dans cette même liste. Les déplacements passent par les
commandes documentaires du contrôleur XState.

Les lignes de page et de chapitre sont des sources de glisser-déposer, pas des
cibles. Les cibles sont les séparateurs avant chaque entrée et après la
dernière entrée. Le séparateur survolé marque la position d’insertion par un
trait ; les lignes restent sans cadre de dépôt. Dans un chapitre, les pages
utilisent les mêmes séparateurs pour leur réordonnancement et leur placement.

Le POC n’imbrique pas les chapitres : chaque chapitre reste directement sous
la racine du scénario et contient des pages. Il n’affiche donc aucune cible de
dépôt pour créer ou rejoindre un chapitre parent.

## Contrat

Le bandeau du Scénario regroupe le bouton « + », la Corbeille et le Catalogue ;
le réglage de style du projet reste à droite. « + » ouvre à sa droite un menu
flottant avec les quatre créations existantes — Chapitre, Page, Diapo et
Évaluation — dont les commandes gardent leur nom accessible et leur infobulle.
Un clic à l’extérieur ferme le menu, y compris sur une autre commande flottante.
Le menu ne déplace pas les contrôles de la rangée. Les actions Page et Diapo
intégrées aux lignes de chapitre restent iconographiques. Les pages racine
restent sous l’en-tête, sans second titre « Pages à la racine ». La création
d’un chapitre Évaluation passe le type au constructeur de commande
documentaire, qui applique le seuil par défaut configuré de 80 %. Les deux
types de chapitre et les pages sont créés par les commandes XState existantes.
Chaque bouton de page envoie
`page.create` avec son `PagePlacement` explicite : la
création à la racine produit une page sans chapitre du type indiqué, celle du
chapitre l’ajoute à ce chapitre avec le type indiqué. Aucune création ne
choisit implicitement le premier chapitre. Sans nom fourni, la page reçoit le
prochain nom automatique et devient la page sélectionnée.

Le 8 novembre 2026, Safari MCP sur Projet 3 confirme les commandes, le menu et
sa fermeture lorsqu’un clic vise le rail de page. Les comportements de dépôt
dans Corbeille et Catalogue restent à valider dans le plan actif.

Les listes des chapitres et des pages n’affichent pas de puces. Leur texte est
plus petit que le titre « Scénario » ; la corbeille compacte reste au bord droit
de chaque ligne. Les pages gardent un léger retrait sous leur chapitre.

Dans une ligne de chapitre, la poignée et l’icône du type précèdent le nom,
qui s’aligne à gauche et occupe l’espace disponible ; les actions restent à
droite. Un chapitre standard utilise l’icône dossier seule. Un chapitre
d’évaluation utilise l’icône presse-papiers, sans libellé répété ; son nom
automatique est « Évaluation » au lieu de « Chapitre N ». Le nom reste
modifiable. L’action d’ajout de page utilise l’icône Lucide FilePlus dans un
bouton carré de 1,35 rem, à peine plus grand que le bouton de suppression de
1,25 rem. FilePlus, Trash2 et les autres icônes d’interface suivent la hauteur
de capitale avec `block-size: 1cap` et une largeur automatique. Ces tailles
restent adaptées à chaque action ; les icônes gardent 2 px de padding interne
et 4 px d’écart avec leur élément voisin.
L’écart vertical entre les lignes de l’arborescence est de 0,1 rem.

Dans la zone centrale, la rangée d’actions de création se trouve au-dessus des
titres et reste alignée à droite. Le titre de la page sélectionnée est éditable,
avec une taille et une graisse visuellement plus fortes que le titre de
chapitre. Si la page appartient à un chapitre, son titre éditable apparaît
au-dessus du titre de page, avec un espacement net entre les deux. L’icône de
type de chapitre et son nom éditable partagent la même ligne. Une page à la
racine du scénario ou dans le catalogue n’affiche pas de titre de chapitre.
À côté du titre, le bouton de style de la page la cible dans le panneau droit
et ouvre l’onglet « Style ».

Cliquer le nom ou l’icône d’un chapitre sélectionne ce chapitre dans l’état
XState et remplace le contenu central par sa vue de réglages. Pour un chapitre
standard, le titre reste éditable. Pour un chapitre Évaluation, la vue centrale
affiche le seuil fixe du POC et les réglages d’essais décrits dans la
[spécification Évaluation](chapter-evaluation-spec.md). Les changements passent
par `document.apply` et sont conservés dans le document. La sélection d’une page
referme cette vue et rouvre l’éditeur de la page.

La colonne droite précédemment intitulée « Propriétés » accueille la section
« Contenus », avec les onglets « Blocs disponibles » et « Médias ».
L’onglet « Blocs disponibles » liste tous les BDC racines du catalogue, un seul
élément par conteneur ; il ne détache pas ses Cartes enfants. Pour rendre
disponible un BDC racine posé sur la page, l’auteur le fait glisser depuis sa
poignée de placement vers l’onglet « Blocs disponibles ». Aucun groupe ni bouton
de retour par BDC n’est affiché dans la colonne. Les médias réutilisables
restent dans leur onglet distinct. Le retour d’une Carte ancrée continue
d’utiliser le circuit d’ancre.

Le rail de navigation des BDC directs de la page se termine par « Ajouter un
contenu ». Son menu réutilise les créations disponibles et se ferme au clic
extérieur, y compris si le clic ouvre une autre commande flottante. Safari MCP
sur Projet 3 confirme l’ouverture puis la fermeture du menu par clic dans le
contenu de la page et dans une autre commande ; le comportement est porté par
[`learning-page-editor.tsx`](../src/mods/learning/authoring/learning-page-editor.tsx).

### Cadres des BDC directs

Chaque BDC direct de la page est rendu dans son propre `.elce-page-bdc` :
fond clair, bordure pleine, coins arrondis et `1rem` d’espace intérieur. Le
conteneur commun porte l’unique cadre extérieur ; la racine de l’éditeur BDC
direct perd son fond, sa bordure, son arrondi et son padding propres pour éviter
un double cadre. Cela couvre Section, Question, Résultat, Carousel, Carte
(dont Avatar) et Graphe. Les éditeurs imbriqués, comme les Cartes d’un Carousel,
gardent leur style intérieur. Les séparateurs d’insertion restent les cibles
de déplacement entre les cadres.

Le 8 novembre 2026, Safari MCP sur Projet 3 confirme sur les BDC Avatar et
Carousel les dimensions calculées du conteneur : padding de `16px`, bordure
pleine de `1px` couleur `#d9d4c9`, coins de `6.4px` et fond `#fffdf8`. À 800 px
et 1139 px, les cadres gardent leur largeur disponible et le document ne
déborde pas horizontalement. L’outil de capture Safari MCP a renvoyé une image
entièrement vide ; la vérification porte donc sur le DOM et les styles
calculés, pas sur une inspection visuelle de la capture.

L’onglet « Profil » apparaît quand un champ textuel compatible a le focus et que
le document contient des propriétés de profil. Il contient l’unique contrôle
d’insertion ; la sélection d’un autre contexte le retire. Les champs simples et
la Section Tiptap insèrent la référence stable de la propriété dans leur format
respectif. Le bouton « Sommaire » du Scénario ouvre les réglages du Sommaire et
du profil et utilise la même icône que « Test auteur » dans la popup de preview.

Chaque colonne latérale peut être réduite indépendamment. La commande porte le
nom accessible « Réduire le panneau Scénario » ou « Réduire le panneau
Contenus » et utilise l’icône Lucide de repli du côté concerné (`PanelLeftClose`
ou `PanelRightClose`). Dans les deux panneaux, la commande occupe la même
position en haut à droite, au contact du bord du conteneur et au-dessus du
contenu. Celle de Contenus reste dans sa rangée au-dessus des onglets.
Après réduction, la commande de réouverture apparaît dans la barre d’actions, à
gauche de « Prévisualiser » pour Scénario et à droite pour Contenus. Réduire une
colonne rend sa largeur à la zone centrale et laisse l’autre colonne en place.
Les panneaux restent dans la grille et ne recouvrent pas la page centrale.

À 1200 px et moins, Contenus est fermé par défaut et son bouton de réouverture
apparaît au bord droit de la zone centrale. Entre 801 et 1200 px, Scénario reste
à gauche ; Contenus peut s’ouvrir à droite, les trois colonnes restant côte à
côte. À 800 px et moins, les deux panneaux sont fermés par défaut ; leurs
boutons encadrent la zone centrale et un seul panneau peut être ouvert à la
fois. Le panneau ouvert et la zone centrale partagent la largeur disponible ;
quand les deux panneaux sont fermés, le centre utilise toute la largeur.

Les commandes restent de vrais boutons accessibles, avec un nom décrivant
l’action, `aria-expanded` et `aria-controls`. Entrée ou Espace active la
commande ; Échap réduit le panneau et rend le focus à son bouton de réouverture.
Le bandeau affiche uniquement le nom « Elcé ».

La barre de commandes située au-dessus de la zone centrale garde « Prévisualiser »
à toutes les largeurs. Les commandes des panneaux partagent cette barre quand
elles sont affichées : à 800 px et moins, la commande Scénario est à gauche,
Prévisualiser au milieu et Contenus à droite ; entre 801 et
1200 px, Prévisualiser précède la commande Contenus à droite.
Au-delà de 1200 px, seul
« Prévisualiser » reste dans cette barre, les deux panneaux étant visibles.
L’erreur d’ouverture de la fenêtre de lecture y reste annoncée avec `role="alert"`.
Le bouton continue d’appeler la même action de preview du workspace, affiche une
icône Œil à côté de son libellé et a la même hauteur minimale de 2,25 rem que le
bouton Catalogue adjacent. Le 8 novembre 2026, Safari MCP sur Projet 3 confirme
une hauteur calculée de 36 px pour chacun. Une marge basse de `0.5rem` sépare
cette rangée du contenu central. Safari MCP mesure 8 px entre le bas de la barre
et le haut de la page à 800 px et à 1139 px, sans débordement horizontal à
800 px.

La barre d’ajout de page est rendue dans
`#elce-remix-page-editor-host-container`, hors de `#elce-work-area` et avant
celui-ci dans `#elce-page-editor-layout`. Elle affiche les libellés « Texte »,
« Quiz »,
« Carousel », « Carte » et « Graphe » sous leurs icônes. Le nom accessible et
l’infobulle de chaque bouton gardent la description complète. Ces commandes
conservent leurs actions ; au repos, elles n’ont ni fond ni contour et gardent
un padding de `0.5rem`. Au survol, les boutons actifs reçoivent un fond clair.
Le bouton Quiz utilise ListChecks, sans point
d’interrogation. La Question reste unique par page ; après son ajout, son
bouton est désactivé. Une page créée dans un chapitre Évaluation reçoit déjà
son BDC Question initial ; une page d’un chapitre standard reçoit un BDC
Section.

Sur une page Flux d’un chapitre Évaluation, une icône BadgeCheck ajoute à la
même séquence un BDC Résultat qui regroupe les branches Réussite et Échec.
Chaque branche permet d’éditer un message et de choisir une action dans les
options configurées. La whitelist de l’icône est une règle d’interface ; le
modèle de données ne transforme pas la page ni le BDC. La corbeille du bloc
envoie la commande `bdc.evaluation-result.delete` pour retirer ce BDC placé de
la page.

Les éditeurs Section, Question et Résultat proposent chacun une corbeille pour
supprimer leur BDC de la page. Supprimer une Section supprime aussi les Cartes
ancrées qui lui appartiennent, sans supprimer les ressources média. Si la
page devient vide, la barre permet toujours de créer Texte ou Quiz.

Les champs de titre envoient au contrôleur XState chaque nouvelle valeur non
vide pendant la saisie, par `document.apply` et la commande `page.rename` ou
`chapter.rename`. La liste du Scénario lit le nom actualisé depuis le document
détenu par XState. Avec la Preview synchronisée, son titre de page ou son
sommaire reçoit aussi les changements immédiatement, sans changer la page
affichée. Les frappes d’un même champ forment une seule étape d’historique.

Un espace final reste provisoirement dans le champ pendant que l’auteur
continue sa saisie ; il est envoyé avec le mot suivant ou normalisé au blur.
Les espaces de bord sont retirés au blur. Si le brouillon est vide ou composé
d’espaces, le champ retrouve sa dernière valeur valide et aucune commande de
renommage n’est envoyée. Le modèle met à jour son nom sans changer les
identifiants, l’ordre, l’affectation ou les BDC.

Dans Remix, `ProjectApplication` compose le Scénario, les réglages centraux du
chapitre, le catalogue et `RemixPageEditor` depuis le sélecteur
`selectEditorViewModel`. Le page editor natif rend les titres, les commandes,
la séquence `page.bdcIds` et les séparateurs de BDC ; déplacer une ligne passe
par `EditorActionsFacade.moveBdc` vers le même acteur XState. La Section se
rend dans sa ligne via `SectionTiptapAdapter`. Question, Résultat, Carte
autonome et Carousel sont également rendus dans leurs lignes Remix et utilisent
les façades XState existantes ; les Cartes enfants partagent les champs Carte.
Le Scénario, le catalogue et les réglages de chapitre restent des vues Remix
séparées.

## Preuves

- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) vérifie les
  icônes accessibles pour chapitre standard, chapitre Évaluation et pages,
  l’envoi par XState, le seuil de 80 %, leur emplacement de création, le
  regroupement côte à côte des commandes, le nom automatique et la sélection
  de la page créée. Les tests couvrent aussi l’ordre mixte page/chapitre, le
  déplacement d’une page racine avant et après un chapitre, le réordonnancement d’un chapitre et des pages
  de chapitre par séparateurs, l’absence de dépôt sur les lignes, et l’édition
  centrale des titres via XState.
- [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx)
  vérifie les créations Flux et Diapo à la racine et dans un chapitre, l’ordre
  mixte des entrées racine, les déplacements par séparateurs, les onglets du
  catalogue (dont l’onglet Profil contextuel), l’insertion d’une variable dans
  un champ actif, le titre « Contenus » et l’icône « Sommaire » partagée.
  Il confirme aussi que l’unique bouton « Prévisualiser » reste dans la barre
  de commandes en vue page et chapitre, appelle l’action du workspace et garde
  son alerte d’ouverture à cet emplacement.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  vérifie que la sélection d’un chapitre par la surface Remix native met à
  jour la zone centrale depuis le même acteur XState et que la zone page active
  monte le page editor Remix avec les éditeurs BDC natifs à leurs emplacements.
- [`workspace/page-editor.test.tsx`](../src/app/remix/workspace/page-editor.test.tsx)
  vérifie les cinq types de BDC, l’ordre direct, l’édition des champs et médias,
  les Cartes enfants, le déplacement par séparateur, les placements directs de
  Carte Flux et Diapo, le changement de page et le désabonnement XState. Un
  parcours intégré du catalogue et de l’éditeur de page vérifie aussi le
  déplacement d’une Carte disponible vers une page puis son retour au catalogue
  en la faisant glisser depuis sa poignée de placement vers l’onglet « Blocs
  disponibles ». Le test vérifie aussi que la rangée d’actions précède le groupe
  des titres dans l’éditeur de page.
- Le 9 octobre 2026, Brave confirme dans l’éditeur que la colonne ne contient
  plus le groupe « Blocs dans la page » : le retour au catalogue se fait depuis
  la poignée de placement du BDC.
- Le 9 octobre 2026, Brave vérifie le layout responsive sur 5175 : à 1024 px,
  l’ouverture de Contenus garde les trois colonnes visibles ; à
  390 px, les deux panneaux fermés laissent la zone centrale seule, et chaque
  panneau ouvert prend sa propre colonne (137/205 px pour Scénario,
  205/137 px pour Contenus). Échap ferme le panneau et rend le
  focus au bouton. Le document ne déborde pas horizontalement.
- Le 2 novembre 2026, Brave vérifie la réduction indépendante à 1280 px : chaque
  réduction agrandit le centre de 640 à 944 px sans déplacer l’autre panneau.
  À 800 px, les deux panneaux sont fermés par défaut ; ouvrir Contenus après
  Scénario referme Scénario, et le document reste à 800 px sans débordement.
  À 855 px, Entrée ouvre Contenus et place le focus sur sa commande de réduction ;
  Échap le réduit et rend le focus à sa commande de réouverture. Le module
  `workspace-panel-state.ts` et son contrôle sont servis sans 404. À 855 px avec
  Scénario ouvert, Contenus reste dans la colonne de droite malgré le bouton
  Scénario masqué ; Prévisualiser demeure centré. À 780 px, les trois commandes
  restent respectivement à gauche, au centre et à droite ; à 1280 px, la preview
  reste centrée lorsque les deux commandes latérales sont masquées.
- Le 2 novembre 2026, Brave confirme que le bouton de style adjacent au titre
  d’une page cible cette page et ouvre l’onglet « Style » du panneau droit.
- Le 2 novembre 2026, Brave vérifie les commandes « Réduire le panneau
  Scénario » et « Réduire le panneau Contenus », leurs icônes de repli latérales
  et leur alignement au même coin supérieur droit, contre le bord du conteneur,
  à 855 px. Dans Contenus, la commande est dans une rangée au-dessus des onglets.
  Réduire puis rouvrir chaque panneau met à jour son état et restitue le focus à
  la commande correspondante.
- [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
  vérifie l’édition Section et les parcours d’ancre/média dans le page editor
  de production.
- [`controller-machine.test.ts`](../src/mods/learning/integration/controller-machine.test.ts)
  vérifie que l’événement `page.create` conserve le placement explicitement
  demandé et sélectionne la page produite, et que la sélection de chapitre
  passe par le contrôleur puis se ferme lors de la sélection d’une page.
- [`editor-actions-facade.test.ts`](../src/app/facades/editor-actions-facade.test.ts)
  vérifie que la création, le renommage et la sélection de pages empruntent
  l’acteur XState existant.
- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie le renommage immuable, le refus d’un nom vide et la validation des
  réglages persistés d’un chapitre Évaluation.
- Safari MCP sur l’application Elcé confirme les icônes de création côte à
  côte, les listes sans puces, le retrait des pages sous les chapitres et les
  corbeilles compactes à droite des lignes, ainsi que les champs centraux des
  titres de page et de chapitre. Le 4 octobre 2026, Safari vérifie que l’icône
  et le champ de titre du chapitre occupent la même ligne centrale.
- Brave DevTools, le 22 octobre 2026, vérifie dans l’éditeur de Demo5 la rangée
  d’actions au-dessus des titres, le titre de page en 1,5 rem / graisse 750 et
  son espacement distinct du titre de chapitre en 0,82 rem / graisse 500. Le
  document reste « Synchronisé » pendant cette vérification visuelle.
- Le 4 octobre, Safari MCP confirme qu’une page racine créée apparaît comme
  sœur du chapitre, qu’elle peut être déplacée avant et après celui-ci par les
  gestionnaires de glisser-déposer de l’application, puis que sa suppression
  rétablit le document de test.
- Le 4 octobre, Safari MCP exerce les gestionnaires des séparateurs de la
  racine et d’un chapitre : le dépôt réordonne les entrées, le dépôt sur une
  ligne ne le fait pas, et le séparateur actif reçoit la couleur de trait
  prévue par la feuille CSS. Une capture Safari montre ce trait ; après
  `dragleave`, le séparateur redevient transparent. La suite actuelle compte
  15 fichiers de tests et 104 tests ; le typecheck et le build passent.
- Le 4 octobre, Safari MCP clique l’icône « Ajouter un chapitre Évaluation »
  et confirme l’apparition du chapitre dans la liste. Le chapitre vide est
  supprimé ensuite par son action de suppression afin de restaurer le document
  utilisé pour le test. Le type, le seuil et les réglages persistés sont
  vérifiés dans [`chapter-settings.test.tsx`](../src/app/remix/workspace/chapter-settings.test.tsx)
  contre le document détenu par XState.
- Safari MCP, le 25 octobre, vérifie que les SVG Lucide de l’éditeur n’ont plus
  d’attributs de taille fixes, que leur classe applique `block-size: 1cap` et
  que Safari prend en charge cette unité. Les 78 icônes présentes suivent
  ainsi la police de leur commande ; les dimensions de bouton restent propres
  à chaque action.
- Le 4 octobre, Safari MCP crée une page temporaire dans un chapitre standard,
  supprime son BDC Texte initial, confirme que la page reste éditable et ajoute
  une Question avec l’icône ListChecks. La page temporaire est ensuite supprimée.
- Le 4 octobre, Safari MCP clique un chapitre Évaluation déjà présent dans le
  document, affiche le formulaire central avec le seuil de 80 %, la limite
  illimitée et la reprise de toutes les questions, et confirme le catalogue
  dans la colonne droite. Aucun réglage du document de navigateur n’a été
  modifié pendant ce contrôle. Le typecheck, les 16 fichiers de tests (111
  tests) et le build passent.
- Safari Technology Preview via MCP vérifie dans la surface Remix la création
  d’une Diapo à la racine, le dépôt sur un séparateur racine, les onglets du
  catalogue et l’absence d’identifiants DOM dupliqués. Le test du runtime Remix
  vérifie aussi la sélection de chapitre et le remplacement de la zone de
  travail par ses réglages ; la lecture de ces réglages dans Safari reste à
  confirmer.
- `app-layout.test.tsx` vérifie qu’une page Évaluation expose une icône unique
  pour le BDC Résultat, que son clic crée un seul BDC avec ses deux branches,
  que les messages/actions modifiés passent par les commandes XState, et que sa
  corbeille le retire de la page. `document-commands.test.ts` couvre ces
  commandes et leurs invariants. `flux-scene-builder.test.ts` vérifie qu’un
  Résultat configuré compile au travers de CodPlay en une story portant les
  deux issues. Le raccord des événements d’issue au player n’est pas certifié.
- Le 8 octobre, Brave DevTools sélectionne un chapitre Évaluation du projet
  temporaire et vérifie dans la zone centrale le seuil fixe de 80 %, les
  tentatives illimitées et la reprise de toutes les questions. Le projet de
  validation est supprimé ensuite.
- À 1408 px, les trois colonnes restent visibles.
- [`learning-project-application.test.tsx`](../src/mods/learning/authoring/learning-project-application.test.tsx)
  vérifie qu’un titre de page met à jour le modèle et la ligne du Scénario
  pendant la saisie, qu’un brouillon vide ne renomme pas le modèle, que le blur
  restaure la valeur valide et qu’une Annuler regroupe les frappes en une
  étape. [`chapter-settings.test.tsx`](../src/mods/learning/authoring/chapter-settings.test.tsx)
  vérifie la mise à jour immédiate du titre de chapitre. Le 2 novembre 2026,
  Brave sur la copie isolée confirme que les titres de page et de chapitre se
  reflètent immédiatement dans la Preview synchronisée et le sommaire, que la
  page affichée reste la même et que les brouillons vides sont restaurés au
  blur.
- Le 4 octobre, Safari MCP a sélectionné une page Flux d’Évaluation, ajouté le
  BDC Résultat avec son icône BadgeCheck puis supprimé le bloc temporaire depuis
  sa corbeille. Le retrait a conservé la séquence précédente de la page.
