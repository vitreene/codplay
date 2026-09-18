# Plan V2 — pont CodPlay vers les projections tierces

> Statut : **En cours**.
>
> Ce plan ne vaut pas autorisation de modifier le core. Toute implémentation
> dans `packages/codplay` exige la validation du plan puis l'accord explicite de
> l'auteur.

## 1. Objectif

Construire un pont générique permettant à un composant hôte HTML de posséder un
matérialiseur de bibliothèque tierce et à des persos spécialisés d'écrire dans
les cibles qu'il publie.

Le pont doit servir à Three.js, Rive et Lottie sans faire entrer leurs types
dans le core et sans rendre le matérialiseur global de l'instance
sélectionnable.

L'analyse est consignée dans
[la note du 18 septembre](./notes/2026-09-18-third-party-render-target-analysis.md).
Les composants externes relèvent du
[plan dédié](./2026-09-18-third-party-components-v2-plan.md).

## 2. Nature du chantier

Cette capacité ne sera pas ajoutée comme une exception autour du chemin HTML
actuel. Elle introduit une nouvelle relation entre des persos, des cibles
runtime et plusieurs frontières de matérialisation locales. Elle peut donc
nécessiter une réécriture partielle du core et de nouvelles structures de
données.

Le chantier doit privilégier une architecture explicite et durable, même si
elle remplace une partie de `RuntimeComponentRuntime`, du contrat interne de
matérialisation ou de l'ordre d'instanciation. La taille minimale du diff n'est
pas un objectif. Sont interdits comme solution finale :

- faire passer un composant projeté pour un composant HTML avec un markup vide ;
- ajouter une branche Three.js, Rive ou Lottie dans le core ;
- retourner un handle factice uniquement pour franchir le matérialiseur HTML ;
- laisser chaque intégration rechercher son hôte ou maintenir son propre graphe ;
- conserver une structure existante seulement pour éviter de revoir son
  contrat, si elle ne représente pas correctement le nouveau modèle.

Les mécanismes internes actuels peuvent être réemployés après audit. Leur nom
et leur forme ne deviennent pas pour autant des concepts auteur ou des contrats
du pont.

## 3. Invariants

- Le matérialiseur global de la tranche V2 reste HTML/DOM.
- Le contexte tiers et son matérialiseur appartiennent au composant hôte.
- Le core ne connaît aucun type Three.js, Rive, Lottie ou TalkingHead.
- La bibliothèque optionnelle est déclarée à l'engine.
- Un composant peut déclarer les IDs de ses bibliothèques ; un ID absent au
  build produit un warning auteur non bloquant et n'est pas réémis par le
  codec/player.
- `rel` est une donnée initiale immuable ; aucune action ne la modifie.
- `rel.target.scene` identifie la scène et `rel.target.perso` identifie
  éventuellement un perso de cette scène.
- L'intégration peut typer et valider des champs supplémentaires dans `rel`.
- Une identité de relation inconnue ne bloque ni la construction de la scène
  ni sa lecture. Elle produit un warning au build et reste silencieuse en
  diffusion.
- Le core ne vérifie pas la compatibilité d'une valeur opaque et ne construit
  pas de graphe récursif de relations ; ces responsabilités appartiennent à
  l'intégration qui publie et consomme la cible.
- Une cible valide mais non montée dans la story courante est indisponible,
  sans être considérée comme une déclaration invalide.
- Le composant de feature reçoit une cible résolue et ne connaît pas le circuit
  de connexion.
- Un tiers ne lance ni RAF ni horloge privée.
- Une cible présente une seule image après la réconciliation complète de ses
  consommateurs.
- Les `ComponentAnimation` de contenu sont appliquées avant les streams de
  phase `commit` ; l'hôte utilise cette phase pour effectuer son rendu final
  après les écritures de ses consommateurs.
