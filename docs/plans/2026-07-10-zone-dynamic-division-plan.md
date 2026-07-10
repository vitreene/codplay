# Plan — division dynamique de zone (clavier)

Package : `packages/authoring/selection-frame/`. Suite du chantier zones (voir
`docs/plans/2026-07-03-selection-frame-variantes-plan.md`, étapes 5–8, closes). Ce plan couvre
UNIQUEMENT la division dynamique par clavier — pas l'étape 9 du plan précédent (intégration
cs ↔ zones), écartée séparément faute de contexte exploitable.

## Objectif

Sur une zone sélectionnée, permettre d'ajuster interactivement un nombre de lignes/colonnes de
division (flèches clavier), prévisualiser le découpage avant de le committer, puis appliquer un
vrai split (`zoneModel.splitZone`, déjà écrit et testé) uniquement à la validation. Entre le début
du geste clavier et la validation, la zone reste un seul `ZoneDef` dans `state.zones` — aucune
zone enfant n'existe encore.

## Comportement exact

### Déclenchement

- Une seule zone sélectionnée (`selectedNames.length === 1`) et le focus clavier est sur
  l'éditeur — voir §Focus clavier ci-dessous pour la condition précise.
- **Verrouillage par état machine, comme tout autre geste du module** : le pattern déjà en place
  pour tracing/resizing/moving (`onStart` renvoie `null` si `!actor.getSnapshot().matches({active:
  'tracing'})`, etc. — `zone-editor.ts:393,518,665`) s'applique identiquement ici. La frappe flèche
  ne démarre `DIVIDE_START` (transition `active.still → active.dividing`) QUE si la machine est
  actuellement dans `{ active: 'still' }`. Concrètement :
  - Machine `suspended`/`idle` (nœud disparu) : la frappe est un no-op, exactement comme les autres
    gestes sont déjà bloqués par `isSuspended()`.
  - Machine `{ active: 'tracing' }`/`{ active: 'resizing' }`/`{ active: 'moving' }` (un geste
    pointeur est en cours) : la frappe est un no-op — un geste pointeur en cours bloque le
    déclenchement clavier, symétriquement à la règle déjà posée en §Fin de phase pour le cas
    inverse (une division active bloque le déclenchement d'un geste pointeur, qui doit d'abord
    committer/annuler la phase).
  - Machine `{ active: 'dividing' }` (déjà en cours de division) : une nouvelle frappe flèche ne
    redéclenche pas `DIVIDE_START` — elle continue d'ajuster la session active (§Ajustement).
- Toute frappe flèche (←/→/↑/↓) sur cette zone démarre la phase d'édition si elle n'est pas déjà
  active ET que la machine est en `{ active: 'still' }`. Aucune autre action (clic, double-clic,
  raccourci dédié) ne la démarre.
- Si plus d'une zone est sélectionnée, ou aucune, les flèches n'ont aucun effet sur la division
  (pas de fallback implicite sur "la première zone" ou "la dernière cliquée") — vérifié en premier,
  avant même de consulter l'état machine.

### Ajustement

- ← / → : diminue / augmente le nombre de colonnes de division (`cols`, défaut `1` = pas encore
  divisé sur cet axe).
- ↑ / ↓ : diminue / augmente le nombre de lignes de division (`rows`, défaut `1`).
- Les valeurs candidates sont exactement celles renvoyées par `zoneModel.getSplitOptions(state,
  name)` pour l'axe concerné (formule déjà en place : `(span − (n−1)×g) % n === 0`, `g` =
  `state.grid.fakeGapUnits ?? 0`, non réglable pendant cette phase — décision explicite : le faux
  gap reste celui de la grille, aucun contrôle clavier supplémentaire ne le modifie ici).
- Chaque flèche avance/recule d'UN cran dans la liste triée des options valides pour cet axe (pas
  un pas de `+1`/`-1` brut sur le compteur — une valeur invalide n'est jamais atteignable). En
  butée (déjà au premier ou dernier élément de la liste), la frappe est un no-op silencieux (pas
  de wrap circulaire).
- `rows`/`cols` par défaut au déclenchement : `{ rows: 1, cols: 1 }` (aucune division). La première
  frappe part donc de cet état, pas d'une valeur mémorisée d'une session d'édition précédente sur
  cette même zone.

### Aperçu visuel pendant la phase

- La zone garde exactement sa géométrie actuelle (`row/col/rowSpan/colSpan` inchangés dans
  `state.zones` — aucune mutation de state tant que non validé).
- Des lignes de découpe internes sont dessinées PAR-DESSUS le nœud de la zone existante,
  positionnées aux mêmes fractions que produirait `zoneModel.splitZone(state, name, { rows, cols,
  gapUnits: state.grid.fakeGapUnits ?? 0 })` sur les axes actifs (`rows > 1` et/ou `cols > 1`) —
  recalculées à chaque frappe. Aucun nouveau `ZoneDef` n'est créé pour ce rendu ; c'est un overlay
  géométrique pur, au même titre que `hoverHighlight` ou les poignées de resize.
