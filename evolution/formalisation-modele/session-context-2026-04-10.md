# Session context - 2026-04-10

## Etat de la session

Session de consolidation documentaire V1 terminee.

Objectif atteint:

- figer un socle minimal deterministe avant la phase de reecriture runtime

## Decisions principales validees

### Architecture et vocabulaire

- `Player = Director + Renderer + Timer + Ticker`
- flux principal one-way: `Director -> Renderer`
- retour `Renderer -> Director` uniquement en cas d'erreur (canal prive)

### Modeles runtime

- `Story.state` runtime-only
- `listen` declaratif, compilable, mapping `1 -> N`
- sorties `listen` internes (non publiques, non journalisees)
- strap sans state propre
- fin story via `story:end` avec etat terminal sticky

### Event, commit, replay

- `eventSeq` monotone global (ordre canonique)
- `commitSeq` monotone global
- commit avec `applyAtMs` et adressage composite `(storyInstanceId, itemId, targetId?)`
- journal canonique des events publics tenu par le `Director`
- en `revoir`: generateurs straps off, side-effects externes bloques
- `seek backward` par defaut render-only (state preserve)
- rollback logique complet via `scene:replay-from-zero`

### Tracks/Eventimes

- compilation canonique par track
- ajout dynamique append-only via events publics
- event canonique de pilotage: `tracks:set`
- track inconnue = erreur auteur
- conflit activate/deactivate sur meme track = erreur sur cette track
- desactivation track = hard gate immediat, sans rattrapage retroactif

### Configuration et policies

- policies par dossier de configuration dedie
- couches de priorite:
  1. defaults framework
  2. preset environnement (`author` / `user`)
  3. config projet/scene
  4. patch runtime
- pas de decisions critiques hardcodees

### Contraintes implementation cible

- `setTimeout` et `setInterval` proscrits pour la cible finale
- cible execution: `rAF + queue + commit`

### Regles TypeScript (recommandees)

- facade d'API formelle au niveau `Player` (API host)
- communication interne inter-modules autorisee en mode plus direct (orientee performance)
- fonctions/classes documentees
- methodes `register*` reservees aux besoins d'extensibilite
- noms de fonctions courts et symboliques
- constantes/configuration privilegiees aux valeurs en dur
- tests smoke en sous-ensembles par sujet

## Documents modifies/crees pendant la session

- `evolution/formalisation-modele/plan-consolide.md` (reecrit)
- `evolution/formalisation-modele/02-story-model.md` (reecrit)
- `evolution/formalisation-modele/03-event-model.md` (reecrit)
- `evolution/formalisation-modele/04-eventime-model.md` (reecrit)
- `evolution/formalisation-modele/06-runtime-contract.md` (reecrit)
- `evolution/formalisation-modele/10-api-host-v1.md` (reecrit)
- `evolution/formalisation-modele/11-runtime-context-mapping-v1.md` (reecrit)
- `evolution/formalisation-modele/18-socle-v1-grandes-lignes.md` (note de transition)
- `evolution/formalisation-modele/README.md` (nettoye et aligne)

## Plan de reprise (prochains objectifs)

1. Finaliser la passe documentaire V1

- retirer les notes obsoletes pre-consolidation pour eviter les ambiguities de reference
- verifier la coherence transversale des termes (`Director`, `Renderer`, `runtimeConfig`, `tracks:set`)

2. Preparer la migration code runtime

- etablir le plan de transformation du player actuel vers un `Renderer`
- definir des contrats internes minimaux `Director`/`Renderer` (sans facade imposee)
- poser la structure de configuration/policies dans le code

3. Demarrer la reecriture runtime par etapes

- introduire les structures `eventSeq` / journal canonique cote `Director`
- introduire le contrat commit (`commitSeq`, `applyAtMs`, adressage composite)
- connecter le `Renderer` au flux de commits

4. Couvrir par tests smoke par sujet

- sous-ensemble Director (events/replay/tracks)
- sous-ensemble Renderer (queue/commit/apply)
- sous-ensemble integration Player (policies/presets)

5. Ouvrir ensuite le sujet scripting auteur

- garder le socle V1 stable
- traiter le scripting comme extension progressive via API auteur

## Reprise effectuee (complement)

Objectif 1 (passe documentaire V1) avance:

- `README.md` precise explicitement le statut non normatif des documents historiques
- les notes obsoletes `01-scene-model.md`, `05-graph-model.md`, `07-perso-compilation-boundary.md`, `08-perso-contract-v1.md` et `09-perso-custom-actions-v1.md` sont retirees
- le dossier ne conserve que les references V1 actives et les notes de contexte utiles

Objectif 2 (preparation migration code runtime) decrit:

- plan de migration ajoute: `12-runtime-migration-plan-v1.md`
- contrats internes minimaux `Director`/`Renderer` et structure `runtimeConfig` explicites
- trajectoire de transformation en 5 etapes alignee vers l'objectif 3

Objectif 2 (implementation) demarre:

- extraction initiale du `Renderer` dans `src/renderer/create-renderer.ts`
- `create-player` converti en orchestration de commits vers `Renderer`
- alignement canonique V1: suppression des factories de compatibilite (`createPlayer`, `createRenderer`) au profit des classes (`PlayerFacade`, `RendererFacade`)
- ajustement spec: facade formelle reservee au `Player` (API host), communication interne plus directe autorisee pour les hot paths
- extraction initiale du `Director` dans `src/director/create-director.ts`
- `PlayerFacade` delegue desormais la resolution d'events au `Director`
- `PlayerFacade.emit(...)` ajoute pour injecter des events publics en test reel
- demo POC simple ajoutee dans `src/main.ts` (bloc `DEMO` rouge + rotation `180deg` sur `2000ms`)

