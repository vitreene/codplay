# Plan de conception : une node par src pour les images (au lieu de muter le src)

## Statut

**IMPLÉMENTÉ le 2026-06-25.** Remplace l'approche « commit différé du src » (annulée, jugée masquante par l'auteur). Fait suite au constat : la mutation du `src` sur une node unique fait *sortir l'image du cycle reset→replay* du seek (le `src` a un effet de bord — le décodage — donc il ne peut pas se réinitialiser comme un style).

Décision de l'auteur : **detach/attach** des nodes (pas `visibility:hidden`). Conséquence clé : `el` ne contient **qu'une seule `<img>` à la fois** (l'active), donc les transitions (`apply-simple` qui clone `el`, `apply-split-cells` qui lit `querySelector('img')`) fonctionnent **sans aucune modification** — leur `querySelector('img')` retourne naturellement la node active.

Réalisé : `ImageComponent` réécrit (`mediaBySrc: Map<src, node>`, `activeSrc`, `setActiveSrc` qui détache l'active courante et attache la cible, `render()` qui reset l'active à l'initial, `update()` qui bascule l'active sur `action.src`). Le `src` n'est assigné qu'une fois par node (à la création) → décodage une seule fois, jamais relancé ; detach/attach d'une node décodée préserve son décodage. Src hors ensemble statique → warning auteur (`AUTHOR_IMAGE_SRC_NOT_PRELOADED`), cas dynamique repoussé post-v1. Aucune modif de `apply-simple.ts` / `apply-split-cells.ts` / `replace/index.ts`.

Tests : `tests/v1/seek-image-src.spec.ts` (4 cas : reconstruction seek→initial ; 0 réassignation src région initiale ; 0 réassignation région post-mutation ; une seule img attachée + identité de node préservée au détach/réattach). Suite complète : 0 régression (13 échecs préexistants identiques), gates lot7/8/18 = 21/21. **Validé visuellement par l'auteur le 2026-06-25** (transitions simple + split-cells au seek, reconstruction de l'image initiale, pas de flick).

## Diagnostic (validé)

- Le `src` n'est pas un état rejouable : il est posé par l'exécution de l'action `replace` (`ImageComponent.update`). Au seek, le player rejoue les évènements dus → les états adossés à un `replace` se reconstruisent ; **l'état initial, seul état sans évènement, ne se reconstruit pas** (le `src` reste celui de la dernière mutation).
- Réinitialiser le `src` au render pour le rendre rejouable provoque un double-write (initial puis replace) → relance de décodage → flick. Confirmé et annulé deux fois.
- Cause racine : on traite une ressource **mutable à effet de bord** (le `src`, qui déclenche un décodage) comme un état reconstructible. Asymétrie irréductible avec le modèle de seek.

## Principe de la solution

Ne plus jamais muter le `src` d'une node. Pré-créer **une `<img>` par src distinct** du perso (ensemble déjà collecté par `extract-resource-manifest.ts`), empilées dans la racine du composant image, une seule visible à la fois. L'état devient « quelle node est visible » — une visibilité, donc un état réinitialisable et rejouable à coût nul.

Bénéfices : aucune réassignation de `src` → aucun churn de décodage ; chaque image décodée une fois ; état initial reconstruit comme tout autre (node initiale visible par défaut) ; `play@t == seek@t`.

## Conception

### Construction
- `ImageComponent` lit l'ensemble des src du perso : `initial.src` + tous les `actions[*].src` (même logique que `collectPersoSrcs`). Crée une `<img>` par src distinct, toutes en position absolue empilée, `data-part` indexé par src (ou par index stable).
- La node correspondant à `initial.src` est visible par défaut ; les autres masquées (`visibility:hidden` ou `display:none` — à choisir selon l'impact layout / décodage ; `visibility:hidden` garde la node mesurable, utile pour split-cells).
- Les styles `img` autorés (`perso.initial.img.style`, objectFit, etc.) s'appliquent à toutes les nodes de la collection.

### Mutation (`replace` / changement de src)
- `update()` avec une action portant `src` = **basculer la visibilité** vers la node de ce src (et déclencher la transition). Plus de `setImageSource`.
- La transition (`split-cells`, `simple`, `split-text`) reste : `split-cells` utilise déjà `backgroundImage(url)` (indépendant de la node) ; `simple` clone — à adapter pour cibler les nodes A/B de la collection.

### Reconstruction au seek (render/refresh)
- Baseline réinitialisable : remettre la node `initial.src` visible, les autres masquées. Coût nul, pas de décodage.
- Le replay des `replace` rebascule la visibilité jusqu'à la cible. seek→t=0 = aucune bascule = node initiale visible. Exact.

### Cas du src dynamique (hors `perso.actions`) — TRANCHÉ : collection paresseuse indexée par src

Vérifié dans le code : `mergeActionWithEventPayload` (`core/events/dispatch.ts:47`) fusionne le payload de l'évènement sur l'action (`{ ...action, ...payload }`). Un `src` **peut donc être dynamique** (porté par un payload). La collection ne peut pas être purement statique.

Solution retenue : **collection paresseuse indexée par `src`**. `ensureNodeForSrc(src)` crée la node si absente (décodage une seule fois) et la met en cache (`Map<src, imgNode>`). `update()` appelle `ensureNodeForSrc(src)` puis bascule la visibilité. Au seek, les mêmes `update` rejoués garantissent les mêmes nodes et bascules ; la node de `initial.src` est créée au mount et sert de baseline. Gère statique ET dynamique, sans aucune réassignation de `src`. Le manifest statique (`extractResourceManifest`) reste utile pour le preload (créer les nodes statiques d'emblée), mais la correction ne dépend pas de sa complétude.

## Points à valider avant implémentation

1. Le `src` peut-il provenir d'ailleurs que de `perso.initial.src` / `perso.actions[*].src` (strap dynamique) ? Si non, la collection statique est complète et suffisante.
2. Masquage par `visibility:hidden` (mesurable, utile split-cells) vs `display:none` (sort du layout). Impact sur les lectures de dimensions et le décodage des images masquées (certaines navigateurs décodent paresseusement `display:none`).
3. Adapter `apply-simple.ts` (clone) au modèle node-collection ; vérifier `apply-split-text` (texte, non concerné par src) et `apply-split-cells` (déjà url-based).
4. Impact mémoire : N images décodées d'emblée. Aligné avec le preload existant ; à confirmer acceptable pour les volumes visés.

## Tests
- `tests/v1/seek-image-src.spec.ts` (acceptance, `it.skip`) : seek arrière restaure l'image initiale → doit passer.
- Nouveau : aucune réassignation de `src` sur aucune node au cours d'un scrub (décodage préservé) — compteur d'écritures `src` à 0 après le mount initial.
- Nouveau : la node active au temps t correspond au dernier `replace` ≤ t (sinon initiale), en lecture comme au seek.
- Suite complète + gates lot7/8/18.

## Périmètre / risque
- Touche le modèle du composant image et l'intégration replace. `ImageComponent`, `apply-simple.ts`, possiblement `replace/index.ts`. Chemin partagé par seek/rewind/rebuild → suite complète obligatoire.
- N'affecte pas les autres types de perso.
