# CodPlay V2 — découverte et état de référence

> Statut : Référence de travail pour les agents
> Version : CodPlay V2 foundation
> Date de l'état : 2026-08-27

Ce document est le point d'entrée pour reprendre CodPlay V2. Il décrit où se
trouve chaque responsabilité, ce qui est fixé, ce qui est effectivement
implémenté et ce qui reste ouvert. Il évite de redécouvrir les mêmes décisions
à partir d'une démo ou d'un symptôme visuel.

Il ne remplace pas les spécifications ni les plans. En cas de conflit, l'ordre
d'autorité est celui de la section 1. Une affirmation de ce document ne crée
jamais une API ou une règle absente des contrats cités.

## 1. Ordre de lecture et sources d'autorité

Avant toute modification :

1. lire [`AGENTS.md`](../../../../AGENTS.md) ;
2. lire le [plan général V2](../codplay-v2-plan.md) ;
3. lire le plan détaillé du domaine touché ;
4. vérifier le chemin de code réel et les tests existants ;
5. utiliser les démos uniquement comme fixtures de validation.

Les plans de référence sont :

- [façade engine/instance](../facade-engine-instance-plan.md) ;
- [engine et player](../player-engine-plan.md) ;
- [CompiledScene](../compiled-scene-plan.md) ;
- [materialize, resolve, solve](../materialize-resolve-solve-plan.md) ;
- [contrat `move`](../move-contract-plan.md) ;
- [capture](../capture-authoring-plan.md) ;
- [mouvement HTML et FLIP](../runner-flip-integration-study.md) ;
- [DnD et capacité `list`](../list-dnd-integration-plan.md) ;
- [media et preload](../media-preload-plan.md).

Les documents `README.md` expliquent l'usage d'un module. Ils ne définissent
pas les contrats internes. Les notes historiques servent à retrouver une
décision, pas à inventer une nouvelle API.

Les références V1 ne servent qu'à comparer le comportement à préserver : le
runtime V2 n'importe pas le runtime V1 et ne crée pas de pont implicite vers
lui. Les spécifications V1 utiles à cette comparaison sont notamment
[`v1-preload-api.md`](../../../../docs/formalisation/v1-preload-api.md),
[`v1-perso-spec.md`](../../../../docs/formalisation/v1-perso-spec.md) et
[`v1-author-api-spec.md`](../../../../docs/formalisation/v1-author-api-spec.md).

Une démo qui fonctionne ne prouve pas que CodPlay est correct. Une démo qui
échoue révèle un point à analyser dans le contrat ou le runtime ; elle ne doit
pas être contournée par du code spécial à la démo.

## 2. Modèle mental du runtime

Le flux à conserver est :

```text
SceneDoc auteur
  -> build, validation et sanitation
  -> CompiledScene sérialisable
  -> engine : catalogue, horloge, ressources et ordre des instances
  -> player : journal, materialize, resolve et solve
  -> état logique des composants
  -> RuntimeMaterializer
  -> runner HTML/DOM
  -> présentation visible
```

Le modèle logique est la source de vérité. Le DOM est une sortie de
présentation ; il ne sert pas à reconstruire l'état logique.

Le catalogue de capacités est unique pour un engine. Les composants déclarent
les services qu'ils utilisent ; le catalogue compose et verrouille ces
déclarations avant l'exécution. Une démo ne crée donc pas de catalogue local,
ne construit pas de player parallèle et n'appelle pas directement les
constructeurs internes.

La façade publique masque `RuntimeEngine`, `RuntimePlayer`, le catalogue, le
materializer et le runner. Le chemin normal d'une démo V2 est :

```text
const codplay = new CodPlay(options)
codplay.engine
codplay.instances
codplay.preload
  -> engine.builder.compile(...)
  -> codplay.instances.create(...)
  -> instance.telco / instance.events / instance.diagnostic
```

La materialisation V2 retenue est HTML/DOM. Les éléments SVG produits par un
composant passent par ce même DOM et ce même runner ; il n'existe pas de
materializer SVG séparé. Canvas, Three.js et les autres supports de rendu ne sont
pas une materialisation CodPlay de cette tranche. Un composant externe peut
posséder son propre contexte de rendu interne, sans que ce contexte devienne
une nouvelle API de materialisation du moteur.

