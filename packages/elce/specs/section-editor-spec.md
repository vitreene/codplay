# Elcé — édition d’une Section

## Statut

**Contrat de la ressource vérifié le 28 octobre 2026.** L’éditeur WYSIWYG,
les ancres et la suppression passent par la ressource Section et l’acteur
Learning existant. Le cadre auteur Learning reste suivi dans le plan Mods.

Cette tranche couvre l’édition et la suppression d’une Section Flux. Les
parcours d’ancrage sont décrits dans la [spécification des ancres](./anchor-spec.md).

## Contrat

Le JSON riche de la Section est la source éditable du document métier. Le
builder conserve aussi le HTML statique exporté dans `section.markup` pour la
projection CodPlay. L’auteur ne saisit pas de HTML. `SectionTiptapAdapter`
émet la description typée d’une transaction ; `LearningEditorFacade` la
transmet à `ElceAnchorDropFacade`, puis au contrôleur XState et à sa commande
`bdc.section.update`. La ressource ne possède ni l’agrégat Learning ni sa
mutation documentaire.

La surface Tiptap propose dans le POC :

- les paragraphes et les niveaux de titre `h1` à `h6` ;
- gras, italique, souligné, indice et exposant ;
- alignements gauche, centré, droite et justifié ;
- une barre de commandes compacte en icônes Lucide, avec `aria-label` et
  infobulle pour chaque commande. Les boutons exposent l’état actif de la
  sélection courante via Tiptap (`aria-pressed` et `data-active`) ; un titre H3
  et un texte italique marquent donc simultanément leurs commandes respectives ;
- un champ de titre séparé et facultatif, présenté avec le placeholder
  « Titre » ;
- un placeholder discret dans la zone de contenu vide.

Le modèle métier du contenu riche (`RichTextDocument`, `RichTextNode` et
`SectionContent`) et la création du document vide appartiennent à
[`resources/bdcs/section/domain/`](../src/resources/bdcs/section/domain/).
L’adaptateur Tiptap et la vue Remix les consomment sans changer le JSON émis
ni le HTML exporté.

Le contrat de texte est une contribution optionnelle `SectionTextFeature`.
L’adaptateur fonctionne sans cette contribution ; Learning fournit
`LearningSectionTextFeature` pour ses tokens de profil et ses attributs de
champ. La ressource Section ne lit donc pas la définition du profil.
`SectionEditorSession` possède les adaptateurs et barres d’outils montés ; la
vue lui délègue leur actualisation, la restauration du caret et leur destruction.

Chaque modification passe par la commande `bdc.section.update` du contrôleur
XState, avec le JSON éditable et le HTML statique correspondant.
L’[historique documentaire](./document-history-spec.md) reçoit aussi la
sélection Tiptap avant et après chaque transaction ; l’Undo local de Tiptap
reste désactivé pour préserver une chronologie commune aux pages et aux blocs.
La corbeille du titre envoie `bdc.section.delete` au même contrôleur. Cette
commande retire la Section de sa page, supprime les Cartes ancrées qui lui
appartiennent et conserve leurs ressources média réutilisables.

Dans la page auteur Learning, `renderRemixSectionEditor` utilise
`SectionTiptapAdapter` pour instancier `Editor` depuis `@tiptap/core` et le
monter sur le host fourni par la `ref` Remix, dans la ligne du BDC Section.
Remix rend le titre, la barre et les commandes ; ProseMirror garde le DOM
éditable et ses gestes internes. Les callbacks de dépôt et de transaction
continuent d’appeler `EditorActionsFacade` et le même contrôleur XState. Quand
la source d’un média ancré devient disponible après sa persistance, l’adaptateur
rafraîchit les NodeViews concernées en place : le même Editor et le même DOM
ProseMirror sont conservés pour un changement de source média.

