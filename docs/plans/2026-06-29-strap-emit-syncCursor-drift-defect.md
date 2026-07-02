# Défaut corrigé — `syncCursor` pouvait sauter une étape pas encore appliquée hors cycle de lecture programmée

## Statut

Découvert le 2026-06-29 en validant le portage `move:"off"` dans `quiz-hunt` (panneaux trial/final,
suite de `2026-06-28-unify-action-execution-and-move-off-plan.md`). Symptôme rapporté par
l'utilisateur : **« dès le choix de la première question, la question n'apparaît pas, et on reste
bloqué là. En utilisant le seek, elle apparaît bien. »**

Préexistant — indépendant du portage quiz-hunt et des deux défauts déjà cadrés
(`2026-06-28-seek-continuous-engine-overwrite-defect.md`,
`2026-06-29-track-event-insertion-cursor-defect.md`). Un risque déjà identifié et partiellement
gardé dans le code (voir commentaire cité plus bas), mais seulement pour un cas — pas pour celui que
ce portage est le premier à exercer. **Corrigé** — voir « Correction retenue » plus bas. Cadrage
conservé pour l'historique du diagnostic.

## Comment ça a été diagnostiqué

Reproduit fidèlement via la vraie scène `createQuizHuntScene`/`createQuizHuntStraps` (pas un
fixture minimal — un premier essai avec un fixture minimal n'a PAS reproduit le défaut, voir
« Pourquoi un fixture minimal ne le reproduit pas » plus bas), pilotée par `Player` + de vrais
timers (`setTimeout` réel, pas `vi.useFakeTimers()` — les fake timers de vitest n'avancent pas de la
même façon l'horloge interne du player et auraient masqué ou faussé le symptôme). Simulation : clic
sur la première tuile de la grille, puis attente réelle.

Constat confirmé par instrumentation temporaire (entièrement retirée après diagnostic, suite
complète revérifiée verte — 252 tests + gates) :
- Le `move` du panneau s'applique correctement (`trial-bague-panel` attaché à `game:zone:main`).
- L'étape de continuation de son `ActionSequence` (le basculement de classe `is-hidden`→`is-visible`,
  à +20ms) est bien matérialisée dans la track (`appendGeneratedEvents` confirmé, l'event existe à
  l'index attendu).
- Cette étape n'est **jamais** collectée par `TrackManager.collectNextDueEvent` — le curseur de sa
  track (`strap-scene-game-router`) avance malgré tout, jusqu'à dépasser cet index, **sans que
  `runTimelineEvent` n'ait jamais été appelé pour cet event** (confirmé : zéro occurrence tracée).
  Le seul autre point du code qui avance un `nextIndex` sans passer par
  `collectNextDueEvent`/`collectDueEvents` est `TrackManager.syncCursor`
  (`create-track-manager.ts:139-153`) — qui ne fait qu'avancer le curseur par comparaison de `ms`,
  sans jamais livrer l'event sauté à `runTimelineEvent`.

## Le mécanisme

Quand une strap déclenchée par un event utilisateur (ici : le clic sur une tuile, route via
`listen`/`straps`, pas via une track rejouée) retourne plusieurs events immédiats dans le même
`events: [...]`, chacun est routé **séquentiellement, awaité un par un** :

`player.ts:1116` (`executeStrap`) :
```ts
for (const emittedEvent of chunk.events ?? []) {
  ...
  const childResult = await this.routeSceneEvent(emittedEvent, ...)
  ...
}
```

`routeSceneEvent` → `routeMatchingRules` → `emitRuntimeEvent` → **`PlayerFacade.emit()`**
(`create-player.ts:1942`), pour chaque event, l'un après l'autre.

Dans `emit()` (`create-player.ts:1993-2006`), le commentaire documente déjà un risque connu — pour
un cas précis :

```ts
// While a due-events batch is draining, `timelineMs` is the tick's fixed cursor; a
// nested emit triggered from within that drain must compare against it rather than a
// fresh `resolveCurrentTimelineMs()` read, which drifts forward across awaited calls
// and can make `syncCursor` skip not-yet-applied events later in the same batch.
const currentMs = this.drainingDueEvents ? this.timelineMs : this.resolveCurrentTimelineMs();
...
if (!isFutureEvent) {
  this.runTimelineEvent(timelineEvent);
}
if (shouldPersistEvent) {
  if (!isFutureEvent) {
    this.trackManager.syncCursor({ nowMs: isRetroactiveEvent ? currentMs : timelineEvent.ms });
  }
  ...
}
```

`drainingDueEvents` est positionné par `PlayerFacade.runDueTimelineEventsSync`/`runDueTimelineEvents`
— c'est-à-dire **uniquement** pendant le drainage d'un lot d'events dus, déclenché par le ticker de
lecture ou par le rejoué de seek. Un event routé depuis l'exécution d'une strap suite à un **clic
utilisateur** (donc via `listen`/`executeStrap`, pas via `runDueTimelineEvents*`) ne passe jamais par
ce drapeau. Pour chacun des events du même `events:[...]` d'une strap, `currentMs` est donc relu en
direct via `resolveCurrentTimelineMs()` — l'horloge réelle, qui avance entre deux `await` même de
quelques millisecondes (résolution de promesses, microtasks, travail synchrone du `runTimelineEvent`
précédent).

Séquence concrète observée pour `game:trial:bague:show` (un `ActionSequence` : `move` immédiat, puis
classe `is-visible` à +20ms) :

1. `game:grid:hide` → `emit()` → `runTimelineEvent` → `syncCursor({nowMs: <ms réel au moment T0>})`.
2. `game:trial:bague:show` → `emit()` → `runTimelineEvent` → **c'est ici que la continuation à +20ms
   est matérialisée dans la track** (`scheduleActionSequenceContinuation`) → puis
   `syncCursor({nowMs: <ms réel au moment T1>})`.
3. `game:timer:start`, `game:timer:pause`, etc. → mêmes étapes, à des instants T2, T3...

Si l'écart entre T1 (l'instant où la continuation vient d'être matérialisée à `ms+20`) et un
`syncCursor` **ultérieur** (T2, T3, ou même un appel encore plus tardif au même mécanisme ailleurs
dans le code) dépasse ces 20ms, le curseur de la track `strap-scene-game-router` avance au-delà de
l'index de cette continuation **sans jamais la livrer à `runTimelineEvent`** — elle est perdue
silencieusement. Le `reveal-question`, programmé séparément 3000ms plus tard par la même strap via
`context.planned.delay`, dépend de l'état que cette continuation aurait dû poser et ne produit donc,
au mieux, qu'un effet partiel — dans ce cas observé, le panneau reste visuellement masqué
(`is-hidden` jamais retiré) alors qu'il est bien attaché au DOM.

## Pourquoi un fixture minimal ne le reproduit pas de façon fiable

Un premier test minimal (une seule strap, un seul event immédiat, pas de multiples events dans le
même retour) n'a pas reproduit le défaut — le délai entre deux `await` y est trop court et trop
homogène pour franchir la fenêtre de 20ms dans un environnement de test rapide. Le défaut dépend
d'un nombre suffisant d'events séquentiels dans le même retour de strap (quiz-hunt en a 4 à 6 dans
ce cas) et/ou d'un travail synchrone non négligeable entre deux d'entre eux (résolution de
commit/move/className pour chacun). Ce n'est pas un défaut "tout ou rien" mais une **fenêtre de
course** — sa probabilité d'occurrence dépend de la durée de l'étape la plus courte d'une
`ActionSequence`/d'un helper programmé déclenché dans ce contexte, et du nombre d'events traités
avant qu'elle ne devienne due. Avec une fenêtre de 20ms (la plus courte pratiquée dans ce portage)
et 4-6 events séquentiels à traiter avant elle, la collision était quasi systématique sur la machine
de test — elle pourrait être intermittente ou liée à la charge sur une autre machine/navigateur.

## Correction retenue

**Constat clé** (issu de la discussion) : `currentMs` n'a, dans ce chemin, *aucune* valeur correcte
à lire après le premier `await` de la boucle `executeStrap`. `timelineEvent.ms` — calculé par
`createTimelineEvent` (`create-player.ts:1485`, `input.ms ?? this.resolveCurrentTimelineMs()`) —
*avant* tout `await`, à partir de `scope.ms` (figé une fois pour tout le lot, dès l'entrée dans
`routeSceneEvent`) — est la seule valeur qui ait un sens pour ce lot d'events. La relecture
indépendante de l'horloge, dans `emit()`, n'apportait rien de juste : dans le cas générique (`ms`
non fourni), elle redonne exactement `timelineEvent.ms` (calculé un instant plus tôt, sans `await`
entre les deux) ; dans le cas d'un lot issu d'une strap (`ms` fourni, figé), elle ne fait que
réintroduire la dérive.

**Décision de portée** : un strap *peut* être asynchrone (cas légitime — `StrapFn` autorise
`Promise<StrapReturnValue>`), mais un event issu d'une décision utilisateur n'a pas besoin d'une
précision d'horodatage fine — ce n'est pas un moteur de jeu. La priorité est que tous les events
d'un même lot soient exécutés, sans exception, pas qu'ils soient appliqués à la milliseconde près.
On corrige donc le cas essentiel (le lot d'events immédiats d'une strap, l'écrasante majorité —
`game-router.ts` en est l'exemple) en ancrant `currentMs` sur la valeur déjà figée avant tout
`await`, sans changer le contrat de `syncCursor` ni des autres appelants.

**Changement** (`create-player.ts`, dans `emit()`) :

```ts
// `timelineEvent.ms` est déjà la seule valeur sans dérive possible pour ce lot —
// figée par `createTimelineEvent` avant tout `await` de l'appelant (`scope.ms`,
// posé une fois par lot de strap). Une second lecture de l'horloge ici n'a rien de
// plus juste : dans le cas générique elle redonne `timelineEvent.ms` sans rien
// changer ; dans le cas d'un lot de strap, elle ne fait que réintroduire la dérive
// que cette même valeur permet justement d'éviter. Voir
// 2026-06-29-strap-emit-syncCursor-drift-defect.md.
const currentMs = this.drainingDueEvents
  ? this.timelineMs
  : event.mode === "persist-future"
    ? this.resolveCurrentTimelineMs()
    : timelineEvent.ms;
```

**Précision apportée en implémentant** : remplacer purement et simplement
`this.resolveCurrentTimelineMs()` par `timelineEvent.ms` aurait aussi rendu `isFutureEvent`/
`isRetroactiveEvent` toujours faux hors drainage — cassant le contrat de `mode: "persist-future"`
(`eventInsertMode` documenté dans CLAUDE.md : « matérialisé et traité comme un event futur quel que
soit la position ») qui dépend précisément d'une comparaison contre l'horloge réelle pour savoir si
l'event est encore à venir (confirmé en cassant volontiers le test `L13-T12 persist-future defers
one replay event until its target time`, `tests/lot13/create-player.spec.ts`, puis en le repassant
avec ce garde-fou). `persist-future` reste donc le seul mode, hors drainage, à relire l'horloge en
direct — c'est, par construction, le seul cas où un `ms` explicite est censé représenter une cible
future à comparer à « maintenant », et non l'instant figé d'un lot de strap.

**Test de régression** : `tests/v1/strap-emit-syncCursor-drift.spec.ts` (`SED-T1`) — un strap
retourne deux events immédiats ; le premier cascade vers un sous-strap réellement asynchrone (un
vrai délai de 40ms) avant de se résoudre, le second cible un perso avec un `ActionSequence` à
continuation courte (5ms). Émis comme un clic utilisateur (`player.emit(...)`, pas un eventime
programmé — pour rester hors du drainage piloté par le ticker, qui aurait masqué le défaut par un
autre mécanisme). Confirmé reproduire fidèlement le défaut sur le code d'avant correction (échoue),
et validé contre le correctif (passe) — voir l'historique de cette session pour le détail de la
mise au point (un premier essoi avec `durationMs` sur la mauvaise étape de l'`ActionSequence`, puis
un essai via `eventimes` qui ne sortait pas du drainage, ont été écartés avant d'arriver à ce
scénario correct).

**Cas résiduel, documenté, non corrigé par ce changement** : un strap *réellement* asynchrone (qui
fait un vrai `await` interne avant de retourner ses events) voit tous ses events ancrés sur
`scope.ms` — l'instant du déclenchement, pas l'instant de résolution de la strap. C'est cohérent
avec la philosophie déjà actée dans `v1-strap-helpers-spec.md` (« tous les helpers utilisent la même
référence temporelle runtime », « aucune implémentation helper ne s'appuie sur `setTimeout`/
`setInterval` applicatifs ») — mais signifie qu'un délai réel passé dans une strap asynchrone n'est
pas reflété dans l'horodatage de ses effets. Cas jugé exceptionnel et non prioritaire : une strap
déclenchée par une décision utilisateur n'a pas vocation à être asynchrone pour des raisons de
timing fin ; si un besoin de ce type apparaît, il doit passer par `context.planned`/`context.live`
(la primitive de délai existante), pas par un `await` interne à la strap.

## Démos/mécanismes à risque

Tout strap qui retourne **plusieurs events immédiats dans le même `events:[...]`**, où au moins un
cible une `ActionSequence`/un helper avec une étape suffisamment courte, est à risque — pas
spécifique à `move`. `game-router.ts` (quiz-hunt) en est l'exemple le plus net (4-6 events + une
suite à 20ms). À vérifier le jour où ce défaut sera corrigé : tout endroit où plusieurs events sont
retournés ensemble par une strap suite à un event utilisateur (pas une track rejouée).
