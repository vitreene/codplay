# Sighty — convergence des circuits d’exécution

## Statut

**En cours — audit M0 effectué et application des décisions arrêtées engagée
le 2026-09-16.**

Ce plan complète le plan de reconstruction de la navigation :
`2026-09-15-sighty-navigation-reconstruction-plan.md`.
Il ne l’annule pas et ne transforme aucune proposition en contrat avant la
validation de la tranche M0 ci-dessous.

Les décisions de composition publique, de couplage telco et de signaux
`on`/`off` sont arrêtées et appliquées. Le plan reste `En cours` pour la
validation complète et le nettoyage différé des démos ; toute évolution de
transport hors de ce périmètre devra être relue avant qu’un code en dépende.

## 1. Objectif

Éliminer les circuits parallèles qui traitent une même responsabilité avec des
ordres, des garanties ou des états différents.

Le résultat attendu est une architecture Sighty où :

1. toute opération Sighty sérialisable passe par un coordinateur unique ;
2. toute résolution de parcours utilise le même index et les mêmes résolveurs ;
3. toute transition de composition est planifiée une seule fois et appliquée
   par un seul réconciliateur physique ;
4. toute occurrence active est créée, liée et montée par le même cycle de vie ;
   sa destruction est une décision explicite de ce cycle, distincte du reset ;
5. tout envoi d’événement Sighty vers une occurrence passe par une passerelle
   unique, y compris la préservation de l’état de lecture ;
6. toute commande telco passe par l’interface CodPlay canonique ; Sighty ne
   crée qu’un ciblage et une orchestration uniques autour de cette interface ;
7. la configuration CodPlay est transmise avec son héritage, sans valeur
   cachée ajoutée par Sighty ;
8. les démos observent ou expriment un scénario réel, sans reproduire un
   routeur, un registre ou un exécuteur Sighty.

Les capacités telco CodPlay restent accessibles à l’intégration, mais
exclusivement via l’interface `CodPlayTelco` fournie par CodPlay et résolue
pour le slot concerné. Cet accès complet n’est pas un accès brut concurrent :
il désigne le même port unique d’exécution et d’observation. Sighty, le
couplage et les démos peuvent résoudre une cible ou sérialiser une intention,
mais ne créent ni façade telco de remplacement ni autre forme de commande.

## 2. Périmètre et frontières

### 2.1. Dans le périmètre

- `packages/sighty/src/runtime` ;
- les modules d’index et de résolution sous
  `packages/sighty/src/navigation` ;
- les façades et types publics Sighty nécessaires aux opérations unifiées ;
- les démos Sighty 1 à 4 et leurs tests d’intégration ;
- la spécification Sighty, les plans des démos et le suivi d’implémentation.

Les démos sont des instruments de validation non normatifs. Elles révèlent les
failles du contrat ou du runtime ; elles ne justifient jamais la conservation
d’une API, d’un contrôle ou d’un circuit devenu obsolète. Une démo peut donc
être supprimée ou réécrite lorsque le runtime est corrigé.

Demo 4 est la fixture de validation privilégiée de cette convergence. Elle
peut et doit être améliorée dans le cadre de la maintenance de son propre
parcours lorsque cela augmente la couverture, la lisibilité ou la capacité à
révéler une faille. Cette liberté ne l’autorise pas à compenser une capacité
manquante par un circuit local : toute amélioration doit continuer à exercer
les façades, les événements, les transitions, la telco et le cycle de vie
réels.

Demo 1, Demo 2 et Demo 3 sont secondaires pour cette reprise. Après chaque
réécriture du runtime, chacune sera simplement évaluée selon deux issues :

- elle fonctionne proprement avec Sighty et peut être conservée ou reconstruite
  avec peu d’effort ;
- son état actuel ne peut pas être garanti sans conserver un circuit obsolète :
  elle est alors marquée deprecated, retirée du parcours actif et ne bloque pas
  la convergence.

Une démo deprecated n’est pas maintenue artificiellement et ne sert pas de
preuve de fonctionnement. Elle pourra être reconstruite ultérieurement depuis
son scénario si cela devient utile. Aucun travail prioritaire ne sera dérivé
de Demo 1 à 3 tant que Demo 4 et le runtime ne sont pas stabilisés.

### 2.2. Hors périmètre

- une modification opportuniste du cœur `packages/codplay` ;
- une nouvelle politique de persistance Sighty ;
- un transport global de progression ;
- une seconde façade publique ;
- une réécriture du contrat CodPlay d’`idle` ;
- une suppression ou une duplication des capacités `CodPlayTelco` nécessaires
  à l’intégration hôte.

Si une garantie manque dans la façade CodPlay publique, le travail doit être
arrêté à cette frontière et faire l’objet d’un plan CodPlay séparé. Sighty ne
doit pas recréer cette garantie dans un circuit privé.

## 3. Diagnostic établi

### 3.1. Circuits parallèles avérés

#### A. Ancienne voie de montage direct — supprimée

Une ancienne version du runtime exposait `runtime.mountSlot()` et
`runtime.detachSlot()` comme des opérations d’intégration. Cette voie ne
passait ni par la file de navigation, ni par la résolution complète des
politiques `showMode`, ni par la livraison des `data`, ni par les mêmes
garanties d’erreur que `dispatch`.

La décision est maintenant arrêtée : le fichier déclaratif du scénario est la
surface publique auteur de la composition. Le runtime ne propose donc aucune
commande publique de montage ou de détachement ; les montages et détachements
physiques restent internes au réconciliateur appelé par les transitions
résolues depuis le scénario. Les contrôles de Demo 1 qui entretenaient cette
ancienne voie ont été supprimés.

#### B. Préservation de lecture recopiée

