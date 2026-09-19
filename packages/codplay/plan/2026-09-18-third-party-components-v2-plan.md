# Plan V2 — composants tiers et composants de base

> Statut : **En cours**.
>
> Ce plan porte sur les composants externes de
> `packages/authoring/component-v2/`. Il dépend du
> [plan du pont CodPlay](./2026-09-18-third-party-render-target-codplay-plan.md).
>
> Cette tranche commence par les composants de base et les modules tiers
> minimaux. La migration Avatar est hors périmètre et fera l'objet d'un plan
> séparé, à valider avant implémentation.

## 1. Objectif

Créer d'abord des hôtes Three.js, Rive et Lottie minimaux, composables et
comparables à un composant media du point de vue auteur. Une verticale Three.js
intermédiaire reprend ensuite la projection de la démo V1 citée, avant les
composants de feature plus riches. Cette tranche doit d'abord établir les
primitives communes ; elle ne construit pas encore Avatar.

TalkingHead est la référence fonctionnelle amont. L'adaptation V1 est une
transposition contrainte par CodPlay et ne fixe pas la structure V2. Le mode
`avatarOnly` de TalkingHead confirme le cas d'un avatar fourni à une scène et
une caméra externes ; V2 doit conserver cette séparation tout en répartissant
l'API auteur entre le core Avatar et ses composants spécialisés.

Three.js est la première preuve, mais son hôte initial reste volontairement
simple. Le pont reste conçu pour permettre ensuite les intégrations Rive et
Lottie selon leurs propres conventions. Leurs besoins ne sont toutefois pas
étudiés après coup : ils participent à la Gate 0 comparative du plan core avant
le choix des structures de données.

## 2. Gates

L'implémentation attend :

1. la validation de l'analyse du 18 septembre ;
2. la validation de la comparaison Three.js, Rive et Lottie de la Gate 0 du
   plan CodPlay ; les contraintes TalkingHead seront reprises dans le plan
   Avatar séparé ;
3. l'audit des circuits existants demandé par la Gate 1 ;
4. la validation des structures du core et de leur migration demandée par la
   Gate 2 ;
5. l'accord explicite pour les changements de core ;
6. le choix de la granularité des packages ;
7. la décision concernant caméra et lumières dans la première verticale.

La décision de la première verticale est prise : la caméra et les lumières sont
des persos Three.js distincts, reliés au host par `rel`. L'hôte reste
responsable du renderer, de la scène de projection et du rendu final ; il ne
absorbe pas les responsabilités de ces persos.

Un manque générique retourne dans le plan CodPlay. La démo ne crée ni registre,
ni preload, ni horloge, ni circuit d'events alternatif.

## 3. Contraintes communes

- Aucun import du runtime V1.
- Aucun type Three.js dans le core.
- Aucun RAF ou timer de simulation privé.
- Aucun chargement de bibliothèque ou de ressource dans le constructeur ou
  `update()`.
- Les définitions de composants référencent directement des classes ; aucune
  factory ne fabrique une classe pour fermer une dépendance runtime.
- L'engine prépare les bibliothèques et injecte leurs valeurs opaques dans le
  contexte de construction des classes. Cette injection est distincte de
  l'injection player-local de `rel` vers `ComponentUpdateInput.target`.
- La préparation du contexte possédé par un composant passe par sa phase
  `initialize()`, appelée après la matérialisation éventuelle et avant le
  premier `update()` ; elle ne lance aucun chargement.
- `rel` appartient à `initial` et reste immuable.
- La relation commune suit `{ host, target? }` : `host` désigne le host de
  projection et `target` désigne, lorsqu'il est présent, une cible publiée par
  ce host ou par un composant qui lui est attaché.
- Seul le host Three matérialisé reçoit `move`. Les composants Three logiques
  sont rattachés par `rel` et ne sont pas placés dans le DOM.
- Les composants de feature ne résolvent pas eux-mêmes leur cible.
- Un composant projeté ne produit aucun markup factice pour franchir le chemin
  HTML.
- Une identité de relation inconnue laisse le composant sans cible, produit un
  warning auteur non bloquant au build et reste silencieuse en diffusion. Le
  core ne vérifie ni la compatibilité native ni les cycles internes d'une
  bibliothèque.
- Une cible valide mais temporairement non montée est attendue sans warning.
- `initial` décrit les paramètres stables ; les actions décrivent les états
  pilotés par les events.
- Chaque composant libère uniquement les ressources qu'il possède.
- Les exemples passent par le vrai runtime V2.

## 4. Tranche 1 — unité d'intégration Three.js

Créer l'unité enregistrée auprès de l'engine. Elle regroupe :

- l'accès préparé à Three.js ;
- le composant hôte HTML ;
- le matérialiseur Three.js possédé par cet hôte ;
- les types et validateurs de `rel.host` et `rel.target` ;
- le contexte runtime injecté aux classes de composants ;
- les services, modules et stratégies de preload nécessaires.

