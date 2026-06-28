# Plan — unifier l'exécution des actions, puis livrer le détachement DOM (`move:"off"`)

## Statut

Phases 1 et 2 **livrées** le 2026-06-28 (voir détail dans chaque section). Phase 3
(`move:"off"` et démo dédiée) **non implémentée** — prochaine étape. Cadrage issu d'une discussion
approfondie le 2026-06-28, déclenchée par la question initiale "détacher un nœud DOM en cours de
lecture" (note de départ : `2026-06-27-quiz-hunt-seek-mounted-persos-plan.md`). Trois phases,
exécutées **dans cet ordre**, chacune vérifiée avant de passer à la suivante.

## Origine et constat

`packages/demos/src/scenes/quiz-hunt/PRATIQUES.md` (item 3) propose d'attacher/détacher
dynamiquement les panneaux de contenu plutôt que de tous les monter à l'init et piloter leur
visibilité par `display`. En creusant la faisabilité (`2026-06-26-mount-unmount-seek-intention.md`,
puis la discussion ayant produit ce document), il est apparu que le socle d'exécution des actions
n'est pas assez unifié pour porter cette capacité proprement : il existe aujourd'hui **deux
circuits d'application des actions, écrits à des moments différents, qui ne se rejoignent à aucun
endroit du code**. Tant que ce socle n'est pas réorganisé, `move` reste structurellement
inatteignable depuis certaines formes d'action — ajouter `move:"off"` par-dessus l'état actuel
reviendrait à empiler un cas particulier sur une fondation déjà contradictoire.

Décision de méthode : on répare le socle d'abord (Phase 1), on installe la structure d'auteur
correcte par-dessus (Phase 2), puis on livre la fonctionnalité demandée (Phase 3). Cet ordre n'est
pas arbitraire — il a été choisi précisément pour éviter de reproduire le problème qu'on corrige.

## Diagnostic détaillé — un circuit de commits, et un circuit d'interpolation continue qu'on a eu tort de lier au premier par leur nom commun

Affirmation de principe, à porter dans toute réécriture de spec à partir d'ici : **`TweenAction` et
`TweenSequence`/`ActionSequence` ne sont pas deux variantes d'une même notion.** Le seul fait
qu'elles aient partagé un nom (`Tween...`) et un même fichier de spec a produit une dérive
d'interprétation — analyser `TweenSequence` comme "un tableau de `TweenAction`" — qui ne correspond
ni à un besoin d'auteur réel, ni à une nécessité d'implémentation. Cette dérive ne doit plus
apparaître dans aucune spec issue de ce plan. Les deux mécanismes sont décrits séparément
ci-dessous, et le sont également en code à partir de la Phase 1/Phase 2.

### Circuit normal (porte `move`, `style`, `content`, `attr`, `className`)

`director.runTimelineEvent` (`create-director.ts:88`) résout un event en une ou plusieurs actions
résolues, chacune enveloppée dans un commit (`create-director.ts:140`). Le commit est mis en file
chez le renderer (`create-renderer.ts:362`) et appliqué à son tour de tick (`create-renderer.ts:377`)
via `orchestrator.routeUpdates` (`create-renderer.ts:392`), qui appelle pour chaque action résolue
la fonction **actuellement nommée `routeResolvedUpdate`** (`runtime-component-orchestrator.ts:583-648`)
— renommée `triggerResolvedAction` à partir de la Phase 1 (voir plus bas, le nom actuel ne porte pas
ce que la fonction représente une fois ce plan livré). Cette fonction exécute, pour chaque action
résolue, un point d'entrée `beforeUpdate` (`runtime-component-orchestrator.ts:608`) — c'est ce point
d'entrée qu'écoute le module `move` (`runtime/modules/move/index.ts:278`, filtré sur
`actionKeys: ['move']`) — puis applique l'action sur le composant, puis exécute `afterUpdate`.

C'est le seul circuit par lequel une action discrète — y compris une étape `move` issue d'une
`ActionSequence` — doit jamais passer.

### Circuit `TweenAction` — bas niveau, légitimement séparé, jamais porteur de `move`

`TweenAction` est un moteur d'interpolation continue. Sa place naturelle est **en dessous** du
circuit de commits, au même niveau que la bibliothèque d'animation externe quand elle anime une
action statique à options de durée : ni l'une ni l'autre n'a besoin de repasser par
`beforeUpdate`/`afterUpdate` à chaque frame, parce qu'aucune des deux n'a vocation à transporter
une clé `move` ou à déclencher un module. Une fois `TweenAction` et `ActionSequence` détachées
l'une de l'autre (voir Vocabulaire), ceci n'est plus un trou de câblage à corriger mais une
séparation de niveaux correcte, à documenter comme telle.

