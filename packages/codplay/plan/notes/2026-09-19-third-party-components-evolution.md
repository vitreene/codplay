# Note d'évolution V2 — composants de base et modules tiers

> Statut : **En cours — à reprendre et à valider**.
>
> Cette note prépare le prochain plan de travail. Elle n'est pas une
> spécification normative et n'autorise pas, à elle seule, une modification du
> core.

## 1. Périmètre de cette note

Avant de transposer Avatar, il faut conserver le fonctionnement général des
composants et des intégrations tierces :

- le rôle minimal d'un composant de base ;
- la différence entre un host matérialisé et un composant logique attaché à ce
  host ;
- la façon dont une bibliothèque tierce est déclarée, préparée et utilisée ;
- le cycle de vie, la mise à jour, le commit et la destruction ;
- la place des composants qui créent une représentation et de ceux qui la
  modifient.

La migration complète d'Avatar reste traitée par un plan séparé, fondé sur
TalkingHead. La première transposition V2 est maintenant engagée dans ce plan
dédié ; elle ne modifie pas le core CodPlay sans obstacle démontré et autorisé.

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

Le socle V2 utilise désormais la forme `host` / `target` pour les composants
qui publient ou consomment une capacité. La portée exacte de ces deux champs
est fixée à la section suivante ; les extensions propres à chaque module
restent dans leurs plans dédiés.

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

La forme retenue de la relation est donc :

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

La portée est fixée : `rel.host` contient l'identifiant du host de projection
et `rel.target`, lorsqu'il est présent, contient l'identifiant du composant qui
publie la capacité visée dans ce host. Pour Avatar, le core `avatar` vise le
host Three ; les composants `avatar-mood`, `avatar-lip-sync` et
`avatar-gesture` visent ce même host avec `target` égal à l'identifiant du
composant `avatar`. Aucun de ces composants ne reçoit `move`.

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

Avatar est une application avancée composée d'un core et de dépendances
spécialisées. Le core charge et initialise l'objet 3D conforme, puis publie une
capacité opaque. Les composants de geste, lip-sync et mood contribuent chacun
leur état ; un coordonnateur Avatar compose ces contributions et les applique
au modèle. La scène auteur ne construit pas ces opérations natives : elle
transmet les données et les événements.

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
- Avatar : host Three, composant central et contributions spécialisées, selon
  le [plan dédié](../2026-09-19-avatar-components-v2-plan.md).

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

## 10. Points encore ouverts avant tout code supplémentaire

- la migration du format actuel sans modifier le core opportunément ;
- l'API minimale commune (`initialize`, mise à jour, destruction, et
  éventuellement publication/commit) ;
- la séparation bibliothèque, ressource et service player-scoped ;
- la surface auteur des attributs et animations portés par chaque composant ;
- les parcours minimaux Rive et Lottie qui valideront le caractère générique
  du modèle.

La forme de `rel.host` et `rel.target`, ainsi que l'ordre de composition des
contributions Avatar, ne sont plus des points ouverts : ils sont appliqués par
le plan Avatar dédié.

## 11. Suite prévue

1. relire et valider cette note d'évolution ;
2. transformer les décisions retenues en plan de migration des composants de
   base et des modules tiers ;
3. réaliser la validation réelle sur les hôtes Three.js, l’intégration Rive et
   l’hôte Lottie minimal ;
4. poursuivre la transposition Avatar et sa validation dans le
   [plan dédié](../2026-09-19-avatar-components-v2-plan.md) ; la première
   démo V2 est désormais enregistrée sur le chemin réel.

Le mapping de visèmes appartient uniquement à l'application Rive qui connaît
son document. Aucune implémentation Avatar, geste ou expression ne doit être
engagée au titre de cette note.

## 12. Reprise Avatar — transposition TalkingHead

L'objectif de l'Avatar V2 est de transposer les comportements de TalkingHead,
pas de réutiliser son moteur monolithique ni son cycle temps-réel. TalkingHead
reste donc la référence fonctionnelle explicite ; les responsabilités doivent
être redistribuées entre le host Three, les composants Avatar et les services
déjà possédés par CodPlay.

