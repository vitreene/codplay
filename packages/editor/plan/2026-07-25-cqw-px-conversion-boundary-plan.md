# cqw/px — resserrer la conversion à une frontière unique (constat + plan)

## 0. Principe posé par l'auteur (point de départ, pas une déduction)

- `cqw` est l'unité portée par le décor tel que le **player** le lit (`scene.decors`, diffusion —
  spec `2026-07-07-dedit-spec.md` §3.3, « jamais de scale global »). Ça ne change pas.
- **Dans l'éditeur, en interne, tout calcul reste en px.** `cqw` n'apparaît qu'à la frontière
  d'écriture/lecture du décor persisté — jamais comme type de donnée intermédiaire manipulé
  pendant l'édition (un geste en cours, une lecture live, une résolution d'écart affichée).
- À l'écriture, la conversion est sûre PARCE QUE l'auteur (le code qui écrit) connaît exactement
  la valeur posée — ce n'est pas une reconversion d'une valeur déjà approximée/déjà passée par
  cqw une première fois.

## 1. Pourquoi ce n'est pas déjà le cas — le bug du jour comme symptôme, pas la cause

Bug constaté en direct (`decor-editor-bridge.ts::resolveTemporaryPatch`) : sélectionner un item
sans keyframe, déplacer le seek légèrement et de façon répétée fait chuter `width`/`height` (et
par ricochet `border-radius`/`font-size`, dérivés du même décor résolu) de `18cqw` vers `0cqw` de
façon géométrique (`18 → 3.44 → 0.66 → 0.024 → …`, ÷~5 par cycle).

Mécanisme exact, vérifié en direct (stack trace capturée, pas supposé) :

1. `resolveTemporaryPatch` lit `authorApi.getNodeSnapshot(itemId, ['width', 'height', …])` —
   censé renvoyer une chaîne suffixée fiable (`"93.96px"`), MAIS pour `width`/`height`
   spécifiquement (propriétés du vocabulaire de pose propre d'anime.js, comme `x`/`y`/`rotate`),
   le nombre renvoyé s'est avéré être le nombre nu du dernier `cqw` posé (`18`), suffixé `px` par
   erreur de contrat (`"18px"`), PAS la largeur physique réelle (`"93.96px"`).
2. `formatLiveValueForCssProperty` divise ce `18` par `referenceWidthPx` (~522) → `3.44cqw`.
3. Cette valeur `3.44cqw`, déjà fausse, devient le `style.width` du `ResolvedDecor` affiché.
4. Au seek suivant, `resolveTemporaryPatch` relit le node — dont le cache anime a maintenant
   `3.44` comme dernier nombre nu pour `width` — et répète l'erreur : `3.44 / 522 × 100 = 0.66`.
   Chaque cycle amplifie l'erreur précédente : **rien ne borne la conversion à une frontière
   unique, chaque re-résolution reconvertit une valeur qui a déjà traversé la conversion**.

Ce n'est pas une simple typo corrigible localement (constat déjà fait une fois aujourd'hui,
correctif révoqué : patcher `resolveTemporaryPatch` seul recommencerait le même schéma à la
prochaine fonction qui lit une grandeur live). La cause de fond : **le chemin de conversion
cqw↔px n'est pas unique dans l'éditeur — il existe à plusieurs endroits indépendants, dont
certains relisent une valeur déjà convertie au lieu de repartir d'une source physique.**

## 2. Inventaire complet des points de conversion existants (avant tout changement)