- Lors du rejeu d'un Seek, la scène cible est d'abord synchronisée avec tous
  ses consommateurs ; une seule présentation finale est ensuite effectuée.
  Aucun hôte tiers ne doit donc peindre la cible avant que ses animations de
  contenu ne soient réenregistrées pour cette occurrence.
- Le chemin conserve `play(t) = seek(t)` pour les états reconstructibles.
- Aucun raccourci de démo ne remplace une capacité runtime manquante.

## 4. Gate 0 — construire le modèle comparatif

Avant de choisir les structures du core, décrire le même parcours avec au moins
les quatre familles suivantes :

- Three.js : la première implémentation est un hôte comparable à un composant
  media, avec une scène ou ressource préparée, une séquence et seulement
  `play`/`pause` ; la projection Three.js de la démo V1 sert ensuite de
  verticale intermédiaire pour éprouver les objets, les relations et le rendu
  unique ;
- Rive : pour la première implémentation, un hôte possède une ressource et un
  artboard et expose seulement le pilotage play/pause de la séquence ; les
  state machines, entrées et contributions multiples servent à éprouver la
  direction future, pas à élargir cette tranche ;
- Lottie : pour la première implémentation, un hôte possède une composition et
  son renderer et expose seulement le pilotage play/pause de la séquence ; les
  segments, marqueurs, layers et cibles adressables sont réservés à une tranche
  ultérieure ;
- avatar/TalkingHead : `scene -> avatar -> lipsync/expression/gesture` combine
  création d'un objet, publication d'une cible secondaire et contributions
  multiples sans représentation autonome.

Pour chaque famille, relever :

- ce qui possède le contexte de bibliothèque et le commit final ;
- ce qui est créé, ciblé ou seulement modifié par un consommateur ;
- les identités stables nécessaires et leur portée ;
- la profondeur et la cardinalité des relations ;
- les exigences de montage, démontage, reset, Seek et destruction ;
- la relation entre le temps CodPlay et le moteur natif ;
- les ressources et la bibliothèque requises avant instanciation ;
- les erreurs détectables et leur diagnostic auteur.

### Sortie attendue

- Une matrice sépare les invariants communs des conventions propres à chaque
  bibliothèque.
- La matrice documente au minimum les quatre cycles : scène Three.js et objets,
  artboards/state machines Rive, composition/renderer/temps Lottie et
  avatar/TalkingHead contributeur.
- La première implémentation Three.js reste limitée à un hôte et à une
  séquence pilotée par `play`/`pause`; la démo V1 citée est identifiée comme
  l'intermédiaire de validation avant les features Three.js avancées.
- La première implémentation Rive/Lottie reste limitée à un hôte comparable à
  un composant media : ressource préparée, séquence, `play` et `pause`.
- Les options avancées sont recensées comme contraintes futures, mais ne
  bloquent pas cette première verticale si le modèle du core ne les interdit
  pas.
- Aucun concept propre à Three.js n'est présenté comme générique.
- Le modèle couvre à la fois un composant qui crée une représentation et un
  composant qui contribue à une représentation existante.
- Les inconnues propres à Rive et Lottie sont résolues avant de figer les
  structures du core, pas après la démo Three.js.
- Le cas Rive avancé déjà présent dans V1 — composant spécialisé et lipsync par
  visèmes — est conservé comme modèle de déploiement ultérieur ; il ne gonfle
  pas le contrat de l'hôte Rive initial.

Cette gate est retenue pour la tranche d'élaboration. La matrice détaillée et
les implémentations propres à chaque bibliothèque restent à compléter avant
de qualifier le pont comme générique.

## 5. Gate 1 — auditer les circuits existants

Vérifier précisément :

- l'enregistrement des unités tierces au niveau engine ;
- le chargement paresseux des bibliothèques et le preload des ressources ;
- `RuntimeCapabilityCatalog` et les définitions de composants ;
- les mécanismes internes déjà présents pour publier et résoudre des opérations
  entre instances d'un même player ;