Le runtime possède déjà `sendToBinding()` qui capture la position et l’état de
lecture, émet l’événement, repositionne puis reprend si nécessaire.
Demo 4 possède une seconde implémentation de la même séquence dans
`emitTelcoEvent()`.

Les cibles et le contexte diffèrent, mais la garantie technique est la même.
Elle doit appartenir à une passerelle commune, pas à deux fonctions locales.

#### C. Allocation conservée, composition active et reset logique confondus

Le fait qu’une instance CodPlay soit préparée ou conservée sans être montée
n’est pas, en soi, un circuit parallèle. Cela peut être nécessaire pour
préserver l’identité d’une occurrence, préparer une présentation ou permettre
à CodPlay d’appliquer son propre cycle de vie.

La divergence corrigée dans cette tranche était ailleurs : Sighty traitait
cette instance conservée comme une occurrence non active, la déplaçait vers
une occurrence active, puis détruisait et recréait l’instance lors d’un reset.
Cette mécanique confondait quatre notions qui doivent rester séparées :

- l’allocation et la propriété de l’instance CodPlay ;
- l’état de composition de la scène ou du slot ;
- le montage et les bindings actifs ;
- le reset logique de l’état CodPlay.

Le reset CodPlay est précisément prévu pour reconstruire l’état logique sur
l’instance existante. Sighty doit donc réutiliser ce contrat ; la création
paresseuse d’une nouvelle instance ne doit jamais servir de mécanisme de
reset.

#### D. Frontière CodPlay entre initialisation, reset et preload

Sighty possède des entrées d’orchestration nommées `initialize()` et
`resetNow()`, mais l’initialisation réelle d’une instance et son reset logique
relèvent de CodPlay. La façade `owner.instances.create` délègue déjà
l’initialisation au runner/player CodPlay ; Sighty ne doit pas la reconstruire
dans un manager local. De même, `resetNow()` ne doit pas détruire/recréer les
instances : il doit demander le reset CodPlay prévu, puis réconcilier la
composition Sighty.

Le preload est une capacité CodPlay séparée, portée par `owner.preload`. Il
prépare et enregistre des ressources ; il n’est ni une initialisation
d’instance, ni un reset. Le fait qu’une opération Sighty doive éventuellement
attendre des ressources disponibles ne justifie pas de fusionner ces cycles.

#### E. Interface telco CodPlay concurrencée par des voies locales

La façade CodPlay actuelle fournit déjà cette interface spécifique sous le
type `CodPlayTelco`, porté par `instance.telco`. Elle est le port canonique
unique. Les couplages, les transitions, la télécommande et l’hôte l’utilisent
tous ; leurs différences portent uniquement sur la cible, l’admission et la
sérialisation de l’intention.

La voie à supprimer est toute commande locale parallèle qui appelle une
autre surface ou contourne cette interface. L’accès complet à la telco reste
accessible lorsqu’il désigne ce port CodPlay canonique ; il ne constitue pas
une seconde forme d’exécution.

Le pilotage de télécommande n’a de sens que dans le contexte Sighty du
scénario : le fichier déclaratif porte le couplage, la scène telco émet les
événements publics disponibles et Sighty accroche en interne cette source au
binding actif après admission de la composition. Les événements optionnels
`on` et `off` peuvent être fournis par la scène lorsque l’auteur veut activer
volontairement une fonctionnalité. Ils empruntent le circuit public existant ;
Sighty ne crée ni émission implicite, ni interface d’activation concurrente.

#### F. Entrées événementielles directes dans les démos — résolu

Demo 3 envoyait auparavant le contenu et la couleur directement à
`sceneA.events.emit()` depuis sa composition. Ce relais contournait l’admission
déclarée du scénario et entretenait une file locale supplémentaire.

Le parcours est maintenant déclaré sur la vue de la scène telco : les events
publics de la scène et les intentions de l’hôte résolvent une action Sighty,
dont le catalogue utilise `send`. Le seul appel `instance.events.emit()` reste
donc dans `RuntimeSceneEventGateway`, qui porte la passerelle interne unique.

### 3.2. Duplications de calcul à supprimer

- `planCompositionTransition()` est calculé par le transition manager puis
  recalculé par le composition manager ;
- l’énumération map/list des entrées existe dans `view-graph.ts` et dans
  `navigation/graph-index.ts` ;
- les résolutions de destination, d’action et de données sont déjà uniques et
  doivent rester telles quelles ;
- `authoring-validation.ts` et `runtime/catalog-validation.ts` ne sont pas un
  doublon : l’un valide le fichier auteur, l’autre les catalogues
  d’intégration.

### 3.3. Configuration `idle`

CodPlay possède déjà l’héritage :

    CodPlayEngineOptions.idle
      → RuntimeEngine
      → instances dont idle n’est pas explicitement fourni

Sighty court-circuite actuellement cette règle avec
`engine?.idle ?? false` dans `runtime/state.ts`. Cette ligne est une politique
de configuration cachée, pas une propriété interne légitime.

La cible est la transmission transparente de `runtime.codplay`, avec une
valeur `idle` explicite dans la configuration d’intégration lorsqu’une démo ou
une application l’exige.

## 4. Architecture cible

### 4.1. Coordinateur d’opérations unique

Créer un service interne dédié, par exemple `operation-coordinator.ts`, qui
possède la chaîne de sérialisation actuellement conservée dans
`controller.ts`.

Il accepte des opérations normalisées :

- événement entrant d’une liaison CodPlay ;
- événement ou intention de l’application hôte ;
- mise à jour de contexte ;
- reset ;
- mutation ;
- commande telco médiatisée ;
- envoi ciblé vers une occurrence.

Le contrôleur public ne décide plus de l’ordre d’exécution. Il vérifie
uniquement l’état public (`destroyed`, `initialized`) et soumet l’opération.
Le coordinateur conserve la règle d’abandon des opérations obsolètes.

