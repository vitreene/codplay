# Projection tierce hébergée par un composant

Note de réflexion corrigée le 2026-09-18.

> Statut : **orientation retenue, contrat à spécifier**.
>
> Cette note remplace l'ancienne hypothèse d'un substrat Canvas, Three.js ou
> Flutter sélectionné à la place du DOM pour toute une instance CodPlay. Cette
> hypothèse est abandonnée. La tranche publique V2 conserve un matérialiseur
> HTML/DOM unique.

## 1. Intention

CodPlay doit pouvoir piloter des objets qui ne sont pas des éléments HTML : une
scène Three.js, un avatar, une articulation de bouche, un artboard Rive ou une
composition Lottie.

La solution retenue ne consiste pas à donner un nouveau substrat global au
player. Elle consiste à placer dans la scène un **perso hôte HTML** qui :

- matérialise l'élément d'accueil, généralement un `canvas` ou un conteneur ;
- crée et possède le contexte de la bibliothèque tierce ;
- possède un matérialiseur adapté à cette bibliothèque ;
- publie la cible dans laquelle ses persos descendants seront réalisés ;
- présente une image lorsque tous ses descendants ont été réconciliés.

Les persos spécialisés sont ensuite des connecteurs entre l'état logique
CodPlay et les objets natifs de cette projection. Ils ne produisent pas de DOM.

```text
matérialiseur HTML/DOM de l'instance
  -> perso hôte Three.js
       -> canvas + renderer + scène + matérialiseur Three.js
            -> perso caméra
            -> perso lumière
            -> perso avatar
                 -> perso lipsync
```

Le même modèle doit pouvoir accueillir Rive et Lottie sans que le core connaisse
leurs types.

## 2. Décision abandonnée

Les formulations suivantes ne décrivent plus le projet :

- sélectionner `DomProjection`, `CanvasProjection` ou `FlutterProjection` pour
  une instance complète ;
- remplacer le matérialiseur HTML public par un matérialiseur Canvas ou
  Three.js ;
- faire de `set`, `measure` et `mount` une interface universelle qui rendrait
  tous les composants interchangeables entre les plateformes ;
- considérer le canvas comme une racine concurrente du DOM au niveau du
  player.

Le cœur logique reste indépendant du DOM autant que ses responsabilités le
permettent. Cette indépendance n'implique pas un choix public de matérialiseur
global. Les bibliothèques tierces sont hébergées par des composants et restent
locales à ces composants.

## 3. Une liaison déclarative distincte du placement

Le perso spécialisé doit désigner la scène ou le perso dont il consomme la
cible. Cette relation établit d'abord une **liaison** entre un consommateur et
un fournisseur ; elle ne décrit pas nécessairement un placement visuel.

`move` sait aujourd'hui désigner une cible et construire un parentage. Il peut
donc contribuer à certains cas, mais son emploi comme mécanisme général n'est
pas retenu à ce stade : déplacer un élément et relier un contrôleur à un objet
sont deux intentions différentes.

Exemples de relations :

```text
geometry --rel--> three-scene
avatar   --rel--> three-scene
lipsync  --rel--> avatar
```

`rel` nomme cette relation. Elle appartient à `initial` et reste immuable pendant
la vie du perso : une action ne peut ni la remplacer, ni la retargeter. Le
composant `geometry` ne lit pas cette déclaration. Le composant `lipsync` ne
recherche pas lui-même un avatar. Le pipeline CodPlay résout la liaison, puis le
pont de matérialisation remet à chaque composant sa cible native déjà résolue.

`rel` identifie la scène et, si nécessaire, le perso auquel le consommateur se
réfère. La forme commune reste volontairement simple :

```ts
type Rel = Readonly<{
  target: Readonly<{
    scene: string
    perso?: string
  }>
}>
```

`scene` désigne la scène ciblée. `perso` est omis lorsque la relation vise la
scène elle-même et présent lorsqu'elle vise un perso de cette scène.

Une intégration peut enrichir `rel` avec les conventions d'accès propres à sa
bibliothèque. Ses définitions TypeScript guident alors la déclaration et son
validateur contrôle les champs supplémentaires. Le core ne lit que `target` et
n'ajoute aucun identifiant abstrait de compatibilité.

Cette séparation permet deux usages avec le même champ :

