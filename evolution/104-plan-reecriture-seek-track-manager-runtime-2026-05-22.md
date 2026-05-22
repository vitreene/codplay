# Plan de reecriture - seek, track-manager, runtime

## Statut

Plan de reecriture cible de la feature `seek` et des parties runtime directement impliquees.

## Decisions verrouillees

- `TrackManager` est le journal temporel canonique des events necessaires a la conduite de la sequence.
- `seek` ne fait qu'une relecture de ce journal.
- la frontiere de lecture et le `role` des tracks pilotent les bornes de duree et de seek.
- l'activation / desactivation de track reste une operation auteur explicite de permutation de scene.
- le runtime ne cree pas de track a la volee pour compenser sa propre logique.
- le runtime ne desactive jamais automatiquement des tracks pour annuler ses propres emissions.
- `role` est un type de track string extensible ; la seule valeur normative V1 pour les bornes master est `role: "master"`.
- `story.trackId` peut designer une track principale explicite, mais ne supprime pas la track `story.id` de la story.
- `un strap = une track`.
- granularite retenue : une seule track par nom de strap et par story.
- les tracks de strap sont creees statiquement a `scene.init`.
- une sortie rejouable de strap ecrit sur la track du strap, pas sur la track source de la story.
- un strap ne contribue aux bornes master que si sa track de strap est explicitement declaree `role: "master"`.
- les events ecrits dans une track sont faits pour etre lus ; ils ne doivent pas etre neutralises par une mecanique interne de desactivation.

## Contraintes media a preserver

- la reecriture de `seek` doit conserver la separation deja etablie entre l'etat interne des medias et l'etat global de lecture du player.
- le replay `seek` ne doit pas desactiver un media pour le forcer a se recharger.
- le repositionnement media existant doit etre preserve.
- si un vrai `reload` media devient necessaire plus tard, il devra etre explicite et non un effet de bord du replay.

## Perimetre exact

- `src/track-manager/create-track-manager.ts`
- `src/track-manager/track-manager-validation.ts`
- `src/track-manager/types.ts`
- `src/player/create-player.ts`
- `src/player/player.ts`
- un module isole pour la feature, par exemple `src/player/seek-runtime.ts`

Le reste du runtime ne doit etre touche que si un raccord strictement necessaire l'impose.

## Objectif de la reecriture

- rendre le registre de tracks conforme aux specs V1.
- rendre la materialisation des sorties de strap simple et deterministe.
- isoler proprement la logique `seek` et `horizon`.
- supprimer les sur-optimisations qui ont deforme le modele.
- preserver le comportement deja valide des medias.

## Architecture cible

### 1. TrackManager

- charge un registre fige a `scene.init`.
- contient :
- `global`
- tracks de story
- tracks explicites de scene / story
- tracks dediees de straps
- gere seulement :
- append-only
- activation / desactivation explicite
- curseurs
- collecte ordonnee
- plus aucune creation ni suppression de track apres `scene.init`.

### 2. Materialisation runtime

- toutes les sorties rejouables (`events`, `update`) sont ecrites dans une track connue du registre.
- un strap ecrit dans sa track dediee.
- les sorties de strap ne doivent plus heriter implicitement d'une track `master` depuis la story source.
- apres materialisation, l'origine de production de l'event n'a plus d'importance pour `seek` ; seule comptent la track et son `role`.

### 3. Module `seek-runtime`

- calcul des horizons canoniques.
- application de la `seekPolicy`.
- selection des events a relire.
- borne `sequence:end`.
- aucune execution de strap.
- aucun `effect`.

### 4. `create-player.ts`

- garde l'orchestration : `init`, `play`, `pause`, `seek`, replay, sync renderer / media.
- ne garde plus la logique dispersee d'horizon ni les contournements locaux de tracks.

## Regles cibles

