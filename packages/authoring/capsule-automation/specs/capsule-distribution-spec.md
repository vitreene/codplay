# Spec — Distribution capsule et bornes des enfants

Statut : vérifié — `CapsuleDistribution`, `CapsulePreset`, `TransitionTiming` et
`CapsuleBounds` (`src/timing/`), tests `tests/capsule-distribution.spec.ts`,
`tests/capsule-preset.spec.ts`, `tests/transition-timing.spec.ts`,
`tests/capsule-bounds.spec.ts`.

Capsule Automation est l’unique propriétaire de la résolution des bornes des enfants
d’une capsule : fenêtre, distribution, verrous, transition effective. Les appelants
(aperçu d’une timeline, Builder d’une scène) lisent le même résultat et ne recalculent
rien. Toutes les entrées sont primitives ; aucun type d’éditeur n’est importé.

---

## 1. Vocabulaire

| Terme | Définition |
|---|---|
| **borne** | Intro (première) ou outro (dernière) d’un enfant. Elle porte trois attributs indépendants : placement, décor, transition — chacun hérité ou fixé par l’auteur. Le décor n’est pas du ressort de ce module. |
| **borne implicite** | Aucun attribut fixé : instant et transition hérités de la capsule. |
| **borne liée** | Placement hérité (instant calculé par la distribution), mais l’auteur possède d’autres attributs de la borne (sa transition, ici). Elle ne verrouille pas l’enfant. |
| **borne verrouillée** | Instant fixé par l’auteur ; prioritaire sur la distribution. |
| **fenêtre** | Intervalle de présence d’un nœud : du début de sa transition d’entrée à la fin de sa transition de sortie. |
| **distribution** | Règle par laquelle une capsule alloue sa fenêtre à ses enfants. |
| **créneau** | Intervalle `[introMs, outroMs]` rendu par `CapsuleDistribution` : début de la transition d’entrée, début de la transition de sortie, relatifs au début de la fenêtre de la capsule. |

---

## 2. Fenêtre d’une capsule

Une capsule distribue à ses enfants **sa propre fenêtre de présence**, qu’elle soit
elle-même verrouillée ou héritée : de `intro.timeMs − durée d’entrée` à
`outro.timeMs + durée de sortie`. Ainsi, la transition d’entrée de la capsule fait
apparaître les enfants qui démarrent avec elle. Les instants des enfants ne
définissent pas la fenêtre de leur capsule.

La racine de scène est une capsule implicite sans bornes propres. Sa fenêtre est
`[−preRollMs, max(durationMs, dernière borne verrouillée d’un enfant de la racine)]`
(§5).

### 2.1 Contrainte de durée minimale

`minDurationMs = max(lockedOutroMs)` parmi les enfants dont l’outro est verrouillée,
relatif au début de la fenêtre de la capsule ; `0` sans outro verrouillée. Seules les
outros verrouillées contraignent la durée. `CapsuleBounds` la rend pour chaque capsule
(`ResolvedCapsuleBounds.minDurationMs`).

---

## 3. Modes de distribution

### 3.1 Mode séquentiel (carousel)

Les enfants se succèdent sans chevauchement. Les enfants libres se partagent le temps disponible en parts égales.

```
fenêtre = [0, 8s], 4 enfants libres
→ chacun 2s : [0,2], [2,4], [4,6], [6,8]
```

### 3.2 Mode stagger

Les enfants apparaissent avec un décalage uniforme entre chaque entrée ; de même pour les sorties.

```
stagger_in_ms  : délai entre l'apparition de chaque enfant successif
stagger_out_ms : délai entre la sortie de chaque enfant successif (indépendant)
```

Calcul des créneaux (relatifs au début de la fenêtre) :

```
enfant[i].introMs  = i × stagger_in_ms
enfant[i].outroMs  = clip_duration − (N − 1 − i) × stagger_out_ms
```

**Si dépassement de la fenêtre** : un enfant dont `introMs ≥ clip_duration` n'apparaît pas.
Il est rendu avec `visible: false` ; idem si `outroMs ≤ 0`.

Une borne verrouillée remplace la valeur calculée de cette borne seulement ; l’index `i`
de l’enfant reste compté pour les autres.

