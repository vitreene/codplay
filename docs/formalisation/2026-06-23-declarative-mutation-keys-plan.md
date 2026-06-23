# Plan : modèle déclaratif des clés d'action consommées (remplacer la whitelist `hasNonHtmlMutation`)

## Statut

Non démarré. Conception à valider avant toute implémentation. Découle de l'investigation des composants tiers figés (avatar3d, rive) : voir `v1-third-party-runtime-spec.md` (règle resolver passthrough) et l'encadré seek-fidélité.

## Problème

`htmlRenderMutationResolver` (`packages/codplay/src/runtime/html-render-mutation-resolver.ts`) décide, à la dernière étape avant `update()`, si une mutation « mute réellement quelque chose » ; sinon il la **droppe** (`resolveHtmlRenderMutations`, ligne ~334) :

```ts
if (!hasHtmlMutation(state) && !hasNonHtmlMutation(mutation)) continue
```

- `hasHtmlMutation` → clés DOM génériques : `style` / `attr` / `className`.
- `hasNonHtmlMutation` → **liste blanche codée en dur** : `move`, `content`, `src`, `alt`, `fitMode`, `broadcast`, `checked`, `disabled`, `visualState`, `canValidate`, `disableAnswers`, `showCorrection`, `selectedAnswerIds`, `correctAnswerIds`.

Cette liste est l'**union des clés internes de tous les composants natifs** (image/media : `src`/`alt`/`fitMode` ; input/form : `checked`/`disabled`/`visualState`/`canValidate`/…). Défauts :

