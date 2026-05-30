# Plan — Capture d'interaction & event de substitution

## Objectif

Permettre à un perso de déclencher une session de capture d'interaction (drag, keyboard, gesture) via une prop `capture` dans sa déclaration `emit`. La session capture des coordonnées brutes sur `window` et émet un event de substitution enregistré dans la timeline, rejouable au seek. Le calcul sémantique (dx/dy, position accumulée) est délégué à un strap.

---

## Fichiers à créer / modifier

### Phase 1 — Types
**`src/runtime/types.ts`**
- Nouveau type `EmitCapture` :
  ```ts
  type EmitCapture = {
    event: EmitRuleEvent
    duration: number
    anchor: 'start' | 'end'
    trackOn?: string[]   // défaut : ['pointermove']
    endOn?: string[]     // défaut : ['pointerup']
  }
  ```
- Étend `EmitRuleAction` : ajoute `capture?: EmitCapture`
- Ajoute `ms?: number` à `RuntimeEmitEvent` (pour timestamp rétroactif anchor:'end')

### Phase 2 — CreateElementOptions
**`src/runtime/create-element.ts`**
- Ajoute `getCurrentTimelineMs?: () => number` à `CreateElementOptions`

### Phase 3 — Player wiring
**`src/player/create-player.ts`**
- Passe `getCurrentTimelineMs: () => this.resolveCurrentTimelineMs()` dans les options createElementOptions du renderer
- Inclut `ms: event.ms` dans la construction de `PlayerPublicEventInput` depuis `emitRuntimeEvent`

### Phase 4 — Session de capture (nouveau fichier)
**`src/runtime/capture-session.ts`**

Fonction principale : `startCaptureSession(input): () => void`

Input :
```ts
{
  capture: EmitCapture
  startEvent: PointerEvent          // event natif du déclencheur (pointerdown)
  emitRuntimeEvent: (event: RuntimeEmitEvent) => void
  getCurrentTimelineMs?: () => number
}
```

Comportement :
- Installe sur `window` les listeners déclarés dans `capture.endOn` (défaut : `['pointerup']`)
- `capture.trackOn` (défaut : `['pointermove']`) est câblé pour un usage futur (ex: live streaming des coords)
- Sur l'event `endOn` :
  - Lit `endX = e.clientX`, `endY = e.clientY`
  - Calcule `ms` selon l'ancrage :
    - `anchor: 'start'` → `ms = getCurrentTimelineMs()`
    - `anchor: 'end'`   → `ms = getCurrentTimelineMs() - duration`
  - Émet via `emitRuntimeEvent` :
    ```ts
    {
      name: capture.event.name,
      cascade: capture.event.cascade,
      ms,
      data: {
        startX, startY,
        endX, endY,
        deltaMs,          // durée réelle de l'interaction
        duration,         // durée de l'animation de substitution
        anchor
      }
    }
    ```
  - Retire tous les listeners installés sur `window`
- Retourne une fonction de cleanup (retirage immédiat des listeners, ex: composant détruit en cours d'interaction)

Note : la session est générique — `trackOn`/`endOn` permettent de la câbler sur keyboard (`keyup`) ou gestures sans modifier l'implémentation.

### Phase 5 — Binding dans le composant
**`src/runtime/components/lib/dom-component-adapter.ts`**

Dans `bindRuntimeEmitDeclarations` :
- Le listener DOM passe l'event natif : `(domEvent) => { ... }` au lieu de `() => { ... }`
- Après `emitDeclaredRuntimeEvents`, si l'action a `capture` et que `domEvent` est un `PointerEvent` :
  ```ts
  startCaptureSession({
    capture: action.capture,
    startEvent: domEvent,
    emitRuntimeEvent,
    getCurrentTimelineMs: options.getCurrentTimelineMs
  })
  ```

### Phase 6 — Scène de démo
**`src/demos/scenes/s5-drag-scene.ts`** (nouveau)

Scène minimale : pas de master, pas d'initial time, pas d'eventimes.

Perso `draggable` (type `text`, positionné en absolu) :
```ts
emit: {
  pointerdown: {
    event: { name: 'drag:started', cascade: true },
    capture: {
      event: { name: 'drag:moved', cascade: true },
      duration: 400,
      anchor: 'end'
    }
  }
},
actions: {
  'drag:apply': {}   // vide — rempli par le payload via mergeActionWithEventPayload
}
```

Strap `apply-drag` :
- Reçoit `event.data = { startX, startY, endX, endY, duration }` depuis la session
- `dx = endX - startX`, `dy = endY - startY`
- Lit `state.accX, state.accY` (initialisés à 0 dans `scene.state`)
- `newX = accX + dx`, `newY = accY + dy`
- Retourne :
  ```ts
  {
    update: { accX: newX, accY: newY },
    events: [{
      name: 'drag:apply',
      cascade: true,
      data: {
        style: {
          x: { from: accX, to: newX, duration: 400 },
          y: { from: accY, to: newY, duration: 400 }
        }
      }
    }]
  }
  ```
- Puis : `context.live.delay(5000, { event: { name: 'sequence:end', cascade: true } })` — reset à chaque drop

Scene listen :
```ts
listen: [{ on: 'drag:moved', straps: ['apply-drag'] }]
```

### Phase 7 — Tests
**`tests/lot20/capture-session.spec.ts`** — `// @vitest-environment jsdom`

- T1 : `startCaptureSession` installe les listeners `window` sur l'event `endOn`
- T2 : sans prop `capture` dans l'action, aucun listener `window` installé
- T3 : `pointerup` émet l'event de substitution avec `startX, startY, endX, endY` corrects
- T4 : `anchor: 'start'` → `ms` égal au current time
- T5 : `anchor: 'end'` → `ms` égal au current time moins duration
- T6 : la fonction de cleanup retire tous les listeners `window`

---

## Ordre d'exécution

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 7 → Phase 6
```

Les tests (Phase 7) sont écrits après Phase 4-5 (implémentation de la session + binding).
La démo (Phase 6) est écrite en dernier pour valider l'intégration bout-en-bout.
Lancer `npx vitest run tests/lot20/` après Phase 7, avant de conclure.

---

## Contraintes techniques confirmées

- `emitRuntimeEvent` → `PlayerPublicEventInput.ms?` existe et est utilisé dans `createTimelineEvent` → events à timestamp custom supportés nativement
- `mergeActionWithEventPayload` fusionne payload avec action statique → action vide `{}` correcte pour perso cible
- `applyResolvedActions` résout le nœud DOM réel (`runtimeElements.get(targetItemId)`) avant passage à animejs → la target animejs est toujours le DOM element
- `deriveSimpleTransitions` lit `{ to, from, duration, delay }` dans les propriétés style → format direct pour animejs
- jsdom uniquement en devDependency, `@vitest-environment jsdom` par fichier de test

---

## Points ouverts (hors scope immédiat)

- **Live feedback pendant le drag** : le `trackOn` est câblé mais les coords `pointermove` ne sont pas encore streamées en temps réel aux persos ; à traiter séparément (feature "streaming live events")
- **Keyboard / gestures** : `trackOn`/`endOn` permettent de câbler d'autres types d'events sans modifier la session, mais les types de données du payload (`startX/Y`) devront être généralisés (ou le payload pourra être `Record<string, unknown>`)
- **Annulation de la session** : si l'event `endOn` ne se produit jamais (ex: perte focus fenêtre), le listener reste installé sur `window` → à gérer via un event `pointercancel` dans `endOn` ou via un timeout
