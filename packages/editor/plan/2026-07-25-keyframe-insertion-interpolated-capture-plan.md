# ed2 — Insertion de keyframe : consigner le décor temporaire déjà résolu, pas en inventer un nouveau

**En pause (2026-07-25)** — dépend du canal unique Decor à concevoir dans
`2026-07-25-decor-unified-api-study.md` (priorité fixée par l'auteur). Ne pas implémenter avant que ce
chantier soit tranché.

**Relève au 2026-09-04** — ce plan est conservé comme historique de la proposition
initiale. La capture au playhead est désormais traitée par la tranche P2-D du
[plan V2 de l’éditeur de mouvement](./2026-09-02-motion-editor-v2-plan.md) : projection
ouverte du snapshot, registre des propriétés modifiées et patch sparse. Les anciennes
mentions de `styleFieldsForItemType` ci-dessous ne constituent donc plus l’API actuelle.

Suite de `packages/authoring/selection-frame/plan/2026-07-17-resolved-state-at-time-notes.md`
(décor temporaire, cascade + lecture live — implémenté et validé, 2026-07-18) et de
`2026-07-17-decor-keyframe-layering-plan.md` (cascade en lecture, jamais stockée — implémenté et
validé). Ce plan ne construit AUCUN nouveau mécanisme de capture — il ferme un trou dans celui qui
existe déjà, et branche la création de keyframe dessus.

## 0. Ce que dit déjà le mécanisme existant

Entre deux keyframes réels (`resolveKeyframeAlignment` → `between`), `resolveTarget` retourne
`isTemporary: true`, `writeDecorId: null` — **aucune écriture possible aujourd'hui** :

> `onDecorChange` : « édition ignorée — décor temporaire (aucun keyframe à cet instant), pose un
> keyframe pour committer. » (`decor-editor-bridge.ts:426`)

`syncSelection` (ligne 384-396) calcule déjà, pour l'AFFICHAGE dans dedit, exactement la valeur à
consigner :

```
base = resolveEffectiveKeyframePatch(scene, item, alignment.prevKeyframeId, content)  // cascade complète, robuste aux éditions futures d'un kf antérieur
live = resolveTemporaryPatch(authorApi, itemId, styleFieldsForItemType(...), referenceWidthPx)  // lecture live du node
patch = mergePatch(base, live)
```

Ce `patch` EST « le décor virtuel » évoqué : vide (= `base` seul, rien n'a divergé) sauf si
quelque chose diffère réellement de la cascade à cet instant.

## 1. Le vrai trou : `resolveTemporaryPatch` ne couvre que le style, jamais la pose

Vérifié en lisant sa définition complète (`decor-editor-bridge.ts:123-135`) : elle construit
uniquement `{ style: {...} }` à partir de `authorApi.getNodeSnapshot(itemId, propNames)`, où
`propNames` vient de `styleFieldsForItemType` (champs `style.*` de la palette). **Aucun appel à
`authorApi.getNodePose(itemId)`** — la géométrie (translate/rotate/scale/width/height, ce que le CS
manipule) n'est jamais lue en direct pour le décor temporaire.

Conséquence concrète, confirmée en direct cette session : entre kf1 et kf2, la couleur affichée
dans dedit suit correctement l'interpolation en cours ; la position, elle, retombe sur celle de kf1
(via `base`, jamais rafraîchie par `live`) — l'asymétrie signalée au départ, maintenant localisée
précisément à cette fonction, pas au canvas ni au builder (les deux corrects, déjà vérifiés).

**Correctif** : `resolveTemporaryPatch` (ou la construction de `live` dans `syncSelection`) doit
aussi lire `authorApi.getNodePose(itemId)` et fusionner le résultat en `patch.offset`, au même
titre que `patch.style` — même garde `!gestureActive` déjà en place pour le style (ligne 389-394,
fiable pendant un geste CS depuis que `LibreAdapter` écrit via `AuthorApi.setNodePose`). Une seule
fonction, un seul point de lecture, offset et style traités identiquement — plus de branchement
séparé entre les deux.

## 2. Consigner ce patch à la création d'un keyframe

`KEYFRAME.ADD` (`sequence-editor/machine.ts:443-453` → `adjacentDecorId`) crée aujourd'hui un
keyframe qui partage le décor du voisin, ou un décor vide — sans jamais consulter le décor
temporaire déjà résolu par `dedit` pour ce même instant.

Changement : au moment de la création, si l'item était en `isTemporary` (alignement `between`) à
l'instant `t` de l'insertion, et que le `patch` résolu par le mécanisme de §0/§1 est non-vide (une
fois `offset` inclus) :
- le nouveau keyframe reçoit un `decorId` **frais** (jamais partagé),
- rempli avec ce `patch` (conversion `patchToDecorArgs`, déjà existante et déjà utilisée par
  `onDecorChange` pour toute écriture normale — pas de nouvelle conversion à écrire).

Si le patch est vide (rien n'a divergé à cet instant, ou pas de keyframes voisins) : le nouveau
keyframe s'ouvre vide, exactement comme aujourd'hui — rien ne change dans ce cas.

Une fois le keyframe créé (vide ou pré-rempli), toute modification ultérieure s'y enregistre
normalement (`target.keyframeId` défini, `isTemporary: false`) — comportement déjà en place,
inchangé.

## 3. Coordination nécessaire

`KEYFRAME.ADD` est traité dans `sequence-editor/machine.ts`, qui n'a pas accès à `authorApi` ni à
`resolveTemporaryPatch`/`resolveEffectiveKeyframePatch` (tous deux dans `decor-editor-bridge.ts`,
seul détenteur de la lecture live — cf. mémoire projet « Dedit est le seul coordinateur »). Point à
préciser avant de coder : `sequence-editor` délègue la résolution du décor initial à `decorEditor`
avant d'émettre `createNamedKeyframe`, plutôt que de composer ce décor localement dans
`machine.ts`. Un seul appelant légitime pour `resolveTemporaryPatch`/`resolveEffectiveKeyframePatch`
reste `decor-editor-bridge.ts` — ce plan ne déplace pas cette responsabilité.

## 4. Ce qui NE change PAS

- La cascade de lecture (§07-17/07-18) — inchangée, réutilisée telle quelle.
- Le fork-à-l'édition (`isDecorSharedByAnotherKeyframe`) — reste nécessaire pour tout décor encore
  partagé par un autre biais.
- Le builder (`build-scene.ts`) — aucun changement ; un keyframe désormais pré-rempli à la création
  est un keyframe comme un autre pour le build, rien de spécifique à traiter là.
- `adjacentDecorId`/partage — reste le comportement par défaut quand rien n'a divergé (patch vide) ;
  ce plan ajoute une exception, ne le remplace pas.

## 5. Tests à ajouter

- Item avec position ET couleur interpolées entre kf1/kf2 → insertion à mi-parcours → le décor créé
  contient les deux valeurs interpolées (pas celles de kf1 seul).
- Insertion sans rien de divergent (ex. avant le premier kf, ou item statique) → décor vide,
  comportement actuel inchangé.
- Édition d'un kf antérieur APRÈS l'insertion, sur une propriété non couverte par la capture (cas
  limite déjà couvert par la cascade) → doit toujours se propager, non-régression 07-17.
- Nouveau test dédié pour §1 : décor temporaire entre deux kf avec une position ET une couleur
  interpolées → `patch.offset` ET `patch.style` doivent tous deux refléter l'interpolation (pas
  seulement le style comme aujourd'hui).

## 6. Ordre d'exécution proposé

§1 (fermer le trou offset dans `resolveTemporaryPatch`, testable indépendamment — corrige déjà
l'affichage dedit entre deux kf) → §3 (trancher la coordination) → §2 (brancher `KEYFRAME.ADD`) →
tests → validation Safari (répro exacte de cette session : insertion à 2.5s sur un item
position+couleur animées, plus de saut visuel, palette et canvas cohérents).

---

**Ce plan est soumis pour relecture avant toute implémentation — rien codé à ce stade.**
