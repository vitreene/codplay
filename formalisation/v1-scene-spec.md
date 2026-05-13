# Scene spec V1 - contrat normalise

## Statut

Spec normative V1 pour le contrat `Scene` dans Codplay.

## Objectif

Definir la racine d'orchestration globale de la sequence, sans imposer de hierarchie structurelle entre stories et sans reduire le runtime aux seuls elements visibles dans le DOM.

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
- `Scene` expose `initial`, `straps`, `listen`, `init`, `state`, `tracks`.
- `initial` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `straps` est obligatoire dans le contrat et peut valoir `undefined` par defaut.
- `listen` est obligatoire dans le contrat et peut etre vide (`[]`).
- `tracks` est obligatoire en V1 et peut etre vide (`{}`).
- dans `Scene.listen`, `straps` est facultatif sur chaque regle.
- les regles `listen` de `Scene` sont des filtres.
- dans `Scene`, `listen.on` doit etre unique par nom d'event.
- doublon de `listen.on` dans `Scene`: erreur auteur.
- `transform` est facultatif et peut contenir plusieurs etapes.
- les etapes `transform` sont executees dans l'ordre de declaration.
- `transform` consomme le meme `ListenRuntimeInput` que les `straps` de la regle.
- `transform` ne renvoie que de la `data`.
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
- `Scene` ne redefinit jamais silencieusement l'identite d'une story ou d'un element.

3. Stories racine

- `rootStories` designe les stories autorisees a etre placees a la racine de la scene.
- `rootStories` est obligatoire et non vide.
- chaque story referencee dans `rootStories` doit exister dans `stories`.
- `rootStories` est une structure d'autorisation scene-level, pas un declencheur temporel implicite.
- `rootStories` n'impose ni visibilite immediate, ni montage implicite, ni demarrage automatique.

4. Stories independantes

- une story est une unite independante.
- `Scene` ne porte aucune hierarchie structurelle entre stories.
- une story peut etre rendue visuellement dans le perimetre d'une autre sans creer de lien structurel runtime.
- cette relation visuelle passe par les mecanismes existants de `move` appliques aux elements concernes.

5. Ecoute et side-effects

- `scene.listen` a vocation a recueillir des events produisant des side-effects.
- `scene.listen` peut aussi recueillir des events de scene relies a des structures au-dessus de la scene.
- `scene.listen` reste un pipeline d'ecoute, de transformation et de reemission; il n'introduit pas de systeme parallele.
- `scene.listen` ne cible jamais explicitement une story par identifiant.

6. Initialisation et runtime persistant

- `Scene.initial` porte les parametres statiques par defaut de la sequence.
- `Scene.init(input)` construit le `state` runtime initial de scene.
- `Scene.init` accepte `undefined` en V1.
- `Scene.state` est runtime-only.
- `Scene.state` peut rester `undefined` s'il n'est pas utilise.
- a `scene.init`, toutes les stories de la scene sont initialisees.
- une story initialisee peut exister dans le runtime sans etre presente dans le DOM.
- une story initialisee peut recevoir des events meme si elle n'est pas encore visible dans le DOM.
- si un event est emis avant qu'une story, un perso ou un placement ne soit pret pour le traitement attendu, cet event peut etre perdu.
- les elements peuvent entrer dans le DOM ou en sortir pendant la sequence.
- la sortie du DOM n'implique pas la suppression runtime de l'element.
- les elements ne sont pas purges avant l'arret definitif de la scene.
- `seek` et `rewind` s'appuient sur ce registre runtime persistant.

7. Bootstrap scene

- apres chargement et preload, la `Scene` execute une phase de bootstrap avant la diffusion visuelle normale.
- cette phase initialise le runtime global de scene avant le premier event visible de sequence.
- le bootstrap peut preparer les placements autorises par `rootStories` sans introduire de demarrage temporel implicite.
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
- `tracks` porte l'orchestration scene-level (activation, ordre, timing global), pas la definition metier portable des eventimes d'une story.
- les eventimes portables d'une story restent dans `Story.eventimes`.
- la scene fixe l'ancrage temporel de depart d'une story via la resolution runtime de ses events et le mecanisme existant d'offsets relatifs.
- l'organisation des tracks peut etre explicite auteur.
- un comportement par defaut simple peut etre fourni, sans figer le modele conceptuel des tracks.

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
- les validations d'integrite structurelle sont resolues au build quand elles relevent du document auteur.
- les collisions effectives d'identifiants d'elements restent verifiees a `scene.init` avec warning runtime.

## Invariants Scene V1

Reference transversale: `v1-invariants.md`.

- `Scene` orchestre le global; `Story` orchestre le local.
- `rootStories` est l'autorite scene-level sur les stories autorisees a la racine de la scene.
- aucune hierarchie structurelle entre stories n'est portee par `Scene`.
- aucun couplage nominatif inter-stories par adressage direct d'une story cible.
