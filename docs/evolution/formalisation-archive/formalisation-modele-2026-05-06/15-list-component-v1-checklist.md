# List component V1 - checklist de deploiement

## Statut

Document de pilotage en mode etude active.

Plan de sequence courant:

- A: termine
- B: termine
- C: termine
- D: termine
- E: termine

## Intention

Transformer le draft List en composant runtime reel, en gardant:

- un Player minimal
- une logique move/FLIP concentree dans List
- un comportement permissif traceable pour l'auteur

## Phase A - contrats et interfaces

- [x] figer le contrat `ListAction` et `ListMoveCommand`
- [x] figer la politique complete `move` (modes, conflits, persistance, transfert)
- [x] definir un contrat de transport FLIP (`ListFlipTrigger`) depuis List vers le runtime animation
- [x] figer la convention enfants List via `persoId -> nodeRef` (pas de creation de node enfant par List)
- [x] confirmer le modele enfant -> parent (`move.parentId`, pas de `children` en contrat list)
- [x] figer les codes warning author dedoublonnes (`eventSeq`)
- [x] figer le contrat de detachement transitionnel (1 event public + enchainement runtime)

## Phase B - integration Player/Director

- [x] brancher `registerComponent` / `overrideComponent` avant `load(scene)`
- [x] instancier un composant par `Perso`
- [x] router `update` agrege vers l'instance cible
- [x] exposer un registry runtime stable `persoId -> nodeRef`
- [x] exposer un registry runtime `persoId -> listComponent`
- [x] retirer le `move` generique de `apply-actions` pour les items geres par List

## Phase C - execution move

- [x] brancher les trois cas move: local, transfer out, transfer in
- [x] brancher le mode "detache" (aucun parent effectif) et la transition vers parent cible
- [x] conserver les nodes detaches pour reuse seek
- [x] appliquer la regle conflits meme tick: last-write-wins + warning author unique
- [x] appliquer `first/last` persistants et `append/prepend` non persistants
- [x] appliquer `mode:number` absolu (clamp)
- [x] appliquer regles `reorderOnMove/add/remove` + exception locale `reorder:false` (avec priorite `mode`)

## Phase D - FLIP reel

- [x] brancher `ListFlipTrigger` vers `createFlipEngine.run(...)`
- [x] garantir la gestion `width/height`: appliquer pendant FLIP puis restaurer/supprimer proprement
- [x] gerer interaction FLIP avec transitions explicites `style.to`
- [x] finaliser le calcul reparent parent->parent via `DOMMatrix`
- [x] valider que le moteur ne depend pas d'un simple `getBoundingClientRect` brut

## Phase E - validation

- [x] tests unitaires List: modes, persistances, conflits, transfer
- [x] tests integration Player+List+Renderer+FLIP
- [x] scenarios visuels de reference (source de decision finale)
- [x] ajustements spec selon rendu observe
- [x] ajouter et valider le cas de reference FLIP `A/B1/B2/C` (hors Player puis integration sequence)

## Cloture

- validation automatique: `npm test` (95 tests) + `npm run build` OK
- reference FLIP `A/B1/B2/C`: `tests/lot8/flip-engine.spec.ts` (L8-T12)
- validation runtime move/overlay: `tests/lot18/move-phase-c.spec.ts`
- demo visuelle validee: mode local conserve, mode `overlay-world` operationnel

## Artifacts de reference

- `evolution/formalisation-modele/examples/list-component-example.ts`
- `evolution/formalisation-modele/examples/video-component-example.ts`
- `evolution/formalisation-modele/14-component-system-v1-draft.md`
- `evolution/formalisation-modele/23-list-component-v1.md`
- `evolution/formalisation-modele/24-runtime-log-policy-v1.md`
- `evolution/formalisation-modele/25-flip-runtime-core-v1.md`
- `evolution/formalisation-modele/26-player-orchestration-v1.md`

Note:

- `examples/list-component-example.ts` est aligne avec la spec inversee enfant -> parent (version 0.4.0)
