# Elcé — organisation et titres dans l’éditeur

## Statut

**Fixe — création contextualisée des chapitres et des pages Flux/Diapo, ordre
mixte page/chapitre, déplacement par séparateurs, sélection centrale d’un
chapitre et catalogue dans la colonne droite. Les surfaces Remix sont
implémentées et vérifiées en tests ; la vérification Safari des réglages
centraux reste ouverte dans le plan de migration.**

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

Les actions de création sont des boutons Lucide sans libellé visible, avec nom
accessible et infobulle. Dans l’en-tête « Scénario », deux icônes créent un
chapitre standard ou un chapitre Évaluation ; deux autres créent à la racine
une page Flux ou une Diapo. Chaque chapitre propose séparément la création
d’une page Flux et d’une Diapo. Les boutons de création sont regroupés côte à
côte ; les pages racine restent sous cet en-tête, sans second titre « Pages à
la racine ». La
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
même taille de 14 px. L’écart vertical entre les lignes de l’arborescence est
de 0,1 rem.

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
« Contenus disponibles », avec les onglets « Blocs disponibles » et « Médias ».
Les interactions de dépôt et de retrait restent identiques. Quand une page est
sélectionnée, les médias de cette page non ancrés restent accessibles sous le
catalogue dans cette même colonne.
À 1200 px et moins, cette colonne est remplacée par un bouton d’accès à icône ;
placé sur la même ligne que le titre « Elcé ». Ce bouton ouvre le même catalogue
dans un tiroir depuis la droite. À 800 px et moins, le Scénario devient lui aussi
un tiroir, ouvert par son icône placée avant celle du catalogue. Ces deux tiroirs
sont exclusifs. Entre 801 et 1200 px, le Scénario reste dans la colonne gauche et
la zone de travail centrale souple occupe l’espace restant ; à 800 px et moins,
elle occupe toute la largeur disponible. Les boutons restent dans le bandeau du
titre, dans le flux normal de la page. Chaque tiroir se ferme par son bouton,
par Échap ou en cliquant le fond, puis rend le focus à son bouton d’accès.
Au-delà de 1200 px, les trois colonnes restent visibles et les boutons d’accès
disparaissent. Le bandeau affiche uniquement le nom « Elcé ».

Au-dessus des BDC de la page Flux, les icônes « Texte » et « Quiz » ajoutent
respectivement un BDC Section et un BDC Question à la fin de leur séquence.
L’icône Quiz utilise ListChecks, sans point d’interrogation. La Question reste
unique par page ; après son ajout, son icône est désactivée. Une page créée dans
un chapitre Évaluation reçoit déjà son BDC Question initial ; une page d’un
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
chapitre et le catalogue depuis le sélecteur `selectEditorViewModel`. Les
commandes passent par `EditorActionsFacade` vers l’acteur XState existant ; la
vue ne possède pas de document séparé. Le glisser-déposer des pages utilise les
séparateurs d’insertion. Le pont React temporaire ne rend plus que la zone de
travail de la page sélectionnée ; il ne rend pas le Scénario, le catalogue ni
les réglages de chapitre.

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
  catalogue et l’ouverture des réglages centraux d’un chapitre.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  vérifie que la sélection d’un chapitre par la surface Remix native met à
  jour la zone centrale depuis le même acteur XState.
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
  utilisé pour le test. Le type et son seuil sont vérifiés par le test React
  contre le document détenu par XState.
- Le 4 octobre, Safari MCP confirme les boîtes SVG de 14 × 14 px pour FilePlus
  et Trash2 dans la liste ; le CSS empêche le flex de réduire la corbeille.
  `app-layout.test.tsx` vérifie qu’un chapitre d’évaluation reçoit le nom
  « Évaluation » sans texte de type dupliqué et que ses icônes d’ajout et de
  suppression mesurent 14 px.
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
- Le 6 octobre 2026, Brave vérifie le repli à 1024 px : la zone centrale passe
  de 384 à 688 px et le panneau devient un accès latéral. À 390 × 844 px, les
  colonnes restantes s’empilent et le bouton reste accessible ; le tiroir
  conserve le catalogue et les médias, et Échap le ferme en restaurant le
  focus. À 1408 px, les trois colonnes restent visibles.
- Le 4 octobre, Safari MCP a sélectionné une page Flux d’Évaluation, ajouté le
  BDC Résultat avec son icône BadgeCheck puis supprimé le bloc temporaire depuis
  sa corbeille. Le retrait a conservé la séquence précédente de la page.
