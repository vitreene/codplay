# Elcé — apparence du projet, des pages et des BDC

## Portée vérifiée

Elcé conserve les choix d’apparence dans le document métier, les résout par
propriété, puis génère une courte palette sémantique en OKLCH pour le lecteur.
Cette spécification décrit le modèle v7, les sources CSS, le panneau auteur,
la génération des couleurs et leur projection sur le lecteur. Demo5 a été
migrée vers v7 et s’ouvre dans l’éditeur. La validation complète du générateur
reste suivie dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).

## Catalogue

Les définitions et références du catalogue sont dans
[`appearance-definitions.ts`](../src/config/appearance/appearance-definitions.ts) ;
[`appearance-config.ts`](../src/config/appearance/appearance-config.ts) ajoute
les couleurs lues depuis les CSS par le générateur du picker. Ces CSS fournissent
les échantillons des palettes du panneau auteur ; ils ne peignent plus le lecteur.
Les cinq palettes partagent six rôles stables : `background`, `surface`,
`text`, `muted`, `accent` et `border`. Les palettes Classique, Océan et Forêt
sont claires ; Prune et Ardoise sont sombres. La palette Classique reprend
notamment le fond `#fffdf8`, le texte `#1d2d35` et l’accent `#263b3a` de
l’ancien thème du lecteur.

Les huit duos restent le seul choix typographique de l’interface. Le document
enregistre `headingFontId` et `bodyFontId` séparément ; choisir ou réinitialiser
un duo renseigne ou retire les deux propriétés ensemble.
Chaque famille Google Fonts a un fichier CSS local. Ces fichiers règlent la
famille et l’interligne qui lui convient. La formule de taille responsive du
texte, ses planchers de densité, l’échelle des titres et son plafond de largeur
sont définis dans la
[spécification de taille responsive](./responsive-text-sizing-spec.md).
Chaque fonte de corps fixe son interligne sans unité entre `1.35` et `1.45`.
Les paragraphes gardent un espace après uniquement : `0.5em` en Compact,
`0.75em` en Normal et `1em` en Large. Dans un BDC, les titres H1–H6 ont un
interligne de `1.2`, une marge avant de `1.25em` et une marge après de `0.5em` ;
si un titre est le premier enfant de son bloc, sa marge avant est nulle. Les
cartes flex utilisent ces marges comme rythme vertical sans leur ajouter un
espacement de layout concurrent. Les titres dédiés du lecteur utilisent aussi
un interligne de `1.2`.
Ces espacements typographiques sont internes aux BDC. Le Flux règle à part
l’écart entre ses BDC de premier niveau dans la
[spécification Flux](./flux-scene-builder-spec.md).
Les zones de texte documentaire et les titres dédiés du lecteur suivent cette
mesure responsive selon leurs rôles et échelles respectifs. Les règles de titres
dédiés sont regroupées dans
[`elce-player-style.ts`](../src/player/elce-player-style.ts). Sur une colonne
étroite, le plancher de lecture prévaut et les lignes sont naturellement plus
courtes.
Les zones de Texte court et Texte avec image partagent les classes de rôle
`elce-card__meta`, `elce-card__title` et `elce-card__copy`. Le surtitre et le
message ajoutent respectivement les rôles `elce-card__overline` et
`elce-card__message` ; les classes `elce-card__description` et
`elce-card__caption` servent aussi aux styles de l’aperçu auteur. Les zones
restent distinguées par leurs `data-part` et identifiants, pas par des classes
spécifiques à chaque preset. Leurs définitions communes sont dans
[`presets.ts`](../src/config/presets.ts), avec la vérification dans
[`card-preset-builder.test.ts`](../src/builders/card/card-preset-builder.test.ts).
Ces règles s’appliquent au texte documentaire des BDC et au titre de page ;
aucun contrôle auteur de largeur ou de taille n’est ajouté. Les déclarations
restent en unités relatives. La calibration visuelle des fontes, contenus et
largeurs est suivie dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md). Le chrome de l’éditeur
est hors de cette règle.

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
Transparent sélectionne `density: 'none'` et rend le fond transparent. Le
padding devient nul, sauf sur les racines Question et Carousel bordées en Flux,
qui conservent le retrait Normal. Choisir ensuite une couleur restaure Normal.
Une référence sémantique suit les changements de palette qui lui sont
applicables ; une couleur personnalisée ne change pas. Le contraste automatique
est un booléen indépendant et agit uniquement sur la couleur du texte.

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

Chaque cible document, page ou BDC reçoit une classe de portée propre. Le nom
est construit par
[`appearanceScopeClassName`](../src/builders/scene-style/appearance-class-names.ts)
à partir des identifiants encodés ; il permet de poser les variables générées
sur la racine du rendu concerné sans ajouter d’attribut `style`.

Le circuit est le suivant :

1. [`resolveAppearance`](../src/domain/appearance/appearance-resolver.ts)
   résout les choix effectifs et leur priorité : BDC, parent BDC, page,
   document, défauts de l’application.
2. [`resolveAppearanceContrastContext`](../src/domain/appearance/appearance-resolver.ts)
   trouve la première surface opaque qui porte réellement un fond.
