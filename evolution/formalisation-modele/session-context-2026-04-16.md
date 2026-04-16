# Session context - 2026-04-16

## Objet

Session de verification et correction immediate.

Objectifs:

- verifier l'etat d'execution des points 1 a 3 du plan de reprise
- retirer toute utilisation runtime de timers legacy
- basculer le scheduling vers les mecanismes du ticker

## Verification points 1 a 3

### Point 1 - passe documentaire V1

Etat: execute majoritairement.

- references V1 actives explicites dans `README.md`
- notes historiques pre-consolidation retirees
- coherence des termes cibles (`Director`, `Renderer`, `runtimeConfig`, `tracks:set`) globalement alignee

### Point 2 - preparation migration runtime

Etat: partiellement execute.

- plan de migration present et detaille (`12-runtime-migration-plan-v1.md`)
- extraction `Director`/`Renderer` engagee dans le code
- manque restant: structure dediee `runtimeConfig/policies` non encore materialisee dans `src/config/runtime/*`

### Point 3 - demarrage reecriture runtime

Etat: partiellement execute.

- contrat commit present (`commitSeq`, `applyAtMs`, adressage composite)
- branchement `Director -> Renderer` operationnel en premier niveau
- manques restants: `eventSeq` + journal canonique cote `Director` non finalises

## Corrections appliquees - suppression timeout/interval

### 1) Player scheduling

- suppression du scheduling par timers dans `src/player/create-player.ts`
- introduction d'une boucle frame-driven via `TimeTicker`
- traitement des events dus par curseur deterministic (`nextScheduledEventIndex`)

### 2) Ticker internals

- suppression de toute fallback timer dans `src/core/time/ticker.ts`
- scheduler prioritaire `requestAnimationFrame`
- fallback non-timer via `MessageChannel` quand necessaire

### 3) FLIP runtime

- suppression de la fallback timer dans `src/runtime/flip-engine/create-flip-engine.ts`
- frame barrier basee sur `requestAnimationFrame` uniquement

### 4) Tests

- suppression du helper `sleep` base timer dans `tests/lot8/flip-engine.spec.ts`
- remplacement par attente basee `TimeTicker`

## Verification post-correction

- recherche code des API timers legacy sur `*.ts,*.tsx,*.js,*.jsx,*.mjs,*.cjs`: aucune occurrence
- `npm run test:lot8`: OK (10/10)
- `npm run build`: OK

## Reste ouvert apres cette session

- finaliser `eventSeq` et journal canonique public cote `Director`
- introduire la couche `runtimeConfig/policies` dediee dans `src/config/runtime`
- poursuivre l'alignement objectif 3 (replay/tracks smoke tests)

## Regle operatoire assistant

- ne jamais proposer de commit
- ne jamais executer de commit

## Reprise ulterieure - etude composants et move

Contexte:

- reprise en mode etude pure (pas de spec finale figee)
- objectif: replacer `move` dans un systeme d'actions specialisees par composant
- priorite aux rendus visuels attendus sur cas reels

### Orientation generale validee

- `move` devient un objet unique (plus de formes boolean/string)
- le modele runtime reste permissif:
  - operation non applicable => ignoree
  - mode `author` => warning
  - mode `user` => pas de blocage
- pas d'emission d'event interne pendant un `update`

### Forme `move` retenue a ce stade

- `mode` obligatoire
- `mode` accepte:
  - `auto`
  - `first`
  - `last`
  - `append`
  - `prepend`
  - `number` (position absolue)
- `targetId` optionnel:
  - present => cible list explicite (transfert possible)
  - absent => liste courante de l'item
- `flip`:
  - actif par defaut
  - exception explicite via `flip: false`
- `reorder`:
  - parametre local possible via `reorder: false`
  - en conflit avec `mode`, `mode` gagne (pour l'instant)

### Semantique de placement

- `number` = placement absolu (clamp `[0..n]`)
- `first` / `last` = placement relatif persistant
- `append` / `prepend` = placement relatif non persistant
- `auto` sans `targetId` = positionnement visuel local (souvent combine CSS), sans reparenting
- `auto` avec `targetId` = placement decide par la policy de la liste cible

### Reparenting et transfert inter-list

- reparenting lie a `targetId` (ou objet equivalent futur)
- sequence transfert retenue:
  1. `remove` source
  2. reparenting
  3. `add` cible
- transfert declenche un FLIP par defaut

### Conflits et anomalies

- plusieurs operations `move` sur meme item dans meme tick:
  - anomalie auteur
  - regle deterministe: derniere operation gagne
  - warning auteur unique par item/tick
  - si derniere operation invalide: toute la serie est ignoree
- conflits multi-items `first/last`:
  - ordre d'insertion
  - warning auteur

### Persistance des regles item

- operation appliquee a l'item lui-meme => nouvelle regle remplace l'ancienne
- item affecte indirectement par operation d'un autre item => sa regle persistante reste
- transfert inter-list => persistance `first/last` ne suit pas l'item vers la nouvelle liste
- `mode:auto` sur l'item lui-meme efface une persistance `first/last`

### Validation amont (hors runtime)

- verifications structurelles resolues avant execution runtime
- anti-cycle a verifier avant runtime
- `index` normalise en entier avant entree `Director`

### Configuration list (instance)

Valeurs par defaut retenues:

- `reorderOnMove = true`
- `reorderOnAdd = true`
- `reorderOnRemove = true`

Exception locale:

- `move.reorder = false` peut desactiver le reorder source+cible
- limitation provisoire: si conflit avec `mode`, ignorer `reorder:false`

### Point de methode pour la suite

- regles courantes considerees comme base de travail
- validation finale a faire sur jeux de cas visuels concrets
- ajuster la spec selon le rendu observe plutot que sur abstraction seule