## 3. Contrats publics V2 déjà fixés

### 3.1 Façade CodPlay

La surface publique actuelle est :

```text
new CodPlay(options)
codplay.engine
codplay.instances
codplay.preload
```

L'engine expose :

```text
engine.builder.compile({ scene })
engine.resources.register(resources)
engine.events.emit(input)
engine.events.onEvent(listener)
engine.start()
engine.pause()
engine.stop()
engine.advance(nowMs, marginMs?)
engine.destroy()
```

Le propriétaire `CodPlay` expose le registre des instances :

```text
codplay.instances.create(options)
codplay.instances.get(instanceId)
codplay.instances.destroy(instanceId)
```

Il n'y a pas de `engine.seek()`. Le seek public passe par l'instance qui doit
être déplacée : `instance.telco.seek(timeMs)`. `engine.advance()` sert au mode
où l'hôte fournit les frames ; dans le mode normal, l'engine possède et pilote
son ticker. Ces deux modes ne doivent pas être utilisés simultanément.

`engine.pause()` suspend la propagation et conserve l'état logique présenté.
`engine.stop()` cesse d'employer la machine et ne promet pas une remise à zéro
automatique. `engine.destroy()` effectue le teardown final des instances et
des ressources. Ces opérations ne constituent pas des variantes de player
créées par la démo.

Une erreur de compilation peut être représentée par le résultat de compilation
prévu par le contrat (`ok: false` et diagnostics). Les commandes runtime ne
doivent pas recevoir une enveloppe d'erreur inventée ; les problèmes passent
par le canal de diagnostics V2, en `warning` lorsqu'ils sont non bloquants et
en `error` lorsqu'ils interrompent l'opération.

### 3.2 Instance et telco

Une instance expose uniquement :

```text
instance.instanceId
instance.telco
instance.events
instance.diagnostic
```

La propriété `telco` regroupe le pilotage local :

```text
telco.getState()
telco.getProgress()
telco.play()
telco.pause()
telco.togglePlay()
telco.setRate(rate)
telco.seek(timeMs)
telco.rewind()
telco.onChange(listener)
telco.onProgress(listener)
```

Le progress expose le temps logique et la durée. Le pourcentage est une
présentation de la télécommande, pas une donnée du contrat CodPlay. Le
progress lit et écrit par le même circuit : `onProgress` observe et `seek`
écrit. La telco ne possède ni ticker, ni logique de scène, ni recherche de
cibles, ni accès direct au runner.

Il n'y a pas actuellement de `instance.capture()` public, de `instance.init()`
ou de `instance.refresh()` dans la telco, ni d'accès générique de l'éditeur au
DOM. L'accès authoring est un chantier séparé à reprendre avec l'éditeur.

### 3.3 Eventimes et ciblage

`instance.events.emit(eventime, target)` et `engine.events.emit(input)
aboutissent au même point d'entrée du player. `engine.events.emit` ne crée pas
un journal ou un dispatcher parallèle : il adresse l'instance puis délègue au
circuit normal.

La forme externe reste celle d'un eventime déclarable : nom, données, enfants
éventuels, visibilité et `startAt` lorsque nécessaire. La forme interne
`CompiledEventime` ne sort pas de la frontière publique.

Les règles temporelles fixées sont :

- un eventime racine sans `startAt` est enregistré immédiatement et présenté
  au prochain tick normal ;
- les `startAt` des eventimes imbriqués sont des offsets relatifs à leur parent
  ou à l'ancrage de la racine ;
- l'eventime est ajouté au journal puis lu lorsque la tête de lecture atteint
  son temps ;
- `applyAtMs` est interne et ne doit pas être exposé ;
- la syntaxe `startAt: "+200"` n'est pas un contrat V2 ;
- la cible est séparée de l'eventime et porte l'instance puis la portée
  `scene` ou `story`, avec la track éventuelle ;
- l'observation sortante concerne les events de visibilité `public` ;
- la notion de `cascade` n'est pas réintroduite : la portée nommée du contrat
  V2 est utilisée.

Les sorties `persist-only` de capture restent distinctes de la remise live
`endEmit`. Un événement `persist-only` n'est pas présenté par la tête de
lecture comme un effet supplémentaire au moment de `endCapture` ; il sert à la
trajectoire persistante qui sera relue. Il n'existe qu'un circuit d'events dans
le player.

### 3.4 Preload et ressources

`preload` est un service externalisé :

```text
codplay.preload
  -> preload.load(manifest ou manifestes)
  -> engine.resources.register(result)
  -> création de l'instance puis initialisation après validation
