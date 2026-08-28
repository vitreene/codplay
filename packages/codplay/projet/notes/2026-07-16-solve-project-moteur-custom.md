# Codplay V2 — cahier des charges émergent

> **Résumé des points clés (2026-07-26).** Cette discussion projet a fait converger plusieurs
> réflexions vers ce qui ressemble au cahier des charges d'une **codplay V2**. Les points clés, avant
> le détail (S1-S8 ci-dessous) :
>
> 1. **Flux unique `solve → project`** (S5, S7). À partir des events : `materialize → resolve → solve
>    (état perso natif, à `t`, toutes interpolations FLIP comprises) → project (état → substrat) →
>    render`. Le player **calcule un état**, les composants le **projettent**. Renversement : plus
>    « animer des nodes via une lib », mais « résoudre un état, puis l'adapter au substrat ».
> 2. **Projection à sens unique** (S1). `item → perso → node` ne s'inverse jamais. Toute capture lit
>    l'**état logique** (`PersoState`), jamais le node de rendu. La transform de rendu est un artefact
>    jetable, pas une source de description.
> 3. **Moteur d'interpolation custom** (S2-S4, S6). Retirer anime.js : emprunter ses **algos purs**
>    (courbes Penner, forme d'API) et **rejeter son runtime à état** (timeline, cache, son `set`).
>    Point d'entrée = l'unité, **déjà hors anime** (`resolveContainerQueryValue`). `solve(from,to,ease,t)`
>    devient une fonction pure ; `project` est le **seul `set`**, unifié dans `component.update`
>    (aujourd'hui **deux `set` = deux écrivains**, redondance à supprimer).
> 4. **Un seul écrivain, un seul état, un seul `set`** — le gain premier est **architectural** :
>    codplay fait aujourd'hui deux fois la même chose ; la V2 retire la redondance, elle n'ajoute pas
>    de puissance.
> 5. **La Projection : cible de rendu déclarée** (S8). Le substrat (DOM) cesse d'être implicite. Une
>    Projection expose des capacités abstraites — `set` / `measure` / `mount` — dont les composants
>    dépendent. Le DOM devient *une* Projection ; canvas et multi-cibles deviennent possibles.
>    Concept **codplay**, pas ed2. Généralise le `move backend` de `move-separation-policy` à toutes
>    les propriétés.
> 6. **`measure` est irréductible** : la position réelle d'un node n'est pas toujours le produit propre
>    des matrices logiques (overflow/reflow non prédictibles). `measure` reste le recours d'exactitude
>    au pixel — cas limite du **seek FLIP sous ancêtres mobiles**
>    (`2026-07-26-seek-flip-ancetres-mobiles.md`).
> 7. **Séquençable sans big-bang.** La frontière solve/project est neutre au moteur (anime la remplit
>    via mirror aujourd'hui, custom demain). Migrer le player vers cette frontière *avec anime
>    dessous*, puis glisser le moteur custom. Jamais un big-bang.
> 8. **État = `f(scène, t)` — constitutif et atteignable.** L'état à `t` est accessible comme
>    **projection de la scène**, sans reconstruction progressive (modèle three.js). Le seek devient
>    une **évaluation** (donc **synchrone**), pas un rejeu — réversible. Tout se lit par
>    **interrogation** : continu → évaluation (déjà : `capturePersoStatesMirror`) ; discret (`move`
>    on/off) → **fenêtre de validité** (déjà implémenté, réversible) ; capturé (`persist`) → valeur
>    figée relue ; interaction → écrit dans la scène (indétermination résolue). Seuls les **effets à
>    side-effect** restent un rejeu filtré (rares, isolés). **C'est *moins* d'état, pas un store** ;
>    faisabilité = un **inventaire** (events rejoués → fenêtre-de-validité vs effet irréductible), pas
>    un pari. Détail : `2026-07-26-etat-fonction-de-t.md`.
> 9. **Portabilité = conséquence de la V2, et contrainte de rédaction.** Cœur agnostique / composants
>    sur mesure : un portage (cas concret Flutter) devient « cœur inchangé + composants réécrits + une
>    `FlutterProjection` » — les obstacles au portage SONT les points V2 (nodes dans le player →
>    Projection ; impératif → f(t)/déclaratif ; cqw/anime web → Projection/moteur custom). Surtout :
>    tenir la contrainte de portage **discipline le code TS présent** (interdit à l'écriture les fuites
>    de plateforme — les cicatrices web sont ces fuites). Chantier **typage** mûr : les `unknown`
>    étaient de l'indétermination, les cas d'usage l'ont résolue → remontée des cas vers types, pas
>    invention. Détail : `2026-07-26-portabilite-contrainte-redaction.md`.
>
> Ce document dit **quoi construire** (S1-S9 ci-dessous). Le **comment mener** le chantier (réécriture
> franche, tests-oracle, structuration, façade multi-canaux, rien-en-dur, revue I/O) est dans
> `2026-07-26-conduite-chantier-v2.md`. Aucun code écrit pour la V2 (seul le correctif §0 est livré).

---

# Réflexion — réduire la surface d'anime.js, vers un module de style natif

Note de consignation, écrite après la résolution du bug cqw mixte (voir
`packages/editor/plan/notes/2026-07-14-offset-cqw-double-conversion-investigation.md`
pour cet historique-là). Cette note est distincte : elle documente la réflexion
architecturale plus large que cette investigation a déclenchée, côté
`packages/codplay` exclusivement. Aucun code n'a été écrit pour les chantiers
ci-dessous — seul le correctif de la cause racine (§0) est livré.

> **Cadre directeur (2026-07-26)** — les §0-§8 ci-dessous restent valides, mais une
> discussion postérieure leur a donné une **exigence directrice** qui réoriente leur
> raison d'être. `getPersoStates()` (`2026-07-25-perso-state-at-t-plan.md`) a matérialisé,
> en production, le fait que codplay veut être « **solve puis project** ». Les deux sections
> suivantes (Synthèse / Discussion) portent ce cadre ; elles priment sur toute formulation
> antérieure qui le contredirait.

---

## Cadre directeur — synthèse (2026-07-26)

Trois sujets liés, discutés en mode projet (aucun code écrit). Point par point, ce qu'on retient.

### S1. La projection `item → perso → node` est à sens unique, par conception

1. Le flux est `item (description auteur) → perso state @ t (état logique, unité native) →
   node (rendu)`. Il ne s'inverse **jamais** : on ne relit pas le node pour reconstruire une
   description. Détaillé en mémoire `project-item-perso-node-one-way-projection` et dans
   `packages/editor/plan/2026-07-25-decor-unified-channel-plan.md` §C.
2. Trois raisons irréductibles : projection surjective (plusieurs descriptions → même rendu),
   état transitoire ≠ consigné (matrice en pleine transition = point intermédiaire, pas intention),
   intrusion de substrat (relire le DOM ferait entrer le rendu dans le modèle).
3. Vérif empirique faite : aucun module d'authoring ne relit un node d'item comme source. Les
   lectures node existantes sont légitimes et ne visent pas un node d'item (hit-testing timeline,
   `referenceWidthPx`, mesure de police auto-size).

### S2. « Solve au niveau perso, project = un `set` » est le vrai fonctionnement latent de codplay

1. Le canal parallèle `capturePersoStatesMirror` n'est **pas** un second moteur : il réutilise
   `createRealAnimeImplementation()` (même anime, mêmes paramètres). Le seul commutateur est
   `target instanceof Element` (`animation/adapter.ts:13`) : cible = objet nu → la valeur native
   traverse sans résolution DOM ; cible = node → résolution + application.
2. Donc la séparation **solve (interpole → état natif)** / **project (état natif → node)** existe
   déjà, fusionnée dans un seul passage anime, révélée par un `if`. Le mirror n'a pas ajouté un
   calcul étranger : il a dû **dupliquer** un étage latent faute qu'il soit premier.
3. Systématiser cette séparation ferait émerger : `getPersoStates()` devient le produit normal de
   solve (fin du canal parallèle, du couplage éditeur-dans-le-player) ; backend réellement
   substituable (canvas/SVG sans toucher solve — généralise `move-separation-policy` à toutes les
   propriétés) ; seek exact par construction (play et seek passent par le même project) ; la règle
   S1 devient l'architecture, plus une discipline à défendre.
4. Coût à mesurer, pas à supposer : une indirection perso-state par propriété par frame (écriture
   mémoire + lecture, pas un recalcul — « project = un `set` »). Intuition : négligeable devant
   layout/paint. **À benchmarker avant tout engagement.**

### S3. La résolution d'unité est déjà hors anime — c'est la première étape qui justifie le moteur custom

1. **Correction d'une erreur de la discussion** : la résolution CQW n'est **pas** dans anime.
   `resolveContainerQueryValue` (`container-query-units.ts`) fait tout (parse, mesure conteneur,
   calcule px) et son commentaire le dit : *« never touches anime.js's own unit handling »*. anime
   ne fait **rien** pour le CQW ; il ne fait que l'appeler via le `if instanceof Element`.
2. Ce fichier est **truffé de contournements d'anime**, pas d'usages : parser contre `margin-left`
   (anime/CSS rejette les cqw négatifs sur `width`), renvoyer `"Npx"` string (anime *drop* un
   nombre nu sur `width`). Ce sont des **cicatrices** de devoir passer par anime, pas des
   intégrations.
3. Conséquence : `resolveContainerQueryValue` **est déjà l'étage project** (natif cqw → px node),
   écrit, testé, à nous. Ce qui reste couplé à anime, c'est seulement le **solve** (interpolation)
   et le `set` final.
4. Donc le moteur custom ne commence pas par « réécrire l'interpolation » : il commence là où anime
   gêne déjà (l'unité), et réécrire le solve est ce qui **efface les contournements** (plus de hack
   `margin-left`, plus de hack `"Npx"`, parce que *notre* solve accepte cqw négatifs et nombres nus).
   La résolution d'unité n'est pas une raison parmi d'autres — c'est la preuve, déjà dans le code,
   que codplay a une sémantique de valeur qu'anime ne porte qu'en fraude.

### S4. Le découpage des deux chantiers — S2 est la spécification de S3

1. Tant qu'anime est le moteur, l'étage solve natif est une **simulation d'anime** (le mirror doit
   instancier un anime éphémère et le seeker). Correct, mais absurde en régime permanent.
2. Un moteur custom **inverse la charge** : `solve(from, to, easing, t) → valeur native` devient le
   calcul lui-même (pur, sans node, testable) ; project reste un `set`. Le `if instanceof Element`
   et les contournements disparaissent.
3. Dépendance asymétrique : systématiser solve/project **sans** virer anime = garder le mirror ou
   deux moteurs (gain réel, coût maintenu) ; virer anime **sans** systématiser = réécrire un moteur
   pour re-piloter le node comme avant (presque sans intérêt) ; **les deux ensemble** = le moteur
   *produit* l'étage solve par construction, l'étage solve *justifie* le moteur. Chacun est la
   raison d'être de l'autre.
4. Reformulation opérationnelle : **S2 (systématiser solve/project) est le cahier des charges de
   S3 (moteur custom).** Pas deux chantiers à coordonner — un chantier (le moteur) dont S2 est
   l'exigence directrice. Ça ne remplace pas le séquencement §7 ci-dessous, ça lui donne son
   critère de réussite : le module du §7.3 doit exposer la frontière solve/project comme contrat
   neutre au moteur (anime le remplit via mirror aujourd'hui, custom demain), permettant de migrer
   le player *avec anime encore dessous* puis de glisser le moteur custom — jamais un big-bang
   (interdit déjà posé en §7 et dans `move-separation-policy`).

### S5. Le flux cible, en une phrase

À partir des **events**, on modèle un **état des perso-projetés** ; on calcule cet état **à `t`** en
résolvant **toutes** les interpolations (FLIP compris) ; on obtient un état à **`set`** dans les
composants, qui **adaptent la projection à leur substrat** (un node, un canvas…). **La librairie
d'animation n'existe plus au niveau composant.**

```
   events  ──►  état perso-projeté  ──►  SOLVE @ t  ──►  état à setter  ──►  PROJECT
   (le modèle)   (le modèle logique)    (résout TOUTES     (natif, sans      (component.update ;
                                         les interp.,       substrat)         le composant adapte
                                         FLIP inclus)                         node/canvas/…)
```

1. **Renversement du modèle mental** : ce n'est plus « le player anime des nodes via une lib », c'est
   « le player calcule un état, les composants le projettent ». L'animation remonte d'un cran (dans
   le solve, au niveau player) et **disparaît de la frontière composant**. Un composant ne connaît
   plus anime ni aucun moteur — il reçoit un état résolu et sait seulement l'appliquer à SON substrat.
2. **« Toutes les interpolations, FLIP compris »** est le point exigeant : le FLIP est aujourd'hui un
   pipeline à part (`create-flip-engine.ts`, lecture DOM + matrices). Dans ce flux il devient **un
   solve parmi d'autres** — il produit une contribution à l'état perso (delta de pose), résolue au
   même endroit que le reste, projetée par le même `set`. C'est ce qui unifie enfin les deux
   représentations de pose que le §5 signale comme risque (discrète côté geste / composée côté rendu).
3. **Substrat-agnostique par construction** : le solve produit un état en unité native, sans node.
   `project` est la seule étape qui connaît le substrat — et elle vit **dans le composant**
   (`component.update` → `applyStyleProps` pour DOM ; un `applyToCanvas` pour un futur composant
   canvas). C'est la généralisation de `move-separation-policy` (backend substituable) à TOUTES les
   propriétés, pas seulement `move`.
4. **Gain formulé par l'auteur** : le gain premier est architectural/logique — **codplay passe
   aujourd'hui beaucoup de temps à faire deux fois la même chose** (deux `set`, deux représentations
   de pose, un canal parallèle qui duplique le moteur). Ce flux ne rend pas codplay plus puissant en
   surface, il **retire une redondance structurelle** : un seul écrivain, un seul état, un seul `set`.

### S6. Ce qu'on emprunte / rejette d'anime (le tri pur vs à-état)

Emprunter les algos d'anime pour **garder la parenté et l'API utile**, sans garder son runtime. Le
critère de tri est net : **les fonctions sans état se copient, les mécanismes à état se rejettent**
(ils sont contradictoires avec codplay, qui les fait déjà autrement).

```
   GARDÉ d'anime (pur, sans état — copié, pas importé) :
   • courbes d'easing (Penner : inOutQuad, outCubic…) — fonctions mathématiques pures
   • forme d'API {from?, to, duration, ease} + injection d'adapter — DÉJÀ tienne (TransitionRequest)
   • l'IDÉE de préparation des données (compléter un `from` absent, normaliser) — voir nuance ci-dessous

   REJETÉ d'anime (à état, contradictoire — codplay le fait déjà, mieux/différemment) :
   • la timeline / le scheduling / la boucle RAF — codplay pilote déjà le tick (useDefaultMainLoop=false)
   • le cache de transform composé (transformsSymbol) — remplacé par l'état perso natif (champs discrets)
   • son `set` (utils.set) — remplacé par TON set unique (component.update → applyStyleProps)
```

- **`from` absent — l'idée oui, l'implémentation non.** anime résout un `from` manquant en **lisant la
  valeur courante du node** : c'est exactement le rétro-flux node→valeur que S1 interdit. On récupère
  l'intention (« compléter un `from` absent ») mais on la ré-implémente sur l'**état perso**
  (`getPersoStates()`/mirror), jamais sur le DOM.
- **Transformation des unités — déjà à nous** (S3), à *libérer* de ses contournements, pas à récupérer.
- **Le `set` à revoir = deux `set` parce que deux écrivains.** Aujourd'hui : le runtime écrit via
  `component.update` → `applyStyleProps` (`dom.ts:149`) ; l'interpolation écrit via `utils.set`
  (`applyTransitionEndValue`, `adapter.ts:210`) — **même séquence** (`resolveFinalValue` →
  `resolveContainerQueryValue` → set) dupliquée. Systématiser solve/project **supprime le second
  écrivain** : l'interpolation ne fait plus que *produire une valeur d'état*, il ne reste qu'UN `set`,
  `component.update`. « Améliorer le `set` » = le **fusionner** dans le canal runtime existant, pas
  l'optimiser localement.
- **Le cache `transformsSymbol` ne disparaît pas, il MIGRE.** Sa fonction réelle (un patch partiel
  `{y}` ne casse pas `x`/`rotate`/`scale` posés ailleurs) devient : `{x, y, rotate, scale}` sont des
  **champs distincts de l'état perso**, et `project` compose le `transform` depuis eux (cf. §5,
  représentation canonique discrète + composition matricielle). Le retrait du `set` d'anime **exige**
  donc l'état perso comme source de la pose composée — S2 est le préalable, encore une fois.

