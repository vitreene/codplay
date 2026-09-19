# Note d'évolution V2 — composants de base et modules tiers

> Statut : **En cours — à reprendre et à valider**.
>
> Cette note prépare le prochain plan de travail. Elle n'est pas une
> spécification normative et n'autorise pas, à elle seule, une modification du
> core.

## 1. Périmètre de cette note

Avant de traiter Avatar, il faut fixer le fonctionnement général des
composants et des intégrations tierces :

- le rôle minimal d'un composant de base ;
- la différence entre un host matérialisé et un composant logique attaché à ce
  host ;
- la façon dont une bibliothèque tierce est déclarée, préparée et utilisée ;
- le cycle de vie, la mise à jour, le commit et la destruction ;
- la place des composants qui créent une représentation et de ceux qui la
  modifient.

La migration Avatar est explicitement hors périmètre. Elle fera l'objet d'un
plan séparé, fondé sur TalkingHead, puis soumis à validation avant toute
implémentation.

## 2. Références et constat actuel

[TalkingHead](https://github.com/met4citizen/TalkingHead) reste la référence
fonctionnelle du futur chantier Avatar. Son regroupement des accès au modèle,
du renderer et des contrôleurs ne doit pas être repris comme découpage V2.

Le socle V2 possède déjà des circuits à réutiliser :

- `BaseComponent` pour le cycle de vie indépendant du DOM ;
- `BaseHTMLComponent` pour le composant qui possède une représentation DOM ;
- le catalogue engine pour les définitions et les services ;
- la préparation des bibliothèques au niveau engine ;
- le preload des ressources au niveau player ;
- les actions et l'évaluation à partir du temps absolu CodPlay.

Le code actuel des relations et de la résolution runtime n'est pas migré vers
la forme `host` / `target`. Cette migration appartient à un plan accepté ; la
présente note fixe seulement la direction à examiner.

## 3. Modèle général à éprouver

```text
engine
  -> module tiers déclaré
  -> bibliothèque préparée

player
  -> ressource préchargée
  -> host HTML matérialisé
       -> contexte natif possédé par le host
       -> composants logiques attachés au host
       -> un commit natif final
```

Le host est le composant qui possède la représentation HTML et le contexte
natif de la bibliothèque. Il crée le renderer ou le contexte équivalent,
adapte sa taille, présente le résultat et libère ce qu'il possède.

Un composant logique :

- ne produit pas de markup DOM ;
- ne reçoit pas `move` ;
- est rattaché à un host par `rel` ;
- reçoit une cible native opaque lorsque le host ou un autre composant la
  publie ;
- applique les mises à jour de sa responsabilité et libère uniquement ses
  propres ressources.

La direction de relation à examiner est donc :

```ts
rel: {
  host: 'three-scene',
  target: 'grid',
}
```

`host` désigne le contexte de projection. `target` désigne une capacité
publique de ce contexte ou d'un composant qui lui est attaché. Il ne désigne
pas un mesh, un os, un morph target, ni un autre détail interne d'un modèle.
La relation entre une capacité comme `avatar1` et les éléments réels du
modèle appartient à l'intégration tierce et à ses données préparées ; CodPlay
n'a pas à garantir la présence de ces éléments.

## 4. Familles de composants de base

### Host

Le host porte les responsabilités communes de projection : représentation
DOM, contexte de bibliothèque, resize, commit final et destruction. Pour Three,
il est le seul composant de la famille à être matérialisé dans le DOM et le
seul à recevoir `move`.

### Objet ou ressource générique

Un composant générique peut charger ou afficher un objet préparé par une
bibliothèque. Il ne doit pas être confondu avec une application spécialisée.
Il peut publier une capacité adressable par des composants qui lui sont
attachés.

### Composant de feature

Un composant de feature modifie une représentation existante : caméra,
lumière, animation, couleur ou autre attribut relevant de sa responsabilité.
Il ne possède ni le host, ni le renderer, ni le modèle complet. Il ne résout
pas lui-même les nœuds internes ; il consomme la cible opaque qui lui est
fournie.

### Application spécialisée

Avatar sera une application avancée composée d'un core et de dépendances
spécialisées. Ce découpage, les accès TalkingHead, le lipsync, les gestes et
les expressions ne sont pas décidés par cette note. Ils seront traités dans un
plan Avatar distinct et validé.

## 5. Fonctionnement général d'un module tiers

Un module tiers doit rester une unité déclarée à l'engine. Il regroupe, selon
les besoins de la bibliothèque :

- les définitions et classes de composants ;
- les identifiants de bibliothèques nécessaires ;
- la préparation de la bibliothèque, une seule fois par engine ;
- le preload des ressources métier, au niveau player ;
- les services propres à l'intégration ;
- la publication éventuelle de cibles et le commit du host.

Le module ne crée pas de catalogue parallèle, de player parallèle, d'horloge
ou de boucle de rendu privée. Le host reste le point de commit de sa
projection. Les composants qui lui sont attachés écrivent leur état avant ce
commit.

L'accès à la bibliothèque doit passer par le contexte préparé déjà prévu par
le runtime et par la base du composant. Un helper qui ne ferait que récupérer
la même valeur ne constitue pas une abstraction utile : il ne doit pas devenir
un passage obligatoire ou une fabrique de classes. Les définitions doivent
rester directes et lisibles.

La séparation à conserver est :

```text
préparer la bibliothèque  -> engine
précharger le modèle      -> player / ressource
créer le composant        -> runtime du player
appliquer l'état          -> composant responsable
présenter                 -> host
libérer                   -> propriétaire de chaque ressource
```

## 6. Cycle de vie à vérifier

Le circuit suivant est une proposition de travail, pas encore un contrat
fermé :

1. l'engine enregistre et prépare les bibliothèques requises ;
2. le player précharge les ressources de scène ;
3. le host est matérialisé et initialise son contexte natif ;
4. les composants logiques sont initialisés avec leur contexte préparé ;
5. les cibles publiées deviennent disponibles pour leurs consommateurs ;
6. à chaque état CodPlay, les composants appliquent leurs changements ;
7. le host effectue un seul commit de présentation ;
8. un démontage, une indisponibilité ou une réapparition réconcilie les
   composants sans recréer inutilement le contexte ;
9. la destruction libère les ressources dans l'ordre de leur propriétaire.

Le cycle doit rester compatible avec `play`, `pause`, `seek`, reset, resize,
reprise et destruction. Aucune intégration ne lance un RAF ou une horloge
privée pour simuler le temps CodPlay.

## 7. Animation et API auteur

La scène fournit des instructions simples. Le composant traduit ces
instructions en opérations natives prévisibles dans son domaine. À terme, une
caméra doit donc savoir traiter ses positions, une lumière ses couleurs et sa
position, et un composant d'objet les attributs qu'il possède, sans demander à
la scène de construire les opérations natives à sa place.

Le circuit `TweenAction` actuel est une preuve de transport de l'état et du
temps, pas encore l'API auteur définitive des composants tiers. La forme
commune à retenir doit préserver :

- une évaluation à partir du temps absolu ;
- `play(t)` et `seek(t)` reconstructibles ;
- l'absence de mutation de `rel` par une action ;
- un ordre déterministe entre les contributions et le commit du host ;
- la possibilité pour plusieurs composants d'agir sur des cibles distinctes
  d'un même host.

## 8. Validation à maintenir légère

La validation vérifie la forme auteur et les références déclarées. Le runtime
du chemin chaud reçoit une scène compilée et n'a pas à refaire des contrôles
défensifs artificiels.

En particulier, CodPlay ne valide pas :

- la présence d'un nœud interne dans un modèle complexe ;
- la compatibilité d'une valeur native opaque avec une bibliothèque ;
- la structure interne d'un avatar, d'une composition ou d'un artboard ;
- la réussite d'une convention métier qui relève du module tiers.

Une cible déclarée peut être temporairement indisponible pendant un montage ou
un preload. Ce cas doit être distingué d'une relation auteur mal formée, sans
ajouter de validation dans chaque composant.

## 9. Parcours comparatif des modules

Avant de figer une primitive commune, le même parcours minimal doit être
décrit pour :

- Three.js : host, scène ou ressource, puis composants caméra/lumière/objet ;
- Rive : host, ressource, artboard et séquence simple ;
- Lottie : host, composition, renderer et temps de lecture ;
- une future intégration Avatar, uniquement comme contrainte à reporter dans
  son plan dédié.

Pour chaque famille, il faut comparer le propriétaire du contexte, le mode de
préchargement, l'application de l'état, le commit, le reset, le seek, la
destruction et la possibilité de contributions multiples. La comparaison ne
doit pas transformer une convention Three.js en règle du core.

### Résultat intermédiaire Rive

Le module Rive sépare le host matérialisé `rive` du composant logique
`rive-state-machine`. Ce dernier expose une capacité générique : appliquer des
valeurs nommées aux inputs de n’importe quelle state machine. Il ne connaît ni
lip-sync, ni visèmes, ni émotion.

Une application peut employer cette capacité pour un lip-sync, une expression
ou une autre animation. La conversion de ses données vers les noms et valeurs
du document Rive reste dans cette application et dans ses données préparées.
Les tests du composant utilisent leurs propres fixtures natives et ne prennent
pas les valeurs d'une démo comme oracle.

## 10. Points à décider avant tout code supplémentaire

- la forme finale et la portée exacte de `rel.host` et `rel.target` ;
- la migration du format actuel sans modifier le core opportunément ;
- la façon dont un composant publie une capacité publique ;
- la distinction entre host disponible et cible logique disponible ;
- l'API minimale commune (`initialize`, mise à jour, destruction, et
  éventuellement publication/commit) ;
- la séparation bibliothèque, ressource et service player-scoped ;
- la surface auteur des attributs et animations portés par chaque composant ;
- l'ordre de composition de plusieurs contributions ;
- les parcours minimaux Rive et Lottie qui valideront le caractère générique
  du modèle.

## 11. Suite prévue

1. relire et valider cette note d'évolution ;
2. transformer les décisions retenues en plan de migration des composants de
   base et des modules tiers ;
3. réaliser la validation réelle sur les hôtes Three.js, l’intégration Rive et
   l’hôte Lottie minimal ;
4. rédiger ensuite un plan Avatar séparé, incluant l'analyse détaillée de
   TalkingHead, puis le soumettre à validation avant toute migration.

Le mapping de visèmes appartient uniquement à l'application Rive qui connaît
son document. Aucune implémentation Avatar, geste ou expression ne doit être
engagée au titre de cette note.