### 3.3 Résolution du sous-type — `CapsulePreset`

`CapsuleDistribution` ne connaît aucun type de capsule : `mode` est un paramètre
d’entrée. `CapsulePreset` est le seul endroit où un type (`CapsuleKind`, alias de
`AutoCapsuleType`) devient un mode :

- un réglage `distribution` de l’auteur est repris tel quel ;
- sinon `carousel` donne `sequential` (sa grille à une cellule n’admet qu’un enfant
  visible à la fois) ;
- sinon aucun mode n’est déductible : `resolve()` lève une erreur, `find()` rend
  `undefined`.

Une borne verrouillée prime toujours sur le mode résolu.

---

## 4. Algorithme séquentiel avec bornes verrouillées

### 4.1 Ordre

`order` (`'forward'` par défaut, ou `'backward'`) est un réglage global fourni par
l’appelant, commun à toutes les capsules ; il ne concerne que le mode séquentiel.
« En avant » = premier affiché dans le temps : en `forward`, le premier enfant occupe
le premier créneau ; en `backward`, le dernier.

### 4.2 Mode `forward` — algorithme séquentiel gauche-droite

Placement en deux passes :

**Passe 1 — calcul du `share` :**
```
cursor = 0
committed = 0
freeCount = 0

pour chaque enfant en ordre de liste :
  intro = lockedIntroMs ?? cursor
  gap = intro − cursor          # espace vide si intro verrouillée > cursor
  committed += gap
  si lockedOutroMs défini :
    outro = max(intro, lockedOutroMs)
    committed += outro − intro
    cursor = outro
  sinon :
    freeCount += 1
    # cursor ne progresse pas (durée = 0 en passe 1)

share = max(0, clipDuration − committed) / freeCount   # ou 0 si freeCount=0
```

**Passe 2 — placement :**
```
cursor = 0
pour chaque enfant en ordre de liste :
  introMs = max(cursor, lockedIntroMs ?? cursor)
  outroMs = lockedOutroMs ?? introMs + share
  cursor = outroMs
```

**Exemple `forward`, img-1 intro verrouillée à 2s, clip 6s, 3 enfants libres en outro :**
```
Passe 1 : committed = 2 (gap), freeCount = 3, share = (6−2)/3 = 1.33s
Passe 2 :
  img-1 : intro=2s (verrouillée), outro=3.33s, cursor=3.33
  img-2 : intro=3.33s, outro=4.67s, cursor=4.67
  img-3 : intro=4.67s, outro=6s
```
Le gap [0, 2s] est vide — img-2 et img-3 restent après img-1.

**Exemple `forward`, img-1 outro verrouillée à 1.5s, clip 6s :**
```
Passe 1 : committed = 1.5 (img-1 verrouillée), freeCount = 2, share = (6−1.5)/2 = 2.25s
Passe 2 :
  img-1 : intro=0, outro=1.5s (verrouillée), cursor=1.5
  img-2 : intro=1.5s, outro=3.75s, cursor=3.75
  img-3 : intro=3.75s, outro=6s
```

### 4.3 Mode `backward` — algorithme séquentiel droite-gauche

Même logique mais le curseur part de `clipDurationMs` et recule. L'enfant d'index 0 (premier en liste) occupe le slot le plus à droite (dernier dans le temps) ; l'enfant d'index N-1 (dernier) occupe le slot le plus à gauche.

**Passe 1 :**
```
cursor = clipDurationMs
committed = 0
freeCount = 0

pour chaque enfant en ordre de liste (i=0..N-1) :
  outro = lockedOutroMs ?? cursor
  gap = cursor − outro          # espace vide à droite de cet enfant
  committed += gap
  si lockedIntroMs défini :
    intro = min(outro, lockedIntroMs)
    committed += outro − intro
    cursor = intro
  sinon :
    freeCount += 1
    cursor = outro              # cursor recule jusqu'à l'outro

share = max(0, clipDuration − committed) / freeCount
```

**Passe 2 :**
```
cursor = clipDurationMs
pour chaque enfant en ordre de liste :
  outroMs = lockedOutroMs ?? cursor
  introMs = lockedIntroMs ?? outroMs − share
  cursor = introMs
```

