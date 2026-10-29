# CodPlay V2 — remplacement média

## Périmètre vérifié

Cette spécification fixe la présentation transitoire des images et vidéos par
`replace-media`, entière ou avec `split: 'cells'`. Les profils CSS du slot sont
réutilisés pour les médias, et les trajectoires JSON s'appliquent aux snapshots
entiers ou à chaque cellule. Les tests runtime couvrent les grilles SVG, les
formes auteur, le retry média tardif, le Seek, l'interruption, le resize et le
nettoyage. Le rendu visuel des masques CSS, le preload de la première frame et
la continuité de lecture vidéo ont aussi été vérifiés dans les démos de
remplacement.
Les noms canoniques, la sélection auteur et les trajectoires JSON sont décrits
dans la [spécification des presets](./replace-presets-v2-spec.md).
Le circuit commun des animations HTML est défini dans la
[spécification de présentation replace](./replace-presentation-v2-spec.md).

## Rôle

`replace-media` laisse le composant `img` ou `media` propriétaire de sa source
et de son nœud persistant. En mode entier, la surface présente des vues
transitoires fixes. Avec `split: 'cells'`, elle garde un clone sortant et le
nœud média cible persistant. Une grille de masques SVG anime le clone sortant
au-dessus de la cible, qui reste sans masque. En intro seule, la grille est
portée par la cible. Les cellules ne créent ni copies média ni lecteurs.

## Profils et snapshots entiers

Pour `img` et la source vidéo du composant `media`, `replace-media` accepte les
sept transitions CSS établies par `replace-slot` ainsi que les noms du catalogue
JSON. Les snapshots sortant et entrant sont présentés comme des vues séparées ;
un preset JSON échantillonne ses poses `outro` et `intro` avec ACE sur
`ComponentAnimation`. Une transition CSS de slot conserve ses poses existantes.

Le nœud natif persistant et sa source restent possédés par le composant média.
Les vues transitoires représentent une frame fixe ; elles ne remplacent pas le
nœud persistant et ne contrôlent pas sa lecture. Une cellule vidéo ne crée pas
de lecteur ni d'horloge média supplémentaire.

## Grilles de masques SVG

Avec `split: 'cells'`, une seule grille SVG masque la vue source sortante ; le
nœud cible persistant reste dessous et sans masque. Chaque cellule répète la
forme choisie à une position fixe ; la trajectoire sélectionnée anime les
formes selon les retards et l'origine de propagation demandés. En intro seule,
la grille masque la cible. Le nombre de cellules ne multiplie pas les nœuds
image ou vidéo et ce chemin ne crée pas de canvas.

`stagger` est l'enveloppe totale des départs. `staggerPattern` nomme trois
parcours : `manhattan` conserve la propagation par distance et `direction`
compatible V1 ; `row-wave` lance les cellules successivement de gauche à droite
sur chaque rangée, puis passe à la suivante ; `column-wave` les lance de haut
en bas dans chaque colonne, puis passe à la suivante. Les cellules démarrent
individuellement, sans synchroniser toute une rangée ou colonne. Omettre
`staggerPattern` revient à `manhattan`. `direction` est réservé à
`manhattan` ; les deux parcours en vague ne l'acceptent pas. La durée effective
inclut toute l'enveloppe `stagger`.

`shape` accepte `circle`, `star`, `diamond` ou un chemin SVG `{ path, viewBox }`.
Un chemin auteur peut décrire toute forme SVG prise en charge par `<path>` ; le
cercle n'est pas une forme obligatoire. Sans forme, `mask-reveal` utilise le
cercle et les autres profils conservent des cellules rectangulaires. Le masque
s'applique au rectangle du composant média : l'image ou la vidéo garde son
`object-fit` et sa géométrie CSS.

La copie vidéo sortante est mise en pause et replacée au `currentTime` de la
source. Le nœud vidéo cible reste le nœud persistant du composant ; `replace`
ne prend pas le contrôle de sa lecture, qui reste sous `media-sync`.

Au resize, la surface recalcule la couverture des formes selon le nouveau
ratio du rectangle média et reprend l'échantillon courant. À la fin, après un
Seek hors de la transition ou à l'interruption, les masques transitoires
associés à l'ancienne session sont retirés ; la nouvelle transition repart de
la composition visible.

## Disponibilité asynchrone des frames

Si la frame entrante d'une image ou d'une vidéo n'est pas encore décodée au
premier échantillon player, `replace-media` attend l'événement natif de
disponibilité ou d'échec de la source persistante. Le callback natif ne modifie
pas le DOM : il émet
un événement privé de service module, attaché à l'occurrence et à la session
courantes. Après rejeu de cet événement, le player rééchantillonne à sa position
logique actuelle. L'état de disponibilité fait partie de la clé d'échantillon ;
la capture entrante est donc retentée même si le Seek a laissé le player à la
même progression. Cette reprise ne fait pas avancer l'animation et ne crée pas
d'horloge. Un Seek ou le remplacement de la session invalide le listener
précédent.

## Invariants vérifiés

- La vue source sortante porte l'unique grille SVG ; la cible persistante reste
  visible dessous et ne porte pas de masque. Seule une intro masque la cible.
- La grille garde le nombre de cellules demandé, répète le chemin SVG configuré
  et applique la pose au moyen de l'échantillonnage replace existant.
- Une transition `cells` ne crée aucune copie média ou aucun canvas par cellule.
  La vidéo source clonée reste en pause à la position de départ ; le composant
  garde le nœud média cible persistant.
- `runner.resize()` conserve le temps player et l'échantillon courant, puis
  recalcule la couverture des formes pour le nouveau ratio de la boîte.
- La fin d'une transition ou un Seek hors de sa période retire les grilles et
  restaure la visibilité du composant.
- À l'interruption, la source suivante est la composition masquée visible ; le
  Seek et la fin retirent ensuite les anciennes et nouvelles définitions SVG.
- Si une image ou vidéo entrante est encore en attente au premier échantillon,
  la session peut construire ses vues entières et `cells` après le signal de
  disponibilité, en réutilisant la même position player ; une réponse d'échec
  nettoie la vue temporaire, et un Seek invalide le listener de l'ancienne
  session. Fin de transition, détachement et destruction annulent aussi les
  attentes ; une frame libérée ensuite ne recrée pas la présentation.
- Les tests runtime exercent les profils slot et JSON sur les images et vidéos,
  notamment le masque par défaut cercle, l'étoile et un chemin auteur libre.
- La revue visuelle a confirmé que les images conservent leur géométrie pendant
  `cells`, que la première transition reprend après la disponibilité de la
  nouvelle frame, et que les transitions vidéo sont fluides après le preload.
  L'utilisateur a validé ces parcours dans les démos CodPlay et Sighty.

## Preuves

- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les masques `cover`/`contain`, le cercle par défaut, un chemin SVG
  auteur, l'absence de canvas, le reflow et le nettoyage.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse `SceneBuilder` → `HtmlPlayerRunner` pour Play, Seek, les formes
  `star` et auteur, l'absence de canvas par cellule, le resize des grilles image
  et vidéo à `150 ms`, l'interruption A→B→C, le retry asynchrone à position
  player constante et le `currentTime` de la copie vidéo sortante.
- La suite CodPlay complète compte **913 tests réussis** et cinq échecs FLIP
  connus, consignés hors du périmètre replace. Le typecheck CodPlay, le
  typecheck V2 et le build des démos passent. La page F Sighty valide aussi la
  réutilisation de la même grille par `replace-slot`.
