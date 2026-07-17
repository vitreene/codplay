# ed2 — Commande telco : adopter `TelcoApi`, retirer la simulation du sequence-editor

**Réécriture complète** (pas un patch de la version précédente — celle-ci partait d'une prémisse
fausse : que codplay n'avait rien d'utilisable et qu'il fallait construire un canal de bout en bout).
Vérifié après relecture : **codplay possède déjà une façade telco complète, testée, exportée**, et un
composant de référence qui la consomme correctement. Rien à ajouter à `packages/codplay`.

## 0. Ce qui existait déjà et que la version précédente de ce plan n'avait pas cherché

- `packages/codplay/src/telco/{types,create-telco}.ts` — `TelcoApi` : `play`/`pause`/`togglePlay`/
  `seek`/`rewind`/`setRate`, `getState()`, `commandInFlight` (garde de commandes concurrentes),
  `onChange` (transitions de statut) **et** `onProgress` (position résolue, un tick par frame,
  **seulement pendant `status === 'playing'`**, source de tick injectée — jamais un rAF que
  l'appelant doit fournir ou dupliquer).
- `CodPlay` (`creator/creator-facade.ts:16-22`) construit `this.telco = createTelco(this.player,
  { subscribeOnTick: createRafTickSubscriber })` **dans son constructeur** — `studio.telco` existe
  dès `new CodPlay({})`, avant même le premier chargement de scène. `scene-player-bridge.ts` détient
  déjà `studio` : `studio.telco` est accessible **immédiatement, sans rien construire**.
- `packages/authoring/remote/src/demo-remote.ts` (`createDemoRemote`) — composant DOM de référence,
  déjà correct : bouton play/pause (`togglePlay`), rewind, curseur de seek avec pause-au-pointerdown-
  si-lecture-en-cours, seek throttlé pendant le drag (`SEEK_THROTTLE_MS = 90`), commit au `change`,
  boutons de vitesse. Directement inspirable (voire adaptable) pour l'UI ed2 — le motif d'interaction
  (limiter les seeks pendant un drag, distinguer `onChange`/`onProgress`) n'est pas à réinventer.

**Conséquence directe** : aucune extension d'`AuthorApi`, aucun nouvel événement `PLAYBACK_*` sur le
contrôleur central, aucun mécanisme de resynchronisation après pause — tout ce que la version
précédente de ce plan proposait de construire existe déjà, fait, testé, dans `packages/codplay`.
`packages/codplay` **n'est pas touché** par ce chantier.

## 1. Ce qui se retire réellement (fonctionnalité redondante, au sens plein cette fois)

- **`sequence-editor`'s propre simulation de lecture** — `mount.ts::rafLoop` (son `requestAnimationFrame`
  propre), `ctrl.tick()`/`PLAYHEAD.TICK` (accumulation locale de `deltaMs`), la logique
  play/pause/stop du contrôleur qui ne faisait QUE poser un drapeau local. Tout ce mécanisme
  disparaît — remplacé par une réception directe des snapshots `telco.onChange`/`telco.onProgress`.
- **Le forwarding `SEEK` pendant la lecture** disparaît de lui-même : plus aucun tick local ne
  le déclenche, puisque `playheadMs` n'est plus accumulé localement pendant la lecture — il est reçu
  tel quel depuis `telco.onProgress`.

**Ne se retire PAS** (arbitrage auteur, 2026-07-17) : les boutons Play/Pause/Stop et l'affichage du
temps **restent à leur emplacement visuel actuel**, dans la barre d'outils du sequence-editor — pas de
nouvelle zone de télécommande dans `.app-region--telco` (réservée, toujours vide). Seul leur câblage
change (§3, étapes B-C) : mêmes boutons, mêmes glyphes, même position, mais ils appellent
`telco.play()`/`.pause()`/`.seek(0)` au lieu de piloter une simulation locale. Une UI telco séparée
sera reconsidérée plus tard si l'usage le réclame (ex. si un panneau de lecture doit exister
indépendamment du sequence-editor) — pas construite par anticipation.

## 2. Architecture cible

