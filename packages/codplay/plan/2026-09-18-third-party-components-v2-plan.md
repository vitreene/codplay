# Plan V2 — composants tiers Three.js et avatar

> Statut : **En cours**.
>
> Ce plan porte sur les composants externes de
> `packages/authoring/component-v2/`. Il dépend du
> [plan du pont CodPlay](./2026-09-18-third-party-render-target-codplay-plan.md).

## 1. Objectif

Créer d'abord des hôtes Three.js, Rive et Lottie minimaux, composables et
comparables à un composant media du point de vue auteur. Une verticale Three.js
intermédiaire reprend ensuite la projection de la démo V1 citée, avant les
composants de feature plus riches. Le second parcours construit la hiérarchie
`scene -> avatar -> lipsync`, puis les expressions et les gestes.

Three.js est la première preuve, mais son hôte initial reste volontairement
simple. Le pont reste conçu pour permettre ensuite les intégrations Rive et
Lottie selon leurs propres conventions. Leurs besoins ne sont toutefois pas
étudiés après coup : ils participent à la Gate 0 comparative du plan core avant
le choix des structures de données.

## 2. Gates

L'implémentation attend :

1. la validation de l'analyse du 18 septembre ;
2. la validation de la comparaison Three.js, Rive, Lottie et avatar/TalkingHead
   de la Gate 0 du plan CodPlay ;
3. l'audit des circuits existants demandé par la Gate 1 ;
4. la validation des structures du core et de leur migration demandée par la
   Gate 2 ;
5. l'accord explicite pour les changements de core ;
6. le choix de la granularité des packages ;
7. la décision concernant caméra et lumières dans la première verticale.

La décision de la première verticale est prise : la caméra et les lumières sont
des persos Three.js distincts, reliés à la scène hôte par `rel`. L'hôte reste
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
- La cible commune de `rel` suit `{ scene, perso? }` ; l'intégration peut
  enrichir son type TypeScript.
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
- les types et validateurs de `rel` ;
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

- porte une relation Three.js immuable vers la scène ;
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
2. `rel` relie la géométrie à la scène ;
3. les events déclenchent les actions de la grille ;
4. la télécommande V2 pilote Play, pause et Seek ;
5. le preload bloque le lancement jusqu'à disponibilité des dépendances ;
6. la scène n'est rendue qu'après la mise à jour de ses consommateurs.

Rive et le quiz peuvent être réintroduits ensuite pour vérifier la coexistence
des intégrations dans une même instance.

## 8. Tranche 5 — hôtes Rive et Lottie simples

Après la première verticale Three.js, créer une première implémentation minimale
pour chacune de ces bibliothèques. Elle doit rester comparable à un composant
media du point de vue auteur :

- une ressource préchargée ;
- un hôte HTML possédant le contexte et le renderer de la bibliothèque ;
- une séquence unique ;
- les commandes `play` et `pause` pilotées par CodPlay.

Leur API auteur ne comprend que `play` et `pause`. Leurs parcours vérifient
toutefois les frontières communes du runtime — engine, preload, horloge,
pause/reprise, Seek lorsqu'il s'applique, commit et destruction — sans exposer
les mécanismes avancés de la bibliothèque. Ils ne comprennent pas encore les
state machines et inputs Rive, ni les segments, marqueurs, layers ou cibles
internes Lottie.

Le cas Rive avancé déjà disponible dans V1 reste toutefois un modèle de
déploiement pour une tranche ultérieure :
[`rive-coach-demo.ts`](../../demos/src/v1/codplay/rive-coach-demo.ts) et son
[`VisemeLipSyncService`](../../authoring/components/rive/src/services/viseme-lipsync-service.ts)
montrent le cas d'un composant Rive spécialisé qui applique des visèmes à une
entrée de state machine. Il ne doit pas être incorporé au contrat de l'hôte
minimal, mais ses besoins doivent rester couverts par la direction du pont pour
que cette feature puisse être portée ensuite.

Les options avancées sont recensées pour la tranche suivante. Elles ne doivent
pas être ajoutées par anticipation ni conduire à un second circuit dans le
core. Si l'implémentation simple révèle une structure core incorrecte, la Gate 2
est rouverte au lieu d'ajouter un adapter de compensation. Un concept propre à
Rive ou Lottie reste dans son package.

## 9. Tranche 6 — avatar

Le composant avatar :

- porte une relation immuable vers une scène Three.js ;
- consomme un modèle préparé par le preload ;
- crée l'objet avatar dans la scène ;
- applique ses animations globales ;
- publie une cible typée pour ses contrôleurs ;
- compose leurs contributions avant le rendu.

TalkingHead reste la référence fonctionnelle. Les composants V1 servent à
identifier les comportements et les limites, pas à imposer la structure.

### Acceptation

- Deux avatars coexistent dans une scène.
- Leurs états mutables restent isolés.
- Une animation absente est sans effet, produit au plus un warning auteur et
  reste silencieuse en diffusion.
- Play, Seek, reset et destruction sont validés avec un vrai modèle.

## 10. Tranche 7 — lipsync

Le lipsync reste provisoirement un perso. Il :

- porte une relation d'avatar immuable ;
- reçoit les events de ses actions ;
- transforme ses données temporelles en contribution de bouche ;
- ne possède ni scène, ni renderer, ni modèle ;
- ne recherche jamais l'avatar par lui-même.

La logique pure de transformation peut résider dans des straps. L'application
aux morphs appartient au composant et au pont d'avatar. La répartition est
guidée par les responsabilités, pas par la taille du code.

### Acceptation

- Deux lipsync pilotent deux avatars distincts.
- Une relation ne change pas pendant la lecture.
- L'absence d'un morph attendu ne bloque pas la lecture, produit au plus un
  warning auteur et reste silencieuse en diffusion.
- Les visèmes reconstructibles sont identiques en Play et Seek.
- La destruction de l'avatar invalide sa cible.

Cette tranche doit conclure explicitement si le contrôleur contributeur reste
une variante cohérente du perso ou révèle une primitive distincte.

## 11. Tranche 8 — expressions et gestes

Créer les composants seulement à partir de cas auteur réels : expression,
regard, geste ou clip corporel.

Pour chacun, définir :

- ses données et ses actions ;
- son type TypeScript de relation ;
- les canaux auxquels il contribue ;
- la composition avec les autres contrôleurs ;
- sa fidélité au Seek ;
- le comportement face à un clip, os ou morph absent.

## 12. Validation complète

La famille n'est pas stabilisée par une seule démonstration visuelle. La
validation comprend :

- types et validateurs des profils et relations ;
- isolation multi-avatar, multi-hôte et multi-player ;
- Play, pause, rate, Seek avant/arrière, reset et replay ;
- resize, montage, démontage, retour de story et destruction ;
- preload des bibliothèques, modèles, textures et données ;
- hôtes Rive et Lottie simples conformes au périmètre play/pause ;
- contre-épreuves futures conformes aux cas avancés Rive, Lottie et
  avatar/TalkingHead de la matrice comparative ;
- absence de RAF et de chargement tardif ;
- typecheck, tests et build ;
- validation réelle dans Safari et un second navigateur.

Le plan reste `En cours` pendant l'implémentation. Il ne passe à `Fini` qu'après
alignement des spécifications, du suivi et des démos de référence.