### Axes de dérisquage (ordre de dérisquage, pas d'exécution)

1. **Mesurer** le coût de l'indirection solve/project par frame (micro-bench, jetable) — seule
   inconnue dure de S2.
2. **Compléter l'inventaire** de ce qu'anime fait encore vraiment (base : §1, §3 ci-dessous, mémoire
   `project-codplay-anime-js-surface-shrinking`) — frontière exacte de S3.
3. **Écrire la frontière solve/project comme contrat** (§7.3), neutre au moteur — ce qui rend S2 et
   S3 séquençables au lieu d'un big-bang. Cette frontière est **déjà tracée par nous**, à l'endroit
   où `resolveContainerQueryValue` prend le relais d'anime (S3.3) : à reconnaître et expliciter, pas
   à inventer.

---

## Cadre directeur — discussion (points abordés, non retenus ou nuancés)

Trace des pistes considérées pendant la discussion et écartées, avec la raison — pour ne pas les
re-proposer, et garder visible *pourquoi* le cadre ci-dessus a la forme qu'il a.

- **Relire le node pour reconstruire la description (rétro-flux node→item)** — écarté sur le fond
  (S1). Envisagé sous l'angle « à mi-transition, lire la matrice pour situer l'item » : impossible à
  garantir vrai (surjectif, transitoire, intrusion substrat). Ce n'est pas une optimisation à faire
  prudemment, c'est une classe d'erreur à interdire.