```
studio (CodPlay, déjà construit dans scene-player-bridge.ts)
  └─ studio.telco (TelcoApi, déjà là — rien à construire)
       │  publié une fois, comme authorApi (context.telco, PLAYER_READY étendu)
       ▼
   sequence-editor (mêmes boutons Play/Pause/Stop/temps, même emplacement,
   même barre d'outils + curseur/scrub sur sa timeline zoomée) :
   - telco.onProgress/onChange → curseur + glyphe (mirror direct, aucune accumulation)
   - clic Play/Pause/Stop → telco.play()/.pause()/.seek(0) directement
   - son propre scrub (drag sur le ruler zoomé) → telco.seek(ms)
   - plus de rafLoop, plus de PLAYHEAD.TICK

   (CS : déjà câblé cette session via authorApi.subscribeToPlayerState — À REVOIR, voir §5)
```

`context.telco: TelcoApi | null`, publié une fois (comme `context.authorApi`) — chaque bridge qui en
a besoin l'appelle **directement** (`context.telco.play()`, etc.), pas de round-trip par de nouveaux
événements `PLAYBACK_*` sur le contrôleur central : `TelcoApi` est déjà la façade sûre
(`commandInFlight` sérialise déjà les commandes concurrentes) — ajouter un relais d'événements
par-dessus serait dupliquer ce que la façade fait déjà.

## 3. Étapes

### Étape A — Publier `context.telco`, et une référence locale dans `scene-player-bridge.ts`