- le perso hôte, qui est HTML, peut être placé dans un layout avec `move` et
  recevoir les services HTML tels que `style` et `attr` ;
- un perso spécialisé peut être lié à une cible native sans recevoir `style`,
  `attr` ou une API DOM ;
- lorsqu'une liaison implique aussi un parentage natif, le runtime réconcilie
  les deux intentions sans obliger l'auteur à les recoder dans le composant.

Le runtime doit produire une vue réconciliée des dépendances et des placements.
Il ne faut pas construire un registre de liaison parallèle dans le package
Three.js.

L'immutabilité simplifie cette réconciliation : la relation de dépendance est
établi lors de la préparation du perso et ne varie pas avec `t`. La disponibilité
de la cible peut varier avec le montage des stories ; son identité, elle, reste
fixe.

Une relation inconnue, incompatible ou cyclique ne doit pas empêcher l'auteur
de construire ou de lire sa scène. Elle produit un warning dans le contexte
auteur, mais reste silencieuse en diffusion. Le consommateur ne reçoit alors
aucune cible et sa contribution reste sans effet. Un fournisseur valide mais
temporairement non monté n'est pas une erreur : le consommateur attend qu'il
redevienne disponible et sera réconcilié à ce moment-là.

## 4. Réconciliation d'une hiérarchie mixte

Le graphe de scène doit être parcouru parent avant enfant.

1. Le matérialiseur HTML monte le perso hôte.
2. L'hôte crée son contexte et publie sa cible native.
3. Le pont résout la cible et, lorsqu'il existe, le parent natif de chaque
   descendant à partir des relations déjà résolues.
4. Le matérialiseur possédé par l'hôte crée, met à jour, déplace ou détruit les
   objets natifs.
5. Les contrôleurs spécialisés, comme `lipsync`, contribuent à la cible publiée
   par leur parent.
6. L'hôte présente une seule image après la réconciliation complète de son
   sous-arbre.

Un seek, un reset ou un retour de story doit parcourir cette même frontière. Il
ne doit ni relire l'objet natif comme source de vérité, ni dépendre du nombre de
frames déjà rendues.

## 5. Trois responsabilités distinctes

### Engine

L'engine déclare et rend disponible l'unité tierce : bibliothèque, composants,
services, modules et stratégie de preload associés. La bibliothèque n'est pas
chargée dans le constructeur ou dans `update()` d'un composant.

Les ressources de scène, comme un modèle GLB, une texture, un fichier `.riv` ou
un JSON Lottie, restent des ressources de preload. Elles sont distinctes de la
bibliothèque qui sait les interpréter.

### Hôte de projection

Le composant hôte possède :

- son élément HTML ;
- le contexte mutable de la bibliothèque ;
- son matérialiseur spécialisé ;
- les ressources natives partagées par son sous-arbre ;
- le commit de présentation et la destruction de ce qu'il a créé.

Deux hôtes dans un même player possèdent deux contextes distincts. Deux players
partageant un engine ne partagent pas une scène Three.js mutable.

### Composant spécialisé

Un composant spécialisé matérialise une seule responsabilité : caméra,
lumière, géométrie, avatar, lipsync, expression ou geste. Il reçoit les events
de ses actions comme tout autre perso, puis applique l'état résolu à la cible
native qui lui a été remise.

Il ne possède ni la recherche de cible, ni l'ordre du graphe, ni l'horloge, ni
le commit partagé du rendu.

## 6. Frontière provisoire entre perso, composant et strap

Un perso reste principalement une déclaration de données : profil initial,
actions et relations. Le code nécessaire à une feature se répartit selon sa
responsabilité :

- les straps transforment des données et produisent des events ou d'autres
  données sérialisables ;
- le composant matérialise l'état résolu dans le contexte de rendu qui lui est
  remis ;
- le perso relie ces déclarations sans contenir lui-même le code métier ou le
  code de connexion.

La quantité de code n'est donc pas le critère qui sépare un strap d'un
composant. Le critère actuel est la frontière de matérialisation : un strap ne
reçoit pas de handle natif et ne possède aucun cycle de vie de rendu ; un
composant peut appliquer une contribution à une cible native.