- **Déduire la transform intermédiaire d'un move zone→zone par le calcul** (positions A/B + `t` +
  accroche cible) — écarté d'abord comme *impossible* (il manque matrices-parent, easing, delay
  stagger, translate de départ, chaînage `lastEndCoords` — tout ce que le FLIP lit sur le node ;
  cf. `create-flip-engine.ts plan()`). Puis nuancé : les zones de l'éditeur partageant le **même
  parent**, le repère commun supprime les matrices → la transform *devient* calculable (interpolation
  scalaire `A+ease(t')·(B−A)+px`). **Mais** *pouvoir* ≠ *devoir* : ça reste une position de rendu en
  unité de substrat, jetable, fausse au premier resize. Retenu à la place : un kf posé à mi-move
  consigne l'accroche zone B (discrète, déjà commutée) + l'offset auteur stable — l'intention, que le
  runtime re-projette. Détail complet dans `decor-unified-channel-plan.md` §C.
- **Trajectoire matérialisée comme moyen de « capturer » la position** — reformulé, pas retenu tel
  quel. La trajectoire déclarative (droite = 2 points, arc = courbe) n'est pas un moyen de *lire* le
  rendu : c'est une **propriété du move** que l'auteur *crée*, et qui *rend* la position à `t` lisible
  depuis la description (point sur la géométrie → `lerp`). Elle ne photographie rien ; elle est la
  géométrie que solve interpole. C'est aussi le canal de placement animé qui manquait (résout le
  « trou » du cas 3 détachement, différé). Recoupe le §6 (`spatialCurve`) ci-dessous — même concept,
  vu ici côté auteur.
- **Édition d'un kf à mi-move, option « détachement » (cas 3 : zone C de facto + A→C / C→B)** —
  différée, pas retenue maintenant. Attend la trajectoire (cas 2) qui rendra l'ancrage de C trivial
  et propre (point sur la trajectoire), plutôt que de forcer une lecture node prématurée.
- **« CQW est dans anime, il faut l'en sortir »** — **faux, retiré.** C'est déjà sorti (S3). L'erreur
  m'a fait rater le vrai point d'entrée du moteur custom (l'unité, déjà à nous et déjà en lutte contre
  anime). Corrigé par l'auteur en cours de discussion.
- **Traiter S2 (solve/project) et S3 (moteur) comme deux chantiers à faire « ensemble » au sens de
  coordonnés** — nuancé en plus fort (S4) : ce n'est pas deux chantiers parallèles mais un seul, dont
  S2 est la spécification. « Ensemble » = « le même », pas « en même temps ».

---

## S7. Le flux de données nommé — de la scène au rendu

Formalisation des **7 étapes** du flux, avec leur nom. Le vocabulaire reprend l'existant normatif
(`CompiledScene`, `event runtime`, `TrackEntry`, `seek`, `PersoState`) et n'invente un nom que là où
le code n'en a pas encore : **`solve`** et **`project`**, précisément les deux étages que la cible
rend premiers.

| # | Étape | Entrée → Sortie | Nom | Existe ? |
|---|---|---|---|---|
| 1 | Compilation | `SceneDoc` → `CompiledScene` | **build** | ✅ `builder/` |
| 2 | Émission | tick/seek/geste → `event runtime` | **emit** | ✅ `listen→transform→straps→emit` |
| 3 | Matérialisation | `event runtime` → `TrackEntry` | **materialize** | ✅ track-manager, `eventInsertMode` |
| 4 | Résolution d'action | `TrackEntry` @ t → `ResolvedAction` (payload/perso) | **resolve** (director) | ✅ orchestrator `routeUpdates` |
| 5 | Résolution d'état | `ResolvedAction` + état préc. → `PersoState @ t` (natif) | **solve** | ⚠️ latent (mirror/tween), à rendre premier |
| 6 | Projection | `PersoState @ t` → mutation substrat | **project** | ⚠️ dispersé (`component.update` + `utils.set`), à unifier |
| 7 | Rendu | mutation → pixels | **render** (substrat) | ✅ DOM ; canvas futur |

- **1 `build`** — seule étape *hors ligne du temps* ; précède toute lecture. Pure, ids résolus,
  schedule aplati.
- **2 `emit`** — la source d'un `event runtime` (tick, seek, geste, ou `listen→transform→straps→emit`).
  C'est ici que temps et interaction entrent. Un event porte une **intention nommée**, pas encore un
  effet visuel.
- **3 `materialize`** — event/mutation → `TrackEntry` (la **mémoire** du système). `eventInsertMode`
  se décide ici. **Frontière capitale** : après cette étape, aucun strap ni effet ne se ré-exécute —
  tout le reste est reconstruction. `seek` rejoue les `TrackEntry`, jamais les straps.
- **4 `resolve` (director)** — à `t`, lit `perso.actions[eventName]` → `ResolvedAction` (style,
  contenu, move, transition) par perso. Traduction *event nommé → intention par perso*. Aujourd'hui
  `routeUpdates` fait ça ET déborde sur 5-6 (il applique aussi) ; la cible l'en dégage.
- **5 `solve`** — **le cœur de la cible, le nom qui manquait.** Résout **toutes** les interpolations à
  `t` (anime, tween, **FLIP compris**) → `PersoState @ t` en **unité native**, **sans substrat**. Seul
  endroit où le *temps continu* est résolu. Existe latent et **dupliqué** (`capturePersoStatesMirror`
  + `TweenRunner.getPersoStatesAtLastSeek`, fusionnés dans `getPersoStates()`) ; la cible le rend
  **premier et unique**.
