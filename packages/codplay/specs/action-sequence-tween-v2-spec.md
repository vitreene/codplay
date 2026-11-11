# CodPlay V2 — actions de perso, ActionSequence et TweenAction

> Version de référence : CodPlay V2 — 2026-11-11.

## Périmètre certifié

Cette spécification décrit les formes d'actions de perso, leur résolution
logique, les séquences d'actions et les `TweenAction`. Le rendu propre à un composant
relève de sa spécification de présentation.

Les actions sont reconstruites par le circuit commun du player :

```text
CompiledScene + journal + position temporelle
    -> materialize
    -> resolve
    -> état logique résolu
```

La [spécification de scène](./scene-authoring-spec.md) décrit la compilation et
le transfert des fonctions ; la présente spécification porte sur leur
interprétation logique.

## Comportements vérifiés

### Profil du composant et destinataires

Le `type` du perso désigne la définition enregistrée de son composant. Les
profils `initial` et `action`, les validateurs et les normalisateurs de cette
définition portent les données auteur ; `update()` projette ensuite l'état
résolu, selon la [spécification des composants](./component-materialization-v2-spec.md).
Une action n'est pas un appel de méthode du composant.

La clé d'action est confrontée au nom de l'occurrence, dans la portée de sa
track. Plusieurs persos peuvent déclarer la même clé. Dans le circuit live,
l'index compilé associe le nom aux persos destinataires, indépendamment du perso
qui porte la source. La sélection n'est pas un sélecteur DOM ; `move.target`
et `initial.rel` conservent leurs responsabilités de placement et de liaison
native.

### Patches et données d'occurrence

Le [résolveur de définition](../src/runtime/player/pipeline/action-resolution.ts)
accepte un objet de patch, `true`, `null` ou une séquence. Pour un objet,
`data` surcharge l'objet auteur au premier niveau. Une propriété `data.style`
remplace donc le groupe `style` auteur de cette occurrence, avant l'application
des règles de patch à l'état résolu ; cette surcharge n'est pas une fusion
profonde des deux déclarations.

`true` et `null` utilisent `data` comme patch complet et ne contribuent aucun
patch sans données. `null` ne désigne ni reset ni suppression. L'entrée
`actions[perso.id] = null` réservée par la normalisation suit ce même circuit.
Les séquences conservent les données déclarées dans leurs pas sans appliquer
cette surcharge à partir de `data`.

### Séquence d'actions

Une valeur d'action peut contenir une séquence de `{ action, durationMs? }`.
Dans le cas testé, la durée explicite du premier pas place le pas statique
suivant à la fin de cette durée. Le player reconstruit l'état au franchissement
de cette frontière interne.

Une occurrence ultérieure de la même clé d'action invalide les pas de séquence
précédents qui n'ont pas encore commencé. Les pas précédents déjà actifs restent
dans la reconstruction.

### TweenAction

La forme compilée exercée est `{ duration, fn: { ref } }`. Pour une durée de
100 ms sans `ease`, le résolveur appelle la fonction de la collection de build
avec une progression temporelle bornée : à 50 ms écoulées, la progression vaut
`0.5`, puis elle vaut `1` à l'échéance. Le payload retourné est appliqué à
l'état par le même résolveur d'action que les autres actions.

Le document auteur contient `{ duration, ease?, fn: fonction }`, non une
fonction seule ; la compilation extrait la fonction. Son argument complet est
`{ progress, data }`. `progress` est le ratio temporel borné, après application
de l'easing ; `data` est l'objet d'action complet après surcharge par les
données d'occurrence, avec sa durée et sa référence compilée de fonction.
La fonction retourne un patch de composant ou `undefined`. Le runtime ne lui
fournit pas séparément le nœud, l'état courant ou la session de capture.

Une référence de fonction absente de la collection provoque une erreur explicite.
Le test player confirme que la reconstruction par Seek et celle de Play
produisent le même état logique pour cette forme de `TweenAction`.

### Arrêt direct

Dans le cas vérifié, un événement `tween:stop` retire de la reconstruction une
`TweenAction` directe déjà commencée à partir de la frontière d'arrêt. Le test
ne certifie pas l'arrêt d'une `TweenAction` contenue dans une séquence.

## Preuves

- [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts) vérifie le
  chaînage par durée explicite, le remplacement des pas différés, le progrès et
  le remplacement d'une `TweenAction` directe, ainsi que `tween:stop` direct.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  vérifie la même résolution logique en Seek et Play et le franchissement d'une
  frontière interne de séquence.
- [`chrono-demo.spec.ts`](../tests/facade/chrono-demo.spec.ts) exerce l'arrêt
  d'une `TweenAction` via la façade et l'émission DOM de la fixture chrono.

## Limite de certification

La forme `startAt`, la durée implicite d'un `TweenAction` dans une séquence,
`durationMs` qui remplace cette durée implicite, l'arrêt d'un pas séquencé et
les sorties invalides ou les exceptions de fonction ne sont pas couverts par
ces preuves et sont exclus du périmètre certifié de ce document.
