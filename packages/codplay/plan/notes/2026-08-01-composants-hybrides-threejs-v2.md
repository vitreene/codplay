# CodPlay V2 — composant hôte et projection Three.js

## Statut

Statut : **En cours** — direction validée, implémentation suivie par les plans
du pont runtime et des composants externes

Version CodPlay : V2

Révision : modèle corrigé le 2026-09-18

Cette note décrit la direction du composant hôte. Le contrat détaillé et son
ordre d'implémentation sont suivis dans :

- [`2026-09-18-third-party-render-target-analysis.md`](./2026-09-18-third-party-render-target-analysis.md) ;
- [`../2026-09-18-third-party-render-target-codplay-plan.md`](../2026-09-18-third-party-render-target-codplay-plan.md) ;
- [`../2026-09-18-third-party-components-v2-plan.md`](../2026-09-18-third-party-components-v2-plan.md).

## Décision corrigée

La première version de cette note décrivait un composant `avatar3d`
monolithique : il possédait le canvas, la scène, l'avatar, la caméra, le lipsync
et toutes les animations.

Cette forme reste techniquement possible pour un média autonome, mais ce n'est
plus le modèle du chantier V2. Le projet vise une projection composable :

```text
perso hôte HTML
  -> canvas + renderer + scène + matérialiseur Three.js
       -> perso caméra
       -> perso lumière
       -> perso géométrie
       -> perso avatar
            -> perso lipsync
```

Le matérialiseur HTML reste l'unique matérialiseur global de l'instance. Le
matérialiseur Three.js appartient au composant hôte et ne devient pas une option
de la façade.

## Propriété des couches

Le matérialiseur HTML possède la représentation externe :

- création et montage du canvas ou de l'élément d'accueil ;
- placement du perso hôte dans la scène HTML ;
- services HTML déclarés par l'hôte ;
- démontage de cette représentation.

Le composant hôte possède la projection interne :

- renderer et scène Three.js ;
- adaptation du viewport ;
- matérialiseur Three.js local ;
- registre de handles isolé ;
- commit unique du rendu ;
- destruction du contexte et de ses ressources.

Les composants spécialisés possèdent seulement leur feature et les ressources
qu'elle crée. Le core ne reçoit aucun `THREE.Object3D`.

## Relation `rel`

Un composant spécialisé désigne sa scène ou son perso fournisseur par `rel`.
Cette relation :

- appartient à `initial` ;
- est immuable ;
- porte une cible commune `{ host, target? }` ;
- peut être enrichie, typée et validée par l'intégration ;
- n'est jamais résolue manuellement par le composant de feature.

`move` continue de placer le perso hôte dans le DOM. Il ne sert pas
automatiquement de relation de contrôle entre un lipsync et un avatar.

## Cycle de vie visé

1. L'engine rend disponible l'unité Three.js et ses dépendances.
2. Le matérialiseur HTML monte l'hôte.
3. L'hôte crée sa projection et publie sa cible.
4. Le pont publie les cibles montées avant de livrer les `rel` aux consommateurs.
5. Les composants spécialisés créent ou mettent à jour leurs objets natifs.
6. Les contributions visant un même objet sont composées.
7. L'hôte rend une seule image.
8. Le démontage détruit consommateurs, objets, contexte puis hôte selon l'ordre
   spécifié.

Ce cycle doit être identique pour Play, Seek, reset et resize. Aucun composant
tiers ne possède sa propre horloge.

## Frontière auteur

Le perso reste une déclaration de données. Le composant de feature définit son
profil, ses actions et l'application de l'état résolu. Les straps peuvent
préparer les données sérialisables.

La base ou la factory d'intégration masque :

- chargement de la bibliothèque ;
- validation de `rel` ;
- résolution des cibles ;
- registre des handles ;
- phase de publication avant mise à jour ;
- commit du rendu.

Une identité de relation inconnue n'interrompt pas la construction ou la
lecture de la scène. `SceneBuilder` produit un warning auteur non bloquant,
silencieux en diffusion, et le composant reste sans cible. Le core ne vérifie
pas la compatibilité native et ne construit pas de graphe récursif ; ces
responsabilités appartiennent à l'intégration. Une cible valide temporairement
non montée est mise en attente sans warning et peut être résolue à son prochain
montage.

Le cas d'un contrôleur comme `lipsync`, qui contribue à un avatar sans créer une
représentation autonome, reste provisoirement modélisé comme un perso. Cette
tension doit être évaluée pendant le chantier avatar ; elle peut révéler une
primitive distincte.

## Hors contrat actuel

- forme TypeScript définitive des relations de chaque intégration ;
- règles de résolution de `rel.target` ;
- API du matérialiseur possédé par l'hôte ;
- factory destinée aux composants de feature ;
- composition des contributions avatar.

Aucun de ces points ne doit être fixé opportunistement dans une démo.
