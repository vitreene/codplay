# Notes — modèle décor/keyframe : fonctionnement actuel, avant refonte

But de ce document : garder une trace fidèle du fonctionnement ACTUEL (avant tout changement),
pendant qu'on conçoit et valide la nouvelle façon de faire (demande explicite de l'auteur,
2026-07-17). Ne remplace pas `2026-06-11-sequence-editor-grid-spec.md` §2.3 (copy-on-write, déjà
implémenté ce jour) — le complète sur un point que ce spec ne couvrait pas : ce qu'un keyframe
« vide » représente réellement, et où s'arrête la responsabilité du diff.

## 1. Ce qui existe aujourd'hui, exactement

### 1.1 Création d'un item (`createItem`, `base-commands.ts:30`)

Crée l'item ET un décor associé (`item.initialDecorId`) dans le même geste — **obligatoire**,
jamais un item sans décor. Ce décor ne porte aujourd'hui que `offset` (la géométrie posée à la
création) — aucun style visuel (couleur, typo…).

### 1.2 Création des keyframes intro/outro (`DemoMenuRegion.tsx`, via `createKeyframe`, `base-commands.ts:109`)

Chaque keyframe créé sans `decorId` explicite reçoit une entrée **vide** dans `scene.decors` —
`{ id: decorId }`, aucun style, aucun offset. Trois décors distincts existent alors pour un item
tout neuf à 2 keyframes : `item.initialDecorId` (l'offset), `kf1.decorId` (vide), `kf2.decorId`
(vide).

### 1.3 Ajout d'un keyframe via la timeline (`KEYFRAME.ADD` → `adjacentDecorId`, `machine.ts`)

Le nouveau keyframe **hérite de la RÉFÉRENCE** du décor du voisin le plus proche (pas une copie) —
voulu ainsi par `2026-06-11-sequence-editor-grid-spec.md` §2.3, pour ne pas dupliquer des décors
identiques. Tant que personne n'édite l'un des deux keyframes, ils partagent littéralement le même
objet `Decor`.

### 1.4 Édition d'un décor de keyframe (`decor-editor-bridge.ts`, corrigé ce jour)

Avant modification, vérifie si le `decorId` ciblé est référencé par un AUTRE keyframe de la scène
(`isDecorSharedByAnotherKeyframe`). Si oui : fork — `registerDecor` (entrée fraîche vide) +
`assignKeyframeDecor` (reboucle CE keyframe sur le nouvel id) + `setDecor` (écrit le patch sur le
nouvel id, jamais sur l'original). **Ce mécanisme est conservé** (confirmé par l'auteur,
2026-07-17 : « on peut maintenir la création de décor à la volée lorsqu'une modification est
faite, par duplication »).

### 1.5 Lecture d'un décor pour l'afficher dans dedit (`resolveTarget`/`syncSelection`, `decor-editor-bridge.ts`)

Lit `scene.decors[target.decorId]` **brut**, sans fusion avec quoi que ce soit d'autre —
`chain: []` toujours vide (aucune chaîne d'héritage capsule/zone/defaults n'est câblée
aujourd'hui, malgré l'infrastructure de fusion déjà présente : `decor-editor/merge.ts::resolveDecor`
sait fusionner `defaults ⊕ patch(1) ⊕ … ⊕ patch(n)`, mais rien n'alimente ce `chain` avec un
quelconque décor de référence). Si le décor du keyframe est vide, dedit affiche donc les valeurs
par défaut du champ (`#808080` pour un `color`, etc.) — **jamais** l'apparence réelle et actuelle
de l'item, même si elle existe ailleurs dans le document.

### 1.6 Interpolation au build (`build-scene.ts::buildKeyframeDecorActions`)

Déjà et uniquement diff-based, confirmé en lisant le code (pas une supposition) :
`computeStyleDiff` (ligne 710) ne parcourt QUE les clés du style résolu du keyframe DESTINATION, et
n'émet une entrée QUE si la valeur diffère de celle du keyframe précédent (« Principe B » — une
propriété inchangée n'émet rien). Le premier keyframe n'a pas de transition propre : son style est
posé une seule fois dans `common.style` (`buildItemPerso`, fusion `initialStyleFromIntro ⊕
introDecor ⊕ firstKfDecor`). **Ce point du fonctionnement actuel correspond déjà à ce que l'auteur
décrit comme souhaitable** (« au builder, c'est seulement les diff qui sont interpolées ») — rien à
changer ici a priori.

## 2. Le vrai écart (pas la copie-sur-écriture, qui est déjà correcte)

`1.5` est la lacune concrète derrière le symptôme « le décor de kf1 n'est pas chargé dans dedit » :
un keyframe créé vide (§1.2) reste vide tant qu'il n'a pas été explicitement édité — dedit le lit
alors brut, sans jamais remonter à l'apparence réelle de l'item (§1.1, ou une future notion de
« ce qui ne bouge pas »). Une propriété qui ne varie JAMAIS entre keyframes ne devrait pas dépendre
d'un décor par-keyframe du tout — elle devrait être résolue UNE FOIS (item, ou futur preset par
défaut) et dedit devrait la lire de là, quel que soit le keyframe sélectionné. Aujourd'hui, rien ne
distingue « propriété jamais réglée sur ce keyframe parce qu'elle est fixe pour tout l'item » de
« propriété jamais réglée parce que le keyframe est simplement vide » — les deux se lisent comme
`undefined` dans `scene.decors[kf.decorId]`.

## 3. Modèle validé (raisonné à deux, 2026-07-17) — pas encore codé

Analogie de l'auteur, exacte : traitement de texte — feuille de style de paragraphe (preset),
feuille de style de caractère, remplacement local. Un empilement par couches, jamais un diff
lu à l'affichage.

**Distinction clé** : une propriété jamais réglée par personne (« encore alignée sur le preset »)
contre une propriété explicitement réglée quelque part dans l'historique de l'item (« a divergé »).

- Propriété jamais divergée → absente du décor de CHAQUE keyframe → dedit et le builder retombent
  sur le preset, en direct (si le preset change plus tard, ça se propage — rien n'est figé).
- Propriété déjà divergée sur un keyframe antérieur → dupliquée (valeur, jamais une référence) dans
  chaque nouveau keyframe créé ensuite, dès sa création → dedit affiche tout de suite une valeur
  réelle, jamais un trou.

Pourquoi ça résout les deux inconvénients relevés :
- Duplication totale (option B) cassait la propagation du preset — ici, seules les propriétés
  DÉJÀ écartées du preset se dupliquent ; tout le reste reste vivant.
- Partage-puis-fork seul (option A, mécanisme déjà en place §1.4) laissait un trou dans dedit tant
  qu'aucune divergence n'existait — ici, dès qu'une divergence existe quelque part dans
  l'historique, elle se propage par valeur à la création des keyframes suivants, donc plus de trou.
- Pas de retour du problème de « distorsion au réordonnancement » (§1.3/raison d'être du modèle
  actuel) : la duplication est un instantané pris UNE fois à la création (valeur figée), jamais une
  chaîne vivante recalculée selon l'ordre courant — un réordonnancement après coup n'invalide rien
  de ce qui a déjà été capté. Le seul résidu (réordonner puis constater qu'un keyframe aurait dû
  capter une valeur différente de son nouveau voisin) se traite ponctuellement, à l'événement, pas
  structurellement — accepté comme tel par l'auteur.

## 4. Prochaine étape — pas encore commencée

Ce modèle est validé conceptuellement, pas encore transformé en plan d'implémentation. Restent à
préciser avant de coder : comment « divergé vs jamais divergé » se représente concrètement dans
`Decor`/`scene.decors` (une propriété absente suffit-elle comme marqueur, ou faut-il autre chose) ;
où vit le preset lui-même (système pas encore construit, évoqué plus tôt cette session — « chaque
type d'item devra en avoir un ») ; comment `decor-editor-bridge.ts` (résolution de lecture) et la
création de keyframe (`createKeyframe`/`createNamedKeyframe`/`KEYFRAME.ADD`) changent en
conséquence. Pas de code tant que ce n'est pas précisé et relu.
