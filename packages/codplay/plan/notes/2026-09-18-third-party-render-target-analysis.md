# Rationale — pont vers les projections tierces

> Note mise à jour le 2026-09-26. Les contrats vérifiés sont dans les
> spécifications liées ; les validations manquantes sont suivies par le
> [plan d'acceptation CodPlay](../2026-09-18-third-party-render-target-codplay-plan.md).

CodPlay garde un matérialiseur HTML global. Une intégration peut héberger une
projection native dans un composant et publier des cibles opaques aux
composants qui y contribuent. Le core connaît l'identité et la disponibilité
de la cible, mais pas les objets ni les règles internes de Three.js, Rive ou
d'une autre bibliothèque.

Cette frontière conserve un seul circuit CodPlay pour les scènes et le temps,
tout en laissant chaque intégration posséder ses objets, ressources et
présentation. Les composants natifs restent soumis au temps absolu du player ;
ils n'ajoutent pas d'horloge ni de registre parallèle au core.

Les contrats testés sont dans les spécifications de [relation `rel`](../../specs/third-party-rel-spec.md),
du [pont runtime](../../specs/third-party-target-bridge-spec.md), de la
[préparation des bibliothèques](../../specs/third-party-library-spec.md),
[Three.js](../../specs/third-party-threejs-spec.md), [Rive](../../specs/third-party-rive-spec.md)
et [Avatar](../../specs/third-party-avatar-spec.md).
La comparaison des familles, la preuve Lottie et les cycles de vie navigateur
restent des gates du plan d'acceptation. Cette note ne définit pas d'API ou de
comportement supplémentaire.
