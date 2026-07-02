# Intention — mount/démontage dynamique des persos/stories et compatibilité seek

## Statut

**Clos le 2026-06-29** — remplacé par `2026-06-28-unify-action-execution-and-move-off-plan.md`,
dont la Phase 3 livre `move:"off"` et la résolution d'état monté au seek. Document conservé pour
l'historique de l'intention initiale ; ne plus l'utiliser comme référence active.

Intention formalisée — **pas une analyse de faisabilité**. L'analyse de faisabilité est un
travail distinct, à mener ultérieurement à partir des questions ouvertes listées ici.

## Origine

`packages/demos/src/scenes/quiz-hunt/PRATIQUES.md` item n°3 propose : ne monter à l'init de la
scène que les persos "master"/structurels (zones, racine de layout), attacher le contenu
(panneaux trial/final) à la demande via `move`, le détacher quand il n'est plus pertinent, et
révéler par une transition d'opacité plutôt qu'un basculement `display:none`/`block`.

Cette pratique ne pose pas de souci *en lecture* (parcours séquentiel normal, du début vers la
fin). Sa compatibilité avec `seek` — saut arbitraire dans le temps, notamment le scrubbing rapide
(`seek()` répété, ex. à chaque `pointermove`) — n'a pas été vérifiée. C'est ce point précis qui
nécessite une analyse séparée, isolée ici avant d'aller plus loin.

## Pourquoi ce n'est pas juste « appliquer `move` plus souvent »

Un précédent direct et récent existe déjà dans la base, à une échelle différente :
`2026-06-25-image-node-per-src-plan.md` (statut **implémenté**). Même forme de problème —
plusieurs candidats pré-construits, un seul actif/visible à la fois, bascule par attach/detach
plutôt que par mutation en place — mais résolu à l'intérieur d'**un seul composant**
(`ImageComponent`), invisible à la couche scène/perso (rien d'authored ne change).

Ce qui s'est avéré vrai dans ce précédent, et qui doit être vérifié avant de généraliser à des
persos/stories authored :

- **Constat fondateur du précédent** : « le `src` n'est pas un état rejouable (...) on traite une
  ressource mutable à effet de bord (le décodage) comme un état reconstructible — asymétrie
  irréductible avec le modèle de seek. » Le fix n'a pas consisté à mieux gérer l'attach/detach,
  mais à **éliminer toute réassignation** de la ressource à effet de bord : chaque `<img>` ne
  reçoit son `src` qu'une fois, à la création ; ensuite seule sa **visibilité** bascule — et
  c'est cette bascule de visibilité, pas le contenu, qui devient l'état rejouable au seek.
- Deux approches plus simples (dont un « commit différé du `src` ») ont été essayées et
  **abandonnées par l'auteur**, jugées masquantes, avant d'arriver à la solution retenue — signe
  que ce type de problème ne se résout pas par la première solution qui marche en lecture
  normale.
- Même résolu, un point reste **ouvert** dans ce même document : « clones de transition
  superposés (race)... non reproductible en seek synchrone — vraisemblablement une race liée au
  timing réel d'anime.js (transition live interrompue par un seek). » Le sujet « mount/unmount +
  seek » n'est donc pas définitivement clos, même dans son périmètre le plus restreint et le
  mieux instrumenté à ce jour.

## Intention (ce qu'on veut — pas encore évalué en faisabilité)

1. Pouvoir attacher/détacher des **persos de contenu** (pas seulement des nodes internes privées
   à un composant) à la demande, sans dépendre d'un pré-montage exhaustif à l'init de la scène.
2. Que l'état « ce perso est actuellement attaché / détaché » soit un état **reconstructible au
   seek**, au même titre qu'un style ou un contenu — pas un effet de bord qui casse en arrière ou
   sous scrubbing rapide.
3. Que la révélation (attach → visible) passe par une transition (opacity), pas par un saut brut
   `display:none → block`, sans réintroduire un coût de re-décodage/réinitialisation à chaque
   bascule.
4. Que ce mécanisme reste valable à l'échelle d'une **story entière** (32 panneaux quiz-hunt,
   chacun avec son propre état de story, ses propres persos, ses propres straps), pas seulement
   à l'intérieur d'un composant unique comme dans le précédent image.

## Questions ouvertes pour l'analyse de faisabilité (non traitées ici)

- Existe-t-il, pour les persos non-media de quiz-hunt (`input` natifs, `fieldset[disabled]`,
  focus clavier/souris), un effet de bord irréductible analogue au décodage d'image qui
  empêcherait un detach/reattach naïf — au même titre que le `src` ne pouvait pas être muté en
  place ?
- Le détachement générique (`move` vers une cible introuvable) n'a aujourd'hui aucun sentinel
  propre et silencieux (déjà noté dans `PRATIQUES.md` item n°3 : chaque détachement volontaire
  émet `AUTHOR_LAYOUT_OUTLET_NOT_FOUND`). Ce point doit-il être traité comme préalable à tout
  mount/unmount story-level, ou est-il orthogonal ?
- Comment se comporte la reconstruction d'état de track (`listen`/`straps` d'une story) pendant
  que ses persos sont détachés du DOM ? Le précédent image ne répond pas à cette question : il
  opère sous un seul perso/composant, jamais à l'échelle d'une story avec son propre état et ses
  propres règles `listen`.
- Le point ouvert « clones de transition superposés » du précédent (timing réel d'anime.js
  interrompu par un seek live) est-il un risque générique à tout mount/unmount avec transition,
  ou spécifique au clonage utilisé par `apply-simple.ts` ?

## Périmètre de ce document

Ceci formalise l'intention et le contexte ; ce n'est **pas** une analyse de faisabilité (pas de
proposition de conception, pas d'estimation de risque tranchée, pas de décision). L'analyse de
faisabilité est un travail séparé, à mener ultérieurement à partir des questions ci-dessus.