- **6 `project`** — `PersoState @ t` natif → mutation substrat : résolution d'unité
  (`resolveContainerQueryValue`, déjà à nous), composition du transform depuis `{x,y,rotate,scale}`,
  application. **Vit dans le composant** (`component.update`→`applyStyleProps` DOM ; `projectToCanvas`
  demain). **Seul étage qui connaît le substrat, seul `set` de la cible.** Aujourd'hui dispersé (deux
  écrivains) ; la cible n'en laisse qu'un.
- **7 `render`** — l'étage substrat (paint DOM / dessin canvas). Codplay n'en pilote rien, il en
  dépend. Seul étage hors de son contrôle.

**La ligne de partage** :

```
   1 build · 2 emit · 3 materialize · 4 resolve  │  5 solve  ·  6 project  ·  7 render
   ─────────────────────────────────────────────  │  ───────────────────────  ────────
   LOGIQUE PUR — aucun substrat, testable sans DOM │  NATIF → SUBSTRAT          HORS
   (ce que move-separation-policy exige « avec      │  (project vit dans          codplay
    fixtures non DOM »)                             │   le composant)
                                          frontière solve/project (entre 5 et 6)
```

La **frontière solve/project** (5↔6) est *la* frontière **neutre au moteur** : `solve` produit du
natif (anime via mirror aujourd'hui, moteur custom demain — sans que 6 change) ; `project` consomme du
natif (sans savoir qui l'a produit). C'est elle à écrire comme contrat pour séquencer le retrait
d'anime sans big-bang — **déjà tracée** là où `resolveContainerQueryValue` prend le relais d'anime
(S3.3).

**Deux invariants traversent le flux** :
- **Sens unique (S1)** : le flux ne remonte jamais. On ne relit pas 7 (le node) pour reconstruire 5
  (l'état) ou 1 (la description). Toute capture éditeur lit **5** (`PersoState`), jamais 7.
- **`seek` n'entre qu'en 3→6** : il ne ré-exécute ni 2 (straps) ni les effets — il **rejoue les
  `TrackEntry`** (3) puis refait 4→5→6. C'est pourquoi `seek` et `play` produisent le même état : ils
  partagent 4-5-6.

---

## S8. La Projection — cible de rendu déclarée (concept manquant)

Deux problèmes, une seule cause : **le substrat de rendu n'est pas un concept déclaré** dans codplay
(le DOM est implicite, câblé en dur). Les nommer ensemble : **la Projection**.

### Problème A — `project` n'est pas toujours un `set` : certains solves ont besoin de *mesurer* le substrat

S7 décrivait `project` comme « écrire l'état natif sur le substrat ». Faux pour une famille de modules
qui **lisent le substrat pour *calculer* l'intention**, pas pour l'écrire :
- **FLIP** — mesure les rects avant/après mutation pour le delta (`getBoundingClientRect` × 2).
- **DnD** — mesure la géométrie live à chaque `pointermove` pour décider l'index de drop (hit-testing).
- **`replace` / auto-size texte** — mesure le texte rendu pour décider découpage / taille de police.

Ce **n'est pas** une violation du sens unique (S1) : ils ne relisent pas le node pour reconstruire une
*description* d'auteur. Ils font une **lecture de mesure** (jetable, re-dérivable — comme le
hit-testing timeline ou `referenceWidthPx`, déjà autorisés), pas une lecture de vérité. Le code le
dit déjà : le FLIP prend `nodeRef` via une interface `MeasurableNode = { getBoundingClientRect() }`
(`create-flip-engine.ts:26,61`) — **il ne dépend pas du DOM, il dépend d'une capacité de mesure.**
Correction à S7 : `solve` n'est pas « pur sans substrat » mais **« sans *écriture* substrat, avec accès
à une *mesure* substrat abstraite »**. La mesure est une **entrée** du solve, fournie par la Projection.

**La mesure est irréductible, pas juste une commodité** (nuance posée par l'auteur, 2026-07-26). On
pourrait croire que toute géométrie composée (ex. la chaîne d'ancêtres d'un FLIP) est *dérivable* du
`PersoState` des ancêtres, donc que `measure` serait éliminable. **Faux** : la position réelle d'un
node n'est pas toujours le produit propre des matrices logiques — overflow, repaint, resize, reflow
produisent des effets **non prédictibles depuis l'état**. La seule façon de connaître la position
*réelle* reste de la **mesurer**. `measure` n'est donc pas un pis-aller transitoire ; c'est le recours
d'exactitude au pixel que l'abstraction ne peut pas fournir. Cas limite qui le démontre — seek d'un
FLIP sous ancêtres mobiles : voir `2026-07-26-seek-flip-ancetres-mobiles.md`.

### Problème B — un « composant canvas » est le mauvais niveau

Aujourd'hui : le DOM est une projection **implicite et unique**, jamais déclarée. Vouloir un canvas en
faisant un *composant* canvas (frère de `TextComponent`) est le mauvais niveau : le canvas n'est pas un
composant, c'est une **cible dont TOUS les composants dépendent** — comme ils dépendent tous du DOM
aujourd'hui sans le dire. Un composant canvas obligerait à résoudre par des méthodes ad hoc ce que le
DOM fait par composants. Il manque une **déclaration** : « tout ce que je projette va sur cette cible ».

### Le concept — Projection (nom provisoire ; alt. `RenderTarget` / `Surface`)

> Une **Projection** est une **cible de rendu déclarée** qui fournit aux composants les **capacités de
> substrat** dont ils ont besoin. Le DOM devient *une* Projection parmi d'autres, non plus le substrat
> implicite.

Trois capacités (au moins) :
- **`set(el, state)`** — écrire un état résolu (l'étape 6 `project`).
- **`measure(el) → rect`** — mesurer une géométrie (résout le problème A ; ce que FLIP/DnD/auto-size
  demandent).
- **`mount / unmount`** — structurer (attacher/détacher un élément de la cible).

```
   5 solve ──► PersoState @ t ──► 6 project ──► 7 render
        │                             │
        │ measure(el)                 │ set(el,state)
        ▼                             ▼
   ┌──────────────────────────────────────────────┐
   │            PROJECTION (déclarée)              │
   │   set · measure · mount   — capacités abstraites │
   ├──────────────────────────────────────────────┤
   │  DomProjection │ CanvasProjection │ …          │
   └──────────────────────────────────────────────┘
         ▲            ▲            ▲
   plusieurs cibles SIMULTANÉES possibles (dom + canvas-A + canvas-B…)
```

Ce que ça résout d'un coup :
- **A disparaît** : `set` et `measure` sont deux capacités de la MÊME Projection. FLIP appelle
  `projection.measure(el)` sans savoir si c'est `getBoundingClientRect` DOM ou une bbox canvas.
  « Interaction forte avec le DOM » devient « interaction forte avec la Projection », abstraite.
- **B est résolu par construction** : un composant ne connaît que `this.projection`, jamais `document`
  ni `getBoundingClientRect`. Changer de substrat = changer de Projection, pas réécrire les composants.
- `resolveContainerQueryValue` (le cqw) devient `DomProjection.resolveUnit` — le cqw est une capacité
  *DOM* ; un canvas résoudrait ses unités autrement. (Ferme aussi le `containerQueryRootNode`
  module-level global signalé fragile en §5.5 : la résolution d'unité devient par-Projection.)

### Périmètre — la Projection appartient à codplay, pas à ed2

**Point cadré par l'auteur (2026-07-26).** La Projection est un concept **runtime codplay**, pas ed2.
Corollaires :
- **ed2 n'est PAS le lieu de sa déclaration.** La question « où la déclarer dans le document ed2
  (capsule ? `SceneMeta` ? table `projections` ?) » était **mal posée** — hors périmètre ed2. ed2 est
  un client parmi d'autres de codplay. Le **côté canvas appellera de tout autres éditeurs** (gérer la
  forme projetée en canvas n'est pas le métier de l'éditeur DOM actuel). Ne pas chercher l'ancrage
  Projection dans le modèle-document ed2.
- Point d'entrée existant côté codplay : `mountTarget` (`player.init()`) est **déjà** une déclaration
  de cible — unique, non nommée, impérative. La Projection la généralise en cible(s) nommée(s), mais
  reste de **nature exécution** (une cible concrète — un `Element`/`Canvas` réel — n'existe qu'au
  runtime, jamais dans le `CompiledScene` immuable ; au plus le document porterait un *rôle*
  symbolique résolu à l'init, patron `rootToken`/`@root`).

### Deux limites posées (ne PAS formaliser maintenant)

- **FLIP / move inter-projections** : la structure abstraite `Perso` l'**autorise** (propriété
  heureuse de l'abstraction, pas un problème à résoudre) — mais **cette complexité n'est pas
  formalisée à ce stade**. Capacité latente, pas un chantier. (Ne pas re-proposer « interdire le move
  cross-projection » comme décision : ni interdit ni formalisé, juste hors sujet pour l'instant.)
- **Nature de la Projection** (mode de rendu vs cadre spatial autonome, coordonnées, unités propres) :
  relève du **côté canvas et de ses éditeurs futurs**, pas du concept de Projection ici. Non tranché,
  volontairement.

### Lien avec l'existant — la Projection généralise le `move backend`

Ce n'est pas hors-sol : `docs/formalisation/v1-move-separation-policy-state-backend-dom.md` a déjà posé
la moitié du concept sous le nom **`move backend`** (« DOM aujourd'hui, canvas demain ; traduit un delta
logique en mutation de support et transitions visuelles »). **La Projection est la généralisation du
`move backend` à TOUTES les propriétés**, pas seulement `move` — exactement comme solve/project
généralise à tout la séparation que `move-separation-policy` faisait pour `move`. Le `move backend`,
c'est la Projection vue depuis `move`. L'architecture converge déjà vers ce concept sans l'avoir nommé
au niveau global.

---

## 0. Ce qui est déjà fait (pas un chantier, juste le point de départ)

- **Cause racine du bug cqw mixte** : `container-query-units.ts::parseContainerQueryValue`
  parsait chaque valeur via `CSSStyleValue.parse('width', rawValue)` — la propriété CSS
  `width` interdit les longueurs négatives, donc toute valeur cqw négative (`y` d'une
  translation vers le haut) faisait lever un `TypeError` silencieusement avalé, et
  repassait telle quelle, non convertie. Corrigé en parsant contre `margin-left`
  (accepte le même grammaire `cqw` sans restriction de signe). Confirmé en direct
  (Safari, `CSSStyleValue.parse('width','-8.62cqw')` lève, `'margin-left', ...` réussit).
- **Arrondi à 2 décimales max** de la conversion cqw→px (`container-query-units.ts`).
- **`stripIdentityTransforms`** (`dom.ts`) — supprime `translate(0,0)`/`rotate(0deg)`/
  `scale(1,1)` du `transform` composé après chaque `utils.set`, puisqu'anime
  (`buildTransformString`) les réémet inconditionnellement même à l'identité.
- 297/297 tests `codplay` verts après ces trois correctifs.

## 1. Diagnostic — la surface réelle d'anime.js aujourd'hui

7 fichiers importent `animejs`, mais tout se ramène à 3 rôles, tous concentrés
derrière une poignée de primitives :

| Rôle | Fonction anime | Sites d'appel |
|---|---|---|
| Écriture instantanée | `utils.set` | `dom.ts:188`, `dom-component-adapter.ts:480`, `list-flip/create-list-flip-module.ts:138`, `animation/adapter.ts:178` |
| Lecture de pose | `utils.get` | `dom.ts:249` (`readNodePose`), `list-flip/engine/create-flip-engine.ts:152-153` |
| Animation réelle | `animate`+`engine` | `animation/create-default-adapter.ts`, `broadcast/broadcast-player.ts` (câblage dupliqué, cf. §2), tous deux alimentant `animation/adapter.ts::createAnimationAdapter` |

Fait déterminant : **anime ne tourne pas sa propre boucle RAF**
(`engine.useDefaultMainLoop = false`, les deux sites de câblage). C'est le tick du
player codplay qui pousse `engine.update()` (`create-player.ts:533`,
`tick({nowMs}) { animationAdapter.renderFrame?.(nowMs) }`). Le scheduling est déjà
100% côté codplay.

Autre fait déterminant : anime **ne résout pas les cq\*** — codplay le fait entièrement
lui-même (`container-query-units.ts`) avant qu'anime ne voie quoi que ce soit. La
prémisse initiale ("anime résout les questions d'unités") ne tient déjà plus sur ce
circuit précis.

Précédent existant à ne pas re-découvrir : codplay a déjà un moteur d'interpolation
indépendant d'anime, `TweenRunner` (`packages/codplay-v1/src/tween/tween-runner.ts`),
utilisé pour l'action `tween()`, avec sa propre table d'easing.

## 2. Doublons et anomalies relevés (à corriger, chantier séparé et à bas risque)

- **`applyStyleProps` (`dom.ts:119`) vs `applyStylePatch` (`dom-component-adapter.ts:437`)**
  — logique quasi identique (résolution cq* + `utils.set`), `dom.ts` porte un
  commentaire "hot-path oriented loops" signe d'une réécriture jamais reportée sur
  l'autre copie. `applyStylePatch` ne sert plus qu'aux 2 icônes d'`input-component.ts`.
- **Câblage `animate`+`engine` dupliqué** : `create-default-adapter.ts` vs
  `broadcast-player.ts:83-95` — même montage recopié à la main au lieu d'appeler
  `createDefaultAnimationAdapter()`. Divergence fonctionnelle en prime :
  `broadcast-player.ts` n'a **aucun** `setRate` — à vérifier si voulu (vitesse fixe en
  mode broadcast) ou trou réel.
- **`resolveContainerQueryValue` appelé en dur à 3 endroits indépendants**
  (`dom.ts`, `dom-component-adapter.ts`, `animation/adapter.ts`) — pas un doublon de
  logique, mais une dispersion que le futur module (§4) doit absorber en interne.
- **`composition: 'merge'`** (`list-flip/create-list-flip-module.ts`) — `'merge'`
  n'existe pas dans le vocabulaire anime (`consts.js:48-52` : seuls
  `'none' | 'replace' | 'blend'`). En lisant `animation.js:214` et le comparateur de
  `render.js`, tout token qui n'est ni exactement `'none'` ni `'blend'` retombe par
  accident sur le comportement `'replace'` — donc `'merge'` "marche" aujourd'hui,
  mais par coïncidence d'implémentation, pas parce que c'est un alias reconnu.
  À corriger en `'replace'` explicite, ou à vérifier avec l'intention d'origine.

## 3. Ce qui manque réellement pour se passer d'anime (le noyau dur)

Tout le reste (orchestration, groupage de transitions, tracking de handles,
finalisation, snap à la valeur finale en fin/au-delà d'une transition via
`applyTransitionEndValue`) est **déjà** du code codplay pur, indépendant d'anime.

Un seul point structurant reste délégué : `seek()` (`adapter.ts:640-675`) appelle
`activeAnimation.animation.seek(ms)` — **anime lui-même** calcule la valeur interpolée
à un instant intermédiaire d'une transition (0% < progression < 100%), aussi bien en
lecture live (`renderFrame`→`engine.update()`) qu'en reconstruction par seek. Pour
s'en passer, il faut reproduire fidèlement, à l'identique visuel ("iso" — continuité
de fonctionnement) :

1. La bibliothèque d'easing — `normalizeAnimeEase` ne fait que traduire
   `easeInOutQuad` → `inOutQuad` (courbes Penner standard, pas de custom). Risque
   faible, mais liste exhaustive à établir avant portage.
2. La composition/remplacement de tweens concurrents (`transition.composition`,
   réellement utilisé — cf. §2, même si `'merge'` est un faux-ami de `'replace'`).
3. La composition du `transform` + cache de pose par nœud — déjà partiellement repris
   ce jour (§0), mais à posséder nativement plutôt qu'à corriger après coup.

## 4. Principe directeur — environnement contrôlé

Anime doit rester défensif (cache opaque, re-parsing permanent du `style` inline,
tolérance à n'importe quel format hérité) parce qu'il doit fonctionner sur un DOM que
n'importe quel autre code a pu toucher avant lui. Codplay n'a pas cette contrainte :
aucun autre acteur n'écrit ces propriétés en dehors de son propre pipeline (et du
geste live, à unifier — cf. §5). Ça justifie un contrat **strict** — une seule
représentation canonique, toujours écrite en entier par nous, jamais reconstituée par
parsing défensif — là où anime doit rester permissif par nécessité générique. Le bug
`CSSStyleValue.parse('width', ...)` de ce jour est une conséquence directe de ce
défaut de contrainte générique appliqué à un cas qu'on maîtrise entièrement.

## 5. Modèle de représentation transform retenu

Deux étages distincts, pas un choix binaire :

- **Stockage/écriture canonique par nœud** : propriétés CSS discrètes
  (`translate`/`rotate`/`scale`), pas le shorthand `transform` composé. Simple,
  transparent, déjà ce qu'écrit `LibreAdapter` (geste live,
  `packages/authoring/selection-frame/src/adapters/libre-adapter.ts`) — pas de
  parseur de chaîne fonctionnelle à maintenir (`buildTransformString`/
  `parseInlineTransforms`-équivalent).
- **Calcul de composition inter-nœuds** (ancêtres, FLIP, overlay-world, et toute
  future lecture d'un `transform`/`matrix()` externe) : la matrice reste l'outil
  naturel — déjà présent et correct dans `list-flip/engine/matrix-2d.ts` +
  `dom-matrix.ts` (`multiplyMatrix`, `invertMatrix`, `captureCombinedMatrixForNode`,
  `worldDeltaToLocalDelta`/`worldSizeToLocalSize`), **zéro dépendance anime**,
  actuellement enfermé dans la portée privée de list-flip.

Risque nommé à fermer par ce choix : aujourd'hui, deux représentations coexistent
pour le même concept de "pose" (discrète côté geste live, composée côté rendu anime),
réconciliées seulement par séquencement temporel strict (jamais actives ensemble sur
le même nœud), pas par une source de vérité unique. La CSS spec fait *cumuler*
`transform` et les propriétés discrètes si les deux sont posées simultanément — un
futur changement qui romprait ce séquencement produirait une translation doublée,
silencieusement. Unifier sur une seule représentation partout élimine cette classe de
bug par construction plutôt que par calendrier.

## 6. Deux enrichissements identifiés (non utilisés aujourd'hui, contrat à prévoir)

- **Composition additive/blend** (`compositionTypes.blend` côté anime) — pas ce que
  list-flip utilise aujourd'hui (son `'merge'` est un faux 'replace', §2). Un vrai
  blend sommerait plusieurs tweens concurrents sur la même propriété au lieu que le
  dernier remplace le précédent.
- **Ease géométrique** (courbe spatiale, pas seulement temporelle) — aujourd'hui
  seulement bricolé via le hook `modifier` ad-hoc de list-flip (trajectoire de Bézier
  quadratique, `create-list-flip-module.ts:481`). Deux axes orthogonaux à distinguer
  au premier ordre dans le futur module : `temporalEase` (quand la progression
  accélère/ralentit, 0→1 dans le temps) et `spatialCurve` (où passe la valeur dans
  l'espace, trajectoire courbe plutôt que lerp linéaire A→B) — composables
  indépendamment plutôt qu'un hook générique unique.

## 7. Chantiers

Dans l'ordre de dépendance (pas nécessairement l'ordre d'exécution — le chantier 1
est indépendant et peut se faire à tout moment) :

1. **Debug/résolution des doublons, consolidation de codplay** (§2) — indépendant,
   bas risque, aucune dépendance avec le reste.
2. **Normer, définir des conventions** pour unités et transforms (§4, §5) — décision
   de conception à trancher *avant* d'écrire le module (chantier 3), pas après :
   le contrat du module (représentation canonique discrète, résolution stricte des
   unités, environnement contrôlé) découle de ces conventions.
3. **Créer un module sur le modèle d'anime** (même forme de déclaration/injection que
   `AnimationAdapter`/`AnimeImplementation` déjà existant et prouvé —
   `new Player({ animationAdapter })`), lui faire porter get/set + la résolution
   d'unités déjà écrite, quitte à utiliser encore anime en interne au départ. Tous
   les imports directs de `animejs` (`dom.ts`, `dom-component-adapter.ts`, les 2
   fichiers list-flip, `animation/adapter.ts`) migrent vers ce point d'injection
   unique — la substitution devient ensuite additive (un second module respectant la
   même forme), plus jamais dispersée. C'est le chantier charnière : 4, 6 et 8 en
   dépendent.
4. **Ramener les fonctions "spéciales" dans son périmètre** — `modifier`
   (généralisé en `temporalEase`/`spatialCurve`, §6), la composition additive (§6),
   et l'agglomération de `matrix-2d.ts` (actuellement privé à list-flip, §5) vers une
   bibliothèque bas-niveau partagée que le module peut consommer.
5. **Faciliter les mises en référence** — capter le node conteneur pour le calcul
   cq* comme responsabilité interne et robuste du module (plutôt que l'état module-
   level fragile actuel, `containerQueryRootNode`/`setContainerQueryRootNode`, dont
   la fenêtre de correction reset/réarmement *à l'intérieur* de chaque
   `Player.init()` reste une fragilité de timing réelle même après le fix de cause
   racine de ce jour — non exploitée par le bug résolu, mais identifiée en cours de
   route).
6. **Intégrer les fonctions d'anime en vue de son retrait** — implémenter nativement
   l'interpolation eased à un instant T (lerp + table d'easing, portage fidèle des
   courbes Penner), la composition/remplacement de tweens concurrents, derrière la
   même interface. Une fois tous les appelants passés par le module (chantier 3) et
   la parité fonctionnelle atteinte, la dépendance `animejs` peut être retirée —
   objectif mesurable de la **réduction du rôle d'anime**, pas un chantier séparé en
   soi mais l'aboutissement des chantiers 3-6.

## 8. Ouverture vers l'éditeur — le futur module doit aussi servir `packages/editor`

Le module du chantier 3 ne doit pas rester un détail d'implémentation interne à
codplay : `packages/editor`/ed2 a le même besoin de get/set (animations d'UI propres
à l'éditeur, et surtout les interactions entre les interfaces d'édition et le player)
et calcule aujourd'hui sa propre référence de conteneur indépendamment de
`containerQueryRootNode` (`scene-player-bridge.ts`, `mountTarget.getBoundingClientRect
().width` — deux mesures séparées du même conteneur, jamais garanties identiques).
Objectif : harmoniser, ne pas dupliquer les fonctions communes entre runtime et
éditeur.

Le mécanisme d'extension existe déjà et n'a pas besoin d'être inventé : `AuthorApi`
(`docs/formalisation/v1-author-api-spec.md`) est précisément le contrat par lequel
un module authoring accède au player sans toucher `PlayerApi` directement — sa
clause de clôture le dit explicitement : *« Si un besoin n'est pas couvert par
`AuthorApi`, l'interface doit être enrichie ici plutôt que contournée. »*
`getNodePose`/`subscribeToNode` sont déjà passés par ce chemin une fois. Get/set
génériques + référence de conteneur suivraient le même chemin, backés par le module
du chantier 3 une fois écrit.

**Nuance à trancher avant d'enrichir, pas à esquiver** : la spec exclut aujourd'hui
explicitement *« Manipulation directe des composants runtime codplay »* de son
périmètre. Un `set()` générique franchit la frontière lecture→écriture que
`getNodePose`/`subscribeToNode` n'ont jamais franchie — à scoper précisément
(probablement : seulement la pose/le style, jamais un composant runtime entier) et
ajouter formellement à la spec avant tout code, comme elle l'exige elle-même.

### Preuve concrète du besoin — exception temporaire déjà en production (2026-07-16)

En corrigeant `packages/editor/src/app/bridges/offset-editor-bridge.ts` pour qu'il
cesse de re-décoder `style.translate`/`.rotate`/`.scale` à la main (violation directe
de la clause "anime.js comme unique source de vérité de la pose" de
`v1-author-api-spec.md`) au profit de `authorApi.getNodePose(itemId)`, un vrai trou a
été découvert et confirmé en direct : pendant un geste CS actif, c'est `LibreAdapter`
qui écrit la pose (propriétés CSS discrètes brutes), entièrement hors du `utils.set`
d'anime — `getNodePose` reste alors figé à la dernière valeur commitée (confirmé :
`{x:0,y:0}` tout au long d'un drag alors que `style.translate` suivait correctement
`"60px -45px"`).

Correctif appliqué en attendant le chantier 3/6 : `offset-editor-bridge.ts` branche
sur `session.isGestureActive()` — geste actif → lecture DOM brute
(`readLiveGestureNodePose`, exception documentée en commentaire à la fonction) ;
sinon → `authorApi.getNodePose` (conforme). **Ce sera supprimable dès que
`LibreAdapter` écrira lui-même via le module partagé du chantier 3** — à ce moment
`readLiveGestureNodePose` et la branche `isGestureActive()` de `readActivePose`
disparaissent, `getNodePose` devient correct sans exception, geste live compris. Ce
cas est donc la preuve concrète, déjà en production, que le chantier 3 doit inclure
`LibreAdapter` comme écrivain (pas seulement le runtime codplay) pour être complet.

## État

Chantier 0 livré. Chantiers 1-6 : réflexion actée, aucun code écrit. §8 : correctif
partiel livré côté éditeur (`offset-editor-bridge.ts` conforme à `AuthorApi` hors
geste actif, exception documentée pour le cas geste actif) — pas un chantier terminé,
un jalon qui motive et borne le chantier 3/6. Prochaine étape à trancher avec
l'auteur : par lequel chantier commencer (le chantier 1, indépendant et bas risque,
est un candidat naturel pour ouvrir le travail sans attendre la décision sur le
reste).

