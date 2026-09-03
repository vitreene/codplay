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

Le CS et l'overlay appellent les primitives ACE pures (`prepareSvgPath`,
`resolvePath`, `prepareTween`, `resolveTweenProgress`) avec les mêmes paramètres
que le builder/runtime (`arc-length`, précision 2 et easing du segment). Le CS
ne lit ni le DOM de l'item ni un second état de trajectoire : le bridge lui
fournit la pose logique courante et projette son centre sur ce calcul partagé.
Une lecture de la position DOM serait une mesure AABB non canonique et pourrait
diverger après un seek ou une reconstruction.

L'import actuel de ces primitives depuis l'éditeur, via l'alias interne `ace`
vers `packages/codplay/src/ace`, est un raccord **temp** de cette tranche. Il
maintient une implémentation unique pendant la mise au point de la trajectoire,
mais ne constitue pas une API V2 normative de l'éditeur. Après stabilisation de
la géométrie et de la couture Play/Seek, l'appartenance et la surface d'appel
d'ACE seront décidées séparément : façade CodPlay ou bibliothèque ACE
indépendante. Aucun solveur concurrent ne doit être créé entre-temps.

L'overlay affiche le point médian après la même préparation ACE que le builder
(`arc-length`, précision 2). Côté HTML, la projection remplace entièrement le
`transform` auteur et s'ancre sur l'origine de layout non transformée capturée
par CodPlay ; l'item ne reprend donc pas le `translate` auteur en double et son
centre visuel reste sur la courbe affichée.

Le routage actuel réserve une bande intérieure de 12 px au CS existant et
utilise le centre pour le déplacement temporel. La durée par défaut est 500 ms.
Les presets/champ numérique de durée, collisions, KFs temporaires, undo/redo et
la refonte du \`sequence-editor\` restent des tranches ultérieures du plan
\`2026-09-02-motion-editor-v2-plan.md\`.
