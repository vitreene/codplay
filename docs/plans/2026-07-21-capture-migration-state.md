# État — migration canal capture (clavier + pointeur)

Document de reprise, pour continuer depuis un autre poste. Rien ici n'est
committé (voir `git status` en fin de document) : ce sont des modifications
locales non commitées sur la branche `ed2`.

## Fait et validé fonctionnellement

1. **Canal capture réécrit de fond en comble** — `capture-session.ts`/
   `capture-substitution.ts` (ancien mécanisme `EmitCapture`) entièrement
   retirés, remplacés par `capture-types.ts`/`capture-runtime.ts`
   (`CaptureDeclaration`/`initCaptureState`/`trackCommand`/`endEmit`/
   `endCapture`), conforme à `docs/formalisation/v1-capture-spec.md`.
2. **`stateScope: 'scene' | 'story'`** ajouté au contrat capture — corrige le
   fait qu'`initCaptureState`/`endCapture` ne pouvaient lire que le state de
   la story hôte, jamais `scene.state` (nécessaire pour `space-bubbles`, dont
   tout le state du jeu vit en `scene.state`).
3. **`updateState`** ajouté à `CaptureTrackOutput` — permet à `trackCommand`
   de fusionner une mutation dans `state` à chaque frame (jamais matérialisé,
   jamais rejoué au seek), pour qu'un autre strap lise une valeur à jour
   pendant qu'une capture est encore active (ex: tirer pendant un
   déplacement clavier maintenu).
4. **Canal `CaptureUpdate`** (nouveau, parallèle au circuit `TransitionRequest`
   existant) — corrige un vrai défaut de performance : le canal capture
   appliquait chaque frame via `enqueueCommit`/`deriveSimpleTransitions`, qui
   crée une transition anime.js (`animate()`) neuve à chaque appel. À haute
   fréquence (~60/s), ça crée des dizaines de transitions concurrentes sur la
   même propriété, saturant anime.js et gelant les autres animations en
   cours. Fix : `AnimationAdapter.applyCaptureUpdate`/`releaseCaptureUpdate`,
   pont vers `createAnimatable` d'anime.js (une seule instance persistante
   par target/propriété, réutilisée à chaque frame). Voir
   `2026-07-21-capture-animatable-channel-plan.md` (même dossier) pour le
   plan détaillé. Le nom `CaptureUpdate` et le contrat restent volontairement
   agnostiques d'anime.js — un remplacement futur par une lib maison est
   envisagé.
5. **`deriveSimpleTransitions` corrigé** — une valeur `style` numérique/string
   brute (`style: { x: 690 }`) n'implique plus jamais une transition anime.js
   de 900ms par défaut (comportement caché retiré : la lib n'invente jamais
   une intention non exprimée par l'auteur).
6. **`TransitionEase` étendu** — accepte désormais `string | { type: 'physics',
   velocity?, mass?, stiffness?, damping?, bounce? }`, traduit vers `Spring`
   d'anime.js uniquement dans `adapter.ts`/`create-default-adapter.ts` (jamais
   nommé au-dessus). Documenté dans `v1-perso-spec.md` (règle 5, section
   Actions). Utilisé pour l'inertie de fin de drag clavier du turret
   (glissement/décélération sans rebond, `bounce: 0`).
7. **Bug `endEmit` mal routé** corrigé — `capture-runtime.ts::onEnd` émettait
   `endEmit` sans `ms`, ce qui le faisait passer à tort par
   `applyLiveSceneEvent` (l'heuristique `isLiveTracking` de `player.ts` teste
   `source === 'system' && ms === undefined`) — ce chemin ignore silencieusement
   `chunk.events` d'un strap déclenché (`liveOnly: true`). Fix : `ms: nowMs`
   ajouté à l'émission d'`endEmit`.

## Démos migrées vers le nouveau contrat

- **`space-bubbles` (clavier, turret)** — validé fonctionnel : position
  conservée entre deux appuis, pas de gel des autres animations, tir pendant
  un déplacement maintenu voit la position à jour (`updateState`), glissement
  de fin d'appui (inertie via `TransitionEase: physics`, dépassement léger
  puis arrêt, jamais d'amorti si le bord est atteint).
- **`space-bubbles` (pointeur, drag turret)** — **non touché, à la demande
  explicite de l'utilisateur** ("pas de pointeur dans space-bubbles, ancien
  ou nouveau"). Reste sur l'ancien mécanisme (`event`/`endEvent`/`duration`/
  `snapAt`) dans `space-bubbles-scene.ts` (~ligne 420) et les straps
  `turretDragStartStrap`/`turretDragStrap`/`turretDragEndStrap` dans
  `space-bubbles-straps.ts`. Ne pas y toucher sauf nouvelle demande explicite.
- **`s5-drag-scene.ts`** — migré, validé fonctionnel par l'utilisateur.
  `position: absolute` retiré (interdit dans codplay), remplacé par
  `style.x/y` (transform, via `CaptureUpdate`). `endEmit` + `endCapture`
  tous deux déclarés (pattern validé : `endEmit` en direct pour le settle du
  state, `endCapture.events` persist-only pour la reconstruction visuelle au
  seek avec `style.{from,to}`).
