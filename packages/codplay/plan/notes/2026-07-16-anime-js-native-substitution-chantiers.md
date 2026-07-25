# Réflexion — réduire la surface d'anime.js, vers un module de style natif

Note de consignation, écrite après la résolution du bug cqw mixte (voir
`packages/editor/plan/notes/2026-07-14-offset-cqw-double-conversion-investigation.md`
pour cet historique-là). Cette note est distincte : elle documente la réflexion
architecturale plus large que cette investigation a déclenchée, côté
`packages/codplay` exclusivement. Aucun code n'a été écrit pour les chantiers
ci-dessous — seul le correctif de la cause racine (§0) est livré.

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
indépendant d'anime, `TweenRunner` (`packages/codplay/src/tween/tween-runner.ts`),
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

`packages/codplay/src/tween/tween-runner.ts` — moteur d'interpolation propre à
codplay, table d'easing propre, utilisé par l'action `tween()`. Confirme qu'un moteur
d'interpolation indépendant d'anime est déjà un précédent qui marche en production,
pas une hypothèse.

### H. `AuthorApi`/`PlayerApi` — état actuel exact

- `docs/formalisation/v1-author-api-spec.md` — spec normative v1, périmètre inclus :
  `subscribeToNode`, `getNodePose`, `subscribeToPlayerState`, `getPlayerState`.
  Périmètre exclu explicite : *« Manipulation directe des composants runtime
  codplay »*. Clause d'extension (l.170-172) : *« Si un besoin n'est pas couvert par
  `AuthorApi`, l'interface doit être enrichie ici plutôt que contournée. »*
- `packages/codplay/src/player/player.ts:76,468-470` — `PlayerApi.getNodePose`
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