3. [`generateAppearanceColors`](../src/domain/appearance/appearance-color-generator.ts)
   reçoit les couleurs Fond et Texte résolues, l’option Contraste auto et ce
   fond de contraste ; il calcule les rôles de palette.
4. [`createDocumentAppearanceStyleSheet`](../src/player/appearance-scene-style-sheet.ts)
   associe ces rôles aux variables CSS de chaque portée et peint le fond
   uniquement sur sa surface visible.
5. [`ELCE_PLAYER_STYLE_SHEET`](../src/player/elce-player-style.ts) consomme les
   mêmes variables dans le contenu, le sommaire, le titre et la navigation.

Les classes de layout, de densité et de transition restent portées par les
builders. Les racines que CodPlay anime conservent aussi leurs classes
d’apparence : Cartes de Flux et de Carousel, ainsi que Graphes ancrés et dans
Carousel, gardent `.bdc` et les classes résolues sur la racine animée.

- Le fond du projet peint `.elce-player-layout` et le cadre
  `.elce-player-stage`. La règle `:scope` de la feuille partagée vise ce cadre,
  qui est la racine de portée créée par CodPlay. En mode Transparent, le cadre
  et le layout laissent voir l’arrière-plan hôte.
- Le menu, le titre, le contenu, la navigation et le sommaire (y compris son
  panneau mobile) font partie du rendu auteur et consomment la palette projet.
  Seule la barre technique supérieure est hors de cette portée. Le menu et la
  navigation dérivent deux tons distincts de la teinte projet ; leurs couleurs
  de premier plan sont ajustées si nécessaire pour le contraste.
- Les fonds locaux de page et de BDC sont peints sur leur cible uniquement
  lorsqu’ils y sont effectivement définis. Une valeur héritée ne peint pas une
  nouvelle surface : elle reste transparente et laisse voir le fond de son
  ancêtre. Chaque cible locale recalcule ses rôles depuis ses valeurs résolues.
- Une Section et les surfaces de Carousel, Question, Résultat et Graphe
  possèdent chacune leur classe ; sans réglage local, leur fond est transparent.
- Le fond d’une Carte vise sa surface de texte : la racine des layouts
  textuels, la zone de texte de Texte avec image, ou la légende d’Image avec
  légende.

L’inset sur fond opaque s’applique aux surfaces textuelles Section, Question,
Résultat et aux layouts Carte Texte court, Texte avec image et Image avec
légende. Les feuilles de densité appliquent leurs mesures lorsque la surface
porte `has-background` ; la densité choisie reste prioritaire. Une Question
transparente conserve néanmoins le retrait Normal en Flux parce que sa bordure
reste visible. La racine Carousel de Flux reçoit aussi le retrait Normal avec
ou sans fond, sa bordure étant visible. Ces deux règles de bordure ne ciblent
pas les pages Diapo, où ces bordures sont retirées. Les autres surfaces
transparentes n’ont pas de padding d’apparence. Le texte d’une Carte avec image
conserve son inset sur sa propre zone, et la légende le conserve sur sa surface.
Photo n’ajoute aucun inset autour du média. Le Graphe conserve son fond, sa
typographie et ses couleurs, sans padding d’apparence. Les paddings de page et
de contenu préexistants gardent leurs rôles distincts.

La preview ne rajoute ni marge ni bord autour de `.elce-player-stage`, règle
portée par [`app-layout.css`](../src/app/layout/app-layout.css) et
[`popup-player.css`](../src/app/player/popup-player.css) : son cadre fait partie
de la surface auteur. Le slot `.elce-player-layout__content`, stylé dans
[`elce-player-style.ts`](../src/player/elce-player-style.ts), conserve toujours
`1rem` de padding intérieur, y compris sur fond transparent.
Les paddings de page et de BDC s’ajoutent à ce retrait minimal ; ils ne peuvent
donc pas ramener le texte au bord du viewport. La barre technique supérieure
reste hors du document.

Les propriétés statiques d’apparence et les autres déclarations de
présentation non animées passent par des classes CSS. Dans les scènes CodPlay,
les attributs `style` restent réservés aux propriétés animées et à leur état
initial. Les commandes de lecture existantes ne sont pas modifiées par ces
réglages.

## Génération et édition de la palette

Le modèle de document conserve seulement les ancres Fond et Texte, la palette
référencée, l’option Contraste auto et la densité. Il n’enregistre pas chaque
couleur calculée. La fonction pure
[`generateAppearanceColors`](../src/domain/appearance/appearance-color-generator.ts)
produit les rôles suivants :

