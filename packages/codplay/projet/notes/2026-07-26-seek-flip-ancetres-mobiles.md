# Seek d'un FLIP sous ancêtres mobiles — cas extrêmement complexe

Note de réflexion (2026-07-26), dont le statut a été réévalué le 2026-08-02 : ce cas est désormais
un **contrat de base du FLIP HTML V2**, pas seulement un cas limite. Il stresse-teste le flux
`solve/project` (`2026-07-16-solve-project-moteur-custom.md` S5-S8) et révèle une tension que le
reste du cadre n'expose pas. La note conserve le raisonnement ; l'implémentation de base est suivie
dans `packages/codplay/plan/flip-list-coordination-plan.md`.

## Le cas

Un item subit un **FLIP** (déplacement animé) entre **deux parents eux-mêmes en mouvement**,
lesquels sont sur des **grands-parents également en mouvement**. On demande sa **position exacte à un
`seek`** (saut direct à `t`, pas de lecture continue).

La position écran de l'item = composition de toute la chaîne d'ancêtres à `t` :
`grand-parent(t) · parent(t) · item(t)`. Chaque maillon est lui-même possiblement en pleine
transition à `t`.

## La tension de fond — abstraction (fidèle au modèle) vs mesure (fidèle au pixel)

Deux façons d'obtenir la position composée, et **ni l'une ni l'autre n'est gratuite** :

- **Composer depuis l'état logique** (`PersoState @ t` de chaque ancêtre → matrices → produit, dans
  l'ordre racine→feuille, chaîne d'ancêtres venant du move-state). Pur, sans DOM, exact *vis-à-vis du
  modèle*, ordonnable, cohérent avec solve/project. **Mais** : l'abstraction introduit une
  **imprécision réelle**. La position d'un node DOM n'est PAS toujours le produit propre des matrices
  logiques — un **overflow, un repaint, un resize, un reflow** produisent des effets **non
  prédictibles depuis l'état**. Composer depuis le `PersoState` est fidèle au *modèle*, pas garanti
  fidèle au *pixel réel*.
- **Mesurer sur le DOM** (`getBoundingClientRect` de la chaîne, ce que fait `readParentMatrix`
  aujourd'hui : `parseCssMatrix(readTransformValue(ancestor))` en remontant `parentNode`). **La seule
  façon de connaître la position RÉELLE** — elle intègre overflow/repaint/reflow par construction.
  **Mais** : en seek, elle suppose que le DOM des ancêtres est **déjà juste à `t`** (ordre de
  projection racine→feuille garanti avant de mesurer), et elle couple le solve de l'item au rendu de
  ses parents.

**Le point posé par l'auteur** : la lecture DOM n'est pas un défaut à éliminer — c'est le **seul
recours** contre l'imprécision des effets DOM non prédictibles. L'abstraction pose ce souci
d'imprécision ; elle ne le résout pas. Donc pour ce cas précis, on ne peut pas se contenter de « tout
dériver de l'état ».

## La solution (auteur, affinée en discussion) — N mesures repositionnées, remontant le temps dans un RAF

Idée initiale (auteur) : au lieu d'une lecture unique à `t`, **remonter dans le temps** pour lire les
états des parents, et recalculer la position de l'item — **plusieurs lectures DOM consécutives dans le
même tour RAF**. On ne *lit* pas des états passés (le DOM ne donne que l'instantané courant) : on
**repositionne activement** le DOM à `t−x` puis on **mesure** le résultat réel, séquentiellement, sans
paint entre les mesures.

**Validé sur un mécanisme déjà présent** : le FLIP fait déjà `capture (mesure) → mutate (repositionne)
→ capture (re-mesure)` dans un même run (`create-flip-engine.ts run()`), et `flushLayout` force le
reflow synchrone entre écriture et mesure. L'idée en est la **généralisation temporelle** : N instants
au lieu de 2. Le DOM autorise des reflows synchrones successifs dans un RAF ; rien ne s'affiche tant
que le RAF n'a pas rendu la main.

**Supérieure à la composition d'état pure** sur un point précis : en repositionnant *réellement* puis
en mesurant, on intègre les effets non prédictibles (reflow/overflow/clamp) **à chaque instant
reconstruit**. Le calcul d'état pur (composer des matrices idéales) les rate. Donc cette approche reste
exacte **même quand un ancêtre anime du LAYOUT** (width/height) — le cas que la composition d'état ne
peut pas couvrir.

### La coupe — par reflow, PAS par stabilité (correction d'une version antérieure)

Question de l'auteur : « un parent stable mais pas son grand-parent, quel effet ? » — elle invalide la
coupe naïve « remonter au premier stable ». Un parent stable **transmet** l'instabilité de son
grand-parent : si le grand-parent reflow, le parent stable est déplacé réellement, sa propre stabilité
ne compense rien. Chaque ancêtre est, à `t`, dans un des trois régimes :
- **stable** (aucune transition active) — contribution figée, settled.
- **interpolation compositée** (translate/scale/rotate/opacity) — animé SANS reflow → **dérivable par
  calcul**, pas de mesure.
- **interpolation de layout** (width/height, reflow) — animé AVEC reflow → **exige la mesure
  repositionnée**.

**La coupe correcte** : remonter jusqu'au **plus haut maillon en interpolation de layout** (le « reflow
le plus haut ») et ancrer là. Au-dessus : stable/compositée → dérivable ou figé, **une mesure d'ancre
suffit**. En dessous : chaque maillon compositée est calculé, chaque maillon layout est re-mesuré. **Si
aucun maillon layout dans la chaîne → composition d'état pure, zéro mesure repositionnée** (cas
courant).

