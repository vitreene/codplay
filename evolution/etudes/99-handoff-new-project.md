# Handoff - reprise dans un nouveau projet

Ce document resume les decisions et le contexte a conserver pour reprendre la conception ailleurs.

## 1) Intention produit

- Construire un player de scene/story interactif.
- Lecture pilotee par scenario + events utilisateur.
- Mode reflexion/pseudo-code prioritaire (pas de migration directe du legacy).
- Architecture orientee machines d'etat pour tracer proprement les enchainements.

## 2) Concepts metier

- `SceneDoc`: stories + scenario + tracks.
- `StoryDoc`: items + straps + event nodes + politique de fin.
- `ItemDoc` (perso): type, initial, actions, emit, listen, media.
- `StrapDoc`: logique sans rendu direct.
- `EventNode`: event temporel imbrique (aplati au runtime).
- `TrackDoc`: couche d'events activable/desactivable.
- `Playable`: interface commune `play/pause/seek/rewind` (story + media).

## 3) Decisions V1 figees

### Events, ordre, tracks

- Portee d'un click: globale scene.
- Plusieurs cibles peuvent reagir au meme event.
- Convention de nom d'event: libre (editeur/script).
- Matching V1: egalite exacte (`event.name === actionKey`), pas de wildcard.
- Ordre global:
  1) `ms` asc
  2) `track.order` asc
  3) `event.index` asc
  4) source user apres story/system a egalite
- Ordre entre cibles qui ecoutent le meme event: ordre de declaration.
- Catalogue technique canonique: `evolution/09-catalogue-events-techniques-v1.md`.

### User track et enregistrement

- Piste user distincte, activable/desactivable comme les autres.
- `recordable` explicite, defaut `false`.
- Mode d'enregistrement V1 defaut: `finalOnly`.
  - On garde l'event final (resultat), pas toute la duree du geste.

### Preload et rebuild

- Preload medias obligatoire avant demarrage.
- Si preload echoue:
  - mode `editor`: degrade autorise
  - mode `player`: blocage
- Le moteur ne decide pas seul du mode rebuild: c'est l'hote/editeur qui le fournit.
- `seek/rewind` acceptent `rebuild` optionnel.
- Defaut `rebuild = 'state'`.
- En `state`, on conserve les medias charges et l'identite des nodes (`nodeRef` stable).
- En `full`, reset complet: nodes/plugins recrees et preload complet.
- Aucun `full` implicite: uniquement sur demande explicite de l'editeur.
- `init` detruit avant reinit; `revert` ne detruit pas.

### Media et synchro

- Les medias suivent la sequence.
- Seuil de correction derive: 80 ms.
- Support d'un media `master` (voix prioritaire); un seul master actif a la fois.
- La commande globale sequence (`play/pause`) prime sur commandes media locales.
- Action media supporte: `play/pause/seek/rewind`, avec `play.startAt?`.

### Regles seek media

- Ne jamais faire un seek media "aveugle".
- D'abord calculer l'etat logique du media a `seekMs`.
- Cas couverts:
  - `play` pas encore emis -> pas de lecture forcee
  - `pause` emis -> rester en pause apres seek
  - `ended` -> fin de media, pas de replay implicite
  - `playing` -> appliquer position, puis jouer seulement si player global est `playing`

### Stories, instances, fin

- IDs runtime namespaces: `storyId#n/itemId`.
- Instance conservee pendant la vie de la sequence.
- Story et media suivent des machines d'etat.
- Politique de fin story:
  - `story ended` force `ended` sur tous les enfants
  - `allChildren` -> fin quand tous les enfants bloquants sont `ended`
  - `storyDriven` -> fin sur commande scenario
- `loop: infinite` non bloquant par defaut (`blocksStoryEnd=false`).
- `rewind` reinitialise aussi les straps.
- `clockMode` story:
  - `timeline` (defaut): progression temporelle continue
  - `eventOnly`: story d'attente pilotee uniquement par events
- Flux frequent supporte par API dediee:
  - `scenario.startWait(...)`
  - `scenario.resolveWait(...)`
  - mode par defaut: `parallel` (la story source continue)
  - mode optionnel: `suspendSource` (reprise au curseur gele)

### Plugins

