# Analyse V2 — pont vers les projections tierces

> Statut : **En cours — tranche A validée, résolution runtime à relire**.
>
> Cette note analyse le besoin. Elle n'autorise aucune modification du core.

## 1. Objet

CodPlay doit pouvoir piloter des objets Three.js, Rive, Lottie ou TalkingHead
sans transformer ces bibliothèques en matérialiseurs globaux de l'instance.

Le modèle retenu est local au composant :

- l'instance conserve son matérialiseur HTML/DOM ;
- un perso hôte HTML crée un `canvas` ou un autre élément d'accueil ;
- cet hôte possède le contexte et le matérialiseur de la bibliothèque ;
- des persos spécialisés écrivent dans les cibles natives publiées par l'hôte
  ou par un autre perso spécialisé ;
- une relation immuable `rel.target` désigne la scène et éventuellement le
  perso fournisseur de cette cible.

Le premier chantier doit construire ce pont de manière générique. La grille
Three.js de la V1 sera sa première preuve, pas son architecture.

Cette évolution est structurante pour le core. Elle ne doit pas être réduite à
l'ajout d'un champ `rel` ou à une délégation ajoutée autour du matérialiseur
HTML. La phase d'élaboration doit pouvoir conclure qu'une partie des structures
actuelles doit être remplacée.

## 2. Références relues

### Contrats V2

- [matérialisation des composants](../component-render-representation-plan.md) ;
- [façade engine/instance](../facade-engine-instance-plan.md) ;
- [contrat de composant](./2026-08-01-composant-v2-contract.md) ;
- [projection tierce hébergée](../../projet/notes/2026-07-29-projection-substrat-de-rendu.md) ;
- [application à Three.js](../../projet/notes/2026-07-30-animejs-threejs-et-story-cible-rendu.md) ;
- [découpage engine/instances](./2026-07-28-decoupage-engine-instances-pilotage.md).

### Références V1 non normatives

- [runtime tiers V1](../../../../docs/formalisation/v1-third-party-runtime-spec.md) ;
- [démo mashup V1](../../../demos/src/v1/codplay/mashup-rive-three-quiz-demo.ts) ;
- [grille Three.js V1](../../../demos/src/v1/scenes/threejs-anime-grid-scene.ts) ;
- [composant Three.js V1](../../../authoring/components/threejs/src/threejs-base-component.ts) ;
- [composant avatar V1](../../../authoring/components/avatar3d/src/avatar3d-base-component.ts) ;
- [moteur avatar adapté de TalkingHead](../../../authoring/components/avatar-engine/src/avatar-engine.ts).

La V1 prouve les comportements et révèle les limites du composant monolithique.
Elle ne fixe pas la structure V2.

## 3. Décisions désormais établies

### Un seul matérialiseur global

La conception d'une instance entièrement projetée vers Canvas, Three.js ou
Flutter est abandonnée. L'hôte tiers est un composant HTML de la scène. Il
possède une projection interne et son matérialiseur spécialisé.

Le core ne sélectionne donc pas un `ThreeMaterializer` à la place du
matérialiseur HTML. Il coordonne un composant hôte qui, lui, sait réaliser ses
descendants dans Three.js.

### Bibliothèque déclarée à l'engine

L'unité optionnelle est déclarée à l'engine. Elle rassemble les composants,
services, modules, stratégie de preload et accès à la bibliothèque nécessaires.
La bibliothèque coûteuse est préparée avant les composants qui la réclament ;
elle n'est pas chargée dans un constructeur ou dans `update()`.

Les modèles, textures, fichiers Rive et compositions Lottie restent des
ressources de scène distinctes de la bibliothèque qui les interprète.

La première forme runtime de cette décision est maintenant fixée : une
`RuntimeLibraryDefinition` est enregistrée dans le catalogue de l'engine, un
composant déclare les IDs requis dans `libraries`, et le builder les recopie
dans `CompiledScene.requirements.libraries`. Si l'ID n'est pas déclaré à
l'engine, le build produit `AUTHOR_LIBRARY_UNKNOWN` comme warning non bloquant.
Ce warning n'est pas recalculé par le codec ou le player. Au runtime, la
préparation reste une précondition technique : `RuntimeEngine.prepareScene()`
déduplique le chargement et le runner ne monte pas un composant tiers dont la
bibliothèque n'est pas prête. Cette panne runtime n'est pas un warning auteur.
Le preload des modèles, textures et fichiers métier reste distinct ; la valeur
native de la bibliothèque demeure dans la closure du package d'intégration.

