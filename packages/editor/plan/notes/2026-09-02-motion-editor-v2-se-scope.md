# Note de portée V2 — sequence-editor et déplacement intra-capsule

**Date :** 2026-09-02  
**Portée :** éditeur de mouvement `ed2` / CodPlay V2.  
**Statut :** note d'élaboration, non normative ; la tranche d'implémentation est désormais autorisée
par le plan de l'éditeur de mouvement, sans ouvrir de chantier `sequence-editor`.

Pour la version actuelle de l'éditeur, un déplacement se fait à l'intérieur
d'une même capsule mère. La source et la cible restent donc dans le même
`parentId` immédiat (la racine implicite compte comme la scène) ; le geste ne
modifie ni le parentage ni l'ordre de l'item. Le reparentage accepté par
CodPlay V2 est une capacité runtime distincte et n'est pas exposé par cette
version de l'éditeur.

La nécessité éventuelle d'une refonte approfondie du `sequence-editor` est
conservée comme remarque pour une étape ultérieure. Elle ne constitue pas un
chantier de la version actuelle : aucune modification du SE, de ses commandes,
de son modèle de pistes ou de son rendu n'est prévue pour le moment. Le plan
de l'éditeur de mouvement doit donc traiter cette contrainte comme une limite
de portée, sans introduire de circuit de reparentage ni de contournement local.

Cette note sera réévaluée lorsque l'usage aura validé le geste intra-capsule et
que la définition des zones de capsule nécessitera éventuellement une évolution
du SE.
