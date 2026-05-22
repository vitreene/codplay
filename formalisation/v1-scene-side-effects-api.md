# Scene effects V1 - modele unifie avec Strap

## Statut

Spec normative V1 pour la gestion des `effects` au niveau `Scene`, sans API parallele.

## Objectif

Centraliser les sorties externes globales (ex: persistence, notification metier) en reutilisant exactement le modele `Strap` deja defini.

## Principe

- une story peut produire un `effect`
- la scene l'intercepte via `listen`
- la scene declenche un `effect` via un `Strap` (meme signature de base, meme cycle)
- un `effect` peut renvoyer un ou plusieurs events de retour (succes/echec, etc.)

Conclusion V1:

- aucun systeme parallele a `Strap` n'est introduit
- les `effects` scene sont des `Strap` utilises au niveau scene

## Contrat canonique

```ts
type SceneEvent = StoryEvent

type SceneEffectFn = StrapFn

type SceneEffectInput = StrapInput & {
  perso?: Record<string, unknown>
  sceneState?: Record<string, unknown>
}

type SceneEffectOutput = StrapOutput

type SceneEffectBinding = {
  name: string
}
```

## Regles V1

- les `effects` scene suivent le meme modele fonctionnel qu'un `Strap`.
- un `effect` est adresse par `name` dans le registre `Strap` existant.
- les `effects` sont asynchrones par defaut.
- les fonctions appelees par un `effect` peuvent recevoir le `perso`, le `state` local, le `context` et l'etat global de scene.
- les events retournes par un `effect` sont reinjectes dans le pipeline `Scene`.
- en erreur `effect`, le runtime applique la policy (defaut V1: continue avec warning).
- les executions et retours `effects` sont traces.
- `seek` ne rejoue jamais les `effects`.
- le bootstrap scene et les demarrages de sequence ne creent pas de systeme parallele: ils restent resolus par `Scene.listen`, straps scene-level et events ordinaires.

## Notes

- l'enregistrement et la resolution des `effects` passent par le mecanisme `Strap` deja en place.
- les garanties transactionnelles avancees sont hors perimetre initial.