Description actuelle, et défaut précis à corriger : au niveau du player
(`create-player.ts:1402-1430`), **avant la création du commit**, toute action résolue détectée
comme `TweenAction`/`TweenSequence` est confiée à `TweenRunner.register(...)`
(`tween/tween-runner.ts`) — elle ne traverse donc jamais `triggerResolvedAction`, pas même une fois
au déclenchement. C'est un défaut, pas une séparation voulue : la troisième voie (bibliothèque
d'animation externe) montre déjà le bon patron — `triggerResolvedAction` déclenche une fois
(`beforeUpdate`, application, `afterUpdate`, collecte de `animatableActions`,
`runtime-component-orchestrator.ts:608-645`), et c'est seulement après ce déclenchement unique que
l'interpolation continue est prise en charge ailleurs. `TweenAction` doit suivre le même patron :
déclenché une fois par `triggerResolvedAction`, pas avant.

Symptôme concret de l'évitement actuel : `TweenRunner.evaluateAt` résout sa cible par
`this.getComponent(tween.persoId)` et applique en chaînage optionnel silencieux
(`component?.update(...)`, `tween-runner.ts:147-148`) — si la cible n'existe pas, rien n'est
signalé, alors que le chemin normal émettrait `RUNTIME_COMPONENT_NODE_NOT_FOUND`
(`runtime-component-orchestrator.ts:592-602`). `TweenAction` échappe ainsi aussi à la discipline
d'erreur du reste du système, pas seulement au câblage de `move`.

Second défaut, indépendant du premier : `isTweenSequence` (`tween-runner.ts:183-185`) traite
aujourd'hui toute forme tableau comme relevant de `TweenRunner`, en ne vérifiant même que son
**premier** élément. Or `TweenSequence` n'est plus une notion du projet (voir Vocabulaire) — un
tableau hétérogène (futur `ActionSequence` avec une étape discrète en fin, ex. `move:"off"`)
serait aujourd'hui aspiré en entier dans ce circuit bas niveau, et `expandTweenToActiveSteps` y
pousserait une étape sans `fn`, qui ferait planter `evaluateAt` (`tween.fn` appelé alors qu'il est
`undefined`). La correction n'est pas de vérifier mieux ce tableau, mais de retirer du circuit bas
niveau toute capacité à en recevoir un — voir Phase 1.

### Troisième voie, identifiée mais non détaillée dans ce document

