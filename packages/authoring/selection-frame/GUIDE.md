# selection-frame — guide du package

Ce package n'est pas un module unique mais une **boîte à outils** pour construire des surfaces
d'édition visuelle (cadre de sélection, sélection multiple, éditeur de zones, et tout futur module
du même genre). Trois modules de haut niveau l'utilisent aujourd'hui — `selection-frame.ts` (cs),
`multi-selection-frame.ts` (cs partagé multi-items), `zone-editor.ts` (édition de zones sur une
grille) — et partagent une même couche basse plutôt que de dupliquer chacun leur propre géométrie
et leur propre gestion de pointeur.

**Ce que ce package ne cherche PAS à être** : une identité visuelle unique ou un comportement
unique pour tous les éditeurs. Chaque module a ses propres contextes d'usage, résolus de façon
distincte. Ce que la boîte à outils garantit, c'est la **cohérence** des mécanismes bas niveau
(un geste de pointeur se comporte pareil partout, une poignée se positionne pareil partout) — pas
l'uniformité des comportements de haut niveau.

## Entrée V2 utilisée par l'éditeur

L'intégration V2 de l'éditeur importe `@codplay/selection-frame/v2`. Cette entrée fournit un
overlay neutre de move/resize :

- `setValue(value)` reçoit une `SelectionFrameValue` en pixels locaux dans le repère de la racine
  de scène ;
- les gestes émettent des deltas pixels (`move` ou `resize`) au callback de l'hôte ;
- `setSuspended(true)` masque le cadre pendant la lecture ;
- le cadre ne connaît ni `instance.snapshot`, ni le player, ni le document, ni les unités
  logiques ;
- le commit, l'abandon et la conversion px ↔ valeur logique restent sous la responsabilité de
  `decor-editor` et de son bridge d'application.

Le cadre V2 ne mesure donc pas un item player et n'écrit pas dans son DOM. Les autres entrées du
package restent disponibles pour les modules non encore migrés ; elles ne font pas partie du
circuit V2 de l'éditeur.

## La boîte à outils bas niveau

Quatre fichiers, chacun résout UN problème précis rencontré au moins deux fois avant extraction.
Un nouveau module qui a besoin de l'un de ces problèmes doit importer d'ici, jamais le
réimplémenter — même partiellement, même "en plus simple".

### `gesture-session.ts` — session de geste pointeur

Problème : démarrer/suivre/terminer un drag (ou resize, rotate, trace…) au pointeur demande de
gérer 5 événements (`pointerdown/move/up/cancel/lostpointercapture`) avec des règles de robustesse
non triviales — bouton primaire uniquement, capture posée puis relâchée AVANT tout appel risqué,
et surtout la gestion de `lostpointercapture` (voir encadré ci-dessous).

```ts
bindGestureSession<S>(targetNode, {
  onStart: (event) => S | null,          // null = geste ignoré (garde, alt-click consommé ailleurs…)
  onMove:  (event, session: S) => void,
  onEnd:   (session: S, apply: boolean, event) => void  // apply=false seulement sur pointercancel
}) → { unbind(), isActive() }
```

> **`lostpointercapture` est TOUJOURS une application, jamais un abandon** (sauf `pointercancel`).
> Ce n'était pas évident : un navigateur peut délivrer cet événement en plein milieu d'un geste,
> bouton encore enfoncé selon le dernier `pointermove` connu — sans signal fiable dans ce code
> (état du bouton, timing, bornes du viewport) pour distinguer un "vrai" abandon d'un relâchement
> normal. `multi-selection-frame.ts` traitait déjà ce cas ainsi depuis le début ; toute heuristique
> plus fine (`lastKnownButtons === 0`, etc.) s'est révélée être une fausse piste — voir le
> commentaire en tête de `gesture-session.ts` pour l'historique complet du diagnostic.

Utilisé par `selection-frame.ts` (drag/resize/rotate/pivot/trace), `multi-selection-frame.ts`
(drag groupé), `zone-editor.ts` (trace/déplacement/resize de zone).

### `overlay-pose.ts` — pose visuelle et conversions matricielles

Problème : positionner un artefact d'overlay (cs, poignée, fantôme de drag) exactement sur un nœud
cible, y compris sous rotation/scale, sans jamais utiliser `getBoundingClientRect` pour autre chose
que l'ancrage monde initial (gBCR est coûteux en repaint et faux dès qu'un transform est appliqué
sur un ancêtre après lecture — pattern déjà établi côté runtime Codplay, `photo` avant matrice).

Fonctions clés :
- `captureOverlayPose(node) → OverlayPose` — rect ancré, matrice combinée (nœud + ancêtres,
  `rotate`/`scale`/`transform` individuels inclus), matrice de rotation seule, facteurs d'échelle.
