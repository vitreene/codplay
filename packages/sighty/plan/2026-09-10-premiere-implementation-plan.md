# Sighty — première implémentation par une composition simple

## Statut

Statut : En cours — première fixture exécutable implémentée, validation en cours.
Périmètre du scénario : demandé par l'auteur le 2026-09-10.  
Tranche de montage interscènes : première surface publique CodPlay exercée par la fixture ;
les politiques complètes restent à valider.
Tranche de cycle de vie Sighty : première tranche autorisée le 2026-09-11 ;
la fixture exerce le montage, le démontage et le remontage explicites ;
affinage prévu à partir de cette preuve.
Implémentation : première tranche présente sous `packages/demos/src/sighty/demo1/` et
`packages/demos/sighty.html` ; validation navigateur et Safari encore ouvertes.

Ce document décrit uniquement la démonstration Sighty. Il ne définit pas le
composant CodPlay d’hébergement : son contrat et ses phases sont suivis dans le
[plan du composant foreign CodPlay](../../codplay/plan/foreign-scene-component-plan.md).
La description du scénario A/B est conservée dans la [note du modèle
déclaratif Sighty](../notes/2026-08-17-modele-fichier-declaratif.md) ; ce plan
en suit l'implémentation et la preuve d'intégration.

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

Le résultat demandé est une fixture de démonstration et d'intégration Sighty,
pas une spécification exhaustive du composant `slot`. Les besoins génériques
du composant restent dans les documents CodPlay référencés ci-dessus ; ce
document ne fait que préciser comment cette composition fixe les consomme.

Préparer trois fichiers de scènes déclaratives, un pour A, un pour B et un pour
le layout, puis un fichier Sighty déclaratif qui les compose. Les fichiers
auteur ne contiennent aucune fonction de construction intermédiaire.

A porte l'image et le titre centré avec leurs apparitions successives en fondu.
L'image reçoit aussi une animation déclarée de scale, de `1` à `1.2` sur dix
secondes, afin de rendre la lecture de l'animation visible dans la démo. B
porte le pavé coloré et l'enchaînement de 1 à 10, chaque seconde. Le layout
porte le découpage visuel. Sighty monte et pilote des instances autonomes à
partir de la composition déclarée.

Le layout de cette première démo comporte exactement deux zones nommées `A` et
`B`, confirmées par l'auteur le 2026-09-10. La zone `A` reçoit une occurrence de
la scène A et la zone `B` une occurrence de la scène B.

## Première tranche de cycle de vie Sighty

La décision de frontière est fixée : Sighty pilote le cycle de vie des
occurrences de scènes ; `slot` ne pilote pas les players qu'il héberge. La
première tranche est volontairement limitée à la composition fixe A/B et sert
de parcours réel pour faire émerger les détails à stabiliser ensuite.

Le parcours initial à exercer est le suivant :

1. Sighty résout, compile et précharge séparément le layout, A et B.
2. Sighty crée l'occurrence du layout et attend que ses deux hôtes `slot` soient
   disponibles via le raccord CodPlay prévu.
3. Sighty crée les occurrences A et B, demande leur montage dans les hôtes
   correspondants, puis les démarre séparément.
4. Sighty envoie les commandes de play, pause/reprise, seek et replay à chaque
   occurrence selon le scénario ; aucun de ces ordres ne traverse implicitement
   le composant hôte.
5. Lorsque la composition est retirée, Sighty demande explicitement le
   démontage puis la destruction des occurrences concernées. Le détachement de
   `slot` ne détruit pas à lui seul le player enfant.

Cette tranche n'institue pas encore une politique générale de remplacement, de
fin de lecture ou d'échec partiel. La démo vérifiera le chemin réel et permettra
d'affiner l'ordre des opérations, la conservation ou la destruction en fin de
scène, le remontage et la libération des ressources propres à chaque occurrence.
Les opérations de DOM de la composition restent dans CodPlay ; Sighty ne crée
ni racine enfant, ni envelope, ni wrapper de montage et ne déplace pas les
racines rendues. Sighty ne crée pas de circuit parallèle dans la démo.

## Étapes et gates

