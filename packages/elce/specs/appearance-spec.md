# Elcé — apparence du projet, des pages et des BDC

## Portée vérifiée

Elcé conserve les choix d’ambiance dans le document métier, les résout par
propriété et les projette sur les scènes existantes avec des classes CSS.
Cette spécification décrit le modèle v7, les sources CSS, le panneau auteur,
la feuille commune du projet et l’export vérifiés par leurs tests. Demo5 a été
migrée vers v7 et s’ouvre dans l’éditeur ; la validation des styles dans le
lecteur reste suivie dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).

## Catalogue

Les définitions et références du catalogue sont dans
[`appearance-definitions.ts`](../src/config/appearance/appearance-definitions.ts) ;
[`appearance-config.ts`](../src/config/appearance/appearance-config.ts) ajoute
les couleurs lues depuis les CSS par le générateur du picker.
Les cinq palettes partagent six rôles stables : `background`, `surface`,
`text`, `muted`, `accent` et `border`. Les palettes Classique, Océan et Forêt
sont claires ; Prune et Ardoise sont sombres. La palette Classique reprend
notamment le fond `#fffdf8`, le texte `#1d2d35` et l’accent `#263b3a` du
lecteur existant.

Les huit duos restent le seul choix typographique de l’interface. Le document
enregistre `headingFontId` et `bodyFontId` séparément ; choisir ou réinitialiser
un duo renseigne ou retire les deux propriétés ensemble.
Chaque famille Google Fonts a un fichier CSS local. Ces fichiers règlent la
famille et l’interligne qui lui convient. Les règles de mesure sont définies
dans `typography/reading.css` et les feuilles de densité. Une même règle borne
la racine `.bdc` de tous les types : texte, contrôles, layout et médias ancrés
suivent la largeur du bloc. Normal — également conservé par Transparent — borne
la racine à `min(100%, 70ch)`, Compact à `min(100%, 60ch)` et Large à
`min(100%, 81ch)`. Ces valeurs réduisent d’environ 15 % les mesures
précédentes ; elles restent à confronter à la plage visée de 70–95 caractères,
car `ch` ne compte pas exactement les caractères. Il n’y a aucun contrôle
auteur de largeur ou de taille. Le corps Section garde sa taille responsive
`clamp(0.9rem, 0.6cqi + 0.7rem, 1rem)` ; les règles de densité gardent leurs
tailles respectives. La taille minimale est `0.9rem`,
au-dessus du garde-fou de `0.5625rem` (9px à la racine navigateur de 16px). Les
tailles et espacements du contenu utilisent des unités relatives. Le test des sources CSS est dans
[`appearance-scene-style-sheet.test.ts`](../src/player/appearance-scene-style-sheet.test.ts) ;
la calibration visuelle reste suivie dans le plan. Le chrome de l’éditeur est
hors de cette règle.

| Preset | Palette | Duo titraille / texte | Densité |
| --- | --- | --- | --- |
| Classique | Classique | Crimson Text / DM Sans | Normal |
| Océan | Océan | Inter / Krub | Normal |
| Forêt | Forêt | Nunito / PT Sans | Large |
| Prune | Prune | Raleway / Merriweather | Normal |
| Ardoise | Ardoise | Instrument Sans / Geist | Compact |

Les densités sont Aucun (`none`), Compact (`compact`), Normal (`normal`) et
Large (`large`). Les feuilles `densities/*.css` donnent leurs valeurs par rôle.
Normal est le défaut ; après Transparent, choisir une couleur réactive Normal.
Les marges de paragraphe utilisent `0.5em`, `0.75em` et `1em` en Compact,
Normal et Large. L’application utilise le preset Classique avec le contraste
auto désactivé ; ces défauts ne sont pas des réglages auteur.

Les fonctions `getAppearancePalette`, `getAppearanceTypographyPair` et
`getAppearancePreset` retrouvent une référence configurée et lèvent une erreur
sur une référence inconnue. Elles ne substituent aucune valeur et ne lisent
pas le DOM. Les références croisées des presets sont contrôlées par TypeScript.

## Document v7 et résolution

`appearance` est facultatif sur le document, chaque page et chaque BDC. Sa
forme sparse accepte `presetId`, `paletteId`, `headingFontId`, `bodyFontId`, `density`,
`background`, `textColor` et `autoContrast`. Les invariants n’autorisent
`presetId` qu’au niveau du document ; une page ou un BDC ne choisit pas de
preset général.

