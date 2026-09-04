# ed2 — Définition du contrôleur central + façade de commandes

Définition du **contrôleur central** (machine XState racine) et de la **façade de commandes** (son unique voie d'écriture), à valider avant tout code — convention « cœur » (`app/2026-07-10-app-construction-plan.md`, étape 2). Document normatif : ce qui suit est la référence pour l'implémentation, pas une exploration.

**Rôle du contrôleur.** Le contrôleur possède le document (`EditorScene`), la sélection, et l'état d'édition partagé de l'app. Aucun module (sequence-editor, dedit, cadre de sélection) n'en détient de copie : chacun lit une projection du document et émet des intentions ; le contrôleur applique et rediffuse. Toute mutation du document passe par la **façade de commandes** — la voie d'écriture unique.

---

## 1. Ce que le contrôleur possède

- **Le document courant** — un `EditorScene` (`app/2026-07-11-ed2-document-model.md`), parmi potentiellement plusieurs scènes ouvrables (`documents`, §6).
- **La sélection** — un ensemble d'ids `{ itemIds: string[]; keyframeId?: string }`. Multi-sélection possible (édition de N items à la fois, dedit). `keyframeId` absent = décor actif résolu (kf en vigueur à l'instant courant, ou décor initial) sans qu'un kf précis soit désigné.
- **Le mode** — quel geste est actif (`idle`, `creating:<type>`, `zone-edit`, `position-edit`…). Un seul mode actif à la fois ; détermine quels modules répondent aux gestes.
- **La visibilité des panneaux** — quels panneaux d'édition sont ouverts (décor, capsule, contenu — cf. document-model, trilogie d'édition).
- **Le cycle de vie du document** — identité de la scène courante, liste des scènes disponibles (§6), état modifié/sauvegardé.

## 2. Ce que le contrôleur NE possède PAS

- **L'éphémère des gestes des modules** — position du viewport, tracé en cours, drag en cours, scroll de la timeline, preview live d'un décor pendant un geste (avant commit). Chaque module garde son état de geste local.
- **L'historique visuel de undo/redo** — hors machine, acteur à part branché sur la façade (étape 4, hors périmètre de ce document).
- **La persistance** — hors machine, acteur à part (étape 5).

La frontière document/éphémère est celle déjà actée dans les axes d'architecture (`notes/2026-07-12-ed2-axes-architecture.md`, axe 2 et frontière transverse) : ce qui passe par la façade entre dans le document (persistable, annulable) ; le reste reste local et jetable.

---

## 3. États de la machine

```
idle ──CREATE_MODE_ENTER──► creating(type)
  ▲                              │
  │                         CREATE_COMMIT /
  │                         CREATE_CANCEL
  └──────────────────────────────┘

idle ◄──selection change (interne, pas un état à part)──► idle
```

La sélection, le panneau ouvert, et le document courant sont des **valeurs de contexte**, pas des états — ils changent sans changer l'état machine. Le seul découpage en états concerne le **mode de geste actif**, parce que lui seul change ce que les événements font (un clic en mode `idle` sélectionne ; le même clic en mode `creating:text` ouvre un tracé).

- **`idle`** — état par défaut. Sélection active ou non ; édition de décor/capsule/contenu possible sur la sélection courante.
- **`creating(type)`** — mode tracé actif (déclenché par un bouton de création, `app/2026-07-11-ed2-document-model.md`, discussion §« Établissement du contenu »). L'utilisateur trace un rectangle ; à la validation, `createItem` produit un `bloc` positionné, puis la seconde commande (`assignType` ou `assignContent`, §4) le typifie. `CREATE_CANCEL` (Échap) revient à `idle` sans mutation.

Pas d'autres états macro à ce stade — `zone-edit`/`position-edit` (mentionnés en discussion comme modes) sont des **sous-modes de `idle`** portés par une valeur de contexte (`editGesture: 'zone' | 'position' | null`), pas des états machine séparés : ils ne changent pas la nature des commandes disponibles, seulement quel module vanilla capte le geste actuellement.

