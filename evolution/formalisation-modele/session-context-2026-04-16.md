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
- `parentId` optionnel:
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
- `auto` sans `parentId` = positionnement visuel local (souvent combine CSS), sans reparenting
- `auto` avec `parentId` = placement decide par la policy de la liste cible

### Reparenting et transfert inter-list

- reparenting lie a `parentId` (ou objet equivalent futur)
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

## Reprise ulterieure - checklist composant List (2026-04-17)

### Etat courant

- l'etude est centree sur le systeme de composants (List sert de cible de formalisation)
- exemple video documente dans `evolution/formalisation-modele/examples/video-component-example.ts`
- exemple list documente dans `evolution/formalisation-modele/examples/list-component-example.ts`
- ajustements demandes valides:
  - vocabulaire `parent` (pas `owner`)
  - enfants list references par `persoId` (pas de creation de node enfant dans List)
  - FLIP represente par etat/plan composant (pas de marquage data-* sur les nodes)

### Checklist DoD - vrai composant List

- [ ] verrouiller le contrat composant V1 final (`constructor/init/render/update` + payload `eventId/eventSeq/action`)
- [ ] brancher registre composants player (`registerComponent` / `overrideComponent`) avant `load(scene)` uniquement
- [ ] instancier un composant par `Perso` et router `update` vers la bonne instance
- [ ] exposer un registry runtime stable `persoId -> nodeRef` et `persoId -> listComponent`
- [ ] retirer le traitement `move` generique de `apply-actions` au profit du composant List
- [ ] valider en amont Director: `move.mode`, `parentId` list, anti-cycle, normalisation des nombres
- [ ] implementer la politique complete `move` (persistances, conflits, transfer remove->reparent->add)
- [ ] integrer FLIP via `flipEngine.run(...)` depuis List (pas de calcul local simplifie)
- [ ] FLIP: gerer `width/height` avec restauration/suppression propre apres animation
- [ ] FLIP: gerer interaction avec transitions explicites (`style.to`) sans collisions
- [ ] FLIP reparent: finaliser calcul parent->parent via `DOMMatrix` pour xy/wh fiables
- [ ] definir contrat de transport des plans FLIP vers animation (`ListFlipPlan` -> transitions)
- [ ] brancher la config list runtime (`reorderOnMove`, `reorderOnAdd`, `reorderOnRemove`, overrides locaux)
- [ ] warnings: dedoublonnage strict (1 warning par `eventSeq`/code/item)
- [ ] ajouter tests unitaires list (modes move, conflits, persistances, transfer)
- [ ] ajouter tests integration player+list+flip (dont reparent et resize)
- [ ] ajouter scenarios visuels de reference pour validation auteur

### Point de reprise recommande

- commencer par verrouiller le contrat V1 de transport FLIP (`ListFlipPlan`) et le wiring vers `createFlipEngine.run`
- ensuite brancher l'execution List dans le player, puis couvrir par tests avant optimisation

## Avancement de reprise (2026-04-17 - suite)

### Actions realisees

- checklist deploiement ajoutee: `15-list-component-v1-checklist.md`
- exemple List remanie pour clarifier l'interface FLIP:
  - suppression du marquage de nodes pour FLIP
  - transport FLIP explicite via `ListFlipTrigger`
  - delegation FLIP via `ListFlipBridge.run(...)`
  - vocabulaire aligne: `parent` (pas `owner`)
  - enfants list resolves via `persoId -> nodeRef` (pas de creation de node enfant dans List)
- index README mis a jour avec les drafts composants/list

### Point d'attention FLIP (maintenu)

- le bridge FLIP est pose au niveau contrat, mais le branchement runtime reel vers `createFlipEngine.run(...)` reste a implementer
- la gestion avancee `width/height` + restore/cleanup, interaction avec `style.to`, et reparent matrix via `DOMMatrix` restent ouvertes

## Avancement de reprise (2026-04-17 - contrat generique)

Decision produit validee:

- revenir au contrat composant generique et fixer son perimetre avant les specs de composants concrets
- ordre de definition retenu: `image` puis `text` puis `list`

Execution documentaire:

- `14-component-system-v1-draft.md` reecrit pour cadrer le contrat V1 generique
- perimetre explicite Player vs composant
- invariants confirms (1 Player par scene, 1 composant par Perso, runtime permissif)
- jalons suivants explicites pour les 3 composants de base de la premiere scene

Livrable ajoute:

- `16-base-component-v1.md` cree comme spec de reference pour le socle commun a tous les composants
- `README.md` aligne pour inclure ce document dans la reference V1 active

## Avancement de reprise (2026-04-17 - events utilisateur)

Decision prise:

- formaliser une spec dediee a la propriete `emit` au niveau `Perso`
- `emit` reste declaratif et attache au `init` composant via `handleEvent(event)`

Execution documentaire:

- `17-user-events-emit-v1.md` cree (schema, normalisation, attachement, emission Director, warnings)
- `16-base-component-v1.md` aligne avec une section "Attachement interactions utilisateur"
- `02-story-model.md` aligne sur la presence de `emit?` dans la description item
- `README.md` aligne pour inclure la nouvelle spec