- Plugins autorises a gerer des side-effects et ajuster des transitions.
- Plugins interdits d'emettre des events ou d'annuler une action.
- Plugin `list` cree dans `createElement` (meme point de creation que le node) puis expose au player.

### Strap et side-effects async

- Les side-effects metier (ex: submit form backend) sont geres dans les straps.
- Le strap utilise `effect.run(...)` pour les appels async.
- En succes/echec, le strap pilote explicitement la suite narrative (`resolveWait`, `gotoStory`, etc.).

### Type `list` (conteneur)

- `type='list'` est un conteneur pour enfants ordonnes.
- Auto-animation possible sur `add/remove/move` des enfants.
- Detection basee sur IDs enfants stables.
- Traitement vigilance V1:
  - `remove`: etat `leaving` puis retrait physique en fin d'animation
  - `move`: FLIP recommande (snapshot before/after)
  - enfants media: conserver l'intent logique (`playing/paused/ended`)

### Compat legacy

- Pas de mode runtime `legacy` dans le moteur.
- Le format legacy (`persos` + `eventtimes`) passe par un convertisseur externe.
- Reference normative conversion: `evolution/07-compat-legacy-convertisseur-v1.md`.

## 4) Machines d'etat attendues

- `PlayerMachine`: `idle/preloading/ready/playing/paused/seeking/rewinding/error`
- `ScenarioMachine`: `idle/running/waiting/error`
- `StoryMachine`: `idle/ready/playing/paused/ended/error`
- `PlayableMachine`: `idle/playing/paused/ended/error`

Note:

- `waiting` est un etat scenario (gate actif), pas un gel global du player.

Chaque transition doit etre tracee (`from`, `event`, `to`, `status`).

## 5) API a couvrir

- `player`: `init`, `revert`, `destroy`, `play`, `pause`, `stop`, `rebuild`, `seek`, `rewind`, `setRate`, `getState`, `getRuntimeRevision`, `getTimelineElapsedMs`, `getSessionElapsedMs`
- `track`: `add/remove/enable/disable/setOrder/list`
- `event`: `emitUser`, `recordUser`, `setUserRecordMode`, `clearUserTrack`, `replayUserTrack`, `on`
- `scenario`: `startStory`, `stopStory`, `showStory`, `hideStory`, `gotoStory`, `getCurrentStory`, `startWait`, `resolveWait`
- `story`: `create`, `instantiate`, `remove`, `list`, `getTiming`
- `item`: `create`, `update`, `remove`, `get`
- `strap`: `scenario(startWait/resolveWait/gotoStory/stopStory)`, `effect.run`
- `editor`: `resolveNodeRef(runtimeItemId)`
- `machine/debug`: lecture d'etat et traces

## 6) Documents deja produits dans ce repo

- `evolution/01-cahier-des-charges-engine.md`
- `evolution/02-specifications-engine-v1.md`
- `evolution/03-pseudo-code-engine-v1.md`
- `evolution/04-glossaire.md`
- `evolution/05-recommandations-api.md`
- `evolution/06-machines-et-traces-v1.md`
- `evolution/07-compat-legacy-convertisseur-v1.md`
- `evolution/08-checklist-verrouillage-v1.md`
- `evolution/09-catalogue-events-techniques-v1.md`
- `evolution/10-table-transitions-v1.md`
- `evolution/11-resolution-conflits-tick-v1.md`
- `evolution/12-contrat-plugin-list-v1.md`
- `evolution/13-contrat-trace-debug-v1.md`
- `evolution/14-tests-acceptance-v1.md`
- `evolution/15-registre-erreurs-v1.md`
- `evolution/16-plan-implementation-noyau-v1.md`
- `evolution/lots/`
- `evolution/usage/`

## 7) Prochaine etape recommandee dans le nouveau projet

1. Implementer les modules runtime selon les specs 09 -> 15.
2. Brancher le convertisseur legacy en pre-processing (pas dans le runtime core).
3. Executer la suite DoD `T-A1..T-A8` et verifier les traces canoniques.

## 8) Prompt de reprise (copier/coller)

"Nous passons a l'implementation de l'engine V1 a partir des specs deja figees (`09` a `15`). Priorite: implementer les machines + catalogue d'events + traces + wait flow, puis valider T-A1..T-A8." 
