# Investigation : cibler une story précise depuis une track/un émetteur externe

Contexte déclencheur : la démo `quiz-series` (page fame) a besoin d'un bouton "Auto" qui rejoue automatiquement 3 questions successives (répondre, valider, suivant — 2s d'écart), sans intervention. Les 3 stories de question sont montées simultanément et écoutent des noms d'event partagés (`quiz:question:answer:select`, `quiz:question:validate`). Il a fallu déterminer comment adresser un event à *une* story précise parmi plusieurs candidates montées en parallèle, sans jamais modifier le moteur (`packages/codplay/src/player/`, `packages/codplay/src/track-manager/`).

Ce document consigne toutes les pistes explorées durant cette session, dans l'ordre chronologique, avec ce qui a été vérifié dans le code, pourquoi chaque piste a été retenue ou abandonnée. Aucune conclusion ici n'est une décision de correction moteur — c'est une base d'analyse pour une future spec.

## Constat de départ

Trois stories de question (`quiz-series-q0-story`, `q1`, `q2`) sont montées en même temps dès l'init de la scène (visibilité gérée par `transform: translateX`, pas par montage/démontage). Chacune déclare :

```ts
listen: [
  { on: "quiz:question:answer:select", straps: ["quiz-question-select"] },
  { on: "quiz:question:validate", straps: ["quiz-question-submit"] }
]
```

Un event `quiz:question:answer:select` émis sans autre précision doit donc, en théorie, être reçu par les 3 stories à la fois (ou par aucune, selon le mécanisme d'émission — voir piste 1).

## Piste 1 — `player.emit({ scopeStoryId })` directement depuis le bouton

**Ce qui a été vérifié** : `PlayerPublicEventInput.scopeStoryId` (`packages/codplay/src/player/types.ts:134`) existe et est bien préservé par `createTimelineEvent` (`create-player.ts:1470-1474`) jusqu'au routage. `routeSceneEvent` (`player.ts:1196-1249`) montre que `story.listen` n'est consulté **que si** `scopeStoryId !== undefined` (`isLocalStoryEvent`, ligne 1229) et matche exactement l'id de la story visée.

**Pourquoi retenue initialement** : c'est la seule API publique qui permette de choisir librement un `scopeStoryId` à l'émission — donc en théorie viable pour un bouton JS qui connaît la question courante.

**Pourquoi abandonnée** : l'utilisateur a explicitement retiré ce chantier ("comportement proscrit" — implémentation sans validation préalable de l'approche). Cette piste n'a jamais été rejetée techniquement ; elle a été abandonnée sur un désaccord de processus (exploration → implémentation sans rapport intermédiaire), pas sur un défaut du mécanisme lui-même.

## Piste 2 — Track statique (`scene.tracks`) avec `scopeStoryId` par event

**Ce qui a été vérifié** : le format d'entrée d'une track statique (`TrackManagerCodec.normalizeTrackBucket`, `track-manager-validation.ts:56-114`) construit chaque `TrackManagerStoryEvent` à partir des champs `id`, `ms`, `name`, `index`, `source`, `trackId`, `payload` du raw event — **`scopeStoryId` n'est jamais lu**, même si le type `TrackManagerStoryEvent` (`track-manager/types.ts:10-19`) le supporte. C'est un gap réel, factuel, dans le code existant (pas introduit par cette session).

**Pourquoi abandonnée** : correction du moteur explicitement écartée par l'utilisateur ("je ne cherche pas de solution de contournement bricolé"). Notée comme gap réel mais non traitée.

## Piste 3 — `player.schedule.*` (helpers `wait`/`delay`/`repeat`)

**Ce qui a été vérifié** : `PlayerScheduleFacade.normalizeEvent` (`player-schedule.ts:615-621`) ne transmet que `name`, `data`, `cascade` à l'emit final — `scopeStoryId` n'existe pas dans `EventInput`/`StoryEvent` (`helper-types.ts:7-11`). Cette API ne peut donc jamais cibler une story précise, quel que soit l'usage.

