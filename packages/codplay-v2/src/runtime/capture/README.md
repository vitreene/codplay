# Capture runtime V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

La capture continue permet de transformer une interaction progressive en
actions de scène. Le runtime ouvre une session, reçoit des échantillons puis la
ferme ; il ne dépend pas de l'événement natif qui produit ces échantillons ni
du materializer utilisé pour l'affichage.

## Fonctionnement

```text
beginCapture() -> trackCapture() -> endCapture()
                              \-> cancelCapture()
```

`captureState` appartient à la session et n'entre pas directement dans le
journal. `trackCommand` peut toutefois retourner :

- une `CaptureAction`, qui sélectionne une action déjà compilée par
  `actionName` et la fait passer par le circuit normal du composant ;
- un `updateState`, fusionné immédiatement dans l'état lu par la capture.
  Cette modification est en direct : elle n'est ni journalisée ni rejouée lors
  d'un seek.

## Organisation interne

Les sorties de fin suivent deux circuits :

- `endEmit` est un événement normal et transmet toujours `captureState` ; son
  insertion normale est `apply-now` ;
- les événements retournés par `endCapture` sont ajoutés au journal avec la
  position `persist-only`. Ils ne sont pas visibles par la tête de lecture au
  moment de la fermeture, mais une reconstruction ou un seek ultérieur peut
  les prendre en compte.

La durée des sorties `endCapture` vaut 200 ms pour `default`, la durée réelle
de la session pour `capture`, ou la valeur donnée par l'auteur pour `value`. Une
session ouverte et fermée dans le même tick reçoit 1 ms, car le moteur de
transition n'accepte pas une durée nulle. Les événements sont ancrés à
`now - durée`; une transition de style sans durée explicite reçoit
automatiquement la durée de la capture pour les modes `default` et `capture`.

## Contrat et limites

- un warning est émis seulement si aucune sortie persistante n'est produite ;
- ce warning concerne la relecture et ne rejette pas la capture ;
- un seek annule une session encore ouverte sans détruire les composants ;
- les composants restent persistants jusqu'à la destruction finale du lecteur ;
- les adaptateurs HTML et telco de validation sont documentés dans le plan
  [`capture-s5-validation-plan.md`](../../../plan/capture-s5-validation-plan.md) et
  n'ajoutent pas de sémantique au cœur de la capture.
