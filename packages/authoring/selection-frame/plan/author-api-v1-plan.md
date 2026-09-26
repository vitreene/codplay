# Plan — surface `AuthorApi` V1

> Statut : **En cours**. La [spec V1](../../../docs/formalisation/v1-author-api-spec.md)
> ne certifie que les méthodes étayées par les tests listés. Des champs
> supplémentaires restent dans le type source sans contrat certifié.

## Décision acceptée, preuve restante

| Décision | Travail restant | Parcours d’acceptation |
|---|---|---|
| `subscribeToPlayerState` reste dans la façade partagée `AuthorApi` (décision conservée au plan telco du 2026-07-17). | La conversion du statut en `isPlaying`, l’appel immédiat, le filtrage des transitions sans changement et le désabonnement n’ont pas de test direct sur `createAuthorApi`. | Un test construit un vrai `Player`, crée `AuthorApi`, observe l’état initial puis play/pause, vérifie l’absence de doublon et désabonne l’observateur. |

## Décisions ouvertes

| Sujet | État constaté | Décision et parcours d’acceptation |
|---|---|---|
| `getPersoStates` | Le champ est présent dans `AuthorApi` et délègue à `Player.getPersoStates()`. Le getter Player a un test réel de scène et de seek ; aucun consommateur actuel n’a été trouvé dans `packages/editor/src`, et le wrapper n’a pas de test dédié. | Décider si ce champ reste dans la surface V1. S’il reste, tester `createAuthorApi` sur un seek réel et vérifier les valeurs brutes reçues ; s’il est retiré, vérifier les consommateurs restants avant de supprimer le champ. |
| `getPlayerState` | Le champ est présent dans le type et retourne `isPlaying` depuis `Player.getState().status`. Il n’a pas de test direct ni de consommateur source trouvé. | Décider s’il reste nécessaire avec `subscribeToPlayerState`. Si oui, couvrir l’état courant après init et les états aux transitions ; sinon, retirer le champ avec la décision correspondante. |
| Garanties de cycle de vie | L’ancien texte affirme des garanties avant `player.init()` et après `player.destroy()`. Les tests disponibles couvrent le niveau orchestrateur pour `subscribeToNode`, mais pas ce contrat complet à travers `createAuthorApi` et `Player`. | Décider quelles garanties sont supportées, puis les tester à la frontière réelle `Player → AuthorApi`, ou retirer ces formulations de la spec. |
| Conformité du wrapper | Les tests de pose et de snapshot couvrent le `PlayerApi`, tandis que les appels d’`AuthorApi` sont des délégations directes dans `author-api.ts`. | Si une garantie de bout en bout est requise pour cette façade, ajouter un test qui passe par `createAuthorApi` pour les méthodes certifiées et l’attache/remontage du nœud. Conserver au plan toute surface non couverte jusqu’à ce résultat. |

## Hors périmètre retenu

Les anciennes pistes `getCompiledScene()`, `subscribeToPlayerEvent()` et
`getPersoIds()` n’ont pas de décision acceptée ni de consommateur établi. Elles
ne constituent pas des contrats ni des tâches actives ; elles ont été retirées
de la spec.