---

## Appendice (2026-07-16) — détail technique brut

Référence exhaustive, non synthétisée, pour reprise sans re-fouiller le code. Les
sections ci-dessus (§1-§8) sont la lecture digérée ; ceci est le matériau brut
derrière.

### A. Tous les sites d'import `animejs` (exhaustif, 7 fichiers)

```
dom.ts:1                          import { utils } from 'animejs'
dom-component-adapter.ts:1        import { utils } from 'animejs'
list-flip/create-list-flip-module.ts:1        import { utils } from 'animejs'
list-flip/engine/create-flip-engine.ts:1      import { utils } from 'animejs'
broadcast/broadcast-player.ts:1   import { animate, engine } from 'animejs'
animation/adapter.ts:1-2          import { utils } from 'animejs'
                                   import { morphTo as animeSvgMorphTo } from 'animejs/svg'
animation/create-default-adapter.ts:1   import { animate, engine } from 'animejs'
```

### B. Sites d'appel, par fonction anime

**`utils.set`** (écriture instantanée) :
- `dom.ts:188` — `applyStyleProps`, chemin principal du runtime
- `dom-component-adapter.ts:480` — `applyStylePatch`, doublon (§C.1)
- `list-flip/create-list-flip-module.ts:138` — reset x/y à 0 avant capture FLIP "last"
- `list-flip/engine/create-flip-engine.ts:314` — payload de transform générique
- `animation/adapter.ts:178` — `applyTransitionEndValue`, snap fin de transition/seek

