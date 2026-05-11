# Scene spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Scene` dans Codplay.

## Objectif

Definir la racine d'orchestration globale de la sequence, sans exposer ni coupler l'organisation interne des stories composees.

## Contrat canonique

```ts
type ListenEmit = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

type ListenTransform = {
  name: string
  options?: Record<string, unknown>
}

type ListenRuntimeInput = {
  event: ListenEmit
  state: Record<string, unknown> | undefined
  meta: Record<string, unknown>
  context: Record<string, unknown>
}

type ListenRule = {
  on: string
  transform?: ListenTransform[]
  emit?: ListenEmit[]
  straps?: string[]
}

type SceneDef = {
  id: string
  stories: Record<string, StoryDef>
  rootStories: string[]
  initial: Record<string, unknown> | undefined
  straps: string[] | undefined
  listen: ListenRule[]
  state?: Record<string, unknown> | undefined
  init: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
  tracks: Record<string, unknown>
}
```

## Regles normatives

1. Structure globale

- `Scene` est la racine globale de la sequence.
- `Scene` declare les stories disponibles dans `stories`.
- `Scene` pilote les stories montees a la racine de la scene via `rootStories`.
- `rootStories` est obligatoire et non vide.
- l'organisation interne des stories composees est portee par chaque `Story` (champ `children`).
- `Scene` expose une forme globale equivalente a une `Story`: `initial`, `straps`, `listen`, `init`, `state`.
- `initial` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `straps` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `listen` est obligatoire dans le contrat, et peut etre vide (`[]`).
- dans `Scene.listen`, `straps` est facultatif sur chaque regle.
- les regles `listen` de `Scene` sont des filtres.
- dans `Scene`, `listen.on` doit etre unique par nom d'event.
- doublon de `listen.on` dans `Scene`: erreur auteur.
- `transform` est facultatif et peut contenir plusieurs etapes.
- les etapes `transform` sont executees dans l'ordre de declaration.
- `transform` consomme le meme `ListenRuntimeInput` que les `straps` de la regle.
- `transform` ne renvoie que de la `data` (pas d'event).
- `listen=[]` n'applique aucun filtrage: les events entrants sont redistribues tels quels.
- quand `listen` contient des regles, seuls les events correspondants sont redistribues.
- pour une regle `listen`, l'ordre est: `transform` puis `straps` puis `emit`.
- `transform` et `straps` partagent la meme entree runtime; seule la sortie differe.
- dans `straps`, les noms sont executes dans l'ordre de declaration (gauche -> droite).
- en cas d'erreur strap, le mode par defaut V1 continue la chaine avec warning.
- ce comportement reste pilotable par policy runtime.
- en cas de collision de noms d'events au meme tick (sorties strap + `emit`), l'arbitrage suit `sameTickHandling` de la policy runtime.

Note de contexte:

- ces contraintes s'appliquent au mode diffusion (`CompiledScene` valide).
- en mode auteur, une scene en cours d'edition peut etre incompletement renseignee avant compilation.

2. Identite et unicite

- `scene.id` est unique dans le contexte de lecture.
- `storyId` est unique globalement dans `scene.stories`.
- une story enfant appartient a un seul parent.

3. Stories racine

- `rootStories` designe les stories montees a la racine de la scene.
- `rootStories` est une structure de montage scene-level, pas un declencheur temporel implicite.
- chaque story referencee dans `rootStories` doit exister dans `stories`.
- `rootStories` n'impose ni visibilite immediate, ni demarrage automatique.

4. Hierarchie

- `Scene` ne declare pas les relations internes parent/enfant hors premier niveau.
- la relation parent/enfant est resolue depuis `Story.children`.
- une story enfant ne reference jamais son parent dans son contrat auteur.
- le parent d'une story est derive depuis les references `children` de son parent.
- chaque enfant reference dans `children` doit exister dans `scene.stories`.
- une story referencee comme enfant par plusieurs parents produit un warning auteur.
- en cas de conflit multi-parents, le premier parent declare gagne.

5. Propagation inter-stories

- un event local emis par une story enfant remonte automatiquement vers son parent.
- le parent peut intercepter, transformer et republier cet event.
- `cascade: true` impose une remontee jusqu'a `Scene` sans interception intermediaire.
- aucun event n'est adresse a une story cible par identifiant.

6. Initialisation et state

- `Scene.initial` porte les parametres statiques par defaut de la sequence.
- `Scene.init(input)` construit le `state` runtime initial de scene.
- `Scene.init` accepte `undefined` en V1.
- `Scene.init(undefined)` signifie qu'aucun parametre externe n'est requis pour initialiser la scene.
- `Scene.init` est la fonction d'initialisation, peut recevoir un `input`, et peut definir un `state` runtime.
- `Scene.state` est runtime-only.
- `Scene.state` peut rester `undefined` s'il n'est pas utilise.

7. Bootstrap scene

- apres chargement et preload, la `Scene` execute une phase de bootstrap avant la diffusion visuelle normale.
- cette phase peut monter certaines `rootStories` avant le premier event visible de sequence.
- le bootstrap peut etre pilote par un strap d'entree de scene.
- les operations de montage sont techniques runtime et ne creent pas a elles seules d'ancrage temporel.
- le demarrage logique de sequence passe ensuite par les events et leur resolution dans `Scene.listen`.

8. Lifecycle scene

- `Scene` peut emettre des events systeme lifecycle:
  - `scene:start`
  - `scene:ready`
  - `scene:end`
- ces noms lifecycle sont reserves par convention pour les events systeme Scene.
- les events de sequence suivent les conventions de nommage deja etablies et ne sont jamais listes en dur dans cette spec.

9. Temps

- `tracks` porte la structure temporelle globale consommee par le runtime.
- `tracks` est obligatoire en V1.
- `tracks` peut etre vide par defaut (`{}`) si la scene est pilotee principalement par events.
- `tracks` porte l'orchestration scene-level (activation, ordre, timing global), pas la definition metier portable des eventimes d'une story.
- les eventimes portables d'une story restent dans `Story.eventimes`.
- la scene fixe l'ancrage temporel de depart d'une story via la resolution runtime de ses events et le mecanisme existant d'offsets relatifs.

10. Scope V1

- `scenario` est hors perimetre de definition V1 et reste non specifie a ce stade.
- le conteneur de rendu (mount target DOM) est hors `Scene` et fourni a l'instanciation du Player.

## CompiledScene cible V1

Sortie Builder canonique:

```ts
type CompiledScene = {
  schemaVersion: string
  createdAt: string
  scene: SceneDef
  resources: ResourceManifest
}
```

Contraintes:

- `CompiledScene` est immuable en runtime.
- les validations d'integrite de hierarchie sont resolues au build.

## Invariants Scene V1

Reference transversale: `v1-invariants.md`.

- `Scene` orchestre le global; `Story` orchestre le local.
- `rootStories` est l'autorite scene-level sur le montage des stories a la racine de la scene.
- aucun couplage nominatif inter-stories par adressage direct.
