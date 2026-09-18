# Portabilité — le portage comme contrainte de rédaction

Note de réflexion corrigée le 2026-09-18.

> **Correction.** Cette note proposait auparavant un `FlutterProjection` ou un
> autre substrat sélectionné à la place du DOM pour une instance entière. Cette
> conception est abandonnée. La portabilité reste une discipline du cœur et des
> données, pas la promesse d'un matérialiseur global interchangeable.

## Intention conservée

CodPlay sépare :

- les données auteur, le temps, les events et la résolution logique ;
- les composants qui réalisent cet état dans un environnement concret ;
- les intégrations optionnelles qui connectent une bibliothèque à ces
  composants.

Une plateforme différente demande nécessairement des composants adaptés. Un
`<video>` HTML et un lecteur Flutter ne sont pas interchangeables sans code de
plateforme. Cette limite est normale et doit rester visible.

## Discipline du cœur

La portabilité reste un critère de relecture utile : le cœur logique ne doit pas
lire `document`, `window` ou un objet Three.js pour décider de l'état d'une
scène. Il produit des données résolues ; la frontière de présentation les
applique.

Cette discipline interdit notamment :

- d'employer un nœud rendu comme source de vérité auteur ;
- de faire entrer un type de bibliothèque tierce dans le solveur ;
- de dépendre d'une horloge ou d'un cache de moteur graphique ;
- de confondre une valeur structurée avec sa représentation CSS ;
- de placer la logique d'une feature dans un raccourci propre à une démo.

La mesure réelle reste une entrée de présentation légitime lorsqu'elle est
nécessaire au mouvement, au hit-testing ou au resize. Elle ne reconstruit pas
l'intention auteur depuis le rendu.

## Modèle retenu pour les bibliothèques tierces

Le runtime public V2 conserve son matérialiseur HTML/DOM. Un composant hôte HTML
peut posséder une projection Three.js, Rive, Lottie ou Canvas et un
matérialiseur local. Des composants spécialisés y écrivent par un pont fourni
par l'intégration.

```text
cœur logique
  -> composant hôte HTML
       -> projection et matérialiseur de la bibliothèque
            -> composants spécialisés
```

La relation `rel`, initiale et immuable, désigne la scène ou le perso ciblé. Sa
forme TypeScript peut varier selon la bibliothèque ; l'intégration la normalise
vers une identité résoluble. Le cœur ne connaît ni la forme native de la cible,
ni les conventions d'accès de la bibliothèque.

Cette organisation ne prétend pas qu'un composant Three.js fonctionne sur
Flutter. Elle préserve en revanche la scène logique, les événements, les
straps, les profils de données et les règles temporelles qui ne dépendent pas de
la plateforme.

## Portage vers une autre plateforme

Un portage complet ne consiste plus à fournir une unique projection universelle.
Il demande :

- un hôte et une frontière de présentation adaptés à la plateforme ;
- des composants adaptés pour les médias et interactions propres à cette
  plateforme ;
- les intégrations des bibliothèques effectivement disponibles ;
- la conservation des contrats logiques qui restent pertinents.

La difficulté du portage mesure ainsi les fuites de plateforme dans le cœur,
sans imposer une abstraction artificielle à tous les composants.

## Typage

Les définitions TypeScript ont un rôle central : elles rendent explicites les
données portables et les données propres à une intégration. Pour les projections
tierces, elles guident notamment :

- le profil `initial` ;
- les actions ;
- la forme de `rel` ;
- les ressources exigées ;
- les cibles natives remises au composant de feature.

Le core consomme uniquement les résultats normalisés dont il a besoin. Il ne
généralise pas les types de toutes les bibliothèques.

## Statut

Décision corrigée : l'ancien matérialiseur global alternatif est abandonné. La
portabilité comme discipline de rédaction est conservée. Le pont des projections
tierces est suivi dans
[`../../plan/2026-09-18-third-party-render-target-codplay-plan.md`](../../plan/2026-09-18-third-party-render-target-codplay-plan.md).