Le plugin intercepte les événements DOM de dépôt de fichiers dans cette même
surface. Sur l’aperçu image d’une Carte ancrée, la vue transmet l’identifiant
de ce BDC à `cardActions.importMediaFile` : le média est remplacé dans le Card
existant, sans nouvelle ancre. En l’absence de position Section valide, le
dépôt est annulé et ne lance aucune commande. L’import accepté et son Undo/Redo
restent la responsabilité du contrôleur XState.
La composition Learning ajoute une garde de dépôt au niveau du document, en
phase de propagation : elle laisse ProseMirror et les sélecteurs média traiter
leurs événements, puis annule le défaut navigateur si aucune cible n’a accepté
le fichier.

## Preuves

- [`section-editor-tiptap-adapter.test.ts`](../src/resources/bdcs/section/authoring/section-editor-tiptap-adapter.test.ts)
  vérifie l’adaptateur sans contribution de texte, puis l’attachement et le
  détachement d’une contribution optionnelle.
- [`section-editor-session.test.ts`](../src/resources/bdcs/section/authoring/section-editor-session.test.ts)
  vérifie la propriété et le cycle de vie des éditeurs montés.
- [`remix-section-production.test.tsx`](../src/mods/learning/integration/remix-section-production.test.tsx)
  vérifie le chemin auteur Learning avec Tiptap Core, les commandes de texte,
  les tokens de profil, l’import d’image par XState, l’actualisation de la
  source média sans remonter l’Editor, le dépôt d’une image sur une Carte
  ancrée sans changer son identifiant, Undo/Redo de l’import et le déplacement
  d’ancre.
- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie la conservation conjointe du JSON et du HTML exporté, ainsi que la
  suppression de la Section et de ses BDC ancrés en conservant les médias.
- [`learning-page-editor.test.tsx`](../src/mods/learning/authoring/learning-page-editor.test.tsx)
  vérifie les gestes auteur de placement et de suppression des BDC.
- [`flux-scene-builder.test.ts`](../src/mods/learning/integration/flux-scene-builder.test.ts)
  vérifie que le builder porte le markup statique dans la scène Flux.
- Le 8 octobre, Brave DevTools dépose un fichier PNG synthétique sur la Section
  Tiptap de la page Remix de production. La commande XState crée une Carte
  ancrée et son image s’affiche dans le même éditeur depuis l’URL média serveur
  après confirmation du transfert. Le parcours de preview est décrit dans la
  [spécification du lecteur](./player-preview-spec.md).
- Le 28 octobre, Safari MCP sur `http://localhost:5175/` modifie le contenu
  d’une Section et constate `PUT /document` `200` (révision 15). Le dépôt des
  références catalogue de Carte et Graphe dans cette même Section enregistre
  les révisions 16 et 18 ; le serveur conserve les mêmes BDC sous
  `parentBdcId: bdc-section-1` et vide le catalogue. Dans le même projet
  temporaire, un PNG de 169 octets déposé par `DataTransfer` synthétique sur le
  vrai éditeur ProseMirror crée une ancre persistée (révision 27), puis son
  média est chargé (`PUT` `201`, `GET` `200`). La preview réelle Sighty/CodPlay
  affiche l’image API décodée en `2 × 2 px` sans ancre d’édition. Le MCP valide
  le gestionnaire réel du navigateur, pas un glisser physique depuis Finder.
  Le test Remix/XState ci-dessus couvre l’import et la conservation de
  l’Editor pendant l’actualisation de sa source média.
- Le 28 octobre, Safari MCP (`5175`) exerce la cible image de la Carte ancrée
  sur Page D MCP : le même identifiant Card est conservé et l’état revient à
  l’image originale après le contrôle Undo/Redo. Un dépôt sans position
  ProseMirror ou sur le fond de la page est consommé sans navigation ni
  sauvegarde documentaire.

## Limites de la tranche

Le JSON est conservé dans IndexedDB avec le document Elcé. Une migration
complète des anciennes versions de document devra être ajoutée si le schéma
riche évolue ; la lecture actuelle fournit un contenu Section vide lorsqu’un
ancien bdc n’en possède pas encore.
