# Spec — Distribution capsule et keyframes virtuels

Date : 2026-06-12  
Statut : validé — spec complète

---

## 1. Vocabulaire

| Terme | Définition |
|---|---|
| **kf réel** | Keyframe stocké dans `TrackNode.keyframes[]`, résulte d'une action auteur explicite |
| **kf virtuel** | Position calculée par le module de distribution, non stockée, rendue visuellement distincte dans l'éditeur, résolue en kf concret au build |
| **clip capsule** | Paire de bornes premier/dernier keyframe de la capsule — définit quand elle apparaît dans la scène ; les labels `intro`/`outro` sont optionnels |
| **distribution** | Règle par laquelle la capsule alloue son clip aux enfants |
| **slot** | Fenêtre de temps libre entre deux bornes lockées (ou bords du clip capsule) |
| **enfant locké** | Enfant dont au moins une borne premier/dernier kf est réelle — ses bornes sont prioritaires |
| **enfant libre** | Enfant sans kf réel — ses bornes sont entièrement virtuelles |

---

## 2. Modèle de clip capsule

Le clip d'une capsule est défini par le premier et le dernier kf, ordonnés par `timeMs`, sur sa
propre ligne. Les noms réservés `intro`/`outro` restent des labels d'outillage et ne sont pas
nécessaires pour que les bornes soient actives :

```
intro.timeMs  →  point de départ (absolu, dans le temps de la scène)
outro.timeMs  →  fin du clip
durée         =  outro.timeMs − intro.timeMs
```

**La durée est ce qui est contraint** — le point de départ peut être déplacé librement. Avec un seul
kf réel, le caller verrouille l'entrée et laisse la distribution fournir la sortie virtuelle ; il
n'ancre pas les deux bornes au même instant.

### 2.1 Contrainte de durée minimale

La durée capsule ne peut pas descendre en dessous de :

```
min_duration = max(enfant_locké.outro_relatif)
```

où `outro_relatif = enfant.outro.timeMs − capsule.intro.timeMs`.

Si aucun enfant n'est locké, il n'y a pas de contrainte de durée minimale.

Lorsque l'auteur tente de réduire la durée capsule en dessous de cette limite,
le déplacement de l'outro est bloqué à `intro.timeMs + min_duration`.

---

## 3. Modes de distribution

Le mode de distribution est une propriété de la capsule, configurée via un module métier externe (hors scope de ce projet).

### 3.1 Mode séquentiel (carousel)

Les enfants se succèdent sans chevauchement. Les enfants libres se partagent le temps disponible dans leur slot en parts égales.

```
capsule clip = [0, 8s], 4 enfants libres
→ chacun 2s : [0,2], [2,4], [4,6], [6,8]
```

### 3.2 Mode stagger

Les enfants apparaissent avec un décalage uniforme entre chaque entrée ; de même pour les sorties.

```
stagger_in_ms  : délai entre l'apparition de chaque enfant successif
stagger_out_ms : délai entre la sortie de chaque enfant successif (indépendant)
```

