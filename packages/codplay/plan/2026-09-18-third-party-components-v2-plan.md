# Plan d’acceptation des composants tiers V2

> Statut : **En cours**. Les spécifications Three.js, Rive et Avatar décrivent
> leurs sous-ensembles implémentés et vérifiés. Ce plan conserve les décisions
> d’intégration encore ouvertes et les validations propres aux composants.

## Périmètre et contrats établis

Ce plan suit les intégrations de bibliothèques dans
`packages/authoring/component-v2/`. L’acceptation des frontières génériques
CodPlay — `rel`, publication des cibles et préparation des bibliothèques — est
suivie dans le [plan du pont CodPlay](./2026-09-18-third-party-render-target-codplay-plan.md).
Les contrats déjà vérifiés sont décrits par les spécifications
[Three.js](../specs/third-party-threejs-spec.md),
[Rive](../specs/third-party-rive-spec.md) et
[Avatar](../specs/third-party-avatar-spec.md). Elles font foi pour les
comportements qu’elles couvrent.

Le motif de séparation entre hôte HTML, projection native hébergée et
composants logiques est conservé dans la
[note de rationale](./notes/2026-08-01-composants-hybrides-threejs-v2.md) ;
elle n'ajoute aucun contrat.

L’Avatar, ses expressions et ses gestes relèvent du
[plan Avatar dédié](./2026-09-19-avatar-components-v2-plan.md) et de sa
[spécification partielle](../specs/third-party-avatar-spec.md). Aucun besoin de
TalkingHead ne complète implicitement le contrat Three.js ou Rive.

Les décisions d’intégration acquises sont conservées : les composants utilisent
le cycle CodPlay, possèdent uniquement leurs ressources natives, et ne créent
pas de registre, preload, horloge ou boucle de rendu parallèles. Un besoin
générique CodPlay doit être décidé et accepté dans le plan du pont avant toute
modification du cœur.

## Décisions à prendre ou acceptées mais non appliquées

1. **Granularité des packages d’intégration — à décider.** Le code courant
   regroupe plusieurs composants dans `@codplay/component-v2`, mais ce fait ne
   tranche pas si Three.js, Rive et Lottie doivent rester regroupés ou devenir
   des packages séparés. Consigner la décision après la comparaison des
   besoins, sans la déduire de l’organisation actuelle du code.
2. **Surface auteur des composants Three.js — à définir.** Les scénarios
   caméra, couleur et déplacement passent aujourd’hui par `TweenAction`. La
   forme d’éventuelles opérations auteur portées par les composants reste
   ouverte jusqu’à l’inventaire des besoins. Ne pas ajouter d’API avant cette
   décision.
3. **Hôte Lottie simple — décision prise, implémentation et vérification
   ouvertes.** Le périmètre retenu est une composition linéaire contrôlée par
   CodPlay avec Play et pause. Les segments, marqueurs, layers et cibles
   internes ne font pas partie de cette tranche. Vérifier si ce périmètre
   suffit à démontrer le pont ; sinon, faire décider l’extension avant de
   l’implémenter.

## Parcours d’acceptation restant

Les validations transverses et leur ordre sont détaillés dans le
[plan d’acceptation du pont](./2026-09-18-third-party-render-target-codplay-plan.md).
Pour fermer les intégrations de ce plan, ce parcours doit notamment couvrir :

- **Three.js** : destruction complète, isolation des hôtes et players, et
  contrôle navigateur du scénario caméra/couleurs, avec le vrai runner V2 ;
- **Rive** : Play/Seek, resize, retour temporel, remontage et destruction avec
  le runtime et le document Rive réels ;
- **Lottie** : implémentation du périmètre accepté, puis preuve par le chemin
  réel engine, preload, player et rendu ;
- la comparaison des familles, les cas communs et les navigateurs requis par
  le plan du pont.

Les tests isolés et les runtimes synthétiques prouvent uniquement le sous-contrat
qu’ils exercent ; ils ne ferment pas ces parcours d’intégration.

## Clôture

Transférer dans une spécification chaque comportement intégré et vérifié.
Garder ce plan actif tant qu’une décision ci-dessus ou une validation
d’intégration reste ouverte. Le retirer lorsque les composants concernés sont
couverts par leurs spécifications et qu’aucune tâche propre à ce plan ne reste.
