# Scene side-effects V1 - modele unifie avec Strap

## Statut

Spec normative V1 pour la gestion des side-effects au niveau `Scene`, sans API parallele.

## Objectif

Centraliser les sorties externes globales (ex: persistence, notification metier) en reutilisant exactement le modele `Strap` deja defini.

## Principe

- une story peut emettre un signal global
- la scene l'intercepte via `listen`
- la scene declenche un side-effect via un `Strap` (meme signature, meme cycle)
- un side-effect peut renvoyer un ou plusieurs events de retour (succes/echec, etc.)

Conclusion V1:

- aucun systeme parallele a `Strap` n'est introduit
- les side-effects scene sont des `Strap` utilises au niveau scene

## Contrat canonique

```ts
type SceneEvent = StoryEvent

type SceneSideEffectFn = StrapFn

type SceneSideEffectInput = StrapInput

type SceneSideEffectOutput = StrapOutput

type SceneSideEffectBinding = {
  name: string
}
```

## Regles V1

- les side-effects scene suivent le meme modele fonctionnel qu'un `Strap`.
- un side-effect est adresse par `name` dans le registre `Strap` existant.
- les side-effects sont asynchrones par defaut (meme contrat `StrapFn`).
- les events retournes par un side-effect sont reinjectes dans le pipeline `Scene`.
- en erreur side-effect, le runtime applique la policy (defaut V1: continue avec warning).
- les executions et retours side-effects sont traces.

## Notes

- l'enregistrement et la resolution des side-effects passent par le mecanisme `Strap` deja en place.
- les garanties transactionnelles avancees sont hors perimetre initial.
