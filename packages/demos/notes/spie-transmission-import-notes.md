# Analyses de transcription SPIE `page004`

La [page source](../src/v2/demos/spie-transmission-import/page-004.xml) vient de
`02-transmission.xml`. Elle illustre une narration qui prépare cinq zones
cliquables et leurs listes. Les règles de l’ancien lecteur ont été lues dans
`static/js/0.chunk.js` (placements, effets et appels) et `7.chunk.js` (SVG
centré et injecté dans le DOM). Les propriétés sont dans `content/xml/interface.xml`
et la présentation dans `static/css/main.css`.

## Modèle d’analyse d’un appel

Pour `c01`, le déclencheur est le clic sur le cercle. La chaîne complète
donne trois opérations dont les cibles se résolvent dans la page et ses médias.

| Opération source | Cible résolue | Écriture CodPlay |
|---|---|---|
| `showItem('list01')` | Conteneur de la liste | Visibilité et opacité du perso `list01` |
| `TweenMax.to('#tique01', 1, {fill: '#10af10'})` | Groupe à l’intérieur de `tique.svg` | Couleur du layout de `icon01` héritée par le groupe |
| `TweenMax.to('#icon01', .5, {rotation: -15, scale: 1.1})` | Icône entière | Canaux rotation et échelle du perso `icon01` |

Une occurrence suffit pour ces opérations qui commencent ensemble. Le
temps de chacune appartient à sa transition. Une cible CSS `#id` doit être
résolue à partir de l’usage et du markup source. Elle peut désigner un perso,
un nœud interne à sa ressource ou plusieurs nœuds dans une page différente.
Quand la chaîne ou la portée ne se résout pas entièrement, le rapport de
reprise conserve le déclencheur, les cibles, l’effet attendu et la raison de
l’écart. La transcription ciblée de `page004` ne fournit pas encore ce rapport
général.

## Comparaison dans Brave

Les deux pages ont été lues à vitesse normale, dans des onglets successivement
au premier plan. Les relevés utilisent la position de `04_01.mp3` (CreateJS
côté SPIE, média natif côté CodPlay). Les mesures de géométrie sont ramenées
au canevas `1600 × 788`. CreateJS annonce 25,078 s, contre 25,051 s pour la
borne de fin CodPlay.

### Géométrie SVG

Le lecteur SPIE remplace la largeur du SVG inline et conserve sa hauteur
intrinsèque. `preserveAspectRatio` cadre ensuite le dessin dans cette boîte.
La transcription redimensionne les deux dimensions à partir du `viewBox`.
Le tableau compare l’échelle du dessin hors animation, mesurée avec
`getScreenCTM()` et normalisée par la largeur du stage.

| Icône | SPIE | CodPlay | Écart de taille du dessin |
|---|---:|---:|---:|
| Tique (`icon01`) | 1,000 | 1,546 | +55 % |
| Mouche (`icon02`) | 1,000 | 1,573 | +57 % |
| Phlébotome (`icon03`) | 0,107 | 0,107 | ≈ 0 % |
| Puce (`icon04`) | 1,000 | 1,205 | +20 % |
| Réduve (`icon05`) | 1,000 | 1,071 | +7 % |

Le premier cercle est centré à `(670, 148)` côté SPIE et `(670, 150)` côté
CodPlay. Sa boîte SVG passe de `180 × 199` à `180 × 180`, avec un diamètre
visible de 180 dans les deux cas. La lecture des dimensions doit donc
distinguer la boîte SVG, le dessin cadré et la boîte utilisée pour centrer
l’élément. `currentColor` reste suffisant pour les cinq formes grises de la
page. Les dégradés, styles multiples et références internes partagées
demandent une analyse propre au SVG concerné.

### Trajectoires

| Relevé | SPIE | CodPlay |
|---|---:|---:|
| Opacité du nuage vers 1 s | 0,75 | 0,74 |
| Échelle du globe vers 0,15 s | 1,41 | 1,47 |
| Opacité du globe vers 2 s | 0,28 | 0,30 |
| Échelle / opacité du globe vers 8,5 s | 0,70 / 0,70 | 0,70 / 0,70 |
| Globe vers 10,7 s | Retiré | Visible, opacité 0,069 |
| Centre horizontal du titre « Dengue » vers 6,5 s | 417 | 483 |

Le nuage exerce simultanément des canaux distincts. Le globe fait aussi
coïncider des effets sur le même canal. Les relevés montrent un écart au
départ et au retrait, avec la même pose intermédiaire stabilisée. Le moteur
devra traiter la priorité par canal et la durée de vie de l’élément
séparément. Pour les titres, la courbe et l’ancrage restent à vérifier sur
plusieurs points avant de modifier le mapping.

### Clics avant l’ajout de la condition de fin

Le premier clic sur `c01` vers 18 s aboutit des deux côtés à une liste opaque
et à l’icône verte, tournée de −15° et agrandie à 1,1. Au second clic vers
20 s, SPIE conserve cet état. Environ 180 ms après le clic, CodPlay est
revenu à une liste d’opacité 0,60, une rotation de −9° et un vert
intermédiaire. L’action déclarée repart de ses bornes `from` fixes. Un appel
`TweenMax.to` équivalent doit tenir compte de la valeur déjà atteinte.

Après l’audio, un premier clic sur `c05` révèle la liste et colore le réduve
dans SPIE. Dans CodPlay, la zone est toujours visible et reçoit le clic par
hit test, mais la liste reste masquée et le réduve gris. À cet instant, le
player est dans l’état terminal de `sequence:end`. Ces écarts justifient le
suivi des ouvertures distinctes et la fin conditionnée à leur consultation
dans la [spécification de la transcription SPIE](../specs/course-motion-import-spec.md#page-spie-page004).