```

Le preload peut être appelé à tout moment par un hôte. En revanche, une scène
ne commence pas avant que ses ressources requises aient été enregistrées comme
disponibles. `init()` du player ne déclenche pas un preload implicite. Il n'y a
pas de duplication d'éléments dans le DOM pour précharger une ressource.

Le plan conserve un éventuel raccourci `run()` pour la diffusion autonome ; il
ne fait pas partie de la surface `CodPlay` actuellement exposée. Tant
qu'une interface dédiée n'est pas publiée, il ne faut pas l'utiliser comme une
API V2 ni l'ajouter dans une démo. Lorsqu'il sera construit, il devra enchaîner
le preload explicite, l'initialisation puis la lecture, sans redéfinir le
service preload ni créer une seconde façon de lire une scène.

## 4. Responsabilités par dossier

| Dossier | Responsabilité | Ne doit pas faire |
|---|---|---|
| `src/facade` | Surface publique CodPlay et délégation vers le runtime | Exposer les classes internes ou créer un second runtime |
| `src/runtime/catalog` | Catalogue unique des composants, services et modules | Être recréé par une démo |
| `src/runtime/engine` | Horloge, ressources partagées, ordre et propriété des instances | Résoudre les règles de scène à la place du player |
| `src/runtime/player` | Journal, reconstruction, materialize, resolve, solve et cycle de vie d'une instance | Lire l'état depuis le DOM |
| `src/runtime/components` | Composants logiques et leurs services déclarés | Imposer un materializer concurrent |
| `src/runtime/materializer` | Contrat abstrait de materialisation interne | Devenir une option publique de substrate en V2 foundation |
| `src/runtime/runner-html` | Présentation HTML/DOM, géométrie d'endpoints, FLIP et preview DnD HTML | Créer un second player, une seconde scène logique ou un arbre de mesure permanent |
| `src/runtime/motion` | Poses, graphes temporels et interpolation pure | Lire la géométrie DOM à chaque frame |
| `src/runtime/capture` | Session de capture générique et sorties du contrat capture | Connaître les listes, le DOM ou le hit-test |
| `src/runtime/capabilities/list` | Ordre, placement et réordonnancement d'une liste | Créer un pipeline d'animation distinct |
| `src/runtime/capabilities/media-sync` | Synchronisation des médias dans le circuit player | Corriger le master ou faire un seek par frame |
| `src/runtime/preload` | Chargement, cache, manifestes et stratégies | Créer des nodes DOM de mesure ou des clones de médias |
| `packages/demos/src/v2/layout` | Page commune : titre, sélection, scène, remote, journal et cycle facade | Être contourné par chaque démo |
| `packages/demos/src/v2/demos/<id>` | Construction de la `SceneDoc` et données propres à la scène | Construire une page, une telco, un journal ou un catalogue |
| `packages/demos/src/v2/registry.ts` | Une définition par démo : id, chemin, titre, description et chargement | Être dupliqué dans chaque page |

Le layout est le consommateur commun de la façade. Une démo ne doit pas
réinventer `new CodPlay`, la telco ou le journal pour « simplifier »
son montage. Le titre affiché et le titre de la liste viennent de la même
entrée du registry ; le choix du texte appartient à l'auteur du projet, pas à
un helper de layout.

Les anciens fichiers V2 qui appellent encore directement
`createCoreRuntimeCatalog` ou des constructeurs internes ne sont pas des
modèles à suivre. S'ils ne sont plus enregistrés, ils constituent du code à
retirer dans le chantier de nettoyage des démos ; s'ils doivent rester, ils
doivent être migrés par un plan explicite. On ne leur ajoute pas un nouvel
adaptateur parallèle.

## 5. Mouvement HTML : point d'entrée

Le détail normatif du graphe, des contextes parent/enfant, des bornes FIRST/LAST
et de la capture sans DOM d'analyse appartient au module de présentation HTML :

- [README du runner HTML](../../src/runtime/runner-html/README.md) décrit le
  fonctionnement effectivement exposé par le runner ;
- [plan d'intégration FLIP](../runner-flip-integration-study.md) porte le
  contrat, les invariants et le suivi de validation.

Ce document n'en recopie pas le détail. Pour l'état courant, il suffit de
retenir que le runner utilise les materialisations auteur persistantes, capture
la géométrie uniquement aux bornes nécessaires et résout le graphe conservé
dans la boucle de présentation. Le cas de non-régression suivi ici est celui
d'une cible ou d'un ancêtre absent au FIRST mais disponible au LAST d'un move.
Il est verrouillé par un test de frontière et doit rester visible dans la
fixture `flip-stress`. Pour l'overlay, l'ordre remonte toute la chaîne des
parents, y compris les intermédiaires sans ghost ; un enfant indépendant est
donc inséré après sa frame et reste peint au-dessus d'elle en cas de
recouvrement.

## 6. Mouvement, liste et capture

Le `move` est une action logique générale. La capacité `list` fournit les
règles d'ordre et de placement ; elle ne possède pas une animation concurrente.
Le DnD HTML fournit seulement la partie propre au pointeur, au hit-test et au
ghost, puis remet un résultat abstrait au circuit normal.

À la fermeture d'un DnD :

- la pose live du relâchement va dans `endEmit` et appartient à la fin du
  geste ; elle n'est pas la trajectoire historique relue par Seek ;
- le commit de placement produit un seul événement `persist-only` ;
- la trajectoire persistante est source -> cible, avec la position source
  réelle de l'item au moment du move ;
- le ghost suit le point d'insertion sous la souris et ne réordonne pas les
  nodes auteur pendant la preview ;
- Play et Seek utilisent le même journal, les mêmes frontières et le même
  calcul de `move`.

Le core capture ne connaît ni liste, ni DOM, ni géométrie. La source HTML et la
capacité `list` se branchent sur les hooks existants ; elles ne créent pas de
dispatcher ou de journal DnD séparé.

## 7. Médias et synchronisation

La synchronisation média reste dans le player :

- un media déclaré `master` fournit le temps de référence lorsqu'il est actif
  et n'est jamais corrigé par la timeline ;
- les autres médias qui possèdent leur propre timeline native peuvent être
  corrigés seulement en cas de dérive notable ;
- les médias déjà pilotés par le ticker restent dans le circuit normal et ne
  reçoivent pas un traitement différent ;
- aucun `currentTime` n'est réécrit à chaque frame ;
- un seek met en pause les médias natifs concernés, reconstruit la position,
  puis reprend si nécessaire ;
- le garde de dérive est une optimisation finale, après la validation de la
  lecture, du seek, du lancement et de la pause ; il ne concerne jamais le
  master.

Le preload et la synchronisation sont deux capacités distinctes. La présence
d'un service preload ne doit pas créer un deuxième élément vidéo ou audio dans
le DOM. L'anomalie connue reste l'écran noir de la vidéo dans Safari dans la
démo `preload-media` : le transport et les contrôles peuvent indiquer une
lecture alors que la surface reste noire. Sa cause n'est pas tranchée ; elle
doit être analysée avec les événements média, `readyState`, `currentTime`, les
dimensions et le rendu observé, sans l'attribuer sans preuve au preload ou au
FLIP.

## 8. État du projet au 2026-08-27

| Domaine | État constaté | Ce que cela autorise / interdit |
|---|---|---|
| Façade CodPlay | Plan de façade et README marqués `Fini`; code et tests présents | Utiliser la surface publique. Ne pas ajouter `engine.seek`, `instance.capture` ou des méthodes non planifiées. |
| Cohérence documentaire de la façade | Le plan détaillé dit `Fini`, le plan général la laisse encore `En cours` | Écart documentaire à résoudre ; ne pas en déduire une API manquante. |
| Engine, player, telco, catalogue | Code présent, tests ciblés présents ; plusieurs README restent `En cours` ou `Fixe` | Fondation utilisable, mais ne pas marquer les modules `Fini` sans leur preuve propre. |
| CompiledScene et validation | Tranche initiale présente ; plans et README encore `En cours` | Toute extension doit être spécifiée et compilée, pas déduite du DOM. |
| Capture core | Plan capture et validation S5 marqués `Fini`; tests présents | Ne pas ajouter une capacité `instance.capture` pour la démo. |
| Runner HTML et motion | Corrections de l'endpoint FIRST/LAST, de la source pré-frontière du retarget et du graphe d'empilement source/cible des overlays implémentées et couvertes par tests ; Firefox headless rejoué sur `flip-stress`, matrice Safari complète encore ouverte | Le runner mesure le LAST d'un move à son endpoint, conserve le mover et ses ancêtres dans le bon repère temporel, garde le mover au-dessus de ses deux endpoints et respecte les frères structurellement au-dessus de sa cible ; la démo reste la preuve visuelle. |
| List / DnD | Placement et capture couverts ; plan marqué `En cours` car le seek de la démo reste ouvert | Ne pas déclarer la tranche complète sur le seul drop live. |
| Media / preload | Socle présent ; plan marqué `En cours` | Preload séparé, ressources explicites, anomalie Safari ouverte, garde de dérive reporté. |
| Démos V2 | Layout et registry présents ; `flip-stress`, `components`, `runner` et `flip-nested` passent par le layout commun ; chantier encore `En cours` | Les démos retenues utilisent la façade et le layout commun ; la démo `player` n'est pas retenue et les fixtures de test vivent sous `codplay/tests/fixtures`. |
| Authoring éditeur | Reporté à la reprise de l'éditeur | Aucun accès DOM ou API authoring générique à inventer dans la façade actuelle. |

Le code de démonstration historique encore présent sous `packages/demos/src/v2`
doit être évalué par rapport au registry. Un fichier non enregistré qui importe
le catalogue interne n'est pas une preuve de l'architecture publique et ne
doit pas être réintroduit dans le chemin officiel.

## 9. Preuves disponibles et limites de preuve

La vérification automatisée exécutée après cette mise à jour est :

```text
npm test --workspace=codplay       73 fichiers, 473 tests passés
npm run typecheck --workspace=codplay
npm run build --workspace=@codplay/demos
git diff --check
```

Ces résultats prouvent la cohérence de compilation et la couverture automatisée
de la correction. Ils ne prouvent pas :

- le comportement de la démo après changement indépendant des horaires ;
- la résolution visuelle de toutes les combinaisons Play, Seek, resize,
  parent/enfant, reparentage et persistance ;
- la lecture de la vidéo dans Safari ; cette passe Safari concernait
  `flip-stress`, pas `preload-media`.

Les tests de graphe et de runner couvrent déjà les parents en mouvement, les
descendants, les overlays, les recouvrements, l'absence de lecture DOM par
frame et, après cette passe, la frontière cible absente au FIRST mais disponible
au LAST ainsi que l'ordre d'un enfant après son ancêtre à travers un
intermédiaire non présenté. Ils ne remplacent pas la matrice visuelle complète
de la démo.

La vérification Safari après rechargement de `http://localhost:5173/?demo=flip-list`
a confirmé les ordres `transfer-q-frame → Qb` à `2200 ms` et
`transfer-k-frame → Kb` à `2700 ms`. Chaque item contrôlé ne possède alors
qu'une représentation visible. La capture Safari reste une vérification
ponctuelle, pas une preuve de toutes les combinaisons de calendrier.