- `global` existe toujours.
- chaque story possede toujours une track `story.id`.
- si `story.trackId` existe, il s'ajoute au registre ; il ne remplace pas `story.id`.
- les tracks declarees par `Scene.tracks` et `Story.tracks` sont consolidees a `scene.init`.
- les tracks de strap sont ajoutees a cette consolidation a `scene.init`.
- apres `scene.init`, aucune creation / suppression de track.
- `track:activate`, `track:deactivate`, `track:toggle` restent les seuls leviers runtime de permutation de tracks.
- `seek` relit seulement les entries deja presentes dans le journal du `TrackManager`.
- `projectedMasterEndMs` et `progressEndMs` lisent uniquement les tracks `role: "master"`.
- `authorEndMs` lit toutes les occurrences materialisees deterministes.
- `seekEndMs` est calcule en dernier par la `seekPolicy`.
- `sequence:end` borne le replay sans etre execute en tant qu'event normal.

## Etapes de reecriture

### 1. Verrouiller les tests de verite metier

- ecrire ou reecrire les tests qui expriment directement les specs.
- figer les comportements attendus avant refactor lourd.

### 2. Reecrire le TrackManager

- revenir a un registre de tracks strictement fige a `scene.init`.
- supprimer le besoin de `ensureTrack()` pendant la lecture pour cette feature.
- fournir un reset clair pour la relecture : curseurs et etat `active` runtime remis a l'etat initial.
- garder `collectDueEvents()` simple, stable et deterministe.

### 3. Construire statiquement les tracks de strap a l'init

- identifier toutes les paires `story + strap` declarees dans les regles `listen`.
- creer une seule track dediee par nom de strap et par story.
- consolider ces tracks dans le registre charge par le `TrackManager`.

### 4. Reecrire la materialisation des sorties de strap

- faire ecrire toutes les sorties rejouables d'un strap sur sa track dediee.
- retirer les helper tracks dynamiques.
- retirer la logique de desactivation interne de tracks pour neutraliser des emissions futures.

### 5. Extraire `seek` et `horizon` dans `seek-runtime.ts`

- calculer un snapshot d'horizon canonique a partir du journal de tracks.
- appliquer la policy uniquement pour produire `seekEndMs`.
- selectionner les events rejouables jusqu'a la cible bornee.
- gerer `sequence:end` comme borne et non comme event rejoue.

### 6. Rebrancher `create-player.ts`

- brancher les commandes runtime sur le nouveau module isole.
- preserver la sync renderer / media sans reset parasite.
- supprimer les branches devenues illegitimes ou redondantes.

### 7. Nettoyer l'ancien code

- supprimer la creation runtime de tracks helper.
- supprimer les mecanismes d'annulation interne par desactivation de track.
- supprimer les garde-fous locaux qui compensaient une mauvaise structure.

## Tests a verrouiller

- une track de strap existe a `scene.init` pour chaque couple `story + strap` declare.
- une seule track par nom de strap et par story, meme si le strap est invoque plusieurs fois.
- un strap non-master n'etend pas `projectedMasterEndMs`.
- un strap explicitement `role: "master"` etend `projectedMasterEndMs`.
- une story `master` et ses straps non-master restent separes.
- `progressEndMs` n'est pas pollue par les tracks non-master.
- `authorEndMs` inclut les occurrences materialisees non-master.
- `seekEndMs` suit strictement la policy.
- `seek` ne rejoue ni straps ni `effects`.
- `track:activate` / `track:deactivate` continuent a servir les permutations auteur comme le changement de langue.
- les medias restent synchronises apres `seek`.
- le replay `seek` ne force pas un unload / reload media implicite.
- aucune creation de track apres `scene.init`.

## Mises a jour de spec probables

- expliciter `un strap = une track dediee`.
- expliciter la granularite `une track par nom de strap et par story`.
- expliciter que `role` est un type de track extensible.
- expliciter que les sorties rejouables de strap sont materialisees sur la track du strap.
- rappeler que les medias ne doivent pas etre desactives artificiellement au replay.

## Ce que la reecriture ne doit pas faire

- ne pas introduire de modele dynamique de creation de tracks.
- ne pas reintroduire une mecanique d'annulation interne par desactivation automatique de tracks.
- ne pas inventer une nouvelle taxonomie d'events.
- ne pas refondre largement le runtime hors feature.
