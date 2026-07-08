# Spec — Capsule (ed2)

**Périmètre** : point d'entrée unique pour le concept de capsule dans ed2, fusionnant ce qui était réparti entre `2026-06-12-capsule-distribution-spec.md` (`packages/authoring/scene-factory/`), `2026-07-07-dedit-spec.md` §8 (`docs/formalisation/`), `2026-06-11-sequence-editor-grid-spec.md` (`docs/formalisation/`), `packages/authoring/capsule-automation/README.md` et `2026-07-03-selection-frame-variantes-plan.md` (`docs/plans/`). Ces documents restent la référence de détail sur leur périmètre propre (grid-editor, dedit, capsule-automation) ; le pourquoi des arbitrages qui suivent est conservé dans `notes/2026-07-08-capsule-spec-deliberation.md`.

Capsule est une notion **inconnue de Codplay** — c'est un concept d'authoring ed2 qui se résout, au build, en perso Codplay ordinaire.

---

## 1. Vocabulaire unifié

| Terme | Source | Définition |
|---|---|---|
| **capsule** | sequence-editor-grid-spec | `TrackNode` de `kind: 'capsule'`, portant un `capsuleType: CapsuleKind` |
| **sous-type de capsule** | `CapsuleKind` | Chaque valeur de `CapsuleKind` définit un comportement de grille propre et les propriétés CSS générables pour la capsule et ses enfants — voir §3 |
| **kf réel** | capsule-distribution-spec | Keyframe stocké dans `TrackNode.keyframes[]`, résulte d'une action auteur explicite |
| **kf virtuel** | capsule-distribution-spec | Position calculée par `CapsuleDistribution`, non stockée, résolue en kf concret au build |
| **clip capsule** | capsule-distribution-spec | Paire intro/outro de la capsule — quand elle apparaît dans la scène |
| **enfant locké / libre** | capsule-distribution-spec | Locké = au moins un kf réel sur une borne ; libre = bornes entièrement virtuelles |
| **`CapsulePatch`** | dedit-spec §8 | Réglages par défaut de la capsule, éditables (`behavior`, `sequencing`, `staggerMs`, `grid`…) |
| **zone** | plan zones (selection-frame) | Emprise nommée sur la grille de base d'une capsule : `{name,row,col,rowSpan,colSpan}` |
| **card** | dedit-spec §7 + `CapsuleKind` | Sous-type de capsule portant un ensemble de zones nommées (`ZoneDef`), éventuellement vide (chaque enfant résout alors vers la zone fantôme, §3/§11) ou enregistré comme preset réutilisable (titre/corps/footer) d'une capsule à l'autre. Même donnée, deux angles de vue : la table de zones et le sous-type de capsule qui la porte. Couvre aussi l'usage autrefois nommé `position` (fond layout sans zone) |
| **`CAPSULE_TYPE`** | capsule-automation | Registre de types capsule-automation, mêmes 5 valeurs que `CapsuleKind` (`legacy`, repli technique jamais sélectionnable par l'auteur, retiré) — voir §3 |
| **`GRID_MODE`** | capsule-automation | Mode de calcul de la grille d'une instance : `manual`/`forced`/`derived`/`list`, un par sous-type — voir §3/§4 |
| **eventTime** | capsule-automation | Ancrage temporel nommé générique — reçoit toujours un `ms` déjà résolu, jamais une cue directement (la résolution label→temps est interne à sequence-editor) |

## 2. Modèle éditeur (`sequence-editor`)

```ts
interface TrackNode {
  id: string
  kind: 'element' | 'capsule'
  // ... uniquement pour kind === 'capsule' :
  capsuleType?: CapsuleKind
  children?: TrackNode[]
}

type CapsuleKind = 'carousel' | 'rangee' | 'liste' | 'grille' | 'card'
```

`card` couvre aussi l'usage autrefois nommé `position` : une capsule `card` sans zone définie voit chaque enfant résoudre vers la zone fantôme (§3/§11), plein cadre — pas de « placement libre » ici, cette notion appartient à `grille` (coordonnées explicites sur une grille régulière, sans catalogue de zones nommées).

**Nommage** : l'anglais fait foi pour `carousel` (pas `carrousel`) — s'applique à `CapsuleKind` et à `CAPSULE_TYPE` (capsule-automation) : un seul mot dans les deux packages, y compris dans les exemples du README capsule-automation.

## 3. `CAPSULE_TYPE` — sous-types de capsule, comportements par défaut

| Sous-type (`CapsuleKind`) | `GRID_MODE` | Comportement | `placementPolicy` | intro/outro par défaut | `generateDefaultOutro` |
|---|---|---|---|---|---|
| `carousel` | `forced` | Grille forcée à 1×1 : tous les enfants occupent la même cellule, empilés, visibles à des instants différents | auto | fade/fade | true |
| `rangee` | `derived` | Une seule dimension, déduite de l'orientation et du nombre d'enfants visibles (ex. 1×5 en vertical, 5×1 en horizontal) | mixed | fade/null | false |
| `grille` | `manual` | Grille régulière explicite, `rows`×`cols` fournis ou défaut 9×16 | mixed | fade/fade | true |
| `card` | `manual` | Ensemble de zones nommées arbitraires (`row`/`col`/`rowSpan`/`colSpan`), plus une zone fantôme implicite couvrant toute la grille — jamais `grid-template-areas` littéral | explicitOnly | fade/fade | true |
| `liste` | `list` | Énumération séquentielle, une ligne par enfant — pas conceptuellement une grille, ajout/retrait géré nativement par le comportement dynamique du composant Codplay `list` | mixed | fade/null | false |

`legacy` (repli technique interne, jamais sélectionnable par l'auteur) est retiré : plus de type de repli, un `CapsuleKind` non reconnu est un cas d'erreur détecté par le moteur de validation (`2026-07-08-validation-engine-plan.md`), pas un comportement dégradé silencieux.

`placementPolicy: explicitOnly` — chaque enfant d'une `card` a toujours un placement explicite ; capsule-automation ne calcule jamais de placement automatique pour ce sous-type. Ce n'est pas une garantie ajoutée par le Builder : toute `card` porte une **zone fantôme** implicite, non nommée et non listée dans l'éditeur de zones, qui couvre la totalité de la grille (`row:1, col:1`, span égal à `rows`/`cols` — équivalent `1/-1` en CSS). Un enfant dont `DecorPatch.zone` est `null` (aucune zone réelle assignée) résout naturellement vers cette zone fantôme — y compris quand d'autres zones réelles existent déjà sur la même capsule, auquel cas il les recouvre entièrement. Un item peut y rester indéfiniment : c'est un rendu valide, pas seulement transitoire. Détail de construction : `2026-07-08-builder-plan.md` §5.

## 4. Grille — `GRID_MODE`

`GRID_MODE` (`AutoCapsuleGridInput.mode`) pilote seul la forme de la grille d'une capsule, un mode fixe par sous-type (§3) :
- `forced` : 1×1 imposé.
- `derived` : déduit de l'orientation + nombre d'enfants visibles.
- `manual` : `rows`/`cols` explicites ou défauts du sous-type.
- `list` : une ligne par enfant.

Le placement des enfants dans une zone (`card`, quand il y en a) se fait par `row`/`col`/`rowSpan`/`colSpan` sur une grille `manual` — jamais par `grid-template-areas` CSS littéral, qui interdirait le chevauchement que les zones permettent.

## 5. Mapping perso Codplay

Toutes les capsules, quel que soit leur `CapsuleKind`, compilent en perso de type `list`. Pas de mapping différencié par type (`layout` écarté : il exige des outlets nommés connus à l'avance dans un markup statique, incompatible avec un nombre d'enfants non borné et ajoutés librement). Le nesting `list`-dans-`list` n'a aucune restriction technique côté runtime Codplay.

Si un type de capsule s'avère mal servi par `list` à l'usage, un composant dédié sera construit à ce moment-là — le registre de types perso de Codplay est conçu pour cette extensibilité (`registerComponent`/`overrideComponent`).

## 6. La capsule racine — instance canonique

Toute scène ed2 a une capsule racine implicite (cf `2026-07-08-builder-plan.md` §3) :

- Type `card` (§3), zéro zone réelle définie — tout enfant résout donc systématiquement vers la zone fantôme (plein cadre), pas de zone prédéfinie par défaut.
- Jamais visible/sélectionnable comme item, non supprimable, pas de keyframe, pas de position propre.
- `move:'@root'` à la fois côté story et côté perso (double exigence Codplay).
- `flip:false` systématique sur les moves de ses enfants directs.

C'est la seule capsule dont l'existence est automatique — toute autre capsule est un item créé explicitement par l'auteur.

## 7. Pipeline de résolution

```
CapsulePatch (dedit, §10)                   CapsuleKind + enfants (sequence-editor)
        │                                              │
        └──────────────────┬───────────────────────────┘
                            ▼
              CapsuleDistribution.compute()   ← fait foi pour le timing (kf réels + virtuels)
                            │
                            ▼           {introMs, outroMs} par enfant, absolu
                  AutoCapsuleChildInput.timeRange (capsule-automation)
                            │
                            ▼
                    AutoCapsule.resolve()      ← catalogue de transitions, grid/placement, CSS
                            │
                            ▼
              eventimes + classes CSS + feuille de style
                            │
                            ▼
                        Builder → SceneDef
```

Détail du timing : `2026-06-12-capsule-distribution-spec.md`. Détail de la résolution capsule-automation : `2026-07-08-capsule-automation-reconciliation-plan.md`. Détail de la construction du `SceneDef` : `2026-07-08-builder-plan.md`.

## 8. Transitions nommées — catalogue complet

Source : `packages/authoring/capsule-automation/src/config/event-definitions.ts`. Chaque entrée : `{label, durationMs, style: {intro: {prop: {from?,to}}, outro: {...}}}`.

| Nom | Durée par défaut | Intro | Outro |
|---|---|---|---|
| `cut` | 0 | — | — |
| `fade` | 300 | `opacity {0→1}` | `opacity {→0}` |
| `swipe-left` | 300 | `opacity{0→1}, x{-250→0}` | `opacity{→0}, x{→-250}` |
| `swipe-right` | 300 | `opacity{0→1}, x{250→0}` | `opacity{→0}, x{→250}` |
| `swipe-top` | 300 | `opacity{0→1}, y{-250→0}` | `opacity{→0}, y{→-250}` |
| `swipe-down` | 300 | `opacity{0→1}, y{250→0}` | `opacity{→0}, y{→250}` |
| `zoom` | 300 | `opacity{0→1}, scale{0.2→1}` | `opacity{→0}, scale{→2.5}` |

`TransitionKey` (sequence-editor-grid-spec) : `'--' | 'cut' | 'fade' | 'swipe-left' | 'swipe-right' | 'swipe-top' | 'swipe-down' | 'zoom'` — correspond exactement à ce catalogue, `'--'` en plus (sentinelle UI « aucune transition », pas une vraie transition).

`ease` est facultatif dans le catalogue : absent si non fourni. Le Builder n'ajoute jamais de valeur par défaut de son cru (cf `2026-07-08-builder-plan.md`, Principe B) — un besoin réel se résoudrait en étendant ce catalogue ou en réglage éditeur.

## 9. `CapsuleDistribution` — résumé

Détail complet : `2026-06-12-capsule-distribution-spec.md`. Modes `sequential` (+ `order: forward/backward`, réglage global scène, pas par capsule) et `stagger` (`staggerInMs`/`staggerOutMs`). Lock indépendant par borne (`lockedIntroMs`/`lockedOutroMs`). Fait foi pour le timing final. Colocalisée avec `SceneDocEditor` dans `packages/authoring/scene-factory/`.

## 10. `CapsulePatch` — réglages éditables

```ts
interface CapsulePatch {
  behavior?: string
  defaultTransitionIn?: string
  defaultTransitionOut?: string
  sequencing?: 'sequential' | 'stagger'
  staggerMs?: number
  grid?: { rows?: number; cols?: number; gap?: string }
}
```

Défauts de la capsule — overridés par les choix individuels sur un enfant (kf réels). `sequencing` correspond exactement à `CapsuleDistributionInput.mode`. `order` (forward/backward) n'a volontairement pas d'équivalent ici : c'est un réglage global de scène (`DisplayConfig.capsuleOrder`), pas par capsule.

Panneau UI inexistant à ce jour (mécaniquement câblé côté dedit, zéro rendu — cf `2026-07-08-dedit-shadcn-ui-plan.md`). **Cette forme de `CapsulePatch` n'est pas encore reportée dans `docs/formalisation/2026-07-07-dedit-spec.md` §8 ni dans `packages/editor/src/decor-editor/types.ts`** (source de code actuelle) — à faire au moment du chantier UI dedit.

## 11. Zones

Une capsule de sous-type `card` porte des zones nommées (`ZoneDef{name,row,col,rowSpan,colSpan}`) — cf `2026-07-03-selection-frame-variantes-plan.md` et `2026-07-08-dedit-zonedef-migration-plan.md`. Une zone est référencée par nom par les enfants (`DecorPatch.zone: string | null`).

**Zone fantôme** : chaque `card` porte en plus une zone implicite, plein cadre, jamais nommée ni listée dans l'éditeur de zones — c'est elle que résout un enfant dont `DecorPatch.zone` vaut `null` (§3). Ce n'est pas un cas d'erreur : un enfant peut rester dans cet état indéfiniment, y compris aux côtés d'enfants placés dans de vraies zones (auquel cas il les recouvre).

**Première version** : le jeu de zones réelles d'une `card` est **fermé** — l'auteur choisit parmi les zones déjà définies sur cette capsule (celles d'une card appliquée, ou posées à la main), sans pouvoir en créer de nouvelles depuis cette capsule. Limite volontairement provisoire, à lever plus tard si les tests utilisateurs la montrent bloquante — pas une limite technique du modèle `ZoneDef`/capsule-automation, une restriction d'interface ed2 v1.

**Statut de ce paragraphe et du précédent** : posés sans contexte d'usage réel encore éprouvé — valeur illustrative pour raisonner, pas un réglage figé. À reconsidérer, potentiellement via de la config réglable plutôt qu'en dur, une fois un vrai usage testé.

## 12. Hors périmètre

Zones sur une capsule d'un autre sous-type (`carousel`, `rangee`, `grille`, `liste`) : les zones sont un concept réservé à `card`. La capsule racine, de sous-type `card`, n'en a pas par défaut.