La machine interne d’admission réserve atomiquement une transition dès qu’une
demande est reconnue comme pouvant modifier la composition. Pendant la phase
`changing`, une autre intention de transition retourne `false` avant son
entrée dans la file ; elle n’est ni accumulée ni rejouée. Les commandes
discrètes sans changement de vue restent dans la file unique et ne constituent
pas une seconde voie de synchronisation.

`instance.telco` est le port telco CodPlay canonique lorsqu’il est exposé par
l’intégration. Les opérations Sighty le ciblent et les sérialisent autour de
ce même port ; aucun appel direct de démonstration ne doit ouvrir une seconde
voie d’exécution non coordonnée.

### 4.2. Transition unique et réconciliateur physique

Le transition manager devient le seul propriétaire de :

- la production de `TransitionPlan` ;
- la capture des états sortants ;
- la résolution et l’application de `showMode` ;
- l’ordre pause → préparation → montage → binding → reset CodPlay si
  `showMode: 'reset'` → data → transport ;
- la notification de composition ;
- le rollback d’une transition.

Le composition manager devient un réconciliateur physique sans API de
parcours. Il reçoit un plan déjà calculé et :

- acquiert ou réutilise les occurrences entrantes selon la registry ;
- délègue les relations physiques à un registre de présentation séparé de la
  composition logique ;
- conserve un montage sorti lorsque son host n’est pas repris par une entrée ;
- détache une relation conservée lorsqu’un nouveau child reprend son host sans
  être la sortie active de la transition courante ;
- demande le `replace` CodPlay uniquement lorsque la relation du host appartient
  encore à une sélection active sortante de cette transition ;
- réutilise directement une relation lorsque la même occurrence revient sur le
  même host, puis laisse `showMode` traiter son état ;
- détache ou remplace uniquement les relations qui entrent en conflit, ou lors
  d’une reconstruction et de la destruction du runtime ;
- ouvre ou ferme les liaisons via le binding manager ;
- commit la map de composition ;
- restaure l’état précédent en cas d’erreur.

Il ne doit plus appeler `planCompositionTransition()` et ne possède aucune
API de parcours ou de montage public. Toute sélection de composition vient du
fichier déclaratif et est soumise au même transition manager, qu’elle soit
déclenchée par `dispatch` ou par une `mutate` validée.

### 4.3. Cycle de vie et reset sur instance conservée

La composition logique active et la présentation physique ne sont pas un même
registre. La première détermine les bindings, le couplage, les événements
admis et les observations publiques. La seconde conserve les relations de
montage nécessaires au layout, y compris lorsqu’une branche sortante n’est
plus active. Un carousel imbriqué, un dashboard ou plusieurs zones de scène
peuvent donc conserver des racines sans fabriquer une nouvelle route Sighty.

Une sortie logique ferme sa liaison et peut arrêter sa lecture, mais ne fait
pas disparaître physiquement son montage par défaut. Un montage est réellement
détaché quand un nouveau child doit occuper le même host sans `replace`, quand
CodPlay effectue un `replace`, ou quand Sighty reconstruit ou détruit la
présentation. Cette règle est interne : elle n’ajoute pas de propriété
`active`/`inactive` à l’API auteur ni à l’API d’intégration.

La présence d’une déclaration `replace` ne suffit pas à déclencher un
remplacement visuel. Elle ne s’applique qu’à une relation encore active dans
la composition précédente et sortie dans la transition courante. Ainsi,
`scene A → scene B` dans le chapitre peut produire le remplacement déclaré,
mais `scene A → menu → scene B` est un accès direct à B : la relation A
conservée hors composition est détachée sans snapshot CodPlay. La réadmission
de A réutilise sa relation conservée et ne déclenche pas de remplacement.

Le scene manager doit gérer une registry d’occurrences dont l’identité
physique est stable. Les états de cette registry sont distincts de la
composition visible ; les noms exacts restent à valider en M0, mais le modèle
doit au minimum distinguer :

1. une instance préparée ou conservée ;
2. une occurrence active dans la composition ;
3. une occurrence et sa relation de présentation conservées hors composition ;
4. une instance effectivement détruite.

Une instance et son montage peuvent donc être conservés hors composition si
la présentation les possède encore. Ils ne doivent simplement pas être
confondus avec une sélection active, ni être retournés par une résolution qui
exige une occurrence active. Il faut supprimer la sémantique implicite qui
déplace une instance préparée vers une adresse active et les adresses
techniques qui masquent ces états, pas supprimer automatiquement une relation
physique dont le layout a encore la charge.

Le comportement cible est :

- l’initialisation alloue une instance seulement lorsqu’une occurrence doit
  exister et enregistre son identité ;
- une réadmission retrouve l’instance conservée lorsqu’elle existe ;
- `showMode: 'reset'` demande le reset logique CodPlay sur cette même instance ;
- `showMode: 'maintain'` conserve son état selon le contrat d’héritage ;
- `showMode: 'rewind'` reste une commande de transport distincte ;
- `runtime.reset()` réinitialise les instances retenues via CodPlay, puis
  réconcilie la composition et les bindings ; il ne détruit/recrée pas les
  instances pour obtenir un état initial ;
- une création à la volée reste réservée à l’allocation initiale d’une
  occurrence absente ou à l’apparition d’une nouvelle occurrence distincte,
  jamais à la résolution d’un reset.

`getInstance(sceneKey)` et `getInstanceAt(slotAddress)` doivent ensuite être
spécifiés selon cette séparation : une résolution active ne doit jamais
retourner silencieusement une instance préparée, tandis qu’une éventuelle
surface d’intégration visant une instance conservée doit utiliser un
adressage et un état explicitement documentés. Aucun fallback opportuniste ne
doit être ajouté.

