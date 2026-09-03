# ed2 — Le modèle de document

Le **document** que l'app manipule — sa structure de données, et ses concepts centraux **item** et **capsule**. Document normatif (structure décidée). Décrit le vocabulaire auteur, en amont du Builder (le vocabulaire Codplay est un autre document).

**Une scène est spatio-temporelle.** Un item occupe une place (**où**) et existe sur un intervalle de temps (**quand**). Une capsule ne fait pas qu'imbriquer ses enfants dans l'espace — elle **orchestre leur temps**. Les deux axes sont présents d'un bout à l'autre du modèle.

---

## Le schéma

```
   ╔═══════════════════════════════════════════════════════════════════════╗
   ║                            EditorScene                                 ║
   ║               le document d'une scène · durée : durationMs             ║
   ║                                                                        ║
   ║   tracks ── l'arbre des items ──┐          tables référencées :        ║
   ║                                 │          ┌─────────────┐             ║
   ║   ┌─────────────────────────┐   │          │  contents   │ contenu     ║
   ║   │  capsule (racine)       │   │          │  (par id)   │ d'un item   ║
   ║   │  ┌───────┐ ┌───────┐    │   │          ├─────────────┤             ║
   ║   │  │ item  │ │capsule│    │◄──┘          │   decors    │ habillage / ║
   ║   │  │feuille│ │ ┌────┐│    │              │  (par id)   │ géométrie   ║
   ║   │  └───┬───┘ │ │item││    │              ├─────────────┤             ║
   ║   │      │     │ └─┬──┘│    │              │   zones     │ emprises    ║
   ║   │      │     └───┼───┘    │              │  (par id)   │ (capsule)   ║
   ║   └──────┼─────────┼────────┘              └─────────────┘             ║
   ║          │         │                                                   ║
   ║          ▼         ▼        chaque item a DEUX axes :                  ║
   ║   ┌──────────────────────┐                                            ║
   ║   │        ITEM          │   ESPACE (où)          TEMPS (quand)        ║
   ║   │ relie un ensemble    │   • zone → zones       • keyframes          ║
   ║   │ de données,          │   • décor → decors       (intro/outro,      ║
   ║   │ dans l'espace ET     │   • contenu → contents    décor dans le     ║
   ║   │ dans le temps        │                           temps)            ║
   ║   └──────────────────────┘                                            ║
   ╚═══════════════════════════════════════════════════════════════════════╝

                    au build ─► (Builder) ─► vocabulaire Codplay
```

Le document est **un arbre d'items** (`tracks`) plus des **tables référencées** (contenus, décors, zones), le tout sur une **durée** de scène. L'arbre porte la structure et l'imbrication ; les tables portent les données. Chaque item vit sur **deux axes** : où il est (espace) et quand il existe (temps).

---

## Légende — l'item : spatial et temporel

Un **item** est l'entité que l'auteur crée. Deux natures de données à distinguer : ce qu'il **porte en propre** (son identité, sa place, sa vie dans le temps) et ce qu'il **relie** (par référence : contenu, décor, zones).

```
                              ITEM
              ┌────────────────┴────────────────┐
       CE QU'IL PORTE                    CE QU'IL RELIE
       (données propres)                 (par référence)
              │                                 │
   ┌──────────┼──────────┐            ┌─────────┼─────────┐
   ▼          ▼          ▼            ▼         ▼         ▼
  id       type      place :       contenu   décor(s)  zone(s)
 (stable) (itemType) • clé d'ordre  →contents →decors  →zones
                     • parent                 (initial  (par id)
                                              + par kf)
   ── vie dans le temps (représentation timeline) ──
   • keyframes : { timeMs, → décor, transitions in/out }
   • décor initial (état « intro terminée », hors kf)
   • si capsule : sous-type · distribution · grille + enfants
```