Cette unité masque la connexion. Un nouveau composant Three.js ne doit pas
réimplémenter la résolution de cible, le registre des handles ou le rendu.

Cette première tranche ne déploie pas encore les features Three.js demandées.
Elle prépare seulement l'hôte minimal et son cycle de lecture, comparable à un
composant media : une ressource ou une scène préparée, un contexte de rendu,
une séquence et les commandes `play` et `pause` pilotées par CodPlay.

### État au 18 septembre 2026

`@codplay/component-v2` fournit maintenant la déclaration engine générique de
Three.js, ses classes de core et la déclaration spécialisée séparée de la
grille procédurale.
Le test d'intégration prépare désormais Three.js par `RuntimeEngine` et
vérifie que la classe spécialisée reçoit le runtime par le contexte injecté ;
il ne fabrique plus ce contexte dans le test.
Le calcul à partir du temps absolu et le commit final de l'hôte sont couverts
par des tests déterministes. Le chemin réel de la démo V2 a été exercé dans
Safari pour la préparation de la bibliothèque, Play/pause, Seek arrière/reprise
et resize. La validation du cycle complet de destruction reste ouverte.

### Acceptation

- L'enregistrement est effectué une fois par engine.
- Une instance sans composant Three.js ne paie pas son coût.
- Deux players ne partagent ni renderer, ni scène, ni registre mutable.
- Les types de relation guident l'auteur sans élargir le core à Three.js.
- L'hôte minimal peut être lancé, mis en pause et repris sans créer de
  géométrie de feature.

Les types, les classes, la préparation de bibliothèque et l'isolation des
géométries sont couverts par les tests du package. L'acceptation navigateur et
la commande publique complète restent à exécuter.

## 5. Tranche 2 — hôte de scène Three.js minimal

Le composant hôte :

- matérialise le canvas dans le DOM ;
- crée le renderer et la scène après disponibilité de la bibliothèque ;
- adapte viewport et pixel ratio à sa boîte ;
- possède son matérialiseur Three.js ;
- publie la cible racine ;
- présente une seule image à la fin de la transaction ;
- détruit le contexte et les ressources qu'il possède.

Il accepte les capacités HTML déclarées par son profil. Il n'interprète pas les
actions de la géométrie ou de l'avatar.

La scène et le renderer sont ici le support de la séquence de lecture. La
caméra, les lumières, les objets et les animations spécialisées sont réservés
à la verticale intermédiaire puis aux tranches de feature ; ils ne gonflent pas
le contrat initial de l'hôte.

Le host est le seul composant Three matérialisé dans le DOM et le seul à
recevoir `move`. Une caméra, une lumière, une géométrie ou un avatar sont
attachés au host par `rel`; leur montage Three.js n'est pas un montage DOM.

### Acceptation

- Deux hôtes dans un player sont isolés.
- Le resize ne recrée pas la scène.
- Le démontage libère chaque ressource une seule fois.
- Aucune frame n'est produite hors du commit CodPlay.
- `play` et `pause` suffisent au contrôle auteur de cette première version.

## 6. Tranche 3 — préparation de la verticale Three.js intermédiaire

Cette tranche ne constitue pas encore l'ensemble des features Three.js. Elle
fournit uniquement la caméra, la lumière et la géométrie nécessaires à la
projection de la démo V1 citée à la tranche suivante. La décision sur caméra et
lumières est fixée : elles sont des persos dès cette verticale. Aucun montage
caché dans la démo n'est accepté.

Le composant géométrie :

- porte une relation Three.js immuable vers le host ;
- crée la géométrie, le matériau et l'`InstancedMesh` de la grille ;
- expose les dimensions, le nombre de pavés, l'espacement, l'amplitude et la loi
  de décalage comme données validées ;
- applique les actions à partir du temps CodPlay ;
- dispose les ressources qu'il possède.

La référence visuelle et mathématique est
[`threejs-anime-grid-scene.ts`](../../demos/src/v1/scenes/threejs-anime-grid-scene.ts).
Les fonctions V1 `build` et `simulate` ne deviennent pas une API V2.

### Acceptation

- La grille correspond à la référence V1.
- `play(t)` et `seek(t)` donnent les mêmes matrices.
- Reset et replay repartent de l'état initial.
- Deux géométries peuvent viser le même hôte avec un seul rendu.
- Un retour de story ne produit aucun objet dupliqué.

## 7. Tranche 4 — verticale intermédiaire : démo V1 portée en V2

Créer une nouvelle démo V2 à partir de la projection Three.js de
[`mashup-rive-three-quiz-demo.ts`](../../demos/src/v1/codplay/mashup-rive-three-quiz-demo.ts),
sans reprendre son runtime. Cette démo est l'intermédiaire entre l'hôte
Three.js minimal et les composants de feature plus avancés : elle vérifie que
le pont réel permet à un perso géométrie d'écrire dans la scène hôte et qu'un
rendu unique clôt la transaction.

La première acceptation isole Three.js :

