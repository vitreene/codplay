# Sighty — première implémentation par une composition simple

## Statut

Statut : En cours — cadrage de la première démo.  
Périmètre du scénario : demandé par l'auteur le 2026-09-10.  
Tranche de montage interscènes : En cours côté CodPlay ; raccord Sighty encore à engager.
Implémentation : non commencée.

Ce document décrit uniquement la démonstration Sighty. Il ne définit pas le
composant CodPlay d’hébergement : son contrat et ses phases sont suivis dans le
[plan du composant foreign CodPlay](../../codplay/plan/foreign-scene-component-plan.md).

## Sources à relire

- [Modèle déclaratif Sighty et premier cas concret](../notes/2026-08-17-modele-fichier-declaratif.md),
  notamment les §4, §8 et §9. Les formes proposées restent non normatives.
- [Composition et avancement](../notes/2026-08-01-composition-et-avancement-evenementiel.md).
- [Façade CodPlay](../../codplay/plan/facade-engine-instance-plan.md).
- [Mode hôte](../../codplay/plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md#5-le-mode-hôte--une-instance-jouée-dans-une-autre).
- [Composant core de contenu foreign](../../codplay/plan/foreign-scene-component-plan.md).
- [Ressources d'une occurrence de scène](../../codplay/plan/notes/2026-08-30-sighty-scene-resource-lifecycle.md).
- [État de référence CodPlay V2](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md).

## Résultat demandé

Préparer trois fichiers de scènes déclaratives, un pour A, un pour B et un pour
le layout, puis un fichier Sighty déclaratif qui les compose. Les fichiers
auteur ne contiennent aucune fonction de construction intermédiaire.

A porte l'image et le titre centré avec leurs apparitions successives en fondu.
B porte le pavé coloré et l'enchaînement de 1 à 10, chaque seconde. Le layout
porte le découpage visuel. Sighty monte et pilote des instances autonomes à
partir de la composition déclarée.

Le layout de cette première démo comporte exactement deux zones nommées `A` et
`B`, confirmées par l'auteur le 2026-09-10. La zone `A` reçoit une occurrence de
la scène A et la zone `B` une occurrence de la scène B.

## Étapes et gates

| Étape | Statut | Action et condition de passage |
| --- | --- | --- |
| 0. Reprise | Effectuée | Relire les quatre notes Sighty, identifier les contrats CodPlay concernés et confronter le montage prévu à la façade publique. |
| 1. Scénario précis | En cours | Le découpage A/B est fixé ; préciser encore les bornes des fondus, les changements de B et le maintien ou la sortie de chaque scène en fin de lecture. |
| 2. Montage interscènes | En cours côté core, intégration Sighty à engager | La première tranche du [plan du composant foreign CodPlay](../../codplay/plan/foreign-scene-component-plan.md) est autorisée et raccorde le profil `slot` ainsi que la surface HTML d'attachement. Le chemin Sighty entre deux instances, sa façade publique et son cycle de vie restent à arrêter avant la démo. |
| 3. Fichiers auteur | À engager après les décisions | Arrêter la représentation des ressources de scène et écrire les trois scènes et le fichier Sighty sans fonctions intermédiaires. |
| 4. Exécution Sighty | À engager après les décisions | Construire le chargement, la validation et l'entrée dans cette composition fixe ; utiliser la façade CodPlay et son preload. |
| 5. Accueil navigateur | À engager après les décisions | Raccorder un hôte de validation pour Sighty ; conserver dans le layout commun les services partagés si le parcours utilise `packages/demos/src/v2`. |
| 6. Validation et documentation | À effectuer | Exécuter le parcours réel, consigner les preuves et documenter uniquement les contrats effectivement acceptés et implémentés. |

## Dépendance au composant core

La capacité manquante est l'exposition d'une représentation foreign dans la
racine d'un composant de l'instance hôte. La façade actuelle requiert une racine
HTML ; elle ne propose pas encore l'association d'un contenu d'une autre
instance à ce composant. Le [plan du composant core de contenu foreign](../../codplay/plan/foreign-scene-component-plan.md)
décrit la tranche à relire et son adressage CodPlay. Le layout de la démo ne
définit pas cette capacité : il fournit seulement les deux zones structurelles
dans lesquelles les composants hôtes sont placés.

Avant de coder, arrêter :

1. La relation entre le nom de slot du fichier Sighty et la cible publiée par
   la scène layout, notamment sa portée lorsqu'une scène contient plusieurs
   persos layout.
2. La commande publique et son raccord au pipeline réel pour monter et
   démonter une scène enfant. Les noms d'API et d'events restent à décider ;
   aucune nouvelle syntaxe n'est créée par ce plan.
3. Le moment où la surface hôte est disponible, l'ordre de préparation du
   parent et des enfants, puis leur démarrage. La surface doit exposer les deux
   cibles `A` et `B` avant le montage des enfants.
4. L'identité d'une occurrence, les règles CSS que l'application auteur choisit
   éventuellement pour son hôte, les ressources qu'elle possède
   et l'ordre du démontage, y compris après un échec partiel.
5. Le comportement de la composition à la fin de A et B : une fin temporelle
   ne doit pas être assimilée implicitement à une demande de démontage.

La démo ne maintient pas une table locale des slots. Lors de la validation du
fichier Sighty, elle s'appuie sur le manifeste et les helpers d'authoring
`slotManifest`/`resolveSlotManifestEntry` définis
par le [plan du composant core de contenu foreign](../../codplay/plan/foreign-scene-component-plan.md) pour
obtenir les noms effectivement déclarés par `layout.scene`. Une faute sur `A`
ou `B`, un nom généré absent ou une collision doit remonter le diagnostic
explicite du core avec la portée et les noms disponibles ; la démo ne choisit
jamais un perso par approximation.

Le layout de la démo fournit le conteneur et les composants `slot` ; il ne reçoit
aucune politique CSS du core. L'application auteur de la démo choisit et
applique, dans ses composants auteur ou sa feuille de présentation, les règles
qui coordonnent ce conteneur, la racine `slot` et les racines des scènes enfants.
Les recommandations du plan core servent de points de vérification. La feuille
générée par `capsule-automation` est une option si elle répond au choix de
l'application ; un helper supplémentaire reste dans sa frontière d'authoring
ou de présentation, sans classe cachée dans le module de démo.

Cette tranche vise une composition fixe. Elle n'introduit pas de remplacement
animé entre scènes ; elle ne vaut pas validation de toute la capacité
`replace` du contenu foreign. Une éventuelle réduction de son contrat pour le montage
initial doit être explicitement acceptée, pas réalisée comme un contournement.

## Exemple commenté du cheminement vers le composant foreign

Cet exemple précise comment la composition de cette démo doit atteindre le
composant CodPlay. Les lignes marquées **à définir** ne sont pas des API
existantes ; elles rendent visible le raccord qui doit être arrêté à l'étape 2.

Le fichier Sighty décrit les trois scènes disponibles et les deux slots de la
vue principale :

Le modèle Sighty autorise deux formes de graphe. `ViewMap` (`start` et
`views`) sert lorsqu'un graphe possède plusieurs vues nommées, des actions ou
des transitions. `ViewList` sert lorsqu'il n'y a qu'une séquence déclarée. Ce
cas n'a qu'une vue fixe par slot ; il utilise donc la forme courte ci-dessous.

```ts
const sightyFile = {
  format: 'sighty',
  version: 1,
  id: 'demo-ab',

  // Sighty connaît les trois documents ; CodPlay les compile séparément.
  resources: {
    scenes: {
      layout: './layout.scene',
      sceneA: './scene-a.scene',
      sceneB: './scene-b.scene',
    },
  },

  // Une ViewList suffit ici : chaque slot ne contient qu'une vue fixe.
  views: [
    {
      view: {
        scene: 'layout', // scène hôte : elle déclare les deux composants slot
        slots: {
          A: [{ view: { scene: 'sceneA' } }],
          B: [{ view: { scene: 'sceneB' } }],
        },
      },
    },
  ],
}
```

Dans `layout.scene`, les hôtes sont des persos ordinaires de la story `layout`,
par exemple `host-a` et `host-b`, de type `slot`. Chacun porte dans la
propriété racine `name` le nom invariant du slot qu'il accueille :

```ts
const layoutHosts = [
  { id: 'host-a', name: 'A', type: 'slot' },
  { id: 'host-b', name: 'B', type: 'slot' },
]
```

La composition est valide seulement si cette correspondance est exacte : le
slot Sighty `A` doit trouver un composant `slot` dont `name` vaut `'A'`, et `B`
un composant dont `name` vaut `'B'`. La résolution rejette une clé sans
composant correspondant, un composant sans clé Sighty ou une correspondance
multiple ; elle ne déduit jamais le slot à partir de `perso.id`.

La résolution Sighty vérifie ces déclarations avant de conserver le lien entre
le nom de slot et l'adresse CodPlay complète :

```ts
const hostBindings = {
  A: { instanceId: 'layout-1', storyId: 'layout', persoId: 'host-a' },
  B: { instanceId: 'layout-1', storyId: 'layout', persoId: 'host-b' },
}
// État runtime de la composition ; ce n'est pas une identité DOM supplémentaire.
```

Le chemin d'exécution est le suivant :

```text
1. Sighty résout resources.scenes.layout et crée l'instance `layout-1`.
   La racine HTML fournie à cette instance est la racine d'application.

2. CodPlay compile puis matérialise `layout.scene`.
   `host-a` et `host-b` deviennent deux racines <div> de composants slot,
   adressables par { instanceId, storyId, persoId }.

3. Sighty lit la vue unique du slot `A`, résout `sceneA` et crée `scene-a-1`.
   Il lit la vue unique de `B` et crée `scene-b-1` selon le même chemin.

4. Sighty transmet au raccord `slot`/`foreign-content` une demande conceptuelle :
   { host: hostBindings.A, childInstanceId: 'scene-a-1' }.
   **À définir :** la surface CodPlay qui reçoit cette demande, résout la racine
   du perso `slot` et associe la représentation de l'enfant à cette racine.
   Sighty ne sélectionne pas le DOM.

5. La capacité/adaptateur `foreign-content` de `layout-1` monte la représentation de
   `scene-a-1` dans `host-a`. Le composant `slot` expose la boîte ; il ne
   connaît ni le player enfant ni sa timeline.

6. Sighty pilote `scene-a-1` et `scene-b-1` séparément. Leurs temps, seek,
   pause, ressources et teardown restent indépendants de `layout-1`.
```

Une commande destinée à une action déclarée par le perso hôte reprend la façade
CodPlay existante :

```ts
const hostCommand = {
  instanceId: 'layout-1',
  target: { scope: 'story', storyId: 'layout' },
  eventime: {
    name: 'show-a',       // eventime déclaré par la story layout
    data: { /* contenu ou commande validé par la capacité foreign */ },
  },
}

await codplay.events.emit(hostCommand)
// l'engine sélectionne layout-1 et la story layout ;
// le pipeline résout l'action ;
// ForeignContentComponent.update() reçoit l'état ;
// replace, s'il est déclaré, anime la racine de host-a.
```

Cette commande ne crée ni ne pilote `scene-a-1`. Sighty reste responsable de la
création, du rattachement et de la destruction des occurrences ; le composant
foreign reste responsable de l'exposition de sa racine. Lors d'un remplacement,
`replace` ne crée qu'un clone technique de la représentation sortante et jamais
une seconde instance CodPlay.

Le choix entre documents JSON et modules TypeScript exportant directement de
la donnée, leur résolution depuis `resources.scenes`, ainsi que le raccord à
l'hôte de validation seront arrêtés avant les étapes 3 à 5. Le contrat actuel
des démos V2 retourne une seule `SceneDoc` : une composition Sighty nécessite un
raccord explicite, sans fusion des scènes ni nouvelle page cachée dans un
module de démo.

## Invariants à préserver

- Les scènes restent autonomes ; A et B ne connaissent ni le layout ni Sighty.
- Le visuel et le temps des animations sont produits par CodPlay. Sighty
  n'ajoute ni horloge ni mise à jour impérative des nombres ou de l'opacité.
- La composition auteur nomme des ressources et des slots ; elle ne manipule
  pas de nœuds HTML.
- L'exécution utilise le catalogue, le preload, les instances et le circuit
  d'événements CodPlay existants.
- Une lacune de contrat est discutée avant son implémentation. Une lacune du
  runtime n'est pas remplacée par un mécanisme local à la démo.
- Les fonctions nécessaires à la bibliothèque ne doivent pas masquer la
  description des scènes ou de leur composition dans les fichiers auteur.

## Acceptation à prouver

- Compiler chaque scène séparément et la jouer seule, puis monter les mêmes
  documents dans la composition Sighty.
- Observer les deux fondus successifs de A par le player réel, aux bornes et
  pendant l'interpolation.
- Observer les dix nombres de B et les neuf changements espacés de 1 seconde ;
  vérifier les instants de part et d'autre de chaque changement.
- Vérifier le montage dans les zones `A` et `B`, la taille des enfants au resize
  et l'indépendance de leurs temps de lecture.
- Vérifier que chaque scène enfant s'adapte à la boîte de son hôte `slot` selon
  les règles CSS choisies par l'application auteur et les recommandations
  retenues, y compris les bornes de dimensionnement, le débordement et le
  contexte de taille lorsque celui-ci est requis. Cette vérification porte sur
  l'intégration de la démo, pas sur une politique CSS imposée au core.
- Vérifier avant le montage que le helper d'authoring expose les deux noms de
  slot déclarés et qu'une clé inconnue produit le warning d'authoring explicite
  du core, avec les noms disponibles ; aucun catalogue de slots propre à la
  démo n'est ajouté.
- Vérifier Play, pause/reprise, Seek local et replay par les surfaces publiques.
  Un seek d'une scène ne devient pas implicitement un seek de tout Sighty.
- Vérifier le montage, le démontage, le remontage, la libération des CSS et des
  ressources, et l'absence d'effet sur une occurrence sœur encore présente.
- Pour les frontières core modifiées, couvrir les régressions parent/enfant et
  les cas de reparent concernés. Toute catégorie non affectée doit être
  écartée par une analyse explicite.
- Exécuter les tests ciblés, typechecks et builds concernés, puis le parcours
  navigateur réel, dont Safari. Définir la vérification de persistance affectée
  par les faits de montage sans inventer une sauvegarde globale Sighty.

## Suivi de validation

Aucune scène ni exécution Sighty n'a été créée à ce stade. Aucun test runtime
ou navigateur n'a été exécuté. Le constat de montage absent est fondé sur la
lecture des contrats, des types publics et du composant layout ; il ne s'agit
pas d'une panne déjà reproduite dans une démo.

Après validation des décisions et implémentation, créer la spécification
ciblée des capacités réellement prises en charge et un guide utilisateur avec
un exemple concret. Conserver ici les limites de preuve et le suivi des étapes.