**Ce que l'item porte en propre** :
- **id** — identité stable, de bout en bout (jusqu'au perso au build).
- **type** — texte / image / média / vidéo / capsule ; ouvre ses propriétés, détermine le perso.
- **sa place** — une **clé d'ordre** (parmi ses frères) + une **ref à son parent**. L'arbre est *dérivé* de ces deux-là.
- **ses keyframes** — le cœur de sa **représentation timeline** : chaque kf porte son **instant** (`timeMs`), le **décor** qu'il vise, et ses **transitions** (intro/outro, durée, easing). C'est *quand* l'item change, et *vers quoi*.
- **son décor initial** — un décor de base obligatoire, hors kf, à l'état « transition d'intro terminée » (la première apparition est déjà un état enrichi).
- **si l'item est une capsule** — son **sous-type**, sa **distribution** (séquentiel/stagger), sa **grille** : les réglages spatio-temporels poussés sur ses enfants. Ses **enfants** se déduisent de parent+ordre (l'item ne porte pas de liste d'ids).

**Ce que l'item relie** (par référence, données dans les tables) :
- **contenu** → **contents** — ce qu'il montre (voir « Content » ci-dessous : source + texte + langue + grains temporels selon le type).
- **décor(s)** → **decors** — géométrie, habillage et capacité de mouvement (style, classes, position, zone, path) : un décor **initial** + un décor **par keyframe**.
- **zone(s)** → **zones**, par **identité stable** (id, pas nom) — l'attache survit au renommage/déplacement de la zone.

L'item existe sur un **intervalle**, pas à un instant : son premier et son dernier keyframes selon
`timeMs` bornent respectivement l'entrée et la sortie (les labels `intro`/`outro` sont optionnels),
et son décor évolue le long de ces kf. Quand l'item est enfant d'une capsule, la distribution de la
capsule peut fournir la borne manquante sous forme virtuelle ; la capsule racine implicite applique
ses défauts de transition aux items directs sans être elle-même un item affiché.

---

## Légende — la capsule : un modèle spatio-temporel

Une **capsule** est un item conteneur. Sa nature propre : elle **structure ses enfants dans l'espace ET orchestre leur temps**. C'est le cœur du concept — pas un conteneur de disposition, un ordonnanceur spatio-temporel.

```
                    CAPSULE  (item conteneur, sous-type)
                         │
         ESPACE ─────────┼───────── TEMPS
                         │
     ┌───────────────┐   │   ┌────────────────────────────┐
     ▼               ▼   │   ▼                            ▼
  ses enfants     grille │  DISTRIBUTION               transitions
  (items,        / zones │  quand chaque enfant         par défaut
   imbriqués)            │  apparaît / disparaît         (intro/outro
                         │  • séquentiel ou stagger       de chaque
     ce qu'elle POUSSE   │  • décalages                   enfant)
     sur ses enfants ────┘                              + clip de la
     (selon son sous-type)                              capsule elle-même
```

**Axe espace (où)** :
- **ses enfants** — des items (feuilles ou capsules), imbriqués à toute profondeur.
- **la grille / les zones** — la forme dans laquelle les enfants se placent (selon le sous-type : carousel, rangée, liste, grille, card).

**Axe temps (quand) — la distribution** :
- Une capsule **distribue ses enfants dans le temps** : elle calcule *quand* chacun apparaît et disparaît. C'est sa fonction temporelle centrale.
- **Modes** : **séquentiel** (les enfants se succèdent) ou **stagger** (décalages réguliers, `staggerInMs`/`staggerOutMs`).
- **Enfant locké / libre** : un enfant dont l'auteur a posé un instant précis (un **keyframe réel**) est *locké* sur cette borne ; sinon ses bornes sont **calculées** par la distribution (*libres*). L'auteur fixe ce qu'il veut, la capsule déduit le reste.
- **transitions par défaut** — l'intro/outro que la capsule pousse sur chaque enfant (surchargées par les choix individuels de l'enfant).
- **clip de la capsule** — la capsule elle-même a son intro/outro : quand *elle* apparaît/disparaît dans la scène (elle est aussi un item, avec ses propres keyframes).

**Ce qu'elle a en propre** : une capsule ne porte pas de contenu (ses enfants en tiennent lieu). Ce qu'elle porte, ce sont les **réglages spatiaux (grille) et temporels (distribution, transitions) qu'elle pousse sur ses enfants**, déterminés par son **sous-type**.