`triggerResolvedAction` produit aussi des `animatableActions`/`directTransitions`
(`runtime-component-orchestrator.ts:634-645`) pour les actions statiques porteuses d'options de
durée, confiées à une bibliothèque d'animation externe. Cette voie reste, elle, à l'intérieur du
circuit normal. Elle n'est pas retravaillée par ce plan, mais elle est conceptuellement la voie
sœur de `TweenAction` (même rôle : faire évoluer une valeur en continu depuis un seul
déclenchement, avec un moteur d'interpolation différent) — à garder en tête si une incohérence
apparaît pendant la Phase 1.

### Écart entre la spec actuelle et le code

`v1-tween-action-spec.md` §4 décrit une matérialisation d'**un descripteur par step, dans le
track, au moment du déclenchement**. Le code ne fait pas ça : il n'existe aucune entrée de track
par step ; seul l'event déclencheur est enregistré normalement, et `expandTweenToActiveSteps`
(`tween-runner.ts:195-226`) redérive l'intégralité des steps en mémoire **à chaque fois que cet
event est rejoué** (lecture live ou replay au seek). La spec décrit un mécanisme qui n'a jamais
été construit ainsi — c'est une des sources de confusion à corriger en Phase 2, pas seulement un
detail d'implémentation à corriger en silence.

## Vocabulaire clarifié (à utiliser dans la suite du projet)

- **Action statique** — payload fixe, appliqué une fois (existant, ne change pas).
- **`TweenAction`** — moteur d'interpolation continue (`fn(progress)`) pour **une** action
  déclenchée une fois. Conceptuellement au même niveau que la bibliothèque d'animation externe
  (troisième voie ci-dessus) : un moteur d'interpolation parmi d'autres pour un seul déclenchement,
  pas un mécanisme de chaînage. **Ne porte jamais de chaînage et ne porte jamais `move`** — ce
  n'est pas une restriction provisoire, c'est sa définition.
- **Primitive de chaînage par durée propre** — le mécanisme qui positionne dans le temps une liste
  d'étapes **hétérogènes** (durées et propriétés différentes par étape), chaque étape démarrant à
  la fin de la durée de la précédente sauf décalage explicite (`startAt`). Ce mécanisme ne sait
  rien de l'interpolation ; il ne fait que calculer des instants de déclenchement (`stepT0`) et
  livrer, à chaque instant, un descripteur d'action ordinaire au circuit normal. Une étape peut
  être une action statique (y compris `move`) ou un `TweenAction` — la primitive de chaînage
  n'interprète jamais le contenu de l'étape, elle se contente de la déclencher au bon moment.
  Exposée à deux niveaux d'auteur distincts (voir Phase 2) :
  - **`ActionSequence`** (renommage de `TweenSequence`, qui induisait en erreur) — forme
    **niveau perso**, déclarée sur `perso.actions[eventName]`, sans strap, portée à un seul perso.
  - **niveau strap** — la même primitive, exposée via `context.planned`/`context.live` (famille
    `wait`/`repeat`/`stagger`/`loop`), pour déclencher une suite déterministe d'events distincts
    vers **plusieurs persos d'une story** depuis un seul déclenchement. Capacité absente
    aujourd'hui : `stagger` espace une liste à cadence uniforme (`stepMs` fixe), pas par la durée
    propre de chaque étape — ce n'est pas le même besoin, et ce n'est donc pas une extension de
    `stagger`, mais un nouveau helper de la même famille.
- **`stagger`/`repeat`/`wait`/`loop`** (`v1-strap-helpers-spec.md`) — primitives **niveau strap**
  existantes, pour répéter/espacer un même gabarit d'event à cadence uniforme. Restent inchangées
  par ce plan ; la nouvelle primitive de chaînage leur est ajoutée comme un helper de plus dans la
  même famille, pas une modification des helpers existants.

## Relecture de cohérence — vérifications faites avant implémentation

Revue systématique des points de couplage existants pour chacune des trois phases, le 2026-06-28,
avant tout code. Trois constats à traiter, un risque neutralisé en amont.

### Phase 1 — un risque réel : aucun test ne couvre `TweenAction`/`TweenSequence` aujourd'hui

`grep` sur `packages/codplay/tests` ne retourne **aucune** occurrence de `TweenAction`,
`TweenSequence` ni `isTweenAction`. La seule démo qui exerce réellement ce mécanisme est
`packages/demos/src/scenes/chrono-story.ts` (le patron de référence cité dans `PRATIQUES.md`
item 1). Conséquence : déplacer la détection et le branchement (prochain point) n'a aujourd'hui
aucun filet de sécurité automatisé — seule la validation manuelle de cette démo le couvrirait.

Ajout à la Phase 1, avant toute autre modification : écrire des tests de caractérisation du
comportement actuel (déclenchement, évaluation à une position donnée, interruption par même
`actionKey`, `tween:stop`) **avant** la relocalisation du point de détection. Ces tests valident
d'abord ce qui existe, puis servent de garde-fou pendant la relocalisation.

### Phase 1 — révisé après implémentation : le sentinel `tween:stop` reste à part, volontairement

Constat initial (avant code) : le point de détection actuel (`create-player.ts:1402-1430`) ne
traite pas que la forme `TweenAction`/`TweenSequence` — il traite aussi, dans la même boucle, le
sentinel d'arrêt (`isTweenStopAction`, qui déclenche `this.tweenRunner.cancelAll(...)`
immédiatement, avant tout commit). Le raisonnement initial proposait de le déplacer vers le même
registre que la détection de forme tween, pour éviter une branche orpheline.