### 4.4. Délégation du cycle CodPlay et orchestration Sighty

Sighty ne doit pas créer un service qui réimplémente l’initialisation ou le
reset de CodPlay sous les noms `initialize()` ou `resetNow()`. Les
responsabilités sont séparées :

- le propriétaire CodPlay initialise une occurrence lorsque
  `owner.instances.create` est appelé ;
- le propriétaire CodPlay applique le reset logique chaud sur l’instance
  conservée, par son circuit normal ;
- le scene manager Sighty associe une occurrence à une sélection, sans
  rappeler directement le player interne ;
- le composition manager Sighty invalide les bindings, transmet les opérations
  au registre de présentation et publie la composition logique ;
- le mutation manager Sighty coordonne la politique de mutation et demande à
  CodPlay le reset voulu, mais ne reconstruit pas l’état du player ;
- la destruction passe uniquement par `owner.instances.destroy` lorsqu’elle
  est explicitement requise.

Le preload reste dans un service de ressources distinct. Son cycle est :

    owner.preload.load(...)
      -> owner.resources.register(...)
      -> owner.instances.create(...)

Cette chaîne décrit trois opérations séparées. Le preload peut être exécuté
comme précondition explicite d’une entrée Sighty, mais il ne doit pas être
déclenché par le reset et ne doit pas être caché dans une primitive de cycle de
vie d’instance. La surface exacte d’une éventuelle commodité Sighty sera
validée en M0.

### 4.5. Passerelle unique d’événements vers une scène

Créer une passerelle interne dédiée, par exemple
`scene-event-gateway.ts`, qui centralise :

- la résolution d’une scène unique ou d’une adresse de slot ;
- la vérification de l’occurrence et de la liaison active ;
- l’émission vers `instance.events` ;
- la politique de préservation du transport ;
- l’abandon si la sélection devient obsolète.

La forme interne proposée est un seul service avec des requêtes explicites :

    sendToSelection(selection, eventime, target, { transport: 'preserve' })
    sendToActiveScene(sceneKey, eventime, target, { transport: 'current' })

Ces opérations sont strictement discrètes : une requête produit au plus un
envoi d’événement pour une intention donnée. La passerelle ne doit jamais être
appelée par une observation de progression à chaque frame, ni transformer une
valeur continue en événement Sighty, en entrée de journal ou en
progress:update. La préservation du transport entoure uniquement cet envoi
ponctuel.

Les valeurs `preserve` et `current` doivent être confirmées en M0 ; elles
servent à rendre les différences de sémantique explicites sans recopier
l’algorithme technique.

`sendToBinding()` et `sendToActiveScene()` deviennent des résolutions de
cible minces vers cette passerelle. La sauvegarde de la position, le seek de
restauration et la reprise éventuelle ne doivent exister qu’à un seul endroit.

Aucune API publique Sighty ciblée ne fait partie du plan. La surface publique
reste le fichier déclaratif du scénario, ses actions et `dispatch`/`mutate` ;
la passerelle reste un service interne du runtime. Une démo ou une intégration
ne doit pas fabriquer une façade concurrente pour atteindre une occurrence.

### 4.6. Interface telco CodPlay unique et ciblage Sighty

L’interface telco spécifique exposée par CodPlay est le seul exécuteur des
commandes :

- `play` ;
- `pause` ;
- `togglePlay` ;
- `setRate` ;
- `seek` ;
- `rewind` ;
- `reset`.

Le coupling manager, les opérations publiques `play`/`playAll` et la
télécommande commune ne font que résoudre la cible et soumettre l’intention à
ce port. Les conversions `rate`, `timeMs` et `value` sont regroupées dans
l’adaptateur de ciblage ; il ne réimplémente aucune commande.

L’application hôte conserve l’accès à la capacité CodPlay complète via ce
port canonique lorsque le contrat l’autorise. Il n’existe pas de choix entre
un chemin Sighty et un chemin CodPlay concurrent : le premier est une
orchestration de cible, le second est le port d’exécution unique.

### 4.7. Configuration CodPlay héritée

`createSightyCodPlayOptions()` doit disparaître ou devenir une transmission
sans modification. Sighty ne doit pas écrire `idle: false` lorsque
`runtime.codplay.engine.idle` est absent.

Le contrat cible est :

- option absente : CodPlay applique son défaut d’engine ;
- option `idle` présente sur l’engine : elle est héritée par les instances ;
- option explicite `idle: false` : elle désactive l’inactivité selon le contrat
  CodPlay ;
- aucune valeur interne Sighty ne se substitue à cette résolution.

Les démos qui ne veulent pas d’inactivité doivent le déclarer explicitement
dans leur configuration d’intégration. Une configuration spécifique à une
seule scène ne sera pas inventée dans cette tranche ; elle nécessiterait un
contrat CodPlay/Sighty distinct.

### 4.8. Énumération unique du graphe

Extraire la lecture brute des entrées map/list dans un utilitaire de
navigation partagé. Cet utilitaire fournit les clés et les vues dans l’ordre
auteur ; l’index ajoute ensuite ses métadonnées (`path`, `graphPath`,
`hidden`, scopes et maps de recherche).

La normalisation v1 reste à la frontière de `view-graph.ts`. L’index reste le
seul modèle de navigation exécutable. Cette extraction ne doit pas créer un
second graphe.

## 5. Réécriture des démos

La réécriture des démos 1 à 3 est différée. Aucun travail de reconstruction,
de compatibilité ou de validation navigateur sur ces trois parcours ne bloque
le runtime, la convergence des circuits ou Demo 4. Les lignes ci-dessous
constituent les conditions de leur éventuelle réactivation ; elles ne sont pas
des tâches du chemin critique actuel.

### Demo 1

