# RuntimeContext mapping V1

## Statut

Version de reference V1 pour le passage du contexte runtime vers les parametres scene.

## 1) Idee simple

Le contexte runtime vient de l'environnement (host/player).
La scene ne lit pas ce contexte directement.
Le player fait une traduction simple et explicite vers `scene.params.runtime`.

## 2) Entree

Objet d'entree:

- `RuntimeContext`

Champs V1:

- `replayMode`: `refaire | revoir`
- `locale?`
- `sessionKind?`: `live | replay`
- `inputProfile?`: `web | mobile | kiosk`
- `seed?`

## 3) Sortie

Le player produit `initialSceneParams` avec ce bloc minimum:

- `scene.params.runtime.replayMode`
- `scene.params.runtime.locale`
- `scene.params.runtime.sessionKind`
- `scene.params.runtime.inputProfile`
- `scene.params.runtime.seed`

## 4) Table de mapping V1

- `RuntimeContext.replayMode` -> `scene.params.runtime.replayMode`
- `RuntimeContext.locale` -> `scene.params.runtime.locale`
- `RuntimeContext.sessionKind` -> `scene.params.runtime.sessionKind`
- `RuntimeContext.inputProfile` -> `scene.params.runtime.inputProfile`
- `RuntimeContext.seed` -> `scene.params.runtime.seed`

## 5) Regles de lecture

- champ absent:
  - valeur par defaut si definie (`replayMode=refaire`)
- champ inconnu:
  - ignore
  - warning seulement en mode debug
- champ connu mais invalide:
  - warning
  - fallback sur valeur par defaut si possible

## 6) Sequence d'application

Au `load(...)`:

1. lire `RuntimeContext`
2. construire `initialSceneParams`
3. publier `scene:param:set` avant `scene:start`

Pendant la scene:

- modifications runtime -> `scene:param:patch`
- ordre des patchs conserve

## 7) Warnings minimum

- `W_RUNTIME_CONTEXT_FIELD_UNKNOWN`
- `W_RUNTIME_CONTEXT_VALUE_INVALID`
- `W_RUNTIME_CONTEXT_DEFAULT_APPLIED`

Payload minimum recommande:

- `field`
- `value`
- `fallback`

## 8) Invariants V1

- `RuntimeContext` n'est pas stocke dans `SceneDoc`
- `RuntimeContext` n'est pas persiste dans `CompiledScene`
- seul le resultat mappe (`scene.params.runtime`) est applique a la scene
- meme `RuntimeContext` + meme scene = meme resultat de mapping

## 9) Exemple simple

Entree:

- `RuntimeContext = { replayMode: "revoir", locale: "fr-FR", foo: 1 }`

Sortie:

- `scene.params.runtime.replayMode = "revoir"`
- `scene.params.runtime.locale = "fr-FR"`
- `foo` ignore

## 10) Hors perimetre V1

- mapping conditionnel par type de scene
- transformations complexes de valeur
- enrichissement par appels reseau
