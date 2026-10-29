# CodPlay V2 — remplacement texte : comportements vérifiés

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
contenu quand l'état reconstruit n'a pas de propriété `content`.

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
`glyph-roll`. Le calcul du découpage par lignes dépend de la mesure DOM : la
revue visuelle a également accepté le rendu des lignes, du balisage et du
clipping avec le CSS auteur dans les cas exercés par la démo.

## Amplitude du rouleau de glyphes

Les trajectoires canoniques `slot-up` et `slot-down` gardent leurs identifiants,
leur durée de 500 ms, leur easing `outBack` et les options de rouleau
(`axis`, `bounce: 0`, `chroma: true`). Leurs bornes numériques V2 sont de 16 :
pour `slot-up`, intro `16 → 0` et outro `0 → -16`; `slot-down` prend les valeurs
inverses. Dans le rendu texte à la taille racine de 16 px utilisée par la démo,
16 est appliqué comme `1rem`. Cette amplitude remplace les 40 précédemment
utilisés par le profil V2, soit une réduction de 60 %, sans changer l'effet de
rouleau.

Dans la scène `text:letter` à 500 px, la police calculée est de 12,48 px. Le
Seek du player a confirmé la translation entrante `1rem`, soit environ
1,28 fois cette taille de police avec la taille racine de 16 px. Le test du
module vérifie les valeurs normalisées symétriques pour les deux directions.

## Preuves

- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  exerce 98 couples de présence dans le parcours `SceneBuilder` → player et
  matérialiseur : les sept formes testées de chaque côté, pour `tag` et `text`,
  les formules d'entrée/sortie, les états reconstruits avant/pendant/après,
  `0` et les espaces présents, et l'absence de diagnostic pour vide→vide.
  Des parcours complémentaires vérifient le balisage enrichi, le Seek et
  l'interruption A→B→C.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les dimensions fractionnaires et la conservation des géométries A/B
  avec une scène de test indépendante de la démo.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  vérifie les trajectoires JSON normalisées `slot-up`/`slot-down`.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse `letter`, `word` et `line` par `SceneBuilder` et le player, vérifie
  les unités produites après Seek, et appelle `runner.resize()` pendant `line`
  tout en confirmant le temps et le style d'échantillon conservés. Un parcours
  player vérifie aussi la chroma du preset JSON et les unités inchangées par
  défaut, ainsi que `skipUnchanged: false`.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les translations et positions texte en `rem`, l'égalité des boîtes
  `Range` source/rendue au repos et le recalage sous un `scale(1.25)` hérité.
- [`replace-preset-catalog.json`](../src/runtime/capabilities/replace-presets/replace-preset-catalog.json)
  est la source des amplitudes numériques appliquées par le runtime.
- Dans Brave à 500 px, le layout et le player V2 partagés ont été Seek à
  `1600 ms`. Les instantanés A et B mesuraient `120,391 px` et `103,555 px` ;
  leurs textes conservaient chacun un seul rectangle de ligne (`112,398 px` et
  `95,563 px`). Le Play repris jusqu'à `7000 ms` a restauré A et supprimé
  toutes les vues temporaires.
- Dans cette reproduction, le parent mesurait `213,414 px` côté CSS et `213 px`
  via `offsetWidth`. Le facteur final était `1,0000003`; le facteur fondé sur
  `offsetWidth` avait produit `1,00194`.
- Sous `scale(1.25)` hérité par le parent dans la démo, le Seek réel de
  `text:word` à `4050 ms` donne la même boîte source et rendue : `top=622,334 px`.
  Avec une matrice affine héritée `matrix(1.2, 0.25, 0.15, 0.85, 0, 0)`, à
  `4800 ms`, la translation texte `-0,165306rem` produit un déplacement vertical
  viewport de `-0,661255 px`, conforme au `-0,661224 px` attendu par la matrice
  (écart de `0,000031 px`). Le Seek à `1600 ms` affiche les translations des
  exemples `tag`, `letter`, `word` et `line` en `rem`.
- En Play réel à vitesse `×2`, sous `scale(1.25)` hérité, `text:word` est encore
  en transition à `1600 ms` avec `translate=-2,5rem`; le player arrive ensuite à
  `7000 ms`, restaure `La lumière du matin` et retire toutes les vues temporaires.
  La console n'a signalé que le `404` déjà observé sur `/favicon.ico`.
- Après le refactor de la surface, dans Brave à `1280 px`, un Play réel depuis
  `1400 ms` franchit l'événement à `1500 ms`. Les instantanés sortant/entrant
  restent distincts à `1600`, `1670` et `1720 ms` : `162,40`/`121,01 px` pour
  `letter` et `word`, `247,26`/`211,45 px` pour `line`, alors que les largeurs
  des composants persistants diffèrent. La lecture est mise en pause à
  `1750 ms`.
- Dans Brave, le Seek à `1600 ms` avec un viewport de `500 px` donne deux lignes
  visuelles à la sortie et une à l'entrée de l'exemple `line`. Après resize à
  `1280 px`, les deux vues sont resegmentées sur deux lignes ; le slider reste à
  `1600 ms` et la pose en cours demeure exprimée en `rem`.

La revue de la démo V2 a confirmé visuellement les cas texte et split, notamment
le maintien du tag sur une ligne, la stabilité en fin d'animation, le reflow et
le placement sous transform CSS hérité. L'utilisateur a validé ces cas dans la
démo ; les tests référencés ci-dessus couvrent leurs frontières runtime.