- `localFractionToViewportPoint(pose, fx, fy)` — position viewport d'un point fractionnel (0..1)
  de la boîte locale, exact sous n'importe quel transform affine.
- `measureWorldRect(node)` — **seul point d'entrée légitime pour `getBoundingClientRect`** dans
  tout le package (ancrage monde + calibration itérative). Toute autre mesure (dimensions,
  fractions, conversions de delta) passe par les styles calculés et la matrice.
- `ensureOverlayLayer(sceneRoot)` — un seul layer DOM `position:fixed` partagé par **tous les
  modules** du package pour une même scène (`[data-selection-frame-overlay]`, déduplication par
  querySelector). Sert aussi de filtre : un module qui résout des candidats sous le pointeur via
  `elementsFromPoint` doit exclure tout élément contenu dans ce layer (ses propres nœuds cs/poignée
  ne sont jamais des candidats valides).

Pour convertir un delta de pointeur (espace viewport) en delta local d'un conteneur potentiellement
tourné, ne JAMAIS diviser par `scaleX`/`scaleY` seuls — utiliser
`worldDeltaToLocalDelta` (`codplay/runtime/modules/list-flip/engine/dom-matrix`, pas dans ce
package mais consommé par `zone-editor.ts` et `selection-frame.ts` de la même façon) avec la
matrice complète de `captureOverlayPose`.

### `handle-geometry.ts` — géométrie des poignées de resize

Problème : une poignée de resize (coin ou côté) a toujours les mêmes 8 identifiants, le même point
caractéristique en fraction de boîte (0..1), le même point opposé fixe pendant le resize, le même
curseur directionnel — extrait après que `selection-frame.ts` et `zone-editor.ts` ont été trouvés
porteurs de copies identiques au caractère près des mêmes trois tables (`2026-07-10`).

```ts
type HandleId = 'nw'|'ne'|'se'|'sw'|'n'|'e'|'s'|'w'
CHARACTERISTIC_POINTS: Record<HandleId, {fx,fy}>   // position de la poignée
OPPOSITE_POINT: Record<HandleId, HandleId>          // ancre fixe pendant le resize
HANDLE_CURSORS: Record<HandleId, string>            // curseur CSS directionnel

createHandleNode({ doc, id, attributeName, borderColor, pointerEventsAuto }) → HTMLElement
```

`attributeName` et `pointerEventsAuto` sont les deux seuls axes de variation entre appelants
(voir docstring du type `CreateHandleNodeOptions` dans le fichier pour l'explication précise de
pourquoi le cs et le zone-editor diffèrent sur `pointerEventsAuto` — leur conteneur parent n'a pas
la même politique `pointer-events` par défaut).

### `grid-geometry.ts` — géométrie de pistes de grille