Révisé après vérification du contrat de `tryUpdateComponent` (`action: Record<string, unknown>`,
appliqué via `ComponentServices.apply` qui itère sur des clés d'objet) : `'stop'` est une **chaîne
brute**, pas un objet d'action. La faire traverser le circuit normal jusqu'à
`tryUpdateComponent` aurait été un risque de contrat/runtime pour un bénéfice nul — l'annulation
d'un perso absent est déjà un no-op silencieux et sûr dans `TweenRunner.cancelAll` (filtre sur une
liste, jamais d'accès direct). Décision finale : `tween:stop` reste intercepté avant tout commit
dans `create-player.ts`, exactement comme aujourd'hui — la seule exception délibérée à la règle de
déclenchement unique, documentée comme telle dans le code. Aucun changement de timing pour ce
sentinel (toujours synchrone, avant tout commit).

### Phase 3 — vérifié : stocker l'identifiant de l'outlet comme parent ne casse rien d'observable

Le changement proposé (`setParentId(persoId, request.move.parentId)` au lieu de `null` après un
attachement réussi sur un outlet) a un seul consommateur sensible à la nullité de cette valeur :
`ListFlipModule.collectFlipEntriesForMove` (`list-flip/create-list-flip-module.ts:206-224`), qui
teste `sourceListId === null` comme garde d'entrée. En traçant les branches : un identifiant
d'outlet non résolu par `getListById` retombe systématiquement sur les gardes redondantes plus bas
dans la même fonction (`targetList === null`, ligne 219 ; `isMounted(targetListId) === false`,
ligne 223), qui produisent le même résultat (`return []`) par un autre chemin. Le second
consommateur, `tryBuildOverlayWorldTransitions`, reçoit `sourceListId` mais ne l'utilise pas
(`void input.sourceListId`, ligne 266 du même fichier — explicitement neutralisé). Aucun chemin
observable ne change.

Aucun test existant n'est mis en défaut par ce changement : `tests/lot18/move-phase-c.spec.ts`
(L18-T1) exerce un détachement **depuis une vraie liste** (`sourceList !== null`), un cas que la
correction de Phase 3 (qui ne modifie que la branche `sourceList === null`, c'est-à-dire les
attachements à un outlet plutôt qu'à une liste) ne touche pas. Le warning
`AUTHOR_LAYOUT_OUTLET_NOT_FOUND` que ce test attend toujours est déclenché par une chaîne cible
différente (`'missing-list'`) du sentinel réservé proposé pour `move:"off"` — tant que la
détection du sentinel reste une comparaison stricte à une valeur réservée (pas une heuristique sur
toute cible non résolue), ce test et les deux autres qui surveillent ce même warning
(`tests/v1/seek-layout-outlet.spec.ts`, `tests/v1/layout-runtime.spec.ts`) restent valides sans
modification. À ajouter malgré tout aux tests de Phase 3 : un cas explicite "détachement depuis un
outlet, puis transitions FLIP/overlay-world vérifiées inchangées" — l'analyse ci-dessus est une
lecture de code, pas une exécution.

## Phase 1 — séparer proprement les deux niveaux, corriger le défaut de détection

**But** : un déclenchement unique par `triggerResolvedAction` pour toute action, `TweenAction`
compris ; seule l'évaluation continue après ce déclenchement reste à un niveau plus bas, parallèle
au circuit de commits — comme pour la bibliothèque d'animation externe aujourd'hui. Pas de
réinjection de l'évaluation à 60 fps dans le circuit de commits : un tween est déterministe, son
exécution *après* déclenchement reste au même niveau que la bibliothèque d'animation externe.

Travail :

- **Préalable, avant toute autre modification** : écrire des tests de caractérisation du
  comportement actuel de `TweenAction`/`TweenSequence`/`tween:stop` (aucun test ne les couvre
  aujourd'hui — voir Relecture de cohérence). Ces tests valident l'existant avant qu'il ne soit
  déplacé, et servent de garde-fou pendant la relocalisation.
- Déplacer aussi le sentinel d'arrêt (`isTweenStopAction`, aujourd'hui traité dans la même boucle
  que la détection de forme à `create-player.ts:1402-1430`) vers le registre de moteurs : le moteur
  `TweenRunner` s'y déclare responsable à la fois du déclenchement (`fn`+`duration`) et de
  l'annulation (`tween:stop`). Sans ce déplacement, une branche spéciale resterait orpheline dans
  `create-player.ts` pendant que `triggerResolvedAction` en gérerait une autre. Documenter le
  changement de timing qui en résulte (l'annulation suit alors le cycle commit → tick comme toute
  action, au lieu d'être appliquée de façon synchrone avant tout commit) — un alignement voulu, pas
  une régression silencieuse.
- Renommer `routeResolvedUpdate` en `triggerResolvedAction` (`runtime-component-orchestrator.ts:583`).
  Le nom actuel décrit un mécanisme d'acheminement interne, pas ce que la fonction représente une
  fois ce plan livré : le point de déclenchement unique de toute action, quel que soit le moteur
  qui prendra ensuite en charge une éventuelle interpolation continue. Documenter ce rôle en tête
  de fonction.
- **Remplacer la détection en dur par un registre de moteurs d'animation continue** — implémenté
  au niveau du **renderer** (`RendererFacade.tick()`, `create-renderer.ts`), pas à l'intérieur de
  l'orchestrateur. Écart voulu par rapport à la rédaction initiale de ce paragraphe (registre
  imaginé côté orchestrateur, sur le patron `RuntimeModule`/`move`) : la lecture du code a montré
  que `routed.animatableActions` (résultat de `orchestrator.routeUpdates`) est déjà, structurellement,
  le point où le renderer choisit entre "appliqué une fois" et "remis à un moteur d'évaluation
  continue" — c'est exactement ce que fait `deriveSimpleTransitions` + `runAnimationBatch` pour la
  bibliothèque d'animation externe aujourd'hui. Le nouveau type `ContinuousAnimationEngine`
  (`src/animation/types.ts`) déclare `claims(action)`/`trigger(input)` ; `RendererFacade.tick()`
  parcourt `routed.animatableActions`, retire celles qu'un moteur revendique (`TweenRunner`
  aujourd'hui) après les avoir déclenchées via `engine.trigger(...)`, et ne transmet que le reste à
  `deriveSimpleTransitions`. `TweenRunner` implémente ce contrat en plus de son rôle `RenderAdapter`
  existant (tick/seek de l'évaluation continue, inchangé).
  Objectif explicite préservé : qu'anime.js puisse être remplacé, ou qu'un nouveau moteur s'ajoute,
  en ajoutant une entrée à `continuousAnimationEngines` (option du renderer), sans rouvrir
  `tick()` ni l'orchestrateur.
- Conséquence de cet emplacement : une action `TweenAction` traverse `tryUpdateComponent` comme
  n'importe quelle action avant d'être collectée dans `animatableActions` — vérifié sans risque :
  `ComponentServices.apply` n'itère que sur des clés de service connues (`style`/`className`/`attr`),
  `fn`/`duration` ne sont jamais lus, donc aucune mutation ni avertissement parasite. `beforeUpdate`
  et `afterUpdate` s'exécutent donc bien pour `TweenAction` exactement comme pour toute action
  statique, sans qu'il ait fallu apprendre à `tryUpdateComponent`/l'orchestrateur à sauter un cas.
- Cette relocalisation corrige du même coup l'absence de signalement constatée aujourd'hui : la
  résolution de cible et l'avertissement `RUNTIME_COMPONENT_NODE_NOT_FOUND` s'appliquent alors
  uniformément (avant même la collecte dans `animatableActions`), y compris à un `TweenAction` dont
  la cible n'existe pas.
- Le sentinel `tween:stop` reste, lui, intercepté avant tout commit dans `create-player.ts`
  (inchangé dans son emplacement) — et non déplacé dans le registre comme envisagé plus haut : `'stop'`
  est une chaîne brute, pas un objet d'action, et `tryUpdateComponent` exige un `Record<string,
  unknown>` ; la faire traverser le circuit normal aurait introduit un risque de type/runtime pour un
  bénéfice nul (l'annulation d'un perso absent est déjà un no-op silencieux et sûr dans
  `TweenRunner.cancelAll`). Le `Relecture de cohérence` plus haut, qui demandait ce déplacement,
  est donc révisé sur ce point précis après vérification du contrat de `tryUpdateComponent`.
- **Retirer le traitement de tableau de `TweenRunner`**, pas le durcir : `isTweenSequence`,
  `TweenSequenceShape`, et la boucle multi-step dans `expandTweenToActiveSteps`
  (`tween-runner.ts:183-226`) n'ont plus de raison d'exister. `TweenSequence` n'est plus une notion
  du projet — `TweenRunner` ne doit donc plus jamais recevoir qu'un `TweenAction` unique
  (`fn`+`duration` sur une seule action). Tout chaînage, même d'étapes `TweenAction` pures sans
  étape statique, relève d'`ActionSequence` (Phase 2), qui décompose et déclenche chaque étape
  individuellement par `triggerResolvedAction` — y compris quand chaque étape se trouve être un
  `TweenAction`. Vérifié sans risque sur la démo connue : `chrono-story.ts` n'utilise que des
  `TweenAction` isolés, jamais la forme tableau.
- Documenter explicitement dans le code, au nouveau point de détection, que ce circuit bas niveau
  ne traite que des `TweenAction` homogènes et ne doit jamais voir de clé `move` — pas une
  contrainte accidentelle, un invariant à préserver.
- Mettre à jour `v1-tween-action-spec.md` pour décrire la matérialisation réelle de `TweenAction`
  (un seul event déclencheur en track, redérivation en mémoire à chaque rejoué) au lieu du
  mécanisme par descripteur-par-step décrit aujourd'hui, qui ne correspond pas au code — et retirer
  toute mention de séquence de ce document (déplacée en Phase 2).

Validation avant de passer en Phase 2 :

- `npm run test` et `npm run test:gates` (lot7/lot8/lot18) verts.
- Repasser chaque démo utilisant `TweenAction`/`TweenSequence` (à recenser par recherche de `fn:`
  dans `packages/demos/src/scenes/`) en lecture normale et en seek/scrubbing — comportement visuel
  identique à avant la phase.
- Aucune régression sur les tests `tests/v1/` existants liés au seek et aux médias (cf. mémoire
  `project-orchestrator-detach-false-optimization` — la discipline "reset et replay dans une seule
  tâche synchrone" doit rester respectée par le nouveau point d'entrée).

## Phase 2 — installer la primitive de chaînage, aux deux niveaux d'auteur — livrée le 2026-06-28

**But** : une seule primitive de chaînage par durée propre, sans dépendance à `TweenAction`,
exposée à la fois niveau perso (`ActionSequence`) et niveau strap (`context.planned.sequence`),
testée indépendamment de `TweenAction`. Spec complète : `v1-action-sequence-spec.md`.

Travail réalisé :

- **Primitive partagée** : `planGenericSequenceSteps` (`src/player/action-sequence.ts`) — entrée
  générique `{content, durationMs?, startAt?}[]`, sortie `{offsetMs, content}[]`, chaînage par
  durée propre ou `startAt` explicite. `planActionSequenceSteps` (forme perso) en est un wrapper
  spécialisé, résolvant la durée implicite d'une étape `TweenAction` via sa propre `duration`.
- **Forme niveau perso — `ActionSequence`** : déclarée sur `perso.actions[eventName] =
  ActionSequenceStep[]`. L'étape 0 s'applique dans le commit courant (`runTimelineEvent`,
  `create-player.ts`) ; les étapes suivantes sont matérialisées dans le track à leur ms absolu via
  `appendGeneratedEvents` — le même mécanisme bas niveau déjà utilisé par les helpers de strap, pas
  un nouveau canal. Écart découvert et tranché avec l'auteur en cours de route : le système de
  dispatch n'a aucune capacité de ciblage par perso (seulement par story) ; la solution retenue
  réutilise le mécanisme d'auto-référence déjà spécifié (`actions[id] = null` → `event.data` devient
  l'action) sous une forme dérivée (`actions["${persoId}::${actionKey}::seq"] = null`, injectée à la
  normalisation comme `tween:stop`) — unique par construction, donc ciblant exactement le bon
  perso sans mécanisme de ciblage dédié. Limite actée avec l'auteur : cette clé n'est réservée que
  pour les `ActionSequence` déclarées **statiquement** (longueur connue à la normalisation) ; la
  forme portée dynamiquement par `event.data` n'est pas couverte niveau perso (elle l'est niveau
  strap, sans cette limite).
- **Idempotence au replay** : la décomposition (calcul des offsets + matérialisation des étapes
  différées) ne s'exécute qu'une fois par event déclencheur distinct, pour la durée de vie du
  lecteur — découvert via un bug réel en écrivant les tests (un seek répété rejouait l'event
  déclencheur et dupliquait les étapes différées à chaque rejoué) ; corrigé par un `Set` d'ids
  d'event déjà décomposés, jamais réinitialisé au seek (contrairement à l'état d'interruption).
- **Interruption (Cas 1 — remplacement strict)**, confirmée avec l'auteur : un nouvel event sur la
  même clé d'action invalide les étapes différées en attente de la séquence précédente sur cette
  clé. Mécanisme : jeton (id de l'event déclencheur) embarqué dans chaque étape différée, comparé
  au jeton le plus récent connu pour `(persoId, actionKey)` au moment où l'étape devient due ; la
  mémoire des jetons est réinitialisée à chaque seek, avant rejoué. Point ouvert noté, non traité :
  l'interaction avec les animations additives (anime.js) — à rouvrir plus tard.
- **Défaut découvert et corrigé localement** : un `TweenAction` actif est ré-évalué à la fin de
  tout seek (propriété déjà existante de `TweenRunner`, Phase 1) ; une étape statique qui le suit
  en touchant la **même propriété** s'en trouvait écrasée à un seek ultérieur — confirmé comme un
  vrai défaut de reconstruction (pas une simple particularité à documenter), touchant aussi les
  transitions anime.js. Corrigé pour le cas interne à une `ActionSequence` : chaque étape retire
  explicitement, avant de s'appliquer, le tween laissé actif par l'étape précédente de la même
  chaîne (`TweenRunner.cancelByActionKey`, `PlayerFacade.retireActionSequenceChainTween` — voir
  `tests/v1/action-sequence.spec.ts` AS-T4). Le cas général (deux actions indépendantes sans lien
  de séquence) reste ouvert, cadré séparément dans
  `2026-06-28-seek-continuous-engine-overwrite-defect.md` — ne bloque pas la Phase 3.
- **Forme niveau strap — `context.planned.sequence`** : ajoutée à `PlannedStrapHelpers`
  (`strap-types.ts`) et implémentée dans `player.ts` (`createPlannedSequence`, même patron que
  `createPlannedWait`/`createPlannedRepeat`/`createPlannedStagger`). Chaque étape porte un
  `StrapStep` complet (`event`/`update`), donc peut cibler un perso différent de la story par étape
  — sans la limite « déclaration statique » de la forme perso. Pas de `context.live.sequence` en
  V1 (décision actée : une séquence figée n'a pas besoin de la sémantique événementielle/
  interruptible propre à `context.live`). Réutilise tel quel le mode `planned`, le replay par
  matérialisation, et `eventInsertMode` déjà en place pour `wait`/`repeat`/`stagger` — rien
  réinventé.
- Specs mises à jour : `v1-action-sequence-spec.md` (nouveau document, contrat complet des deux
  formes) ; `v1-strap-helpers-spec.md` (ajout de `sequence` dans `PlannedStrapHelpers`, règles
  normatives, mode par défaut, exemple).

Tests dédiés, tous verts : `tests/v1/action-sequence.spec.ts` (forme perso — étapes hétérogènes
avec une étape `TweenAction`, seek à froid, interruption Cas 1) ; `tests/v1/action-sequence-strap.spec.ts`
(forme strap — fan-out vers deux persos distincts depuis un seul déclenchement).

Validation : `npm run test` (244 tests) et `npm run test:gates` (lot7/8/18) verts après chaque
étape ; aucune démo existante cassée (aucune ne déclare encore d'`ActionSequence`, donc aucun
chemin existant traversé par ce nouveau code).

## Phase 3 — `move:"off"` et démo dédiée

**But** : livrer la capacité demandée à l'origine, sur un socle maintenant unifié.

Trois corrections de code, identifiées précisément en lisant l'existant :

1. **Détachement physique réel hors liste** — dans `runtime/modules/move/index.ts`, la branche
   `targetList === null && targetNode === null` (lignes 102-121) ne détache aujourd'hui que la
   bookkeeping logique (`setParentId(null)`, `mounted=false`) si la source n'est pas une liste —
   le nœud DOM reste physiquement attaché. Il faut y ajouter un appel à
   `host.helpers.detachNode(childNode)` quand le nœud a un parent DOM courant, symétrique de ce qui
   existe déjà dans la branche `targetNode !== null` (lignes 185-186).
2. **Sentinel de détachement explicite et silencieux** — reconnaître une valeur réservée (`"off"`
   ou équivalent) dans `normalizeMoveCommand`/`isMoveCommand`, distincte d'une cible introuvable
   par erreur d'auteur, pour ne plus émettre `AUTHOR_LAYOUT_OUTLET_NOT_FOUND` sur un détachement
   intentionnel (le dédoublonnage actuel de `warnOnce` est par `eventSeq`, donc ce warning se
   répéterait à chaque détachement volontaire sans cette distinction).
3. **Résoudre l'état monté à la cible du seek avant tout travail, pas filtrer un registre courant**
   — `mountedByPersoId` (`runtime-component-orchestrator.ts:313-318`) reflète l'état **avant** le
   seek ; il ne dit rien de l'état attendu à `targetMs`, donc s'en servir tel quel pour décider quoi
   traiter au seek serait incorrect (et pas seulement insuffisant). Ce qu'il faut réellement :

   - **Passage préalable, léger, avant tout `loadPersos`** : reconstruire `parentId`/`mounted` à
     `targetMs` en ne rejouant que les entrées de track portant `move` (sous-ensemble typiquement
     petit de tous les events), dans l'ordre, sans toucher au DOM ni aux composants — une variante
     filtrée de ce que `replayDueTimelineEventsForSeek` fait déjà pour tous les events, pas un
     index séparé à inventer et maintenir. Sans ce filtrage préalable, déterminer "le dernier event
     de `move` concernant ce perso avant `targetMs`" en parcourant tout le track reproduirait le
     coût qu'on cherche à éliminer.
   - **Invalider en cascade par le parent, en ordre descendant mémoïsé, via un graphe déjà
     identifié — jamais par découverte, jamais perso par perso.** Résoudre depuis les racines
     (personas maîtres, toujours montés) vers les feuilles, en réutilisant l'état déjà résolu du
     parent pour décider de l'enfant. Un sous-arbre entier est ignoré dès que son point d'attache
     résolu est détaché, **sans jamais consulter l'historique de ses descendants**. Remonter la
     chaîne au cas par cas depuis chaque feuille (plutôt que descendre depuis les racines)
     annulerait ce court-circuit : chaque feuille consulterait son propre historique avant de
     découvrir que son sous-arbre est de toute façon hors de portée. Cette résolution doit rester
     une suite de lectures de registre, pas une recherche dans le DOM ou dans le track. Le registre
     existe déjà presque entièrement : `nodeByPersoId`
     (`runtime-component-orchestrator.ts:89`) enregistre les outlets de layout dans le **même**
     espace d'identifiants que les persos (`registerComponentOutlets`, lignes 771-797 — un outlet
     comme `"game:zone:main"` y est déjà un identifiant connu, pas une chaîne à interpréter), et
     `outletIdsByComponentId` (ligne 94) sait déjà quel composant possède quels outlets.
     Deux trous précis empêchent aujourd'hui de l'utiliser tel quel :
     - `move/index.ts` (lignes 149 et 187) écrit `setParentId(persoId, null)` après un attachement
       réussi sur un outlet, au lieu d'y enregistrer l'identifiant de l'outlet cible — l'information
       est disponible à cet instant, elle est seulement jetée. À corriger : `setParentId(persoId,
       request.move.parentId)` dans ces deux branches.
     - il manque l'inverse de `outletIdsByComponentId` (un `componentIdByOutletId`, tenu à jour au
       même endroit que l'original, lignes 792-796) pour répondre en O(1) à "quel composant possède
       cet outlet" pendant la remontée.
     Une fois ces deux trous fermés, remonter la chaîne se réduit à : `getParentId(childId)` → si
     c'est un outlet, `componentIdByOutletId.get(...)` pour le composant propriétaire → son propre
     `mounted`/`getParentId`, jusqu'à une racine (perso maître sans parent, toujours monté). Aucune
     étape n'interroge le DOM ni l'historique — uniquement des registres.
   - Seuls les persos résolus "montés à `targetMs`" passent par `loadPersos` (reset `initial.move`
     puis rafraîchissement, lignes 422-462) ; les autres sont **entièrement ignorés** — aucune
     écriture d'état, pas seulement un rafraîchissement sauté. C'est le levier de réduction de coût
     qui a motivé la question initiale.
   - Un perso destiné à être attaché/détaché dynamiquement ne doit pas porter d'`initial.move` vers
     son emplacement de contenu si l'objectif est qu'il soit ignoré par défaut — son attache initiale
     doit elle-même être un event de `move` résolu normalement par le mécanisme ci-dessus, pas un
     passage à part (lignes 447-462 actuelles) qui le reattacherait inconditionnellement avant tout
     replay.

Démo dédiée — **à construire**, volontairement minimale (pas quiz-hunt) :

- Un perso de contenu attaché/détaché via `move`/`move:"off"`, déclenché par deux events simples.
- Une `ActionSequence` sur ce perso : une étape `TweenAction` de disparition (fondu), suivie d'une
  étape statique `move:"off"`, sans `startAt` (chaînage automatique sur la fin du fondu).
- Vérification visuelle en lecture normale, puis en seek (avant/après le déclenchement, scrubbing
  rapide autour du point de détachement), puis en relance après un seek arrière (le perso doit se
  rattacher correctement si on revient avant le déclenchement).
- Une fois validée, reporter le même mécanisme dans `quiz-hunt` (panneaux trial/final), en clôturant
  `PRATIQUES.md` item 3.

Tests à écrire (suivant le patron déjà en place pour les invariants de seek, ex.
`tests/v1/seek-image-src.spec.ts`, `tests/v1/seek-layout-outlet.spec.ts`) :

- détachement hors liste retire réellement le nœud du DOM.
- détachement intentionnel n'émet pas `AUTHOR_LAYOUT_OUTLET_NOT_FOUND`.
- réattachement après détachement réutilise le même nœud (pas de recréation).
- seek vers une cible avant/après le détachement reconstruit l'état correct.
- `loadPersos` ne rafraîchit pas les persos détachés (mesure de coût, comparable à celle de
  `2026-06-27-quiz-hunt-seek-mounted-persos-plan.md`).

## Documents à faire évoluer ou retirer une fois ce plan livré

- `v1-tween-action-spec.md` — réécrit (Phase 1) pour décrire `TweenAction` seul, matérialisation
  alignée sur le code réel ; toute mention de séquence retirée.
- `v1-action-sequence-spec.md` — nouveau document (Phase 2), contrat complet des deux formes
  d'`ActionSequence`/`sequence`.
- `v1-strap-helpers-spec.md` — mis à jour (Phase 2) avec le helper `sequence`.
- `2026-06-26-mount-unmount-seek-intention.md`, `2026-06-27-quiz-hunt-seek-mounted-persos-plan.md`
  — clos, remplacés par ce document une fois la Phase 3 livrée.
- `packages/demos/src/scenes/quiz-hunt/PRATIQUES.md` item 3 — mis à jour pour refléter le
  mécanisme livré plutôt que le point bloquant constaté.
- `v1-move-separation-policy-state-backend-dom.md` — reste un lot séparé, non prioritaire (statut
  inchangé : ne pas démarrer avant la fin des slices 11-15). À reconsidérer une fois ce plan
  terminé, pas avant.

## Critère de sortie global

- Deux niveaux clairement séparés et documentés comme tels : le circuit de commits (toute action
  discrète, `move` inclus) et le circuit bas niveau d'interpolation continue (`TweenAction` seul,
  jamais hétérogène, jamais porteur de `move`).
- La primitive de chaînage par durée propre installée aux deux niveaux d'auteur (`ActionSequence`
  niveau perso, nouveau helper niveau strap), testée indépendamment de `TweenAction`.
- `move:"off"` fonctionnel, testé, démontré sur une démo dédiée puis sur quiz-hunt — résolution de
  l'état monté au seek faite par historique et chaîne de parenté, pas par un registre d'état courant.
- Aucune régression sur les gates (`npm run test:gates`) ni sur les démos existantes.
- Les documents listés ci-dessus ne contiennent plus d'information contradictoire avec le code.