Le cas `lipsync` met toutefois cette définition sous tension. Il ne crée pas
nécessairement une représentation autonome : il contribue à la matérialisation
d'un avatar existant. Le conserver comme perso est une décision provisoire,
faute d'un concept plus juste, justifiée par le fait qu'il possède des données,
des actions et un état temporel adressables comme ceux des autres persos.

Cette convention ne ferme pas le modèle. Si les contrôleurs sans
matérialisation propre se multiplient et réclament un cycle ou des invariants
différents, ils pourront faire émerger une nouvelle primitive. Le premier
chantier doit relever cette distinction au lieu de redéfinir implicitement la
notion de perso autour du seul cas `lipsync`.

## 7. Connexion opaque pour l'auteur de composants

Le raccordement doit être implémenté une fois dans le pont générique et dans le
package d'intégration de la bibliothèque.

L'auteur d'une feature doit seulement définir :

- le profil de données qu'elle accepte ;
- ses actions ;
- la création de sa représentation native ;
- l'application d'un état résolu ;
- la libération des ressources qu'elle possède.

Il ne doit pas écrire à nouveau :

- la résolution des liaisons ou de `move` ;
- un registre `perso -> objet natif` ;
- le tri parent/enfant ;
- la détection du composant hôte ;
- l'ordonnancement Play/Seek ;
- le chargement de la bibliothèque ;
- l'appel final au renderer.

Une base ou une factory spécialisée peut masquer ces opérations. Sa forme
publique reste à spécifier, mais cette opacité est un critère d'acceptation du
premier chantier, pas une optimisation ultérieure.

## 8. Composants ciblant d'autres composants

Le cas `scene -> avatar -> lipsync` montre que la cible n'est pas toujours le
conteneur visuel direct de la bibliothèque.

- `avatar` est réalisé dans la scène Three.js et publie le handle nécessaire à
  ses contrôleurs ;
- `lipsync` cible l'avatar et contribue seulement aux canaux de bouche ;
- une expression ou un geste peut cibler le même avatar avec une autre
  responsabilité.

Le pont doit donc savoir transmettre la cible publiée par un parent projeté,
pas uniquement la racine publiée par l'hôte HTML. La composition des
contributions concurrentes appartient à l'intégration de l'avatar ; l'ordre
d'itération des composants ne doit pas décider silencieusement du résultat.

## 9. Vocabulaire des propriétés

Le perso hôte est un composant HTML. Il peut recevoir les propriétés communes
de placement et les services HTML déclarés par son type.

Les composants projetés ne connaissent qu'un sous-ensemble explicite des
propriétés de leur bibliothèque. Un composant Three.js peut par exemple
accepter `position`, `rotation`, `scale`, `color` ou `intensity`, selon son
profil. Il ne reçoit pas automatiquement les propriétés HTML et n'accepte pas
un chemin natif arbitraire.

Les déclarations structurelles et de liaison restent à part : elles sont
traitées avant le composant et ne deviennent pas des propriétés appliquées à
l'objet Three.js.

## 10. Premier chantier

Le premier parcours vertical reprend la grille Three.js de la démo V1 :

- un perso hôte crée le canvas, le renderer et la scène ;
- un perso géométrie crée la grille de pavés dans la cible remise par le pont ;
- `initial` décrit la géométrie ;
- les actions pilotent son animation ;
- Play, Seek, reset, resize et destruction empruntent le vrai runtime V2 ;
- le renderer n'est appelé qu'après la mise à jour de tout le sous-arbre.

Cette preuve doit d'abord valider le pont générique. Elle ne doit pas cacher un
manque du runtime dans un registre ou un callback propre à la démo.

## 11. Questions encore ouvertes

Les points suivants doivent être fixés dans la spécification avant le code :

- la forme générique d'une cible native publiée par un hôte ou un objet ;
- la résolution exacte de `rel.target` et sa relation avec le graphe de `move` ;
- le critère qui confirmerait qu'un contrôleur contributeur reste un perso ou
  justifierait une nouvelle primitive ;
- les hooks minimaux de création, mise à jour, déplacement et destruction ;
- la règle de reparentage entre deux hôtes de bibliothèques différentes ;
- la composition de plusieurs contrôleurs visant le même avatar ;
- le raccord exact entre l'unité tierce déclarée à l'engine et le chargement de
  sa bibliothèque.

Ces questions portent sur le pont. Elles ne rouvrent pas l'ancien choix d'un
matérialiseur global alternatif au DOM.