| Étape | Statut | Action et condition de passage |
| --- | --- | --- |
| 0. Reprise | Effectuée | Relire les quatre notes Sighty, identifier les contrats CodPlay concernés et confronter le montage prévu à la façade publique. |
| 1. Scénario précis | En cours | Le découpage A/B est fixé ; préciser encore les bornes des fondus, les changements de B et le maintien ou la sortie de chaque scène en fin de lecture. |
| 2. Montage interscènes | **Exercée dans la fixture** | `codplay.instances.mount({ host, childInstanceId })` adresse le `slot` et attache directement les racines matérialisées de l'enfant ; Sighty ne crée aucun DOM de scène. La responsabilité du cycle de vie est fixée côté Sighty ; le test de fixture vérifie l'ordre de création, le démontage et le remontage indépendant de A. Les erreurs partielles restent à compléter. |
| 3. Fichiers auteur | **Effectuée pour la première fixture** | Les scènes `layout`, A et B et le fichier Sighty sont séparés sous `packages/demos/src/sighty/demo1/`. Les documents sont des données directes ; aucune fonction de construction ne masque leur déclaration. |
| 4. Exécution Sighty | **Première exécution implémentée** | `SightyComposition` compile séparément les trois scènes, précharge leurs manifestes, crée trois instances sous un propriétaire CodPlay, résout les slots par le manifeste core et utilise la façade publique de montage. |
| 5. Accueil navigateur | **Fixture raccordée ; validation navigateur à effectuer** | `packages/demos/sighty.html` fournit l'hôte dédié. La feuille de présentation importe les contrôles partagés uniquement pour les télécommandes ; le layout de la démo et ses deux scènes occupent toute la hauteur de la zone de lecture. Le layout V2 commun mono-scène n'est pas modifié. |
| 6. Validation et documentation | **En cours** | Le test d'intégration de la fixture, les typechecks et le build constituent la première preuve. Il reste le parcours navigateur réel, Safari et l'affinage des politiques de fin, replay, resize et ressources. |

## Dépendance au composant core

La première capacité de montage est maintenant tentée par la façade :
`codplay.instances.mount({ host, childInstanceId })`. Elle reçoit l'adresse
logique du `slot` et l'identifiant de l'instance enfant ; CodPlay crée si besoin
un conteneur interne détaché, matérialise l'enfant et attache directement ses
racines de premier niveau dans l'hôte. Le layout de la démo ne définit pas cette
capacité : il fournit seulement les deux zones structurelles dans lesquelles
les composants hôtes sont placés.

La responsabilité du cycle de vie étant arrêtée côté Sighty, les points suivants
sont maintenant des choix de première tranche et des éléments d'affinage par la
démo, pas une raison pour transférer ce pilotage au composant `slot` :

1. La relation entre le nom de slot du fichier Sighty et la cible publiée par
   la scène layout, notamment sa portée lorsqu'une scène contient plusieurs
   persos layout.
2. Le raccord public `codplay.instances.mount` est exercé dans le cycle réel de
   la fixture : Sighty compile et crée le layout, crée A et B, résout les deux
   noms puis monte les enfants avant de les démarrer. Aucune commande de lecture
   ne traverse cette surface ; les diagnostics de montage partiel restent à
   compléter.
3. Le moment où la surface hôte est disponible et l'ordre de préparation du
   parent et des enfants sont maintenant matérialisés dans `SightyComposition`.
   La fixture vérifie que les deux cibles `A` et `B` existent avant le montage ;
   les politiques d'attente asynchrone restent ouvertes.
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

Le layout de la démo fournit le conteneur et les composants `slot`. Pour cette
fixture, le remplissage des racines de scène est projeté depuis un artefact
`capsule-automation` `sceneRoot:true`, puis publié par le canal de feuille de
style de la composition. Le layout conserve sa propre grille et ne reprend que
la règle de remplissage de la racine ; les classes de grille générées par
`capsule-automation` ne sont pas appliquées aux scènes.

Cette tranche vise une composition fixe. Elle n'introduit pas de remplacement
animé entre scènes ; elle ne vaut pas validation de toute la capacité
`replace` du contenu foreign. Une éventuelle réduction de son contrat pour le montage
initial doit être explicitement acceptée, pas réalisée comme un contournement.

## Exemple commenté du cheminement vers le composant foreign

Cet exemple précise comment la composition de cette démo atteint le composant
CodPlay. Le raccord `codplay.instances.mount` est exercé par la première
fixture ; les politiques encore ouvertes restent à valider et à affiner.

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
   La racine HTML fournie à cette instance est la racine d'application ; les
   instances enfants utilisent un conteneur interne CodPlay détaché.

2. CodPlay compile puis matérialise `layout.scene`.
   `host-a` et `host-b` deviennent deux racines <div> de composants slot,
   adressables par { instanceId, storyId, persoId }.

