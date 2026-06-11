# Spec — replace : circuits sync/async + module emit

Complète `2026-06-09-replace-plan.md` §4.1, §4.3 et §7.

---

## 1. Contrainte de chargement

Les mutations de `src` (image, vidéo) sont synchrones au niveau DOM, mais
le chargement de la ressource est asynchrone — même depuis le cache navigateur.
Le browser ne recalcule pas le layout avant qu'une tâche async soit passée.
`afterUpdate` s'exécutant dans le même tick que `component.update()`, les
dimensions reflétées par `el.offsetWidth/Height` à ce moment correspondent
à l'**état précédent**.

Les mutations de `content` (texte) sont synchrones : `el.offsetWidth/Height`
dans `afterUpdate` reflète immédiatement le nouvel état.

Cette contrainte justifie deux circuits distincts.

---

## 2. Circuits

### 2.1 Mapping variantes → circuits

| Variante | Propriété cible | Circuit | Point d'activation |
|---|---|---|---|
| `replace-simple` | `action.content` | sync | afterUpdate |
| `replace-simple` | `action.src` | async | afterUpdate |
| `replace-split-text` | `action.content` | sync | afterUpdate |
| `replace-split-cells` | `action.src` | async | onFinalize |

La détection du circuit dans `replace-simple` s'effectue sur la clé de
l'action (`action.content` → sync, `action.src` → async).

### 2.2 Circuit sync

`component.update()` est synchrone. À `afterUpdate`, `el.offsetWidth/Height`
reflète le nouvel état.

**replace-simple :**

`beforeUpdate` :
- Clone A = `el.cloneNode(true)`, positionné avec `left`, `top`, `width`,
  `height` depuis `el` (état courant avant mise à jour)
- `el.style.visibility = 'hidden'`

`afterUpdate` :
- Clone B = `el.cloneNode(true)`, positionné avec `left`, `top`, `width`,
  `height` depuis `el` (état après mise à jour)
- Lancer les animations intro/outro

**replace-split-text :**

`beforeUpdate` :
- Découper l'état courant → spans sortants (voir plan §4.2)
- Stasher l'`innerHTML` original
- `el.style.visibility = 'hidden'`

`afterUpdate` :
- Découper le nouvel état → spans entrants
- Animer selon `direction` et `stagger`

### 2.3 Circuit async — afterUpdate (replace-simple / src)

`beforeUpdate` : identique au circuit sync.

`afterUpdate — phase 1` (immédiate) :
- Clone B = `el.cloneNode(true)`, positionné avec `left`, `top` depuis `el`
- Pas de `width`/`height` explicites : CSS détermine les dimensions du clone
  depuis son contenu (ressource servie depuis le cache)
- Lancer les animations intro/outro
- Poser `onload` sur l'`<img>` de Clone B

`afterUpdate — phase 2` (onload) :
- `cloneB.offsetWidth/Height` est maintenant correct
- Assigner `width` et `height` sur Clone B
- Émettre via `host.emit` :

```ts
host.emit({
  name: 'replace:dimensions-ready',
  payload: { persoId, width: cloneB.offsetWidth, height: cloneB.offsetHeight },
  insertMode: 'persist-only',
  scopePersoId: persoId,
  ms: host.timeline.currentMs,
})
```

Les images étant preloadées, le `onload` se déclenche très rapidement.
Les premières frames de la transition (Clone B à opacité nulle ou faible)
rendent l'absence temporaire de dimensions explicites imperceptible.

### 2.4 Circuit async — onFinalize (replace-split-cells / src)

La grille est construite en `beforeUpdate` depuis l'ancien `src` :
`el.offsetWidth/Height` à ce moment est correct. Le problème de chargement
se pose à `onFinalize`, au moment de révéler l'élément avec le nouveau `src`.

`beforeUpdate` :
- `el.offsetWidth × offsetHeight` correct → grille construite avec
  `background-image: url(ancienSrc)` et dimensions exactes
- `el.style.visibility = 'hidden'`

`afterUpdate` :
- Lancer l'outro staggeré sur les cellules

`onFinalize — phase 1` :
- Supprimer la grille overlay
- Tester si la ressource est prête : `img.complete && img.naturalWidth > 0`
  - Oui → phase 2 immédiate
  - Non → poser `onload`

`onFinalize — phase 2` (sync ou onload) :
- `el.style.visibility = ''`
- Émettre via `host.emit` :

```ts
host.emit({
  name: 'replace:cells-revealed',
  payload: { persoId },
  insertMode: 'persist-only',
  scopePersoId: persoId,
  ms: host.timeline.currentMs,
})
```

---

## 3. Seek

### 3.1 replace-simple / src — seek dans la fenêtre de transition

Au seek, `beforeUpdate` et `afterUpdate` sont rejoués depuis le track.
Clone B est créé sans dimensions explicites, puis l'event
`replace:dimensions-ready` (`persist-only`) est rejoué depuis le track.

Le module enregistre un handler sur `replace:dimensions-ready` via
`RuntimeModuleBinding.events` (voir §4.3). Ce handler localise le Clone B
actif pour le `persoId` concerné et lui applique `width`/`height`.

### 3.2 replace-split-cells — seek dans la fenêtre de transition

Au seek :
- Les cellules sont reconstruites depuis `beforeUpdate`
- `el` reste `visibility: hidden` jusqu'au replay de `replace:cells-revealed`
- Le handler `replace:cells-revealed` révèle `el`

### 3.3 Seek après la fin de la transition

Toutes variantes : seek après `eventMs + duration` → clones/cellules supprimés,
élément original révélé avec le nouvel état (voir plan §8).

---

## 4. Extension de RuntimeModuleHost

### 4.1 Capacités ajoutées au host

```ts
RuntimeModuleHost += {
  emit: (input: ModuleEmitInput) => void
  timeline: {
    readonly currentMs: number
  }
}
```

### 4.2 ModuleEmitInput

```ts
type ModuleEmitInput = {
  name: string
  payload: Record<string, unknown>
  insertMode?: 'persist-only' | 'persist-future'  // absent = apply-now (défaut système)
  scopePersoId?: string
  scopeStoryId?: string
  ms?: number  // si absent : host.timeline.currentMs
}
```

### 4.3 Binding event pour les modules

```ts
RuntimeModuleBinding += {
  events?: {
    [eventName: string]: (payload: RuntimeModuleEventPayload) => void
  }
}

type RuntimeModuleEventPayload = {
  name: string
  payload: Record<string, unknown>
  mode: 'apply-now' | 'persist-only'
  scopePersoId?: string
  scopeStoryId?: string
  ms: number
}
```

### 4.4 Routage

- `host.emit` injecte l'event dans le pipeline interne du player
- `persist-only` : écrit dans le track, non appliqué en live au-delà du
  handler module, non interceptable via un `listen` auteur
- `apply-now` (défaut) : appliqué en live, écrit dans le track, interceptable
- `scopePersoId` / `scopeStoryId` : restreignent le dispatch aux modules concernés

### 4.5 Canonicité

Ce modèle est reproductible pour tout callback async devant réintégrer le
système de façon déterministe : fin de chargement ressource, état interne
à conserver pour seek, signaux inter-modules.
