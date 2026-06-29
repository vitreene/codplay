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
  onStart?: (...args: unknown[]) => void
  onSequenceEnd?: (...args: unknown[]) => void
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
- `Scene.straps` déclare les noms des straps scène-niveau : orchestration cross-stories et side-effects globaux.
- les straps story-niveau (portables avec chaque story) sont déclarés dans `StoryDef.straps` et injectés via `PlayerInitInput.storyStraps` — ils ne font pas partie de `Scene.straps`.
- `listen` est obligatoire dans le contrat et peut etre vide (`[]`).
- `tracks` est obligatoire en V1 et peut etre vide (`{}`).
- dans `Scene.listen`, `straps` est facultatif sur chaque regle.
- les straps référencés dans `Scene.listen` sont résolus exclusivement depuis `strapCollection` (scene-straps) ; `storyStraps` n'est pas consulté.
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
- une resolution plus fine des conflits d'actions au meme tick releve d'une policy modulaire de rendu, pas d'une obligation fixe du coeur Scene.

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

5. Ecoute et effects

- `scene.listen` a vocation a recueillir des events produisant des `effects`.
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
- le runtime peut conserver pour chaque story l'ordre des persos portant `move: '@root'` afin de monter l'instance dans son `story host` (`v1-perso-spec.md` 4bis, remplace l'ancien `Story.entries`, retire).
- `story.initial.move` peut positionner le `story host` de l'instance dans un outlet autorise.
- si un event est emis avant qu'une story, un perso ou un placement ne soit pret pour le traitement attendu, cet event peut etre perdu.
- les elements peuvent entrer dans le DOM ou en sortir pendant la sequence.
- la sortie du DOM n'implique pas la suppression runtime de l'element.
- les elements ne sont pas purges avant l'arret definitif de la scene.
- `seek` et `rewind` s'appuient sur ce registre runtime persistant.

7. Bootstrap scene

- apres chargement et preload, la `Scene` execute une phase de bootstrap avant la diffusion visuelle normale.
- cette phase initialise le runtime global de scene avant le premier event visible de sequence.
- le bootstrap peut preparer les placements autorises par `rootStories` sans introduire de demarrage temporel implicite.
- en implementation, il est attendu que le montage structurel des persos et la mise en timeline de leurs `eventimes` restent deux operations distinctes.
- le demarrage logique de sequence passe ensuite par les events et leur resolution dans `Scene.listen`.

8. Lifecycle scene

- `Scene` peut emettre des events systeme lifecycle:
  - `scene:start`
  - `scene:ready`
  - `scene:end`
- ces noms lifecycle sont reserves par convention pour les events systeme Scene.
- les events de sequence suivent les conventions de nommage deja etablies et ne sont jamais listes en dur dans cette spec.

9. Fin de sequence et fin de scene auteur

- `scene:end` est un event auteur explicite.
- `scene:end` exprime une fin metier et n'implique pas necessairement l'arret des events restants.
- une scene peut donc emettre `scene:end` puis continuer avec des stories de fin, des attentes d'interaction ou d'autres events techniques.
- la fin technique de la sequence jouee est un signal distinct, note ici `sequence:end`.
- `sequence:end` reste un nom d'event conventionnel et configurable.
- `sequence:end` est une convention d'event runtime terminale.
- `sequence:end` ne s'active effectivement qu'en mode `play`.
- en `seek`, si la borne `sequence:end` est franchie, elle n'est pas jouee; elle borne seulement la projection du replay.
- a `sequence:end`, le runtime applique un cleanup implicite des actions en cours qui ne doivent pas survivre a la fin technique de lecture.
- ce cleanup implicite concerne notamment l'arret des medias encore actifs.
- `Scene.onSequenceEnd(scene, options)` permet a l'application hote d'attacher une logique sur cette fin technique.
- `onSequenceEnd` est execute apres le cleanup implicite du runtime.
- `onSequenceEnd` ne sert pas a monter ou scheduler une story de fin de cette meme sequence; cette logique releve d'un event auteur comme `scene:end`.

10. Temps

- `tracks` porte le registre scene-level de reference des tracks runtime.
- ce registre est construit une seule fois a `scene.init`.
- apres `scene.init`, la structure des tracks est figee.
- aucun track ne peut etre ajoute ou supprime pendant la lecture.
- `tracks` porte l'orchestration scene-level (activation, registre, timing global), pas la definition metier portable des eventimes d'une story.
- les eventimes portables d'une story restent dans `Story.eventimes`.
- le montage d'une story cree une story instance avec un `story host` unique.
- ce `story host` est la cible de reference de l'alias configurable `rootToken` pour cette instance.
- la scene fixe l'ancrage temporel de depart d'une story via la resolution runtime de ses events et le mecanisme existant d'offsets relatifs.
- cet ancrage temporel est distinct du simple montage des persos de la story dans le runtime.
- un track unique par defaut `global` existe toujours.
- par defaut, chaque story dispose aussi d'un track portant exactement `story.id`.
- `story.trackId`, s'il existe, ajoute une track principale explicite mais ne remplace jamais la track `story.id`.
- a `scene.init`, le registre est aussi complete par les tracks dediees aux straps declares dans `Scene.listen` et `Story.listen`.
- granularite V1: une seule track dediee par nom de strap et par story; pour `Scene.listen`, la granularite equivalente est une track par nom de strap et par scene.
- si aucune indication de track n'est donnee pour un event de story, l'event utilise par defaut le track `story.id` de cette story.
- si aucune indication exploitable n'est disponible hors story, l'event utilise le track `global`.
- les stories peuvent declarer statiquement les tracks qu'elles comptent utiliser.
- ces declarations story-level sont consolidees a `scene.init` dans `Scene.tracks`.
- si deux stories declarent le meme nom de track, un seul track est cree et il est partage.
- du point de vue auteur, la seule metadata normative d'un track est `active`.
- les autres informations comme l'ordre runtime ou la source runtime relevent des ressources internes du moteur.
- plusieurs events peuvent exister sur un meme track au meme instant.
- a temps egal sur un meme track, ils s'executent selon leur ordre d'insertion.
- `story.trackId` peut designer explicitement la track principale de la story.
- `track.role` est un type de track extensible.
- `track.role: "master"` indique qu'une track participe au calcul de duree / progress en V1.
- plusieurs tracks `role: "master"` peuvent cohabiter.
- l'unicite d'un media `master` actif reste distincte de la multiplicite des tracks `role: "master"`.

12. Horizon

- les bornes de progress, de seek et de segment sont formalisees par `horizon`.
- `progressEndMs` et `seekEndMs` ne sont pas necessairement egaux.
- la logique complete de `seek` est decrite dans `v1-seek-spec.md`.
- reference horizon: `v1-horizon-spec.md`.
- le replay `seek` ne doit pas desactiver artificiellement un media pour forcer son rechargement; il preserve la logique de repositionnement et de synchronisation runtime deja materialisee.

11. Scope V1

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