Une passe Firefox 154.0.1 headless a ensuite contrôlé les seeks exacts autour
de `1200`, `1700`, `2200` et `2700 ms`, puis Play aux frontières correspondantes.
À `1700 ms`, Q conserve `Qb, Qc, Qd, Qe, Qf, Ka` ; à `2200 ms`, Qb n'est
retiré de Q et ajouté à K qu'à sa propre frontière ; à `2700 ms`, Kb n'entre
dans Q qu'à sa propre frontière. Les temps Play observés étaient `1204`,
`1712`, `2208` et `2715 ms`, avec une seule représentation visible par item
contrôlé. Cette preuve confirme le découplage `afterStart`/LAST et le ciblage
direct du mover, sans clôturer la matrice navigateur complète. Aucun code n'a
été modifié pendant la passe.

La perturbation signalée autour de `3670–3700 ms` a été reproduite dans
Firefox 154.0.1 headless. Elle provenait de deux divergences structurelles : le
retarget lisait le `before` brut au lieu du layout naturel immédiatement
pré-frontière, et la pose d'une liste sans piste propre ignorait le segment de
son frame ancêtre déjà mobile. `NaturalLayoutTimeline` conserve maintenant le
snapshot pré-frontière par boundary ; le graphe l'utilise pour le FIRST réel et
résout le parent cible par toute sa chaîne active. Les tests ajoutés couvrent le
slot `afterStart`, le source pré-frontière et l'ancêtre indirect en mouvement.