- `RuntimeComponentRuntime`, son ordre d'instanciation et son stockage des
  instances ;
- le moment où les services sont sélectionnés par rapport à la résolution de la
  cible ;
- `SolvedGraph` et son parcours parent avant enfant ;
- le cycle du `RuntimeMaterializer` HTML ;
- les hooks des modules player-scoped et le commit d'une présentation.

L'audit doit notamment établir le parcours actuel : tous les persos sont créés
avec le matérialiseur du player, puis envoyés à sa méthode de matérialisation
avant leur premier `update()`. Dans le runner actuel, cette destination est HTML
et refuse un composant qui n'est pas un `BaseHTMLComponent`.

### Constat vérifié au démarrage

- Le répertoire `packages/authoring/component-v2/` prévu par le plan n'existe
  pas encore.
- Les packages `packages/authoring/components/threejs` et `rive` sont des
  implémentations V1 : ils importent `codplay-v1`, utilisent le contrat V1 de
  `RenderAdapter` et ne peuvent pas être branchés tels quels sur V2.
- V2 sait déjà enregistrer une factory étrangère dans son catalogue, mais cette
  déclaration est fournie directement à l'engine ; la préparation générique de
  la bibliothèque est maintenant en place, tandis que le chemin unifié de
  binding reste à construire.
- `RuntimeComponentRuntime` crée le composant avec le matérialiseur unique du
  player, puis `HtmlComponentMaterializer` refuse tout composant qui n'est pas
  `BaseHTMLComponent`. Ce point est la frontière réelle à traiter par Gate 2.
- Le preload V2 possède une stratégie extensible par type de ressource, mais le
  pont avec l'unité tierce et la ressource préparée n'est pas encore une
  structure V2 de premier niveau.

### Sortie attendue

- Une carte distingue les contrats réutilisables, les hypothèses exclusivement
  HTML et les frontières à remplacer.
- L'audit indique les conséquences sur la compilation, le catalogue, les
  services, l'instanciation, la matérialisation et la destruction.
- Il ne suppose pas qu'une extension minimale du circuit existant soit la bonne
  solution.
- Il ne crée ni second catalogue, ni second player, ni registre global.

Cette gate est relue pour la tranche runtime. Le pont ne crée ni second
catalogue ni second mécanisme de chargement : le preload d'une unité tierce et
les contrats propres aux bibliothèques sont suivis dans leurs tranches
dédiées, avec l'engine comme propriétaire du chargement.

## 6. Gate 2 — spécifier les structures du core et le pont

Avant le code, produire la spécification qui fixe :

La direction générale des structures a été validée pour engager la tranche A.
La note d'analyse conserve la proposition détaillée, tandis que la forme
implémentée de `rel` est fixée dans la
[spécification dédiée](../specs/third-party-rel-spec.md). Les détails du
registre et de la résolution runtime restent à relire avant les tranches
suivantes.

- le rôle de `rel` et son emplacement exclusif dans `initial` ;
- la forme commune `target: { scene, perso? }` ;
- les règles de résolution de ces deux identifiants ;
- la représentation compilée et sérialisable de la relation, distincte des
  handles runtime ;
- la résolution directe de `rel`, distincte du graphe de placement issu de
  `move`, sans créer de graphe relationnel récursif ;
- le registre player-local des cibles runtime, leur disponibilité et leur
  invalidation ;
- la donnée qui permet de diriger un composant vers le matérialiseur HTML ou
  vers le matérialiseur local de sa cible avant son instanciation effective ;
- le cycle de vie d'un composant indépendamment de l'hypothèse actuelle d'un
  unique handle HTML ;
- le montage en deux phases fournisseur/consommateurs et la frontière de
  présentation du player ;
- la manière dont une intégration enrichit le type TypeScript de `rel` et
  déclare son validateur ;