**La capsule racine** — toute scène en a une, implicite, plein cadre : tout item de premier niveau en est un enfant.

---

## Le point clé — deux natures, deux axes

Item et capsule partagent la **même nature** (un item ; la capsule est un item conteneur) et un même **id stable**. La différence tient à ce qu'ils relient, sur les deux axes :

| | item feuille | capsule |
|---|---|---|
| **espace** — contenu | oui → contents | non (ses enfants en tiennent lieu) |
| **espace** — décor / zone | oui → decors / zones | oui → decors / zones |
| **espace** — enfants | — | oui (items) + grille/zones |
| **temps** — keyframes propres | oui (intro/outro, décor dans le temps) | oui (clip : quand la capsule paraît) |
| **temps** — orchestration | — | **distribue le temps de ses enfants** (séquentiel/stagger, transitions) |
| en propre | — | réglages spatiaux + temporels poussés sur les enfants |

La distinction forte : un item feuille **a** un temps (ses keyframes) ; une capsule **a un temps ET orchestre celui de ses enfants**. C'est ce qui fait de la capsule un modèle **spatio-temporel**, pas un simple conteneur. Tout le reste — contenu, décor, zone, timing d'un enfant libre — est **relié ou dérivé**, pas figé dans l'item : ce qui permet, au build, de résoudre le document (kf virtuels compris) vers Codplay.

---

## Séparation des responsabilités — ce qui garde le modèle propre

**Chaque donnée a un seul lieu, et un seul.** Ne jamais dupliquer ni déplacer une donnée hors de sa responsabilité :

