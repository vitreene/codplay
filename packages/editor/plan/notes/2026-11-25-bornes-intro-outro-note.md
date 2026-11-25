# Bornes d’existence, KF virtuels et transitions d’apparition — note de référence

Synthèse au 2026-11-25 des specs, des notes historiques, du code et des décisions de
l’utilisateur sur l’entrée et la sortie d’un item. Elle sert de base au
[plan d’application](../2026-11-25-bornes-intro-outro-plan.md). Les comportements
vérifiés restent décrits par les specs citées ; cette note rassemble, compare et
signale les écarts.

## 1. Bornes et fenêtre d’existence

- Intro et outro ne sont pas des types : ce sont le premier et le dernier KF de
  canal `pose` selon `timeMs`. Les noms `intro`/`outro` sont des étiquettes
  d’outillage ([modèle de document](../../specs/editor-document-model-spec.md),
  [distribution §2](../../../authoring/capsule-automation/specs/capsule-distribution-spec.md)).
- Les KF `decor` restent dans la fenêtre et ne la créent ni ne la prolongent.
- Hors de ses bornes, l’item n’existe pas (D-NAISS) ; la fenêtre effective est
  l’intersection de ses bornes et de la fenêtre calculée par sa capsule parente.
- Un item sans KF de pose est présent sur toute la fenêtre héritée ; avec un seul
  KF réel, celui-ci fixe l’entrée et la capsule fournit la sortie (pas de fenêtre de
  durée nulle).
- La capsule racine implicite (`rootCapsule`, comportement `card`) n’est pas un item
  affiché ; sa fenêtre est `[0, durée de la scène]`.
- Un item naît à la tête de lecture : à la création, l’intro est un KF réel à cet
  instant, sur le décor initial, et l’outro reste calculée (D-NAISS,
  [plan de revue](../2026-11-24-revue-interface-items-plan.md)).
- Entrer dans une capsule à placement temporel automatique désactive le placement
  temporel propre de l’item (ses bornes deviennent liées) ; une seconde action
  intentionnelle l’en libère. Le dépôt place aussi l’item dans la zone par défaut de
  la capsule. Une création dans une telle capsule fait naître l’intro liée. Exception :
  capsule à placement libre, c’est-à-dire le mode « Libre » (grille 1 × 1) et sa
  variante à grille fine (90 × 160, cellules trop petites pour un item, placement par
  spans) — les deux modes de la racine (utilisateur, 2026-11-25).
- Quand la fenêtre d’un item est recalculée, ses KF intermédiaires gardent leur position
  relative (compression ou élargissement à proportion). Un KF rattaché à un marqueur
  garde son lien et son instant ; hors de la fenêtre, il devient indisponible (conservé,
  ignoré au build, signalé), jamais effacé (utilisateur, 2026-11-25).

## 2. Trois attributs d’une borne

Décision de l’utilisateur (2026-11-25) : une borne n’est jamais entièrement
« virtuelle ». Elle porte trois attributs indépendants, chacun hérité de la capsule
parente (qui peut elle-même hériter) ou fixé par l’auteur :

| Attribut | Hérité | Fixé par l’auteur | Modèle actuel |
| --- | --- | --- | --- |
| Placement temporel | calculé par la distribution de la capsule | instant verrouillé (« enfant locké » sur cette borne) | seul « fixé » existe : tout `Keyframe` stocké a un `timeMs` et verrouille la borne |
| Décor | celui que montre l’item à cet instant (KF réel voisin ou décor initial) | décor propre | seul possible avec un KF stocké, donc verrouillé |
| Transition d’apparition/disparition | défaut de la capsule (réglage, sinon type, sinon global) | `transitionIn` (intro) / `transitionOut` (outro) explicite | existe |

Conséquence : le modèle ne sait pas représenter « décor propre, placement hérité ».
La spec de distribution (§9.2) lie la matérialisation au verrouillage ; c’est ce lien
que la décision du 2026-11-25 dissocie.

## 3. KF virtuels : calcul et matérialisation

- **Propriétaire attendu** (utilisateur, 2026-11-25) : le calcul des bornes est censé
  être assuré par Capsule Automation, qui porte déjà ce que la capsule pousse sur ses
  enfants (grille, placement, transitions par défaut, catalogue).
- **État actuel** : le plan de réconciliation du 2026-07-08 a fait l’inverse. Il a
  retiré le calcul temporel de Capsule Automation (`resolveAutoCapsuleTiming` n’est
  plus qu’une recopie du `timeRange` fourni) et désigné `CapsuleDistribution`
  (`@codplay/scene-factory`) comme seule référence, parce que la timeline l’utilisait
  déjà pour l’aperçu. Historique : `git show 090e87fe^:packages/editor/plan/modules/2026-07-08-capsule-automation-reconciliation-plan.md`.
- `CapsuleDistribution.compute()` calcule les bornes des enfants à partir de la durée
  du clip, du mode (`sequential`/`stagger`), de l’ordre et des bornes verrouillées
  (`lockedIntroMs`/`lockedOutroMs`, indépendantes par borne, §11). Fonction pure.
  `TransitionTiming` (retranche la durée d’entrée : une intro « se termine » à son KF)
  et `CapsulePreset` sont aussi purs. Depuis le 2026-11-25, ces trois modules et
  leur spec sont dans Capsule Automation (`src/timing/`,
  [spec de distribution](../../../authoring/capsule-automation/specs/capsule-distribution-spec.md)),
  hors de `scene-factory`, qui dépend de `codplay-v1` (obsolète).
