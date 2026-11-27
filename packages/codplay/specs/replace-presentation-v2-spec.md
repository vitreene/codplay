# CodPlay V2 — présentation des transitions `replace`

> Version de référence : CodPlay V2 — 2026-11-10.

## Rôle et propriétaires

Les capacités `replace-slot`, `replace-text` et `replace-media` choisissent
une présentation temporaire autour de l'état ou de la relation demandé par le
player. Elles ne remplacent pas le composant persistant ni son état logique.

Le player et `RuntimeComponentRuntime` possèdent la chronologie des actions,
leurs animations et la reconstruction par Seek. Le module replace prépare une
`ComponentAnimation` puis utilise le même échantillonneur et le même cycle de
fin que les autres animations de composant. La surface HTML ne possède que les
instantanés DOM, leur géométrie, les fragments texte, les représentations média,
les masques SVG, les styles de transition et le rendu HTML-in-Canvas (H-i-C)
des effets WebGPU.
Elle ne décide pas quelle scène,
ressource ou occurrence entrante doit être sélectionnée.

Lors d'un montage externe, l'application hôte — Sighty pour ses scènes — choisit
l'occurrence entrante, son profil et le moment de demander le montage. Elle
conserve la décision de cycle de vie des instances. La façade publique CodPlay
exécute la relation explicitement demandée ; la présentation replace n'ordonne
pas `play`, `pause`, `seek` ou `destroy` sur l'instance enfant et n'en prend pas
la propriété.

## Horloges

Les remplacements déclarés sur une action utilisent le temps logique du player
et sont reconstruits depuis la timeline lors d'un Seek.

La présentation demandée autour de `instances.mount({ replace })` utilise une
horloge d'opération : son temps est la somme des `deltaMs` effectivement reçus
sur les frames du `TimeTicker` partagé par le moteur. Ce temps ne dépend pas de
la position logique du player hôte. Un Seek, un reset ou un replay de l'hôte ne
le modifie pas. La transition progresse uniquement lorsqu'une frame du ticker
est distribuée ; si l'hôte est en pause, les frames d'un autre player peuvent
continuer de la faire progresser. Sans frame, elle reste figée.

Les deux horloges empruntent le circuit `RuntimePlayerEventController` →
`RuntimePlayerPresentation` → `RuntimeComponentRuntime` et le même
échantillonneur `ComponentAnimation`. Les modules replace ne créent ni boucle
`requestAnimationFrame`, ni temporisateur, ni source d'horloge propre. La forme
de `RuntimeEngineOptions` n'est pas étendue pour ces transitions.

## Calcul des poses

Les valeurs de pose et leurs easings sont préparés et résolus avec ACE via
`prepareTween`/`resolveTween`. Les couleurs de rouleau utilisent les
adaptateurs ACE de couleurs. La conversion des valeurs échantillonnées en
styles, unités `rem`, géométrie DOM et masque SVG appartient à la surface HTML.
La propagation texte/média réutilise `computeReplaceStaggerDelays`. Sans
`stagger`, son enveloppe vaut 40 % de la durée pour le texte découpé
(`REPLACE_TEXT_STAGGER_SHARE`) et 50 % pour les rouleaux de glyphes et les
grilles de masques (`REPLACE_GRID_STAGGER_SHARE`) ; une grille sans dimension
vaut 4 × 3 (`config/replace.ts`).

Pour le recalage des fragments texte, l'adaptateur lit les matrices CSS calculées
dans le DOM, puis compose les transforms et reporte les offsets avec les
opérations ACE `multiplyMatrix`, `invertMatrix` et `transformPoint`. La surface
ne maintient pas de circuit parallèle de calcul matriciel.

L'implémentation de présentation est répartie par propriétaire dans
`runtime/runner-html/replace-presentation/` : sessions, géométrie et DOM,
texte, frames/cellules média, poses, masques, rendu HTML-in-Canvas,
normalisation de profil et identifiants. `replace-presentation-surface.ts`
reste la porte d'export de la surface HTML. Les effets H-i-C sont dans
[`html-in-canvas/`](../src/runtime/runner-html/replace-presentation/html-in-canvas/) :
shaders WGSL (`effects.ts`), renderer WebGPU (`webgpu-renderer.ts`), session
(`session.ts`) et géométrie (`texture-mapping.ts`).

## Cycle de vie des vues

- Les transitions classiques utilisent des instantanés temporaires. H-i-C
  présente les états DOM natifs dans des slots. Le composant et le player
  restent propriétaires de l’état persistant.
- Les vues sont retirées à la fin, à l'annulation, lors du remplacement d'une
  session ou au teardown de leur propriétaire.