- supprimer `packages/demos/src/sighty/demo1/page-controls.ts` ;
- retirer son import et `createOptionalControls` de `demo1/main.ts` ;
- conserver uniquement le scénario réel, la composition Sighty et les surfaces
  communes de la page qui restent nécessaires aux autres démos ;
- ne pas recréer de contrôles de montage/détachement sous un autre nom ;
- ne conserver aucun test ou adaptateur qui suppose une API publique de
  montage/détachement ; les opérations physiques se vérifient uniquement au
  travers du parcours déclaratif réel ;
- ne pas traiter une instance préparée mais inactive comme une occurrence
  active ; si le parcours ne peut pas être garanti par le chemin Sighty réel,
  appliquer la politique `deprecated` ci-dessous.
- si le parcours restant ne peut pas être garanti proprement, le marquer
  deprecated et le retirer du registre actif au lieu de le réparer localement.

### Demo 2 — reprise différée

- conserver le couplage déclaré dans le fichier ;
- conserver la souscription unique à `runtime.events` pour le journal ;
- vérifier que les commandes de télécommande et les transitions partagent le
  coordinateur ;
- ne pas ajouter de relais local.

### Demo 3 — reprise différée

- conserver le scénario de relais public telco → Sighty ;
- utiliser l’action déclarée de la vue telco, qui délègue à la passerelle Sighty
  validée ;
- ne pas créer de catalogue de couplage ou de routeur dans la démo ;
- ne pas créer de chaîne locale ni de second coordinateur de navigation.

### Demo 4

- améliorer la fixture si nécessaire pour mieux tester les refactorings,
  notamment les répétitions, les retours menu/scène, les fins de séquence et
  les erreurs de transition ;
- conserver deux conteneurs directs dans `scene-layout` : le slot menu sert
  directement de conteneur du menu, tandis qu’un conteneur chapitre stable porte
  les hôtes scène et telco ; le viewport carousel est porté par la racine du
  layout, sans wrapper intermédiaire ;
- au retour vers le menu, faire sortir le conteneur chapitre par opacité
  (`1 → 0`) sans translation horizontale ; le menu entre de bas en haut ; la
  scène et le telco restent présents dans le conteneur sortant pendant cette
  transition ;
- supprimer `emitTelcoEvent()` après migration vers la passerelle commune ;
- conserver l’observation `onProgress` et la projection d’entrée, qui sont le
  chemin CodPlay prévu pour la progression continue ;
- ne produire aucun événement continu : onProgress reste une observation
  CodPlay locale et ne passe ni par runtime.events, ni par dispatch, ni par un
  événement progress:update ;
- conserver `showMode: 'reset'` dans le fichier auteur ;
- vérifier que ce reset remet l’état attendu à zéro sans changer l’identité
  de l’instance CodPlay ;
- supprimer toute révision locale qui ne serait plus nécessaire après
  l’invalidation Sighty ;
- faire transiter les changements de vue et les commandes par le runtime
  unique ;
- garder `pauseOnDocumentHidden: false` comme configuration explicite de test
  navigateur ;
- déclarer explicitement la politique `idle` retenue, sans la recevoir d’un
  défaut caché de Sighty.

Toute évolution visuelle ou ergonomique de Demo 4 doit rester au service de
la vérification du runtime. Elle ne peut ni ajouter un routeur local, ni
reproduire une transition, une liaison, une gestion de fin ou une politique de
lecture que Sighty doit fournir.

## 6. Ordre d’implémentation et gates

### M0 — audit de cohérence et décisions résiduelles

Avant tout code dépendant, vérifier la cohérence du présent plan avec les contrats déjà
acceptés ou les décisions déjà arrêtées. La vérification doit relire au
minimum :

- le plan général CodPlay V2 ;
- le plan de façade engine/instances/telco ;
- la note de découverte CodPlay V2 imposée comme point de reprise ;
- la spécification et le plan Sighty déjà engagés, en distinguant leurs
  décisions arrêtées de leurs propositions encore ouvertes ;
- le plan `Fini` de projection de progression, pour ne pas réintroduire son
  transport événementiel.

Produire une matrice de conformité qui classe chaque point en trois catégories :

1. conforme à un contrat déjà accepté : on le conserve et on ne le revalide
   pas ;
2. divergence d’implémentation : elle est corrigée conformément au contrat,
   sans créer de compatibilité parallèle ;
3. décision absente ou nouvelle : elle reste `A relire` et doit être acceptée
   avant le code qui en dépend.

Les invariants déjà arrêtés à contrôler sont notamment :

- `CodPlayTelco` est le port telco CodPlay unique ; Sighty ne crée aucun
  exécuteur concurrent ;
- `instance.events.emit` et l’entrée CodPlay correspondante aboutissent au
  circuit d’events unique ; aucun flux continu ne passe par les events ;
- `initialize`, le reset logique CodPlay et `preload` restent trois frontières
  distinctes ; `showMode: 'reset'` conserve l’instance ;
- `scene:end`, `sequence:end`, `accessBy`, `exitBy`, l’héritage de
  `showMode` et la configuration héritée de `idle` conservent leurs
  sémantiques arrêtées ;
- Demo 4 est la fixture prioritaire ; les démos 1 à 3 sont différées et ne
  constituent pas une gate.

Le seul sujet à soumettre à une validation nouvelle est une politique de
transport (`transport: 'preserve'` ou `transport: 'current'`) si sa sémantique
n’est pas déjà acceptée. Le couplage n’ouvre pas une seconde autorité de
pilotage : ses déclarations et les événements publics de la scène telco sont
traités par Sighty dans le contexte du scénario. L’accès d’intégration à
`CodPlayTelco` reste, lui, le port CodPlay canonique déjà accepté.