**Pourquoi abandonnée** : même limite structurelle que la piste 2, sans même l'option de la corriger ponctuellement (le type `StoryEvent` est utilisé dans tout le système de straps, pas seulement les tracks).

## Piste 4 — Renommer les events par question (préfixe statique à l'écriture)

**Principe** : chaque story écoute un nom unique (`quiz-series-q${position}:answer:select` au lieu de `quiz:question:answer:select`). Élimine la collision par construction, sans avoir besoin de `scopeStoryId`.

**Ce qui a été vérifié** : le nom déclencheur n'est jamais lu par valeur dans le corps des straps (`handleQuestionSelect`/`handleQuestionSubmit`, `quiz-question-scene.ts`) — seul `listen.on` en dépend pour le routage. Renommer le déclencheur ne casse donc pas la logique interne d'un strap, à condition que ses **events de sortie** soient eux aussi renommés en conséquence (voir piste 6).

**Pourquoi (provisoirement) abandonnée à ce stade** : l'utilisateur a proposé une alternative fondée sur `scene.state.activeStoryId` (piste 5) jugée plus proche d'un modèle métier explicite ("le critère de visibilité de la question et la portée des events peut se réduire à l'id de la story"). Cette piste 4 a été reprise plus tard (piste 7) une fois les pistes 5 et 6 démontrées inapplicables.

## Piste 5 — `scene.state.activeStoryId` dérivé, lu par l'émetteur externe

**Principe proposé par l'utilisateur** : `scene.state` porte l'id de la story active comme source de vérité ; l'émetteur (bouton) lit cet état avant chaque emit et construit lui-même `scopeStoryId` — les 3 stories restent écrites avec un vocabulaire d'event générique et identique.

**Ce qui a été vérifié** :
- `resolveStateTarget(scopeStoryId)` (`player.ts:569-585`) confirme que `scene.state` est un vrai bucket mutable, lisible par tout strap scène.
- **Mais aucune API publique n'expose `scene.state` en lecture** : `PlayerStateSnapshot` (`player/types.ts:117-125`) n'a pas ce champ ; aucun `getSceneState()` n'existe côté `create-player.ts`/`telco/create-telco.ts`/`creator/`.
- Donc un bouton JS externe ne peut techniquement pas lire `activeStoryId`, sauf à le suivre en miroir localement (dupliquant une logique déjà pilotée par le bouton lui-même) — jugé insatisfaisant.

**Pourquoi abandonnée** : gap d'API confirmé (pas de lecture publique de `scene.state`), signalé à l'utilisateur avant d'aller plus loin.

## Piste 6 — Redirection déclarative via `ListenRule.emit`

**Principe exploré** : une règle `listen` peut réémettre un event différent sans passer par un strap (`ListenRule.emit?: ListenEmit[]`, `player/types.ts:39-49`).

**Ce qui a été vérifié** :
- `routeMatchingRules` (`player.ts:1264-1313`) calcule `nextScopeStoryId = emittedEvent.cascade === true ? undefined : scope.scopeStoryId` (ligne 1307) — **le scope de sortie est toujours hérité du scope de l'appelant**, jamais recalculé depuis le contenu de l'event réémis.
- `ListenEmit` (`player/types.ts:39-43`) n'a pas de champ `scopeStoryId`.
- Un strap **scène** (`scope.scopeStoryId === undefined` par construction) ne peut donc jamais choisir dynamiquement un `scopeStoryId` de sortie différent — ni via `rule.emit`, ni via le retour `events: StoryEvent[]` d'un strap (`strap-types.ts:44-48`, `StoryEvent` sans `scopeStoryId`, `helper-types.ts:7-11`).
- Confirmé également côté `chunk.events` (`player.ts:1126-1139`) : `nextScopeStoryId` vient exclusivement de `scope.scopeStoryId` du strap appelant.