### `rel` est immuable

`rel` appartient aux données initiales du perso. Une action ne la modifie pas.
Sa cible commune reste simple :

```ts
type RelTarget = Readonly<{
  scene: string
  perso?: string
}>
```

`scene` identifie la scène. `perso` est omis pour viser la scène elle-même et
présent pour viser un perso de cette scène. Une intégration peut ajouter à
`rel` les conventions d'accès dont sa bibliothèque a besoin. Ses définitions
TypeScript et son validateur guident ces champs ; le core ne lit que `target`.

### Échec non bloquant d'une relation

La résolution de `rel` aide l'auteur sans l'empêcher de construire sa scène.
`SceneBuilder` vérifie les identités communes : la scène cible doit être la
scène compilée et le perso cible, s'il est indiqué, doit exister dans cette
scène. Une référence inconnue produit un warning auteur non bloquant et reste
silencieuse en diffusion.

Tant que la relation n'est pas résolue, le composant concerné ne reçoit aucun
handle et sa contribution est sans effet. Le core ne vérifie pas la
compatibilité native de la valeur opaque et ne construit pas de graphe
récursif : ces responsabilités restent dans l'intégration concernée.

Il faut distinguer ce défaut d'une cible valide simplement absente de la story
courante. Son identité reste connue : le consommateur attend son montage et
peut être réconcilié lorsqu'elle redevient disponible, sans warning d'auteur.

## 4. Conséquence structurante pour le core

Le runtime actuel repose sur une hypothèse cohérente avec la tranche HTML :
chaque perso est instancié avec le matérialiseur du player, immédiatement remis
à ce matérialiseur, puis mis à jour. Le catalogue sélectionne également les
services à partir de cette destination avant la construction du composant.

Un composant projeté ne peut pas emprunter ce parcours tel quel : sa destination
dépend d'une relation résolue et d'un hôte déjà préparé. Faire accepter ce
composant au matérialiseur HTML par un markup vide, un handle neutre ou une
branche propre à une bibliothèque masquerait la nouvelle responsabilité au
lieu de la modéliser.

Le chantier doit donc revoir ensemble :

- la représentation compilée des relations ;
- l'ordre de préparation des fournisseurs et des consommateurs ;
- le choix de la destination avant la création des services et l'application
  du composant ;
- le stockage player-local des cibles et de leur disponibilité ;
- le cycle de vie des composants qui ne produisent pas de DOM ;
- le commit commun de tous les consommateurs d'un même hôte.

Une frontière unique peut rester visible du player, mais elle doit coordonner
plusieurs destinations internes. « Un seul point d'entrée » ne signifie donc
pas « tous les composants sont matérialisés en HTML ».

La bonne architecture peut exiger une réécriture partielle de
`RuntimeComponentRuntime`, de la matérialisation ou du catalogue. L'objectif est
de conserver les invariants valides, pas la forme actuelle du code.

## 5. Modèle d'exécution

```text
engine
  -> unité tierce déclarée et bibliothèque disponible

matérialiseur HTML/DOM
  -> perso hôte
       -> élément HTML + contexte tiers + matérialiseur spécialisé
            -> perso objet
                 -> perso contrôleur
```

Exemple Three.js :

```text
three-scene-host
  -> camera
  -> light
  -> geometry
  -> avatar
       -> lipsync
       -> expression
       -> gesture
```

L'hôte publie la cible racine. Un objet peut à son tour publier une cible plus
spécifique. Le pont résout `rel`, ordonne fournisseur avant consommateur et
remet le handle natif au composant concerné.

## 6. Pourquoi plusieurs bibliothèques doivent précéder le modèle

Three.js ne suffit pas à définir le pont. Il favorise naturellement une scène
hiérarchique contenant des objets, alors que les autres cas déplacent les
frontières :

