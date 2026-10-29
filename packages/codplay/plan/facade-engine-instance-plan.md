# Façade CodPlay V2 — extensions restantes

> Statut : En cours pour l'observation de `snapshot` et la fermeture complète
> des familles du paquet de diffusion. Le chargement média/CSS/fontes est
> vérifié ; le transport des fonctions auteur est en cours en R8. Son contrat
> vérifié est dans la
> [spécification façade](../specs/facade-v2-spec.md) et la
> [spécification du paquet](../specs/scene-package-export-v1-spec.md).

## Autorité et périmètre

La spécification façade fait foi pour la surface publique vérifiée : propriétaire
`CodPlay`, compilation, registres, ressources, moteur, instances, telco,
événements, previews logiques, projection `input`, présentation numérique et
montage interinstances. Les comportements plus précis restent dans leurs
spécifications et plans dédiés :

- [Engine et Player](../specs/engine-player-v2-spec.md) et son
  [plan d'acceptation](./player-engine-plan.md) ;
- [pipeline événementiel](../specs/event-pipeline-v2-spec.md) ;
- [projection `input`](../specs/input-projection-spec.md) ;
- [montage de contenu foreign](./foreign-scene-component-plan.md) ;
- [preload et diffusion](./media-preload-plan.md) ;
- [préparation et présentation motion](./motion-live-discovery-invalidation-plan.md)
  et [intégration FLIP](./runner-flip-integration-study.md).

Les contrôles navigateur sont suivis par les plans des comportements concernés.
Aucune gate navigateur propre à la façade n'est définie au-delà de ces parcours.

## Chargement d'un paquet de scène

`CodPlay.load(scenePath, { root })` charge un paquet média sur un propriétaire
`CodPlay` existant et retourne l'instance prête de cette scène. La lecture
continue par `instance.telco.play()`. `root` accepte un sélecteur CSS ou un
`HTMLElement`. Le chargement utilise le même engine, preload, registre de
ressources et registre d'instances que le mode auteur ; il ne crée pas un
player parallèle.

Cette tranche est implémentée et vérifiée pour les médias image/audio/vidéo,
CSS et fontes décrits par la
[spécification du paquet de scène](../specs/scene-package-export-v1-spec.md).
Le premier appel à `load()` verrouille immédiatement les registres publics.
Les composants et bibliothèques sont fournis par l'engine partagé, configuré
avant le chargement ; toutes les scènes d'un même owner utilisent les mêmes
définitions. La voie d'ajout de capacités par paquet et ses factories sont
retirées par la décision du 2026-10-20. Le retrait du code et la reprise des
preuves d'intégration sont suivis en R9–R12 du plan d'export.
Le module de fonctions auteur est chargé et passé à l'instance selon D4 ;
`onStart` est vérifié dans le navigateur, mais l'exécution des straps externes
par `listen` reste ouverte au [plan d'export](./2026-10-15-export-diffusion-plan.md).
Le constructeur
`new CodPlay(options)`, `build()` et la création manuelle d'instances restent
inchangés ; le test de chargement garde une instance auteur vivante pendant
l'ajout d'une occurrence de diffusion.

## Décision non prise : observation des changements de snapshot

L'API vérifiée reste `instance.snapshot.get()`, `set(patches)` et `clear()`.
Une notification telle que `snapshot.onChange` n'est ni décidée ni implémentée.
Le contrat existant reste suffisant tant qu'aucun consommateur ne demande une
observation directe.

Si un besoin concret justifie cette extension, décider avant toute modification
du cœur :

1. quels changements sont observés : état de base présenté, opérations de
   preview réussies, ou les deux ;
2. si une preview change le signal alors que `get()` continue de renvoyer l'état
   de base ;
3. la forme de la donnée relue par le consommateur et l'appel initial éventuel ;
4. l'ordre des notifications par rapport à `set`, `clear`, `seek` et à la
   présentation ;
5. l'isolation des erreurs, le désabonnement et le comportement après
   destruction.

Le parcours d'acceptation devra couvrir la lecture initiale, la pose, le
remplacement et l'effacement d'une preview, un seek vers un autre temps puis le
retour, ainsi que la destruction. Il devra prouver qu'un seul circuit de
présentation est observé. Aucun nom de méthode, DTO ou événement ne constitue
un contrat avant cette décision.