- le contrat de publication et de résolution d'une cible native ;
- les warnings auteur pour une identité de scène ou de perso inconnue et leur
  silence en diffusion ; la compatibilité native et les cycles internes restent
  propres à l'intégration ;
- la distinction entre une référence invalide et une cible valide
  temporairement non montée ;
- le cycle de vie du fournisseur et de ses consommateurs ;
- la reprise de la même frontière de présentation pour Play, Seek, reset,
  resize et destruction, sans ajouter de transaction native au core.

La spécification doit également choisir explicitement ce qui est conservé,
réécrit ou remplacé dans le core et définir la migration du chemin HTML
existant. Elle ne reprend pas automatiquement les structures actuelles comme
forme du nouveau contrat.

La direction de cette gate a été validée pour engager la tranche A. La
spécification de la relation et le pont runtime sont maintenant documentés
séparément. Les diagnostics d'identité, l'absence de graphe récursif et la
frontière de présentation sont fermés par la spécification du pont ; les
contrats de bibliothèque et de preload restent dans leurs tranches externes.

## 7. Tranche A — déclaration TypeScript et compilation de `rel`

### Travail

- Définir la forme commune `rel.target: { scene, perso? }`.
- Permettre à une intégration d'enrichir le type de relation de ses composants.
- Relier ce type au profil `initial`, à sa validation et à la compilation.
- Extraire une représentation structurelle immuable utilisable sans relire
  `initial` pendant la présentation.
- Extraire les identifiants de cible sans interpréter les champs propres à la
  bibliothèque.
- Exclure `rel` des données applicables par les actions et signaler à l'auteur
  toute tentative, sans interrompre la lecture.
- Dériver les besoins engine correspondants sans instancier le composant.

### Acceptation

- Deux intégrations peuvent enrichir `rel` différemment tout en conservant la
  même forme de `target`.
- TypeScript guide correctement chaque déclaration auteur.
- Une référence invalide ne bloque pas la construction de la scène : elle
  produit un warning auteur, reste silencieuse en diffusion et laisse le
  consommateur sans cible.
- Une action qui tente de modifier `rel` est ignorée et produit le même type de
  warning auteur non bloquant.
- Le core compilé ne contient aucun type de bibliothèque.
- Le `CompiledScene` reste sérialisable et ne contient aucun handle natif.

### État au 18 septembre 2026

La forme commune, la validation non bloquante, l'extraction compilée séparée,
l'exclusion de `rel` des actions et le codec sont implémentés et couverts par
les tests ciblés. La déclaration d'une unité engine et la dérivation de ses
besoins propres à une bibliothèque restent dans les tranches du pont runtime.

## 8. Tranche B — orchestration et résolution des cibles

### Travail

- Définir le handle opaque publié par un hôte ou un objet spécialisé.
- Mettre en place les nouvelles structures retenues par la Gate 2 au lieu de
  les simuler dans le matérialiseur HTML.
- Permettre au pont de résoudre une scène ou un perso par son identité compilée.
- Isoler tous les handles et registres par player et par hôte.
- Définir le comportement lorsque le fournisseur n'est pas monté.

### Acceptation

- Un hôte publie une cible sans exposer sa classe au core.
- Un objet publié par cet hôte peut lui-même fournir une cible à un contrôleur.
- Deux players ne partagent aucun handle mutable.
- Une identité de cible inconnue produit un warning auteur non bloquant,
  reste silencieuse en diffusion et rend la contribution concernée inerte.
- Le core transmet une valeur opaque sans tenter de vérifier sa compatibilité
  native ; cette vérification est propre à l'intégration.
- Une cible valide mais non montée peut redevenir disponible sans modifier
  `rel` et sans produire de faux warning.
- Le démontage invalide la cible avant la contribution suivante.
- Le chemin HTML existant conserve ses invariants sans connaître les types des
  bibliothèques tierces.