Calcul des positions (temps relatif à l'intro capsule) :

```
enfant[i].introMs  = i × stagger_in_ms
enfant[i].outroMs  = clip_duration − (N − 1 − i) × stagger_out_ms
```

**Si dépassement de clip** : un enfant dont `introMs ≥ clip_duration` n'apparaît pas.
Son kf virtuel intro est rendu en warning (hors cadre). Idem si `outroMs ≤ 0`.

Les enfants lockés sont exclus du calcul de stagger et conservent leurs bornes réelles.  
La spec du stagger en présence d'enfants lockés est à enrichir ultérieurement.

### 3.3 Résolution du sous-type — entièrement à `sequence-editor`

`CapsuleDistribution` ne connaît **aucun** `CapsuleKind`/sous-type de capsule — `mode` est un paramètre d'entrée obligatoire (§8), jamais inféré depuis un type de capsule à l'intérieur de cette classe. « Carousel » est d'abord un concept destiné à l'auteur (le nom qu'il choisit dans l'interface) — sa résolution en un mode concret (`sequential`, sa grille forcée à une cellule unique n'admettant qu'un enfant visible à la fois) a lieu **au plus tôt côté `sequence-editor`**, qui appelle ensuite `compute()` avec un `mode` déjà résolu, jamais avec le sous-type lui-même.

Pour tout autre sous-type (`rangee`/`grille`/`card`/`liste`, tous à plusieurs cellules), il n'existe aucun mode déductible du seul sous-type — le choix (`sequential` vs `stagger`, et ses valeurs) vient de l'auteur (`CapsulePatch.sequencing`), résolu lui aussi côté `sequence-editor`. Une future interface pourra proposer des presets par disposition (ex. « ligne = 1×3, stagger:2 ») — des valeurs par défaut d'interface, arbitraires et modifiables par l'auteur, jamais une constante figée dans `CapsuleDistribution` ou le Builder.

Un enfant locké (kf réel sur au moins une borne) prime toujours sur le mode résolu, quel qu'il soit — c'est un réglage d'auteur explicite, jamais écrasé.

---

## 4. Algorithme d'adaptation — mode séquentiel avec enfants lockés

### 4.1 Propriété `order` — configuration globale

La propriété `order` est une **option d'initialisation du composant éditeur**, commune à toutes les capsules de la scène. Elle contrôle l'ordre temporel d'affichage des enfants :

| Valeur | Sens | Comportement par défaut (sans locks) |
|---|---|---|
| `'forward'` (défaut) | premier élément en avant | img-1 occupe le premier slot (début du clip) |
| `'backward'` | dernier élément en avant | img-N occupe le premier slot ; img-1 est le dernier |

"En avant" = premier affiché dans le temps = occupe le slot le plus tôt.

Emplacement dans la machine : `DisplayConfig.capsuleOrder`. Valeur par défaut : `'forward'`.

### 4.2 Mode `forward` — algorithme séquentiel gauche-droite

Placement en deux passes :

**Passe 1 — calcul du `share` :**
```
cursor = 0
committed = 0
freeCount = 0

pour chaque enfant en ordre de liste :
  intro = lockedIntroMs ?? cursor
  gap = intro − cursor          # espace vide si intro lockée > cursor
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

**Exemple `forward`, img-1 intro lockée à 2s, clip 6s, 3 enfants libres en outro :**
```
Passe 1 : committed = 2 (gap), freeCount = 3, share = (6−2)/3 = 1.33s
Passe 2 :
  img-1 : intro=2s (lockée), outro=3.33s, cursor=3.33
  img-2 : intro=3.33s, outro=4.67s, cursor=4.67
  img-3 : intro=4.67s, outro=6s
```
Le gap [0, 2s] est vide — img-2 et img-3 restent après img-1.

**Exemple `forward`, img-1 outro lockée à 1.5s, clip 6s :**
```
Passe 1 : committed = 1.5 (img-1 lockée), freeCount = 2, share = (6−1.5)/2 = 2.25s
Passe 2 :
  img-1 : intro=0, outro=1.5s (lockée), cursor=1.5
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

**Exemple `backward`, img-1 intro lockée à 2.5s, clip 6s, img-2 et img-3 libres :**
```
Passe 1 :
  img-1 : outro=6 (libre), gap=0 ; lockedIntro=2.5 → committed+=3.5, cursor=2.5
  img-2 : outro=cursor=2.5, gap=0, freeCount=1
  img-3 : outro=cursor=2.5, gap=0, freeCount=2
  share = (6−3.5)/2 = 1.25s

Passe 2 :
  img-1 : outro=6s (cursor), intro=2.5s (lockée), cursor=2.5
  img-2 : outro=2.5s, intro=1.25s, cursor=1.25
  img-3 : outro=1.25s, intro=0s, cursor=0
```
Résultat : img-3=[0,1.25], img-2=[1.25,2.5], img-1=[2.5,6].
img-2 et img-3 sont **avant** img-1 dans le temps.

---

## 5. Temps relatif vs absolu

Toutes les positions de distribution sont exprimées **en temps relatif à `capsule.intro.timeMs`**.

Conversion pour le rendu dans l'éditeur :
```
position_absolue = capsule.intro.timeMs + position_relative
```

Lorsque le clip capsule est déplacé (intro changé), les kf virtuels des enfants suivent automatiquement sans recalcul de distribution.

---

## 6. Transitions nommées héritées

La capsule définit les transitions intro/outro appliquées aux enfants libres :

```
capsule.childDefaults.transitionIn  : TransitionDef | null
capsule.childDefaults.transitionOut : TransitionDef | null
```

Un enfant locké peut avoir ses propres transitions sur son premier/dernier kf réel (`transitionIn`/
`transitionOut`), qui priment. Lorsque la borne n'a pas de transition explicite, la transition
héritée reste attachée à la borne calculée ; déplacer le kf réel déplace donc son déclenchement sans
changer la durée configurée.

---

## 7. Résolution au build

**Les kf virtuels n'existent pas dans le rendu.**

Le Builder ed2 (`packages/editor/src/builder/`, pas le builder Codplay `packages/codplay/src/builder/`) résout les kf virtuels en kf concrets **avant** de construire le `SceneDoc` — pas lors d'une compilation `SceneDoc → CompiledScene`, qui reste une étape Codplay généraliste sans connaissance des capsules :

1. Pour chaque capsule avec un mode de distribution, le Builder appelle `CapsuleDistribution.compute()` (`packages/authoring/scene-factory/`).
2. Le module retourne les positions concrètes pour chaque enfant libre.
3. Le Builder pose ces positions comme `timeRange` réel sur chaque enfant (capsule-automation), puis comme eventimes réels dans le `SceneDoc` construit.
4. Le `SceneDoc` remis au builder Codplay ne contient que des kf concrets — aucune notion de virtual à ce stade.

L'éditeur travaille sur le `SceneDoc` (avec kf virtuels calculés à la volée pour le rendu).
Le runtime ne voit que des kf résolus.

---

## 8. Frontier projet / module métier

### sequence-editor (éditeur, aperçu) :

- Stocke les kf réels dans `TrackNode.keyframes`
- Appelle `CapsuleDistribution.compute()` pour obtenir les kf virtuels affichés dans l'aperçu
- Bloque le drag de la borne de sortie capsule à `borne_entree.timeMs + min_duration`
- Expose : `KEYFRAME.ADD`, `KEYFRAME.REMOVE`, `KEYFRAME.CLEAR_TRACK`, `KEYFRAME.CLEAR_CAPSULE`

### `CapsuleDistribution` (implémentée, `packages/authoring/scene-factory/capsule-distribution.ts`) :

- Reçoit : durée clip, mode, paramètres (stagger_in_ms, stagger_out_ms), kf réels des enfants
- Retourne : positions virtuelles + `min_duration`
- Appelée à la fois par sequence-editor (aperçu) et par le Builder ed2 (résolution finale, ci-dessous) — même calcul, une seule source de vérité, déclenché à chaque mutation de kf réels ou de clip capsule

### Builder ed2 (résolution finale, au build) :

- Résout les kf virtuels en kf concrets absolus (`{introMs,outroMs}` relatifs → `{startMs,endMs}` absolus)
- Transmet le résultat à capsule-automation (`AutoCapsuleChildInput.timeRange`) — cf `2026-07-08-capsule-automation-reconciliation-plan.md`

### Interface :

```typescript
interface CapsuleDistributionInput {
  clipDurationMs: number
  mode: 'sequential' | 'stagger'  // toujours explicite — résolu en amont par sequence-editor (§3.3), jamais inféré ici depuis un CapsuleKind
  order?: 'forward' | 'backward'  // global — fourni par l'éditeur via DisplayConfig.capsuleOrder
  staggerInMs?: number
  staggerOutMs?: number
  children: Array<{
    trackId: string
    lockedIntroMs?: number    // relatif, si kf réel
    lockedOutroMs?: number    // relatif, si kf réel
  }>
}

interface CapsuleDistributionOutput {
  minDurationMs: number       // = max(lockedOutroMs) parmi les enfants lockés
  children: Array<{
    trackId: string
    introMs: number           // relatif à capsule.intro — toujours défini
    outroMs: number           // relatif à capsule.intro — toujours défini
    visible: boolean          // false si introMs ≥ clipDurationMs ou outroMs ≤ 0
  }>
}
```

**`CapsuleDistribution` n'importe/ne déclare aucun `CapsuleKind`** — le vocabulaire des sous-types de capsule (`carousel`/`rangee`/`liste`/`grille`/`card`) et sa résolution vers un `mode` concret vivent entièrement dans `sequence-editor` (§3.3), jamais dans cette classe ni dans le Builder ed2. `compute()` reste une pure fonction de calcul temporel — `clipDurationMs`/`mode`/`children` — sans aucune connaissance du concept « capsule ».

---

## 9. Rendu des kf virtuels dans l'éditeur

### 9.1 Apparence

| État | Visuel |
|---|---|
| kf réel, dans les bornes parent | Diamant plein, couleur normale |
| kf réel, hors bornes parent | Diamant rouge (déjà implémenté) |
| kf virtuel, dans les bornes | Diamant creux (stroke uniquement) |
| kf virtuel, hors bornes parent (visible=false) | Diamant creux rouge / orange |

### 9.2 Matérialisation d'un kf virtuel

Lorsqu'un kf virtuel est glissé ou double-cliqué :
- `KEYFRAME.ADD` est envoyé avec la position du kf virtuel comme valeur initiale
- L'enfant devient locké sur cette borne
- Le module recalcule les positions des enfants libres restants

### 9.3 Structure dans le contexte machine

Les kf virtuels transitent via le contexte machine, calculés à chaque mise à jour de scène :

```typescript
// Dans MachineContext — non persisté, recalculé
virtualKeyframes: Array<{
  trackId: string
  id: string          // id synthétique (ex. "vkf-track-img-0-intro")
  timeMs: number      // absolu
  name: 'intro' | 'outro'
  visible: boolean    // false = hors clip capsule
}>
```

---

## 10. Reset et suppression

### 10.1 Supprimer un kf réel individuel

`KEYFRAME.REMOVE` → kf supprimé → enfant redevient libre sur cette borne → recalcul.

### 10.2 Effacer tous les kf réels d'un élément

`KEYFRAME.CLEAR_TRACK` (à ajouter) → supprime tous les kf réels d'une ligne → enfant entièrement libre.

### 10.3 Effacer tous les kf réels d'une capsule

`KEYFRAME.CLEAR_CAPSULE` (à ajouter) → reset complet : supprime kf réels de la capsule ET de tous ses enfants.

---

## 11. Lock partiel

`lockedIntroMs` et `lockedOutroMs` sont indépendants — un enfant peut n'avoir qu'une seule borne lockée.

| Cas | Mode `forward` | Mode `backward` |
|---|---|---|
| intro lockée, outro libre | Intro fixe ; outro = intro + share (cursor avance) | Intro fixe ; outro = cursor courant (cursor recule jusqu'à intro) |
| intro libre, outro lockée | Intro = cursor courant ; outro fixe (cursor avance) | Outro fixe ; intro = outro − share (cursor recule jusqu'à intro) |
| les deux lockés | Aucun calcul — l'enfant est entièrement figé | Idem |

Le `share` est calculé en passe 1 en tenant compte des gaps et des durées lockées, quelle que soit la combinaison.

**Contrainte de durée minimale** : seules les bornes outro lockées contraignent `min_duration` (les autres sont libres de s'adapter).

---

## 12. Modèle de snap 2D

Le snap lors du drag d'un kf est **sensible à la position verticale** du pointeur, pas seulement horizontale.

### Sources de snap

| Type | Portée verticale | Exemples |
|---|---|---|
| **Globale** | Toujours active (indépendante de la ligne) | Markers (`AuthorMarker`), playhead |
| **Ligne du haut** | Active quand le pointeur est dans la bande cues/markers | Cues texte, markers de la règle |
| **Par ligne** | Active quand le pointeur passe sur ou près de la ligne | kf réels, kf virtuels |

### Règle de déclenchement

Lors du drag d'un kf au pointeur `(ptrTimeMs, ptrY)` :

```
snap déclenché si :
  |source.timeMs − ptrTimeMs| < seuil_horizontal
  ET ( source.scope === 'global'
       OU |source.rowY − ptrY| < seuil_vertical )
```

`seuil_vertical` ≈ demi-hauteur de ligne, soit le pointeur doit être physiquement sur la ligne source ou sur une ligne adjacente.

### Conséquence pour les cues texte

Les cues du strip du haut snappent lorsque le pointeur est dans la bande cues, **ou** sont traités comme globaux si la règle du haut est considérée comme la ligne de référence principale (à confirmer à l'usage).

### Conséquence pour les kf virtuels

Les kf virtuels alimentent le snap grid exactement comme les kf réels. Le module de distribution les fournit avec leur `timeMs` ; la couche snap les inclut dans la grille avec leur `rowY`.

---

## 13. Statut des points ouverts

Tous les points fermés. Spec complète.