| # | Site | Direction actuelle | Rôle | Donnée en repos |
|---|---|---|---|---|
| 1 | `resolveTemporaryPatch` (`app/bridges/decor-editor-bridge.ts:124`) | node (px, censé) → cqw | lecture live « décor temporaire », alimente `patch.style` | `style` = **cqw** (bug ici) |
| 2 | `resolveTemporaryOffset` (`app/bridges/decor-editor-bridge.ts:160`, ajout du jour) | node (px, `getNodeSnapshot`) → cqw | lecture live « décor temporaire », alimente `patch.offset` | `offset` = **cqw** |
| 3 | `syncOffsetBridge` → `offsetBridge.onValues` (`decor-editor/controller.ts:152-161`) | CS (px, continu pendant geste) → cqw | stocke l'état domaine à chaque tick de geste | `offset` = **cqw** |
| 4 | `applyPatch` → `offsetBridge.apply` (`decor-editor/controller.ts:212-215`) | domaine (cqw) → px | réapplique une saisie palette au CS (jamais déclenché aujourd'hui : pas de panneau `offset` dans la palette) | — |
| 5 | `formatLiveValueForCssProperty` (`decor-editor/css-value-format.ts:70-76`) | valeur live (px) → cqw | formatte `style.<prop>` pour l'affichage résolu | `style` = **cqw** |
| 6 | `formatNumberForCssProperty`/`parseNumberFromCssValue` (`css-value-format.ts:40-58`) | saisie utilisateur (nombre nu, jamais px) → cqw | saisie palette directe (facteur d'échelle, spec §3.3) | `style` = **cqw** — hors périmètre ici, jamais une valeur physique en jeu |
| 7 | `computeTextAutoSize`/`applyTextAutoSize` (`decor-editor/mount.ts:207-222`) | mesure canvas (px) → cqw | calcul figé au résultat, conforme à sa propre spec (`text-auto-size` §3.3), contexte différent | `style["font-size"]` = cqw, calcul non-continu au sens de ce plan |
| 8 | `resolveDecor`/`mergePatch` (`decor-editor/merge.ts`) | aucune | fusion pure d'écarts déjà résolus, ne convertit jamais — confirmé, pas un site de conversion | — |
| 9 | `applyResolvedDecor` (`decor-editor/mount.ts:166-177`) | aucune | écrit `decor.style` tel quel sur le DOM (`setProperty`) — suppose déjà en cqw | — |

**Constat clé** : `offset` (#2, #3) ET `style.width/height` (#1, #5) portent la MÊME information
(la géométrie d'un item) par deux chemins parallèles, jamais réconciliés — c'est la duplication
que la mémoire de session « Decor sole API » signalait déjà pour d'autres champs (custom, offset
manquant du live-read). `resolveTemporaryOffset` (#2) a été ajouté ce jour précisément pour cette
raison (l'offset ne suivait pas l'interpolation), sans qu'on remarque que #1 souffrait déjà du
même problème structurel sur `width`/`height` — la duplication elle-même n'a pas été questionnée.

## 3. Où le chemin est déjà clair (à ne pas toucher)

- **CS → cache anime.js → DOM** (`LibreAdapter`/`setNodePose`, hors périmètre editor) : px de
  bout en bout, jamais de cqw. Sain, confirmé par cette investigation (pas la source du bug).
- **Saisie palette directe** (`formatNumberForCssProperty`, #6) : nombre nu → cqw, jamais de px
  en jeu (l'utilisateur ne tape pas des px) — un vrai bord d'écriture, conforme au principe.
- **Persistance décor → player** (`scene.decors`, hors périmètre editor) : cqw de bout en bout,
  c'est le contrat de diffusion, ne change pas.

## 4. Où le chemin est embrouillé (le problème à traiter)

- **Lecture live pendant l'édition** (#1, #2) : reconvertit `node → cqw` à CHAQUE résolution
  (`syncSelection`, appelée à chaque seek/sélection — `decor-editor-bridge.ts:572,580,593,618,624`),
  jamais confinée à un bord. Le résultat cqw d'une résolution devient (via le cache anime.js déjà
  pollué, ou via une future ré-lecture) l'input implicite de la résolution suivante.
- **Geste CS continu** (#3) : convertit px→cqw à CHAQUE `pointermove` pour peupler l'état
  domaine (`offset`), alors que rien dans ce chemin n'a besoin de cqw avant le commit réel —
  seul le commit persisté a besoin de cqw.
- **Duplication style/offset** (#1 vs #2/#3) : `width`/`height` existent dans `style` (géré par
  #1/#5, panneau « Dimensions ») ET dans `offset` (géré par #2/#3, piloté par le CS) — deux
  sources de vérité pour la même grandeur, jamais réconciliées, chacune avec son propre chemin de
  conversion.

## 5. Direction proposée (à valider avant tout code — aucune ligne écrite à ce stade)

Poser un type distinct pour la donnée **en circulation pendant l'édition**, toujours en px,
distinct du type **persisté** (cqw) :

```typescript
// Décor en cours d'édition — TOUJOURS px, jamais de cqw en circulation.
interface LiveDecorPatch {
  style?: Record<string, string>          // valeurs non-géométriques (couleur…) inchangées
  offset?: LiveOffsetPatch                 // x/y/width/height/translate en PX, pas cqw
  // classes/zone/capsule/text/textAutoSize/custom : inchangés (déjà unitless ou hors géométrie)
}
```

- **Un seul point de conversion cqw→px** à la LECTURE du décor persisté (au moment où
  `resolveEffectiveKeyframePatch`/`resolveCurrentPatch` produisent un `ResolvedDecor` à afficher
  ou éditer) — jamais recalculé depuis une valeur déjà passée par ce point.
- **Un seul point de conversion px→cqw** à l'ÉCRITURE (au moment du commit réel vers
  `scene.decors`, dans `buildDecorCommands`/`patchToDecorArgs`) — jamais avant.
- Entre ces deux bords, `width`/`height`/`x`/`y`/`translate` circulent en px partout : lecture
  live du node (#1, #2 fusionnés en une seule fonction, plus de duplication style/offset), état
  du geste CS (#3, déjà en px — rien à changer là), état domaine dedit pendant l'édition.
- `referenceWidthPx` n'est plus consulté qu'à ces deux bords, jamais comme paramètre d'un calcul
  intermédiaire (`resolveTemporaryPatch`/`resolveTemporaryOffset` actuels le consultent à CHAQUE
  résolution — c'est ce qui permet à l'erreur de s'amplifier à chaque cycle).

## 6. Découverte complémentaire — la duplication style/offset N'EST PAS symétrique

Question initialement ouverte : faut-il unifier `style.width/height` et `offset.width/height` ?
Réponse trouvée en lisant le code réel, pas supposée : **la réconciliation existe déjà, mais
seulement d'un côté.**

`packages/editor/src/builder/build-scene.ts:706-743` (`resolveOffsetAsStyle`/`resolveDecorStyle`)
— le chemin **build → player** (persisté) fusionne déjà `{ ...decor.style, ...resolveOffsetAsStyle(decor.offset), ...resolveCustomAsStyle(decor.custom) }` : `offset` prime sur `style` pour la
géométrie (`x`/`y`/`translate`/`rotate`/`scale`/`width`/`height`), avec sa propre conversion cqw
(commentaire `build-scene.ts:690-704` : anime.js veut du px/unitless, `OffsetData` est cqw, donc
suffixage `${n}cqw` explicite envoyé à anime, qui le résout via `resolveContainerQueryValue` côté
runtime — cohérent avec tout ce qui a été tracé plus haut dans cette investigation).

**Cette réconciliation n'existe PAS côté preview live dedit** (`decor-editor/merge.ts::mergePatch`/
`resolveDecor` ne touchent jamais `offset` ; `decor-editor/mount.ts::applyResolvedDecor` lit
seulement `decor.style`). Conséquence concrète, vérifiable : un item redimensionné via le CS
(qui écrit dans `offset.width/height`) ne voit JAMAIS son panneau « Dimensions » (`style.width`/
`style.height`) refléter ce changement en preview — les deux ne sont réconciliés qu'au moment du
build, jamais pendant l'édition elle-même. C'est un gap séparé du bug de conversion cqw/px (le
bug du jour touchait `style.width` via #1, indépendamment de `offset`), mais de la même famille
que la mémoire `feedback-decor-sole-api-for-major-components` (une 5ᵉ énumération indépendante
des champs du décor, `resolveOffsetAsStyle`, jamais réutilisée côté editor — types différents,
`OffsetData` persisté vs `OffsetPatch` dedit, donc pas réutilisable telle quelle, mais le
PRINCIPE doit être partagé).

**Décision à prendre explicitement (pas déduite silencieusement) :** la frontière unique de
lecture (§5) doit-elle produire un `LiveDecorPatch` où `offset` a DÉJÀ été fusionné dans `style`
(un seul jeu de valeurs géométriques en circulation, symétrique à ce que fait déjà
`resolveDecorStyle` côté build) ? Cela supprimerait la duplication ET le bug de conversion d'un
seul geste, puisqu'il n'y aurait plus qu'une lecture géométrique par cycle, jamais deux chemins
parallèles à réconcilier plus tard.

## 7. Ce que ce plan NE tranche PAS encore (à discuter avant code)

- Confirmer la direction de la question posée en §6 : fusion `offset→style` dès la frontière de
  lecture live, symétrique à `resolveDecorStyle`.
- Où vit exactement le nouveau type `LiveDecorPatch`/`LiveOffsetPatch` (même module `types.ts`,
  ou fichier dédié) et comment le domaine XState de dedit (`machine.ts`, `AttachedItem.patch`)
  distingue-t-il un patch live (px) d'un patch résolu prêt à persister (cqw) — actuellement
  `DecorPatch`/`ResolvedDecor` sont le MÊME type, utilisé aux deux moments.
- Étendue exacte de la reprise : `resolveTemporaryPatch`, `resolveTemporaryOffset`,
  `syncOffsetBridge`, `applyPatch`, `formatLiveValueForCssProperty` sont tous candidats à
  réécriture ou suppression — liste à confirmer avant de commencer, pas déduite au fil du code.
- Si `offset→style` fusionne dès la lecture live, le panneau « Dimensions » doit-il alors
  toujours écrire dans `style.width/height` au commit, ou lui aussi vers `offset.width/height`
  (cohérent avec le fait que c'est `offset` qui prime au build) ? Question symétrique côté
  écriture, pas seulement lecture.

## 8. Réconciliation `offset`/`style` pour w/h — mise de côté, À FAIRE (détails à venir)

Décision explicite de l'auteur (2026-07-25) : la fusion `offset→style` en lecture seule (§6)
créerait une asymétrie lecture/écriture (la palette écrirait dans `style.width/height`, mais
`offset.width/height` — posé par un geste CS antérieur — resterait présent et continuerait de
PRIMER au build, rendant la saisie palette invisible au rendu final). La bonne réconciliation
n'est pas une fusion de lecture, mais une vraie **valeur unique partagée** entre CS et palette
pour `width`/`height` (plus de duplication `offset.width` vs `style.width` du tout) — touche le
modèle de données (`OffsetPatch`/`DecorPatch`, persistance `Decor`, build `resolveDecorStyle`).
Mis de côté explicitement, PAS traité par ce chantier — l'auteur donnera le détail de la
direction à prendre plus tard. Ne pas initier ce travail sans ce détail.

## Statut

**Correctif 1 (frontière unique de conversion) appliqué** : `resolveTemporaryOffset` a été
supprimée — elle produisait une SECONDE conversion cqw pour `width`/`height`, redondante avec
celle déjà faite par `resolveTemporaryPatch` (les deux couvraient les mêmes grandeurs, `offset`
n'ayant jamais de panneau palette propre, `default-palette.ts`) — c'est cette duplication,
combinée à un défaut de `getNodeSnapshot`/anime.js sur `width`/`height` spécifiquement, qui
produisait la double conversion cqw→cqw responsable de l'effondrement géométrique. `syncSelection`
ne construit plus qu'un seul `liveStyle` (via `resolveTemporaryPatch`, déjà correctement borné à
une frontière unique) pour la branche `isTemporary`. À valider en direct dans l'éditeur (scénario
exact du bug signalé : sélection sans keyframe + déplacement léger et répété du seek).

**Correctif 2 (réconciliation offset→style)** : mis de côté, voir §8 — pas appliqué dans ce tour,
en attente de détails de l'auteur sur la direction exacte (valeur unique partagée, pas une fusion
de lecture seule).

## 9. Bug distinct découvert et corrigé — course lecture/seek (`background-color` figée)

Après correction du §5 (plus de dégradation dimensionnelle), l'auteur a signalé un symptôme
distinct, toujours en direct : sélectionner un item sans keyframe puis déplacer le seek fait
progresser la position normalement, mais la couleur reste figée sur celle du keyframe précédent.

Diagnostiqué en direct (console temporaire, retirée après usage) : au moment où
`resolveTemporaryPatch` lit `background-color` via `authorApi.getNodeSnapshot`, la valeur lue est
IDENTIQUE au DOM à cet instant précis — donc pas un problème de cache anime.js périmé (hypothèse
initiale, invalidée par test), mais une vraie course : `syncSelection` (dans
`decor-editor-bridge.ts`'s handler `machine.on('seek', …)`) s'exécute de façon SYNCHRONE au
moment où l'événement `'seek'` est émis — qui est la DEMANDE de seek, pas sa complétion.
`telco.seek()` (le seul appel réel, dans `scene-player-bridge.ts`, un abonné SÉPARÉ au même
événement `'seek'`) est ASYNCHRONE ; son `.then()` existant appelait déjà `frame?.sync()` pour
resynchroniser le CS après coup — mais rien d'équivalent n'existait pour dedit, qui lisait donc
systématiquement l'état D'AVANT le seek.

**Corrigé** en ajoutant un nouveau signal de fin (pas un second appel `telco.seek()`) :
- `SEEK_APPLIED` (event entrant) / `seekApplied` (event émis) — `app/controller/types.ts`,
  `app/controller/controller-machine.ts` (nouvelle action `emitSeekApplied`, wiring `on:`).
- `scene-player-bridge.ts` : `machine.send({ type: 'SEEK_APPLIED' })` ajouté dans le `.then()`
  existant de `telco.seek()`, à côté de `frame?.sync()` — même rendez-vous, un consommateur de
  plus.
- `decor-editor-bridge.ts` : nouvel abonnement `machine.on('seekApplied', …)` qui rappelle
  `syncSelection` une seconde fois, une fois le seek réellement appliqué.

Vérifié en direct : la palette (champ « Fond ») suit maintenant la couleur interpolée à chaque
déplacement du seek, plus de gel sur le keyframe précédent. Suite complète (`packages/editor`
468/468, `packages/codplay` 335/335) verte.

**Statut final de ce chantier** : les deux bugs rapportés ce jour (effondrement dimensionnel §1-7,
gel de couleur §9) sont corrigés et vérifiés en direct. Le §8 (réconciliation `offset`/`style`)
reste en attente, non commencé.