1. **Anti-déclaratif** : la connaissance « quelles clés ce composant sait gérer » appartient au composant (ses services + modules + son `update()`), pas à un résolveur central. La whitelist duplique et centralise cette connaissance.
2. **Non extensible** : tout composant tiers ou toute capacité nouvelle pilotée par une clé custom (`viseme`, `gesture`, `blink`, `emotion`, `headDrift`, `breathe`…) est **silencieusement supprimé** car absent de la liste. C'est la cause exacte du gel d'avatar3d et rive (contourné aujourd'hui par un override `passThroughRenderMutationResolver`, qui désactive *aussi* la résolution de conflits — voir « Interaction » plus bas).
3. **Mélange de concerns** : la liste agrège des clés DOM-internes (`content`, `src`) et des clés de domaine (`canValidate`, `selectedAnswerIds`) sans distinction.

## Briques déclaratives existantes (à exploiter)

- **Services** (`component-services.ts`) : `services.declare([names])` fixe l'ordre des services ; le **nom du service = la clé d'action** qu'il consomme (`style`, `attr`, `className`, `content`). `apply()` n'applique que `patch[name]` pour les noms déclarés.
- **Modules** (`runtime-component-orchestrator.ts:356+`, type `RuntimeModuleMatch`) : `match.actionKeys` déclare les clés qui déclenchent les hooks d'un module (ex. `replaceModule` → `['replace']`), filtrées par `componentCapabilities`.
- **Trou** : les clés consommées **directement dans `update()`** (`viseme`/`gesture`/… pour avatar3d ; `viseme`/`emotion` pour rive ; `checked`/`disabled`/`visualState`/… pour input/form ; `content`/`src`/`alt`/`fitMode` pour text/image/media) ne sont déclarées nulle part formellement.

## Modèle proposé

**Principe** : une mutation est « effective » pour un composant si elle porte **au moins une clé que ce composant déclare savoir consommer**. La décision consulte l'ensemble déclaré **par le composant cible**, jamais une liste globale.

Ensemble des clés consommées par un composant = union de :
1. les **noms de services déclarés** (`services` — déjà disponible) ;
2. les **`match.actionKeys`** des modules attachés à ce composant (déjà disponible côté orchestrateur) ;
3. une **déclaration explicite des clés consommées par `update()`** — la pièce manquante à ajouter au contrat composant (remplace la whitelist).

### Option A (recommandée) — déclaration portée par le composant

Ajouter au contrat `RuntimeComponentClass` une déclaration statique des clés gérées directement par `update()`, ex. :

```ts
static readonly actionKeys: readonly string[] = ['content']   // TextComponent
static readonly actionKeys = ['src', 'alt', 'fitMode']        // ImageComponent
static readonly actionKeys = ['viseme','morph','gesture','gaze','mood','blink','headDrift','breathe'] // avatar3d
```

L'orchestrateur agrège, par perso : `actionKeys(class) ∪ servicesDeclared ∪ moduleActionKeys`. La décision « mutation effective » se fait là où le composant est connu (`routeResolvedUpdate` a déjà `componentByPersoId.get(...)`), pas dans le résolveur HTML.

Conséquence : le **résolveur ne fait plus que de la résolution de conflits** (style/attr/className same-tick). Le filtrage « mutation vide » devient une question posée au composant (« consommes-tu une de ces clés ? »). `passThroughRenderMutationResolver` n'est alors plus nécessaire pour avatar3d/rive — ils sont gérés par le même mécanisme déclaratif que les natifs.

### Option B — déclaration via services uniquement

Étendre `services.declare` pour couvrir aussi les clés non-service (créer des services « passifs » par clé de domaine). Plus lourd : force à modéliser chaque clé d'update comme un service. Écartée a priori (sur-modélisation), gardée comme repli.

## Interaction avec les deux corrections déjà en place

- L'override `static renderMutationResolver = passThroughRenderMutationResolver` sur `Avatar3DBaseComponent` / `RiveBaseComponent` est un **contournement** : il évite le drop mais **désactive aussi la résolution de conflits same-tick** pour ces composants. Le modèle déclaratif rendrait ces overrides inutiles (à retirer une fois en place) et rétablirait la résolution de conflits pour eux.
- Le second filtre `hasNormalOps` dans `create-player.ts:runTimelineEvent` (~ligne 1372) classe tween/tween-stop/normal pour décider d'enfiler le commit — **indépendant** de ce sujet, à ne pas confondre.

## Migration

1. Déclarer les clés d'`update()` sur chaque composant natif (`text`→`content` ; `img`→`src`/`alt`/`fitMode` ; `media`→`src`/`broadcast`/… ; `input`/`form`→`checked`/`disabled`/`visualState`/`canValidate`/`disableAnswers`/`showCorrection`/`selectedAnswerIds`/`correctAnswerIds` ; `list`/`layout`→ leurs clés ; `move` est générique, géré par le move-router — à statuer).
2. Construire l'ensemble agrégé par perso dans l'orchestrateur.
3. Remplacer le test `!hasHtmlMutation && !hasNonHtmlMutation` par « la mutation porte ≥1 clé HTML **ou** ≥1 clé déclarée par le composant cible ».
4. Supprimer `hasNonHtmlMutation` et les overrides passthrough avatar3d/rive.
5. Tests : un par catégorie (natif content/src, custom viseme, input checked) vérifiant qu'une mutation à clé déclarée atteint `update()` et qu'une mutation à clé inconnue est bien droppée.

## Points ouverts / risques

- **`move`** : clé générique consommée par le move-router de l'orchestrateur, pas par `update()`. À traiter comme clé toujours-effective (hors déclaration composant) ou déclarée par tous.
- **Périmètre du refacto** : touche le cœur runtime (resolver + orchestrateur + tous les composants natifs) → repasser l'intégralité de la suite `codplay` (pas seulement les lots ciblés) ; les gates lot7/lot8/lot18 doivent rester verts.
- **Où poser la décision « effective »** : dans l'orchestrateur (a le composant) vs dans le resolver (faudrait lui injecter l'ensemble de clés). Recommandation : orchestrateur.
- **Compat seek** : le drop participe à ne pas matérialiser de commits vides ; vérifier que la nouvelle règle ne change pas ce qui est matérialisé sur les tracks (sinon impact seek).