Problème : convertir entre une position en pixels locaux et un index de piste CSS Grid (ligne/
colonne), avec des pistes non uniformes (tailles réellement résolues par le navigateur), et un
repli propre quand la mesure échoue (jsdom ne résout jamais les templates en pixels — retourne
l'`1fr 2fr` authored tel quel).

```ts
measureGridTracks(container) → GridTrackGeometry | null   // null si non résolu (ex. jsdom)
uniformTrackGeometry({ rows, cols, localWidth, localHeight, columnGap, rowGap }) → GridTrackGeometry
trackAnchorPx(tracks, gap, index1) → number   // début de piste, 1-based
trackSpanPx(tracks, gap, start1, span) → number
trackIndexAtPx(tracks, gap, positionPx) → number
nearestTrackAnchor / nearestTrackSpan(...)    // arrondi au plus proche
```

`uniformTrackGeometry` est le repli **canonique** quand `measureGridTracks` renvoie `null` — ne
jamais réécrire cette division à la main (un bug de gaps perdus dans `zone-editor.ts` venait
exactement de ça).

## Le principe des variantes déclaratives

C'est le cœur de la cohérence du package, et la partie la plus facile à oublier une fois écrite —
d'où cette section volontairement longue. La règle :

> Un module construit son comportement par défaut tout seul. L'éditeur peut lui demander une
> **variante** en fournissant un contexte explicite ; si ce contexte est absent, le module utilise
> son défaut documenté. Le module ne devine jamais ce que l'éditeur veut à partir d'un signal
> indirect (type d'item, nom de story, etc.) — seul un contexte explicite change le comportement.

Ce n'est pas une fusion de comportements : le cs a le concept de "poignée resize vs scale", le
zone-editor n'a pas ce concept du tout (une zone n'a que du resize). Chaque module résout SES
propres axes de variation ; la boîte à outils bas niveau (ci-dessus) est ce qui reste identique
entre eux, pas le vocabulaire de variantes lui-même.

**Pourquoi documenter aussi abondamment** : ces points de variation sont des opportunités rares
(un seul appelant les utilise aujourd'hui, parfois aucun). Sans trace écrite à l'endroit où on les
cherche, ils se redécouvrent par accident après les avoir complètement oubliés — au prix d'un bug
ou d'une réimplémentation en double. Chaque variante ci-dessous documente : l'axe, le type
TypeScript porteur, le défaut exact, et QUI en a besoin (même si "personne encore").

### Exemple 1 — `CapabilityPreset` / `HandleBehavior` (`selection-frame.ts`, `types.ts`)

Le cs peut activer/désactiver des capacités (`move`, `resize`, `scale`, `rotate`,
`rotation-origin`, `positioning`) et configurer chaque poignée individuellement :

```ts
type HandleBehavior = {
  mode?: 'resize' | 'scale'      // défaut : resize si actif, sinon scale
  allowSwap?: boolean            // alt-clic peut-il basculer la poignée ? défaut : les deux capacités actives
  ratio?: 'locked' | 'free'      // défaut 'locked' (Shift lève la contrainte) ; 'free' inverse (Shift verrouille) — contexte grille
}

type CapabilityPreset = {
  name: string
  capabilities: CsCapability[]
  handles?: Partial<Record<'corners' | 'sides' | CsHandleId, HandleBehavior>>
}
```

Résolution en cascade documentée dans `types.ts` : **id de poignée précis > groupe (`corners`/
`sides`) > défauts globaux**. `handle.applyPreset(preset)` — appelable à tout moment, pas
seulement à la création — permute le preset actif (ex. capsule racine vs capsule enfant : poignées
resize pour l'une, scale pour l'autre).

### Exemple 2 — `context?: 'grid' | 'libre'` (`SelectionFrameCreationOptions`, `types.ts`)

Le mode création (tracé d'un nouvel item) peut être forcé en mode grille (émet une `cell-area`) ou
libre (émet un rect en pixels locaux), indépendamment du preset de capacités actif. Défaut non
défini : grille si un `containerGrid` est posé sur le cs, libre sinon — comportement d'origine
préservé quand l'éditeur ne fournit rien.

### Exemple 3 — `onAltClickCycle` (`SelectionFrameOptions`, `types.ts` — implémenté dans les DEUX modules cs et zone-editor)

Alt+clic doit faire cycler la sélection vers l'élément suivant empilé sous le point cliqué ;
Alt+Maj+clic doit ajouter au lieu de remplacer. Le module (cs comme zone-editor) résout LUI-MÊME
les candidats sous le point (`elementsFromPoint`, filtré par `overlayLayer.contains`) — c'est de la
géométrie pure, pas une décision de sélection. Mais il ne décide **jamais** lequel adopter : seul
l'éditeur sait ce qui est actuellement attaché et comment la sélection compose avec d'autres outils
(multi-sélection, etc.). Contexte optionnel : si `onAltClickCycle` est absent, alt-clic est
simplement ignoré (aucun comportement par défaut inventé côté module — voir
[[feedback-no-hardcoded-defaults-in-builder]], même principe hors Builder).

```ts
onAltClickCycle?: (candidateItemIds: string[], additive: boolean) => void
```

### Checklist pour tout nouvel axe de variation

Avant d'ajouter une option à un module de ce package :

1. **Le comportement par défaut fonctionne-t-il sans que l'éditeur fournisse rien ?** Si non, ce
   n'est pas une variante, c'est une donnée requise — la modéliser comme telle (paramètre non
   optionnel), pas comme option avec un faux défaut inventé.
2. **Documenter le défaut exact** à l'endroit où le type est déclaré (`types.ts` pour le cs,
   `zone-editor.ts`/`zone-model.ts` pour les zones) — jamais seulement dans ce guide, qui peut se
   périmer sans que le code bouge.
3. **Ajouter un exemple ici** si l'axe est réellement rare (un seul appelant, ou zéro pour
   l'instant) — c'est précisément le cas qui se redécouvre par accident sinon.
4. **Ne pas dupliquer un axe déjà résolu dans un autre module** sans vérifier d'abord si le même
   problème existe déjà en boîte à outils bas niveau (section précédente) plutôt qu'en variante de
   haut niveau.

## Où regarder avant d'écrire du nouveau code dans ce package

- Un besoin de geste pointeur (drag, resize, trace…) → `gesture-session.ts`, jamais de nouveaux
  `addEventListener('pointerdown', …)` manuels.
- Un besoin de position/dimension d'un nœud potentiellement transformé → `overlay-pose.ts`,
  jamais `getBoundingClientRect` en dehors de l'ancrage/calibration.
- Un besoin de poignée de resize → `handle-geometry.ts`.
- Un besoin de conversion pixel ↔ piste de grille → `grid-geometry.ts`.
- Un besoin de comportement différent selon l'éditeur appelant → variante déclarative documentée
  ici, jamais une branche interne devinée à partir d'un signal indirect.