Pour une cible, chaque propriété prend la valeur explicite la plus proche :

1. le BDC ciblé ;
2. son BDC parent, s’il existe ;
3. sa page ;
4. le document ;
5. les défauts de l’application.

Une page hérite donc du document puis de l’application. Un BDC de catalogue
sans page ni parent hérite du document puis de l’application. Le preset de
document fournit palette, duo, densité, fond et couleur du texte ; les
ajustements explicites du même niveau restent prioritaires. Une valeur absente
hérite implicitement : l’interface n’affiche aucun choix « Hériter » ni aucun
libellé d’origine. Chaque contrôle montre sa valeur effective ; son action
« Réinitialiser » supprime uniquement l’exception locale correspondante.

Une couleur peut référencer un rôle sémantique d’une palette ou conserver une
valeur personnalisée fixe. Le fond n’enregistre pas `transparent` : le choix
Transparent sélectionne `density: 'none'`, qui rend le fond transparent et le
padding nul. Choisir ensuite une couleur restaure Normal. Une référence
sémantique suit les changements de palette qui lui sont applicables ; une
couleur personnalisée ne change pas. Le contraste automatique est un booléen
indépendant et agit uniquement sur la couleur du texte.

Les commandes d’apparence passent par `document.apply`. Elles préservent les
autres champs documentaires. La migration documentaire v6 → v7 ne cible que
Demo5 ; le modèle ne convertit pas automatiquement les autres versions.

## Panneau auteur

Le panneau Style réutilise les mêmes propriétés sur le projet, les pages et
les BDC Section, Carte, Carousel, Question, Résultat et Graphe. Le preset
général n’est affiché qu’au projet. Palette, Fond et Couleur du texte sont
présentés dans le même groupe « Couleurs » ; le contraste est une seule case
« Contraste auto ». Les libellés d’héritage et de provenance ne sont pas
affichés. La typographie se choisit par duo ; l’interface n’expose pas de
sélecteurs de police de titre et de corps séparés.

Une icône Palette ouvre le style du projet depuis l’en-tête Scénario. Chaque
page et BDC possède son bouton de style accessible ; dans l’en-tête d’un BDC,
il est placé à côté de la corbeille et reprend le gabarit d’icône standard.
Les commandes sont reliées au même contrôleur XState et à ses changements
documentaires.

## Projection sur les scènes

Les classes d’apparence sont réutilisables entre les scènes et ne contiennent
pas l’identifiant d’une cible. Les builders conservent séparément les classes
de layout et de transition. Les styles de contenu sont scopés sous
`.elce-player-layout` ; les propriétés statiques ne passent pas par l’attribut
`style`.

Les racines que CodPlay anime conservent aussi leurs classes d’apparence :
Cartes de Flux et de Carousel, ainsi que Graphes ancrés et dans Carousel,
gardent la classe `.bdc` et les classes résolues sur la racine animée. La même
limite CSS s’applique ainsi au bloc rendu entier, même quand le moteur remplace
les classes du markup initial.

- Le fond du projet peint la racine du layout du lecteur ; le fond par défaut
  de l’application y est appliqué. Sa typographie et sa densité s’appliquent à
  la zone de contenu, dont le fond reste transparent.
- Les fonds de page et de BDC ne sont peints que sur leur cible lorsqu’ils y
  sont réglés. Une valeur héritée ne colore pas la surface enfant : elle reste
  transparente et laisse voir le fond de son ancêtre.
- Une Section et les surfaces de Carousel, Question, Résultat et Graphe
  possèdent chacune leur classe ; sans réglage local, leur fond est transparent.
- Le fond d’une Carte vise sa surface de texte : la racine des layouts
  textuels, la zone de texte de Texte avec image, ou la légende d’Image avec
  légende.

L’inset sur fond opaque s’applique aux surfaces textuelles Section, Question,
Résultat et aux layouts Carte Texte court, Texte avec image et Image avec
légende. Les feuilles de densité n’appliquent le padding que si la surface
porte aussi `has-background`. Une densité explicitement choisie à un niveau
applicable remplace le Normal ; Aucun met le padding à zéro. Le texte d’une
Carte avec image conserve son inset sur sa propre zone, et la légende le
conserve sur sa surface.
Photo n’ajoute aucun inset autour du média. Les racines Carousel et Graphe
conservent leur fond, leur typographie et leurs couleurs, sans padding
d’apparence. Les paddings de page et de contenu préexistants gardent leurs
rôles distincts.

