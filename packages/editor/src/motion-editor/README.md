# Motion editor V2

**Statut : En cours**  
**Cible : CodPlay V2 / ed2**

Ce module fournit la surface d'authoring hors scène pour un déplacement
intra-capsule : géométrie affine, ghost géométrique, path SVG et geste central.
Il ne possède ni document, ni player, ni parentage ; le bridge \`decor-editor\`
est l'unique adaptateur qui crée le keyframe et écrit le décor.

Les extrémités du path sont les centres visuels affines des poses. Le builder
marque cette convention par `move.transition.pathAnchor: 'center'`; CodPlay V2
reconstruit l'origine affine à partir du même centre pendant l'interpolation.
Le module ne persiste donc aucun rectangle AABB ni pixel de viewport.

Le path affiché est préparé par les primitives ACE du runtime (`prepareSvgPath`,
`resolvePath`) avec les paramètres du builder (`arc-length`, précision 2). Le CS
ne lit ni le DOM de l'item ni un second état de trajectoire : le bridge consomme
`instance.presentation`, c'est-à-dire la pose affine numérique déjà résolue et
commitée par CodPlay pour l'item visible. Le snapshot reste réservé à la pose
logique des previews et des écritures. Une lecture de la position DOM ou une
projection locale du snapshot pourrait diverger après un seek ou une
reconstruction et n'est donc pas utilisée pour le CS.

L'import actuel des primitives de construction d'arc depuis l'éditeur, via
l'alias interne `ace` vers `packages/codplay/src/ace`, est un raccord **temp** de
cette tranche pour dessiner l'overlay. Il ne calcule pas la pose courante du CS
et ne constitue pas une API V2 normative de l'éditeur. La décision ultérieure
sur l'appartenance et la surface d'appel d'ACE (façade CodPlay ou bibliothèque
indépendante) ne doit jamais réintroduire un deuxième lecteur de trajectoire.

L'overlay affiche le point médian du seul segment actif après la même préparation
ACE que le builder (`arc-length`, précision 2). Quand l'item possède plusieurs
keyframes, tous les segments adjacents sont néanmoins projetés simultanément :
le segment actif reste opaque et porte l'unique poignée médiane ; les autres
trajets sont des paths SVG secondaires à opacité graduée, sans poignée ni
capture de pointeur. Cette vue globale permet de suivre le parcours complet
jusqu'au dernier KF sans transformer les artefacts en éléments de scène.
La pose du premier keyframe est aussi projetée comme un ghost géométrique de
parcours (`data-motion-ghost="initial"`) lorsque le segment actif est plus loin
dans la chaîne. Il reprend les éventuelles corrections de l'endpoint en cours,
reste hors scène, utilise une opacité discrète comparable à un trajet inactif
et peut ramener la sélection/playhead au premier keyframe ; si elle coïncide
déjà avec la source du segment actif, cette projection est masquée pour éviter
un double outline.
Côté HTML, la projection remplace entièrement le
`transform` auteur et s'ancre sur l'origine de layout non transformée capturée
par CodPlay ; l'item ne reprend donc pas le `translate` auteur en double et son
centre visuel reste sur la courbe affichée.

Après la création d'un segment, l'overlay projette les poses source et cible
comme ghosts géométriques hors scène. Le ghost dont la pose coïncide avec l'item
réel est masqué ; l'autre reste visible et cliquable pour rejoindre la borne
opposée. Entre les bornes, les deux ghosts sont visibles et cliquables pour
sélectionner leur KF et déplacer le playhead auteur du sequence-editor vers le
temps correspondant ; le joueur reçoit ensuite le même relais que lors d'un
scrub de timeline.
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

Le routage actuel réserve une bande intérieure de 12 px au CS existant et
utilise le centre pour le déplacement temporel. La durée par défaut est 500 ms.
Les presets/champ numérique de durée, collisions, KFs temporaires, undo/redo et
la refonte du \`sequence-editor\` restent des tranches ultérieures du plan
\`2026-09-02-motion-editor-v2-plan.md\`.