| Rôle généré | Règle |
| --- | --- |
| `background` | Couleur Fond résolue, conservée telle quelle. |
| `text`, `title` | Couleur Texte résolue ; si Contraste auto est actif, seule sa luminosité est ajustée. Le titre suit le texte. |
| `intertitle`, `muted` | Variante du texte, rapprochée du fond en OKLCH puis corrigée si le contraste est insuffisant. |
| `accent`, `accent-secondary` | Deux teintes coordonnées dérivées de la teinte de Fond ; le second accent est décalé de 24°. |
| `accent-foreground`, `accent-secondary-foreground` | Premier plan de chaque accent, corrigé pour garder 4,5:1 de contraste. |
| `surface`, `surface-foreground` | Surface légèrement décalée depuis Fond et couleur de texte vérifiée sur cette surface. |
| `border` | Mélange des ancres Fond et Texte, avec contraste graphique minimal. |
| `menu-*`, `navigation-*` | Deux tons d’interface dérivés de la teinte projet, plus leur premier plan lisible. |

Les constantes réglables sont regroupées au début du générateur dans
`COLOR_RULES` : teinte neutre de repli (165°), écart entre accents, plage de
chroma, seuil de neutralité, cibles de contraste (4,5:1 pour le texte et 3:1
pour les éléments graphiques), écart des surfaces et luminosités du menu et de
la navigation. Si Fond est neutre, Texte fournit la teinte ; si les deux sont
neutres, Elcé utilise la teinte de référence 165°. Les couleurs personnalisées
suivent les mêmes règles que les rôles de palette.

Le calcul suit les fonctions nommées du même fichier : `hexToOklch` convertit
les ancres sRGB ; `themeHueFor` choisit la teinte ; `generateAppearanceColors`
assemble les rôles ; `ensureContrast` et `adjustLightnessForContrast` corrigent
la luminosité ; `oklchToHex` réduit la chroma jusqu’à rentrer dans le gamut
sRGB. Contraste auto ne modifie pas le Fond et peut ajuster l’ancre Texte sur le
fond peint le plus proche. Les premiers plans dérivés gardent leurs propres
contrôles de contraste, quel que soit ce réglage.

Pour modifier un rôle, ajuster sa formule dans `generateAppearanceColors` ;
pour régler l’intensité générale, changer les constantes `COLOR_RULES`. Pour
ajouter un rôle, le déclarer dans `GeneratedAppearanceColors`, l’associer à une
variable dans `generatedAppearanceStyleSheet`, puis le consommer dans les
styles lecteur. La sélection de la surface réellement peinte par type de BDC
se règle dans `paintedSurfaceSelectors`. Les espacements restent dans
[`css/densities`](../src/config/appearance/css/densities) : le générateur ne
duplique pas leurs valeurs.

Les couleurs de rendu sont émises sous forme de variables CSS par cible dans
une feuille partagée. Les palettes CSS de
[`config/appearance/css/palettes`](../src/config/appearance/css/palettes)
servent encore aux échantillons du picker, mais ne sont plus chargées pour
peindre le lecteur. La feuille partagée charge les fontes, règles de lecture
et densités utilisées. L’export Sighty produit ces mêmes variables dans la
CSS scoped du layout. Aucun calcul n’analyse les pixels des médias.

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
  vérifie les marges et l’interligne des titres, l’absence de marge avant pour
  un premier titre, l’espace des paragraphes et l’absence de `gap` concurrent
  dans les cartes flex ; il vérifie aussi le `gap` de Flux, distinct de ce
  rythme interne, ainsi que le padding Normal des surfaces bordées sans fond.
- La preview Brave d’un document v7 confirme en rendu réel, sur écran large et
  étroit, l’interligne du corps, le rythme des paragraphes et des titres, ainsi
  que la marge avant nulle du premier titre. Aucun débordement horizontal n’a
  été observé. La validation des autres BDC, fontes et contenus reste suivie
  dans le [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
- Brave DevTools confirme la Question transparente de la page « Quiz du
  chapitre 1 » en Flux : sa bordure reste visible et son padding Normal suit la
  règle responsive sur grand et petit écran. La classe `density-none` conserve
  le même retrait. Une fixture DOM temporaire confirme la règle du Carousel
  bordé en Flux ; les racines Diapo restent hors de ces sélecteurs.
- Les tests du builder Graphe vérifient la palette fixe pour chaque rendu SVG ;
  les tests de placements vérifient sa présence dans les feuilles Flux, Diapo
  et Carousel. Une fixture Brave montre que les mêmes classes peignent barres,
  courbes, secteurs et légendes. Demo5 n’expose actuellement qu’un Graphe en
  Tableau ; l’inspection d’un graphe SVG monté par une session d’auteur reste
  suivie dans le [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
- Brave DevTools, le 26 octobre 2026, confirme la nouvelle mesure : à la borne
  `55rem`, un long paragraphe de Demo5 donne une moyenne mesurée de 76,9
  caractères par ligne. Sur mobile, la racine reste sous la borne, le plancher
  de lecture prévaut et le document n’a pas de débordement horizontal.
  L’interligne, les espaces et les marges typographiques restent inchangés.
- Le générateur et la projection ont été modifiés dans cette tranche ; leur
  couverture de test et les scénarios visuels complets restent à valider selon
  le [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
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
  du contenu dans Safari. MCP confirme sur grands et petits viewports la racine
  Section, ses deux racines Photo ancrées et la racine Question, sans
  débordement. La validation runtime des autres BDC et le calibrage restent
  ouverts dans le
  [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