**`utils.get`** (lecture de pose) :
- `dom.ts:249` — `readNodePose`, exposé via `PlayerApi.getNodePose`/`AuthorApi.getNodePose`
- `list-flip/engine/create-flip-engine.ts:152-153` — lecture x/y pour snapshot FLIP "First"

**`animate`+`engine`** (animation réelle) :
- `animation/create-default-adapter.ts:6,10,18,21` — `engine.useDefaultMainLoop=false`,
  `animate(targets,params)`, `renderFrame:()=>engine.update()`, `setRate:(r)=>engine.speed=r`
- `broadcast/broadcast-player.ts:84,89,94` — même montage dupliqué, **sans** `setRate`
  (§C.2)
- Consommateurs de `renderFrame`/`setRate` : `create-renderer.ts:385,389`,
  `create-player.ts:533,536-537` (`tick({nowMs}) { animationAdapter.renderFrame?.(nowMs) }`)

**`animejs/svg` (`morphTo`)** — hors périmètre (SVG, écarté explicitement) :
- `animation/adapter.ts:547` — seul site, `animeSvgMorphTo(operation.to, operation.precision)`

**`modifier`** (hook progress→valeur, pas anime lui-même mais son vecteur) :
- `animation/types.ts:61` — `modifier?: (value: number) => number | string`
- Seuls appelants : `list-flip/create-list-flip-module.ts:451,481` (trajectoire de
  Bézier quadratique, `pushTransition('translate', 0, 1, { modifier: (progress) => ... })`)

