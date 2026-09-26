# CodPlay V2 — capture continue

## Périmètre vérifié

Cette spécification décrit le cycle source-agnostique, le tracking live, les
sorties de fin et le routage par visibilité implémentés et vérifiés. Les
validations navigateur encore ouvertes pour S5 et S6 sont suivies dans leurs
[plans dédiés](../plan/capture-s5-validation-plan.md) et
[plan S6](../plan/drag-capture-list-s6-validation-plan.md).

Cette spécification définit le cycle de capture V2 indépendant de sa source.
Elle distingue les samples éphémères, les actions live et les événements de
fin journalisés. Une source navigateur ou matérielle ne crée pas de circuit
player, de journal ou de seek parallèle.

## Session et état

Une capture est ouverte par l’événement discret déclaré sur un perso. Le player
crée une session identifiée, initialise une fois `captureState`, puis reçoit
les samples jusqu’à la fin ou l’annulation. Sans `initCaptureState`, l’état de
capture initial est `{}`. `captureState` appartient uniquement à la session ;
il n’est ni l’état applicatif, ni une entrée du journal, ni une valeur
reconstruite au seek.

`stateScope` choisit le scope (`story` ou `scene`) lu par
`initCaptureState`, `trackCommand` et `endCapture`. Il ne choisit pas le scope
d’écriture des événements et ne change pas pendant une session.

Les samples sont bruts, ordonnés et accumulés pour la session. Leur forme
dépend de la source. Les samples et les valeurs intermédiaires de
`captureState` ne sont jamais inscrits au journal ni rejoués au seek.

## Tracking et actions live

À chaque sample, `trackCommand` reçoit le sample courant, le cumul ordonné et
le dernier `captureState`. Il peut retourner une collection ordonnée
d’actions live, remplacer `captureState` et/ou proposer une mise à jour partielle
`updateState` du scope lu par la capture.

```ts
type CaptureTrackOutput = Readonly<{
  actions?: readonly Readonly<{
    name: string
    data?: Record<string, unknown>
  }>[]
  captureState?: Record<string, unknown>
  updateState?: Record<string, unknown>
}>
```

Chaque action désigne par `name` une action déjà déclarée dans
`CompiledPerso.actions`. Le player résout les cibles par son index compilé et
applique les actions dans l’ordre déclaré, à travers
`component.update() → services → materializer`. Une collection absente ou vide
retire les actions live précédentes de cette session. Aucun sample ne produit
un événement par lui-même.

`updateState` est une mise à jour éphémère : elle n’est pas journalisée et ne
reconstruit pas l’état au seek. Une modification durable de l’état passe par un
événement de fin, le circuit `listen`/strap et le mécanisme normal `update`.
`trackCommand` n’accède pas aux nœuds de présentation.

## Portée des événements de capture

L’événement d’ouverture, `endEmit` et chaque événement retourné par
`endCapture` acceptent `visibility: 'story' | 'scene' | 'public'`, avec le
routage défini pour les événements V2 dans la
[spécification événementielle](./event-pipeline-v2-spec.md). Pour ces trois
frontières, `story` cible la story propriétaire de la capture ; `scene` cible
la track globale et participe à la matérialisation des stories ; `public`
cible la track globale et l’observateur public. La visibilité omise conserve
la cible story par défaut. `public` ne transporte pas l’événement vers une
autre instance.

`cascade` n’est pas un champ de capture V2 : le builder le refuse dans les
déclarations auteur, le codec le refuse dans les événements compilés et la
session runtime la refuse sur `endEmit` et sur les sorties dynamiques de
`endCapture`. Cette règle concerne les événements de capture ; les autres
formes d’événements conservent leurs contrats propres.

## Sorties de fin

`endEmit` et `endCapture` sont indépendants et facultatifs.

- `endEmit` suit le circuit d'insertion ordinaire des événements V2. À la
  fermeture, sa donnée porte toujours `captureState` sous la clé réservée
  `data.captureState`, en conservant les autres données explicitement déclarées
  par l’auteur. Il emprunte le mode d'insertion ordinaire, `apply-now` par
  défaut et sa cible suit la règle de visibilité ci-dessus.
- `endCapture` reçoit les samples bruts, le dernier `captureState`, l’état
  courant en lecture seule et les métadonnées. Il peut retourner une collection
  d’événements ou ne rien retourner. Il ne modifie jamais l’état directement.
- Chaque événement retourné par `endCapture` est `persist-only` : il est
  journalisé sans être appliqué par la tête de lecture courante, puis peut être
  pris en compte lors d’une reconstruction ultérieure.

## Ancrage temporel, seek et cycle de vie

Les événements de fin persistants sont ancrés à
`now - duréeRésolue`. `durationMode: 'value'` utilise la valeur auteur ;
`'default'` utilise la durée par défaut du runtime ; `'capture'` utilise la durée
mesurée entre l’ouverture et la fermeture. Pour les modes automatiques, la
durée résolue est propagée aux transitions qui n’en déclarent pas. Une capture
qui s’ouvre et se ferme dans le même tick conserve une durée effective minimale
de `1 ms`.

La matérialisation `persist-only` est atomique : l’événement ajouté au journal
ne participe pas à la présentation déjà en cours à l’instant de sa fermeture.
L’ancrage peut être négatif si `now - duréeRésolue` l’est ; le temps de lecture,
lui, reste non négatif.

Le tracking live n’est jamais rejoué au seek. Un seek annule toute session
ouverte ; les événements de fin déjà inscrits au journal restent les seules
données de capture prises en compte par la reconstruction. La session et ses
ressources sont détruites au teardown du player. Lorsqu’aucune sortie
persistante n’est produite, le mode auteur émet un warning non bloquant : les
usages qui ne nécessitent pas de reconstruction au seek restent valides.

## Frontières source et runtime

```text
source continue
  → session player de capture
  → trackCommand
  → actions compilées → component.update() → services → materializer

endEmit / événements endCapture
  → dispatcher V2 unique
  → journal → materialize → resolve → solve
```

Le core ne connaît ni l’événement natif ni le substrat de présentation. Les
adaptateurs alimentent la session par les ports de capture existants. Le
`scroll-container` réutilise ces ports via son adaptateur HTML ; ses règles de
progression et d’observation sont définies dans la
[spécification scroll-container](./scroll-container-spec.md).

## Vérification des comportements documentés

Le [contrôleur de capture](../src/runtime/player/runtime-player/capture-controller.ts),
les [déclarations auteur](../src/scene/capture/authoring-types.ts), le
[validateur](../src/scene/compiled/capture-event-validation.ts), le
[résolveur de cible](../src/runtime/capture/capture-event-target.ts) et le
[codec](../src/scene/compiled/codec.ts) portent le contrat. Les tests de
[session](../tests/runtime/capture/runtime-capture-session.spec.ts),
[player](../tests/runtime/player/runtime-capture-player.spec.ts),
[adaptateur HTML](../tests/runtime/capture/html-pointer-capture-source-adapter.spec.ts)
et [codec](../tests/scene/compiled/codec.spec.ts) couvrent les frontières
source-agnostiques et leurs portées. Le 2026-09-26, les 107 fichiers de tests
CodPlay ont réussi (706 tests) ; les typechecks CodPlay, component-v2 et démos
V2 ont réussi. La validation navigateur S5 et l’acceptance Seek navigateur S6
restent ouvertes dans leurs plans respectifs.
