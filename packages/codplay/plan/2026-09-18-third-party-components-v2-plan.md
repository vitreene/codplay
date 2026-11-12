# Stabilisation V2 — intégrations tierces et pont de cibles

> Statut : En cours. Les spécifications Three.js, Rive et Avatar décrivent les
> comportements intégrés et vérifiés. Ce plan conserve les décisions et les
> validations qui restent ouvertes.

## Contrats et propriétaires

Les références vérifiées sont les spécifications [rel](../specs/third-party-rel-spec.md),
[pont de cibles](../specs/third-party-target-bridge-spec.md),
[bibliothèques](../specs/third-party-library-spec.md),
[Three.js](../specs/third-party-threejs-spec.md), [Rive](../specs/third-party-rive-spec.md)
et [Avatar](../specs/third-party-avatar-spec.md). Le [plan Avatar](./2026-09-19-avatar-components-v2-plan.md)
possède ses écarts de pose, son périmètre TalkingHead et son acceptation propres.

Une convention native reste dans son intégration. Toute lacune générique
établie par les parcours ci-dessous doit recevoir une décision et une
autorisation explicites avant modification du cœur. Les composants utilisent
le cycle CodPlay et ne créent pas de registre, preload, horloge ou boucle de
rendu parallèles.

## Décisions ouvertes ou acceptées mais non appliquées

1. **Granularité des packages — à décider.** Comparer les besoins avant de
   choisir si Three.js, Rive et Lottie restent dans `@codplay/component-v2` ou
   deviennent des packages séparés. Ne pas déduire la décision de l’organisation
   actuelle du code.
2. **Surface auteur Three.js — à définir.** Les scénarios caméra, couleur et
   déplacement passent par `TweenAction`. Inventorier les besoins avant de
   proposer des opérations auteur propres au composant.
3. **Hôte Lottie simple — périmètre accepté, implémentation et vérification
   ouvertes.** Le périmètre est une composition linéaire contrôlée par CodPlay
   avec Play et pause. Segments, marqueurs, layers et cibles internes sont
   exclus. Vérifier si ce périmètre démontre le pont ; faire décider toute
   extension avant de l’implémenter.
4. **Relation `sync` — décision acceptée le 14 octobre 2026, réalisation
   différée à la demande de l’utilisateur.** L’extension aux composants liés
   aux médias Rive, Three.js et Lottie prévoit `auto` (défaut, pilotage CodPlay)
   et `independent` (temps indépendant avec les commandes explicites prises en
   charge). Ces familles ne proposeront pas `master`. Le mode indépendant de
   `media` est vérifié dans la [spécification média](../specs/media-sync-v2-spec.md) ;
   les profils tiers ne possèdent pas encore cette propriété.

Avant de réaliser `sync`, préciser les composants concernés dans chaque
intégration, le raccord aux circuits existants de présentation et de commit,
les commandes et transitions de transport, les frontières de montage,
masquage et destruction, ainsi que les validations du défaut `auto`, du mode
`independent` et du refus de `master`. Cette décision n’autorise ni seconde
boucle de rendu, ni nouveau player, ni horloge privée. Toute lacune générique
doit être cadrée dans le [plan du pont CodPlay](./2026-09-18-third-party-render-target-codplay-plan.md)
avant une modification du cœur.

## Acceptation commune du pont

1. Comparer propriétaires de contexte, identités, cardinalités, temps,
   ressources et diagnostics des intégrations. La comparaison Lottie reste
   séparée avant toute qualification transverse.
2. Couvrir isolation engine/player, publication après montage, cible
   temporairement indisponible puis remontée et plusieurs consommateurs.
3. Couvrir préparation et échec de bibliothèque/ressource, Seek avant/arrière,
   reset, replay, resize et destruction sur les intégrations réelles.
4. Utiliser les runners réels dans Safari et un second navigateur. Les cibles
   factices et runtimes synthétiques ne ferment pas cette acceptation.

## Acceptation par intégration

- **Three.js :** destruction complète, isolation des hôtes et players,
  caméra/couleurs pilotées au temps CodPlay et commit final du vrai host.
- **Rive :** Play/Seek, resize, retour temporel, remontage et destruction avec
  le runtime et les documents Rive réels. Le lot ViewModel du 4 novembre 2026
  et sa preuve native sur le rig fourni sont décrits dans la
  [spécification Rive](../specs/third-party-rive-spec.md) ; ils ne ferment pas
  les parcours des autres documents ou familles.
- **Lottie :** implémenter le périmètre accepté, puis vérifier le chemin réel
  engine, preload, player et rendu.
- **Preview Rive S1 — à analyser, hors lot ViewModel :** une preview
  `snapshot.set` ajoutant `style.opacity = 0.5` à un état sans opacité laisse
  `canvas.style.opacity` à `0.5` après `snapshot.clear()`. Reproduire avec un
  composant HTML simple et identifier le propriétaire avant toute correction.
  Aucun correctif ou contournement n’est appliqué. Le
  [relevé navigateur](../../elce/notes/assets/talking-head/rive-player-acceptance.json)
  conserve ce constat ; sa fermeture ne fait pas partie du lot 0 accepté.

Les validations transverses et leur ordre sont détaillés dans le
[plan d’acceptation du pont](./2026-09-18-third-party-render-target-codplay-plan.md).
Les tests isolés prouvent uniquement le sous-contrat qu’ils exercent et ne
ferment pas ces parcours d’intégration.

## Clôture

Transférer dans les spécifications uniquement les comportements intégrés et
vérifiés. Garder ce plan actif tant qu’une décision ou une validation
d’intégration reste ouverte ; le retirer lorsque les composants concernés
sont couverts par leurs spécifications et qu’aucune tâche propre à ce plan ne
reste.
