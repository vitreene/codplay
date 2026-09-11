# Rapport de reprise — première tranche de l'hôte foreign `slot`

**Statut : point de reprise après l'ouverture de l'implémentation core.**
**Date : 2026-09-11.**
**Branche observée : `codplay` (`cde576b`).**

Ce fichier est un état de reprise factuel. Le contrat reste dans la
[spécification ciblée](../specs/slot-component-spec.md), les actions et les
gates restent dans le [plan du composant foreign](./foreign-scene-component-plan.md),
et l'état général V2 reste dans la
[note de découverte](./notes/2026-08-26-decouverte-etat-codplay-v2.md). Ce rapport
ne crée pas de nouvelle API.

## État atteint

La première tranche autorisée est implémentée côté CodPlay core :

- le catalogue enregistre le type auteur `slot`, porté par
  `ForeignContentComponent` (`<div>` par défaut) ;
- `name` est une propriété racine obligatoire et immuable du perso `slot` ;
- `initial.content` est une référence foreign JSON-compatible conservée sans
  interprétation et sans passage par le service textuel de `TagComponent` ;
- le composant ne déclare que `className`, `style` et `attr` ; aucune règle CSS
  de remplissage, de ratio, de débordement ou d'alignement n'est fournie par le
  core ;
- `slotManifest` et `resolveSlotManifestEntry` découvrent les noms déclarés,
  leurs chemins et les diagnostics d'absence ou d'ambiguïté ;
- `HtmlComponentMaterializer` publie la surface interne `foreignContent` ; son
  `attach()` écrit réellement les racines dans le `hostRoot` par `appendChild`
  ou `insertBefore`, et `detach()` retire uniquement la relation qu'il possède ;
- la destruction et le démontage nettoient cette relation sans détruire le
  contenu ou l'instance qui l'a fourni.

Les changements se trouvent principalement dans :

- `packages/codplay/src/runtime/components/slot/` ;
- `packages/codplay/src/scene/authoring/` et la validation/compilation de scène ;
- le catalogue, les surfaces runtime, le materializer HTML et le runner ;
- `packages/codplay/specs/slot-component-spec.md` ;
- `packages/codplay/tests/runtime/components/slot-component.spec.ts` et
  `packages/codplay/tests/scene/authoring/slot-manifest.spec.ts`.

## Preuves exécutées

Depuis la racine du dépôt :

```text
npm test --workspace packages/codplay -- --run
  96 fichiers, 615 tests passés
npm run typecheck --workspace packages/codplay
  passé
npm run typecheck --workspace @codplay/demos
  passé
npm run build --workspace @codplay/demos
  passé (avertissement existant sur la taille de chunks Vite)
git diff --check
  passé
```

Le test ciblé du composant et du manifeste passe également : 2 fichiers,
6 tests.

## Ce qui reste ouvert

Ces capacités ne sont pas implémentées et ne doivent pas être simulées dans la
démo :

1. la transposition V2 du module partagé `replace`, ses hooks génériques, la
   capture de la représentation sortante et son clone temporaire ;
2. le contrat d'ownership et de disponibilité entre deux instances CodPlay,
   notamment la manière dont l'instance enfant expose ses racines sans que son
   materializer les reprenne ;
3. l'exposition de la surface d'attachement par une façade publique stable ;
4. l'orchestration Sighty (chargement, cycle de vie, adressage et destruction)
   et la première démo A/B déclarative.

Le plan Sighty correspondant est
[2026-09-10-premiere-implementation-plan.md](../../sighty/plan/2026-09-10-premiere-implementation-plan.md).
Il reste `En cours` et ne contient encore aucun fichier de scène exécuté.

## Reprise ordonnée

1. Relire `AGENTS.md`, la note de découverte V2, la spécification `slot` et le
   plan foreign avant toute nouvelle modification.
2. Arrêter dans le plan la surface publique entre instances et les règles
   d'ownership/lifecycle de l'enfant ; conserver `appendChild`/`insertBefore`
   dans la frontière materializer.
3. Arrêter puis implémenter le module `replace` partagé, avec une preuve sur
   `slot` et un composant core existant, avant de construire la composition
   Sighty.
4. Écrire ensuite les scènes A, B, le layout à deux zones et le fichier Sighty,
   entièrement déclaratifs, lorsque le raccord public est fixé.
5. Exécuter le parcours réel Play, Seek, resize, remount et destruction, puis
   les contrôles navigateur prévus par le plan.

Le principe de présentation consigné pour les composants core reste valable :
le core ne choisit pas le style ; une application auteur ou un composant auteur
peut porter cette opinion explicitement. Les clones de présentation, lorsqu'ils
seront implémentés par `replace`, resteront des copies temporaires d'effet et
ne deviendront jamais des persos ou des materialisations persistantes.

## Portabilité Git

Le rapport et les modifications décrites sont présents dans le worktree local.
Le worktree contient aussi des modifications documentaires antérieures visibles
dans `git status`; elles ne doivent pas être réinitialisées pour reprendre ce
chantier. Aucun commit ni push n'est effectué automatiquement par ce rapport.
Pour reprendre exactement cet état sur un autre appareil, il faudra conserver
ces fichiers dans un commit/push du dépôt, puis relire ce rapport depuis le
commit correspondant.