**Exemple `backward`, img-1 intro verrouillée à 2.5s, clip 6s, img-2 et img-3 libres :**
```
Passe 1 :
  img-1 : outro=6 (libre), gap=0 ; lockedIntro=2.5 → committed+=3.5, cursor=2.5
  img-2 : outro=cursor=2.5, gap=0, freeCount=1
  img-3 : outro=cursor=2.5, gap=0, freeCount=2
  share = (6−3.5)/2 = 1.25s

Passe 2 :
  img-1 : outro=6s (cursor), intro=2.5s (verrouillée), cursor=2.5
  img-2 : outro=2.5s, intro=1.25s, cursor=1.25
  img-3 : outro=1.25s, intro=0s, cursor=0
```
Résultat : img-3=[0,1.25], img-2=[1.25,2.5], img-1=[2.5,6].
img-2 et img-3 sont **avant** img-1 dans le temps.

---


---

## 5. Repères de temps

- `CapsuleDistribution` travaille en temps relatif au début de la fenêtre de la
  capsule, dans l’espace des créneaux.
- `CapsuleBounds` rend tous ses instants et fenêtres dans le temps de l’auteur, celui
  où `0` est le début de la scène.
- **Pré-roll** (`preRollMs`) : avance réservée avant `0` pour qu’aucune transition
  d’entrée n’ait à démarrer à un temps négatif dans le runtime. Valeur unique pour la
  scène : la plus longue durée d’entrée effective (explicite, sinon défaut de la
  capsule parente, sans fusion) parmi les intros verrouillées de tous les niveaux,
  quel que soit leur instant (`TransitionTiming.computeScenePreRollMs`). Un consommateur
  qui produit des instants runtime ajoute `preRollMs` à chaque instant rendu.

---

## 6. Transitions des bornes

### 6.1 Instants

L’instant d’une borne (`ResolvedBound.timeMs`) est celui d’un KF : une transition
d’entrée **se termine** à l’instant de l’intro (elle joue avant), une transition de
sortie **commence** à l’instant de l’outro (elle joue après). D’où, dans l’espace des
créneaux : `lockedIntroMs = instant − durée d’entrée effective` et
`lockedOutroMs = instant` (`TransitionTiming`). Une transition interpolée entre deux
KF quelconques suit la même règle selon `direction` (`before` : se termine au KF de
destination ; `after` : commence au KF source).

### 6.2 Transition effective

Pour chaque borne, dans cet ordre :

1. **Explicite** : la transition fournie par l’auteur sur la borne (verrouillée ou
   liée) est conservée, même au bord de la fenêtre — un choix de l’auteur prime sur un
   défaut. Un `cut` ou `--` explicite dure 0 ms.
2. **Fusionnée** (`source: 'fused'`, `ref: 'cut'`, 0 ms) : la borne est sur le bord de
   même nom de la fenêtre de sa capsule (écart nul) ; la transition de la capsule la
   couvre. Une borne verrouillée fusionne si son instant saisi est sur le bord ; une
   borne calculée, si son créneau commence (intro) ou finit (outro) sur le bord. **La
   racine ne fusionne jamais** : ses enfants gardent sa transition par défaut, jouée
   dans le pré-roll.
3. **Par défaut** : celle de la capsule parente, résolue comme `AutoCapsule`
   (`resolveAutoCapsuleDefaults`) — réglage de la capsule, sinon défaut du type, sinon
   défaut global ; durée lue dans le catalogue `DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`.
   Pour un type sans sortie générée (`generateDefaultOutro: false`, par ex. `rangee`,
   `liste`), l’outro par défaut n’a pas de transition (`ref: null`, 0 ms).

Exemple : carousel verrouillé à 1000–4000 ms sous la racine (fondus de 300 ms),
fenêtre `[700, 4300]`, deux enfants implicites. Le premier entre à 700 ms (fusionné)
et sort à 2500 ms avec fondu ; le second entre à 2800 ms (fondu de 2500 à 2800 ms) et
sort à 4300 ms (fusionné).

---

## 7. Résolution des bornes — `CapsuleBounds.resolve`

Pour une scène, de la racine vers les feuilles :

