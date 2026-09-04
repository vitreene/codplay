# Motion editor V2

**Statut : En cours**  
**Cible : CodPlay V2 / ed2**

Ce module fournit la surface d'authoring hors scène pour un déplacement
intra-capsule : géométrie affine, ghost géométrique, path SVG et geste de
déplacement unique.
Il ne possède ni document, ni player, ni parentage ; le bridge \`decor-editor\`
est l'unique adaptateur qui crée le keyframe et écrit le décor.

Le sous-module temporel (`timing.ts`) reste un domaine pur. Il ordonne une
collection de références de keyframes sans la modifier, situe le playhead avant,
sur, entre ou après les KFs, et distingue les bornes réelles des bornes
virtuelles héritées d'une capsule. Il résout également la fenêtre de transition
de mouvement : `500 ms` par défaut, bornée à l'intervalle source → cible et
positionnable juste avant le KF cible. Cette fenêtre ne détermine jamais le temps
d'un KF créé ; son raccord au builder/runtime est réservé à P4.

Les extrémités du path sont les centres visuels affines des poses. Le builder
marque cette convention par `move.transition.pathAnchor: 'center'`; CodPlay V2
reconstruit l'origine affine à partir du même centre pendant l'interpolation.
Le module ne persiste donc aucun rectangle AABB ni pixel de viewport.

Le path affiché est préparé par les primitives ACE du runtime (`prepareSvgPath`,
`resolvePath`) avec les paramètres du builder (`arc-length`, précision 2). Le CS
ne lit ni le DOM de l'item ni un second état de trajectoire : le bridge consomme
`instance.presentation`, c'est-à-dire la pose affine numérique déjà résolue et
commitée par CodPlay pour l'item visible. Pendant un seek, si une sélection
explicite pointe encore vers un KF ancien, le snapshot présenté au même temps
peut aussi servir à convertir exactement une translation border-box en content-box
; cette lecture ne remplace ni la sélection de trajectoire ni ses endpoints.

L'import actuel des primitives de construction d'arc depuis l'éditeur, via
l'alias interne `ace` vers `packages/codplay/src/ace`, est un raccord **temp** de
cette tranche pour dessiner l'overlay. Il ne calcule pas la pose courante du CS
et ne constitue pas une API V2 normative de l'éditeur. La décision ultérieure
sur l'appartenance et la surface d'appel d'ACE (façade CodPlay ou bibliothèque
indépendante) ne doit jamais réintroduire un deuxième lecteur de trajectoire.

L'overlay affiche le point médian du seul segment actif après la même préparation
ACE que le builder (`arc-length`, précision 2). Quand l'item possède plusieurs
keyframes `pose`, tous les segments adjacents sont néanmoins projetés simultanément :
le segment actif reste opaque et porte l'unique poignée médiane ; les autres
trajets sont des paths SVG secondaires nettement plus discrets, avec une
transparence forte et une couleur ambrée pâlie/désaturée, sans poignée ni
capture de pointeur. Chaque KF réel `pose` de l'item reçoit également un ghost
géométrique hors scène ; un KF `decor` n'en reçoit aucun. Le ghost qui coïncide avec la pose présentée est masqué ;
les autres restent visibles et cliquables. Leur bordure garde la même famille de
couleur, devient progressivement plus claire et moins saturée, et leur opacité
diminue selon la distance temporelle au KF courant dans la chaîne. Cette vue
globale permet de suivre le parcours complet jusqu'au dernier KF sans
transformer les artefacts en éléments de scène. La pose du premier keyframe utilise
`data-motion-ghost="initial"` lorsqu'elle n'est pas déjà l'un des endpoints du
segment actif ; elle reste translucide lorsqu'elle est inactive et ramène la
sélection/playhead au premier keyframe.
Côté HTML, la projection remplace entièrement le
`transform` auteur et s'ancre sur l'origine de layout non transformée capturée
par CodPlay ; l'item ne reprend donc pas le `translate` auteur en double et son
centre visuel reste sur la courbe affichée.

Le rectangle exposé au CS et aux artefacts de trajectoire est le `content-box` :
sa largeur et sa hauteur restent exactement celles de `pose.localWidth` /
`pose.localHeight`, donc celles de `offset.width` / `offset.height` en cqw. Le
bridge restaure l'origine content-box quand il lit la translation border-box du
snapshot runtime, puis reconstruit la translation border-box à partir de cette
origine pendant la preview. La bordure n'est jamais ajoutée aux dimensions ni au
tracé : elle peut faire varier le rectangle extérieur et sa translation CSS,
mais les bords internes restent confondus avec le CS. Un geste du CS travaille
déjà dans ce repère content-box et sérialise directement l'`offset` correspondant.
Les formes CSS `border`, `border-width`, `border-style` et leurs variantes
physiques sont résolues dans l'adaptateur éditeur, sans lecture du DOM et sans
fermer la carte ouverte des propriétés de `Decor`.

Lors d'un seek intermédiaire, la sélection explicite du dernier KF peut rester
présente jusqu'au relâchement du scrub. Elle conserve alors le path actif, mais
ne verrouille pas le CS : le frame courant est repris depuis la présentation
runtime (ou le snapshot au même temps pour la conversion de bordure). Les
endpoints documentaires ne sont jamais remplacés par cette valeur d'affichage.

Après la création d'un segment, l'overlay projette les poses de tous les KFs de
l'item comme ghosts géométriques hors scène. Le ghost dont la pose coïncide avec
l'item réel est masqué ; les autres restent visibles et cliquables pour
sélectionner leur KF et déplacer le playhead auteur du sequence-editor vers le
temps correspondant ; le joueur reçoit ensuite le même relais que lors d'un
scrub de timeline. La couleur de leur bordure devient plus pâle/désaturée et
leur transparence augmente légèrement avec leur distance temporelle au KF
courant.
La coïncidence est déterminée sur la pose structurée, avec une tolérance
subpixel pour les arrondis cqw/rendu, jamais par une mesure de bounding box DOM.
Quand le CS repositionne un KF d'un segment, le bridge met à jour immédiatement
l'extrémité correspondante, le ghost et la courbe de l'overlay ; la valeur
documentaire est ensuite commitée par le flux V2 habituel.
Pendant cette preview, le frame candidat accepté par `instance.snapshot`
(item et temps auteur) reste la base de l'édition suivante. Une lecture
`PresentationFrame` encore en retard ne peut donc pas réintroduire l'ancienne
translation lorsqu'un resize suit le repositionnement sur le même KF. Cette
priorité est limitée aux previews qui modifient la pose affine ; une couleur ou
une autre propriété de décor ne détourne pas la pose interpolée de lecture.

À la fin naturelle d'une lecture, le temps auteur est ramené à la durée de la
scène avant de sortir du mode lecture. Le player peut avoir une queue de sortie
virtuelle pour une capsule, mais cette queue ne devient jamais un temps de
l'éditeur : le CS et tous les ghosts sont réaffichés depuis la présentation de
la frontière auteur commune.

Le CS porte un seul geste de modification de décor ; l'ancien routage
centre/bord de 12 px est conservé comme module dormant, sans zone distincte
dans l'interface. Sur un KF réel, la surface de déplacement unique met à jour
ce KF au même instant. Entre deux KFs, elle crée un
KF au playhead auteur courant, puis les gestes suivants rééditent ce même KF.
Pendant ce geste intermédiaire, l'overlay ne dessine pas un faux trajet direct
entre les deux KFs d'origine : il prévisualise déjà la coupure réelle `A → C`
et `C → B`, avec `C` la pose déplacée. Le premier segment est droit par défaut,
et le path porté par le KF cible reste attaché au second segment, comme dans la
projection obtenue après le commit.
La surface de déplacement suit toujours la pose interpolée visible ; elle reste
prioritaire sur le point médian si celui-ci tombe sur l'item, afin que le drag
appelle bien la création du KF intermédiaire. Lorsqu'un KF `pose` est créé au milieu
d'un segment, la capture fige la pose affine complète exposée par le runtime — notamment
translation, largeur et hauteur — afin que le waypoint reste stable. Les propriétés de
décor qui accompagnent ce KF restent limitées aux valeurs effectivement modifiées.
Sur un KF cible en fin de segment, la surface reprend l'endpoint du segment actif pour
initialiser le déplacement ; elle ne recalcule pas le point de départ depuis une
présentation éventuellement décalée de l'item. Le path déjà porté par le KF cible reste
ainsi la trajectoire de référence après le déplacement.
Le commit du Selection Frame route aussi la rotation et le pivot par ce même chemin `pose` :
`offset.translate` porte le déplacement (et la compensation d'ancrage), `offset.width` /
`offset.height` le redimensionnement, `offset.rotate` la rotation et `offset.rotationOrigin` le
pivot. Ces opérations matérialisent le KF dès la libération du pointeur ; elles ne passent pas par
le flush d'inactivité du canal `decor`. Les champs de palette (`style.*`, `classes`, `zone`,
`custom` et les propriétés racine futures) restent, eux, des modifications `decor` sparse.
Dans la hiérarchie d'affichage, cette surface reste sous le CS : le corps du
Selection Frame est pointer-transparent pour laisser passer le déplacement,
mais ses poignées de rotation, de pivot et de redimensionnement restent
pointer-actives. Il n'y a donc pas de zone de mouvement qui recouvre ces
contrôles ni les points du CS.
La fenêtre de transition de mouvement conserve provisoirement la valeur de
500 ms ; elle ne détermine jamais le temps de création du KF.
Les presets/champ numérique de durée, collisions, KFs temporaires, undo/redo et
la refonte du \`sequence-editor\` restent des tranches ultérieures du plan
\`2026-09-02-motion-editor-v2-plan.md\`.