### État d'implémentation au 18 septembre 2026

La première partie de la tranche est engagée et couverte par la
[spécification du pont runtime](../specs/third-party-target-bridge-spec.md) :

- `RuntimeTargetRegistry` est player-local et reste distinct de
  `RuntimeCapabilityCatalog`, de `RuntimeComponentSurfaceResolver` et de
  `MountTargetRegistry` ;
- `RuntimeComponentDefinition.targetProvider` décrit une publication sans
  devenir un registre d'instances ;
- le runtime monte toutes les instances avant d'activer les publications puis
  de mettre à jour les consommateurs ;
- une valeur opaque est transmise par `ComponentUpdateInput.target` ;
- une cible valide est invalidée lorsque son fournisseur n'est pas monté, puis
  réactivée à son remontage ;
- un `BaseComponent` sans représentation HTML n'est pas envoyé au
  matérialiseur HTML et ne reçoit pas de handle factice.

La tranche B est fermée pour le core : les diagnostics d'identité sont émis par
`SceneBuilder`, la résolution reste une recherche directe player-local et la
compatibilité native n'est pas une responsabilité du core. Aucun diagnostic
de diffusion n'est ajouté pour ces cas.

## 9. Tranche C — réconciliation des relations

### Décision de périmètre

Cette tranche est fermée sans implémentation de graphe dans le core. `rel` ne
décrit pas un arbre de matérialisation : il fournit une identité et une valeur
opaque. Le runtime monte les composants, publie les cibles disponibles, puis
réalise les mises à jour ; l'ordre de déclaration ne constitue pas une
dépendance récursive.

Si une intégration doit composer `scene -> avatar -> lipsync`, elle garde cette
composition dans ses composants et ses services. Elle ne crée pas un registre
global et ne demande pas au core de détecter un cycle dans des objets qu'il ne
connaît pas.

### Travail conservé pour les intégrations

- Créer, mettre à jour, déplacer ou détruire les valeurs natives dans
  l'intégration qui les possède.
- Réévaluer la disponibilité lors des montages de story sans changer l'identité
  de `rel`.

### Acceptation

- `scene -> avatar -> lipsync` est une composition d'intégration, et non un
  graphe résolu par le core.
- Deux consommateurs peuvent viser la même cible.
- Un retour de story ne duplique ni handle ni contribution.
- La relation reste une recherche directe et ne déclenche aucune récursion.
- Aucun composant de feature ne recherche sa cible.

## 10. Tranche D — contrat de composant projeté

### Travail

- Fournir une base ou une factory qui masque le raccordement.
- Limiter le composant de feature à ses hooks de création, application d'état
  (`initialize`, `update`) et destruction.
- Ne remettre au composant que la cible native typée et ses données résolues.
- Permettre à un composant de publier à son tour une cible.
- Préserver les profils et actions propres à chaque bibliothèque.

### Acceptation

- Un composant factice est écrit sans code de registre, de résolution, de
  graphe, d'horloge ou de commit.
- Une caméra, une géométrie et un contrôleur contributeur utilisent la même
  infrastructure sans partager le même profil.
- Les services HTML ne sont accessibles qu'au composant hôte HTML.
- Un composant projeté ne déclare aucun markup factice et ne passe pas par une
  branche de compatibilité HTML.

## 11. Tranche E — transaction de présentation

### Décision de périmètre

Le core ne définit pas de transaction native supplémentaire. La transaction
commune est déjà le cycle de `RuntimePlayer` : synchronisation des composants,
`presentAt(timeMs)`, puis matérialisation. Les intégrations tierces doivent
regrouper leurs écritures et leur rendu dans le hook/module prévu par leur
unité ; elles ne lancent pas de boucle d'horloge ou de rendu autonome.

### Travail conservé pour les intégrations