**Cible du geste en mode `creating` — tracé libre ou désignation de zone (point à éprouver par l'usage, pas tranché).** Le mode `creating(type)` ne préjuge pas de la source de la géométrie : tracer un rectangle main-levée et désigner une zone existante sont **deux sources possibles pour le même argument `geometry`** de `createItem` (§4.1) — pas deux modes distincts. Désigner une zone revient à composer `createItem(type, zone.rect, parentId)` + `placeInZone(itemId, zoneId)` en une `transaction` (§4.1, un seul commit). Aucune commande dédiée n'est nécessaire pour ce cas (cf. axe 3 — composer plutôt qu'ajouter).

- **Affichage des zones pendant le geste** — un booléen de contexte, `zonesVisible: boolean` (bascule d'interface, pas une mutation de document — §2, éphémère), disponible pendant `creating` pour que le module de rendu de zones sache s'afficher ou non. Événement : `TOGGLE_ZONES_VISIBLE()`. La question « le tracé libre et la désignation de zone doivent-ils être deux gestes distincts dans l'UI, ou le même geste qui accroche sur une zone survolée » est un test d'usage à mener (dedit/selection-frame), pas une décision de ce document — la façade (composition `createItem`+`placeInZone`) est neutre vis-à-vis du résultat de ce test.

---

## 4. La façade de commandes

**Une commande = une entrée d'historique potentielle** (l'historien, étape 4, s'y branche). Une **transaction** groupe N mutations sous un seul commit (macro, `notes/2026-07-10-app-construction-discussion.md` §« macro… »).

Chaque commande est une **mutation pure** `(EditorScene, args) → EditorScene`, testable par entrée→sortie sans DOM (patron `zone-model.ts`/Builder). Le contrôleur les invoque et remplace le document dans son contexte.

### 4.1 Commandes de base (v1, jeu couvrant les besoins de l'étape 3)

| Commande | Effet | Cible |
|---|---|---|
| `createItem(type, geometry, parentId?)` | Crée un item **`bloc`** (sans contenu), positionné (décor initial dérivé de `geometry`), attaché sous `parentId` (racine si absent) | `items`, `decors` |
| `assignType(itemId, type)` | Différencie un `bloc` vers un type concret (texte, image, capsule…) ; **seul cas de changement de type autorisé en v1** | `items` |
| `assignContent(itemId, content)` | Renseigne le contenu d'un item déjà typé (texte saisi, source média, params capsule) | `contents` |
| `attachItem(itemId, parentId, order?)` | Change le parent et/ou la clé d'ordre d'un item | `items` |
| `setDecor(decorId, patch)` | Applique un patch de style/classes/position/zone sur un décor existant | `decors` |
| `createKeyframe(itemId, timeMs, decorId?)` | Pose un kf explicite sur l'item à l'instant donné | `items[].keyframes` |
| `createCapsule(geometry, capsuleDef, parentId?)` | Crée un item capsule avec son `CapsuleDef` (statique, défini une fois) | `items` |
| `setCapsuleDef(itemId, patch)` | Modifie les réglages d'une capsule (avant sa mise en usage — cf. modèle, capsule figée à la définition) | `items[].capsule` |
| `placeInZone(itemId, zoneId \| null)` | Assigne/retire une zone à un item (filtré : zones de la capsule parente seulement, cf. document-model) | `decors[].zoneId` |
| `deleteItem(itemId)` | Retire un item et ses descendants | `items`, `decors`, `contents` (nettoyage) |
| `transaction(commands[])` | Groupe N commandes en un seul commit | — |

Ce jeu couvre les commandes nécessaires au jalon « un item qui vit » (étape 3, point 1-3) et aux voies de création décrites en discussion. **Non exhaustif par construction** — le principe (axe 3, `notes/2026-07-12-ed2-axes-architecture.md`) est que les fonctionnalités futures se composent de ce jeu plutôt que d'ajouter des commandes dédiées ; une commande nouvelle n'est ajoutée que si aucune composition existante ne couvre le besoin.

### 4.2 Politique d'édition de décor sans kf sélectionné — point ouvert, résolu par une commande dédiée

Décision actée (discussion, §« Sélection d'un décor ») : la création de kf est **volontaire**, jamais un effet de bord d'une édition de valeur. Concrètement :

- `setDecor` (§4.1) **n'exige pas** de kf sélectionné : elle écrit sur le décor **actif** (le kf en vigueur à l'instant courant, ou le décor initial si aucun kf n'est en vigueur).
- `createKeyframe` est **toujours** l'acte explicite qui fait naître un kf — jamais implicite dans `setDecor`.
- La **politique** (quel décor est « actif » à un instant donné, en l'absence de kf sélectionné) est un point de résolution interne à la façade, pas au module appelant — cohérent avec l'exigence de discussion (« souplesse — façade de commandes ») : si l'usage révèle qu'une autre politique est préférable, elle change **dans l'implémentation de la commande**, pas dans ses appelants.

### 4.3 Flux d'édition décor — preview live + commit débouncé (rappel de frontière)

Le contrôleur ne voit **jamais** la preview live (§2 — éphémère). Ce qu'il reçoit : une intention `setDecor(decorId, patch)` émise **une fois par salve de geste**, après débounce ou fin de geste franche (`pointerup`/blur/Entrée) côté module (dedit). Le contrôleur n'a pas de mécanique de débounce — c'est une responsabilité du module émetteur, pas de la façade. Détail complet du scénario : `notes/2026-07-10-app-construction-discussion.md` §« Scénario du flux d'édition… ».

### 4.4 Zone : contrainte par défaut, dimensions propres sur geste explicite — pas de commande dédiée

Assigner une zone (`placeInZone`) ne donne **pas**, en soi, de dimensions propres à l'item : par défaut, il **hérite** du rect de la cellule (contrainte CSS grid — span row/col), tant qu'aucune `position` n'est posée sur son décor. Passer à des **dimensions propres** (l'item ne suit plus la cellule — largeur en `cqw`, ancrage flex, `x`/`y`…) est un geste **intentionnel** de l'auteur, distinct de l'assignation de zone elle-même.

**Aucune commande dédiée n'est nécessaire pour cette dérogation** : `setDecor(decorId, { position: {...} })` (§4.1) suffit — la présence d'un `position` non vide sur le décor **est** le signal de la dérogation. Ce n'est pas une règle d'écriture (la façade ne fait rien de spécial), c'est une règle de **traduction** que le Builder applique en aval :

- `zoneId` posé, `position` absent/vide → CSS de cellule (`grid-row`/`grid-column` span selon `ZoneRect`) — l'item est contraint par la zone.
- `zoneId` posé, `position` renseigné → **PAS ENCORE TRANCHÉ, à éprouver par l'usage** : soit (a) coexistence — les valeurs de `PositionData` (`app/2026-07-11-ed2-document-model.md` §258-263) priment pour le gabarit, l'item garde son rattachement de zone (positionnement de départ) mais n'est plus contraint en dimension par la cellule ; soit (b) détachement — poser une dimension propre **retire l'effet de `zoneId`** purement et simplement (retour à un positionnement libre, pas d'état hybride). Le système de zone existe pour **favoriser l'auto-positionnement** ; il se peut que (b) soit le comportement le plus naturel (une dimension propre = sortir de la délégation à la grille, pas la faire coexister avec elle). **À décider après un test d'usage concret**, pas ici — ce document ne préjuge pas de la réponse.

Dans les deux cas, **aucune commande dédiée n'est requise** : `setDecor` reste la seule commande invoquée ; (a) et (b) ne diffèrent que par la règle de **traduction** que le Builder applique à la donnée, jamais par l'écriture elle-même. Le geste d'interface qui distingue « je place dans la zone » de « je redimensionne l'item » (poignées de redimensionnement, bascule explicite…) est le même test d'usage qui tranchera (a) vs (b).

---

## 5. La sélection — deux émetteurs, un seul point de vérité

Actée en discussion (§« Sélection d'un décor : deux accès… ») : sélectionner un item **depuis la timeline** (kf) ou **depuis le player** (via selection-frame, `subscribeToNode`) sont deux émetteurs vers la **même** sélection portée par le contrôleur. Aucun n'en garde de copie.

- La sélection est indexée par **id stable** (`itemId`, `keyframeId?`), jamais par référence DOM — garantit qu'elle survit à un rebuild/seek qui détruit et recrée le node (propriété déjà vérifiée dans selection-frame, `handleElementNode(node | null)`).
- Événements : `SELECT_ITEM({ itemIds, keyframeId? })`, `CLEAR_SELECTION()`.

### 5.1 Sélection du keyframe au temps auteur

Le `keyframeId` n'est pas une ancre temporelle permanente pendant un geste de
seek. Les `SEEK` intermédiaires restent des relais de déplacement et ne
recalculent pas la sélection. À la frontière de fin du geste (`SEEK_RELEASED`)
ou lors d'une pause, le contrôleur examine les keyframes réels de l'unique item
sélectionné :

- le keyframe le plus proche est sélectionné si son écart est inférieur ou égal
  à `50 ms` ;
- sinon, la sélection conserve l'item et omet `keyframeId` ;
- les bornes virtuelles ne peuvent jamais devenir une sélection de keyframe ;
- l'entrée en Play et la progression de lecture ne visent aucun keyframe. La
  pause utilise le temps auteur final réellement réconcilié.

Cette résolution est une mise à jour d'interface portée par le contrôleur ; elle
n'écrit ni `EditorScene`, ni keyframe, ni décor.

---

## 6. Cycle de vie multi-documents

Acté en discussion (§« Élargissement de périmètre… ») : le contrôleur possède **un document courant parmi plusieurs**, pas « le » document unique. Contexte :

```
documents: Record<sceneId, EditorSceneMeta>   // liste des scènes disponibles (métadonnées, pas le contenu complet)
currentSceneId: string | null
scene: EditorScene | null                     // le document couramment chargé
```

- **Étape 2 (ce document)** : le contexte prévoit la forme (`documents`/`currentSceneId`), mais **une seule scène est effectivement chargée et manipulable** — pas de bascule inter-scènes implémentée ici. Prépare sans construire, comme demandé pour le multi-scènes.
- **Étape 5 (sauvegarde locale)** : `documents` se peuple depuis localStorage (plusieurs `EditorScene` nommées), un sélecteur (`<select>`, patch provisoire — `app/2026-07-10-app-construction-plan.md`, étape 5) permet de charger l'une d'elles. Ce document-ci ne préjuge pas de la forme exacte du sélecteur, seulement de la forme du contexte qui le rend possible.
- Événements prévus (posés maintenant, invoqués à l'étape 5) : `LOAD_SCENE(sceneId)`, `SCENE_LOADED(scene)`.

---

## 7. Branchements

- **React** : `createActor(controllerMachine)` au montage de `main.tsx` ; les composants lisent via `useSelector(actor, selector)` et envoient via `actor.send(event)`. Aucun `useState` partagé (`SKILL.md`, politique de hooks). `useEffect` interdit.
- **Îlots vanilla** (sequence-editor, player, dedit) : chacun est piloté par un **acteur enfant** du contrôleur (invoked ou spawned), qui traduit les événements du contrôleur vers l'API de l'îlot et les intentions de l'îlot vers des `send` au contrôleur. Pas d'accès direct îlot ↔ îlot ; tout transite par le contrôleur.
- **Builder** : invoqué par le contrôleur (ou son acteur de rendu) à chaque commit qui change le document — produit `{ sceneDoc, styleSheet }` à partir de `EditorScene`, transformation pure, rejouable.

---

## 8. Ce que ce document ne couvre pas (renvoyé à ses étapes propres)

- Le détail de l'historien (empilement, snapshot) — étape 4.
- Le détail de l'acteur de persistance (clé localStorage, sérialisation) — étape 5.
- Le détail des ponts par îlot (forme exacte de l'acteur sequence-editor↔contrôleur, dedit↔contrôleur) — étape 3, un pont à la fois.
- Les commandes composites de haut niveau (macro lot→carousel, coller/dupliquer) — construites par composition du jeu de base (§4.1), pas définies ici.

---

## Validation attendue

Ce document est à valider avant le code de la machine et de la façade. Points à confirmer explicitement :
1. Le découpage en états (§3 — un seul état macro `creating`, le reste en contexte) convient-il, ou faut-il des états distincts pour `zone-edit`/`position-edit` ?
2. Le jeu de commandes de base (§4.1) est-il complet pour le jalon « un item qui vit » (étape 3), ou faut-il l'ajuster avant d'écrire les tests ?
3. La forme multi-documents (§6 — contexte préparé, une seule scène chargée en pratique) correspond-elle à l'intention ?
