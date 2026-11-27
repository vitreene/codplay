# Revue du composant scroll-container — plan de travail

> Statut : **En analyse** — note de travail de l'agent. Objectif : décider si
> scroll-container doit être réajusté ou peut rester tel qu'il est, et si des
> fonctions métier doivent en sortir vers le cœur, distribuées par une capacité.

## Cadre fixé par l'utilisateur (2026-11-27)

- Un composant rend ; la logique est dans la scène.
- scroll-container est trop imbriqué dans le cœur pour servir de modèle de
  composant externe ; deux issues envisagées : il devient core, ou l'externe se
  conçoit sur d'autres exemples. Dans les deux cas il dépasse les
  responsabilités d'un composant.

## Responsabilités actuelles (lecture du code)

| Partie | Taille | Rôle |
| --- | --- | --- |
| `ScrollContainerComponent` | 258 l. | rend le scrollport (hérite de `TagComponent`) ; écoute `scroll`, `scrollend`, resize ; calcule la progression ; ouvre la session de capture ; gère seek, fin de séquence, reset (remet `scrollTop` à zéro), destruction |
| `scroll-progress-provider` | 50 l. | calcul et coalescence de la progression |
| adaptateur d'observation | 435 l. | lit la scène compilée et résolue, résout le scrollport ancêtre, mutualise les `IntersectionObserver`, suit les phases, `once`, `initial`, diffère jusqu'à `playing`, ignore le seek, émet `enter` / `leave`, applique `liveAction`, diagnostics |
| `intersection-observation-provider` + `abstract-live-source-provider` | 161 l. | logique de phase et cycle de vie des providers |
| module | 8 l. | jeton vide (`create: () => ({})`) |
| cœur : `scroll-observation-validation.ts` et parties du compilateur de capture, codec, validateur sémantique | 220 l. + | validation et compilation d'`emit.observe` |

## Constats

1. Seule la première ligne relève du rendu : un scrollport est un élément HTML
   dont le style porte `overflow` — exactement ce que fait déjà `tag`.
2. La progression de scroll est une **source de capture continue**, de même
   nature que la source pointeur, qui est une source du cœur
   (`runtime/capture/sources/html-pointer-capture-source-adapter.ts`), câblée
   par le runner.
3. L'observation de visibilité est une **source d'events discrets** déclarée
   dans `Perso.emit`, de même nature que les events DOM, eux aussi source du
   cœur (`runner-html/perso-emit-source-adapter.ts`). Le cœur compile déjà sa
   déclaration.
4. L'adaptateur d'observation réimplémente des règles de cycle de vie que les
   sources du cœur portent déjà (pas d'émission hors `playing`, rien pendant le
   seek).
5. Elcé construit des persos `scroll-container` (Flux, Diapo, Carousel) : tout
   changement de type ou de format touche ses builders.

## Hypothèse à valider

Les deux sources (progression, observation) sont des fonctions métier
légitimement core, à distribuer par une capacité optionnelle, à côté des
sources pointeur et DOM. Le composant se réduit alors au rendu du scrollport.

**Validée par l'utilisateur (2026-11-27)** : progression et observation sont des
fonctions du cœur, offertes par une capacité. Contraintes : Elcé (prototype) ne
doit pas être cassé ; en principe, aucune modification de SceneDoc.

## Évaluation « SceneDoc inchangé »

- **Format auteur** : faisable sans changement — type `scroll-container`, son
  `initial` (`tag`, `style`, `attr`, `values.progress`), `emit.scroll.capture`,
  `emit.observe` (`root`, `zone`, `enter`, `leave`, `once`, `initial`,
  `liveAction`). Les builders Elcé (Flux, Diapo, Carousel, viewport-expansion,
  repère de fin) et les scènes Sighty demo5 produisent les mêmes documents.
- **Rendu** : le scrollport reste la racine `tag` ; les sources n'ajoutent pas
  de markup. Aucun rendu de builder à adapter si la sortie DOM du composant
  reste identique.
- **Paquets déjà exportés** : garder le type `scroll-container` et l'id de
  module `scroll-container`, inscrits dans les requirements compilés (SCORM,
  Sighty autonome).
- **Ce qui change pour Elcé : le câblage seulement** —
  `player/elce-player-engine.ts` (enregistre les définitions par des chemins
  internes de component-v2), `learning-player.ts`, `quiz-hunt-player.ts`,
  `scorm-package-runtime.ts` (adaptateur de source `htmlHost`), la liste de
  bundling du serveur local, et les tests d'intégration qui enregistrent les
  définitions. Même chose pour `demos/src/sighty/demo5/engine-config.ts`.
- **Risque** : si l'adaptateur d'observation passe dans le cœur et qu'Elcé le
  fournit encore par `htmlHost`, l'observation est doublée. Transition possible :
  les exports de component-v2 deviennent des cales dépréciées (adaptateur sans
  effet) jusqu'au nettoyage du câblage Elcé.

## Scrollport et capacités : cœur ou externe ?