- Si `rows === 1 && cols === 1` (état de départ, avant toute frappe utile), aucune ligne interne
  n'est dessinée — seul l'indicateur de phase (voir §Signal de phase active) apparaît.

### Signal de phase active

- Un indicateur visuel distinct de la sélection normale (bordure de sélection existante inchangée)
  signale que la zone est en cours de division — a minima une classe/attribut dédié sur le nœud de
  la zone (`data-zone-editor-dividing`, à trancher au moment de l'implémentation selon ce qui existe
  déjà pour `data-zone-editor-selected` ou équivalent). Traitement purement visuel, pas de nouveau
  concept de données.

### Fin de phase (validation / annulation)

Une seule règle : **tout sauf Échap valide**.

- **Entrée** : valide. Si `rows === 1 && cols === 1` (aucune division réellement configurée), la
  validation est un no-op — pas de split appelé, la zone reste telle quelle, la phase se ferme
  silencieusement. Sinon, appelle `zoneModel.splitZone(state, name, { rows, cols, gapUnits:
  state.grid.fakeGapUnits ?? 0 })`, remplace la zone source par les enfants créés dans `state.zones`
  (même mécanique que `ZoneEditorHandle.splitZone` existant), sélectionne les zones créées
  (`applySelection(createdNames)` — même comportement que le split immédiat existant), notifie
  `onZonesChange`.
- **Échap** : annule. `rows`/`cols` sont abandonnés sans appel à `splitZone`, aucune mutation de
  `state.zones`, l'overlay de lignes internes et l'indicateur de phase disparaissent, la sélection
  ne change pas (la zone source reste sélectionnée, seule).
- **Toute perte de focus** (clic dans le vide, clic sur une autre zone qui change la sélection,
  Alt+clic cycle, `attachItem`/déclenchement externe équivalent, etc.) : valide implicitement selon
  la même règle que Entrée, AVANT que l'action déclenchante ne s'applique. Concrètement : si un clic
  change la sélection pendant une phase active, la division en cours est d'abord committée (ou
  ignorée si `1×1`), puis le changement de sélection s'exécute normalement sur l'état résultant.
- Un `pointerdown` qui démarre un geste sur la MÊME zone en cours de division (déplacement,
  resize) suit la même règle de perte de focus : valide d'abord, puis le geste s'applique sur les
  zones enfants nouvellement créées (ou sur la zone source inchangée si `1×1`). Pas de geste
  simultané avec la phase de division active.

### Focus clavier — tranché

Écoute posée sur `document` (`addEventListener('keydown', …)`, câblée à la construction du module,
retirée dans `destroy()` comme les autres listeners du fichier), filtrée par
`selectedNames.length === 1` — aucune notion de focus DOM, active dès qu'une zone unique est
sélectionnée, quel que soit l'élément réellement focus. Cohérent avec le fait que le zone-editor
n'a aujourd'hui aucune gestion de focus DOM ; zéro préalable côté éditeur hôte pour que le clavier
fonctionne.

Conséquence pour les tests : pas de simulation de `focus()`/`tabindex`, un `keydown` dispatché sur
`document` avec une zone unique sélectionnée suffit.

## Modèle de données — état transitoire

Nouveau state interne au module (pas dans `ZoneEditorState`/`ZoneDef`, qui restent des types
persistés purs sans notion de phase — cf `zone-model.ts`, aucune dépendance DOM/UI n'y est
introduite par ce plan) :

```ts
type DivisionSession = {
  zoneName: string
  rows: number  // toujours une valeur de getSplitOptions(...).rows, jamais arbitraire
  cols: number  // idem .cols
}
```

Une seule session active à la fois (`division: DivisionSession | null`, variable de fermeture au
même niveau que `selectedNames` dans `zone-editor.ts`), jamais dans `ZoneEditorState` — elle
n'existe que côté module, exactement comme le principe déjà établi pour `otherSelectedStartAreas`
pendant un déplacement de groupe (état de geste transitoire, jamais persisté).

## Machine — extension de `zone-machine.ts`

Ajout d'un état `dividing` sous `active`, au même niveau que `still/tracing/resizing/moving` (pas
un sous-état de `still` — il doit bloquer `TRACE_START`/`RESIZE_START`/`MOVE_START` tant qu'actif,
donc être un état frère qui n'accepte pas ces événements) :

```
active.still --DIVIDE_START--> active.dividing --DIVIDE_COMMIT | DIVIDE_CANCEL--> active.still
```

