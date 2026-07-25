# Inventaire — canaux de mise à jour de ed2, reçus vs reconstitués

**Statut : synthèse de référence, pas un plan d'implémentation.** Objectif : répondre sans tout
relire à "ce défaut (données reconstituées au lieu d'être reçues) est-il généralisé dans ed2, ou
localisé à l'édition de pose ?" Complète l'étude détaillée
`packages/authoring/selection-frame/plan/2026-07-18-pose-edit-architecture-study.md` (qui reste la
référence pour le chemin pose/geste lui-même).

## Principe de tri

Pour chaque flux : la donnée voyage-t-elle comme un **message explicite reçu d'une source qui la
connaît** (sain), ou est-elle **redéduite localement à partir d'un état voisin** (booléen d'activité,
timer, absence de changement) parce qu'aucun message porteur de la vraie valeur n'existe (fragile —
c'est le pattern à l'origine du bug de pose) ?

## Reçu en direct — sain, à ne pas toucher

- **Playhead** (`sequence-editor` → `decor-editor-bridge.ts::lastKnownTimelineMs`) — `sequence-editor`
  possède `ctx.playheadMs`, le relaie via `onPlayheadChange` → `machine.send({type:'SEEK',...})` →
  `machine.on('seek', ...)`. `lastKnownTimelineMs` est un cache légitime d'une valeur reçue en
  direct, pas une valeur devinée. Bon exemple à ne pas confondre avec le reste de cet inventaire.
  **Nuance qui manquait ici et a coûté un faux diagnostic (bug bouton Stop, 2026-07-25) :**
  `onPlayheadChange` (`mount.ts`) est un canal SORTANT UNIQUEMENT — `render()` l'appelle quand
  `ctx.playheadMs` a changé (diff `lastPlayheadMs`), jamais l'inverse ; rien ne réécrit `ctx.playheadMs`
  en retour depuis `options.onPlayheadChange`. Toute mise à jour de la tête de lecture DOIT donc passer
  par `ctrl.seek(ms)` (qui pose `ctx.playheadMs` localement puis laisse le diff de `render()` émettre
  `onPlayheadChange` tout seul) — jamais appeler `options.onPlayheadChange?.(ms)` directement depuis un
  handler, sous peine de piloter le player réel (l'event `SEEK` part bien) sans que l'affichage local
  (chrono, curseur) ne s'actualise. C'était le bug exact du bouton Stop (`onStopClick`, `mount.ts`).
- **Document/scène** (`controller-machine.ts`) — `RUN_COMMAND`/`RUN_TRANSACTION` sont le seul point
  d'écriture (`context.scene`), toute mutation transite par `runCommand`/`transaction`
  (`commands/facade.ts`). Émission `sceneCommitted` après chaque mutation, contient la scène ET la
  sélection à jour — les bridges reçoivent l'état complet, pas un diff à reconstituer.
- **`PLAYER_READY`/`authorApi`** (`controller-machine.ts::setAuthorApi`) — posé une fois, stocké dans
  le contexte, lisible immédiatement par tout pont créé après coup via `getSnapshot()`. Pas de
  reconstruction, juste un contexte partagé classique.

## Reconstitué par déduction — le pattern fragile, cartographié dans l'étude pose-edit

Liste consolidée (détail complet dans l'étude pose-edit, §3 et §5) :

1. **"Un geste est-il en cours" côté offset/dedit** (`isGestureActive()`) — dérivé d'un état de
   machine, jamais reçu comme un événement "geste terminé, voici la valeur". Cause du bug initial
   (§2 de l'étude pose-edit).
2. **"Un geste est-il en cours" côté UI du cadre** (`csMachine`) — deuxième machine, parallèle à la
   précédente (`TrackedSession`), synchronisée par mirroring manuel plutôt que composée. Deux sources
   de vérité pour la même question.
3. **"Le document doit-il être committé maintenant"** (`decor-editor-bridge.ts::pendingCommands`/
   `armIdleFlush`, 6 signaux disjoints + minuteur 4000 ms) — aucun événement "voici le commit final"
   n'existe ; le système suppose qu'après 4 secondes d'inactivité, ou l'un des 5 autres signaux, c'est
   bon à committer.
4. **"Cette lecture de pose est-elle fiable"** (branchement `getNodePose` vs
   `readLiveGestureNodePose`) — n'a plus lieu d'être depuis le premier correctif (le cache anime.js
   est fiable pendant un geste aussi), mais le branchement existe toujours dans le code, cf. étude
   pose-edit §2/§5.4.

## Pas encore vérifié — à checker avant de généraliser plus loin

Ces zones n'ont pas été relues dans cette session ; ne pas supposer qu'elles suivent le même pattern
sans vérification :

- **Sélection multi-item** (`MultiSelectionFrame`) — jamais examinée dans l'étude pose-edit (listé
  explicitement comme non vérifié, §6).
- **Undo/redo** — recherché explicitement (`grep undo/redo` sur `packages/editor/src`) : **aucun
  mécanisme d'undo n'existe actuellement**, seulement deux commentaires qui anticipent son arrivée
  future (`scene-player-bridge.ts:299`, `decor-editor/render.ts:252`). Rien à cartographier ici tant
  que la fonctionnalité n'existe pas — mais tout futur undo devra être conçu en tenant compte du
  pattern "commit explicite" recommandé par l'étude pose-edit, pas raccroché aux 6 signaux de flush
  actuels.
- **Zones/gabarits** (`zone-editor.ts`, `zone-machine.ts`) — utilisent aussi `bindGestureSession`
  (confirmé par le rapport de l'agent d'exploration de l'étude pose-edit, §3.4) — probablement
  concernées par le même défaut de canal preview/commit non séparé, jamais vérifié en détail.
- **Offset bridge en écriture palette→CS** (`applyingFromBridge`, `decor-editor/controller.ts`) — un
  flag anti-boucle existe parce que les deux sens de propagation (palette→CS et CS→palette) partagent
  le même canal `applyPatch` sans distinction de provenance. Repéré en lisant le code, pas encore
  creusé pour savoir si c'est un problème réel ou un garde-fou suffisant.

## Comment utiliser ce document

- Si la question porte sur le chemin **pose/geste** précisément → lire
  `packages/authoring/selection-frame/plan/2026-07-18-pose-edit-architecture-study.md` directement,
  ce document n'en est qu'un résumé de classement.
- Si la question porte sur un **autre flux de l'éditeur** (sélection, zones, futur undo) → vérifier
  d'abord s'il est listé ci-dessus comme "pas encore vérifié" ; si oui, il reste à auditer avant de
  supposer qu'il souffre du même défaut — ne pas généraliser sans lecture.
- Mettre à jour ce fichier (pas en créer un nouveau) à chaque flux nouvellement audité, en le
  déplaçant de "pas encore vérifié" vers l'une des deux catégories tranchées.
