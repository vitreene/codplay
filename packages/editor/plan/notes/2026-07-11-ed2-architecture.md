# ed2 — Schéma organisationnel et fonctionnel

Explication par l'image : comment l'app est organisée, et comment elle fonctionne quand l'auteur agit. Support d'un futur rendu graphique — le texte est la légende du schéma.

---

## Le schéma

```
          ╔═══════════════════════════════════════════════════════════════╗
          ║                    ESPACE AUTEUR — l'app                       ║
          ║                                                                ║
          ║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ║
          ║   │ timeline │  │  décor   │  │  zones   │  │ cadre de sél.│  ║  ← composants
          ║   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  ║    d'édition
          ║        │             │             │               │          ║
          ║        │   intentions (émises par les composants)  │          ║
          ║        └──────┬──────┴──────┬──────┴───────────────┘          ║
          ║               ▼             ▲                                  ║
          ║        ┌──────────────────────────┐                           ║
          ║        │   FAÇADE DE COMMANDES     │  voie d'écriture unique   ║
          ║        │  createItem · setDecor ·  │  une commande = 1 commit  ║
          ║        │  createCapsule · placeIn  │  transaction() = macro    ║
          ║        │  Zone · transaction(…)    │                           ║
          ║        └───────────┬──────────────┘                           ║
          ║                    ▼ mute                                      ║
          ║        ┌──────────────────────────┐        ┌───────────────┐  ║
          ║        │   MOTEUR — contrôleur     │──commit│ persistance   │  ║
          ║        │   ◈ possède le document   │───────►│ historien u/r │  ║
          ║        │   EditorScene + sélection │        └───────────────┘  ║
          ║        └───────────┬──────────────┘                           ║
          ║                    │ projection du document                   ║
          ║                    └──────────► (re-rend les composants) ──────╫──┐
          ║                                                                ║  │ boucle
          ╚════════════════════════════╤═══════════════════════════════════╝  │ auteur
                                        │ le document                          │
                          rebuild ▲     ▼                                       │
                                  │  ┌───────────────┐                          │
                                  └──│    BUILDER    │  frontière (pure)        │
                                     │  EditorScene  │  capsule/item → perso    │
                                     │  → scène+CSS  │  décor → CSS / classes   │
                                     └───────┬───────┘                          │
                                             │ scène compilée                   │
                                             ▼                                   │
          ╔═══════════════════════════════════════════════════════════════╗    │
          ║              DIFFUSION — Codplay (le player)                   ║    │
          ║   séquenceur : joue la scène compilée, image par image        ║    │
          ║                                                                ║    │
          ║   état AUTEUR : monté dans l'app, surface d'édition ◄──────────╫────┘
          ║        les composants s'y accrochent ; le décor y applique
          ║        un aperçu direct (preview) ┄┄┄┄┄┄► DOM (éphémère)
          ║
          ║   état DIFFUSION : joue seul, sans l'app
          ╚═══════════════════════════════════════════════════════════════╝
```

Deux boucles se lisent sur ce schéma :

- **Boucle d'édition (auteur)** : un composant émet une **intention** → la **façade** la traduit en mutation → le **moteur** mute le document → une **projection** redescend, les composants se re-rendent. Sur commit, **persistance** et **historien** observent.
- **Boucle de rendu** : à chaque mutation, le **Builder** recompile le document → le **player** rejoue la scène. En état auteur, le player est dans l'app (les composants s'y accrochent) ; le décor peut court-circuiter par un **aperçu direct** sur le DOM (éphémère, hors document). En état diffusion, le player joue seul.

---

## Légende — l'espace auteur

**Les composants d'édition** — chacun édite une facette, tous fonctionnent pareil : ils *rendent* une projection du document et *émettent* des intentions ; aucun ne détient de copie du document.

| composant | édite |
|---|---|
| **timeline** | la place des items dans le temps (ordre, keyframes) |
| **décor** | géométrie, habillage, contenu d'un item ; réglages d'une capsule — un item ou plusieurs |
| **zones** | l'intérieur d'une capsule (grille, zones nommées) |
| **cadre de sélection** | désigne un item directement sur la surface du player |

La **sélection** est commune (dans le moteur), alimentée par plusieurs composants : sélectionner un keyframe (timeline) ou un item (cadre) désigne le même objet. Elle est portée par **identité stable** — elle survit à la reconstruction d'un nœud.

**La telco — le pilotage du player (transport, pas édition).** Une région/surface dédiée pour **opérer le player** : play / pause / stop / **seek**, et l'affichage de l'état de lecture. À distinguer des composants d'édition ci-dessus : la telco **n'écrit pas le document** (elle ne passe **pas** par la façade de commandes) — c'est du **transport**, elle pilote le player via le contrôleur. Elle correspond à la surface de pilotage vue côté Codplay.
- **Seek depuis la timeline** : déplacer la **tête de lecture** dans le sequence-editor **entraîne aussi un seek** du player. Le transport n'est donc pas exclusif à la telco — la timeline en est un organe partiel (déplacer le playhead = seek). Les deux (telco, playhead-timeline) émettent la **même** intention de seek au contrôleur, qui la relaie au player (`player.seek`). État vérifié : le sequence-editor a bien `playheadMs` / `dragging-playhead` / une méthode `seek(timeMs)`, mais **interne** (déplace sa propre tête) — la **propagation vers `player.seek()` reste à établir** via le contrôleur. Point de branchement à faire, pas acquis.

**La façade de commandes** — la seule porte d'écriture du document. Les composants n'écrivent jamais directement : ils passent par une commande. Une commande = une entrée d'historique ; une `transaction(…)` groupe plusieurs mutations en une seule action annulable — c'est la forme des **macros** (un lot d'images → une capsule carousel, coller, appliquer une card).

**Le moteur — le contrôleur** — possède le document (`EditorScene`) et la sélection, en un seul exemplaire. Il applique les mutations (transformations *pures* du document), puis rediffuse une projection. Il gère aussi le document courant parmi plusieurs (ouvrir / sauver).

**Les services** — **persistance** (écrit le document, local puis distant) et **historien** (undo/redo) observent les commits ; ils sont branchés à côté du moteur, pas dans les composants.

---

## Légende — la frontière (Builder)

Le seul passage entre l'app et le player. Transforme le document auteur en scène jouable — `EditorScene → scène compilée + CSS`. Transformation **pure** (rejouable, testable hors DOM). C'est **ici, et nulle part ailleurs**, que le vocabulaire auteur (capsule, item, décor) devient le vocabulaire Codplay (perso, CSS, classes). L'app ne nomme jamais les entités Codplay.

## Légende — la diffusion (Codplay)

Le player est un **séquenceur** : il joue la scène compilée, sans rien savoir du document auteur ni du contexte où il tourne. Il a **deux états** :

- **auteur** — monté dans l'app comme surface d'édition ; les composants s'y accrochent ; le décor y pose un aperçu direct sur le DOM (éphémère, jamais consolidé).
- **diffusion** — joue seul, la scène compilée suffit.

Le moteur Codplay est le même dans les deux ; seul change le fait d'être entouré, ou non, par l'app.