La comparaison a mis en évidence le mécanisme déterminant qui manque encore :
TalkingHead possède une pose sémantique centrale, fait jouer le clip Three.js,
puis applique les deltas dans un ordre fixe. Son modèle évite qu'un geste, un
clip et une correction de regard reprennent successivement la même articulation
sans coordination. Son code ne peut toutefois pas être copié : il évolue avec
des deltas de frame, des minuteries et un état mutable, alors que CodPlay doit
pouvoir évaluer la même scène à une date absolue en lecture et en seek.

La transposition V2 à préparer est donc un composeur interne Avatar, et non un
nouveau composant auteur :

- les composants existants décrivent leurs contributions sémantiques à une
  date donnée (idle, geste, mood, regard et visèmes) ;
- le lecteur Three.js échantillonne le clip externe à cette même date ;
- le composeur calcule une unique pose squelettique finale, avec une règle
  séparée pour la translation racine ;
- une seule écriture finale atteint les os avant le commit du host Three.

Three.js reste la bibliothèque qui lit les clips et interpole les quaternions.
Ses cross-fades ne suffisent pas seuls ici : ils mélangent deux
`AnimationAction`, tandis qu'une pose Avatar sémantique n'est pas une action.
Le composeur ne remplace donc pas Three.js ; il définit l'ordre et la
propriété des couches Avatar autour de ses échantillons.

Cette tranche remplace les tentatives actuelles de relâchement local du clip.
Le défaut observé (cassure de pose, double geste et différence Play/Seek) est
structurel tant que `GestureEngine`, `AnimationMixer` et le lecteur de release
écrivent tous directement les mêmes os. La section correspondante du plan
Avatar reste `A relire` jusqu'à l'acceptation d'un plan détaillé ; cette note
n'autorise pas son implémentation.

### Ce qui reste à transposer ou à décider

Les capacités déjà engagées — chargement et retargeting du modèle, visèmes,
moods, gestes, idle, regard et animations externes — ne sont pas à remplacer.
Elles doivent passer par le composeur afin de devenir cohérentes. Il reste à
traiter, dans cet ordre :

1. la pose centrale et la composition déterministe clip / pose / release,
   incluant la conservation de la translation racine ;
2. la sémantique exacte de `rescale` du catalogue MotionEngine : elle répartit
   le temps supplémentaire d'un geste, elle n'est pas une intensité de morph ;
3. les tests de poses synthétiques et la validation intégrée réelle de la
   démo, notamment lecture, pause, seek, reprise et enchaînement de gestes.

TalkingHead contient aussi des capacités qui ne doivent pas être absorbées par
le composant Avatar central. Elles doivent être classées avant toute future
transposition :

- renderer, éclairage, vues de caméra et contrôles : responsabilités du host
  Three et des composants Three dédiés ;
- file de parole, TTS, décodage, audio streaming et sous-titres : données et
  composants audio/caption de scène ; Avatar reçoit les événements déjà
  temporisés, notamment les visèmes ;
- réaction du visage et de la tête au volume audio : future contribution
  Avatar, à condition qu'elle puisse être échantillonnée à temps absolu ;
- Dynamic Bones et le rééquilibrage physique : option liée au modèle, portée
  dans Avatar V2 par un simulateur interne à sortie additive pour le composeur.
  Les cinq modes TH, l'intégration velocity-Verlet, les forces parent/enfants,
  les offsets, pivots, limites et exclusions sont disponibles ; le scheduler
  CodPlay fournit le delta et `prepareSeek` réinitialise l'état de la
  simulation ;
- statistiques, callbacks de diagnostic et interface autonome TalkingHead :
  hors responsabilité Avatar ; le layout de démo et les outils CodPlay les
  remplacent lorsqu'ils sont utiles.

La transposition est donc complète dans son intention, mais elle ne signifie
pas importer chaque service de TalkingHead dans Avatar. Chaque comportement
est conservé lorsqu'il relève d'Avatar, puis placé à la frontière V2 qui en
possède déjà le contexte et le cycle de vie.

### Conditions de reprise

Avant le code du composeur, le plan détaillé devra fixer les couches, leur
ordre, le traitement des os non couverts par un clip, la propriété de la
translation racine et la conversion du catalogue MotionEngine. Son acceptation
devra prévoir des fixtures squelettiques autonomes qui comparent la pose à des
dates identiques en Play et en Seek, puis une validation navigateur réelle de
la scène Avatar. Les valeurs de la démo ne seront pas utilisées comme oracles
de test.