1. calcul du pré-roll (§5) et de la fenêtre de la racine (§2) ;
2. pour chaque capsule : préréglage (`CapsulePreset.find`), défauts de transition,
   verrous des enfants en espace de créneau (§6.1), `CapsuleDistribution.compute` avec
   l’ordre global ;
3. pour chaque enfant : transition effective (§6.2), instants, fenêtre, `visible` ;
4. pour chaque enfant capsule : même résolution dans sa fenêtre (§2).

Une capsule sans préréglage résoluble produit un diagnostic
`distribution-unresolved` ; ses enfants et son sous-arbre ne sont pas résolus. La
visibilité d’auteur d’un enfant n’est pas une entrée : un enfant masqué garde sa place
dans la distribution.

Le runtime ne voit que des bornes résolues : un consommateur qui construit une scène
pose chaque enfant sur `[window.startMs, outro.timeMs]` (plus le pré-roll) et exprime
une borne fusionnée par une transition `cut` explicite, pour qu’aucun défaut ne soit
synthétisé.

---

## 8. Interface

```typescript
type BoundTransitionInput = { ref: string | null; durationMs: number }
type BoundInput =
  | { timeMs: number; transition?: BoundTransitionInput }   // verrouillée
  | { linked: true; transition?: BoundTransitionInput }      // liée
type BoundsNodeInput = {
  id: string
  intro?: BoundInput        // absente = implicite
  outro?: BoundInput        // absente = implicite
  capsule?: BoundsCapsuleInput
}
type BoundsCapsuleInput = {
  kind: AutoCapsuleType
  distribution?: { mode: 'sequential' | 'stagger'; staggerInMs?: number; staggerOutMs?: number }
  defaultTransitionIn?: string | null
  defaultTransitionOut?: string | null
  children: BoundsNodeInput[]   // dans l’ordre de distribution
}

CapsuleBounds.resolve(input: {
  durationMs: number
  order?: 'forward' | 'backward'
  root: BoundsCapsuleInput
}): {
  preRollMs: number
  root: { window; minDurationMs } | undefined
  nodes: Map<string, {
    id: string
    intro: ResolvedBound
    outro: ResolvedBound
    window: { startMs: number; endMs: number }
    visible: boolean        // false si le créneau sort de la fenêtre de la capsule
  }>
  capsules: Map<string, { window; minDurationMs }>
  diagnostics: Array<{ code: 'distribution-unresolved'; capsuleId: string | null; kind; childCount; message }>
}

type ResolvedBound = {
  timeMs: number            // instant du KF (§6.1), temps de l’auteur
  origin: 'implicit' | 'linked' | 'locked'
  transition: { source: 'explicit' | 'default' | 'fused'; ref: string | null; durationMs: number }
}
```

`CapsuleDistribution.compute({ clipDurationMs, mode, order?, staggerInMs?,
staggerOutMs?, children: [{ trackId, lockedIntroMs?, lockedOutroMs? }] })` rend
`{ minDurationMs, children: [{ trackId, introMs, outroMs, visible }] }` en espace de
créneaux ; `visible` est faux si `introMs ≥ clipDurationMs` ou `outroMs ≤ 0`.

---

## 9. Verrouillage partiel et bornes liées

`lockedIntroMs` et `lockedOutroMs` sont indépendants : un enfant peut n’avoir qu’une
borne verrouillée. Une borne liée n’est pas verrouillée : son instant est calculé comme
celui d’une borne implicite ; seule sa transition explicite change.

| Cas | Mode `forward` | Mode `backward` |
|---|---|---|
| intro verrouillée, outro libre | Intro fixe ; outro = intro + share (cursor avance) | Intro fixe ; outro = cursor courant (cursor recule jusqu’à intro) |
| intro libre, outro verrouillée | Intro = cursor courant ; outro fixe (cursor avance) | Outro fixe ; intro = outro − share (cursor recule jusqu’à intro) |
| les deux verrouillées | Aucun calcul — l’enfant est entièrement figé | Idem |

Le `share` est calculé en passe 1 en tenant compte des écarts et des durées
verrouillées, quelle que soit la combinaison. En mode séquentiel, une intro
verrouillée antérieure au curseur est repoussée au curseur.