Une nouvelle passe Seek sur `flip-stress` a contrôlé tous les items aux
frontières `1700`, `2700`, `3700`, `4700`, `5700` et `6700 ms`. Tous restent
présents et continus ; le maximum observé sur un pas de `1 ms` est `2.172 px`
sur `Qa` à `1700 ms`, et `Qc` mesure `1.710 px` à `3700 ms`, sans la rupture
précédente de plus de `40 px`. Play a traversé `3700 ms` de `3698` à `3715 ms`
avec la vitesse normale de la trajectoire. La suite complète est à `73` fichiers
et `473` tests passés ; typecheck, build des démos et `git diff --check` passent.
La validation Safari du nouveau graphe, ainsi que la matrice complète resize,
persistance et changements de calendrier, restent ouvertes. Le statut reste
`En cours`.

La vérification courante ajoute le cas `afterStart` différent de LAST : un
mover structurel conserve son attachement `segment.to` jusqu'à la fin, tandis
que les frères continuent d'utiliser les slots `afterStart`. Le test dédié et
la passe Safari sur `flip-nested` confirment l'absence de saut à la disparition
de l'overlay. La suite actuelle compte `73` fichiers et `475` tests passés.

La passe suivante a raccordé les démos retenues au registry V2. Les anciennes
pages autonomes ont été retirées : les scènes sont chargées par le registry et
`runner` expose ses deux scènes (`runner` et `flip-nested`). Le layout commun compile, précharge,
enregistre les ressources auprès de l'engine, puis crée l'instance publique ;
aucun de ces modules ne construit désormais de catalogue, de player, de runner,
de telco ou de page locale.