Ajout de precision demandee:

- description explicite du pipeline `emit -> Director -> Eventime manager -> journal canonique` dans `17-user-events-emit-v1.md`
- alignement eventime dans `04-eventime-model.md` avec section "Events publics entrants (user/host)"

## Avancement de reprise (2026-04-17 - composant text)

Execution documentaire:

- `19-text-component-v1.md` cree comme spec composant concrete sur base de `16` et `17`
- scope fixe: root unique, `content` textuel, patchs base, attachement `emit` au `init`
- warnings minimaux et tests smoke recommandes ajoutes
- `README.md` aligne pour inclure `19-text-component-v1.md`

## Avancement de reprise (2026-04-17 - composant image)

Execution documentaire:

- `22-image-component-v1.md` cree comme spec composant image
- scope fixe: fragment `div(root) + img(media)`, `src` initial/update, patchs base, attachement `emit` au `init`
- warnings minimaux et tests smoke recommandes ajoutes
- `README.md` aligne pour inclure `22-image-component-v1.md`

Corrections de cadrage appliquees:

- un carrousel/galerie n'est jamais un composant image; ce cas releve de `list` + enfants `img`
- abandon du modele "tag unique" pour `image`
- modele de reference image fixe a `div(root) + img(media)`
- style auteur applique sur le container root
- usage visuel distingue par `fitMode`:
  - `wallpaper` -> `object-fit: cover`
  - `sprite` -> `object-fit: contain` (image integralement visible)

## Avancement de reprise (2026-04-17 - text advanced pre-spec)

Execution documentaire:

- `20-text-advanced-pre-spec.md` cree pour cadrer l'evolution texte enrichi
- sujets couverts: rich text, micro-animations, longs textes, transition old/new
- questions de cadrage ajoutees avant redaction d'une spec normative

Mises a jour suite arbitrages:

- `text advanced` confirme comme evolution du type `text` (pas un nouveau type)
- micro-animation definie comme animation a proprietes pre-definies cote auteur
- support emoji confirme dans la segmentation micro-animation
- strategie longs textes capturee (shrink jusqu'a limite puis scrolling)
- texte enrichi: format canonique JSON structure, genere depuis interface auteur
- contrainte methodologique: s'appuyer sur une spec/module specialise existant (pas de format maison)

Correctifs de cadrage ajoutes:

- micro-transitions limitees aux textes de longueur controlee
- micro-interactions hors pipeline d'events publics (composant + librairie animation uniquement)
- politique de concurrence `last-write-wins` retiree du cadrage texte avance
- nouvelle piste: transitions interruptibles et relance depuis etat au moment de l'event

Arbitrages supplementaires valides:

- une micro-transition capture son etat initial au moment exact de son demarrage
- une nouvelle transition interrompt immediatement l'animation en cours
- la nouvelle transition repart depuis l'etat courant (interruption)
- preset candidat ajoute: `zoom-in-stagger` (adapte de l'exemple fourni)

Formalisation ajoutee:

- `21-text-micro-animations-v1.md` cree pour fixer le contrat micro-animations texte
- contenu fixe: presets pre-definis, transport vers librairie animation, interruption immediate avec reprise depuis etat courant
- rappel explicite: aucune emission d'event public pour les micro-interactions

Precision ajoutee:

- `zoom-in-stagger` documente comme preset de reference (non exclusif)
- catalogue de presets considere extensible
- formalisation du procede commun: split texte + animation stager de quelques proprietes + execution rapide

Precision integration animation:

- les micro-animations texte doivent passer par `animejs` via le pipeline animation runtime
- objectif: coherence de gestion avec les evenements Player (`play`, `pause`, `seek`)
- les micro-animations restent soumises a la gestion globale des animations

Preparation demandee effectuee:

- shortlist spec/module ajoutee dans `20-text-advanced-pre-spec.md`
- options comparees: Portable Text, ProseMirror+Tiptap, Lexical
- recommandation conditionnelle ajoutee selon priorite (spec externe vs ecosysteme)

## Avancement de reprise (2026-04-17 - composant list)

Execution documentaire:

- `23-list-component-v1.md` cree comme spec composant list normative V1
- perimetre fixe: composant list unitaire, logique `move` + transfer + FLIP
- rendu de reference confirme: fragment `section(root) + ul(items)`
- enfants list references uniquement par `persoId -> nodeRef` runtime
- `move` fige en objet unique (`mode`, `parentId`, `flip?`, `reorder?`)
- politique move formalisee (modes, persistance, conflits, transfer)
- contrat FLIP formalise (`ListFlipTrigger` + bridge runtime)

Mises a jour associees:

- `README.md` aligne pour inclure `23-list-component-v1.md`
- `16-base-component-v1.md` aligne (etat documentaire: text/image/list definis)
- `15-list-component-v1-checklist.md` aligne (phase A partiellement validee)

Precision ajoutee sur `23-list-component-v1.md`:

- clarification de "contraintes seek auteur avancees (hors V1)"
- exemples hors V1 listes: seek borne auteur, step FLIP manuel, verrouillage seek par profil, bookmarks d'edition

Correction de cadrage:

- seek sur etats intermediaires d'une transition `move` est confirme en V1
- regle V1 explicite: interruption immediate puis reprise depuis etat courant vers l'etat cible du seek

Correction architecturale majeure (list):

- abandon du modele parent -> enfants pour la spec list
- modele confirme: enfant -> parent via `move.parentId`
- `children` supprime du contrat list (ne sera jamais expose)
- `move` confirme comme mecanisme d'insertion DOM valable pour tous les composants
- en cible invalide/non-list: composant detache + warning auteur
- FLIP par defaut sur source et cible en transfer, avec flag ponctuel pour desactivation

Precisions supplementaires validees:

- un composant peut etre cree en mode non monte (`detached`) puis place plus tard via `move.parentId`
- en mode `detached`, le node est conserve pour reuse (notamment seek)
- detachement lie a une transition de sortie: detachement effectif en fin de transition
- `move` utilisable au montage initial (`initial.move`) et en runtime (`actions.*.move`)

Decision tranchee:

- detachement transitionnel via un event public unique
- enchainement logique runtime jusqu'au passage en etat `detached`
- justification: limiter le cout operationnel et le nombre d'events publics

Alignements transverses appliques:

- `16-base-component-v1.md` mis a jour avec section `move` commune a tous les composants
- `19-text-component-v1.md` et `22-image-component-v1.md` alignes pour reconnaitre `move` comme mecanisme commun d'insertion DOM

Correction contrat FLIP list:

- `includeSize` et `includeTransformMatrix` retires du contrat `ListFlipTrigger`
- regle list V1: calcul size + transform matrix toujours actifs
- si des flags existent dans le moteur FLIP, ils restent internes runtime (non exposes au contrat list)

Preparation test FLIP validee:

- cas de reference `A/B1/B2/C` retenu
- validation en deux temps:
  1. hors Player (moteur FLIP isole)
  2. integration Player (scenario Perso/sequence)
- le positionnement initial exact sera precise lors de l'elaboration concrete du test

Execution complementaire:

- `examples/list-component-example.ts` reecrit et aligne sur le modele enfant -> parent
- suppression du contrat `children` dans l'exemple list
- routage `move` par `parentId` via router runtime dedie
- demonstration du cycle `detached -> mounted -> transfer -> detached` avec event unique de sortie

Spec-cadre ajoutee:

- `24-runtime-log-policy-v1.md` cree pour cadrer logs/traces runtime
- objectif: couplage minimal, desactivation simple, dedoublonnage, points de trace limites
- vocabulaire aligne: `touched` (pas `dirty`)

Norme warning v0.1 ajoutee:

- convention `AUTHOR_*` / `RUNTIME_*`
- format warning minimal unifie
- dedoublonnage par `{eventSeq, code, persoId?}`

Spec FLIP ajoutee:

- `25-flip-runtime-core-v1.md` cree comme reference precise de calcul FLIP
- regle cardinale: chemin de calcul unique (size + matrix toujours actifs)
- adaptation explicite des methodes de reference GSAP au runtime controle projet
- contraintes formalisees: interruption/reprise, play/pause/seek, restore width/height, traces minimales

Spec orchestration Player ajoutee:

- `26-player-orchestration-v1.md` cree pour formaliser registre, instanciation, routage update/move
- `move` route cote Player runtime
- `initial.move` et `actions.*.move` unifies (meme routeur)
- list cible existante mais non montee: execution sans FLIP
- patches layout-impactants integres au `mutationPlan` FLIP

Precisions complementaires validees:

- `initial.move` est traite comme un append de montage (mode explicite ignore au chargement)
- si un update combine `move` et interpolation layout-impactante, execution en une seule animation composee

Alignement warning codes:

- adoption de la convention `AUTHOR_*` / `RUNTIME_*` sur specs composants/FLIP (`19`, `22`, `23`, `25`)

Point coherence global applique:

- `19-text-component-v1.md` et `22-image-component-v1.md` alignes: type `Action` inclut desormais `move`
- `14-component-system-v1-draft.md` aligne sur le modele enfant->parent (`move.parentId`)

Note implementation FLIP ajoutee:

- options animation alignees avec le pipeline global: `duration`, `easing`, `trajectory`
- `trajectory` V1: `linear` par defaut
- `trajectory: "curve"` prevue pour une trajectoire visuellement attiree vers le centre de scene
- detail de fabrication de la courbe reporte a l'implementation concrete

Precision technique ajoutee:

- `animejs` n'anime pas la propriete `matrix`
- la matrice transform est reservee aux calculs internes FLIP
- les canaux animes runtime restent `x/y/width/height`

Maintenance coherence documentaire:

- `15-list-component-v1-checklist.md`: item Phase A warnings dedoublonnes marque termine
- `15-list-component-v1-checklist.md`: artifacts de reference complets (`24`, `25`, `26`)
- `README.md`: ajout de `session-context-2026-04-16.md` dans les notes de transition
- `README.md`: rappel explicite `session-context-*` non normatifs (priorite aux specs V1 actives)