- **Scrollport** : peut devenir un type du cœur (utilisateur, 2026-11-27).
- **Question de l'utilisateur** : à l'inverse, les capacités pourraient-elles
  devenir externes ?
- Éléments d'évaluation :
  - une capacité externe demande la même API que celle qui manquait au
    composant (ses déclarations compilées, l'ascendance d'un perso, l'élément
    d'un perso, `emit`, actions live, état du player, port de capture) :
    déplacer le code du composant vers une capacité externe déplace le problème
    sans le résoudre, tant que l'API externe n'existe pas ;
  - usage mesuré : `emit.observe` est utilisé par 3 fichiers d'Elcé (Flux,
    Diapo, Carousel, repère de fin) et 3 des démos ; `emit.scroll.capture`
    n'est utilisé que par la démo scroll-container ;
  - l'observation partage les règles de cycle de vie des sources du cœur
    (`playing`, seek, pause), qu'elle réimplémente aujourd'hui ;
  - la progression passe déjà par le port de capture borné
    (`RuntimeCaptureSourcePort`), le plus proche d'une API existante.

**Décidé par l'utilisateur (2026-11-27)** :
- observation et progression sont liées : toutes deux dans le cœur, avec le
  scrollport ; en externaliser une seule serait artificiel ;
- `observe` se construit dans le respect des règles de CodPlay ; il est par
  nature lié à la projection HTML ;
- il prend appui sur les captures.

## `observe` sur le circuit de capture — correspondance

| Capture (existant) | `observe` aujourd'hui | Correspondance |
| --- | --- | --- |
| source continue → `RuntimeCaptureSourceCircuit` (identité, nom de source) | callbacks `IntersectionObserver` par perso cible | source HTML `observe`, comme l'adaptateur pointeur ; sample `{ ratio, isIntersecting, isVisible? }` |
| event de départ via `RuntimePlayer.emit()`, puis session | `enter` émis à l'entrée | `enter` = ouverture de session |
| `trackCommand` → actions live, hors journal | `liveAction` appliquée avec `data.ratio`, hors journal | `liveAction` = forme courte d'un tracking qui applique une action |
| `endEmit` : event ordinaire à la fermeture | `leave` émis à la sortie | `leave` = fermeture par `endEmit` |
| `suspend` / `resume` / `cancelAll` aux frontières seek, reset, fin | callbacks ignorés au seek, rien hors `playing` | règles reprises du circuit, plus réimplémentées |

Ce qui dépasse la capture actuelle : `once` (une émission par vie du player),
`initial` (émission de la première phase, différée jusqu'à `playing`),
`liveAction` qui reçoit aussi le ratio de la première mesure hors zone, la
mutualisation des observers par racine et options (partie HTML de la source),
et la résolution du scrollport ancêtre par le graphe logique.

La spec actuelle dit qu'une transition `observe` n'entre pas dans le circuit
capture : à réviser selon la décision.

**Compatibilité** : le SceneDoc reste identique, mais la forme compilée
d'`observe` peut changer. Les paquets déjà exportés (SCORM, Sighty autonome)
portent l'ancienne `CompiledScene`.

**Réponse (2026-11-27)** : les paquets exportés embarquent leur propre version
de CodPlay ; prototypage, pas de conséquence réelle. C'est maintenant qu'il faut
consolider l'ensemble. La forme compilée peut donc changer.

## Cible consolidée (proposée)

1. `scroll-container` devient un type du cœur : il rend le scrollport à partir
   de `BaseHTMLComponent` et des services (`className`, `style`, `attr`), sans
   hériter de `TagComponent` ; il garde le retour de la position de défilement
   au reset (état de rendu).
2. La progression devient une source HTML du cœur, à côté de la source
   pointeur : elle écoute le scrollport et alimente le circuit de capture
   existant (`emit.scroll.capture`).
3. `observe` devient une source HTML du cœur sur le même circuit : `enter`
   ouvre, `leave` ferme par `endEmit`, `liveAction` est la forme courte d'un
   tracking ; `once`, `initial`, la mutualisation des observers et la recherche
   du scrollport ancêtre restent dans la source.
4. SceneDoc inchangé ; forme compilée libre ; identifiants `scroll-container`
   conservés.
5. component-v2 perd scroll-container ; Elcé, Sighty demo5 et les démos
   retirent l'enregistrement et l'adaptateur `htmlHost`. Les tests de
   component-v2 deviennent des tests de fonctionnalité du cœur.
6. Specs d'abord : scroll-container, capture, façade (`htmlHost`), puis code.

## Questions ouvertes

- Validation de la cible.
- **Branche (décidé 2026-11-27)** : l'utilisateur fusionne d'abord le travail
  de la branche `codplay` dans `develop` ; tout le chantier se poursuit ensuite
  sur `develop`. Ne rien commencer avant ce merge.
- Que reste-t-il au composant, une fois les sources sorties : un type dédié
  (marqueur de scrollport) ou un simple `tag` ?
- Le reset de la position de défilement : rendu, ou comportement de la source ?
