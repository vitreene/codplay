# CodPlay V2 — remplacement texte : comportements vérifiés

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification décrit le remplacement texte vérifié avec et sans split
sur `tag` et `text` : segmentation, propagation, reflow à progression
conservée, interruption, amplitude des rouleaux `slot-up`/`slot-down`, rendu en
`rem` et recalage sous transform affine CSS hérité. Les formules d'apparition,
disparition et remplacement sont vérifiées pour les deux composants. Les limites
du balisage et du clipping restent celles du procédé DOM et du CSS auteur.
Les noms canoniques, leur table auteur et les trajectoires JSON sont définis
dans la [spécification des presets](./replace-presets-v2-spec.md).
Le circuit commun des animations HTML est défini dans la
[spécification de présentation replace](./replace-presentation-v2-spec.md).

## Formule déterminée par la présence du contenu

Pour `tag` et `text`, le moteur compare le contenu demandé par l'action au
contenu courant du composant. La propriété omise, `null`, `undefined` et `""`
sont absents ; `0` et les chaînes contenant des espaces sont présents.

| Contenu courant | Contenu demandé | Présentation |
|---|---|---|
| Absent | Absent | Aucune transition. L'état vide ne produit pas de diagnostic. |
| Absent | Présent | Entrée du contenu demandé. |
| Présent | Absent | Sortie du contenu courant, puis état persistant vide. |
| Présent | Présent | Sortie de l'ancien contenu et entrée du nouveau. |

La reconstruction avant le début de l'action rétablit le contenu initial,
même si la propriété `content` était omise. Un Seek dans l'action reconstruit
les mêmes vues temporaires que Play ; un Seek après sa fin retire ces vues et
présente l'état logique final. Le service de rendu efface explicitement le
contenu qu'il gère quand l'état reconstruit n'a pas de propriété `content`.
Cet effacement ne retire pas les enfants montés indépendamment par CodPlay :
le service ne possède que les nœuds qu'il a écrits. Un `tag` sans contenu
texte conserve donc sa fonction de parent. La réconciliation et ses tests
sont décrits dans la
[spécification de matérialisation](./component-materialization-v2-spec.md#services-html-et-structure-de-scène).

## Géométrie des deux vues

La surface de remplacement capture la géométrie de la vue sortante avant que le
composant reçoive son nouveau contenu, puis capture séparément celle de la vue
entrante après la mise à jour. Chaque échantillon conserve la géométrie capturée
pour sa propre vue ; la largeur du nouveau nœud vivant ne redimensionne pas la
copie sortante.

La conversion depuis les rectangles du navigateur utilise la dimension CSS
fractionnaire résolue du parent lorsqu'elle est disponible. La largeur de
chaque vue reçoit une marge de sécurité de 8 px CSS pour absorber les écarts
de mesure et éviter qu'un instantané ne replie le texte seul. La hauteur
et la position restent celles de la vue capturée.

## Invariants vérifiés

- Les vues A et B gardent leurs positions et dimensions propres pendant le
  remplacement, même si leurs contenus ont des largeurs différentes.
- La largeur d'un parent fractionnaire n'introduit pas de facteur d'échelle
  artificiel par comparaison avec sa largeur entière arrondie.
- La fin du remplacement retire les vues temporaires, révèle le composant
  persistant et conserve le contenu logique final.

## Mouvements et placement des fragments texte

Les translations `x` et `y` des presets texte sont rendues en `rem`, selon la
taille racine calculée au moment de la préparation de la vue. Les positions
`left` et `top` des fragments découpés utilisent la même unité. Les mesures
`Range` du navigateur restent internes au moteur et sont converties au moment
de produire ces styles.

Pour chaque fragment temporaire, le moteur compare la boîte `Range` du texte
source à celle du fragment rendu. Il reporte leur écart vers le repère local en
composant puis inversant la partie affine des transforms CSS calculés sur le
texte et ses ancêtres. Ce recalage tient compte de la boîte de glyphe réellement
produite par le fragment inline ; il n'ajoute pas de correctif de baseline fixe.
Cette vérification couvre les transforms affines 2D observés, dont échelle et
cisaillement ; la gestion d'une perspective 3D n'est pas certifiée ici.

## Unités texte et reflow vérifiés

- `letter` suit les graphèmes visibles complets fournis par
  `Intl.Segmenter`, dont les marques combinées, les séquences emoji ZWJ, les
  indicateurs de drapeau et les modificateurs de peau.
- `word` conserve les groupes non blancs et les suites d'espaces comme unités.
  La ponctuation demeure attachée au groupe (`Bonjour,`, `l’été`,
  `arc-en-ciel`) ; aucune segmentation linguistique plus fine n'est appliquée.
- `line` regroupe les fragments par les rectangles `Range` réellement affichés.
  Un reflow demandé par `HtmlPlayerRunner.resize()` reconstruit les unités depuis
  la géométrie présente et conserve le même temps player ainsi que la progression
  échantillonnée.
- La propagation du texte partagé utilise le délai total et `direction` du
  catalogue replace. Les options `slot-up`/`slot-down` activent la chroma et le
  traitement des unités inchangées ; `skipUnchanged: false` conserve au contraire
  la transition sur toutes les unités.

Ces règles ont des tests `SceneBuilder` → player pour les trois valeurs de
`split`, le reflow au moyen du vrai `runner.resize()` et les réglages JSON
`glyph-roll`. Le calcul du découpage par lignes dépend de la mesure DOM ;
la géométrie et le clipping dépendent du CSS auteur.

## Amplitude du rouleau de glyphes

Les trajectoires canoniques `slot-up` et `slot-down` gardent leurs identifiants,
leur durée de 500 ms, leur easing `outBack` et les options de rouleau
(`axis`, `bounce: 0`, `chroma: true`). Leurs bornes numériques V2 sont de 16 :
pour `slot-up`, intro `16 → 0` et outro `0 → -16`; `slot-down` prend les valeurs
inverses. Dans le rendu texte à la taille racine de 16 px utilisée par la démo,
16 est appliqué comme `1rem`. Le test du module vérifie les valeurs
normalisées symétriques pour les deux directions.

## Preuves

- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  exerce les couples de présence pour `tag` et `text`, les formules
  d'entrée/sortie, les états reconstruits avant/pendant/après, le balisage et
  l'interruption A→B→C. La suite vérifie les trois splits, le reflow par
  `runner.resize()` à temps constant, les trajectoires `slot-up`/`slot-down`,
  la chroma et `skipUnchanged`.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les géométries A/B, les dimensions fractionnaires, les translations
  et positions en `rem`, ainsi que le recalage des boîtes `Range` sous
  transformation affine héritée.
- [`replace-preset-catalog.json`](../src/runtime/capabilities/replace-presets/replace-preset-catalog.json)
  porte les amplitudes numériques consommées par le runtime.
