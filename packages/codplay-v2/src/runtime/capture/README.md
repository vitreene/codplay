# Capture runtime

> Statut : Fini
> Version CodPlay : V2 foundation

Cette API porte le cycle source-agnostique d’une capture continue :
`beginCapture()` ouvre une session, `trackCapture()` transmet les samples et
`endCapture()` ou `cancelCapture()` la clôture. Le runtime ne connaît ni
l’événement natif qui produit le sample, ni le materializer final.

`captureState` appartient à la session et n’entre jamais dans le journal.
`trackCommand` peut aussi retourner :

- une `CaptureAction`, qui sélectionne une action déjà compilée par
  `actionName` et est appliquée par le chemin composant habituel ;
- un `updateState`, fusionné immédiatement dans le scope lu par la capture.
  Cette mise à jour est live uniquement : elle n’est ni journalisée ni
  rejouée au seek.

Les sorties de fin restent deux mécanismes distincts :

- `endEmit` est un événement normal. Sa donnée contient toujours
  `captureState`, y compris lorsqu’une donnée explicite est fournie ; sa
  politique d’insertion normale est `apply-now` par défaut.
- les événements retournés par `endCapture` sont `persist-only` par leur
  positionnement, quel que soit le `mode` écrit par l’auteur. Ils sont ajoutés
  au journal mais ne sont pas visibles par la tête de lecture au moment de la
  fermeture. Une reconstruction ou un seek ultérieur peut les prendre en
  compte.

La durée des sorties `endCapture` est résolue par le runtime : `default` vaut
200 ms, `capture` mesure la session, et `value` reprend la durée de l’auteur.
Une session ouverte et fermée dans le même tick reçoit une durée effective de
`1 ms`, car le moteur de transitions n’accepte pas une durée nulle.
Les événements sont ancrés à `now - durée`; les transitions de style qui n’ont
pas de durée explicite la reçoivent automatiquement pour les modes `default`
et `capture`.

Un warning auteur est produit uniquement lorsqu’aucune sortie persistante
(`endCapture` ou événement `endEmit` explicitement `persist-only`) n’est
produite. C’est un diagnostic de relecture, pas un rejet de capture.

Le seek annule une session encore active sans détruire les composants déjà
créés. Ceux-ci restent persistants jusqu’au teardown final du player.

La source HTML et la telco de validation sont traitées dans le plan séparé
[`capture-s5-validation-plan.md`](../../../plan/capture-s5-validation-plan.md) ;
elles n’ajoutent aucune sémantique au core.
