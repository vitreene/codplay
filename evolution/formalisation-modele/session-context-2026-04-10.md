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
