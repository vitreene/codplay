# ed2 — Plan de construction de l'app

**Périmètre** : construction de l'application — sa page propre, le squelette de layout, le contrôleur général, les composants d'interface, la sauvegarde locale, l'horizon backend. Le décor (dedit lui-même) est un module déjà existant ; son intégration est ici, sa refonte hors périmètre.

**Documents liés** : modèle de données (normatif, `app/2026-07-11-ed2-document-model.md`). **Schémas de présentation** (pédagogiques, `notes/`) : architecture logique (`notes/2026-07-11-ed2-architecture.md`), présentation Codplay (`notes/2026-07-11-codplay-presentation.md`). **Discussion** (`notes/`) : `notes/2026-07-10-app-construction-discussion.md`.

## Cadre

- `index.html` est le point d'entrée de l'app (monte `src/app/main.tsx`). Les démos sont hors de son périmètre : déplacées sur `demo.html` (aiguillage `?demo=` de `src/main.ts` inchangé), chemin temporaire, à effacer plus tard.
- L'interface est en React (stack : React + shadcn + base-ui ; politique de hooks : `skill.md`, racine du repo). Le sequence-editor et le player Codplay restent vanilla et s'intègrent en îlots (montés dans des conteneurs DOM dédiés, pilotés par API et événements).
- XState possède tout l'état partagé ; React ne fait que du rendu.
- Le **contrôleur central** possède le document ; toute mutation passe par une **façade de commandes** (voie d'écriture unique). Les fonctionnalités se **composent** de commandes de base, elles ne se codent pas en dur.
- Eddy n'est pas une référence. Consultation sur invitation seulement ; jamais de reprise littérale.
- Aucune dépendance installée sans autorisation explicite.

## Cible d'ensemble

Une page unique, en régions (flex/grid, jamais `position:absolute`) :

- **menu** — actions de scène (nouvelle, titre, sauvegarde) ;
- **chutier** — panneau des médias (import, filtré par scène) ;
- **scène** — région centrale : le player Codplay y est monté (alimenté par le Builder) ;
- **timeline** — bande basse : le sequence-editor vanilla y est monté ;
- **panneau d'édition** — édition de l'item/capsule sélectionné (dedit) ;
- **telco** — pilotage du player (play / pause / stop / seek + état de lecture). **Transport, pas édition** : n'écrit pas le document, pilote le player via le contrôleur. Le seek est aussi émis par le déplacement de la tête de lecture dans la timeline.

Le **contrôleur central** (machine XState racine) possède le document et l'état partagé ; composants React, îlots vanilla et services (persistance, historien) s'y raccordent.

---

## Structure de données (rappel — détail : `2026-07-11-ed2-document-model.md`)

Le document que le contrôleur possède :

```
EditorScene {
  id
  meta:     SceneMeta            // réglages d'app (titre, durée+source, unité de temps, ordre
                                 //   capsules ; sceneState/hooks projetés vers Codplay au build)
  items:    Item[]              // à plat ; arbre dérivé de parentId + order
                                 //   — un SON est un item (type média spécifique), comme tout média
  contents: Record<id, Content> // ce que montre chaque item (source, texte, waveform, cues…)
  decors:   Record<id, Decor>   // l'aspect VARIABLE d'un item (par kf) : style/classes/position/zone
                                 //   — PAS le texte (→ Content) ni la capsule (→ Item.capsule)
  zones:    Record<id, Zone>    // emprises nommées (par capsule), par id stable
  masterItemId?: id             // RÉFÉRENCE vers l'item média « master » (piste dédiée) — facultatif.
                                 //   « master » est un rôle, pas une nature. Ses cues = dans son Content.
}

Item {
  id                            // = id du perso au build
  type                          // text | image | media | video | capsule … (ItemType)
                                //   spécifique côté ed2 (props d'édition dédiées) ;
                                //   Codplay unifie media/video en un perso média au build
  parentId                      // ref parent (null = enfant racine)
  order                         // clé textuelle fractionnaire ("a","b","ab"…)
  contentId                     // → contents (null si capsule)
  initialDecorId                // → decors : décor de base obligatoire (état « intro terminée »)
  keyframes: Keyframe[]         // vie dans le temps
  capsule?: CapsuleDef          // si capsule : sous-type, distribution, grille (défini une fois)
}

Keyframe { id; timeMs; decorId; transitionIn?; transitionOut?; name? }
CapsuleDef {                     // SEUL type capsule ; sur l'item, statique. Absorbe l'ex-CapsulePatch.
  kind; distribution{mode,staggerInMs?,staggerOutMs?}; grid?{rows,cols,gap?}
  defaultTransitionIn?; defaultTransitionOut?; behavior?
}
Content {                        // ce que l'item montre + infos de sa source
  id; type
  source?                        // ressource (média) ; absent pour un texte pur
  text?; textAutoSize?; lang?    // texte : contenu, intention auto-size, langue
  waveform?; cues?               // média voix : forme d'onde + grains (mot ; puis phrase/phonème)
}
Decor   { id; style?; classes?; position?; zoneId? }   // aspect variable seulement
Zone    { id; name; /* surfaces par orientation */ }
Cue     { id; timeMs; text }   // un start OU end de mot ; ponctuel, aimanté
```

**Un son est un item**, comme tout média — mais son **type reste spécifique côté ed2** (`ItemType` distingue `image`/`video`/son… pour leurs propriétés d'édition propres). Codplay, lui, **unifie** : un tag `<video>` lit aussi le son, donc le Builder dérive ces types vers un même perso média. Deux niveaux, le Builder traduit. Il n'y a **pas** d'entité audio séparée : le son est un item. Ce qui s'y **attache** quand il a le rôle : la désignation **master** (`masterItemId` → un item média sur la piste dédiée, qui porte le rythme) et sa **piste de cues** (`cues[itemId]`, voix extraite). Un média d'accompagnement est un item du même genre, sans master ni cues. La `waveform` (affichage timeline) vit dans le `Content` du média.

Points de **migration** du code actuel vers cette cible (tranchés, à porter — pas à redécider) : `itemType` + `contentId` (vs `contentType` en dur) ; `parentId` + `order` fractionnaire (vs arbre `children[]`) ; `initialDecorId` au niveau item (aujourd'hui seulement `rootDecorId`) ; le son devient un **item media** + `masterItemId` (provisoire, cf. multipiste) + `cues` indexées par item (vs l'`AudioTrack` séparé et unique actuel) ; **`CapsuleDef` unique sur l'item** (vs `CapsulePatch` de dedit + `Decor.capsule` — fusion, la capsule sort du décor) ; **texte dans `Content`** (vs `DecorPatch.text`). Voir la discussion pour le détail.

---

## Méthode de test — valider l'app au plus tôt

**Principe : tester l'intégration dès qu'une connexion existe, pas à la fin.** Chaque étape se ferme sur une vérification *observable*. Deux niveaux, complémentaires :

- **Tests unitaires (sans DOM, vitest)** : la machine du contrôleur (transitions, frontières), les **commandes de la façade** (mutations pures `(EditorScene, args) → EditorScene`, testées par entrée→sortie comme `zone-model`/le Builder), l'historien (empilement, borne, redo invalidé), la persistance (sérialisation/rejet de version).
- **Tests d'intégration (jalons)** : à chaque connexion nouvelle entre modules, un **embryon de scène** minimal exercé de bout en bout, vérifié à la fois par test et par rendu réel dans l'app. Le premier — et le plus important — est le **jalon d'intégration player↔sequence-editor↔décor** ci-dessous.

### Jalon d'intégration — « un item qui vit » (première vérification de la chaîne)

**Constat de départ (vérifié)** : Builder, sequence-editor, décor et zones existent et sont testés **isolément** ; le Builder→player est prouvé en démo. Mais la **chaîne assemblée player↔sequence-editor↔décor n'existe nulle part** — leur intégration n'a **jamais** été câblée ni vérifiée. C'est le premier trou à combler, et le premier test à écrire.

Dès que le contrôleur relie ces trois modules, créer un **embryon de scène — au moins un item** — et vérifier que les connexions fonctionnent réellement :

1. **Un item dans le document** (via une commande de la façade) → le **Builder** le compile → le **player** l'affiche dans la région scène. *Vérifie : document → Builder → player.*
2. **Le sélectionner** (depuis la timeline, ou le cadre sur le player) → la sélection est dans le contrôleur → le **panneau décor** s'ouvre sur cet item. *Vérifie : sélection commune, timeline/cadre → contrôleur → dedit.*
3. **Éditer son décor** (une valeur, ex. couleur de fond) → commit → le document change → rebuild → le player reflète. *Vérifie : dedit → façade → document → re-projection.*
4. **Déplacer la tête de lecture** dans la timeline → **seek** relayé au `player.seek()`. *Vérifie : la liaison playhead→seek (à établir — aujourd'hui le seek du sequence-editor est interne, ne propage pas au player).*

Chaque point est un test d'intégration : il échoue tant que la connexion visée n'est pas faite, il passe quand elle l'est. C'est le **harnais minimal** qui rend l'app testable dès sa première chaîne vivante — avant d'ajouter le moindre composant de confort.

---

## Étapes

### Étape 1 — Squelette vide (layout + librairies)

La page existe avec ses régions vides ; la stack est en place ; zéro logique métier.

1. **Entrée** : `index.html` à la racine du package, monte `src/app/main.tsx`. `vite.config.ts` passe en multi-entrées (app + démos) + plugin React. Dev : `http://localhost:5174/index.html`. Démos déplacées sur `demo.html` (temporaire).
2. **Point d'entrée mince** : montage React + démarrage du contrôleur, rien d'autre.
3. **Dépendances** : `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@xstate/react`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `@base-ui-components/react`. shadcn = composants **copiés** dans `src/app/ui/`, pas une dépendance — **chaque composant shadcn est proposé à l'utilisateur et validé avant d'être ajouté** (liste soumise, jamais copié d'office ; l'usage d'un composant déjà validé ne redemande pas d'accord).
4. **TypeScript** : `jsx: "react-jsx"` dans le `tsconfig.json` du package.
5. **Arborescence** : `src/app/` — `main.tsx`, `layout/`, `ui/`, `controller/`, `commands/` (la façade).
6. **Layout vide** : les régions (dont **telco**), en classes CSS, marquage minimal.

**Validation** : `index.html` affiche le squelette ; les démos fonctionnent comme avant sur `demo.html` ; typecheck propre.

### Étape 2 — Contrôleur central + façade de commandes

Machine XState racine, définie avant d'être codée (convention « cœur »). La **façade de commandes** est posée en même temps : c'est l'interface d'écriture du document, et le socle de l'undo, des transactions et de la composition.

- **Possède** : le document (`EditorScene`), la sélection, le mode, la visibilité des panneaux, le cycle de vie (document courant parmi plusieurs).
- **Ne possède pas** : l'éphémère des gestes des modules (viewport, tracé, preview).
- **Façade** : commandes de base (`createItem`, `attachItem`, `setDecor`, `createCapsule`, `placeInZone`…) + `transaction(…)` (groupe N mutations, un commit). Voie d'écriture unique.
- **Branchement React** : un `createActor`, `useSelector` + envoi d'événements. Aucun `useState` partagé.
- **Branchement îlots** : ponts machine ↔ API vanilla dans des acteurs du contrôleur.

**Validation** : tests de la machine et des commandes (mutations pures) ; démonstration dans le squelette — une mutation depuis une région se reflète dans une autre.

### Étape 3 — Intégration player↔sequence-editor↔décor + jalon « un item qui vit »

Monter les deux îlots vanilla (player, sequence-editor) et brancher dedit, tous pilotés par le contrôleur. **C'est ici que la chaîne jamais assemblée est câblée** — et immédiatement vérifiée par le **jalon d'intégration** ci-dessus (les 4 points). L'app affiche sa première scène réelle (`EditorScene` → Builder → player) avec un embryon minimal (un item), et prouve que les connexions tiennent.

Établir en particulier la **liaison playhead→seek** (point 4 du jalon) : le déplacement de la tête dans la timeline relaie un `player.seek()` via le contrôleur — non fait aujourd'hui.

**Validation** : le jalon « un item qui vit » passe (test + rendu réel) ; puis chaque composant ajouté (menu, chutier, telco, panneau) livré avec ses tests et manipulé dans l'app.

### Étape 4 — Historique (undo/redo)

Ajouté dès que le pont « mutation → document → re-projection » de l'étape 3 tourne. L'undo/redo **consomme** ce pont ; l'implémenter ici le valide.

- **Historien** = acteur hors machine, branché sur la façade : snapshot du document au commit, rétabli au undo/redo.
- **Périmètre annulable** = mutations passant par la façade uniquement (l'éphémère — sélection, scroll, transport — n'y entre pas).
- **Réconciliation** = un undo rétablit le document puis re-projette (rebuild player + recalage îlots) par le **même** chemin que la restauration.
- **Granularité** = une entrée par action (garantie par le commit débouncé), un rebuild par undo.

**Validation** : annuler/refaire une édition restaure état et rendu ; un undo n'affecte pas l'éphémère ; tests de l'historien.

### Étape 5 — Sauvegarde locale

Le travail survit au rechargement, sans backend.

- **Persisté** : l'`EditorScene` sérialisé, clé versionnée, champ de version dans la charge (format ancien rejeté).
- **Mécanique** : un **acteur de persistance** abonné aux commits écrit ; la restauration passe par l'événement de chargement au démarrage.
- **Frontière** : seul cet acteur connaît localStorage.
- **Plusieurs scènes de test** : localStorage doit tenir **plusieurs** `EditorScene` nommées (pas une seule clé), et l'app doit permettre d'en choisir une à charger — c'est le mécanisme provisoire qui remplace les démos éditeur supprimées (`demo.html`). **Sélecteur** : un simple `<select>` listant les scènes sauvegardées, patch provisoire — à retirer quand un vrai système de navigation entre scènes (backend, étape 6) existera. Détail (clé d'index) à concevoir à l'ouverture de cette étape.

**Validation** : recharger restaure la scène ; tests de sérialisation/restauration, rejet d'une version ancienne.

### Étape 6 — Backend

prisma + sqlite. Remplace l'implémentation de l'acteur de persistance de l'étape 5 ; rien d'autre ne change. Modèles de données élaborés à l'ouverture. Piste : architecture react-router (le point d'entrée mince de l'étape 1 garantit que ce basculement ne touche que la couche de service). Jusque-là, l'app est purement navigateur.

---

## Hors périmètre

- Le décor : dedit lui-même (module existant, ici intégré), migration `ZoneDef` dedit, refonte UI dedit.
- L'intégration cs↔zones du plan selection-frame.
- Le texte (module dédié, chantier propre), les ressources tierces (registre de composants), whisper — chantiers nommés, non ouverts ici.
- Le mini-éditeur audio (multipiste, volume, clip) — `modules/2026-07-11-sequence-editor-representation.md`.
- Les variantes d'orientation — `modules/2026-07-11-zone-orientation-variants-plan.md`.
- Le détail de l'étape 6 (backend) — plan propre à écrire à son ouverture.

## Conventions

- Chaque étape s'ouvre sur accord explicite et se ferme sur validation observable (tests + rendu réel).
- Parties cœur (contrôleur, façade) : définition validée avant le code, incréments courts montrés au fil de l'eau.
- Le jeu de **commandes de base** est le vrai investissement (complet, orthogonal) ; les features se composent.
- Code très documenté ; tests synchronisés avec chaque ajout ; flex/grid uniquement ; style inline réservé aux transitions ; aucun défaut inventé à la volée.
- Un seul serveur de dev (5174) sert l'app et les démos.
