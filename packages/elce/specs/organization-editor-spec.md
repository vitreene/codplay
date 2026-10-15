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

Dans le bandeau du Scénario, les quatre actions de création affichent un
libellé sous l’icône : « Chapitre », « Éval. », « Page » et « Diapo ». Les
actions Page et Diapo intégrées aux lignes de chapitre restent iconographiques,
avec nom accessible et infobulle complets. Les boutons de création du bandeau
sont regroupés côte à côte ; les pages racine restent sous cet en-tête, sans
second titre « Pages à la racine ». La
création d’un chapitre Évaluation passe le type au constructeur de commande
documentaire, qui applique le seuil par défaut configuré de 80 %. Les deux
types de chapitre et les pages sont créés par les commandes XState existantes.
Chaque bouton de page envoie
`page.create` avec son `PagePlacement` explicite : la
création à la racine produit une page sans chapitre du type indiqué, celle du
chapitre l’ajoute à ce chapitre avec le type indiqué. Aucune création ne
choisit implicitement le premier chapitre. Sans nom fourni, la page reçoit le
prochain nom automatique et devient la page sélectionnée.

Les listes des chapitres et des pages n’affichent pas de puces. Leur texte est
plus petit que le titre « Scénario » ; la corbeille compacte reste au bord droit
de chaque ligne. Les pages gardent un léger retrait sous leur chapitre.

Dans une ligne de chapitre, la poignée et l’icône du type précèdent le nom,
qui s’aligne à gauche et occupe l’espace disponible ; les actions restent à
droite. Un chapitre standard utilise l’icône dossier seule. Un chapitre
d’évaluation utilise l’icône presse-papiers, sans libellé répété ; son nom
automatique est « Évaluation » au lieu de « Chapitre N ». Le nom reste
modifiable. L’action d’ajout de page utilise l’icône Lucide FilePlus de 14 px
dans un bouton carré de 1,35 rem, à peine plus grand que le bouton de
suppression de 1,25 rem. L’icône Lucide Trash2 du bouton de suppression a la
même taille de 14 px. Ces dimensions restent adaptées à chaque action ; les
icônes gardent 2 px de padding interne et 4 px d’écart avec leur élément voisin.
L’écart vertical entre les lignes de l’arborescence est de 0,1 rem.

Dans la zone centrale, le titre de la page sélectionnée est éditable. Si cette
page appartient à un chapitre, le titre de ce chapitre apparaît au-dessus et
est éditable lui aussi. L’icône de type de chapitre et son nom éditable partagent
la même ligne. Une page à la racine du scénario ou dans le catalogue n’affiche
pas de titre de chapitre.

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

L’onglet « Profil » apparaît quand un champ textuel compatible a le focus et que
le document contient des propriétés de profil. Il contient l’unique contrôle
d’insertion ; la sélection d’un autre contexte le retire. Les champs simples et
la Section Tiptap insèrent la référence stable de la propriété dans leur format
respectif. Le bouton « Sommaire » du Scénario ouvre les réglages du Sommaire et
du profil et utilise la même icône que « Test auteur » dans la popup de preview.

À 1200 px et moins, la colonne « Contenus » est masquée et son bouton iconique
sans fond ni contour apparaît au bord droit de la zone centrale.
L’ouverture ajoute la colonne de contenus à droite et réduit la zone centrale,
qui reste visible. À 800 px et moins, les deux panneaux latéraux sont masqués
au départ ; leurs commandes iconiques sans fond ni contour encadrent la zone
centrale. Ouvrir Scénario ajoute sa colonne à gauche ; ouvrir Contenus ajoute sa
colonne à droite. Un seul panneau latéral peut être ouvert à la fois.
Les commandes restent de vrais boutons accessibles, avec un nom décrivant
l’action, `aria-expanded` et `aria-controls` ; Échap ferme le panneau et rend le
focus à sa commande. Les panneaux occupent la grille et ne recouvrent pas la page
centrale. Aucune surcouche ne masque la page ni ne piège le focus.

Entre 801 et 1200 px, Scénario reste dans la colonne gauche ; lorsque le panneau
Contenus est ouvert, les trois colonnes restent côte à côte. À 800 px
et moins, le panneau ouvert et la zone centrale occupent chacun une colonne ;
quand les deux panneaux sont fermés, la zone centrale occupe toute la largeur.
Au-delà de 1200 px, les trois colonnes restent visibles et les commandes
responsive disparaissent. Le bandeau affiche uniquement le nom « Elcé ».

La barre de commandes située au-dessus de la zone centrale garde « Prévisualiser »
à toutes les largeurs. Les commandes des panneaux partagent cette barre quand
elles sont affichées : à 800 px et moins, la commande Scénario est à gauche,
Prévisualiser au milieu et Contenus à droite ; entre 801 et
1200 px, Prévisualiser précède la commande Contenus à droite.
Au-delà de 1200 px, seul
« Prévisualiser » reste dans cette barre, les deux panneaux étant visibles.
L’erreur d’ouverture de la fenêtre de lecture y reste annoncée avec `role="alert"`.
Le bouton continue d’appeler la même action de preview du workspace.

La barre d’ajout de page affiche les libellés « Texte », « Quiz »,
« Carousel », « Carte » et « Graphe » sous leurs icônes. Le nom accessible et
l’infobulle de chaque bouton gardent la description complète. Le bouton Quiz
utilise ListChecks, sans point d’interrogation. La Question reste unique par
page ; après son ajout, son bouton est désactivé. Une page créée dans un
chapitre Évaluation reçoit déjà son BDC Question initial ; une page d’un
chapitre standard reçoit un BDC Section.

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

Les champs de titre gardent leur saisie dans le DOM pendant l’édition. Le
changement est envoyé au contrôleur XState à la perte de focus ou avec Entrée,
par `document.apply` et la commande `page.rename` ou `chapter.rename`. Les
espaces de bord sont retirés ; si le nom est vide, l’ancienne valeur est remise
dans le champ et aucune commande n’est envoyée. Le modèle met à jour son nom
sans changer les identifiants, l’ordre, l’affectation ou les BDC. La liste à
gauche lit les noms actualisés depuis le document détenu par XState.

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
  disponibles ».
- Le 9 octobre 2026, Brave confirme dans l’éditeur que la colonne ne contient
  plus le groupe « Blocs dans la page » : le retour au catalogue se fait depuis
  la poignée de placement du BDC.
- Le 9 octobre 2026, Brave vérifie le layout responsive sur 5175 : à 1024 px,
  l’ouverture de Contenus garde les trois colonnes visibles ; à
  390 px, les deux panneaux fermés laissent la zone centrale seule, et chaque
  panneau ouvert prend sa propre colonne (137/205 px pour Scénario,
  205/137 px pour Contenus). Échap ferme le panneau et rend le
  focus au bouton. Le document ne déborde pas horizontalement.
- [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
  vérifie l’édition Section et les parcours d’ancre/média dans le page editor
  de production.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
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
- Le 9 octobre, Brave sur 5175 confirme dans l’arborescence le rendu uniforme
  des icônes FilePlus et Trash2 en 14 × 14 px, avec leurs gabarits distincts
  conservés. Les icônes de type de chapitre et de page dans la zone centrale
  mesurent également 14 × 14 px.
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
- Le 4 octobre, Safari MCP a sélectionné une page Flux d’Évaluation, ajouté le
  BDC Résultat avec son icône BadgeCheck puis supprimé le bloc temporaire depuis
  sa corbeille. Le retrait a conservé la séquence précédente de la page.