- La « source unique » n’est vraie qu’au niveau de `compute()` : la timeline
  (`computeVirtualKeyframes`, `sequence-editor/machine.ts`) et le Builder
  (`resolveCapsuleDistribution`, `build-scene.ts`) préparent chacun leurs entrées
  (racine, ordre, durée d’entrée, défauts de transition) — d’où E8 et l’écart du §6.
- Matérialisation existante : glisser ou double-cliquer une borne virtuelle
  (`materializeVirtualKeyframe`, `mount.ts`) crée un KF réel verrouillé ; Échap avant
  le lâcher annule. Play, Seek, rebuild, resize et sélection ne matérialisent jamais.
- Le runtime ne voit que des bornes résolues (distribution §7).

## 4. Transitions

- **Nommée** (`kind: 'named'`, `name`, `durationMs`) : apparition/disparition sur
  le premier/dernier KF de pose. `transitionIn` se termine au KF, `transitionOut`
  commence au KF. Les propriétés animées vivent dans le preset, jamais dans le décor.
- **Interpolée** (`kind: 'interpolated'`, `durationMs`, `easing`, `direction`
  `before`/`after`) : transition d’état entre deux événements d’un même canal,
  raccourcissable d’un côté. Une première intro interpolée est refusée
  (`EDITOR_V2_FIRST_INTRO_UNSUPPORTED`).
- Exclusivité : sur un même segment, `transitionOut` de la source et `transitionIn`
  de la destination ne coexistent pas.
- Défauts : Capsule Automation synthétise l’événement manquant aux bornes du
  `timeRange` de l’enfant avec la transition de la capsule — réglage de la capsule
  (`defaultTransitionIn`/`Out`), sinon défaut du type, sinon défaut global
  ([spec Capsule Automation](../../../authoring/capsule-automation/specs/capsule-automation-spec.md)).
  Défauts par type (spec capsule historique) : `carousel`, `grille`, `card`
  `fade`/`fade` ; `rangee`, `liste` `fade`/aucune sortie.
- Catalogue (`DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`) : `cut` (0 ms), `fade`,
  `swipe-left|right|top|down`, `zoom` (300 ms) ; `--` est la sentinelle « aucune ».
- **Fusion aux bords d’une capsule** (précisée par l’utilisateur le 2026-11-25) :
  quand la borne d’un enfant coïncide avec la borne de même nom de sa capsule (écart
  de temps nul), la transition de la capsule couvre l’enfant ; l’enfant ne reçoit
  pas, par défaut, de transition propre. Exemple : un fondu d’entrée sur la capsule
  la fait apparaître avec son premier enfant, qui démarre avec elle. Un enfant qui
  démarre plus tard (mode séquentiel, décalage de stagger) garde la transition
  héritée. Une transition explicite posée par l’auteur sur l’enfant est conservée :
  un choix de l’auteur prime sur un défaut (décision du 2026-11-25 ; la spec de
  grille historique l’annulait en `cut`). La règle relève des réglages de Capsule
  Automation, pas d’une condition codée dans le Builder. Non implémentée aujourd’hui.
- Décidé mais non implémenté (spec de grille historique) : `Sustain` (comportement
  continu entre deux KF, hors décor).

## 5. Représentation dans la timeline

- Voulue : chaque transition dessinée en rampe (triangle et surface reliant
  l’extrémité de la transition au KF) ; « existant dans la version d’origine de
  l’éditeur (hors de ce dépôt), à reconstruire » (spec de grille historique, §2.2).
- Actuelle (`render/track-row.ts`) : un rectangle semi-transparent, seulement pour les
  transitions explicites des KF stockés ; rien pour les transitions héritées ni pour
  les bornes virtuelles. Bornes : demi-losanges, pleins pour une borne réelle, creux
  pour une virtuelle ([spec d’intégration](../../specs/editor-v2-integration-spec.md)).

## 6. Écarts constatés

- **E8** : la timeline recalcule la distribution « à sa façon » (racine codée en dur
  `card` / `stagger 0`, ordre lu dans une constante d’affichage).
- **Transition effective d’une borne** : le Builder retranche la durée de la
  transition par défaut de la capsule pour verrouiller une intro sans transition
  explicite (`resolveIntroDuration` avec `transitionDefaults`) ; la timeline ne
  retranche que celle d’une transition nommée explicite. Ni l’un ni l’autre
  n’applique la fusion aux bords d’une capsule (§4). La transition effective d’une
  borne (explicite, héritée, ou absorbée par la capsule) doit donc être résolue une
  seule fois, puis servir au placement, au Builder et à l’affichage.
- **D-HORS-PLAGE** : une action hors de la fenêtre doit recaler la tête sur la borne la
  plus proche ; aujourd’hui elle écrit le décor initial ou celui du dernier KF réel.
- **Édition des transitions** : le type et les commandes existent
  (`setKeyframeTransitionIn/Out`), sans interface.

## 7. Historique et sources

- Specs historiques retirées par le commit `090e87fe` (« nettoyage docs ») :
  `plan/2026-06-11-sequence-editor-grid-spec.md` (§2.2 transitions, §2.3
  copy-on-write, §2.4 bornes V2, §2.4.1 bornes virtuelles) et
  `plan/2026-07-08-capsule-spec.md` (sous-types, défauts, catalogue). Lecture :
  `git show 090e87fe^:<chemin>`.
- La « version qui fonctionnait » (rampes de transition) est hors de ce dépôt.
- Décisions utilisateur : D-NAISS, D-HORS-PLAGE et principe directeur « Décor et item »
  ([plan de revue](../2026-11-24-revue-interface-items-plan.md)) ; trois attributs
  d’une borne (2026-11-25, §2 ci-dessus).
