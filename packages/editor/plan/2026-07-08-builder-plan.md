# Spec + Plan — Le Builder (ed2)

**Périmètre** : nouveau composant, `packages/editor/src/builder/` (à créer). Transforme les données d'édition (`EditorScene` de grid-editor, `DecorPatch` de dedit) en `SceneDef` Codplay, envoyé au player. **Sa classe métier testable est `SceneDocEditor`** (`packages/authoring/scene-factory`) : le Builder oriente/orchestre (résolution timing/transitions/CSS), `SceneDocEditor` construit et valide le `SceneDef`.
**Dépend de** :
- `2026-07-08-capsule-automation-reconciliation-plan.md` (le Builder consomme les deux modules dans leurs rôles réconciliés).
- `2026-07-08-scenedoceditor-audit-plan.md` (`SceneDocEditor` remis à niveau face au modèle Codplay actuel — chantier distinct, préalable).

---

## Principes fondamentaux

Ces deux règles définissent ce qu'est le Builder — pas des détails locaux à une section, elles s'appliquent à tout ce qu'il produit.

### A. Eventime = déclencheur, action = données

**L'eventime envoie un event ; c'est l'action du perso qui porte les données.** L'eventime n'est qu'un déclencheur (`{name, startAt}`), jamais un porteur de payload — la seule exception légitime est quand un emit utilisateur ou un strap apporte une donnée réellement dynamique au perso, un cas qui ne se présente jamais dans ed2 (pas de strap, pas d'écoute, tout connu au build). Le Builder n'a donc **aucune raison** d'utiliser le raccourci `event.name === perso.id` / `event.data` : chaque comportement est une action **nommée et déclarée statiquement** sur le perso concerné ; l'eventime se contente de la déclencher au bon instant. Voir [[feedback-eventime-vs-action-data]].

### B. Aucune donnée inventée par le Builder

**Le Builder ne transforme et ne route que des données déjà explicites quelque part (état d'édition, catalogue de config) — il n'en invente jamais.** Si une donnée facultative est absente en entrée, elle reste absente en sortie ; pas de substitution silencieuse, pas de constante par défaut codée en dur dans le code du Builder. Une valeur codée en dur à cet endroit est invisible et impossible à tracer ou à surcharger. Si un vrai besoin de valeur par défaut apparaît à l'usage, il se résout **soit en config** (un champ explicite et nommé dans un catalogue existant, ex. capsule-automation), **soit dans l'éditeur** (un réglage auteur explicite et visible) — jamais par une ligne ajoutée dans le Builder lui-même. Voir [[feedback-no-hardcoded-defaults-in-builder]].

---

## Partie spec — ce que le Builder produit

### 1. Cible : `SceneDef`, jamais `CompiledScene`

Le Builder ed2 s'arrête à la production d'un `SceneDef` (= `SceneDoc`, même objet). La compilation `SceneDef → CompiledScene` reste la responsabilité du builder Codplay existant (`packages/codplay/src/builder/`), invoquée en aval via `CodPlay.load()`.

### 2. Une scène ed2 = une story, sans strap, sans écoute

```ts
{ id: 'story-main', name: 'main', initial: { move: '@root' }, persos: [...], straps: undefined, listen: [], eventimes: [...] }
```
`straps: undefined` + `listen: []` est une config légale (confirmé dans les specs Codplay) — pas une tolérance dégradée.

### 3. Capsule racine — toujours présente, construite en premier

Chaque `SceneDef` produit contient, en tête de `story.persos`, une capsule racine :

```ts
{
  id: 'story-main__root',
  name: 'root',
  type: 'list',                    // tous les types de capsule → list, uniformément
  initial: {
    move: '@root',                 // ⚠ ET story.initial.move doit AUSSI valoir '@root' — les deux sont exigés (deriveRootNodeIds)
    tag: 'div',
    style: { /* décor résolu de la capsule racine — voir §4 */ },
  },
  actions: {}   // aucune action : la capsule racine ne reçoit jamais d'eventime (pas de transition, décor statique posé une seule fois dans initial)
}
```

Règles (actées, cf plan général) :
- Jamais visible/sélectionnable comme item, non supprimable.
- Pas de keyframe, pas de `PositionPatch` — décor statique, défini une seule fois.
- Capsule-automation : sous-type `card` (`GRID_MODE.manual`), zéro zone définie — fond layout, placement explicite par item (`2026-07-08-capsule-spec.md` §3/§6).
- Tout item créé par l'utilisateur devient un enfant d'elle (`move:{parentId:'story-main__root', flip:false}`), jamais lui-même `@root`.

### 4. Décor de la capsule racine — gap de modèle de données à combler côté grid-editor

`EditorScene` n'a aujourd'hui aucun champ pour un décor sans keyframe. Ce chantier doit ajouter à `EditorScene` (sequence-editor) un champ dédié, ex. `rootDecorId: string | null`, pointant dans le registre `decors{}` existant — **pas** de détournement du mécanisme `Keyframe.decorId`. Cette extension de type est un pré-requis du Builder, pas une tâche du Builder lui-même — à faire dans `packages/editor/src/sequence-editor/types.ts` avant ou en même temps.

### 5. Item — perso enfant

Chaque item ed2 (texte, image, média, capsule imbriquée…) devient un perso Codplay enfant de la capsule racine (ou d'une capsule imbriquée). Mapping `ItemType` → type perso Codplay :

| ItemType (dedit) | type perso Codplay |
|---|---|
| `text` | `text` |
| `image` | `img` (⚠ pas `'image'` — piège de nom confirmé, `ResourceManifestEntry.type` utilise `'image'`, le perso utilise `'img'`) |
| `video` | `media` |
| `media` | `media` |
| `capsule` | `list` |
| `bloc` | `text`, contenu vide (pas une valeur `ItemType` distincte — cf `2026-07-08-item-model-spec.md` §5) |

**Placement d'un enfant dans une capsule `card`** : `placementPolicy: explicitOnly` (`2026-07-08-capsule-spec.md` §3) — le Builder pose donc toujours un `AutoCapsuleChildInput.placement` explicite, jamais déduit par capsule-automation. Si `DecorPatch.zone` référence une zone réelle, le Builder la traduit en `{row,col,rowSpan,colSpan}` ; si elle vaut `null`, le Builder résout vers la **zone fantôme** de la capsule (`{row:1, col:1, rowSpan: grid.rows, colSpan: grid.cols}`, `2026-07-08-capsule-spec.md` §3/§11) — le même mécanisme nom-de-zone → coordonnées, appliqué à une zone toujours présente plutôt qu'une valeur inventée au cas par cas.

### 6. Transitions intro/outro — mécanisme complet

Application directe du Principe A : chaque transition devient une action nommée et déclarée statiquement sur le perso, jamais un payload dans l'eventime.

1. Le Builder appelle `CapsuleDistribution.compute()` (`packages/authoring/scene-factory/`, co-localisée avec `SceneDocEditor`) pour obtenir le `{introMs, outroMs}` de chaque enfant d'une capsule (relatif à l'intro de la capsule).
2. Conversion en absolu (`capsule.introAbsoluteMs + introMs`), posé sur `AutoCapsuleChildInput.timeRange` (cf plan de réconciliation).
3. `AutoCapsule.resolve()` résout la transition nommée (`ref`, ex. `'fade'`) en diff de style (`{opacity:{from,to}, x:{from,to}, ...}`) + `triggerMs` + `durationMs`, pour `intro` et `outro`.
4. Le Builder déclare une action nommée par transition, directement dans `perso.actions` — jamais dans l'eventime :
   ```ts
   // sur le perso — `ease` omis ici : illustre le cas où la transition résolue n'en porte pas (cf point 5, aucune valeur ajoutée par le Builder) :
   actions: {
     'item-1-intro': { style: {
       opacity: { to: 1, duration: 400 },
       x: { to: 0, duration: 400 },
     } },
     'item-1-outro': { style: {
       opacity: { to: 0, duration: 400 },
     } },
   }

   // sur story.eventimes — pur déclencheur, aucune donnée :
   { name: 'item-1-intro', startAt: resolvedIntro.triggerMs }
   { name: 'item-1-outro', startAt: resolvedOutro.triggerMs }
   ```
   **Nom d'action unique par perso, obligatoire** : un event route vers *tout* perso dont `actions` porte une clé de ce nom — un nom générique comme `'intro'` réutilisé identiquement sur plusieurs persos ferait déclencher les mauvais items en même temps (collision inter-perso). Convention proposée : `${persoId}-intro`/`${persoId}-outro` (pas une exigence Codplay, juste une convention Builder à tenir).
5. **`ease` n'est pas fourni par capsule-automation aujourd'hui** (`AutoCapsuleEventDefinition.style` ne porte que `{from?,to}`, pas d'easing) — facultatif, absent en sortie s'il est absent en entrée. Application directe du Principe B : si un besoin réel de valeur par défaut apparaît, il s'ajoute au catalogue capsule-automation (`DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`) ou en réglage éditeur, jamais comme constante dans le Builder.

### 7. Feuille de style

`AutoCapsule.renderStyleSheet()` → chaîne CSS → `new Blob([css], { type: 'text/css' })` → `URL.createObjectURL(blob)` → enregistré via :
```ts
CodPlay.load({ scene, mountTarget, extraResources: [{ url: blobUrl, type: 'css', policy: { cache: 'no-store' } }] })
```
**Jamais via `BuilderFacade.compile()` directement** — ce niveau n'a aucun paramètre pour des ressources supplémentaires (confirmé, cf audit). Le Builder ed2 doit donc appeler `CodPlay.load()`, pas `BuilderFacade.compile()` + `Player.init()` séparément — sauf si l'éditeur a une raison précise de vouloir compiler sans monter (à évaluer si le besoin se présente).

### 8. Construction du `SceneDef` — via `SceneDocEditor` remis à niveau

**`SceneDocEditor` est conçu pour cet emploi — c'est lui qui devient la classe métier testable du Builder, pas un helper qu'on contourne avec des littéraux à la main.** Sa remise à niveau (id explicite optionnel, `trackId`/`state`/`onStart`/`onSequenceEnd`/`list` conservés) est traitée comme son propre chantier, préalable à celui-ci — cf `2026-07-08-scenedoceditor-audit-plan.md` (le décalage entre `SceneDocEditor` et le modèle Codplay actuel est confirmé par git, pas seulement supposé : `Perso`/`PersoDoc` ont divergé depuis la séparation des deux classes).

Une fois `SceneDocEditor` remis à niveau, le Builder construit la scène **exclusivement via son API** (`createStory`/`upsertStory`, `createPerso`/`upsertPerso`, les setters `scene.*`) — pas de littéraux `SceneDef`/`Perso` à la main, pas de contournement post-`exportSceneDoc()`. Reste à respecter dans tous les cas :
- Poser `move` explicitement sur chaque perso — l'omission résout à `'@root'` par défaut, jamais à « pas de montage » (il faut `move:'@off'` explicite pour ça).
- Poser `actions` avec les vraies actions nommées de chaque perso (§6, Principe A) — jamais le raccourci `actions:{[id]:null}`.

---

## Partie plan — ordre d'implémentation

1. **Extension `EditorScene`** (sequence-editor) : champ `rootDecorId` (§4). Petit, préalable.
2. **Chantier séparé, préalable : `2026-07-08-scenedoceditor-audit-plan.md`** — remise à niveau de `SceneDocEditor` face au modèle Codplay actuel. Testable indépendamment du Builder — c'est la classe métier du chantier.
3. **Builder minimal, headless, un seul item** : construire un `SceneDef` via `SceneDocEditor` complété (fixture `EditorScene` → Builder → `SceneDocEditor` → `SceneDef`), UN item enfant de la capsule racine, transition nommée simple (`fade`), 3 secondes, sans passer encore par `CapsuleDistribution`/capsule-automation (eventime posé directement via l'API `SceneDocEditor` pour valider le pipeline Builder → `CodPlay.load` → player). Test automatisé, pas d'UI.
4. **Validation feuille de style par un test concret** (demandé explicitement) : générer un CSS trivial, le pousser en Blob CSS dynamique via `extraResources`, vérifier qu'il s'applique réellement dans une scène jouée (jsdom ou navigateur réel selon ce que permet la suite de tests Codplay existante).
5. **Branchement `CapsuleDistribution` + capsule-automation** (dépend du plan de réconciliation, chantier précédent) : remplacer l'eventime posé à la main (étape 3) par le pipeline complet — `CapsuleDistribution.compute()` → `AutoCapsule` → eventimes, toujours construits via `SceneDocEditor`.
6. **Capsule imbriquée** : un item de type `capsule` avec ses propres enfants — vérifie le nesting `list`-dans-`list` (confirmé sans restriction technique) et la composition des deux mécanismes de distribution (racine + capsule imbriquée).
7. **Tests** : `SceneDocEditor` et le Builder sont des classes testables sans UI (cf principe transverse du projet) — chaque étape ci-dessus doit avoir sa suite de tests avant de passer à la suivante.

Chantier « cœur » — avancer par incréments courts, montrer le code au fil de l'eau.
