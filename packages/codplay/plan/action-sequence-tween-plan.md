# CodPlay V2 - ActionSequence et TweenAction

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: required before continuous renderer integration

## Contrat V2

Les deux primitives restent dans le circuit logique unique :

```text
CompiledScene + RuntimeTrackJournal + time
    -> materialize source events
    -> expand ActionSequence as derived actions
    -> resolve static actions and TweenAction(fn, progress)
    -> solve
```

`materialize` ne pousse jamais de continuation dans le journal. Les steps d'une
sequence sont des faits dérivés du même event déclencheur à chaque évaluation.
Cela supprime tout état d'idempotence séparé entre Play et Seek.

## ActionSequence

Une valeur d'action est une sequence si elle est un tableau non vide de
`{ action: CompiledRecord, durationMs?, startAt? }`. Les offsets sont planifiés
avec une primitive pure : `startAt` fixe un offset absolu, sinon le step démarre
à la fin du précédent; une durée absente vaut la durée implicite d'un
`TweenAction`, sinon zéro.

L'expansion est ciblée par le perso qui porte la clé d'action. Chaque step devient
une `MaterializedAction` directe avec son propre `startAt`, sans clé d'event
artificielle ni second routeur. Un fait ultérieur sur la même clé invalide les
steps différés de la sequence précédente à partir de sa date; les steps statiques
déjà échus restent des faits appliqués, tandis qu'un `TweenAction` remplacé est
retiré de la reconstruction à la cible. L'ordre des faits (`trackOrder`,
déclaration, `eventSeq`) tranche les égalités.

## TweenAction

Une action compilée portant `{ fn: { ref }, duration: number > 0, ease? }` est
évaluée dans `resolveScene` avec la collection de fonctions du build :

```text
progress = ease(clamp(elapsedMs / duration, 0, 1))
payload  = fn({ progress, data: action })
```

La fonction est pure, ne lit ni DOM ni état mutable et son résultat est appliqué
comme un payload d'action ordinaire. Une référence absente ou un résultat invalide
est une erreur explicite de résolution. L'easing par défaut est `linear` pour
respecter le contrat TweenAction, indépendamment du défaut des tweens ACE de
style.

`tween:stop` est une frontière logique réservée : il retire les `TweenAction`
antérieures de la reconstruction visée dans la même portée de story. Le stop ne
devient pas une action de perso, ne réexécute aucun effet et ne modifie pas le
journal.

## Invariants

- aucun append runtime pendant `materialize` ou `resolve`;
- les steps sont dérivés des mêmes events pour Play et Seek;
- une sequence ne crée pas de doublon d'event dans le journal;
- les fonctions de TweenAction sont appelées uniquement pendant la résolution
  pure, jamais par `seek` comme strap ou listener;
- les actions statiques et les payloads produits par TweenAction passent par la
  même application de state;
- les trajectoires continues n'introduisent pas de deuxième horloge V2.

## Validation

La tranche est couverte par les tests de pipeline, de compilation des scènes et
du player. Ils vérifient le chaînage, l'invalidation par remplacement, les
frontières `tween:stop`, la résolution de fonctions compilées, la préparation des
paths imbriqués et l'absence d'appel de strap pendant une reconstruction.

## Hors périmètre de cette tranche

- interpolation DOM ou moteur de rendu continu;
- composition additive entre deux TweenAction indépendantes;
- `context.live` et scheduler de frames;
- hooks `onAbort` ou lifecycle applicatif.
