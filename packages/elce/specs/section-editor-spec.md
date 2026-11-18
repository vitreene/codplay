# Elcé — édition d’une Section

Cette spécification décrit l’édition d’une Section Flux. Les parcours
d’ancrage sont décrits dans la [spécification des ancres](./anchor-spec.md).

## Contrat

Le JSON riche de la Section est la source éditable du document métier. Le
builder conserve aussi le HTML statique exporté dans `section.markup` pour la
projection CodPlay. L’auteur ne saisit pas de HTML. `SectionTiptapAdapter`
émet la description typée d’une transaction ; `LearningEditorFacade` la
transmet à `ElceAnchorDropFacade`, puis au contrôleur XState et à sa commande
`bdc.section.update`. La ressource ne possède ni l’agrégat Learning ni sa
mutation documentaire.

La surface Tiptap propose dans le POC :

- les paragraphes et les commandes de titre `h1` à `h3` dans la barre ; le
  schéma Tiptap garde la lecture des niveaux `h1` à `h6` pour préserver les
  contenus existants ;
- gras, italique, souligné, indice et exposant ;
- alignements gauche, centré, droite et justifié ;
- [points de suite](./section-dot-leader-spec.md) : commande « … » appliquée
  au paragraphe entier, avec deux zones de texte et un filet extensible ;
- insertion du BDC Liste à points par un bouton placé près de cette commande ;
  le NodeView du bloc reste au point d’insertion et présente par défaut le rendu
  de la Liste. Le bouton circulaire Settings2 ouvre l’éditeur Liste partagé au
  même emplacement ; son bouton « Mode vue » revient au rendu. Un contour
  tireté gris clair `#9da9a5` de `2px` identifie le BDC dans les deux modes ;
  la bascule reste locale à l’éditeur et ne modifie pas le document. Le bouton
  de mode garde une zone de `2.5rem`, un cercle de `1.4rem` et une icône de
  `0.7rem`. La poignée de déplacement mesure également `1.4rem`. Les deux
  cercles reprennent les positions symétriques des contrôles du cadre image :
  ils occupent les angles supérieurs gauche et droit, avec un retrait de
  `0.5rem` au bord extérieur du cadre. Le placement est relatif au cadre et
  indépendant du padding du contenu ; les coordonnées corrigent l’épaisseur de
  bordure de `2px` de la Liste.
  La poignée `↕` déplace le bloc dans le même éditeur Tiptap. Un dépôt dans un
  paragraphe le place après le paragraphe entier, sans scinder son texte ni
  dupliquer le BDC.
  Le conteneur de flux du NodeView garde une marge basse de `0.35rem`, comme
  les paragraphes de Section, pour séparer la Liste du contenu suivant.
  L’en-tête conserve sa place dans le flux. En mode vue, l’espace sous le bouton
  d’édition est réduit de `0.5rem`
  et les items successifs sont séparés par `0.5rem`. Le cadre suit la largeur disponible du
  flux et ne passe pas sous une Carte ancrée qui
  flotte à côté du texte. En mode édition, le cadre réserve `1rem` de padding ;
  Préfixe, Départ pour les préfixes ordonnés, Transition et Délai
  restent sur une seule rangée flex, qui défile horizontalement si nécessaire.
  Le champ Départ utilise une base flex dimensionnée pour afficher trois
  chiffres.
  Préfixe montre les marqueurs
  directement (`•`, `▪`, `–`, `a.`, `1.`, `i.`) ; le choix sans marqueur
  s’intitule « Aucun » et un marqueur personnalisé est suivi de
  « Personnalisé ». Transition choisit l’apparition des items du BDC Liste et
  Fondu est la valeur initiale. Le délai commun, libellé « Délai », reste
  toujours visible ; seuls les délais propres aux lignes sont repliés derrière
  Clock. Après validation avec Entrée ou dès que le champ numérique perd le
  focus, la saisie de ligne se replie, y compris si le focus passe à l’icône
  Clock. Son titre affiche la durée en secondes au format français ; pour une
  ligne qui hérite du délai commun, le titre indique aussi cette valeur héritée.
  Les commandes Clock partagent le même bouton `1.7rem` et la même icône SVG
  `0.75rem`, quelle que soit la taille de police héritée du libellé.
  Le glisser-déposer affiche un filet de `2px` au-dessus ou au-dessous de la
  ligne visée selon la position du pointeur ; avant la première et après la
  dernière ligne, ce filet marque les extrémités de la Liste. Ajouter une ligne
  utilise le même bouton carré que la poignée de réordonnancement ;
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
champ. La ressource Section ne lit donc pas la définition du profil. Les
projections auteur et lecteur injectées par chaque composition suivent le
[contrat de projection du texte riche](./resource-text-projection-spec.md).
La lecture de la page suit la [spécification du lecteur](./player-preview-spec.md).
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

## Tests de référence

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

## Limites de la tranche

Le JSON est conservé dans IndexedDB avec le document Elcé. Une migration
complète des anciennes versions de document devra être ajoutée si le schéma
riche évolue ; la lecture actuelle fournit un contenu Section vide lorsqu’un
ancien bdc n’en possède pas encore.
