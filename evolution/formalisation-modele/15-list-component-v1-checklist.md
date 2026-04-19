# List component V1 - checklist de deploiement

## Statut

Document de pilotage en mode etude active.

Plan de sequence courant:

- A: termine
- B: termine
- C: termine
- D: prochain lot (FLIP reel)
- E: ensuite (validation globale)

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

- [ ] brancher `ListFlipTrigger` vers `createFlipEngine.run(...)`
- [ ] garantir la gestion `width/height`: appliquer pendant FLIP puis restaurer/supprimer proprement
- [ ] gerer interaction FLIP avec transitions explicites `style.to`
- [ ] finaliser le calcul reparent parent->parent via `DOMMatrix`
- [ ] valider que le moteur ne depend pas d'un simple `getBoundingClientRect` brut

## Phase E - validation

- [ ] tests unitaires List: modes, persistances, conflits, transfer
- [ ] tests integration Player+List+Renderer+FLIP
- [ ] scenarios visuels de reference (source de decision finale)
- [ ] ajustements spec selon rendu observe
- [ ] ajouter et valider le cas de reference FLIP `A/B1/B2/C` (hors Player puis integration sequence)

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