## Regle de reprise

Reprendre a l'objectif 1 du plan de reprise, puis enchainer sur 2 et 3 avant d'ouvrir le scripting.

## Reprise complementaire - noyau player + demo (2026-04-10)

Contexte de reprise:

- le noyau `PlayerFacade + DirectorCore + RendererFacade` est en place
- une demo POC runtime est active dans `src/main.ts`
- probleme constate en run manuel: la demo ne jouait pas de facon fiable au demarrage

### Tracage effectue avec les methodes integrees

- utilisation de `player.onTrace(...)` et `player.onStateChange(...)` dans la demo
- enrichissement des traces player pour les points critiques de scheduling:
  - `player:schedule:events` (curseur timeline, nombre d'events planifies/skippes)
  - `player:event:triggered` (event execute, delai planifie, timeline runtime courante)
- affichage multi-lignes des traces dans la demo pour relire la sequence complete
- verification des transitions de commande (`init`, `play`) avec gestion explicite des retours `{ ok: false }`

### Diagnostic principal (cause racine)

- les events a `ms=0` pouvaient etre ignores au `play`
- cause: le curseur de planification etait calcule via `resolveCurrentTimelineMs()` juste apres activation playback, ce qui introduisait un leger drift (> 0ms) via `performance.now()`
- effet: un event `event.ms = 0` etait considere comme "deja passe" et non planifie

Correction appliquee:

- planification basee sur un curseur stable `timelineMs` (ancre player) au lieu du curseur runtime instantane
- test de non-regression ajoute (`L17-T3`) pour couvrir le cas horloge perf non nulle/non stable

### Ce qui reste a concevoir pour fiabiliser la demo

Priorite immediate:

1. tracer aussi le niveau `Director` et `Renderer` (pas seulement `player`) avec `correlationId` event/commit
2. ajouter un panneau de debug demo lisant les traces detaillees (filtre, limite, export) sans polluer le noyau
3. definir le comportement de fin de timeline (`story:end` / auto-stop / etat terminal) pour la demo et pour le noyau
4. aligner la planification vers la cible V1 (`rAF + queue + commit`) en remplacant le scheduling `setTimeout` du POC

### Separation stricte: noyau player vs demo

Concerne la construction du player (a garder dans le noyau):

- orchestration `Player -> Director -> Renderer`
- modele d'etat player/director/renderer et validations de transitions
- pipeline canonique `event -> resolvedActions -> commits -> renderer.tick`
- traces runtime structurantes (statuts `applied/rejected/error/info`, payload utiles)
- politiques runtime (`allowedRebuildModes`) et garanties de determinisme
- tests de regression techniques (`tests/lot16`, `tests/lot17`)

Specifique demo uniquement (a isoler hors noyau):

- scene fixture "DEMO" (bloc rouge, wording UI, mise en page)
- rendu des traces en texte dans la page de demo
- presentation visuelle (`src/style.css`, shell de test manuel)
- messages d'interface orientee validation manuelle

Regle pratique:

- toute logique necessaire en production multi-scene/multi-story reste dans `src/player`, `src/director`, `src/renderer`
- tout ce qui sert uniquement a observer la POC manuellement reste dans `src/main.ts` et UI associee

## Handoff rapide - interruption terminal (2026-04-10)

Contexte interruption:

- probleme console/terminal cote session courante
- demande utilisateur: sauvegarder l'etat pour reprise immediate en nouvelle session

### Avancement code depuis la section precedente

- deplacement de la demo vers un dossier dedie:
  - `src/demos/player-poc-demo.ts`
  - `src/demos/player-poc-demo.css`
- `src/main.ts` devient un point d'entree minimal qui lance `runPlayerPocDemo()`
- correction rendu DOM: les styles runtime sont maintenant appliques proprement sur vrais elements DOM
  - `src/runtime/create-element.ts`: application style initial via API style DOM (au lieu d'une reassignment fragile)
  - `src/runtime/apply-actions.ts`: patch style runtime via ecriture propriete par propriete
- enrichissement affichage traces demo pour lisibilite humaine:
  - lignes horodatees relatives (`+Xms`)
  - message specifique par type d'event player (`init`, `play`, `schedule`, `event:triggered`, `event:applied`)
  - fallback compact sur payload

### Verification avant interruption

- `npm run test:lot17` -> OK (3/3)
- `npm run build` -> OK

### Etat git local a la coupure

Fichiers modifies (non commit):

- `evolution/formalisation-modele/session-context-2026-04-10.md`
- `src/main.ts`
- `src/player/create-player.ts`
- `src/runtime/apply-actions.ts`
- `src/runtime/create-element.ts`
- `src/style.css`
- `tests/lot17/player-demo-poc.spec.ts`
- `src/demos/` (nouveau dossier)

### Point de reprise recommande (prochaine session)

1. lancer `npm test` pour validation globale apres les derniers changements de trace demo
2. valider visuellement en `npm run dev` que les logs demo sont enfin exploitables pour le debug
3. nettoyer/decider le sort de `src/style.css` (reste legacy potentiellement obsolete pour la demo isolee)
4. si OK, preparer commit(s) separes:
   - commit noyau runtime (style DOM + scheduling/trace player)
   - commit demo (deplacement dossier `demos` + CSS + format logs)

## Reouverture documentaire - creation des persos par type

Motif:

- nettoyage precedent juge trop agressif sur le sujet "creation d'elements depuis `item.type`"

Action:

- section re-ouverte dans la reference active pour expliciter:
  - contrat `item.type -> RuntimeElement`
  - separation custom module vs noyau (`text`/`img`/`list`)
  - localisation stricte de `FLIP` dans le composant `list`
