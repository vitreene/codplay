# Plan d’acceptation Avatar par composants V2

> Statut : **En cours**. Le raccord CodPlay et plusieurs capacités Avatar
> disposent d'un sous-ensemble vérifié décrit dans la
> [spécification Avatar](../specs/third-party-avatar-spec.md). La composition
> finale des poses et le parcours intégré de release restent ouverts.

## Périmètre

Ce plan suit l'adaptation Avatar de TalkingHead dans
`@codplay/component-v2`. Il ne modifie pas le cœur CodPlay sans lacune prouvée,
plan accepté et autorisation explicite. Les contrats établis pour `rel`, le
host Three.js et le preload sont décrits par les spécifications
[rel](../specs/third-party-rel-spec.md),
[Three.js](../specs/third-party-threejs-spec.md) et
[bibliothèques](../specs/third-party-library-spec.md).

Les comportements déjà intégrés et vérifiés sont dans la
[spécification Avatar](../specs/third-party-avatar-spec.md). Le présent plan
ne les redéfinit pas. Les sections ci-dessous conservent les décisions à
relire, les comportements non appliqués et leur chemin d'acceptation.

## Décisions `A relire`

Le statut `A relire` interdit de poursuivre une implémentation dépendante de ces
choix avant leur réexamen. Aucune modification de code n'est autorisée par ce
plan tant qu'ils restent ainsi marqués.

### 1. Sémantique de `rescale`

La source MotionEngine consultée indique que `rescale` répartit le temps ajouté
quand une motion reçoit une durée supérieure à sa durée native ; pour une durée
plus courte, les segments sont uniformément mis à l'échelle. Le code Avatar V2
interprète actuellement cette donnée comme un facteur appliqué aux morphs, et
`avatar-motion.spec.ts` attend cette lecture pour `bow`.

Cette attente de test n'est pas une décision acceptée. Comparer la source et les
échantillons V1, arrêter le sens retenu, puis définir la preuve autonome qui le
valide. Jusqu'à cette relecture, ne pas inclure la sémantique de `rescale` dans
une spécification normative ni étendre son implémentation.

### 2. Propriétaire de la pose squelettique finale

Le parcours visuel de release invalide la tentative de composition actuelle :
`GestureEngine` et `AnimationMixer` écrivent successivement les mêmes os, tandis
que la pose sémantique continue d'évoluer. Leur transfert de propriété peut donc
produire une cassure et diverger entre Play et Seek.

Décider avant implémentation comment les contributions idle, geste, humeur,
regard, visèmes et clip sont échantillonnées au même temps absolu, composées,
puis appliquées par un propriétaire unique. Arrêter séparément le traitement
de la translation racine. Les fixtures doivent vérifier des poses synthétiques
à des temps identiques en Play et Seek ; la démo réelle valide ensuite le
parcours intégré.

## Travail restant

1. **Relire les deux décisions ci-dessus.** Fixer leur résultat et les
conditions de retrait du statut `A relire` avant tout travail dépendant.
2. **Rendre `avatar-motion` cohérent avec la décision de pose.** Vérifier la
   lecture, la sélection, le remplacement, le release et le Seek sur le
   propriétaire retenu. Ne pas déclarer stable le release testé isolément tant
   que l'intégration complète présente une divergence.
3. **Débloquer la validation navigateur réelle.** Le dernier parcours Avatar a
   été interrompu au preload audio sur l'attente de `canplaythrough` de
   `/assets/1_7b_e.mp3`. Suivre cette frontière dans le
   [plan média](./media-preload-plan.md) ; ne pas contourner le preload ni
   modifier la fixture pour masquer le blocage.
4. **Classer le périmètre TalkingHead restant.** Décider d'inclure, de reporter
   ou d'exclure explicitement les réactions pilotées par volume, Dynamic Bones
   et rééquilibrage physique, statistiques et callbacks de diagnostic. Tout
   comportement inclus doit être reconstructible ou posséder une décision
   explicite de limite Play/Seek.
5. **Terminer l'acceptation Avatar intégrée.** Rejouer les parcours retenus avec
   les composants, le host Three et le runner V2 réels, puis compléter les
   typechecks, tests, builds et validations navigateur applicables.

## Critères de clôture

- Les deux décisions `A relire` sont résolues avant l'implémentation qui en
  dépend.
- Le périmètre TalkingHead est classé et aucune responsabilité n'est seulement
  simulée par la démo.
- Play, pause, reprise, Seek, release, destruction et preload ont des preuves
  sur les parcours retenus.
- La spécification ne décrit que les comportements intégrés et vérifiés ; les
  choix non appliqués restent au plan.
- Le plan reste **En cours** tant que l'une de ces gates demeure ouverte.