`app/controller/types.ts` : `ControllerContext.telco: TelcoApi | null`. `PLAYER_READY` (event déjà
existant) gagne un champ `telco: TelcoApi` — même moment de publication qu'`authorApi`
(`scene-player-bridge.ts`, déjà là où `isFirstReady` envoie `PLAYER_READY`), même si `studio.telco`
existe en réalité plus tôt (dès la construction de `studio`) : publier au même instant qu'`authorApi`
évite un second signal de disponibilité, différence négligeable (quelques centaines de ms avant le
premier chargement, aucun bridge n'a besoin de `telco` avant ce point). `scene-player-bridge.ts` garde
en plus sa **propre** référence locale (`const telco = studio.telco`, posée dès la construction de
`studio` — disponible immédiatement, avant même `isFirstReady`, puisque `studio.telco` existe dès
`new CodPlay({})`) : c'est CETTE référence que son propre handler `seek` utilise (étape E), pas un
aller-retour par `context.telco`.

### Étape A bis — Disponibilité tardive de `telco` côté sequence-editor : ne pas répéter le bug de `mount.ts` (dedit)

**Point de vigilance directement issu d'un bug corrigé plus tôt cette session** (`decor-editor/
mount.ts` : abonnement `subscribeToNode` posé une seule fois, avant qu'aucun item ne soit attaché —
jamais réétabli, preview live morte depuis toujours). `context.telco` n'est PAS disponible à la
construction du sequence-editor (publié seulement après le premier rebuild réussi, comme
`authorApi`) — si `mountSequenceEditor` reçoit `telco` comme une simple valeur figée au moment de
l'appel, les abonnements de l'étape D ne seraient JAMAIS posés (construits avant que `telco` existe),
et les boutons Play/Pause resteraient inertes pour toujours, exactement comme la preview décor l'était.

**Corrigé par conception, pas par patch** : `mountSequenceEditor` ne prend pas `telco` en paramètre
direct. Son handle de retour gagne une méthode `attachTelco(telco: TelcoApi): void`, appelée par
`sequence-editor-bridge.ts` une fois que `context.telco` devient réellement disponible (même
événement `authorApiReady` étendu qui porte déjà `authorApi`/`referenceWidthPx`/`offsetBridge` — pas un
second signal à inventer). En interne, `mount.ts` garde `let telco: TelcoApi | null = null` (variable
de fermeture mutable, pas un paramètre figé) ; `attachTelco` l'assigne et pose les abonnements de
l'étape D à CE moment-là. `onPlayClick`/`onStopClick` (étape B) lisent cette même variable de
fermeture — toujours la valeur COURANTE, jamais une copie capturée à la construction.

### Étape B — Rebrancher les boutons existants sur `telco`, sans les déplacer

`sequence-editor/mount.ts`, `onPlayClick`/`onStopClick` (lignes 418-431) : mêmes boutons, même
position dans la barre d'outils, nouveau corps :
```typescript
function onPlayClick(): void {
  if (!telco) return  // `telco` = la variable de fermeture de l'étape A bis, pas un paramètre figé
  void (telco.getState().status === 'playing' ? telco.pause() : telco.play())
}
function onStopClick(): void {
  // Stop = seek(0), PAS un appel direct à telco ici — voir §3 bis, ce chemin doit rester le même
  // relais central que le scrub, pour les mêmes raisons (flush décor, lastSeekMs, resync CS).
  options.onPlayheadChange?.(0)
}
```
`sequence-editor-bridge.ts` fournit `attachTelco` (étape A bis), pas un nouveau bridge séparé.
Play/Pause seuls (sans seek) n'ont aujourd'hui aucun consommateur central établi — appel direct
légitime, pas de relais nécessaire (cf. §3 bis pour la question ouverte que ça soulève quand même).

### Étape C — Sequence-editor : retirer la simulation, garder la vue

`sequence-editor/mount.ts` :
- Retrait de `rafLoop`, `prevTs`/`rafHandle` — plus rien ne les alimente.
- `sequence-editor/machine.ts` : `PLAYHEAD.TICK`/`PLAYHEAD.START_PLAY`/`PLAYHEAD.PAUSE`/
  `PLAYHEAD.STOP` retirés (plus rien ne les déclenche). `PLAYHEAD.SET` **reste** (scrub manuel,
  navigation par keyframe) — c'est le seul point d'écriture de `playheadMs` qui subsiste côté
  machine ; un second point d'écriture s'ajoute (étape D) pour le mirroring depuis `telco`.
- **`isPlaying` retiré du contexte** (vérifié — tous ses usages disparaissent avec ce retrait ou
  l'étape B : `rafLoop`/`PLAYHEAD.TICK`'s garde, `onPlayClick` lit déjà `telco.getState().status`
  directement depuis l'étape B). Le seul survivant potentiel — le glyphe ▶/⏸ du bouton — ne
  justifie pas de garder cette valeur dans le contexte XState : ce serait maintenir une copie locale
  d'une donnée que `telco` fournit déjà de façon synchrone, exactement l'écueil que ce chantier existe
  pour éliminer. `SequenceEditorController.isPlaying()` (méthode publique) devient sans appelant,
  retirée.
- `playheadMs` reste dans le contexte (toujours « purement local », mais reçu — jamais calculé) : sa
  raison de rester est différente de celle d'`isPlaying` — il interagit avec `ctx.viewport` (zoom/pan,
  déjà dans le contexte) pour calculer la position en pixels du curseur ; le sortir du contexte
  forcerait `render()` à combiner deux sources (contexte + abonnement direct) pour une seule valeur
  dérivée, plus confus que de le garder au même endroit que ce dont il dépend pour son rendu.

### Étape D — Le curseur du sequence-editor devient un miroir direct de `telco` ; le glyphe, un abonnement direct

Vit dans `sequence-editor/mount.ts`, **à l'intérieur de `attachTelco`** (étape A bis) — pas au niveau
supérieur de `mountSequenceEditor`, précisément parce que `telco` n'existe pas encore à ce moment-là.
Posé une seule fois, quand `attachTelco` est réellement appelé (donc `telco` y est garanti non-null,
aucun `?.` nécessaire à l'intérieur) :

```typescript
function attachTelco(t: TelcoApi): void {
  telco = t // assigne la variable de fermeture lue par onPlayClick/onStopClick (étape B)

  // Glyphe play/pause — indépendant du cycle de rendu XState, aucune valeur mirée dans le contexte.
  telco.onChange((state) => {
    setButtonGlyph(btnPlay, state.status === 'playing' ? '⏸' : '▶')
  })

  // Curseur/temps — la seule valeur qui reste mirée dans le contexte (raison : étape C).
  function syncFromTelco(state: PlayerStateSnapshot): void {
    // Marqué AVANT la transition, pas après — `render()` s'exécute SYNCHRONEMENT dans le même appel
    // (abonnement XState v5), son propre test de diff (`ctx.playheadMs !== lastPlayheadMs`, existant,
    // §Étape C) doit déjà voir cette valeur comme connue au moment où il tourne. Sans ce marquage
    // préalable, chaque mise à jour reçue DE `telco` serait relue par `render()` comme un scrub
    // utilisateur et renvoyée en `SEEK` — un seek vers la position où `telco` est déjà, en boucle avec
    // sa propre notification `onChange` suivante.
    lastPlayheadMs = state.timelineMs
    controller.syncPlayheadFromTelco(state.timelineMs)
  }
  telco.onProgress(syncFromTelco)
  telco.onChange(syncFromTelco)
}
```
`telco` (assigné en tête d'`attachTelco`) est la même variable de fermeture que lit `onPlayClick`/
`onStopClick` (étape B) — un seul point d'assignation, cohérent avec le fait que `studio.telco` ne
change jamais d'instance à travers les rebuilds (comme `studio.player`).
`SequenceEditorController.syncPlayheadFromTelco(timelineMs: number): void` → nouvelle transition
machine `TELCO.SYNC_PLAYHEAD` : `assign({ playheadMs: timelineMs })` — une seule ligne d'assignation,
aucune accumulation, donc aucune dérive possible par construction (contrairement à la version
précédente de ce plan, qui devait inventer un mécanisme de resynchronisation après coup pour corriger
une dérive que ce mirroring direct n'introduit jamais). `lastPlayheadMs` est aujourd'hui une variable
de fermeture interne à `render()` (`mount.ts`) — l'exposer à ce niveau (au lieu d'un simple retour de
fonction) est le seul ajustement structurel que cette coordination demande.

### Étape E — Le scrub du sequence-editor : **inchangé**, toujours `machine.send({type:'SEEK'})`

**Corrigé après vérification (§3 bis)** : contrairement à une version antérieure de cette étape,
`onPlayheadChange` (le callback fourni à `mountSequenceEditor`, scrub manuel + navigation par kf)
**reste** ce qu'il est aujourd'hui — il envoie `machine.send({type:'SEEK', timelineMs})`, jamais un
appel direct à `telco.seek()`. Ce qui change, c'est uniquement le CORPS du handler central existant :

```typescript
// scene-player-bridge.ts — inchangé structurellement, seul le corps de l'action change
const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
  lastSeekMs = timelineMs
  if (!telco) return
  void telco.seek(timelineMs + lastPreRollMs).then(() => frame?.sync())
})
```
« Accès via façade » est respecté (l'exécution réelle passe par `telco`, jamais
`studio.player.seek()` en direct) **sans** court-circuiter le point d'écoute central dont dépendent
déjà trois mécanismes construits cette session (§3 bis). Stop (§3 étape B) redevient lui aussi un
simple `SEEK` vers `0` — `PlayerFacade.seek()`/`telco.seek()` s'auto-pause déjà si le statut est
`'playing'` avant de déplacer la tête (vérifié en session précédente), aucun `telco.pause()` explicite
n'est donc nécessaire avant le seek.

## 3 bis. Vérification — impact sur le processus d'édition construit cette session

Demandé explicitement avant d'aller plus loin. Trois mécanismes déjà construits dépendent de l'event
central `seek` (`machine.on('seek', ...)`, émis par `emitSeek` sur réception de `SEEK`) :

1. **`decor-editor-bridge.ts`, signal 3 du commit de fin de phase** — `machine.on('seek', () =>
   flushNow())` : un edit décor en attente se committe avant qu'un seek ne change la position affichée.
2. **`scene-player-bridge.ts`, suivi de `lastSeekMs`** — position reprise au prochain rebuild
   (`await studio.player.seek({timelineMs: lastSeekMs + preRollMs})`, dans `rebuild()`).
3. **`scene-player-bridge.ts`, `frame?.sync()`** — resynchronisation du CS après un seek (fix de
   cette session même, réponse à « le CS doit se mettre à jour sur la position intermédiaire »).

Une première version de ce plan (étape E) faisait appeler `telco.seek()` **directement** depuis le
sequence-editor pour le scrub, et `onStopClick` appelait `telco.seek(0)` directement aussi — les DEUX
contournaient l'event central `seek`, cassant silencieusement les trois mécanismes ci-dessus (un edit
décor en attente resterait non committé après un scrub ; `lastSeekMs` deviendrait périmé, ramenant
visuellement la tête de lecture en arrière au prochain commit ; le CS cesserait de suivre un scrub
manuel — la régression exacte que cette session vient de corriger). **Corrigé** (§3, étapes B/E
ci-dessus) : le relais central `SEEK`/`seek` reste le seul chemin d'exécution réelle, pour le scrub
COMME pour Stop — seul son exécuteur final change d'implémentation (`telco.seek()` au lieu de
`studio.player.seek()`), les trois mécanismes en aval restent branchés au même point, inchangés.

Play/Pause seuls (sans seek), en revanche, n'ont aujourd'hui **aucun** mécanisme construit qui les
observe centralement — le CS-désactivé-pendant-lecture (§5) observe `telco.onChange` directement,
pas l'event central. Appel direct légitime pour ces deux commandes. Question ouverte, non tranchée
ici : démarrer la lecture devrait-il, comme un seek, committer un edit décor en attente (signal 3
étendu) ? Aucun des signaux de fin de phase déjà actés (`2026-07-17-phase-commit-selection-recovery-
plan.md` §Étape B) ne couvre ce cas — à trancher séparément, pas dans ce chantier, pas une omission
silencieuse : signalé ici pour que ce soit une décision explicite le moment venu.

## 4. Ce qui ne bouge pas

- `packages/codplay` — rien, confirmé §0.
- Le zoom, l'unité de temps, le mode suivi, le zoom sur clip/effacer clip — restent dans le
  sequence-editor, propres à sa vue.
- La navigation par keyframe (double-clic, `PLAYHEAD.SET` via sélection de kf) — inchangée.
- Le pont de réconciliation offset/décor (chantiers précédents) — non concerné.
- L'emplacement visuel des boutons de transport — inchangé (§1).

## 4 bis. Hors scope de ce chantier — signalé pour ne pas être perdu (arbitrage auteur, 2026-07-17)

Deux points nécessaires plus tard, explicitement **pas traités ici** :

- **Vitesse de lecture (`rate`)** — `TelcoApi.setRate`/`.rate` existent déjà (utilisés par
  `createDemoRemote` : boutons x1/x2/x¼) mais rien dans la barre d'outils actuelle du sequence-editor
  ne les expose. Un contrôle de vitesse est à ajouter à un chantier futur, une fois le transport de
  base validé.
- **Lecture d'un segment (play range in/out)** — `SequenceEditorController.setPlayRange(inMs, outMs)`/
  `context.playRange` existent déjà côté sequence-editor ; le point d'arrêt (`outMs`) était calculé
  par la boucle locale retirée dans ce chantier (`PLAYHEAD.TICK`'s garde `playheadMs + deltaMs >=
  stopMs`). `TelcoApi` n'a pas de notion native de « jouer jusqu'à X » — `play()` lit jusqu'à la fin
  naturelle de la scène. Reconduite nécessaire : seek sur `inMs` avant `telco.play()`, puis observer
  `telco.onProgress` et appeler `telco.pause()` dès que `timelineMs >= outMs` est franchi — mécanisme
  simple (un comparateur sur le flux déjà consommé), mais un ajout réel, pas un acquis de `telco` tel
  quel. À câbler quand la feature de lecture de segment sera reprise, pas dans ce chantier — noté ici
  pour que ce ne soit pas oublié au moment venu.

  **Optimisation pressentie (auteur, 2026-07-17), à concevoir le moment venu, pas maintenant** :
  rejouer plusieurs fois le même segment (cas d'usage courant en édition — ajuster puis prévisualiser
  en boucle) refait aujourd'hui un `seek(inMs)` complet à chaque lecture, alors que l'état résolu au
  point `inMs` est identique tant que le document n'a pas changé — un `seek` n'est pas une opération
  légère (§ constat de `2026-07-17-real-playback-engine-plan.md` §1). Piste : mettre en cache l'état
  résolu au démarrage du segment plutôt que de le recalculer à chaque relecture, invalidé quand le
  document change (`PlayerStateSnapshot.runtimeRevision`, déjà présent dans le snapshot, est le
  candidat naturel comme clé d'invalidation — un changement de révision signifie que l'état mis en
  cache n'est plus valide). Reste à trancher à ce moment-là : la mise en cache vit-elle côté `codplay`
  (bénéficie à tout appelant faisant des seeks répétés vers le même point, pas seulement ed2) ou
  seulement côté consommateur ed2 (ne rejoue `telco.seek(inMs)` que si `runtimeRevision` a changé
  depuis la dernière fois) — les deux respectent la frontière façade, le choix dépendra de qui d'autre
  a besoin de ce même gain à ce moment-là.

## 5. Point à revoir — le fix CS-désactivé-pendant-lecture déjà câblé cette session

`scene-player-bridge.ts` utilise aujourd'hui `authorApi.subscribeToPlayerState` (ajouté avant ce
chantier) pour `setPartActive('cs', !isPlaying)`. Une fois `context.telco` publié, `context.telco.
onChange` est la source plus riche et déjà testée (snapshot complet, pas seulement `isPlaying`) — à
**basculer sur `telco.onChange`** dans le même geste que ce chantier, pour n'avoir qu'un seul chemin
d'observation du statut de lecture dans tout ed2. `AuthorApi.subscribeToPlayerState` peut alors soit
rester (encore utile si un module a besoin de ne connaître QUE isPlaying sans dépendre de tout
`TelcoApi`), soit être retiré s'il devient un doublon pur — à trancher en cours d'implémentation selon
si un autre consommateur apparaît.

## 6. Tests

- `tests/sequence-editor/controller.spec.ts` : `syncPlayheadFromTelco(timelineMs)` pose
  `context.playheadMs = timelineMs`, rien d'autre (`isPlaying` n'existe plus dans ce contexte) ;
  aucune accumulation, un appel = un résultat exact.
- `tests/sequence-editor/mount.spec.ts` (ou nouveau) : plus de `rafLoop`/`prevTs`/`rafHandle` — les
  boutons play/pause/stop restent présents, au même endroit ; **avant `attachTelco`**, cliquer Play ne
  fait rien (pas d'erreur, `telco` encore `null`) — non-régression directe du bug §Étape A bis ;
  **après `attachTelco`**, le glyphe suit un `telco.onChange` simulé sans passer par le contexte
  XState, et un `telco.onProgress`/`onChange` simulé ne redéclenche pas `onPlayheadChange`
  (non-régression de la boucle identifiée en §3 bis).
- Safari : Play (même bouton, même emplacement) → le curseur du sequence-editor suit visuellement, le
  CS se désactive, aucun `studio.player.seek()` répété (à vérifier via la même instrumentation que la
  session précédente). Scrub sur la timeline du sequence-editor → seek réel, throttlé, pas de rafale.

## 7. Ordre d'exécution proposé

A (publier `context.telco` + référence locale dans `scene-player-bridge.ts`) → A bis (`attachTelco`,
le point d'accroche tardif côté sequence-editor) → D (mirroring curseur + glyphe, câblés à l'intérieur
d'`attachTelco`) → B (rebrancher les boutons existants, lisent la même variable de fermeture) → C
(retrait effectif de la simulation, une fois A bis/B/D validés, pour ne jamais être sans aucun moyen
de piloter la lecture pendant la transition) → E (le handler `seek` de `scene-player-bridge.ts`
bascule sur `telco.seek` — aucun changement visible pour les consommateurs de l'event central) → §5
(bascule CS sur `telco.onChange`) → tests → nettoyage final (vérifier qu'aucun résidu de
`PLAYHEAD.TICK`/rafLoop ne traîne).

---

**Ce plan est soumis pour relecture avant toute implémentation — aucun code n'a été touché pour
l'écrire.**

## 8. Statut d'implémentation (2026-07-17)

Toutes les étapes A/A bis/B/C/D/E/§5 implémentées, dans l'ordre prescrit par §7. `tsc --noEmit`
propre, suite complète (1045 tests) + gates verts. Validé en Safari en conditions réelles (scène de
démo + item créé, vraie sélection via `.seq-label-row`, pas seulement un mock) : Play/Pause/Stop au
même emplacement, glyphe piloté par `telco.onChange`, curseur miroir de `telco.onProgress` sans
boucle de seek, CS (`pointerEvents`) bascule `auto`↔`none` avec la lecture réelle, scrub sur la
règle toujours fonctionnel (relais central `SEEK` inchangé), aucune erreur console. §5 tranché :
`AuthorApi.subscribeToPlayerState` reste dans `@codplay/selection-frame` (facade partagée, contrat de
type encore utilisé par les fixtures de test du package et par `offset-editor-bridge.spec.ts`/
`decor-editor-bridge.spec.ts` — retirer un champ d'une facade partagée dépasse le périmètre de ce
chantier, propre au seul sequence-editor).

**Écart suivi (2026-07-17, corrigé)** : `followPlayhead` rebranché directement dans `attachTelco`'s
`syncFromTelco` (`mount.ts`) — `on peut subscribre followPlayhead à telco` (direction auteur) : plus
simple que redouté, aucun risque de boucle puisque ce point d'observation est indépendant de la garde
anti-boucle `lastPlayheadMs` (qui ne concerne que `onPlayheadChange`/`SEEK`).

## 9. Bugs remontés après relecture d'ensemble (2026-07-17, « en vrac »)

Cinq points signalés par l'auteur après avoir testé le chantier ci-dessus en conditions réelles.
Diagnostic complet avant tout correctif (lecture de code + tests live Safari, plusieurs faux
positifs écartés en cours de route — voir note méthodologique en fin de section).

1. **Kf sélectionné → playhead** : non reproduit. Un vrai geste (pointerdown sur `.seq-kf` →
   pointerup sur `.seq-drag-overlay`, le chemin réel — `track-row.ts` route via `onDragStart`/
   `DRAG.START_KEYFRAME`, jamais l'event `click`) déplace bien le playhead dans les deux sens, testé
   à répétition. Deux premières tentatives de repro invalidées par des events synthétiques mal formés
   (`click` au lieu de `pointerdown`, puis `pointerup` sur `window` au lieu de `.seq-drag-overlay` —
   la machine restait bloquée en état `dragging-keyframe`, expliquant un faux « ça ne bouge plus »).
   Laissé tel quel — pas de repro exacte fournie à ce stade.

2. **CS ne se désélectionne pas pendant le play — corrigé.** `setPartActive('cs', false)`
   (`@codplay/selection-frame`) ne retirait que `pointerEvents` ; les poignées restaient visibles à
   l'écran (vérifié capture à l'appui). La façade exposait déjà `setPartVisibility('cs', boolean)`
   (jamais câblé côté ed2) — `scene-player-bridge.ts` l'appelle maintenant en plus de
   `setPartActive`, aux deux mêmes points (`telco.onChange` global + état initial d'`attachSelection`).
   Zéro changement dans `@codplay/selection-frame` : la façade avait déjà tout, il manquait juste
   l'appel côté ed2.

3. **Décor « s'applique partout » + 4. Pas de sync apparence/dedit à la création — même cause,
   corrigée.** `DemoMenuRegion.tsx` (« démonstration temporaire de l'étape 2… pas la vraie région
   menu », commentaire d'origine) créait l'item + ses 2 keyframes via `RUN_TRANSACTION` mais
   n'envoyait jamais `SELECT_ITEM` — la sélection centrale restait sur l'item précédent. Comme tout
   item créé partage la même géométrie par défaut (superposition exacte), éditer le décor de l'ancien
   item sélectionné donnait l'illusion visuelle d'un effet global. Vérifié en DOM (`getComputedStyle`
   sur chaque `#item-N`) : avant fix, la couleur posée pendant que dedit affichait « item-8 » atterrissait
   sur `item-1` ; après fix (`controller.send({ type: 'SELECT_ITEM', itemIds: [itemId] })` ajouté juste
   après la transaction), l'infobar affiche immédiatement le bon item et seul lui reçoit la couleur.

