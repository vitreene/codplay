# Elcé — apparence du projet, des pages et des BDC

## Portée vérifiée

Elcé conserve les réglages d’apparence dans le document métier, les résout par
propriété à partir du contexte éditorial, puis les projette sur les surfaces
des scènes existantes. Cette spécification décrit le catalogue initial, le
modèle v6, le panneau commun et la projection CSS vérifiés. La matrice complète
d’intégration reste suivie dans le [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).

## Catalogue

Le catalogue interne est déclaré dans
[`appearance-config.ts`](../src/config/appearance/appearance-config.ts), avec
ses contrats dans
[`appearance-types.ts`](../src/config/appearance/appearance-types.ts).
Les cinq palettes partagent six rôles stables : `background`, `surface`,
`text`, `muted`, `accent` et `border`. Les palettes Classique, Océan et Forêt
sont claires ; Prune et Ardoise sont sombres. La palette Classique reprend
notamment le fond `#fffdf8`, le texte `#1d2d35` et l’accent `#263b3a` du
lecteur existant.

Les huit duos typographiques sont composés de familles Google Fonts et leurs
références restent stables. Le duo s’affiche « Crimson Text / DM Sans » ; les
familles locales correspondantes sont utilisées par le lecteur. Les tailles
de texte restent réglées par l’application. Pour le contenu du document rendu
(preview, lecteur et exports), les déclarations CSS qui règlent le rythme du
texte — taille, interlignage, marges, espacement et padding de sa surface —
utilisent des unités relatives, avec `rem` comme base ; `vw` et `cqw` adaptent
ces valeurs à la surface. Cette règle ne concerne pas le chrome de l’interface
d’édition. Les valeurs en pixels affichées dans les styles calculés du
navigateur sont des mesures résolues, pas les unités déclarées par Elcé.

| Preset | Palette | Duo titraille / texte | Densité |
| --- | --- | --- | --- |
| Classique | Classique | Crimson Text / DM Sans | Normal |
| Océan | Océan | Inter / Krub | Normal |
| Forêt | Forêt | Nunito / PT Sans | Large |
| Prune | Prune | Raleway / Merriweather | Normal |
| Ardoise | Ardoise | Instrument Sans / Geist | Compact |

Les densités sont Aucun (`none`), Compact (`compact`), Normal (`normal`) et
Large (`large`). L’application adapte leurs valeurs au rôle et au layout de
chaque surface. La configuration de l’application utilise le preset Classique
et désactive le contraste automatique.

Les fonctions `getAppearancePalette`, `getAppearanceTypographyPair` et
`getAppearancePreset` retrouvent une référence configurée et lèvent une erreur
sur une référence inconnue. Elles ne substituent aucune valeur et ne lisent
pas le DOM. Les références croisées des presets sont contrôlées par TypeScript.

## Document v6 et résolution

`appearance` est facultatif sur le document, chaque page et chaque BDC. Sa
forme sparse accepte `presetId`, `paletteId`, `typographyPairId`, `density`,
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
valeur personnalisée fixe. Le fond accepte aussi `transparent`. Une référence
sémantique suit les changements de palette qui lui sont applicables ; une
couleur personnalisée ne change pas. Le contraste automatique est un booléen
indépendant et agit uniquement sur la couleur du texte.

Les commandes d’apparence passent par `document.apply`. Elles préservent les
autres champs documentaires et modifient une seule propriété à la fois. La
conversion du document Demo5 conservé est ciblée ; le modèle ne convertit pas
automatiquement les documents v5.

## Panneau auteur

Le panneau Style réutilise les mêmes propriétés sur le projet, les pages et
les BDC Section, Carte, Carousel, Question, Résultat et Graphe. Le preset
général n’est affiché qu’au projet. Palette, Fond et Couleur du texte sont
présentés dans le même groupe « Couleurs » ; le contraste est une seule case
« Contraste auto ». Les libellés d’héritage et de provenance ne sont pas
affichés.

Une icône Palette ouvre le style du projet depuis l’en-tête Scénario. Chaque
page et BDC possède son bouton de style accessible ; dans l’en-tête d’un BDC,
il est placé à côté de la corbeille et reprend le gabarit d’icône standard.
Les commandes sont reliées au même contrôleur XState et à ses changements
documentaires.

## Projection sur les scènes

Les règles sont rattachées aux feuilles CSS des scènes layout ou page déjà
produites par Elcé. Chaque cible reçoit une classe de rôle avec un suffixe de
hachage déterministe et compact. Les sélecteurs ayant des déclarations
identiques sont regroupés ; les règles propres à une cible restent dans la
feuille de sa scène.

- Le fond du projet peint la racine du layout du lecteur ; sa typographie et
  sa densité s’appliquent à la zone de contenu.
- Le fond d’une page Flux peint sa racine article ; celui d’une Diapo peint sa
  racine de contenu propre.
- Une Section et les surfaces de Carousel, Question, Résultat et Graphe
  possèdent chacune leur classe et leur surface de fond.
- Le fond d’une Carte vise sa surface de texte : la racine des layouts
  textuels, la zone de texte de Texte avec image, ou la légende d’Image avec
  légende.

