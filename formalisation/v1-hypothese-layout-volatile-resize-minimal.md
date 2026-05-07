# V1 - hypothese minimale - resize/scroll et style runtime volatil

## Statut

Document d'hypothese a integrer dans l'evolution de la spec.

## Convention temporaire (hypotheses)

- dans les exemples orientes API, l'instance principale est `studio` creee via `new Codplay()`
- cette convention est provisoire et sera re-evaluee post-V1

## Objectif

Illustrer un modele simple pour gerer `resize/scroll/orientationchange` sans dupliquer un moteur de calcul dans chaque perso.

## Principe

- les events `resize/scroll/orientationchange` sont des events systeme volatils
- le calcul style est centralise (service/strap layout)
- les persos appliquent des styles/transformations, ils ne recalculent pas la geometrie globale

## Contrat minimal propose

```ts
type LayoutViewportChangedEvent = {
  name: "runtime:viewport:changed"
  data: {
    width: number
    height: number
    scrollY: number
    orientation?: "portrait" | "landscape"
  }
}

type RuntimeStylePatch = {
  // proprietes CSS standard
  position?: "absolute" | "relative" | "fixed" | "sticky"
  left?: string
  top?: string
  width?: string
  height?: string
  opacity?: number
  // enrichissement animejs pour translate
  x?: number
  y?: number
  scale?: number
}

type RuntimeStyleSnapshot = {
  byPersoId: Record<string, RuntimeStylePatch>
}
```

## Enchainement minimal

1. l'hote detecte `resize`, `scroll` ou `orientationchange` (throttle/debounce)
2. l'hote emet `runtime:viewport:changed`
3. `Scene.listen` route vers strap `layout-recompute`
4. le strap calcule un `RuntimeStyleSnapshot` global
5. le strap emet des events cibles persos
6. chaque perso applique sa transformation locale

## Exemple concret ultra-minimal

Scene avec 2 persos:

- `hero-title` (`text`)
- `hero-image` (`img`)

Event entrant:

```json
{
  "name": "runtime:viewport:changed",
  "data": {
    "width": 360,
    "height": 640,
    "scrollY": 120,
    "orientation": "portrait"
  }
}
```

Snapshot style calcule par strap:

```json
{
  "byPersoId": {
    "hero-title": {
      "position": "absolute",
      "left": "16px",
      "top": "24px",
      "x": 0,
      "y": 0,
      "scale": 0.92
    },
    "hero-image": {
      "position": "absolute",
      "left": "0px",
      "top": "140px",
      "width": "360px",
      "height": "220px",
      "x": 0,
      "y": 0
    }
  }
}
```

Events emis vers persos:

```json
[
  {
    "name": "hero-title",
    "data": {
      "style": {
        "position": "absolute",
        "left": "16px",
        "top": "24px",
        "x": 0,
        "y": 0,
        "scale": 0.92
      }
    }
  },
  {
    "name": "hero-image",
    "data": {
      "style": {
        "position": "absolute",
        "left": "0px",
        "top": "140px",
        "width": "360px",
        "height": "220px",
        "x": 0,
        "y": 0
      }
    }
  }
]
```

Application par perso:

- `text/img/list`: applique directement `style` (CSS standard + `x`/`y` animejs)
- `rich-media/threejs`: mappe `style` vers camera/viewport interne

## Pourquoi ce modele est scalable

- un seul point de calcul global
- adaptation locale par type de perso
- pas de logique responsive complete dupliquee dans tous les persos

## Regles proposees pour la spec

1. `runtime:viewport:changed` (incluant resize/scroll/orientationchange) est non narratif (volatile)
2. ces events sont traces mais non re-joues comme events metier
3. les persos exposent une action commune `style` (ou alias type-specific)
4. `rebuild("full")` reste un fallback technique, pas le flux nominal

## Bloc pret a inserer (resume)

"Le runtime traite `resize/scroll/orientationchange` via events volatils systeme. Le calcul de style est centralise dans un module layout, qui emet des patchs `style` conformes CSS, avec enrichissements animejs (`x`, `y`) pour la translation. Chaque perso applique le patch selon son adaptateur de rendu."