- `replace-media.split: 'cells'` garde un clone source et le média cible
  persistant dessous, puis applique une seule grille de masques SVG au clone
  source ; la cible reste sans masque. En intro seule, la grille masque la
  cible. `replace-slot.split: 'cells'` réutilise cette même géométrie, ce même
  masque source et ce même cycle de session. Aucun circuit de clones/canvases
  par cellule n'est utilisé. La vidéo média clonée est figée à sa position de
  départ ; le nœud cible reste possédé et piloté par son composant.
- La grille `replace-slot` accepte une forme, `cellSize` en pourcentage de la
  largeur du slot (prioritaire sur `cellX`/`cellY`), une ou deux dimensions de
  grille, `staggerPattern`, `direction` et `stagger`. Sans pattern, ou avec
  `manhattan`, la propagation conserve le calcul par distance et l'origine de
  `direction`. `row-wave` démarre les cellules individuellement de gauche à
  droite, rangée après rangée ; `column-wave` les démarre de haut en bas,
  colonne après colonne. Les vagues excluent `direction`. La durée effective
  comprend toute l'enveloppe `stagger`. Un resize recalcule la grille et
  rééchantillonne la progression courante par le hook de mise à jour du
  composant.
- Le reflow repositionne ou reconstruit la présentation depuis les mesures
  actuelles tout en gardant la progression échantillonnée.
- Les effets H-i-C (`burn`, `ripple`, `pixelate`, `swirl`, `shatter`, `fold`) sont des transitions de la vue entière, pour `img`, `media` et
  `slot` ; ils excluent `split: 'cells'`. Leur session est choisie avant toute
  création de snapshot classique. Sans les primitives H-i-C
  (`content="drawable"`, `layoutsubtree`, `requestPaint`,
  `getElementImageDefaultSize`, `drawElementImageToTexture` ou son ancien nom
  `copyElementImageToTexture`) ou sans WebGPU, la surface présente
  immédiatement le `mask-reveal` circulaire, à durée égale.
- Un canvas `content="drawable"` dans la racine shadow du composant porte deux
  wrappers `drawable` : un slot sortant nommé et le slot entrant par défaut. Les
  deux états restent du DOM vivant pendant la transition. Pour un média, l'état
  sortant est son nœud natif, réattaché avec le marqueur transitoire. Pour un
  slot, comme pour ses autres transitions, c'est une copie temporaire de son
  contenu, qui appartient à un autre propriétaire. Aucun état présenté n'est
  masqué par `visibility`, sans quoi il ne produirait pas d'image.