**Sortie M0 :** matrice de conformité établie, divergences rattachées à leur
contrat source et seules les décisions nouvelles identifiées comme `A relire`.
Tant que ces décisions nouvelles ne sont pas acceptées, aucun module
d’exécution qui en dépend ne doit être modifié ; les divergences indépendantes
déjà rattachées à un contrat accepté peuvent être corrigées.

#### Résultat initial de l’audit — 2026-09-16

| Point contrôlé | Référence | Classement |
| --- | --- | --- |
| Interface telco unique `CodPlayTelco` portée par `instance.telco` | Plan CodPlay de façade engine/instances/telco ; façade CodPlay actuelle | Conforme ; aucune interface Sighty ou démo concurrente à créer |
| `instance.events.emit` et l’entrée événementielle CodPlay | Note de découverte CodPlay V2 §3.3 ; plan de façade CodPlay §5 | Conforme ; Demo 3 délègue maintenant à la passerelle interne et le seul appel d’exécution reste dans `RuntimeSceneEventGateway` |
| `initialize`, reset logique et `preload` | Note CodPlay V2 §§3.1–3.4 ; plan de reset chaud ; décision acceptée le 2026-09-16 | Contrat sémantique conforme ; `resetNow()` réutilise les occurrences et délègue à `instance.telco.reset()` ; le reset CodPlay efface la session runtime sans effacer les eventimes auteur compilés |
| `showMode`, `accessBy`, `exitBy`, `scene:end` et `sequence:end` | Spécification Sighty et plan de reconstruction, décisions arrêtées dans la reprise | Conforme documentaire ; à prouver par les tests sans réouvrir les sémantiques |
| Progression vivante | Plan Sighty de progression `Fini` ; façade `CodPlayTelco.onProgress` | Conforme ; aucun `progress:update` ni événement continu |
| Héritage `idle` | Façade CodPlay `engine.idle` → instance ; décision Sighty explicite | Conforme après suppression de la surcharge `idle ?? false` dans `runtime/state.ts` ; test d’héritage ajouté |
| Priorité des démos | Décision de reprise | Demo 4 est la fixture bloquante ; Demo 1 à 3 sont différées et non bloquantes |
| `mountSlot`/`detachSlot` | Décision auteur du 2026-09-16 : le fichier déclaratif du scénario est la surface publique de composition | Primitives retirées de l’API ; montage et détachement conservés en interne uniquement |
| Passerelle événementielle interne et couplage telco `on/off` | Passerelle interne déjà présente ; déclaration de couplage dans le scénario | Conforme après décision KISS : la scène telco émet les événements publics ; Sighty accroche en interne le binding actif ; `on`/`off` restent optionnels et volontaires, sans nouvelle API |

La spécification Sighty et le plan de reconstruction décrivent désormais le
reset logique CodPlay sur l’instance conservée. Toute mention résiduelle de
destruction/recréation est une divergence documentaire à corriger, pas une
permission de conserver ce circuit dans l’implémentation.

#### Application engagée — 2026-09-16

Les décisions indépendantes déjà arrêtées sont maintenant appliquées :

- `runtime/state.ts` transmet `runtime.codplay` sans injecter de valeur
  d’`idle` ; un test Sighty vérifie l’héritage effectif de l’engine vers une
  instance active ;
- la chaîne d’opérations du contrôleur est portée par
  `RuntimeOperationCoordinator`, et `play`/`playAll` rejoignent cette chaîne ;
- `RuntimeNavigationStateMachine` réserve la phase `changing` dès l’admission
  d’une intention de transition ; une seconde intention concurrente est
  rejetée avant d’entrer dans la file ;
- `RuntimeTransitionManager` est le seul producteur de
  `CompositionTransition` ; le composition manager reçoit désormais le plan
  déjà calculé et ne possède aucune façade de montage public ;
- `RuntimeSceneEventGateway` porte l’unique émission Sighty vers
  `instance.events.emit`, avec la préservation ponctuelle du transport au même
  endroit ;
- l’énumération map/liste brute du graphe est partagée par
  `navigation/graph-entries.ts` et ne possède plus deux implémentations.
- les primitives publiques `mountSlot`, `detachSlot` et `isSlotMounted` ont été
  retirées ; la composition est modifiée uniquement par le parcours déclaré,
  tandis que `getMountedSceneKey` et `onSlotChange` restent des observations.
- les wrappers one-shot `findGraphViewByScene` et `isSightyViewMap` ont été
  retirés ; l’énumération auteur passe par `navigation/graph-entries.ts`, et
  la localisation mutable des mutations partage désormais un seul parcours
  de graphe au lieu de recopier celui de `replaceEntry` et `removeEntry`.
- `RuntimePresentationManager` porte désormais le registre interne des
  relations physiques ; la sortie logique ferme les bindings sans démonter
  automatiquement un host qui n’est pas repris, tandis que les conflits,
  reconstructions et rollbacks restent traités par le même circuit CodPlay.

Le reset d’occurrence est maintenant raccordé à `instance.telco.reset()` ; la
passerelle événementielle reste interne et aucune API Sighty ciblée n’est
ajoutée. Le couplage telco suit désormais le circuit arrêté : déclaration dans
le scénario, événements publics émis par la scène telco, accrochage interne
par Sighty après admission, et signaux `on`/`off` seulement lorsqu’ils sont
volontairement fournis par la scène.

#### Résolution de la divergence CodPlay — 2026-09-16

Le parcours navigateur confirme que la scène C atteint la borne déclarée de
`10 s` et passe à `sequenceEnded`. Le correctif CodPlay promu dans le plan
player-engine fait maintenant rejoindre l’occurrence compilée `sequence:end`
au `RuntimeTrackJournal`, puis au `RuntimeEventDispatcher` existant. Les
règles `listen`, les straps, les émissions déclarées, la reconstruction et la
publication `public` empruntent ainsi le circuit standard ; la copie compilée
est écartée lors de la materialisation après sa promotion pour éviter tout
double traitement.