### C. Doublons et anomalies — détail

**C.1 — `applyStyleProps` vs `applyStylePatch`**
- `dom.ts:119-164` (`applyStyleProps`) — commentaire "hot-path oriented loops",
  `for...in` sur `styleProps`.
- `dom-component-adapter.ts:437-483` (`applyStylePatch`) — même logique,
  `Object.entries(patch)`. Seuls appelants : `input-component.ts:502,536` (icônes
  sélection/correction).
- Même séquence dans les deux : `skipTransitionValues`/`isTransitionStyleValue` →
  `resolveFinalValue` → `resolveContainerQueryValue` → `utils.set`.

**C.2 — câblage `animate`+`engine` dupliqué, `setRate` perdu**
- `create-default-adapter.ts` exporte `createDefaultAnimationAdapter()` — jamais
  appelé par `broadcast-player.ts`, qui recopie le même montage à la main
  (lignes 83-95) SANS le `setRate:(rate)=>{engine.speed=rate}` présent dans l'original
  (`create-default-adapter.ts:20-22`). `grep -n "setRate\|rate" broadcast-player.ts` →
  aucun résultat. Statut : à vérifier avec l'auteur (vitesse fixe voulue en broadcast,
  ou trou réel).

**C.3 — `resolveContainerQueryValue` appelé en dur à 3 endroits**
- `dom.ts:157` (via `applyStyleProps`)
- `dom-component-adapter.ts:476` (via `applyStylePatch`)
- `animation/adapter.ts:17,177` (`resolveTransitionValue`, `applyTransitionEndValue`)

**C.4 — `composition: 'merge'` n'est pas un token anime valide**
- `list-flip/create-list-flip-module.ts:313` — `composition: 'merge'`
- Vocabulaire réel anime (`node_modules/animejs/dist/modules/core/consts.js:48-52`) :
  `{ replace: 0, none: 1, blend: 2 }`. Type déclaré
  (`node_modules/animejs/dist/modules/types/index.d.ts:220`) :
  `TweenComposition = (string & {}) | "none" | "replace" | "blend" | compositionTypes`
  — accepte n'importe quelle string, aucune validation.
- Mécanisme du faux-positif (`node_modules/animejs/dist/modules/animation/animation.js:214`) :
  `tComposition = isUnd(composition) && targetsLength>=K ? compositionTypes.none :
  !isUnd(composition) ? composition : animDefaults.composition` — stocke la string
  brute telle quelle (`'merge'`, jamais convertie en enum). Dans
  `core/render.js:158,242` : comparaisons `!== compositionTypes.none` (`1`) et
  `!== compositionTypes.blend` (`2`) — `'merge' !== 1` et `'merge' !== 2` sont
  toujours vrais en JS (comparaison string/number), donc `'merge'` tombe par
  accident dans la même branche que `'replace'`. Fonctionne aujourd'hui par
  coïncidence d'implémentation, pas par contrat.