### Pourquoi c'est soutenable — « en pratique, quelques nodes »

Structurel, pas chanceux : seuls les maillons en interpolation de **layout** coûtent une mesure. Or
animer le `width`/`height` d'un *conteneur d'ancêtres* est rare (les animations codplay sont
massivement des transforms compositées — bonne pratique perf). Donc dans le cas courant, N×M ≈ 1 (une
mesure d'ancre, voire du calcul pur). Le mécanisme lourd est le **pire cas** (plusieurs ancêtres
animant du layout, en transition, au seek) — l'optimisation est de **détecter le cas simple et
court-circuiter**, ce qui est presque toujours vrai. Il faut aussi **borner N aux bornes de
transition** (les instants où la topologie de composition change), pas un pas de temps continu.

### Régime scrubbing — debounce + cache, PAS une promise sur le seek

Constat auteur : l'usage type n'est pas un seek isolé mais le **scrubbing du progress** → rafale de
seeks recalculés. C'est un problème de **fréquence** (trop d'appels), pas de **durée** (un appel lent).
Réponse : deux étages à débounçage différent — et surtout **le seek reste synchrone/déterministe**
(`seek ≡ play` préservé ; une promise sur le seek entier ré-introduirait la concurrence sur l'état de
vérité que le cadre XState bannit — `feedback-xstate-not-promises-callbacks`).

```
scrub(progress) → t :
  ── étage rapide · CHAQUE frame · synchrone · JAMAIS debouncé (suit le doigt) ──
  1. PersoState @ t                                  (déterministe)
  2. caractérisation de chaîne  ← CACHE par SEGMENT inter-bornes
                                   (recalc. seulement au franchissement d'une borne)
  3. position composée / approchée                   (fluidité visuelle du scrub)

  ── étage lourd · cas rare (maillons layout) · DEBOUNCÉ (déclenché à la pause du scrub) ──
  4. correction mesurée  ← CACHE mesures par (node, instant-borne)
     (repositionne t−x → mesure → raffine la position pixel-exacte)
```

- **Debounce** → uniquement l'étage 4, déclenché quand le progress se stabilise (au drag : position
  approchée suffisante ; au relâchement : correction pixel-exacte).
- **Cache** → clé = **segment inter-bornes** pour la caractérisation (la topologie change par paliers,
  pas en continu — donc `t` seul serait une mauvaise clé), et `(node, instant-borne)` pour les mesures
  (réutilisées si le scrub repasse par un `t` déjà mesuré).
- **Annulabilité obligatoire** : une correction différée (étage 4) doit être **abandonnée** si un
  nouveau scrub repart avant qu'elle rende — sinon elle peindrait une position périmée par-dessus la
  courante (pendant asynchrone du piège « restaurer l'état à `t` »). Même principe que `HelperHandle`
  cancellable.

## Ce que ça implique pour le cadre (analyse)

- **`solve` est hiérarchique** : composition racine→feuille, pas un passage plat. La chaîne d'ancêtres
  vient du **move-state** logique, pas de `parentNode` DOM.
- **`measure` (S8) est irréductible** — recours d'exactitude au pixel là où l'abstraction ne suffit
  pas (maillons layout). L'algorithme ci-dessus **minimise** les mesures (coupe par reflow, cache),
  il ne les élimine pas.
- **Régime asymétrique play/seek** : reflows en cascade acceptables en seek (ponctuel, debouncé),
  prohibitifs en play (continu — qui s'appuie sur la coïncidence de simultanéité frame-par-frame).
- **Canvas** : la raison n'est PAS « pas de hiérarchie » (le canvas l'a aussi) mais « pas
  d'imprécision » — tu possèdes la composition (`ctx.transform`), aucun moteur de layout n'intervient.
  Donc les N *mesures* coûteuses côté DOM deviennent N *calculs* gratuits côté canvas ; `measure` y
  devient éliminable. Le mécanisme lourd de cette note est **spécifique au substrat DOM**.

## Statut

**Contrat V2 acté, implémentation en cours**. La coupe par reflow, la composition racine→feuille,
la mesure historique déléguée au host et le cache par capture/ancêtre/epoch/instant sont désormais
le socle du FLIP HTML V2. Le scrubbing corrigé et les mesures repositionnées complètes restent à
implémenter. Lié :
`2026-07-16-solve-project-moteur-custom.md` (S5 solve hiérarchique, S8 `measure`), mémoire
`project-item-perso-node-one-way-projection` (la mesure ≠ le rétro-flux interdit — ici la mesure
sert la position réelle, elle ne reconstruit pas une description d'auteur).