Le build Vite et le typecheck V2 passent après cette migration. La vérification
historique Firefox 154.0.1 headless avait monté successivement `?demo=player`,
`?demo=runner` et `?demo=runner-overlay` : remote commun présent, scène montée,
anciennes pages absentes et aucun diagnostic runtime. Ces routes ont depuis été
retirées ou renommées par le registry V2 ; la vérification actuelle porte sur
les routes enregistrées. Le typecheck global de `packages/demos` reste non
concluant à cause d'erreurs historiques dans `src/v1`, sans erreur signalée
dans `src/v2`.

La surface a ensuite été resserrée pour conserver la frontière de construction
de V1 : `new CodPlay(options)` est l'unique entrée publique. Le layout injecte
son `frameScheduler` au constructeur ; `CodPlay` construit le `TimeTicker`
interne et expose seulement `engine`, `instances`, `preload` et `destroy`. `Ticker`, les
factories de ticker et les adaptateurs `EngineFacadeImpl`/`InstanceFacadeImpl`
ne sortent plus des modules publics. Les tests de façade couvrent l'injection
du scheduler ainsi que les modes ticker possédé et frames externes ; le build,
le typecheck, les 473 tests V2 et la passe Firefox headless des trois routes
registry restent passants.

## 10. Procédure obligatoire pour éviter les régressions tournantes

Pour tout prochain changement :

1. citer le plan ou la spécification applicable ;
2. écrire le comportement attendu aux bornes, avec les éléments absents et
   présents explicitement ;
3. vérifier le chemin réel de code et les tests qui le couvrent déjà ;
4. ajouter d'abord un test de non-régression au niveau de la frontière réelle,
   pas seulement un test d'interpolation abstrait ;