Sighty n’ajoute aucun observateur privé de `sequenceEnded`, aucune écoute
parallèle et aucun transport continu : il reçoit seulement l’event public
produit par CodPlay. Le terminal reste ensuite traité par les conséquences
CodPlay prévues, sans destruction implicite de l’occurrence.

### M1 — coordinateur d’opérations

- extraire la sérialisation du contrôleur ;
- verrouiller l’admission des intentions de transition avec la machine d’état
  interne ;
- représenter les opérations publiques et les événements liés sous un type
  interne unique ;
- soumettre `dispatch`, context, reset, mutate et play à ce coordinateur ;
- conserver l’invalidation des bindings avant toute opération obsolète ;
- ajouter les tests de concurrence et de rejet.

**Gate :** aucune opération Sighty sérialisable ne possède une seconde file ou
un appel direct au transition manager depuis la façade.

### M2 — transition et composition

- faire produire le plan une seule fois ;
- faire accepter le plan au composition manager ;
- supprimer ses appels directs au planificateur ;
- vérifier pause, replacement, binding, data, showMode, notification et
  rollback dans le même ordre pour toute sélection issue du scénario.

**Gate :** une opération de sélection, quelle que soit son origine, suit la
même transition observable.

### M3 — cycle de vie et reset logique

- remplacer le déplacement implicite d’une occurrence préparée vers l’état
  actif par une registry d’occurrences dont l’état actif est explicite ;
- conserver et réutiliser l’instance CodPlay lorsqu’une occurrence existe
  déjà ;
- appeler `instance.telco.reset()` pour `showMode: 'reset'` et
  `runtime.reset()`, sans `destroy`/`create` comme mécanisme de
  réinitialisation ;
- réserver la création à une occurrence réellement absente ou nouvelle ;
- retirer les primitives Sighty qui réimplémentent l’initialisation ou le reset
  CodPlay ; conserver uniquement l’orchestration de composition et le rollback
  de ses propres états ;
- isoler le preload dans le service de ressources, avec une acquisition
  explicite avant création lorsque les ressources sont requises ;
- spécifier puis appliquer les résolutions `getInstance`/`getInstanceAt` sans
  fallback silencieux d’un état préparé vers un état actif ;
- vérifier les scènes répétées, les slots imbriqués, les mutations et
  l’identité stable des instances.

**Gate :** une navigation ou un reset répété conserve le même identifiant
d’instance lorsque l’occurrence est conservée ; aucun `destroy`/`create` ne se
produit comme conséquence d’un reset. Les builds et ressources restent
réutilisables indépendamment de l’état de montage.

### M4 — événements et commandes

- introduire la passerelle d’événements ;
- faire déléguer les chemins runtime existants à cette passerelle ;
- faire passer Demo 4 et Demo 3 par la passerelle interne ; Demo 1 et Demo 2
  ne sont pas dans le chemin critique ;
- faire déléguer toutes les commandes à l’interface telco CodPlay canonique ;
- réduire Sighty au ciblage, à l’admission et à la sérialisation ;
- aligner la télécommande commune sur ce port unique ;
- couvrir scène sortie, scène répétée, occurrence ambiguë et événement
  obsolète.

**Gate :** une seule implémentation de préservation du transport, un seul port
telco CodPlay et aucun appel de démo qui ouvre une voie de commande concurrente.
Les émissions d’événements inter-scènes passent également par la passerelle
retenue.

### M5 — configuration et utilitaires

- supprimer l’écrasement interne de `idle` ;
- ajouter les tests d’héritage engine → instance et de surcharge explicite ;
- séparer le chemin `preload` du cycle `initialize`/`reset`, en déléguant le
  chargement et l’enregistrement au service CodPlay dédié ;
- extraire l’énumération map/list ;
- rechercher et supprimer les wrappers one-shot devenus inutiles ;
- conserver uniquement les helpers qui portent une garantie utilisée par au
  moins deux chemins ou une frontière publique.

**Gate :** la valeur `idle` omise est observée comme une valeur héritée de
CodPlay et non comme `false` injecté par Sighty ; le preload n’est appelé ni
comme un reset, ni comme une initialisation interne d’instance.

### M6 — nettoyage documentaire et des démos

- supprimer le code mort rendu inatteignable ;
- ne pas réécrire Demo 1 ou Demo 2 dans le chemin critique ; les évaluer
  seulement après stabilisation du runtime et de Demo 4 ; pour chaque
  démo non garantie, inscrire le marquage deprecated, la retirer du registre
  actif et supprimer ses branches devenues sans consommateur ;
- supprimer `packages/demos/src/sighty/demo1/page-controls.ts` et la fabrique
  de contrôles correspondante dans `demo1/main.ts` ;
- retirer les commentaires décrivant les anciens circuits ;
- mettre à jour le plan Demo 4 et le plan de progression ; les plans Demo 1 à 3
  restent différés et ne sont actualisés qu’à leur réactivation ;
- mettre à jour la spécification Sighty ;
- ne pas conserver de compatibilité silencieuse ni de pont temporaire non
  nommé.

**Gate :** les recherches statiques ne trouvent plus les anciennes voies
parallèles, sauf dans l’historique documentaire explicitement conservé comme
décision.

### M7 — validation complète

Exécuter la suite complète applicable :

- validation auteur et index ;
- routes, héritage, `accessBy`, `exitBy` et `onDenied` ;
- transitions concurrentes et rollback ;
- `reset`, `maintain`, `rewind` et réadmission ;
- identité stable de l’instance et état remis à zéro par reset ;
- `scene:end` et `sequence:end` ;
- instances répétées et adressage par slot ;
- data `entry`/`live`, context et mutations ;
- commandes `play`, `pause`, `togglePlay`, `setRate`, `seek`, `rewind`, `reset` ;
- événements publics, couplage et invalidation ;
- réconciliation interne des montages, détachement, replacement, ressources et
  destruction ;
