# ed2 — Désactivation de dedit pendant la lecture (état `playing`)

Corrige le bug : item à 2 kf de couleurs différentes, kf2 sélectionné avant Play → couleur figée
sur celle de kf2 toute la lecture ; kf1 sélectionné → lecture correcte.

**Périmètre (scindé en deux chantiers)** : ce plan couvre UNIQUEMENT la correction du bug —
désactiver dedit pendant la lecture, réactiver sur la dernière sélection connue. La question du
modèle After Effects (dedit lisant l'état interpolé à la tête de lecture plutôt que le dernier kf
sélectionné) est le chantier 2, séparé — voir
`packages/authoring/selection-frame/plan/2026-07-17-resolved-state-at-time-notes.md`.

## Constat

- La sortie du builder (`buildSceneDoc`) est strictement identique quel que soit le kf sélectionné
  — `SELECT_ITEM` seul ne déclenche jamais de rebuild (`scene-player-bridge.ts`, `sceneCommitted`
  avec `scene === lastScene` → pas de rebuild).
- Le vrai mécanisme : `applyResolvedDecor` (`decor-editor/mount.ts`) écrit directement
  `el.style.setProperty(prop, value)` sur le node réel du player à chaque sélection dans dedit
  (`subscribeToNode`, jamais via anime.js) — la preview live. Rien n'écoutait `telco` : cette
  preview restait posée qu'on soit en pause ou en lecture. Le runtime interpole depuis "la valeur
  ACTUELLE du perso" (`build-scene.ts::buildKeyframeDecorActions`, pas de `from` figé) — si cette
  valeur a été écrasée par dedit avant le Play, l'animation démarre depuis la valeur figée, jamais
  visible.
- Le seek "corrigeait" le symptôme car `telco.seek()` rejoue l'état matérialisé sur le node
  (réécrase la preview figée) — `telco.play()` ne fait pas ça, il reprend depuis l'état DOM
  courant.

## Modèle retenu — état `playing`, piloté par le geste éditeur, jamais par le statut du transport

Nouvel état macro XState (`controller-machine.ts`), sibling de `idle`/`creating` — aucune situation
où dedit est actif pendant la lecture.

**Entrée et sortie reposent toutes les deux sur des gestes éditeur explicites, jamais sur
`isPlaying` (`AuthorApi.subscribeToPlayerState`)** — première version du plan basée sur `isPlaying`,
invalidée en implémentation : le rebuild forcé que cet état déclenche lui-même (ci-dessous) produit
du bruit transitoire sur ce statut pendant sa propre réinitialisation, faisant sortir la machine de
`playing` avant même que ce rebuild ait fini, quel que soit l'ordonnancement. Le statut du transport
et le geste éditeur ne jouent pas au même niveau — piloter l'état sur le geste règle le problème par
construction :

- **Entrée** : `TELCO_ACTION_REQUEST` — déjà émis une seule fois, juste avant `telco.play()`,
  jamais pour pause (`sequence-editor/mount.ts::onPlayClick`).
- **Sortie** : `TELCO_PAUSE_REQUEST` (nouveau — émis juste avant tout `telco.pause()`, geste
  explicite ou pause automatique en fin de scène) et `SEEK` (déjà un event racine — couvre Stop et
  le scrub pendant la lecture ; le handler de `playing` ajoute `target: 'idle'` à `emitSeek`, sans
  rien changer pour `idle`/`creating`).

À l'entrée (`playbackActiveChanged: {active: true}`, émis par `entry` de l'état) :
- `scene-player-bridge.ts` force un rebuild inconditionnel (même idiome que `sceneReverted` —
  efface toute preview dedit périmée en remontant un node flambant neuf), puis relance
  `telco.play()` si l'état `playing` tient toujours une fois le rebuild résolu — nécessaire, car
  `rebuild()` (`studio.load()` + `seek`) ne joue jamais : il remonte le player en pause à la
  position, écrasant silencieusement le `telco.play()` déjà appelé par `onPlayClick` pendant que ce
  rebuild était encore en vol.
- `decor-editor-bridge.ts` suspend l'écriture de preview (`mountHandle.setPreviewSuspended(true)` —
  pas `controller.detach()`, qui réinitialiserait le panneau actif et les toggles pour un simple
  play/pause).

À la sortie (`playbackActiveChanged: {active: false}`, émis par `exit`) :
- `decor-editor-bridge.ts` resynchronise sur la sélection courante (`syncSelection`) puis lève la
  suspension (`setPreviewSuspended(false)`) — une seule écriture, déjà à jour.
- Rien côté `scene-player-bridge.ts` — aucun rebuild n'est nécessaire pour sortir de lecture, le
  player reste où `telco` l'a laissé.

Coordination par états/events émis partout, jamais par callback/promise entre les deux ponts — même
patron que `sceneCommitted`/`sceneReverted` déjà dans le code.

## Changements de code (implémentés)

- `controller/types.ts` — nouveaux events `TELCO_PAUSE_REQUEST` et émis `playbackActiveChanged`.
- `controller-machine.ts` — état `playing` (`entry`/`exit` émettent `playbackActiveChanged`),
  `TELCO_ACTION_REQUEST` cible `.playing`, `playing.on` gère `TELCO_PAUSE_REQUEST`/`SEEK`.
- `decor-editor/mount.ts` — `DecorEditorMountHandle.setPreviewSuspended(suspended)` : gèle/reprend
  `applyToAllAttachedNodes()` sans toucher `decorEditorMachine`.
- `decor-editor-bridge.ts` — réagit à `playbackActiveChanged`.
- `scene-player-bridge.ts` — réagit à `playbackActiveChanged` (rebuild + reprise du `play()`).
- `sequence-editor/mount.ts` — `onTelcoPauseRequest` (nouvelle option), appelé dans `onPlayClick`
  (branche pause) et dans `syncFromTelco` (pause automatique en fin de scène).
- `sequence-editor-bridge.ts` — câble `onTelcoPauseRequest` vers `TELCO_PAUSE_REQUEST`.

## Tests

- `tests/controller/controller-machine.spec.ts` — entrée/sortie de `playing` (`TELCO_ACTION_REQUEST`,
  `TELCO_PAUSE_REQUEST`, `SEEK` depuis `playing` et depuis `idle`), flush toujours émis, sélection
  toujours possible pendant la lecture.
- `tests/decor-editor-bridge.spec.ts` — aucune écriture sur un node remonté (rebuild simulé) pendant
  que `playing` tient ; reprise de la preview sur le node courant à `TELCO_PAUSE_REQUEST` et à
  `SEEK` ; Échap pendant la lecture ne committe rien et ne lève pas.
- 448 tests verts, `tsc --noEmit` propre.

## Validation en direct (2026-07-18)

Cycle complet Play→Pause→Stop→Play reproduit dans l'app réelle (scène à 2 kf de couleurs
différentes, kf2 sélectionné) : la couleur démarre au rouge (kf1) et s'anime en douceur vers le
bleu (kf2), sans jamais se figer, quel que soit le kf sélectionné avant Play. Pause fige la
position réelle et réaffiche la couleur du kf sélectionné dans dedit (comportement actuel attendu —
lecture interpolée au playhead = chantier 2, hors périmètre ici).

**Statut : implémenté et validé.**