**Conclusion** : il n'existe **aucun** canal interne (listen.emit, strap scène, helper de schedule) permettant de calculer un `scopeStoryId` de sortie dynamiquement. Seul l'appelant externe direct de `player.emit()` peut fixer ce champ librement, à la source. Cette conclusion rend les pistes 5 et 6 définitivement inapplicables sans modification du moteur.

## Piste 7 — `story.eventimes` (déclaratif, scope natif)

**Principe** : `StoryEventimeDoc` (`player/types.ts:52-57`, `{ name, startAt, data?, events? }`) est porté nativement par une story. `flattenAnchoredEventimes` (`track-manager-validation.ts:119-154`) fixe `scopeStoryId: storyId` en dur sur chaque event matérialisé — donc **aucune collision possible par construction**, sans avoir besoin de préfixer quoi que ce soit.

**Ce qui a été vérifié en faveur** :
- `routeTimelineEvent`/`onRuntimeEmit` (`player.ts:160-194`, `538-551`) transmettent `event.scopeStoryId` intact jusqu'au routage — confirmé que les events issus d'eventimes atteignent bien `story.listen` de la bonne story, sans ambiguïté.
- Spec `docs/formalisation/v1-story-spec.md` §10 confirmée : *"les eventimes de synchronisation sont portées par la Story via eventimes"*.

**Ce qui a invalidé la piste** :
- `seedAllStoryEventimes()` (`create-player.ts:883-900`) matérialise les eventimes **une fois, automatiquement, à l'init de la scène** — pas sur demande.
- Le seul point de re-déclenchement à la demande, `scheduleStoryEventimes` (`create-player.ts:1157-1187`), n'est exposé qu'aux hooks de cycle de vie **scène** (`scene.init`, `scene.onStart`, `scene.onSequenceEnd` — voir `createLifecycleOptions`, `create-player.ts:1192-1198`), jamais à un event déclenché par un clic utilisateur en cours de lecture.
- Donc si les 3 stories portaient leurs eventimes "auto", la séquence se rejouerait **systématiquement** à chaque montage/rewind — pas seulement au clic d'un bouton "Auto". Comportement rejeté explicitement par l'utilisateur ("il manque un sequence:end... reflechis" a suivi une confusion sur ce point, mais la vraie objection retenue était le déclenchement non togglable).

**Conclusion** : mécanisme correct pour le *scope*, incorrect pour le *déclenchement à la demande*. Abandonné pour ce besoin précis (bouton), pourrait convenir à un besoin où la séquence doit jouer automatiquement dès le chargement, sans bouton.

## Piste 8 — Track statique dédiée + préfixe de nom par question (reprise de la piste 4, alignée sur le précédent quiz-hunt)

**Principe** : reproduire exactement `packages/demos/src/scenes/quiz-hunt/debug-question-track.ts` — une track dans `scene.tracks`, `active: false` par défaut, activée par `player.emit({ name: 'track:activate', payload: { trackIds: [...] } })`. Les events de la track ciblent des noms préfixés par question pour éviter la collision.

**Erreur commise dans cette implémentation** : les events de la track ont d'abord été construits pour cibler `${prefix}:answer:select` / `${prefix}:validate` — des noms routés via `story.listen` + un strap. **Ceci ignorait la conclusion déjà établie en piste 2** : une track statique ne porte jamais `scopeStoryId` (`normalizeTrackBucket` le confirme). Sans lui, `routeSceneEvent` (`player.ts:1229-1237`) ne consulte jamais `story.listen`, retombe sur `scene.listen` (qui ne connaît pas ces noms), et l'event est silencieusement perdu (`emitRuntimeEvent`, sans effet si aucune action de perso ne porte ce nom exact).