- progression live sans `progress:update` ;
- typecheck, tests, build et validation Safari MCP ;
- parcours complet de Demo 4, avec répétitions et retour arrière ; parcours
  des démos 1 à 3 uniquement lorsqu’elles restent actives et garanties.

Une catégorie ne peut être omise qu’avec une analyse causale écrite prouvant
qu’elle n’est pas affectée.

## 7. Critères d’acceptation structurels

Les recherches et revues de code doivent confirmer :

- un seul `createViewIndex` par version de scénario ;
- un seul résolveur de route ;
- une seule file d’opérations Sighty ;
- un seul producteur de `TransitionPlan` par opération ;
- un seul réconciliateur physique ;
- aucune sémantique implicite qui transforme une instance préparée en
  occurrence active ;
- aucune résolution active de `getInstance` vers une scène préparée,
  détachée ou ambiguë ;
- aucun `destroy`/`create` utilisé pour simuler un reset ;
- une occurrence conservée garde son identité physique lors d’un reset ;
- une seule passerelle de sortie vers `instance.events.emit` ;
- une seule implémentation de préservation du transport ;
- une seule interface CodPlay d’exécution des commandes telco ;
- aucun exécuteur Sighty concurrent ; Sighty ne fait que cibler et séquencer ;
- aucun `idle ?? false` caché dans Sighty ;
- aucune copie locale de routeur, index ou coupling dans les démos ;
- aucun contrôle de démo ne maintient artificiellement une API Sighty ;
- aucune méthode publique `mountSlot`, `detachSlot` ou `isSlotMounted` n’existe ;
  aucune démo ne contourne le fichier déclaratif pour modifier la composition ;
- Demo 4 reste une fixture d’acceptation du runtime, pas une source normative
  ni une implémentation de secours ;
- Demo 1 à 3 sont soit validées par le chemin Sighty réel, soit explicitement
  marquées deprecated et absentes du parcours actif ;
- aucun transport `progress:update` ;
- aucune persistance du parcours dans Sighty.

## 8. Critères d’acceptation comportementaux

Pour toute origine équivalente — navigation, événement de scène ou commande de
couplage — :

- la composition cible est résolue avec le même index ;
- les mêmes conditions sont évaluées ;
- les mêmes sélections `retained`, `entered` et `exited` sont produites ;
- les mêmes liaisons sortantes sont invalidées ;
- les mêmes règles `showMode` sont appliquées ;
- les données sont livrées dans le même ordre ;
- une erreur restaure la composition précédente ;
- aucun événement obsolète ne peut piloter une scène sortie.

Le port telco CodPlay reste accessible selon le contrat d’intégration. Il est
la seule voie d’exécution ; les façades Sighty et les démos ne doivent pas
introduire une commande parallèle ou contourner sa coordination.

## 9. Suivi

| Tranche | Statut initial | Passage |
| --- | --- | --- |
| M0 — audit | En cours | matrice de conformité établie ; les divergences sont rattachées aux contrats acceptés et aucune décision nouvelle ne porte le code appliqué |
| M1 — opérations | En cours | file extraite dans `RuntimeOperationCoordinator` ; dispatch, contexte, reset, mutation et commandes de lecture partagent cette file ; les transitions sont verrouillées dès l’admission et les tentatives concurrentes sont rejetées |
| M2 — transitions | En cours | plan unique transmis au réconciliateur ; présentation physique séparée de la composition logique ; `replace` limité à la sortie active de la transition et accès `menu → scène` sans faux remplacement couverts par Demo 4 ; parcours complets à poursuivre |
| M3 — cycle/reset | En cours | `instance.telco.reset()` est intégré à `showMode` et `runtime.reset()` ; Demo 4 prouve l’identité conservée et le reset de session, les erreurs partielles et validations navigateur restent ouvertes |
| M4 — événements/telco | Fini | passerelle interne unique active ; les sept commandes telco, dont `reset`, sont couvertes par le couplage ; Demo 3 et Demo 4 passent par les actions déclarées et la passerelle interne, sans événement continu ni nouvelle API publique ; les signaux `on`/`off` restent optionnels et volontaires |
| M5 — configuration/DRY | En cours | héritage `idle` transmis sans surcharge Sighty ; énumération et localisation du graphe mutualisées ; wrappers one-shot sans sémantique supprimés ; revue globale à poursuivre sur les parcours différés |
| M6 — nettoyage | En cours | contrôles obsolètes de Demo 1 supprimés avec leur CSS et leur preuve dédiée ; Demo 4 nettoyée, avec hôtes physiques distincts pour le menu et le conteneur chapitre ; Demo 3 ne possède plus de relais direct ni de file locale et passe par l’action déclarée et la passerelle Sighty ; les démos 1 et 2 restent différées |
| M7 — validation | En cours | Sighty : 31 tests ; CodPlay : 655 tests et typecheck ; démos : typecheck et build ; les régressions Demo 4 vérifient le fade sans translation du conteneur chapitre, la présence simultanée de scène + telco pendant le retour, le `replace` direct entre scènes et l’absence de faux `replace` après retour menu ; Safari MCP a validé le rechargement Demo 4, menu → scène A, pause/reprise, rewind, rejet d’une navigation rapide et le retour automatique C → menu sur `sequence:end`, sans warning/error ; la matrice navigateur complète et les démos 1 à 3 restent différées |

Le plan reste `En cours` : M4 est terminé, tandis que la validation complète
du runtime et l’évaluation différée des démos 1 à 3 restent à poursuivre.