5. couvrir les voisins concernés : parent/enfant, chaîne d'ancêtres,
   reparentage, cible absente FIRST / présente LAST, même cible, recouvrement,
   Play, Seek, resize, persistance et lifecycle ;
6. vérifier qu'aucune lecture DOM systématique ni création DOM continue n'a été
   introduite ;
   les appels directs à `getBoundingClientRect()` sont interdits dans le
   circuit FLIP/DND V2, y compris pendant la capture des frontières ; ils
   doivent passer par `captureHtmlPose()`. L'appel interne de cette primitive
   est le point navigateur autorisé et son contexte en mémorise le résultat ;
7. exécuter test, typecheck, build et `git diff --check`, puis la validation
   navigateur nécessaire ;
8. mettre à jour le plan, la spécification ciblée et le statut avant de dire
   « corrigé » ou « fini ».

Si le comportement attendu n'est pas décidé dans un plan ou une spec, on
s'arrête à l'analyse et on demande une décision. Si le comportement est déjà
décidé, on écrit le test qui le prouve et on modifie le circuit existant ; on
ne crée pas une branche de démo, une API miroir ou un fallback destiné à cacher
le défaut.

## 11. Ordre de reprise

L'ordre de travail restant est :

1. exécuter la matrice de non-régression FLIP complète et conserver
   `flip-stress` comme repère visuel ;
2. terminer la validation Seek de `list`/DnD ;
3. reprendre l'écran noir Safari de `preload-media` avec des observations média
   concrètes ;
4. reprendre l'accès authoring avec le chantier de l'éditeur ;
5. nettoyer les anciennes démos et références internes selon un plan séparé.

La correction FLIP ne modifie aucun contrat de façade. La reprise authoring et
le nettoyage des anciennes démos restent des chantiers séparés ; ils ne doivent
pas être mélangés au pilotage telco ni servir à contourner un défaut du core.

## 12. État de la démo `flip imbriqué` au 2026-08-27

La fixture utilise une seule scène `SceneDoc` et le layout commun. Son cas
spécifique est volontaire : l'outlet cible de Q est vide au FIRST et devient
plus haut lorsque Q y est monté au LAST. La hauteur de P doit donc être mesurée
à chacune des bornes et interpolée par le même graphe que sa position. Le
runner ne doit pas remplacer LAST par `afterStart` pour le mover direct ; cette
régression est couverte par le test de graphe correspondant.

Le layout commun possède aussi un mode compact pour les fenêtres courtes. La
vérification Safari effectuée avec une fenêtre demandée de `500 × 300` (soit
`500 × 196 CSS px` exposés à la page) donne une page sans débordement, une scène
de `80 px` et des items visibles dans `runner` et `flip-nested`. Cette règle ne
change ni la scène logique ni le contrat du runner ; elle évite seulement que
les dimensions décoratives de la fixture consomment toute la zone centrale.

La petite largeur a ensuite révélé un second cas de présentation : le minimum
de `3rem` prévu pour l'outlet LAST faisait grandir Q au lieu de le réduire,
et le rembourrage du Q cible s'ajoutait à cette taille. La règle responsive de
`runner/style.css` utilise désormais `clamp(1rem, 5cqw, 2.375rem)` et retire
ce rembourrage. Safari mesure alors Q à `19,19 px` au FIRST et `16,86 px` au
LAST dans une fenêtre demandée de `360 × 500` (`360 × 396 CSS px` exposés).

À hauteur courte, le parent P était contracté à `10 px` par le flex layout
alors que son contenu demandait `33 px`; son débordement masquait Q au LAST.
Le mode compact donne à l'outlet la hauteur disponible et conserve P à sa
hauteur naturelle. L'endpoint compact de Q est `0,75rem`, contre `1rem` au
FIRST : la variation de P reste donc observable et interpolable. Dans une
fenêtre demandée de `500 × 300` (`500 × 196 CSS px` exposés), P passe de
`37,38 px` à `33,38 px`, Q de `16 px` à `12 px`, et B/C restent visibles. Il
s'agit d'une correction de la fixture responsive, sans changement du runner
ou du graphe FLIP.
