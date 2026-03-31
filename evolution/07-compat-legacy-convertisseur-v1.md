# Compat Legacy - spec convertisseur V1

## 1) Positionnement

Ce document definit la compatibilite legacy pour l'ancien format player (`persos` + `eventtimes`).

Regle cle V1:

- le moteur V1 ne consomme pas directement le legacy
- la compatibilite passe par un convertisseur externe
- aucune logique legacy cachee dans le runtime principal

Objectif:

- pouvoir reutiliser plus tard des snapshots legacy comme donnees de test
- garder une migration deterministe et diff-friendly

## 2) Entree / sortie du convertisseur

## 2.1 Entree legacy

```ts
type LegacyInput = {
  persos: Map<string, LegacyPerso> | Record<string, LegacyPerso>
  eventtimes: Map<number, LegacyEvent | LegacyEvent[]> | Record<number, LegacyEvent | LegacyEvent[]>
}

type LegacyEvent = {
  name: string
  start?: number
  data?: unknown
  duration?: number
}

type LegacyPerso = {
  type: string
  initial: Record<string, unknown>
  actions: Record<string, boolean | Record<string, unknown>>
  media?: Record<string, unknown>
}
```

## 2.2 Sortie V1

```ts
type ConvertedV1 = {
  scene: SceneDoc
  conversion: {
    warnings: ConversionWarning[]
    stats: {
      inputPersos: number
      outputItems: number
      inputEvents: number
      outputEvents: number
    }
  }
}
```

## 3) Regles de conversion (normatives)

Les regles suivantes sont identifiees pour faciliter les evolutions futures.

### RULE-L01 - Canonical ID item

- l'ID canonique item est `perso.initial.id` s'il existe
- sinon fallback sur la cle de map `persoKey`
- si les deux existent et different: conserver l'ID canonique + warning

### RULE-L02 - Mapping type

- `LIST` -> `list`
- `IMG` -> `img`
- `TEXT` -> `text`
- `VIDEO` -> `video`
- `SOUND` / `AUDIO` -> `audio`
- `SPRITE` -> `sprite`
- `LOTTIE` -> `lottie`
- inconnu -> `unknown` + warning

Note:

- le terme legacy `capsule` est conserve cote editeur
- cote moteur V1, le type rendu reste `list`

### RULE-L03 - Actions self-marker

- une action legacy `{ [itemId]: true }` est un marqueur
- conversion V1: action vide `{}` ou suppression explicite selon policy fixee
- par defaut V1: conserver en action vide pour garder la trace d'origine

### RULE-L04 - Event matching

- aucun renommage d'event legacy
- `event.name` est copie a l'identique
- matching moteur V1 reste exact (`event.name === actionKey`)

### RULE-L05 - Ordre des events

- trier par `ms` croissant
- a `ms` egal, conserver l'ordre d'arrivee de la collection legacy
- `index` global monotone par ordre final

### RULE-L06 - Doublons event