3. Sighty lit la vue unique du slot `A`, résout `sceneA` et crée `scene-a-1`.
   Il lit la vue unique de `B` et crée `scene-b-1` selon le même chemin.

4. Sighty transmet au raccord `slot`/`foreign-content` une demande conceptuelle :
   { host: hostBindings.A, childInstanceId: 'scene-a-1' }.
   `codplay.instances.mount` reçoit cette demande, résout la racine du perso
   `slot` et associe directement les racines matérialisées de l'enfant à cette
   racine. Sighty ne sélectionne pas le DOM, ne crée pas de wrapper et conserve
   seulement le handle pour demander le détachement.

5. Le raccord propriétaire `foreign-content` de `layout-1` monte la
   représentation de `scene-a-1` dans `host-a` via la surface du slot. Le
   composant `slot` expose la boîte ; il ne
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
`replace` ne crée qu'un instantané DOM technique et temporaire de la
représentation sortante, jamais une seconde instance CodPlay ; cet instantané
est géré par la présentation HTML et ne participe pas au cycle de vie Sighty.

Pour cette première fixture, les documents sont des modules TypeScript qui
exportent directement les données ; `resources.scenes` conserve leurs chemins
déclaratifs et `scene-resources.ts` les associe à leur chargement. L'hôte de
validation est `sighty.html`, une entrée distincte du layout V2 mono-scène. Le
contrat actuel des démos V2 retourne une seule `SceneDoc` : la composition
Sighty utilise donc un raccord explicite, sans fusion des scènes ni seconde
boucle CodPlay locale.

## Invariants à préserver

- Les scènes restent autonomes ; A et B ne connaissent ni le layout ni Sighty.
- Le visuel et le temps des animations sont produits par CodPlay. Sighty
  n'ajoute ni horloge ni mise à jour impérative des nombres ou de l'opacité.
- La composition auteur nomme des ressources et des slots ; elle ne crée ni ne
  manipule les nœuds HTML des scènes. Toute envelope ou racine enfant ajoutée
  par Sighty pour rendre le montage possible est interdite.
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
- Observer sur l'image de A le scale de `1` à `1.2` pendant dix secondes, au
  début, au milieu et à la fin de sa lecture.
- Observer les dix nombres de B et les neuf changements espacés de 1 seconde ;
  vérifier les instants de part et d'autre de chaque changement.
- Vérifier le montage dans les zones `A` et `B`, la hauteur complète du layout
  et de chaque scène, la taille des enfants au resize et l'indépendance de
  leurs temps de lecture.
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

La première fixture d'exécution Sighty est maintenant créée sous
`packages/demos/src/sighty/demo1/`, avec une entrée dédiée
`packages/demos/sighty.html`. `SightyComposition` utilise un seul propriétaire
CodPlay, compile et précharge séparément les trois scènes, puis monte A et B par
`view.slots` et `resolveSlotManifestEntry`, sans accès DOM dans le chemin de
composition. Ses contrôles de cycle de vie détachent et remontent A sans
perturber B.

La scène A déclare le scale de son image de `1` à `1.2` sur 10 secondes. Les
racines du layout, de A et de B utilisent l'artefact `sceneRoot:true` de
`capsule-automation` pour occuper toute la boîte de lecture ; sa seule règle de
remplissage est publiée par `SightyComposition` dans le canal CSS de la
composition. Le layout est une racine auteur unique, ce qui permet à sa chaîne
de hauteur de s'appliquer jusqu'aux deux zones `slot`.

Le test `tests/facade/sighty-demo.spec.ts` vérifie le chemin réel avec les trois
instances publiques, les deux hôtes et le remontage indépendant. Le test core
`tests/facade/foreign-mount.spec.ts` conserve la preuve ciblée avec deux vrais
players. Aucun navigateur Sighty n'a encore été exécuté ; le parcours visuel,
Safari, les bornes complètes de lecture, le resize et la politique de fin de
cycle restent ouverts.

La responsabilité Sighty du cycle de vie et le périmètre de la première tranche
A/B sont maintenant exercés par une première exécution réelle. Les choix
d'ordre, de fin de scène, de remontage et de teardown seront ajustés à partir
des prochaines preuves navigateur et des cas d'échec.

Après validation des décisions et implémentation, créer la spécification
ciblée des capacités réellement prises en charge et un guide utilisateur avec
un exemple concret. Conserver ici les limites de preuve et le suivi des étapes.