1. hôte et géométrie sont des persos distincts ;
2. `rel.host` relie la géométrie au host ;
3. les events déclenchent les actions de la grille ;
4. la télécommande V2 pilote Play, pause et Seek ;
5. le preload bloque le lancement jusqu'à disponibilité des dépendances ;
6. la scène n'est rendue qu'après la mise à jour de ses consommateurs.

Rive et le quiz peuvent être réintroduits ensuite pour vérifier la coexistence
des intégrations dans une même instance.

### État de validation — caméra et couleurs

La démo `threejs-grid` exerce maintenant le chemin des `TweenAction` jusqu'aux
composants Three.js : la caméra recule puis avance sur une durée distincte des
rotations de la grille, la lumière ponctuelle reçoit une position et une
couleur variables, et les deux lumières changent de couleur. Le test de démo
vérifie les deux phases de la caméra ; le
test d'intégration du package vérifie l'application de ces états aux objets
Three.js natifs. Le contrôle visuel navigateur de ce nouveau scénario reste à
faire ; le typecheck et le build Vite passent.

### Orientation de conception à préserver

Le `TweenAction` utilisé par cette preuve reste le circuit logique valide de la
tranche actuelle, mais ne constitue pas encore la surface auteur finale des
composants Three.js. Les composants devront progressivement porter les
opérations courantes de leur responsabilité — déplacement, couleur et autres
attributs — afin que la scène n'ait pas à construire elle-même ces opérations.
La forme de cette capacité et de son animation reste à définir après
l'inventaire détaillé des besoins ; aucune API supplémentaire n'est introduite
dans cette tranche.

## 8. Tranche 5 — hôte Rive composé et hôte Lottie simple

Après la première verticale Three.js, créer une implémentation initiale pour
chacune de ces bibliothèques. Le host Rive reste comparable à un composant
media du point de vue auteur :

- une ressource préchargée ;
- un hôte HTML possédant le contexte et le renderer de la bibliothèque ;
- une séquence unique ;
- les commandes `play` et `pause` pilotées par CodPlay.

L'API du host reste limitée à `START`, `PAUSE` et `STOP`. Le module Rive ajoute
toutefois le composant logique `rive-state-machine`, relié au host par `rel`.
Le composant state machine possède l'instance native et applique des valeurs
nommées à ses inputs ; il ne connaît ni visèmes, ni lip-sync, ne reçoit pas
`move` et ne matérialise pas de DOM.

Lottie reste limitée à son host simple dans cette tranche : ses segments,
marqueurs, layers et cibles internes restent hors périmètre. Un concept propre
à Rive ou Lottie reste dans son package et ne conduit pas à un second circuit
dans le core.

### État Rive — port V1 dans V2

`@codplay/component-v2` fournit maintenant le composant `rive`, le composant
logique `rive-state-machine`, leur bibliothèque engine et la stratégie de
preload. Le host possède le document, l’artboard et le commit ; la state
machine reçoit la cible publiée par le host et pilote ses inputs sans produire
de DOM. La démo V2 `rive` reprend le document `/avatars/coach.riv`, l’audio V1,
les cues Rhubarb traduits lors de la construction des eventimes, la caption et
la séquence de 18,5 secondes.

La relation interne entre l’avatar et ses inputs reste une convention de la
ressource Rive. Le port ne prétend pas rendre cette structure générique ni
valider des nœuds de modèle ; l’enrichissement Avatar fera toujours l’objet
d’un plan séparé.

## 9. Avatar, expressions et gestes — plan dédié engagé

Ces composants restent hors du périmètre de ce plan. Leur migration depuis
TalkingHead et l'adaptation V1 est maintenant suivie dans le
[plan Avatar dédié](./2026-09-19-avatar-components-v2-plan.md), avec analyse
des comportements, découpage du core Avatar, dépendances et parcours
d'acceptation.

Le composant state machine Rive et les données de l'application Rive ne
constituent pas la migration du lip-sync Avatar. Aucun composant Avatar,
expression ou geste ne doit être implémenté au titre de cette tranche.

## 12. Validation complète

La famille n'est pas stabilisée par une seule démonstration visuelle. La
validation comprend :

- types et validateurs des profils et relations ;
- isolation multi-avatar, multi-hôte et multi-player ;
- Play, pause, rate, Seek avant/arrière, reset et replay ;
- resize, montage, démontage, retour de story et destruction ;
- preload des bibliothèques, modèles, textures et données ;
- host Rive, state machine et port V1 conformes au parcours Play/Seek ;
- host Lottie simple conforme au périmètre play/pause ;
- contre-épreuves futures conformes aux cas avancés Rive et Lottie ; les cas
  Avatar/TalkingHead relèveront du plan séparé ;
- absence de RAF et de chargement tardif ;
- typecheck, tests et build ;
- validation réelle dans Safari et un second navigateur.

Le plan reste `En cours` pendant l'implémentation. Il ne passe à `Fini` qu'après
alignement des spécifications, du suivi et des démos de référence.