| Famille | Propriétaire principal | Consommateurs à éprouver | Risque de généralisation abusive |
| --- | --- | --- | --- |
| Three.js | première tranche : hôte, scène ou ressource préparée, séquence play/pause ; puis renderer et scène de la verticale V1 | caméra, objets, lumières, géométries | confondre relation et parentage d'`Object3D` |
| Rive | première tranche : hôte, ressource et artboard, séquence play/pause | plus tard : state machine, entrées, contributions, modèle V1 de lipsync par visèmes | supposer que chaque perso crée un objet autonome |
| Lottie | renderer et composition | première tranche : séquence play/pause ; plus tard : temps, segments, marqueurs ou éléments adressables | imposer une hiérarchie que la bibliothèque n'expose pas |
| avatar/TalkingHead | avatar placé dans une scène Three.js | lipsync, expression et geste | assimiler une contribution à une représentation |

### Premiers constats documentés

Les références disponibles donnent déjà des contraintes concrètes :

- Three.js, dans le composant V1 du dépôt, regroupe encore canvas, renderer,
  scène et caméra dans un composant autonome. Le futur modèle commence par un
  hôte minimal, comparable à un composant media, puis utilise la projection de
  [`mashup-rive-three-quiz-demo.ts`](../../../demos/src/v1/codplay/mashup-rive-three-quiz-demo.ts)
  comme verticale intermédiaire avant d'extraire les composants de feature ;
  `build()` et `simulate()` ne peuvent donc pas être repris tels quels comme
  contrat V2.
- Le runtime bas niveau Rive sait faire coexister plusieurs artboards,
  animations et state machines sur un même canvas. Son cycle distingue
  l'avancement des animations, l'application de leurs valeurs, l'avancement de
  l'artboard puis le dessin. Plusieurs animations peuvent contribuer à un même
  artboard avant ce dessin. Cela confirme la nécessité d'un hôte, d'un état de
  contribution et d'un commit séparé pour les extensions futures ; la première
  implémentation ne retient que l'hôte et play/pause.
- Lottie-web associe une instance d'animation à un conteneur et permet de
  choisir un renderer SVG, Canvas ou HTML. Son API expose à la fois un
  positionnement absolu (`goToAndStop`) et une vitesse (`setSpeed`), ainsi que
  la destruction de l'instance. Ces options éclairent la conception future,
  mais la première implémentation reste limitée à une séquence pilotée par
  play/pause. Le pont ne doit donc pas supposer que toute bibliothèque possède
  une hiérarchie d'objets native comparable à Three.js.
- TalkingHead/avatar-engine sépare déjà la gestion de la scène Three.js et la
  logique de l'avatar : le caller possède scène, caméra et renderer, tandis que
  l'avatar fournit un groupe et des contributions de morphs, gestes et os. Cela
  confirme le cas du perso contributeur sans représentation autonome.

Pour cette phase, un hôte Rive ou Lottie est comparable à un composant media
du point de vue auteur : une ressource préchargée, une séquence et les commandes
`play`/`pause`. Les options avancées restent dans une tranche ultérieure et ne
doivent pas imposer leur API dès maintenant.

Le même principe s'applique à l'hôte Three.js initial : scène ou ressource
préparée, séquence et `play`/`pause`. La verticale Three.js de la démo V1 vient
ensuite comme étape intermédiaire. Pour Rive, cette simplification ne fait pas
disparaître le cas avancé déjà disponible :
[`rive-coach-demo.ts`](../../../demos/src/v1/codplay/rive-coach-demo.ts) et
[`viseme-lipsync-service.ts`](../../../authoring/components/rive/src/services/viseme-lipsync-service.ts)
constituent le modèle de déploiement ultérieur d'un composant spécialisé qui
contribue à une state machine. Ils servent de cible d'architecture, pas de
contrat de l'hôte minimal.