L’inset sur fond opaque s’applique aux surfaces textuelles Section, Question,
Résultat et aux layouts Carte Texte court, Texte avec image et Image avec
légende. Une densité explicitement choisie à un niveau applicable remplace le
Normal ; Aucun met le padding à zéro. Le texte d’une Carte avec image conserve
son inset sur sa propre zone, et la légende le conserve sur sa surface.
Photo n’ajoute aucun inset autour du média. Les racines Carousel et Graphe
conservent leur fond, leur typographie et leurs couleurs, sans padding
d’apparence. Les paddings de page et de contenu préexistants gardent leurs
rôles distincts.

Les propriétés statiques d’apparence et les autres déclarations de
présentation non animées passent par des classes CSS. Dans les scènes CodPlay,
les attributs `style` restent réservés aux propriétés animées et à leur état
initial. Les tailles de texte et les commandes de lecture existantes ne sont
pas modifiées par ces réglages.

## Feuilles CSS d’apparence

Les définitions stables de palette, de duo typographique et de densité sont
regroupées dans les fichiers CSS de
[`config/appearance/css`](../src/config/appearance/css). `appearance-surface.css`
porte les règles partagées ; les palettes, les duos et les densités restent
chacun dans leurs propres feuilles. Ces CSS sont la source des styles. Le
script `generate-appearance-palette-metadata.mjs` ne produit que les valeurs
utilisées par le picker depuis les CSS de palettes.

La preview ajoute au `head` du document détenu par le lecteur le CSS commun et
les fichiers de palette, duo et densité effectivement résolus pour le document.
Les feuilles de l’interface d’édition restent dans son propre document.
L’export Sighty place des `@import` locaux pour les seuls fichiers utilisés ;
le paquetage existant les développe dans la feuille CSS scoped du layout.
L’export n’utilise ni import CSS `?inline`, ni génération par fonctions des
règles fixes des thèmes.

Si Contraste auto est activé et pris en charge par le navigateur, une règle
`@supports` utilise `contrast-color()` sur la couleur CSS du fond opaque
sémantiquement le plus proche. Aucun calcul JavaScript ni analyse des pixels
des médias n’est utilisé.

## Fontes locales et diffusion

La feuille layout déclare une seule règle `@font-face` par famille, style et
poids utilisés dans les scènes du document ; les feuilles de page ne
redéclarent pas ces faces. La preview charge les `.ttf` via `/fonts/`, routé
par [`elce-local-server.ts`](../src/server/elce-local-server.ts) vers le
service d’assets Remix existant. L’exporteur Sighty copie les seuls fichiers
nécessaires et leurs licences dans le package ; la feuille exportée utilise
`./fonts/` afin que l’URL reste autonome.

## Preuves

- Le chargement SSR de Vite vérifie les cinq palettes, huit duos, presets,
  rôles de couleur et références inconnues.
- [`appearance-panel.test.tsx`](../src/app/appearance/appearance-panel.test.tsx)
  vérifie les commandes communes du projet, d’une page et des six types de
  BDC, le preset projet seulement et l’absence de libellés d’héritage.
- [`appearance-scene-style-sheet.test.ts`](../src/player/appearance-scene-style-sheet.test.ts)
  vérifie les classes distinctes, les règles groupées, les paddings textuels
  des trois layouts de Carte, et l’absence d’inset sur Photo, Carousel et
  Graphe.
- [`appearance-font-assets.test.ts`](../src/player/appearance-font-assets.test.ts)
  vérifie la déduplication des faces ainsi que les chemins preview et package.
- [`elce-local-server.test.ts`](../src/server/elce-local-server.test.ts)
  vérifie le routage des `.ttf` et le rejet des chemins invalides ; le test de
  l’exporteur vérifie l’inclusion des fontes et licences utilisées.
- [`elce-scenario-exporter.test.ts`](../src/export/elce-scenario-exporter.test.ts)
  vérifie que les feuilles CSS de thème utilisées sont présentes dans le CSS
  scoped du layout exporté et que les feuilles inutilisées en sont absentes.
- Safari MCP, le 24 octobre 2026 sur `http://localhost:5175`, vérifie dans la
  preview Demo5 le chargement des huit CSS réellement utilisés (réponses `200`
  ou `304`) dans le document lecteur, sans lien ajouté au document d’édition.
  Les règles calculent les couleurs, fonds, densités et
  familles attendus sur le contenu ; les fichiers locaux Crimson Text et DM Sans
  sont demandés par le navigateur, et les styles calculés n’ajoutent pas
  d’attribut `style`. Les règles sources expriment le padding
  Normal d’une Section par `clamp(1rem, 3vw, 2rem)` et celui d’une Question par
  `clamp(1rem, 3vw, 1.6rem)` ; le CSS calculé peut afficher leur mesure en
  pixels. Les règles CSS des surfaces documentaires Section, Question et Graphe
  expriment leurs tailles et espacements textuels en unités relatives. Safari
  accepte la formule `rem`/`cqw` du Graphe. Le panneau auteur affiche ses
  options effectives et le groupe « Couleurs », sans preset général ni libellé
  de provenance ; son apparence relève de l’interface d’édition, hors de cette
  règle d’unités.
- Les 461 tests Elcé, le typecheck et le build passent le 24 octobre 2026.
  Les validations navigateur de toutes les interactions, du contraste, du
  resize et des exports restent suivies dans le plan.