### D. Faits internes anime.js relevés (lecture directe de `node_modules/animejs`)

- **`buildTransformString`** (`dist/modules/core/transforms.js:112-160`) — compose
  `validTransforms` dans l'ordre (perspective>translate>rotate>scale>skew>matrix),
  émet CHAQUE propriété présente dans le cache sans jamais vérifier si elle est à sa
  valeur par défaut. Aucune option pour changer ce comportement.
- **`parseInlineTransforms`** (`transforms.js:23-100`) — lit `target.style.transform`
  (jamais les propriétés discrètes `translate`/`rotate`/`scale`) pour amorcer le
  cache `target[transformsSymbol]` au premier accès à une propriété non encore
  cachée ; sinon retombe sur des valeurs par défaut codées en dur (ligne 96-99).
- **Cache par nœud** : `target[transformsSymbol]` (`Symbol`, `consts.js`) — persiste
  entre appels `utils.set` séparés sur le même nœud ; c'est ce qui permet à un patch
  partiel (`{y: ...}`) de ne pas effacer `x`/`rotate`/`scale` précédemment posés par
  un autre appel — mécanisme nécessaire (cf. §5, diffs de keyframes) mais opaque de
  l'extérieur (justifie `getNodePose` plutôt qu'une lecture DOM, `v1-author-api-spec.md`).
- **`compositionTypes`** (`consts.js:48-52`) — `{ replace:0, none:1, blend:2 }`,
  défaut `replace` (`globals.js:52`).
- **`engine.useDefaultMainLoop`** — flag qui désactive la boucle RAF interne d'anime ;
  posé `false` aux deux sites de câblage (§B). Sans lui, anime tournerait sa propre
  boucle en parallèle de celle de codplay.
- **Cause racine du bug §0** : `CSSStyleValue.parse('width', rawValue)`
  (`container-query-units.ts`, avant fix) — la grammaire CSS de la propriété `width`
  interdit les `<length>` négatifs ; testé en direct dans la page (polyfill
  `typed-om-polyfill`, module déjà chargé) :
  `CSSStyleValue.parse('width','-8.62cqw')` → `TypeError: Invalid value for property
  width: -8.62cqw` ; `CSSStyleValue.parse('margin-left','-8.62cqw')` → réussit,
  `{value:-8.62, unit:'cqw'}`. Fix : parser contre `margin-left`.

### E. Architecture de l'adapter codplay existant (`animation/adapter.ts`, déjà 100% codplay)

- `createAnimationAdapter(animeImplementation, options)` — reçoit l'implémentation
  anime en paramètre (déjà injectable, déjà le patron que §7.3 propose de généraliser).
- `run(operations)` (l.459-591) — filtre `TransitionRequest`/`AnimeSvgMorphOperation`,
  groupe via `groupTransitions` (l.270-333, un seul `animate()` par nœud+timing
  partagés, perf), track `activeAnimations`/`activeHandles`, retourne des handles
  stoppables.
- `groupTransitions` (l.270-333) — construit les `parameters` anime
  (`targets,duration,ease,delay,stagger,loopDelay,reversed,alternate,loop,composition`)
  + un champ par propriété via `toTransitionValue` (l.222-243, `{from?,to,modifier?}`).
- `applyTransitionEndValue`/`finalizeTransition`/`cleanupTransitionStyle`
  (l.138-210) — snap direct à la valeur finale (`utils.set`, jamais l'animation),
  déclenché à la complétion naturelle ET à un seek qui dépasse la fin — **anime n'est
  déjà pas sollicité pour ce cas**.
- `seek(timelineMs, eventMsByEventId, target?)` (l.640-675) — **seul point qui
  délègue encore à anime pour une valeur intermédiaire** :
  `activeAnimation.animation.seek(seekElapsedMs)` recalcule et écrit la valeur eased
  au point demandé, en interne à anime. Idem `renderFrame`/`engine.update()` pour la
  lecture live. C'est le morceau dur identifié en §3.
- `pause`/`resume`/`stop` (l.596-635) — délégation fine à `.pause()`/`.resume()`/
  `.play()`/`.revert()` sur l'instance anime — trivial à réimplémenter si on possède
  l'interpolation.
- `normalizeAnimeEase` (l.108-133) — traduit `easeInOutQuad`→`inOutQuad` etc.
  (courbes Penner standard, pas de custom).

### F. Bibliothèque matrice list-flip (déjà indépendante d'anime, déjà agglomérable)

`list-flip/engine/matrix-2d.ts` — pure algèbre affine 2D, zéro dépendance anime, zéro
dépendance DOM : `createIdentityMatrix`, `multiplyMatrix`, `invertMatrix`,
`createTranslateMatrix`, `createScaleMatrix`, `toCssMatrix`, `parseCssMatrix`.

`list-flip/engine/dom-matrix.ts` — la seule à toucher le DOM :
`readElementTransformValue` (lit `getComputedStyle(node).transform`, fallback
`style.transform` inline), `captureCombinedMatrixForNode` (remonte `parentNode`,
multiplie les matrices d'ancêtres), `worldDeltaToLocalDelta`/`worldSizeToLocalSize`
(inversion de la matrice combinée pour convertir écran↔local), `extractRotationMatrix`
(normalise l'échelle pour isoler la rotation, utilisé pour orienter un overlay FLIP).

Aujourd'hui privé à `list-flip/engine/` — candidat direct pour extraction vers un
module bas niveau partagé (§7.4).

### G. Précédent déjà existant — `TweenRunner`

`packages/codplay-v1/src/tween/tween-runner.ts` — moteur d'interpolation propre à
codplay, table d'easing propre, utilisé par l'action `tween()`. Confirme qu'un moteur
d'interpolation indépendant d'anime est déjà un précédent qui marche en production,
pas une hypothèse.

### H. `AuthorApi`/`PlayerApi` — état actuel exact

- `docs/formalisation/v1-author-api-spec.md` — spec normative v1, périmètre inclus :
  `subscribeToNode`, `getNodePose`, `subscribeToPlayerState`, `getPlayerState`.
  Périmètre exclu explicite : *« Manipulation directe des composants runtime
  codplay »*. Clause d'extension (l.170-172) : *« Si un besoin n'est pas couvert par
  `AuthorApi`, l'interface doit être enrichie ici plutôt que contournée. »*
- `packages/codplay-v1/src/player/player.ts:76,468-470` — `PlayerApi.getNodePose`
  délègue à `readNodePose(getRuntimeRegistry().getNodeById(persoId))` (`dom.ts`,
  `utils.get`).
- `packages/authoring/selection-frame/src/author-api.ts` — `createAuthorApi(player)`,
  wrap fin de `PlayerApi`, direction de dépendance `authoring → codplay` uniquement
  (codplay ignore l'existence d'`AuthorApi`).
- Notes non normatives déjà présentes dans la spec (besoins identifiés, jamais engagés) :
  `getCompiledScene()`, `subscribeToPlayerEvent(eventName,cb)`, `getPersoIds()`.

## I. `create-player.ts` — taille excessive, sujet d'optimisation séparé (2026-07-25)

Remarque de l'auteur en marge du chantier `getPersoStates`
(`2026-07-25-perso-state-at-t-plan.md`) : `create-player.ts` dépasse 2500 lignes,
mérite d'être découpé. Pas traité ici — noté comme sujet distinct, à rapprocher des
chantiers de retrait/réduction d'anime.js ci-dessus (une fois anime moins central,
plusieurs des responsabilités actuellement mélangées dans ce fichier — seek, replay,
gestion du renderer/tween runner — deviennent probablement plus faciles à séparer en
modules propres).