**Symptôme observé** : le bouton "Auto" faisait avancer les questions (`quiz:question:next`, scene-scoped, fonctionne sans scope) mais aucune réponse ni validation n'était visible — confirmé par relecture de `debug-question-track.ts` : quiz-hunt ne route **jamais** vers `story.listen`/un strap de story ; il ne déclenche que des actions de perso directement (`perso.actions[eventName]`, matché par nom exact sur tous les persos montés, sans scope requis).

**Ce qui a été vérifié pour confirmer l'absence d'alternative** :
- Une action de perso ne peut jamais réémettre un autre event (`ActionDoc` transforme uniquement l'état visuel du perso qui la reçoit — pas de canal de re-émission).
- `perso.emit` ne réagit qu'à des événements DOM (`click`, `change`), jamais à une action reçue.
- Donc aucun détour "action de perso → event scopé" n'existe dans le modèle actuel.

**Conclusion appliquée (provisoire, non satisfaisante)** : la track a été réécrite pour déclencher directement les actions de perso déjà existantes pour l'affichage normal (`${prefix}:answer:${id}:selected`, `${prefix}:answer:${id}:revealed-correct`, `${prefix}:resolved:correct`, `${prefix}:resolved`), à l'identique du modèle quiz-hunt. Résultat : le bouton "Auto" simule visuellement la séquence (sélection, révélation, résultat affichés) mais **ne met jamais à jour le vrai state** (`selectedAnswerIds`, agrégation de score, modal de résultat final) — seul `quiz:question:next` reste un vrai event fonctionnel dans la séquence, puisqu'il est scene-scoped et ne nécessite aucun scope pour être routé.

## Constat transversal (le vrai nœud du problème)

Toutes les pistes explorées convergent vers une seule limite structurelle du moteur, vérifiée à plusieurs reprises sous des angles différents (tracks statiques, `player.schedule`, `ListenRule.emit`, retour de strap) :

> **Aucun mécanisme de re-émission interne (track statique, helper de planification, redirection déclarative, retour de strap scène) ne peut choisir dynamiquement un `scopeStoryId` de sortie.** Seuls deux canaux préservent ou fixent un `scopeStoryId` correct :
> 1. Un appel direct et explicite à `player.emit({ scopeStoryId })` depuis l'extérieur du player (piste 1).
> 2. Les `story.eventimes`, dont le scope est fixé en dur à la story propriétaire, mais dont le déclenchement n'est pas disponible à la demande hors des hooks de cycle de vie scène (piste 7).

Toute solution qui a besoin de router un event généré dynamiquement (au runtime, pas connu à l'écriture) vers une story précise, à la demande (pas seulement au montage), se heurte à ce manque. C'est ce manque — pas une des pistes explorées — qui est le candidat naturel pour une future spec, si le besoin se reproduit ailleurs que dans ce cas ponctuel de démo.

## Pour la future spec (pistes de correction, non tranchées)

Deux amendements minimaux et indépendants ont été identifiés, sans être appliqués :

1. **`normalizeTrackBucket`** (`track-manager-validation.ts:56-114`) pourrait lire `scopeStoryId` depuis l'event brut, comme le fait déjà `flattenAnchoredEventimes` pour les eventimes ancrées. Rendrait les tracks statiques utilisables pour cibler une story, à la fois par nom scopé plutôt que par préfixe manuel.
2. Un canal permettant à un strap scène de préciser un `scopeStoryId` de sortie sur un event qu'il réémet (actuellement impossible — `StoryEvent`/`ListenEmit` n'ont pas ce champ, et le scope de sortie est toujours hérité de l'appelant). Impact plus large : touche `strap-types.ts`, `helper-types.ts`, et le calcul de `nextScopeStoryId` dans plusieurs fonctions de `player.ts`.

Ces deux points ne sont **pas** des recommandations — ce sont les deux points d'ancrage identifiés factuellement pendant cette investigation, à examiner et discuter avant toute décision.