`DIVIDE_START` n'est déclaré QUE sur `still` (comme `TRACE_START`/`RESIZE_START`/`MOVE_START` le
sont déjà exclusivement sur `still` aujourd'hui) — envoyé depuis `tracing`/`resizing`/`moving`, il
est silencieusement ignoré par construction XState (événement non géré dans l'état courant),
donnant gratuitement le verrouillage décrit en §Déclenchement sans logique de garde
supplémentaire côté module.

**Nœud qui disparaît en pleine division** : `NODE_DISAPPEARED` est déjà déclaré sur `active`
entier (pas seulement sur `still`) et transite vers `suspended` quel que soit le sous-état actif —
vérifié dans le code existant, `subscribeToNode` envoie cet événement sans discrimination du geste
en cours, et aucun geste pointeur (tracing/resizing/moving) n'a aujourd'hui de nettoyage dédié : un
`pointermove` suivant sur un `containerNode` devenu `null` retourne tôt via les gardes déjà en
place (`if (containerNode === null) return null`). La division suit la même règle, par symétrie :
le state module-local `division` (voir ci-dessous) est vidé sans appel à `splitZone` ni
notification quand `NODE_DISAPPEARED` survient pendant `dividing` — aucun commit implicite d'une
division dont le nœud cible a disparu. Pas de nouvelle logique à écrire pour ce cas au niveau
machine (la transition existe déjà) ; côté module, l'observateur de transition vers `suspended`
doit inclure la remise à zéro de `division`, au même titre que les autres states de geste
transitoire y sont déjà implicitement abandonnés.

Nouveaux événements : `DIVIDE_START`, `DIVIDE_ADJUST` (context : `{axis: 'rows'|'cols', value:
number}` — piloté par la machine ou laissé en state module-local comme `DivisionSession` ci-dessus,
à trancher selon si le contexte machine doit refléter `rows`/`cols` ou seulement la phase binaire
active/inactive ; recommandation : la machine ne porte que la transition de phase, pas les
valeurs — cohérent avec le principe déjà en place dans `zone-machine.ts` que "l'état réel (grid +
zones) vit dans `ZoneEditorState`, pas dupliqué dans le contexte machine"), `DIVIDE_COMMIT`,
`DIVIDE_CANCEL`.

`still.TRACE_START`/`RESIZE_START`/`MOVE_START` restent inchangés ; `dividing` n'a pas de
transition vers eux — un geste pointeur pendant `dividing` doit d'abord committer/annuler
(§Fin de phase) puis, si applicable, redéclencher l'événement de geste depuis `still`.

## Surface publique — `ZoneEditorOptions`/`ZoneEditorHandle`

Pas de nouveau callback obligatoire : `onZonesChange`/`onSelectionChange` existants suffisent (un
commit de division est indiscernable côté éditeur hôte d'un split immédiat déjà existant — même
notification, même forme de données). Aucun nouveau champ requis sur `ZoneEditorOptions`.

Aucune nouvelle méthode sur `ZoneEditorHandle` : l'écoute étant posée en interne sur `document`
(§Focus clavier), le module gère tout lui-même dès `handle` construit — aucun transfert de focus
programmatique à exposer.

## Tests attendus

- Déclenchement : flèche sur zone unique sélectionnée démarre la phase ; flèche avec 0 ou 2+
  zones sélectionnées ne fait rien.
- Progression sur les options valides : suite de flèches ne produit jamais un `rows`/`cols` hors de
  `getSplitOptions(...)`, butée haute/basse = no-op sans wrap.
- Aperçu : lignes internes recalculées à chaque frappe, aucune mutation de `state.zones` avant
  validation.
- Validation Entrée : split réel appliqué, enfants sélectionnés, `onZonesChange` appelé une fois.
- Validation Entrée sur `1×1` : no-op, aucun split appelé, aucune notification.
- Annulation Échap : aucune mutation, zone source reste seule sélectionnée, overlay disparaît.
- Perte de focus par clic sur une autre zone pendant une division active avec `rows/cols > 1` :
  commit AVANT le changement de sélection (vérifier l'ordre exact des deux mutations résultantes).
- Geste (drag/resize) démarré sur la zone en cours de division : commit d'abord, geste s'applique
  ensuite sur les enfants créés.
- Machine : `dividing` bloque bien `TRACE_START`/`RESIZE_START`/`MOVE_START` (aucune transition),
  `DIVIDE_COMMIT`/`DIVIDE_CANCEL` retournent à `still`.
- Machine : `DIVIDE_START` envoyé pendant `tracing`/`resizing`/`moving` est un no-op (pas de
  transition vers `dividing`, session `division` jamais créée).
- Nœud disparu (`NODE_DISAPPEARED`) pendant `dividing` : `division` remis à `null` sans appel à
  `splitZone`, aucun `onZonesChange`, overlay de lignes internes retiré.

## Point sans enjeu, laissé à l'implémentation

**Nom exact de l'attribut/classe de signal de phase** (§Signal de phase active) — détail sans
enjeu fonctionnel, à trancher en cohérence avec les conventions déjà en place dans le fichier au
moment d'écrire le code (`data-zone-editor-*` existants).

Aucun autre point ouvert : déclenchement, ajustement, aperçu, fin de phase, focus clavier, modèle
de données et machine sont entièrement spécifiés ci-dessus.
