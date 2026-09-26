# CodPlay V2 — intégration des composants Avatar

## Périmètre vérifié

Cette spécification décrit le raccord vérifié entre les composants Avatar de
`@codplay/component-v2` et les capacités Three.js/CodPlay. Elle ne fixe pas la
transposition complète de TalkingHead. Les choix et validations encore ouverts
sont suivis par le
[plan Avatar](../plan/2026-09-19-avatar-components-v2-plan.md).

Les contrats de relation, de bibliothèque et d'hôte Three.js restent ceux des
spécifications [rel](./third-party-rel-spec.md),
[bibliothèques tierces](./third-party-library-spec.md) et
[Three.js](./third-party-threejs-spec.md).

## Propriété et raccord

- `three-scene-host` possède le canvas, le renderer, la scène et le commit de
  rendu. Le composant `avatar` attache son modèle à l'hôte et ne possède pas ces
  ressources.
- `avatar` est un composant logique attaché au host par `rel`. Sa définition
  publie une capacité Avatar opaque sous l'identité de cible du perso.
- `avatar-mood`, `avatar-lip-sync`, `avatar-gesture`, `avatar-idle`,
  `avatar-gaze` et `avatar-motion` sont des composants logiques attachés à cette
  cible. Ils transmettent leurs contributions par cette capacité ; ils ne
  recherchent pas le modèle ni ses nœuds Three.js.
- Chaque instance Avatar crée son propre état natif. Les octets du modèle et
  des animations sont obtenus par les stratégies de preload Three.js ; le
  composant Avatar ne crée pas de téléchargement ou de cache parallèle.
- La présentation est pilotée par le temps CodPlay et le commit de l'hôte
  Three.js. Le module Avatar n'introduit ni player, ni horloge, ni boucle de
  rendu concurrente.

## Contributions exercées

- Les composants humeur, lip-sync et geste contribuent au coordonnateur Avatar
  par des actions ordinaires. Les noms d'action portent les choix stables ; les
  données d'occurrence portent les valeurs variables telles que visème, poids
  ou durée.
- `avatar-idle` fournit des fonctions déterministes pour le clignement, la
  respiration et la dérive. Les séquences sont reproductibles à partir du temps
  absolu après un retour Seek.
- `avatar-gaze` transmet l'état de contact avec la caméra du host ; l'Avatar
  central obtient la caméra publiée par Three.js.
- Les gestes sémantiques et les motions du catalogue sont échantillonnés sur le
  temps CodPlay. Les tests isolés couvrent notamment leur déterminisme, leurs
  pistes distinctes et le rejeu de gestes après Seek.
- Le lecteur d'animation associé à un Avatar échantillonne un clip préchargé à
  un temps absolu et reconstruit son échantillon après préparation de Seek. La
  composition complète entre clip, pose sémantique et transition de release
  reste exclue de ce contrat tant que le parcours intégré n'est pas accepté.

## Vocabulaire d'événements exercé

Les noms d'action portent la sélection stable, par exemple
`avatar:mood:happy`, `avatar:gesture:thumbup` ou `avatar:gaze:on`. Les données
d'occurrence portent les valeurs qui varient, telles que `durationMs`,
`contact`, `viseme` et `weight`. Le perso `avatar-lip-sync` reçoit l'action
`avatar:viseme` et sa valeur de visème dans les données. `avatar-motion` choisit
une ressource enregistrée par son nom d'action ; le résultat de
`avatar:motion:release` sur la pose intégrée reste soumis à la gate ci-dessus.

Les types d'initial et de payload sont déclarés dans
[`avatar-types.ts`](../../authoring/component-v2/src/avatar/components/avatar-types.ts).
L'enregistrement des composants et le fournisseur de cible sont décrits par
[`avatar-definitions.ts`](../../authoring/component-v2/src/avatar/components/avatar-definitions.ts).

## Preuves et limites

Les suites de `packages/authoring/component-v2/tests/` couvrent :

- les contributions au coordonnateur
  ([`avatar-components.spec.ts`](../../authoring/component-v2/tests/avatar-components.spec.ts)) ;
- le catalogue et les composants de motion
  ([`avatar-motion.spec.ts`](../../authoring/component-v2/tests/avatar-motion.spec.ts)) ;
- le moteur de geste
  ([`avatar-gesture-engine.spec.ts`](../../authoring/component-v2/tests/avatar-gesture-engine.spec.ts)) ;
- le binding des morphs
  ([`avatar-morph-binding.spec.ts`](../../authoring/component-v2/tests/avatar-morph-binding.spec.ts)) ;
- le lecteur de clips
  ([`avatar-animation-player.spec.ts`](../../authoring/component-v2/tests/avatar-animation-player.spec.ts)) ;
- la frontière de chargement binaire par Three.js
  ([`threejs-preload.spec.ts`](../../authoring/component-v2/tests/threejs-preload.spec.ts)).

Ces suites ont été relancées le 2026-09-26 : **6 fichiers, 31 tests réussis**.
Elles valident leurs fixtures isolées et ne ferment pas le parcours intégré de
release décrit au plan.

Le plan rapporte aussi des parcours Safari de l'humeur, du regard, des gestes
et de l'idle sur la démo V2. Ces observations valident les scénarios nommés ;
elles ne certifient pas la composition générale de la pose squelettique. Le
parcours intégré de release/animation reste ouvert au plan Avatar, de même que
la sémantique de `rescale` et le classement du périmètre TalkingHead restant.

Cette spécification ne certifie donc ni la migration Avatar complète, ni la
composition unique de toutes les couches, ni un comportement physique
reconstructible qui dépendrait du delta de frame.