Les propriétés statiques d’apparence et les autres déclarations de
présentation non animées passent par des classes CSS. Dans les scènes CodPlay,
les attributs `style` restent réservés aux propriétés animées et à leur état
initial. Les commandes de lecture existantes ne sont pas modifiées par ces
réglages.

## Sources et projection CSS

Les règles stables sont dans les feuilles CSS de
[`config/appearance/css`](../src/config/appearance/css) : une feuille par
palette, famille de police et densité, plus `typography/reading.css` pour les
limites de lecture communes. Les feuilles contiennent directement leurs
déclarations ; elles n’initialisent pas de variables CSS. Le script
`generate-appearance-palette-metadata.mjs` lit les couleurs pour le picker.
La feuille du projet ajoute seulement les couleurs personnalisées et les URL
`@font-face` nécessaires.

La composition installe une feuille commune sous la scène layout persistante ;
les règles et assets réutilisés par plusieurs scènes ne sont déclarés qu’une
fois par projet. La preview charge les feuilles CSS utilisées comme assets dans
le document lecteur ; les feuilles de l’éditeur restent dans son propre
document. L’export Sighty importe localement les mêmes feuilles et le packageur
existant les développe dans la CSS scoped du layout. Il n’y a ni CSS `?inline`,
ni variables CSS d’apparence, ni génération par fonctions des règles fixes.

Si Contraste auto est activé et pris en charge par le navigateur, une règle
`@supports` utilise `contrast-color()` sur la couleur CSS de la surface opaque
effectivement peinte la plus proche. Le résolveur saute les pages et BDC
transparents pour remonter jusqu’au premier fond visible. Aucun calcul
JavaScript ni analyse des pixels des médias n’est utilisé.

## Fontes locales et diffusion

La feuille projet déclare une seule règle `@font-face` par famille, style et
poids utilisés dans ses scènes ; les feuilles des scènes de page ne redéclarent
pas ces faces. La preview charge les `.ttf` via `/fonts/`, routé
par [`elce-local-server.ts`](../src/server/elce-local-server.ts) vers le
service d’assets Remix existant. L’exporteur Sighty copie les seuls fichiers
nécessaires et leurs licences dans le package ; la feuille exportée utilise
`./fonts/` afin que l’URL reste autonome.

## Preuves

- Le chargement SSR de Vite vérifie les cinq palettes, huit suggestions de
  duos, seize familles, presets, rôles de couleur et références inconnues.
- [`appearance-panel.test.tsx`](../src/app/appearance/appearance-panel.test.tsx)
  vérifie les commandes communes du projet, d’une page et des six types de
  BDC, le preset projet seulement, le choix typographique par duo et l’absence
  de libellés d’héritage.
- [`appearance-scene-style-sheet.test.ts`](../src/player/appearance-scene-style-sheet.test.ts)
  vérifie la mesure commune des racines BDC, ses valeurs par densité, la
  projection des classes de tous les types de BDC, les densités en unités
  relatives, le padding conditionné par un fond et le regroupement des couleurs.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie que les Cartes ancrées et les Cartes de Carousel gardent ces classes
  sur leur racine animée ;
  [`statistical-graph-placements.test.ts`](../src/builders/statistical-graph/statistical-graph-placements.test.ts)
  vérifie le même raccord pour les Graphes ancrés et dans Carousel.
- [`appearance-font-assets.test.ts`](../src/player/appearance-font-assets.test.ts)
  vérifie la déduplication des faces ainsi que les chemins preview et package.
- [`elce-local-server.test.ts`](../src/server/elce-local-server.test.ts)
  vérifie le routage des `.ttf` et le rejet des chemins invalides ; le test de
  l’exporteur vérifie l’inclusion des fontes et licences utilisées.
- [`elce-scenario-exporter.test.ts`](../src/export/elce-scenario-exporter.test.ts)
  vérifie que les feuilles CSS de thème utilisées sont présentes dans le CSS
  scoped du layout exporté et que les feuilles inutilisées en sont absentes.
- La migration v7 appliquée à Demo5 est vérifiée par l’API locale et l’ouverture
  du contenu dans Safari. MCP confirme à 1800px et 390px la racine Section
  (766px/284px), ses deux racines Photo ancrées (702px/252px) et la racine
  Question (766px/300px), sans débordement mobile. La validation runtime des
  autres BDC et le calibrage restent ouverts dans le
  [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