| Responsabilité | Lieu | Ce que c'est |
|---|---|---|
| **contenu** (ce qui est montré) | `Content` (table `contents`) | source, texte, langue, grains temporels |
| **aspect** (comment c'est habillé), variable dans le temps | `Decor` (table `decors`) | style, classes, position, zone, path entrant — par keyframe |
| **capacités propres au type** différencié, statiques | `Item.<typeDef>` (ex. `Item.capsule`) | ce que ce type sait faire (conteneur : distribution/grille…) |
| **place / temps** | l'item lui-même | id, type, parent+ordre, keyframes |

**Frontière de substrat — le point à protéger (cf. `feedback-no-unrequested-html-substrate-leak`).** Le modèle est **indépendant du substrat de rendu**. Un **seul** endroit fusionne des capacités **du HTML** : `Decor` (style CSS, classes) — parce que le HTML est l'espace de rendu naturel *d'ed2*. Donc `Decor` est lié au substrat ; **tout le reste ne l'est pas** et ne doit **jamais** supposer un rendu HTML. Un ed3 (SVG) / ed4 (canvas) auraient *leur* `Decor` (capacités de leur substrat), même modèle. Corollaire symétrique côté Codplay : un composant déclare des **services** transverses (`style`/`className`/`attr`) — ce que `Decor` regroupe — sans imposer HTML ; ses capacités propres vivent dans le composant, miroir du `<type>Def`.

**Règle de relecture** : une donnée de contenu qui apparaît dans `Decor`, un réglage capsule dans `decors`, une supposition de balise/DOM hors `Decor`/composant — sont des **intrusions** à corriger, pas des commodités. On l'a déjà fait (sortir `text`/`capsule` de `Decor`).

---

## Structure de données — vue exhaustive

Forme cible **complète** du document (pseudo-types, illustratif — la spec normative fera foi). Tous les types, tous les champs connus à ce stade. Ce qui reste indéterminé est marqué `…` avec sa raison ; rien n'est laissé en « + infos » elliptique.

```
// ═══ RACINE ═══

EditorScene {
  id: string
  meta: SceneMeta
  items:    Item[]                    // à plat ; l'arbre est dérivé de parentId + order
  contents: Record<string, Content>   // indexé par contentId
  decors:   Record<string, Decor>     // indexé par decorId
  zones:    Record<string, Zone>      // indexé par zoneId
  markerTracks: Record<string, MarkerTrack>   // indexé par markerTrackId — marqueurs libres sur la
                                       //   timeline, INDÉPENDANTS de tout item/média (même patron
                                       //   que `zones` : une table référencée à côté de l'arbre
                                       //   d'items, pas une extension de `Content`/`Cue` — un
                                       //   marqueur n'est pas la transcription d'une source, ajouté
                                       //   par l'auteur librement sur la timeline). Ajouté 2026-07-13,
                                       //   migration sequence-editor — la fonctionnalité existait déjà
                                       //   côté sequence-editor (ancien `EditorScene.markerTracks`),
                                       //   ce document ne faisait que ne pas encore la couvrir.
  rootDecorId?: string                // → decors — décor de la capsule racine IMPLICITE (jamais un
                                       //   item, jamais vue/autorée par l'auteur). Posé une seule
                                       //   fois, jamais keyframé — même nature que le décor initial
                                       //   d'un item, mais la racine n'étant pas un item, elle n'a
                                       //   pas d'initialDecorId propre : ce champ en tient lieu.
  masterItemId?: string               // PROVISOIRE — → l'item média « master » (piste dédiée),
                                       //   facultatif. Ne survivra PAS au multipiste (voir note).
}

MarkerTrack {                         // une piste de marqueurs (regroupement visuel dans la timeline)
  id: string
  label: string
  color?: string                      // couleur par défaut des marqueurs de cette piste
  visible: boolean
  markers: Marker[]
}

Marker {                              // un repère temporel ponctuel, libre (pas de transcription)
  id: string
  timeMs: number
  label: string
  color?: string                      // surcharge la couleur de la piste
}

SceneMeta {                           // réglages d'APP (le Builder en projette une part vers Codplay)
  title: string
  durationMs: number
  durationSource: 'arbitrary' | 'audio-primary' | 'mixed'   // 'audio-primary' = calée sur le master
  timeUnit: 's' | 'ms'                // affichage timeline (app pur, jamais vu par Codplay)
  capsuleOrder: 'forward' | 'backward'
  sceneState?: Record<string, unknown>   // état de scène — projeté vers Codplay au build
  hooks?: { onStart?: string; onSequenceEnd?: string }  // projetés vers Codplay au build
}

// ═══ ITEM (feuille OU capsule — même nature) ═══

Item {
  id: string                          // = id du perso au build
  type: ItemType                      // spécifique côté ed2 ; Codplay unifie media/video au build
  label?: string                      // libellé D'AFFICHAGE libre côté timeline (sequence-editor) —
                                       //   PAS le contenu (celui-ci vit dans Content). L'auteur peut
                                       //   renommer un item sans changer ce qu'il montre (ex. "Texte
                                       //   d'intro" indépendamment du texte réellement affiché).
                                       //   Absent → l'éditeur dérive un libellé d'affichage depuis
                                       //   Content/type (troncature du texte, nom de source média,
                                       //   badge de type pour une capsule) plutôt que d'afficher un
                                       //   vide. Ajouté 2026-07-13, migration sequence-editor.
  parentId: string | null             // null = enfant de la capsule racine
  order: string                       // clé textuelle fractionnaire ("a","b","ab"…)
  visible: boolean                    // affichage dans l'éditeur (pas de rendu)
  contentId: string | null            // → contents ; null si capsule (enfants = contenu)
  initialDecorId: string              // → decors — décor de base OBLIGATOIRE (état « intro terminée »)
  keyframes: Keyframe[]               // vie dans le temps
  capsule?: CapsuleDef                // présent ssi type === 'capsule'
}

ItemType = 'text' | 'image' | 'media' | 'video' | 'capsule'
           // + futurs types média distincts (story-média, lottie, rive, three3D),
           //   ajoutés à la disponibilité du composant Codplay — jamais fusionnés sous 'media'

Keyframe {
  id: string
  timeMs: number
  decorId: string                     // → decors — le décor visé à cet instant
  transitionIn?:  Transition
  transitionOut?: Transition
  name?: string
  markerId?: string                   // rattachement à un marqueur (timeline)
}

Transition =
  | { kind: 'named';        name: TransitionKey; durationMs: number }
  | { kind: 'interpolated'; durationMs: number; easing: Easing }

TransitionKey = '--'|'cut'|'fade'|'swipe-left'|'swipe-right'|'swipe-top'|'swipe-down'|'zoom'
Easing = 'linear'|'ease-in'|'ease-out'|'ease-in-out'
       | { kind: 'cubic-bezier'; p1x; p1y; p2x; p2y }

CapsuleDef {                          // ce qu'une capsule pousse sur ses enfants — défini UNE fois,
                                      //   sur l'item (statique, jamais keyframé). SEUL lieu capsule.
  kind: CapsuleKind                   // 'carousel'|'rangee'|'liste'|'grille'|'card'
  distribution: { mode: 'sequential'|'stagger'; staggerInMs?: number; staggerOutMs?: number }
  grid?: { rows: number; cols: number; gap?: { row: number; col: number } }
  defaultTransitionIn?: string        // transitions par défaut poussées sur les enfants
  defaultTransitionOut?: string       //   (surchargées par les choix individuels d'un enfant)
  behavior?: string
  // les zones de la capsule sont dans la table zones (référencées par id) — voir Zone
  // (absorbe l'ancien CapsulePatch : capsule définie une fois = pas de dualité def/patch)
}

// ═══ CE QUE L'ITEM RELIE (tables) ═══

Content {                             // ce que l'item montre + infos de sa source
  id: string
  type: ItemType                      // aligné sur le type d'item servi
  source?: string                     // ressource (image/son/vidéo) ; absent pour un texte pur
  // — texte —
  text?: string                       // contenu textuel
  textAutoSize?: { enabled: boolean } // intention « auto » (pas une valeur CSS ; produite en aval)
  lang?: string                       // langue (texte ; et langue de transcription d'un média voix)
  // — média à voix —
  waveform?: Waveform                 // forme d'onde (affichage timeline)
  cues?: Cue[]                        // grain-mot (voix → repères aimantés) — donnée de CETTE source
  // + propriétés dédiées des futurs types (lottie, rive…) — ajoutées avec leur composant
}

Decor {                               // l'ASPECT variable d'un item (par keyframe) : rien d'autre
  id: string
  style?:    Record<string, string>   // valeurs CSS finales (carte ouverte — voir note ci-dessous)
  classes?:  ClassNameValue           // classes (add/remove/remplacement, modèle runtime)
  position?: PositionData             // position/appui-flex (module non-CSS, transposé en aval)
  zoneId?:   string | null            // → zones (par id) ; null = surface pleine de la capsule
  path?:     string                   // chemin SVG V2 du segment entrant vers ce décor ; absent = droite
  // PAS de `capsule` (réglages capsule = statiques, sur l'item : Item.capsule) ;
  // PAS de `text` (le contenu relève de Content). Voir note « Ce que Decor NE contient PAS ».
  // NB : DecorPatch (dedit) n'est PAS la référence ; la forme normative = spec du modèle
}

PositionData {                        // cqw / flex-anchor / transform — module non-CSS
  x?; y?; width?; height?              // cqw
  anchor?: { alignSelf; justifySelf }
  translate?: { x; y }; rotate?: number; scale?: { x; y }
  ratio?: number | null
}

Zone {                                // emprise nommée sur la grille d'une capsule
  id: string                          // identité stable — l'attache se fait par id, jamais par nom
  name: string                        // libellé par ORDRE ("z-01"…), intermédiaire vers la classe CSS
  surfaces: Record<Orientation, ZoneRect>   // ≥ 1 ; mono-surface si l'auteur ne varie pas
  container?: ZoneContainer           // si la zone est subdivisée en grille interne
}

Orientation = 'portrait' | 'landscape'   // (nommage à figer : vs 'vertical'|'horizontal')
ZoneRect      = { row; col; rowSpan; colSpan }
ZoneContainer = { grid: { rows; cols; gap? }; children: ZoneRect[] }   // niveau 1 seulement

// ═══ TEMPS EXTRAIT (média à voix) ═══

Waveform { version: 1; sampleRate; durationSec; points; min: number[]; max: number[] }

Cue {                                 // repère temporel PONCTUEL, aimanté
  id: string
  timeMs: number                      // un start OU un end de mot (deux cues par mot)
  text: string                        // le mot (conservé pour le sous-titrage futur)
  // grains phrase / phonème = couches AJOUTÉES à leurs chantiers (sous-titres, avatar) — pas ici
}
```

**Points de forme à noter dans ces types** :
- **`Decor.style` reste une carte ouverte** de valeurs CSS finales ; le modèle ne type **pas** les propriétés CSS une par une (dedit décide des props gérées vs `custom`). Stockage BDD = opaque ; runtime = `Record` structuré ; le Builder convertit.
- **`Content.cues` vs `EditorScene`** : les cues vivent dans le **content** du média (c'est la transcription de *cette* source) — il n'y a **pas** de table cues séparée dans `EditorScene`. Le `masterItemId` désigne quel item média porte le rythme ; ses cues sont dans son content.
- **Ce que Decor NE contient PAS (nettoyé, 2026-07-12)** : ni `text`, ni `capsule`. Decor est l'**aspect variable** d'un item (par keyframe) — style/classes/position/zone et, en V2, le `path` segment-local ; le path ne devient pas une propriété de capsule ou de visibilité.
  - **`text` → Content** : le contenu textuel relève de `Content`, pas du décor (c'est *ce qui est montré*, pas *comment*). Retiré de Decor (n'y était que par héritage de `DecorPatch`).
  - **`capsule` → `Item.capsule`** : les réglages d'une capsule sont **statiques** (définis une fois, jamais keyframés) et **uniques à l'item** — leur place est sur l'item (`CapsuleDef`), pas dans la table `decors` faite pour l'aspect variable. L'ancien `CapsulePatch` est **fusionné** dans `CapsuleDef` (plus de dualité def/patch). `capsule` n'a pas vocation à bouger dans le temps → hors décor.
  - **Évolution future possible (notée, pas v1)** : un lien **Content↔Decor** *pourrait* revenir pour du **changement de contenu (texte) via l'interface** — Codplay sait gérer un changement de content. Mais ce serait alors une **référence de content pilotée par keyframe** (le décor d'un kf pointe vers un content différent), pas un champ `text` brut réintroduit dans Decor. Réservé à un besoin réel (cf. discussion : changement de content pas dans l'éditeur en v1) ; ne pas l'anticiper dans le modèle.
- **`initialDecorId` (item) et `EditorScene.rootDecorId` (racine implicite) jouent le même rôle** — un décor de base, posé une fois, jamais keyframé. Séparés parce que la racine n'est **pas** un item (§ »racine» ci-dessus) : elle n'a donc pas de champ `initialDecorId` propre, d'où `rootDecorId` porté directement par `EditorScene`.
- **`Item.label` est un libellé d'affichage, pas du contenu** — distinct de `Content.text` : renommer une piste dans la timeline ne change jamais ce que l'item montre. Optionnel : l'éditeur dérive un affichage par défaut (troncature de `Content.text`, nom de source, badge de type) quand absent, plutôt que d'imposer sa saisie.
- **`markerTracks` est une table indépendante, pas liée aux items/médias** — contrairement à `Cue` (qui vit dans `Content`, parce qu'une cue est la transcription d'une source précise), un marqueur est posé librement par l'auteur sur la timeline, sans rattachement à un média. D'où sa place à côté de `zones` (autre table référencée indépendante des items), pas dans `Content`.
- **`Decor.path` est une capacité de mouvement V2, pas une propriété de pose ou de visibilité** — il décrit le segment entrant vers le keyframe qui référence ce décor. Une absence de `path` signifie la droite source→cible implicite ; les pixels de viewport et les mesures de bounding box ne sont jamais stockés. Le champ est segment-local : il n'entre pas dans la cascade générale de `Decor` et ne se propage pas aux keyframes suivants. Lorsqu'un décor est partagé et qu'un path est édité, l'éditeur applique le copy-on-write documenté pour isoler le keyframe cible. Les transitions nommées d'entrée/sortie restent portées par le keyframe et ne sont pas remplacées par ce champ. La forme du chemin est celle du contrat CodPlay V2 (`M`/`L`/`A`, préparation `arc-length`) ; l'éditeur ne crée pas de grammaire concurrente.

---

## Réglages de scène

**Ce sont des réglages de l'APP (ed2), pas des réglages Codplay.** Certains seront *appliqués* à Codplay au build (transmis à la scène compilée), mais ici on décrit ce que **l'app** règle sur une scène — pas la config du moteur. Distinction à tenir : le document ed2 possède ces réglages ; le Builder en projette une partie vers Codplay.

Familles :
- **identité / durée** : `title` (ou `name`), `durationMs` et sa **source** (`durationSource`, voir ci-dessous). Réglages d'app, éditables.
- **affichage / lecture** : unité de temps de la timeline, ordre de lecture des capsules (`forward`/`backward`). Réglages d'app.
- **ce qui sera appliqué à Codplay** : l'app peut définir un **état de scène** et des **hooks** (`onStart`, `onSequenceEnd`) qui seront *transmis* à la scène Codplay au build. Ce ne sont pas des réglages du moteur qu'on hérite — c'est l'app qui les pose et que le Builder projette. (Capacités déjà exposées côté `SceneDocEditor`.)

Regroupés dans `SceneMeta`. À cadrer en spec : la frontière exacte entre réglage d'app pur (timeline, unité de temps — jamais vu par Codplay) et réglage d'app *appliqué* à Codplay (state, hooks, durée — projeté au build).

### `durationSource` — d'où vient la durée de la scène

Marque **d'où** la scène tient sa durée :
- **`arbitrary`** — durée posée à la main par l'auteur (défaut).
- **`audio-primary`** — durée **récupérée de la piste audio** : un son pilote la longueur de la scène.
- **`mixed`** — combinaison.

**État réel (vérifié)** : le champ existe et s'écrit, mais **aucune logique ne le lit** aujourd'hui — c'est un marqueur d'intention, pas encore fonctionnel. « Récupérer la durée du son » suppose le chantier audio ci-dessous.

---

## Le son / média dans une scène — un item, plus un rôle

**Un son est un item, comme tout média — mais son type reste spécifique côté ed2.** Deux niveaux à ne pas confondre :
- **Côté Codplay (runtime)** : le type `media` est **unifié** — un tag `<video>` lit aussi le son, donc un seul composant média suffit pour audio et vidéo.
- **Côté ed2 (auteur)** : on **garde une spécificité par type de média** (`image`, `video`, `media`/son… — `ItemType`), car chacun a des **propriétés dédiées** à l'édition (un son n'a pas d'image à cadrer, une vidéo si, etc.). C'est déjà la règle d'`ItemType` (item-model-spec §5) : types distincts côté auteur, jamais fusionnés sous un `media` générique.
- **Le Builder fait la traduction** : le type spécifique ed2 → le perso média unifié Codplay. Même frontière que partout (vocabulaire auteur riche → vocabulaire runtime résolu).

Donc un son est un **item** (de son type média propre), dans `items[]`, avec sa source (content), ses keyframes, son décor — **pas** une entité séparée. Ne pas sortir le son du modèle des items : ce serait une asymétrie injustifiée. Mais ne pas non plus l'aplatir en `media` générique côté ed2 : son type porte ses propriétés d'édition propres.

Ce qui est **spécifique** n'est pas le son, mais un **rôle** et des **données annexes** qui s'attachent à un item média quand il le porte :

**Le rôle « master ».** Un item média placé **sur la piste dédiée** joue le rôle **master** : il **porte le rythme** — il peut caler la durée de la scène (`durationSource: 'audio-primary'`) et sa voix est exploitée en **cues**. La scène garde une **référence** vers cet item (`masterItemId`), facultative (une scène peut n'avoir aucun master). « Master » est un rôle attribué à un item, pas une autre nature d'objet.

> **`masterItemId` est PROVISOIRE — il ne survivra pas au multipiste.** Une **référence unique** suppose *un seul* son master. Le mini-éditeur audio multipiste (plusieurs sons composant la bande maîtresse, en série/parallèle) invalidera ça : « master » deviendra une propriété de **piste**, pas un item unique désigné. La forme définitive (piste maîtresse portant N sons, l'un d'eux fournissant les cues/le rythme) se posera avec le chantier multipiste. D'ici là, `masterItemId` est une commodité v1 mono-son, à remplacer — ne pas la traiter comme stable.

**La piste de cues.** Attachée à l'item master (`cues[itemId]`) : la voix extraite (whisper) → cues ponctuels aimantés. Un média d'**accompagnement** (musique, vidéo qui ne pilote pas le temps) est **le même type d'item**, simplement sans le rôle master ni cues — il joue, c'est tout.

La différence n'est donc ni le format ni la nature (tout est item média) mais le **rôle** : désigné master (sur la piste dédiée) → rythme + cues ; sinon → média ordinaire, muet de cues.

**Questions de représentation dans le sequence-editor — isolées dans un document propre.** Comment ces sons/vidéos s'**affichent** dans la timeline (accompagnement rejoignant les autres sons au multipiste, placement de la vidéo master et ses deux pistes solidaires) relève du sequence-editor, pas du modèle → `2026-07-11-sequence-editor-representation.md`. Le modèle ne fixe que les **natures** (master / accompagnement), pas leur rendu.

### Le son master — un item média + un rôle + une piste de cues

Le son est un **item** de son **type média propre** (côté ed2 ; unifié en perso média au build). Rien de spécial dans son modèle d'item : source (content), keyframes, décor. Ce qui s'y **ajoute** quand il est master :

```
// dans EditorScene :
masterItemId?: id              // → l'item média « master » (piste dédiée). Facultatif. PROVISOIRE (multipiste).

// les cues NE sont PAS dans EditorScene : ce sont une donnée du Content du média (Content.cues),
// car c'est la transcription de CETTE source. Le master les porte via son contentId.

Cue {                          // un repère temporel ponctuel, aimanté (défini une fois, cf. bloc de types)
  id; timeMs; text
}

// la waveform du média (affichage timeline) vit elle aussi dans son Content, pas dans un objet à part.
```

- **L'item master porte sa piste de cues via son Content** (`contents[masterItem.contentId].cues`) : à son chargement, la transcription produit un cue **ponctuel aimanté** par borne de mot (start et end → deux cues), en synchrone (mécanique whisper : discussion). **Pas de table `cues` dans `EditorScene`** — cohérent avec « les cues sont une donnée de la source » (Content).
- **La waveform** (affichage timeline) est aussi une donnée du **Content** du média — pré-calculée à l'import.
- Le master peut **caler la durée de la scène** (`durationSource: 'audio-primary'`).
- **Volume / clip son** : à venir avec le chantier mini-éditeur audio (ci-dessous), portés au niveau de l'item média ou de sa piste — pas encore dans le modèle.
- **Écarts avec l'existant (migration)** : aujourd'hui le sequence-editor a une liste `cues` **globale** et un `AudioTrack` **séparé et unique** ; le modèle cible fait du son un **item media** ordinaire, ses cues **dans son Content**, avec `masterItemId` (rôle) pour désigner celui qui porte le rythme.

**Chantier « mini-éditeur audio » (multi-sons, volume, clip son) — sequence-editor, non fait.** Détail isolé dans `2026-07-11-sequence-editor-representation.md`. Ce dont le **modèle** dépend : `durationSource: 'audio-primary'` (durée du master) et le multi-sons attendent ce chantier ; d'ici là, un item master + sa piste de cues.

Les grains associés (mot conservé, phrase et phonème à venir — sous-titres, avatar) sont décrits dans la discussion ; le modèle du son n'en porte que le grain-mot (les cues), les autres grains s'ajouteront à leurs chantiers.