- les doublons `(ms, name)` sont supprimes pendant la conversion
- la premiere occurrence est conservee, les suivantes sont ignorees
- un warning `W_DUPLICATE_EVENT_SAME_MS_NAME` est ajoute pour chaque doublon supprime
- le dedupe est obligatoire en V1 (pas d'option pour le desactiver)

### RULE-L07 - Source track

- tous les events legacy convertis en `source='story'`
- insertion dans une track story unique active

### RULE-L08 - Parentage initial

- `initial.move: string` definit le parent initial d'un item
- si parent reference absent, creer un conteneur `list` synthetique
- exemple legacy frequent: `container-scene`

### RULE-L09 - Parentage temporel

- `action.move: string` est conserve tel quel
- aucune reecriture de nom d'ID
- validation post-conversion: toutes les cibles `move` doivent exister

### RULE-L10 - Children list

- pour chaque `list`, calculer `children[]` a partir des attaches initiales
- ordre recommande: `initial.style.order` puis `id` lexicographique
- les reparentings temporels restent dans les actions (pas dans `children`)

### RULE-L11 - Config list par defaut

Si un item converti est `type='list'` et n'a pas de config explicite:

```ts
list: {
  autoAnimate: {
    insert: true,
    remove: true,
    move: true,
    durationMs: 500,
    easing: 'ease-out'
  }
}
```

Note:

- le convertisseur n'ecrit pas de `layout` ni de `gap` dans `list`
- le layout visuel reste defini par CSS/editeur

### RULE-L12 - Media metadata legacy

- `perso.media` est conserve en metadata brute (ex: `media.legacy`)
- pas de reinterpretation agressive en V1
- les liens medias manquants restent acceptes pour les fixtures de test

### RULE-L13 - CSS classes et styles

- `initial.className`, `initial.style` et styles d'actions sont copies tels quels
- si des classes CSS sont absentes (fixtures), la conversion reste valide
- le rendu pourra etre visuel degrade, mais structurellement correct

### RULE-L14 - Scenario minimal

- en l'absence de stories legacy, creer une story unique (`story-main`)
- scenario minimal V1 (declaratif):
  - `initialNodeId = 'node-main'`
  - `nodes['node-main'] = { id: 'node-main', storyRef: { storyId: 'story-main', instanceId: 'story-main#1' }, transitions: [] }`
- aucune fonction runtime dans le scenario converti (document serialisable)

### RULE-L15 - Build stable IDs d'events

- `TimelineEvent.id` derive de `(ms, localIndex, globalIndex)`
- objectif: stabilite des snapshots convertis entre runs

## 4) Contrat de validation

Le convertisseur doit produire un rapport avec erreurs bloquantes et warnings.

Erreurs bloquantes minimales:

- `E_NO_PERSOS`
- `E_NO_EVENTTIMES`
- `E_ITEM_ID_MISSING`
- `E_EVENT_NAME_MISSING`

Warnings minimaux:

- `W_TYPE_UNKNOWN`
- `W_PARENT_SYNTHETIC_CREATED`
- `W_ID_CANONICAL_DIFFERENT_FROM_KEY`
- `W_DUPLICATE_EVENT_SAME_MS_NAME`

## 5) Structure de sortie recommandee

```ts
type SceneDoc = {
  id: string
  stories: Record<string, StoryDoc>
  scenario: ScenarioGraph
  tracks: Record<string, TrackDoc>
}
```

Notes:

- la forme `scenario` suit la norme `ScenarioGraph` V1
- pour le legacy, le convertisseur produit un graphe a un seul node par defaut
- reference de schema: `evolution/02-specifications-engine-v1.md` (section 2)

## 6) Cas de reference fournis (tests)

Les donnees utilisateur de reference comprennent:

- un `eventtimes` avec events systeme et contenu (`intro`, `outro`, `__scene_end__`, `custom__tween`)
- des `persos` mixtes (`LIST`, `IMG`, `TEXT`, `VIDEO`) dont:
  - `scene-sound__7`
  - `capsule__1`, `capsule__2`, `capsule__3`
  - `item__1`, `item__2`, `item__3`, `item__39`, `item__53`, `item__89`, `item__90`

Contraintes assumees sur ces fixtures:

- liens medias possiblement incomplets
- classes CSS non garanties

La conversion doit quand meme produire un `SceneDoc` valide et executable (hors rendu visuel complet).

### 6.1 Exemple de conversion `eventtimes`

Entree legacy (extrait):

```ts
new Map([
  [460, [
    { name: '__auto_capsule_3_item_5_intro_460-intro', start: 460 },
    { name: '3-003-donc-intro', start: 460 },
    { name: '3-003-donc-intro', start: 460 }
  ]]
])
```

Sortie attendue (extrait):

```ts
[
  { id: 'evt-460-0-0', ms: 460, name: '__auto_capsule_3_item_5_intro_460-intro', index: 0, source: 'story' },
  { id: 'evt-460-1-1', ms: 460, name: '3-003-donc-intro', index: 1, source: 'story' }
]
```

Points verifies:

- doublon supprime avec warning (`RULE-L06`)
- ordre local conserve (`RULE-L05`)

### 6.2 Exemple de conversion `perso` capsule

Entree legacy (extrait):

```ts
{
  type: 'LIST',
  initial: { id: 'capsule__3', tag: 'div', className: 'ed-caps ...' },
  actions: {
    '3-003-donc-intro': { move: 'capsule__1', style: { opacity: { from: 0, to: 1, duration: 500 } } },
    'capsule__3': true
  }
}
```

Sortie attendue (extrait):

```ts
{
  id: 'capsule__3',
  type: 'list',
  initial: { id: 'capsule__3', tag: 'div', className: 'ed-caps ...' },
  actions: {
    '3-003-donc-intro': { move: 'capsule__1', style: { opacity: { from: 0, to: 1, duration: 500 } } },
    'capsule__3': {}
  },
  list: {
    autoAnimate: { insert: true, remove: true, move: true, durationMs: 500, easing: 'ease-out' }
  }
}
```

Points verifies:

- mapping `LIST -> list` (`RULE-L02`)
- conversion self-marker `true -> {}` (`RULE-L03`)

## 7) Plan de tests du convertisseur

### T1 - Determinisme

- meme input -> meme output JSON (hors champs horodates debug)

### T2 - Ordre events

- verifier `RULE-L05` et `index` monotone

### T3 - Doublons

- verifier suppression des doublons `(ms, name)` + warning

### T4 - Parent synthese

- si parent absent (`container-scene`), creation d'un `list` synthetique

### T5 - Auto move

- conserver `move: { mode: 'auto' }` sans transformation

### T6 - No story legacy

- sortie en story unique + `ScenarioGraph` minimal (1 node)

## 8) Strategie d'evolution (diff-friendly)

Pour simplifier les modifications futures:

- modifier d'abord les `RULE-Lxx` (une regle = un commit)
- ne pas melanger modifications de schema et mapping type dans le meme changement
- maintenir des fixtures golden avant/apres conversion

## 9) Non-objectifs V1

- pas de support runtime direct du format legacy
- pas de migration automatique des themes/classes CSS externes
- pas de correction semantique des events auteur (noms conserves)