- **`s6-dnd-list-scene.ts`** — migré, validé "fonctionnel pour l'essentiel"
  par l'utilisateur (2026-07-21). Point important corrigé en cours de route :
  `actionName` du tracking doit être **par item**
  (`item:drag:tracking:${itemId}`), jamais un nom partagé entre tous les
  items — sinon `v1-capture-spec.md` règle 5 route le `CaptureAction` vers
  *tous* les persos déclarant ce nom dans `actions`, faisant bouger tous les
  items ensemble (bug observé et corrigé cette session). L'utilisateur a
  signalé des soucis annexes propres au **composant lui-même** (pas au canal
  capture) — non traités, il y reviendra séparément.

## Restant à faire

1. **`quiz-hunt/stories/extra-story.ts`** — dernière démo utilisant l'ancien
   contrat capture (pointeur). Exception ponctuelle déjà accordée en début de
   session pour y toucher, strictement limitée à la déclaration `capture` de
   ce fichier — ne jamais toucher aux fichiers partagés de quiz-hunt
   (`quiz-question-scene.ts` etc., interdiction stricte déjà actée
   antérieurement, voir mémoire `feedback-no-touch-quiz-hunt`).
2. **Nettoyage du code précédent**, explicitement demandé par l'utilisateur
   pour *après* validation complète de tous les tests (clavier + pointeur) :
   - `DirectorCore.reserveCommitSeq()` (`director/create-director.ts`,
     `director/types.ts`) — ajouté en tout début de session pour l'ancien
     chemin `enqueueCommit` du canal capture ; plus appelé nulle part depuis
     le passage au canal `CaptureUpdate`. Vérifier avant de retirer si un
     autre appelant existe.
   - Repasser sur tous les fichiers touchés cette session pour vérifier
     qu'aucun log `[DEBUG ...]` résiduel n'a été oublié (a priori tous
     retirés, mais à revérifier une dernière fois avant de considérer le
     chantier clos).
   - Vérifier si `capture-runtime.ts`/`create-player.ts` gardent des branches
     ou imports devenus inutiles après toutes les itérations de cette
     session.
3. **Chantier séparé, pas commencé** : mécanisme de SFX courts (Web Audio
   API/`AudioBuffer` pré-décodé) — identifié en voulant sonoriser le "bump"
   du canon contre les bords. N'existe pas du tout dans codplay aujourd'hui
   (voir mémoire `project-sfx-short-clips-mechanism`). Explicitement mis de
   côté, pas dans le périmètre de cette migration.

## Fichiers modifiés (non commités)

```
 M docs/formalisation/v1-capture-spec.md
 M docs/formalisation/v1-perso-spec.md
 M packages/codplay/src/animation/adapter.ts
 M packages/codplay/src/animation/create-default-adapter.ts
 M packages/codplay/src/animation/derive-simple.ts
 M packages/codplay/src/animation/types.ts
 M packages/codplay/src/player/create-player.ts
 M packages/codplay/src/renderer/create-renderer.ts
 M packages/codplay/src/runtime/capture-runtime.ts
 M packages/codplay/src/runtime/capture-types.ts
 M packages/codplay/src/runtime/components/lib/dom-component-adapter.ts
 M packages/codplay/src/runtime/components/lib/dom.ts
 M packages/codplay/src/runtime/create-element.ts
 M packages/demos/src/scenes/s5-drag-scene.ts
 M packages/demos/src/scenes/s6-dnd-list-scene.ts
 M packages/demos/src/scenes/space-bubbles/space-bubbles-render-events.ts
 M packages/demos/src/scenes/space-bubbles/space-bubbles-straps.ts
?? docs/plans/2026-07-21-capture-animatable-channel-plan.md
?? docs/plans/2026-07-21-capture-migration-state.md (ce fichier)
```

`renderer/types.ts` (`getSceneState`/`applyCaptureUpdate`/`releaseCaptureUpdate`
sur `CreateRendererOptions`/`AnimationAdapter`) et `player.ts` (aucune
modification en attente) sont déjà committés dans l'historique de la branche
`ed2` — pas dans ce diff.

Tests : 315/315 passent (`npm run test` depuis `packages/codplay`),
compilation propre (`npx tsc --noEmit -p packages/demos`) hors résidus
préexistants sans rapport (`avatar-poc-scene.ts`, `ed2-builder-scene.ts`,
`run-player-scene-demo.ts`, `extra-story.ts` — ce dernier faisant justement
partie du point 1 ci-dessus).

## Prochaine étape suggérée à la reprise

Migrer `extra-story.ts` (quiz-hunt), en suivant strictement le même
raisonnement que pour `s6-dnd-list-scene.ts` : lire `v1-capture-spec.md` en
entier avant d'écrire quoi que ce soit (ne pas deviner), vérifier si
plusieurs éléments partagent un `actionName` (risque de mouvement groupé déjà
rencontré), et respecter le périmètre d'exception déjà accordé (uniquement la
déclaration `capture`, jamais les fichiers partagés de quiz-hunt).