- Préparer l'hôte avant ses consommateurs.
- Appliquer tous les états et contributions à `t`.
- Composer les contributions qui partagent une cible.
- Appliquer les streams de contenu avant le stream `commit` de l'hôte.
- Présenter chaque hôte une seule fois dans son propre module.
- Reprendre exactement cette transaction pour Play, Seek, reset et resize.

### Acceptation

- Deux géométries dans une scène ne provoquent qu'un rendu lorsque
  l'intégration choisit ce regroupement.
- Deux hôtes rendent chacun une fois dans leur intégration respective.
- Play et Seek produisent le même état observable à `t`.
- Aucun rendu n'est produit par une boucle tierce autonome.

## 12. Tranche F — engine, bibliothèque et ressources

### Décision de séquencement

Cette tranche est distincte du pont de cibles. La fondation de chargement est
maintenant implémentée dans le catalogue et l'engine ; aucune bibliothèque
n'est chargée par `targetProvider`, `create`, `initialize()` ou `update()`. La
composition d'une unité réelle reste à faire.

### Travail

- Déclarer les bibliothèques au niveau engine et dériver les dépendances depuis
  les définitions de composants ; avertir l'auteur si un ID n'est pas déclaré.
  **Implémenté.**
- Préparer une bibliothèque une seule fois par engine, avant l'initialisation
  de la scène. **Implémenté par `RuntimeEngine.prepareScene()`.**
- Faire exercer cette barrière par le chemin `HtmlPlayerRunner.run()` avant le
  preload des ressources. **Implémenté et testé.**
- Raccorder le pont à une unité Three.js déclarée à l'engine.
- Conserver les fichiers métier dans le manifeste de ressources.
- Attendre la disponibilité de la bibliothèque et des ressources avant le
  montage des consommateurs.
- Définir propriété, partage et libération des ressources.

### Acceptation

- Une instance qui n'emploie pas l'intégration ne charge pas sa bibliothèque.
- Deux scènes d'un même engine dédupliquent le chargement ; deux engines ne
  partagent pas l'état de préparation. **Couvert par les tests engine.**
- Le chemin runner bloque l'init et le play jusqu'à la préparation puis au
  preload. **Couvert par le test runner.**
- Deux instances peuvent partager les ressources prévues sans partager leur
  état mutable.
- Aucun chargement ne part du constructeur ou de `update()`.
- Une erreur ou une annulation laisse le player dans l'état spécifié.

## 13. Validation transverse

La validation comprend :

- tests TypeScript des formes `rel` propres aux intégrations ;
- validation et résolution des références scène/perso ;
- isolation multi-engine, multi-player et multi-hôte ;
- cible inconnue, cible temporairement non montée et destruction, avec warnings
  auteur mais silence en diffusion ;
- Play, pause, rate, Seek avant/arrière, reset et replay ;
- resize et perte éventuelle du contexte ;
- preload, erreur et annulation ;
- cas contractuels Three.js, Rive, Lottie et avatar/TalkingHead issus de la
  matrice comparative ;
- typecheck, tests et build ;
- vraie intégration Three.js dans le navigateur, dont Safari et un second
  navigateur.

Une cible factice prouve les contrats unitaires, mais ne clôt pas le plan. La
grille Three.js doit exercer build, engine, preload, player, events, solve,
composants, pont et rendu réels.

Le pont ne peut pas être qualifié de générique à partir de la seule grille
Three.js. Avant stabilisation, les cas Rive, Lottie et contributeur d'avatar
doivent avoir exercé les structures du core retenues, au minimum par des
intégrations contractuelles fidèles à leurs cycles réels. Les implémentations
visuelles complètes restent suivies dans le plan des composants externes.

## 14. Documentation et statut

Après chaque tranche validée :

- mettre à jour la spécification V2 applicable ;
- aligner le plan général et le suivi d'implémentation ;
- conserver dans les notes uniquement les décisions et questions utiles ;
- ne marquer le pont `Fini` qu'après la validation réelle complète.
