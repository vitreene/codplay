# Runtime config mapping V1

## Statut

Reference V1 minimale pour le mapping de la configuration d'execution vers le Player runtime.

Le terme principal est `runtimeConfig`.

## But

Traduire une configuration fournie par l'hote en configuration effective du Player:

- sans hardcode
- avec priorites explicites
- avec comportement deterministe

## Entree

Objet d'entree:

- `runtimeConfig`

Champs V1 minimaux:

- `preset?`: `author | user`
- `replayMode?`: `refaire | revoir`
- `locale?`: string
- `sessionKind?`: `live | replay`
- `inputProfile?`: `web | mobile | kiosk`
- `seed?`: string | number
- `policies?`: objet libre versionne

## Sortie

Objet cible:

- `effectiveRuntimeConfig`

Le resultat est applique au Player (`Director`, `Renderer`, `Timer`, `Ticker`) via `load(...)`.

## Couches de priorite

Le mapping applique l'ordre suivant:

1. defaults framework
2. preset environnement (`author` / `user`)
3. config projet/scene
4. patch runtime (fourni par l'hote)

Regle:

- la couche suivante surcharge la precedente sur les memes cles

## Regles de mapping V1

### Regles generales

- meme entree + memes couches => meme resultat
- aucune decision critique en dur
- cles inconnues: ignorees par defaut

### Regles champs connus

- valeur valide: conservee
- valeur absente: fallback selon couche inferieure
- valeur invalide: warning + fallback

### Replay

- `replayMode` par defaut: `refaire`
- `replayMode=revoir` active les contraintes V1:
  - straps generateurs desactives
  - side-effects externes bloques

## Mapping vers composants

### Director

- mode replay
- policy erreurs auteur/runtime
- budgets de cycle (ex: guard max events)

### Renderer

- policy de traitement d'erreur commit
- niveau de verbosite trace

### Timer/Ticker

- parametres de cadence runtime
- options de pause/reprise selon contexte

## Warnings minimaux

- `W_RUNTIME_CONFIG_FIELD_UNKNOWN`
- `W_RUNTIME_CONFIG_VALUE_INVALID`
- `W_RUNTIME_CONFIG_DEFAULT_APPLIED`

Payload recommande:

- `field`
- `value`
- `fallback`
- `layer`

## Invariants V1

- `runtimeConfig` n'est pas persiste dans `SceneDoc`
- `runtimeConfig` ne remplace pas la scene compilee
- seul `effectiveRuntimeConfig` pilote l'execution
- les presets `author`/`user` sont des configurations, pas du code conditionnel hardcode

## Exemple minimal

Entree:

```ts
{
  preset: 'author',
  replayMode: 'revoir',
  locale: 'fr-FR',
  unknownKey: true
}
```

Sortie (exemple):

```ts
{
  preset: 'author',
  replayMode: 'revoir',
  locale: 'fr-FR',
  policies: {
    ...
  }
}
```

`unknownKey` est ignoree avec warning en mode adapte.

## Hors perimetre V1

- transformations conditionnelles complexes par type de scene
- enrichissement externe via appels reseau
- schema complet des policies internes