Références de travail : [Rive — low-level API](https://rive.app/community/doc/low-level-api-usage/doctAfBY6v3P),
[lottie-web — API](https://github.com/airbnb/lottie-web/blob/master/README.md),
[lottie-web — options de chargement](https://github.com/airbnb/lottie-web/wiki/loadAnimation-options),
et les composants V1 cités en section 2.

La comparaison doit porter sur les conventions réelles d'accès, de temps, de
reset et de destruction. Elle doit décider ce qui appartient au core et ce qui
reste dans chaque intégration. Rive et Lottie ne sont donc pas de simples tests
de non-régression postérieurs à Three.js : ils participent au choix initial des
structures de données.

## 6 bis. Proposition Gate 2 — structures V2, tranche A validée

La direction générale de cette section est validée pour la tranche A. La
spécification de la relation est maintenant normative pour cette tranche ; la
résolution runtime et la matérialisation restent des propositions de travail.

### Donnée auteur et donnée compilée

La déclaration auteur reste simple :

```ts
initial: {
  rel: {
    target: {
      scene: '#scene-id',
      perso: '#perso-id',
    },
  },
}
```

`perso` est facultatif lorsqu'un composant vise la scène hôte elle-même. `rel`
est lu uniquement dans `initial`, validé au build et exclu des actions. Le
compiled scene conserve une forme structurée dérivée, sans handle natif :

```ts
type CompiledRel = CompiledRecord & Readonly<{
  target: Readonly<{
    scene: string
    perso?: string
  }>
}>
```

La relation est portée par `CompiledPerso.rel` et retirée de
`CompiledPerso.initial`. L'objectif est d'éviter de relire ou de réinterpréter
`initial.rel` pendant la présentation, sans introduire de type Three.js, Rive
ou Lottie dans `CompiledScene`.

### Deux responsabilités distinctes

`move` conserve le graphe de placement et les règles de montage HTML. `rel` ne
crée pas un second graphe : il fournit une identité compilée résolue par une
recherche directe dans le registre player-local. Les deux mécanismes restent
distincts et ne sont pas fusionnés dans un registre commun.

### Registre de cibles local au player

Le runtime possède un registre mutable par player. Une entrée associe une
identité compilée à une cible opaque publiée par son fournisseur. Le registre
doit pouvoir :

- publier la cible racine d'un hôte ;
- publier une cible secondaire lorsqu'un objet en fournit une ;
- rendre la cible indisponible au démontage ou à la destruction ;
- résoudre de nouveau une cible valide lorsqu'un fournisseur est remonté ;
- ne jamais partager une cible mutable entre deux players.

Le core ne connaît pas la forme de cette cible. Un composant consommateur reçoit
une cible résolue ou reste inactif si elle n'est pas disponible. La relation
`rel` ne change pas pour suivre les montages.

### Cycle de vie et matérialisation

Le runtime doit séparer deux choses aujourd'hui confondues dans
`RuntimeComponentRuntime` :

1. l'instance logique d'un composant et son cycle `create/update/destroy` ;
2. la représentation qu'elle possède éventuellement.

L'hôte HTML possède une racine DOM et son contexte tiers local. Il passe par le
matérialiseur HTML pour créer cette racine, puis publie sa cible native. Un
composant spécialisé qui écrit dans cette cible ne possède pas de racine HTML
et ne doit pas recevoir un markup vide ou un handle factice pour traverser ce
chemin.

La structure à choisir devra donc permettre au runtime de construire un
composant sans lui imposer une matérialisation HTML, tout en conservant le
cycle de destruction et les diagnostics par instance. Cette frontière est une
réécriture du contrat interne de montage, pas une branche Three.js dans le
matérialiseur HTML.

### Transaction de présentation

À une position `t`, le player doit suivre un seul parcours :

```text
état logique à t
  -> hôtes préparés
  -> cibles publiées ou indisponibles
  -> relations résolues
  -> consommateurs mis à jour
  -> commit de chaque hôte une seule fois
```

Le parcours est le même pour Play, pause, reprise, Seek, reset et destruction.
Les bibliothèques tierces n'ajoutent ni horloge ni RAF. Une contribution sans
cible est un no-op diagnostiqué dans le contexte auteur, silencieux en
diffusion.

### Unité de package

Une intégration doit fournir son unité complète depuis son package : types
TypeScript, validation, composant hôte, composants consommateurs, preload,
services et déclaration engine nécessaires. L'engine enregistre cette unité en
un seul raccord ; l'auteur du composant de feature ne réécrit ni registre, ni
résolution, ni initialisation de bibliothèque.

Les packages V1 existants restent des références de comportement. Ils ne sont
pas importés par les packages V2 et ne servent pas de second chemin runtime.

### Décisions restant à relire

- le nom et la forme du registre interne de cibles ;
- la forme exacte de la déclaration d'unité reçue par l'engine ;
- la frontière entre l'instance logique d'un consommateur et sa cible résolue ;
- la migration du `RuntimeComponentRuntime` et du `RuntimeMaterializer` HTML
  sans handle factice ni branche propre à une bibliothèque.

## 7. Répartition du code

Un perso reste principalement une donnée : état initial, actions et relations.

- Un strap transforme ou émet des données sérialisables. Il ne reçoit pas de
  handle natif et ne possède aucun cycle de vie de rendu.
- Un composant matérialise l'état résolu. Il peut créer un objet natif ou
  contribuer à un objet déjà existant.
- L'intégration de bibliothèque fournit le pont commun : typage et validation
  de `rel`, résolution des cibles, registre des handles, ordre de
  réconciliation et commit partagé.
- Le composant de feature se concentre sur son profil, ses actions et
  l'application de son état.

La quantité de code ne sépare pas straps et composants. La frontière est
l'accès à la matérialisation et à son cycle de vie.

## 8. Tension autour du perso contributeur

Une caméra ou une géométrie crée une représentation identifiable. `lipsync` est
différent : son composant peut seulement contribuer aux morphs d'un avatar.

Il reste provisoirement un perso parce qu'il possède des données, des actions et
un état temporel adressables. Cette décision n'établit pas qu'une contribution
sans représentation propre est définitivement une matérialisation de perso.

Le chantier devra observer si ce cas partage réellement le même cycle de vie et
les mêmes invariants que les autres persos. Si plusieurs contrôleurs révèlent
une frontière stable différente, une nouvelle primitive pourra être étudiée.

## 9. Ce qui doit rester opaque à l'auteur d'une feature

L'auteur d'un composant caméra, géométrie ou lipsync ne doit pas implémenter :

- le chargement de la bibliothèque ;
- la résolution de `rel` ;
- la recherche de l'hôte ;
- le registre `perso -> handle natif` ;
- le tri des dépendances ;
- la coordination Play/Seek ;
- le rendu final de la cible ;
- l'isolation entre players.

Une base ou une factory fournie par l'intégration doit absorber ce raccordement.
L'auteur de feature fournit seulement les données et les opérations propres à
sa capacité.

## 10. Propriétés et actions

Seul l'hôte HTML reçoit les services HTML qu'il déclare, par exemple `style` et
`attr`. Les composants Three.js reconnaissent un sous-ensemble explicite du
vocabulaire Three.js ; ils ne reçoivent pas une action HTML générique.

`rel` n'est pas une propriété animée. Elle est consommée lors de la préparation
structurelle et ne parvient pas comme propriété native à Three.js.

ACE peut résoudre les valeurs simples. Les moteurs natifs restent possibles
pour les clips, os, morphs ou visèmes, à condition de dépendre du temps CodPlay
et de préserver le résultat de `play(t) = seek(t)` pour les actions annoncées
comme reconstructibles.

## 11. Circuits V2 déjà utiles

Le runtime possède déjà plusieurs éléments à réemployer :

- le catalogue engine des composants, services, modules et stratégies de
  preload ;
- `BaseComponent`, qui ne dépend pas du DOM ;
- un mécanisme player-local permettant à une instance de composant de publier
  des opérations typées ;
- le graphe de placement résolu et son parcours parent avant enfant ;
- les modules instanciés par player et les frontières de présentation.

Le nom technique actuellement donné à ce mécanisme dans le runtime ne fait pas
partie du contrat du pont. L'auteur d'une intégration déclare une cible et son
composant reçoit une cible résolue ; il n'a pas à connaître le registre interne
qui réalise cette transmission. L'audit déterminera si le circuit existant peut
être réemployé ou doit être adapté, sans transformer son vocabulaire en API
auteur.

Ils forment la première tranche du pont demandé :

- `rel` est maintenant compilé séparément de `initial` et une définition de
  composant peut déclarer un `targetProvider` ;
- `RuntimeTargetRegistry` résout les identités `scene`/`perso` dans la portée
  d'un player, sans se confondre avec le catalogue des capacités, les surfaces
  de composants ou le registre de placement ;
- le runtime monte les instances avant d'activer les publications et de livrer
  les cibles aux consommateurs ;
- seuls les `BaseHTMLComponent` traversent le matérialiseur HTML ; un
  `BaseComponent` logique suit son propre cycle et peut libérer ses ressources
  dans `destroy()`.

Les diagnostics d'identité sont maintenant émis par `SceneBuilder`. Il n'y a
pas de graphe de dépendance `rel` dans le core : la relation est une recherche
directe. La présentation suit la frontière du player ; le commit natif et les
conventions de bibliothèque appartiennent à chaque intégration.

Le chantier doit déterminer lesquels de ces circuits restent adaptés et
lesquels doivent être remaniés. Il ne doit créer ni catalogue ni horloge
parallèle dans le package Three.js, mais cette interdiction ne justifie pas un
patch autour du parcours HTML.

## 12. Structures de données à étudier

Les rôles suivants sont désormais distingués et fixés pour la première
orchestration :

- `CompiledRel`, représentation compilée, immuable et sérialisable de `rel` ;
- `RuntimeTargetRegistry`, stockage runtime player-local associant une
  identité à une cible opaque et à son état de disponibilité ;
- le cycle de vie séparé entre instance de composant, représentation HTML
  éventuelle, montage de story et destruction finale ;
- la phase `initialize()` entre la matérialisation éventuelle et le premier
  `update()` pour préparer un contexte possédé par le composant ;
- la livraison d'une cible opaque par `ComponentUpdateInput.target` ;
- la validation auteur des identités communes, sans placer de données natives
  dans le `CompiledScene` ;
- la frontière de présentation du player, sans transaction native imposée par
  le core.

Cette liste exprime les informations nécessaires, pas une obligation de créer
autant de classes ou de registres. Les composants externes peuvent maintenant
être élaborés sur cette base sans rouvrir la séparation des responsabilités.

## 13. Première verticale

La grille Three.js V1 fournit le cas d'acceptation initial :

- un hôte HTML possède la scène et son matérialiseur ;
- un composant géométrie est relié à cette scène par un `rel` immuable ;
- `initial` décrit la grille ;
- les actions l'animent à partir du temps CodPlay ;
- le rendu survient après la réconciliation du sous-arbre ;
- Play, Seek, reset, resize, retour de story et destruction empruntent le vrai
  runtime.

La caméra et les lumières nécessaires à cette preuve sont des persos Three.js
distincts, reliés à l'hôte par `rel`. Elles ne sont pas absorbées par l'hôte et
ne sont pas montées par une solution cachée dans la démo.

## 14. Suite du chantier externe

- Les identités compilées sont résolues par `RuntimeTargetRegistry` à partir de
  `scene` et `perso` ; elles ne sont pas interprétées comme des sélecteurs DOM.
  Les diagnostics d'une identité inconnue sont ceux de `SceneBuilder` et ne
  sont pas rejoués par le player.
- Quelles données doivent être préparées au build, lesquelles appartiennent au
  player et lesquelles appartiennent exclusivement à l'hôte ?
- La frontière actuelle est établie : le `RuntimeComponentRuntime` envoie les
  `BaseHTMLComponent` au matérialiseur HTML et laisse les `BaseComponent`
  logiques hors de cette matérialisation. Il reste à valider les besoins de
  services propres aux intégrations.
- Quelle factory rend typage, validation et raccordement opaques
  à l'auteur d'une feature ?
- Les conventions de publication propres à chaque bibliothèque restent à
  préciser dans l'unité externe, le core conservant une valeur opaque.
- Comment un avatar compose-t-il plusieurs contributions concurrentes ?
- Quel critère ferait sortir un contrôleur contributeur de la notion de perso ?

Ces points concernent les unités Three.js, Rive, Lottie et avatar. Ils ne
rouvrent ni le matérialiseur global, ni l'immutabilité de `rel`, ni la
séparation des registres, ni le chargement des bibliothèques par l'engine.