5. **Plus de limite par défaut à 5s — régression confirmée de ce chantier, corrigée.** L'ancien garde-fou
   local (`PLAYHEAD.TICK`, retiré §Étape C) stoppait la simulation à `scene.meta.durationMs`
   (`emptyScene.meta.durationMs = 5000` dans `DemoMenuRegion.tsx`). `telco`/le vrai player n'a pas
   d'équivalent actif ici (`sequenceEnded`/`horizon.authorEndMs` dépendent d'un event `sequenceEnd` que
   le Builder n'émet pas forcément pour ces scènes) — sans lecteur, la vraie lecture continuait
   indéfiniment (vérifié : 111s et au-delà). Corrigé côté éditeur (direction choisie plutôt que
   creuser `codplay`) : `attachTelco`'s `syncFromTelco` appelle `telco.pause()` dès que
   `state.timelineMs >= scene.meta.durationMs` pendant une lecture. Revalidé en direct : arrêt net à
   5.0s, glyphe repassé à ▶.

**Note méthodologique** : deux artefacts de test à eux seuls ont produit trois faux diagnostics
avant les vrais : `elem.click(); expr` (deux statements séparés) ne retourne PAS la valeur de `expr`
dans cet outil d'évaluation JS — utiliser un IIFE avec `return` explicite. Un clic sur `rows[0]` d'une
`NodeList` de `.seq-label-row` peut tomber sur la ligne « + piste marqueur » (premier élément du DOM)
et déclencher son `window.prompt()` bloquant, gelant tout appel `evaluate_javascript`/`screenshot`
suivant jusqu'à dismiss — toujours filtrer par contenu exact, jamais indexer à l'aveugle.