- Un seul device WebGPU sert toutes les transitions de la page
  (`webgpu-device.ts`) ; sa perte est signalée aux transitions actives, qui se
  terminent, et un nouveau device est demandé ensuite. Chaque transition libère
  à sa fin sa configuration de canvas, ses textures et son buffer. Tant que le
  device n'est pas prêt, seul l'état sortant est affiché. Quand il l'est,
  le canvas prend l'affichage sans frame vide : la frame native sortante d'un
  média (`img`, `video`, ou composition d'une interruption) est copiée dans les
  textures avec son cadrage `object-fit` et dessinée aussitôt ; pour un slot,
  une seconde copie du contenu sortant couvre le canvas jusqu'à son premier
  dessin DOM.
- À chaque `paint`, le renderer copie dans leurs textures les seuls wrappers
  que le navigateur a repeints (`changedElements`, `drawElementImageToTexture`),
  puis dessine l'effet : la copie sortante, statique, d'un slot n'est copiée
  qu'une fois. Le tableau de paramètres du shader est réutilisé d'une frame à
  l'autre. Seule la
  progression reçue de `ComponentAnimation` le fait avancer ; `requestPaint`
  demande un rendu sans horloge locale. La vue est mesurée par composition
  affine (`captureHtmlPose` : offsets, styles calculés et matrices parentes),
  jamais par un rectangle DOM, au montage et au reflow seulement. Le support du
  canvas est aligné sur les pixels physiques et la vue CSS fractionnaire est
  conservée à l'intérieur ; l'échantillonnage se limite à la zone utile de
  chaque texture.
- Un effet fournit un module WGSL au contrat commun (`getFromColor`,
  `getToColor`, `progress`, `ratio`) : un shader plein cadre (`burn`,
  `ripple`, `pixelate`, `swirl`), ou un maillage de l'état sortant au-dessus de
  l'état entrant (`shatter`, `fold`).
- Fin, annulation, perte du device et teardown retirent le canvas, les
  listeners, les textures et le buffer, et déconfigurent le contexte ; le
  device partagé reste disponible pour la transition suivante.
  Aucun renderer ni historique de frames n'est conservé. La racine shadow,
  indétachable selon le DOM, reste réduite à un slot ordinaire.
- L'interruption texte repart de la composition visible. Le player conserve
  séparément la reconstruction de l'état logique de la timeline. Avant de
  capturer cette composition, les modules texte et média échantillonnent la
  session interrompue à l'instant de la mise à jour : Play, qui met à jour le
  composant avant d'échantillonner ses animations, capture donc la même
  composition que Seek.
- La disponibilité asynchrone d'une frame média peut redemander un échantillon
  à la même position player afin de construire la vue entrante. Elle ne modifie
  pas le temps logique ni la progression de l'animation ; le ticker reste leur
  seule horloge.

## Identité des occurrences et Seek

Les trois modules partagent un même suivi de session
(`capabilities/replace-session/`) : une session au plus par composant, les
occurrences déjà traitées, la sélection de Seek et le flux d'échantillonnage
player. Seule la dernière occurrence valide d'un composant est normalisée à
chaque mise à jour.

Les trois modules identifient une occurrence par son événement (`eventId`,
sinon son nom), son instant et sa position dans l'arbre d'eventimes
(`declarationPath`, étape de séquence comprise), sans tenir compte de sa place
dans la liste des actions du perso. Cette liste perd des actions plus anciennes
en cours de route (`tween:stop`, étape de séquence remplacée) sans relancer la
transition en cours.

Avant le rejeu d'un Seek, `prepareSeek(scèneCible)` fixe, par composant, les
occurrences visibles à la cible : la dernière si elle est encore en cours,
puis chaque précédente encore en cours au début de la suivante retenue
(chaîne d'interruption). La fin de chaque occurrence est majorée de son
enveloppe de propagation maximale (`stagger`, sinon
`REPLACE_STAGGER_SHARE_UPPER_BOUND` de la durée), car la durée d'un découpage
texte se mesure dans le DOM. Pendant le rejeu des frontières antérieures à la
cible, une occurrence hors de cette chaîne est marquée traitée sans session :
ni DOM, ni contexte GPU. Le `commit` du Seek active cette sélection, son `abort`
l'écarte, et la présentation de la scène cible l'efface. La présentation à la
cible elle-même suit la règle ordinaire.

Les comportements spécifiques de contenu, de segmentation et de capture média
restent définis dans [remplacement texte](./replace-text-v2-spec.md),
[remplacement média](./replace-media-v2-spec.md) et [slot](./slot-component-spec.md).
Le catalogue JSON et sa sélection auteur sont définis dans
[replace-presets](./replace-presets-v2-spec.md).

## Preuves

- [`replace-session.spec.ts`](../tests/runtime/capabilities/replace-session.spec.ts)
  vérifie une seule session quand un tween arrêté quitte la liste des actions,
  la même composition en Play et en Seek direct, l'absence de session pour les
  remplacements terminés avant la cible, et la chaîne A→B→C reconstruite comme
  en Play. Un contrôle navigateur H-i-C, avec le renderer WebGL2 de `burn`
  alors en place, a confirmé l'absence d'erreur de contextes après des Seeks
  au-delà de plusieurs `burn`.

- [`foreign-mount.spec.ts`](../tests/facade/foreign-mount.spec.ts) pilote le
  `TimeTicker` avec des frames contrôlées : progression d'opération pendant
  la pause de l'hôte, indépendance du Seek/reset, absence de progression
  sans frame et retrait des vues à la fin.
- [`replace-presentation.spec.ts`](../../sighty/tests/replace-presentation.spec.ts)
  vérifie la sélection du profil entrant ou du profil du slot et la
  progression exclusivement sur les frames distribuées.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les poses texte en `rem`, les transforms ACE, le chroma, les formes
  SVG, le reflow et le nettoyage.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse `SceneBuilder` et `HtmlPlayerRunner` : formules de contenu,
  profils CSS/JSON, masques média, resize à temps constant, interruption
  A→B→C, gel de la copie vidéo et retry de frame à position player constante.
- [`html-in-canvas/session.spec.ts`](../tests/runtime/runner-html/html-in-canvas/session.spec.ts)
  vérifie, frontière GPU remplacée dans jsdom, le renderer de chaque effet, le
  nœud natif sortant d'un média et sa frame d'amorçage cadrée, les copies d'un
  slot sans modification de son contenu, l'absence de `visibility` sur les
  états, la durée et la restauration sur échec GPU ;
  [`texture-mapping.spec.ts`](../tests/runtime/runner-html/html-in-canvas/texture-mapping.spec.ts)
  vérifie l'alignement du support et les cadrages.
- Les six modules WGSL et leurs pipelines sont validés par un WebGPU réel. La
  démo [`hic-transitions`](../../demos/src/v2/demos/hic-transitions/main.ts)
  (une image par effet, joués l'un après l'autre, et une vidéo) est contrôlée
  dans un navigateur H-i-C : rendu des effets sur les médias, sans frame noire
  avant la transition, en Play et en Seek.
- Limites : le chemin slot (démo [`hic-slot`](../../demos/src/sighty/hic-slot/scenario.ts)),
  la capture d'une interruption H-i-C, la perte du device et le resize pendant
  un effet ne sont pas encore contrôlés dans un navigateur.

