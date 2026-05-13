# Builder spec V1 - contrat normalise

## Statut

Spec normative V1 pour le `Builder` dans Codplay.

## Objectif

Definir un Builder capable de produire un artefact compact et stable pour la lecture Player, avec un format de diffusion canonique et une frontiere claire avec le preload runtime.

## Livrable principal V1

- livrable unique: `CompiledScene`
- format canonique: `JSON`
- artefact immuable apres compilation
- artefact versionne (`schemaVersion`) et date (`createdAt`)

## Contrat d'entree/sortie

Entree Builder:

- `SceneDoc` auteur
- options de compilation

Sortie Builder:

- `CompiledScene` (lecture Player)
- `ResourceManifest` (preload runtime)
- diagnostics (`errors`, `warnings`)

## Frontiere Builder

Le Builder:

- normalise la scene auteur
- compile les structures narratives vers un format runtime compact
- prepare la description des persos/stories/listen/straps
- compile `rootStories` et `entries` comme structures de placement runtime
- preserve `Perso.name` et `Perso.id` tels qu'ils existent dans le document auteur normalise
- ne reattribue pas silencieusement les `id` des elements
- prepare les structures temporelles compilees
- produit un manifeste de ressources
- preserve les eventimes portables de story (`Story.eventimes`)
- peut projeter des offsets absolus au build quand le depart story est deterministe

Le Builder ne fait pas:

- execution runtime (`tick`, playback)
- rendu
- chargement effectif des ressources
- arbitrage final des collisions effectives d'`id` d'elements detectees a `scene.init`

## Contrat `CompiledScene`

`CompiledScene` est l'artefact de lecture du Player.

Exigences V1:

- stable a entree identique
- compact (sans donnees runtime volatiles)
- lisible par le Player sans recompilation metier
- serialisable/deserialisable sans perte

Meta obligatoire:

- `schemaVersion`
- `createdAt`

## Exports externes

Le core Builder expose un mecanisme de plugins d'export.

- coeur: produit `CompiledScene`
- plugin export: transforme `CompiledScene` vers une cible (`xml`, autre player, etc.)
- les exports externes ne modifient pas le contrat canonique V1

## Manifest ressources

Le Builder produit un `ResourceManifest` consomme par un module preload dedie.

Contenu minimal V1:

- `url`
- `type` (video, audio, image, font, css)
- `policy` (cache, version, hash, priority)
- `hash` appartient uniquement a la policy ressource (pas a la meta `CompiledScene`)

Exemple de forme:

```ts
type ResourceManifestEntry = {
  url: string
  type: 'video' | 'audio' | 'image' | 'font' | 'css'
  policy: {
    cache: 'default' | 'no-store' | 'immutable'
    version?: string
    hash?: string
    priority?: 'high' | 'normal' | 'low'
  }
}

type ResourceManifest = {
  entries: ResourceManifestEntry[]
}
```

## Preload runtime (module dedie)

Le preload est un module separe du Builder.

Perimetre preload V1:

- preload videos
- preload sons
- preload images
- preload fonts
- chargement/import des classes ou tokens CSS

Le preload consomme `ResourceManifest` et prepare le runtime de lecture.

## Tracks

- le Builder preserve les declarations auteur de tracks fournies au niveau scene et story.
- `CompiledScene.scene.tracks` porte la declaration compilee qui sera consolidee a `scene.init` en registre runtime fige.
- le Builder ne cree pas de tracks dynamiquement pendant la lecture.
- un track `global` est toujours disponible dans le modele cible V1.
- par defaut, chaque story dispose aussi d'un track `story.id`.
- la seule metadata auteur normative d'un track est `active`.

## Mutabilite runtime

`CompiledScene` est immuable en V1.

- pas de mutation CRUD sur l'artefact compile
- toute modification passe par une nouvelle compilation Builder

## Invariants Builder V1

- `CompiledScene` JSON est la source canonique de diffusion
- `schemaVersion + createdAt` sont obligatoires
- le Builder ne charge pas les ressources; il produit leur manifeste
- les exports externes passent par plugins, hors coeur canonique
- l'artefact compile est immuable
- la portabilite des eventimes de story est preservee en sortie compilee
- `rootStories` et `entries` sont valides et explicites en sortie compilee
- `Perso.name` reste auteur-visible; `Perso.id` reste canonique pour le runtime
- aucun mot-cle d'event n'est traite en dur; le Builder preserve les conventions de nommage deja etablies