## 10. Deux points supplémentaires remontés après relecture des points #1/#3 ci-dessus (2026-07-17)

L'auteur précise que #3/#4 (§9) n'étaient pas son problème d'origine — trouvé au passage, corrigé,
mais distinct. Deux nouveaux points, tous deux confirmés et root-causés par lecture de code :

1. **Playhead : bref aller-retour au clic sur un kf — corrigé.** `PlayerFacade.seek()`
   (`create-player.ts:2178`) appelle `setStatus('seeking')` — donc émet `onChange` — AVANT de mettre
   à jour `this.timelineMs` (ligne 2222) ; un second `setStatus('paused')` à la fin (ligne 2283) émet
   la position correcte. `attachTelco`'s `syncFromTelco` (`mount.ts`) était abonné à `onChange` ET
   `onProgress` (§Étape D d'origine) : le premier événement `onChange` intermédiaire, avec l'ANCIENNE
   position, était remiré dans le contexte — la tête sautait sur le kf cliqué puis revenait en arrière
   avant que le seek ne s'achève. Corrigé : `syncFromTelco` n'est plus abonné qu'à `onProgress`
   (jamais émis pendant un seek — condition `status === 'playing'` côté `telco`), `onChange` reste
   réservé au glyphe play/pause (aucun rapport avec `timelineMs`). Testé : polling 15×30ms après un
   clic de kf, aucune variation. Régression ajoutée (`mount.spec.ts`) simulant l'event `onChange`
   transitoire à la main.

2. **Décor partagé entre keyframes adjacents — corrigé, conforme au spec (pas une invention).**
   Répro exacte de l'auteur : fond posé sur kf1, déplacement à kf2, fond différent posé sur kf2 →
   au lieu d'une interpolation, kf1 change aussi. Cause : quand un nouveau kf est ajouté par
   double-clic sur la timeline (`machine.ts::KEYFRAME.ADD` → `adjacentDecorId()`), son `decorId` est
   celui du kf voisin EXISTANT — kf1 et kf2 référencent littéralement le même objet `Decor`. Éditer
   le décor de kf2 (`setDecor`, mutation par id) modifie donc aussi kf1, et `buildKeyframeDecorActions`
   ne voit aucun diff entre deux décors identiques, donc aucune transition n'est émise.
   **`2026-06-11-sequence-editor-grid-spec.md` §2.3 « Cycle de vie des décors (copy-on-write) »
   documente ce protocole EXACTEMENT** (daté d'avant ce chantier, jamais implémenté) : partage
   délibéré à la création (`addKeyframe` hérite du voisin — évite de dupliquer des décors identiques),
   mais **« à la modification d'un décor (externe) : l'éditeur de décors est responsable de vérifier
   si le decorId courant est partagé. Si oui, il doit créer une nouvelle entrée dans `scene.decors`
   (via `registerDecor`) et appeler `assignDecor` pour lier le keyframe à ce nouvel id, avant
   d'écrire les propriétés »** — une lacune d'implémentation contre un spec déjà tranché, pas une
   ambiguïté de modèle à trancher aujourd'hui.
   Implémenté à la lettre :
   - `registerDecor` (nouvelle commande, `base-commands.ts`) — crée une entrée `{id}` vide, même
     convention que `createKeyframe`/`createNamedKeyframe`.
   - `assignKeyframeDecor` — déjà existant (`sequence-editor/commands.ts:126`), rien à ajouter.
   - `decor-editor-bridge.ts::unsubscribeDecorChange` — avant `setDecor`, si `target.keyframeId` est
     défini et que `target.decorId` est référencé par un AUTRE keyframe de la scène
     (`isDecorSharedByAnotherKeyframe`), fork : `registerDecor` + `assignKeyframeDecor` vers un id
     frais, puis `setDecor` écrit sur ce nouvel id — jamais sur l'original. Portée volontairement
     limitée aux keyframes : `item.initialDecorId` est toujours créé frais par `createItem`, jamais
     partagé par construction.
   Validé en direct (Safari, répro exacte : kf1 rouge → nouveau kf hérite `decor-5` → kf édité en
   bleu → re-sélection de kf1 : toujours `decor-5`, toujours rouge) + régression ajoutée
   (`decor-editor-bridge.spec.ts`, scène à deux keyframes partageant un `decorId`).
