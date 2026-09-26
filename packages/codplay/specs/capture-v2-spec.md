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
  → RuntimeCaptureSourceCircuit
  → règle compilée (storyId, persoId, source)
  → event de départ via RuntimePlayer.emit()
  → session player de capture
  → trackCommand
  → actions compilées → component.update() → services → materializer

endEmit / événements endCapture
  → dispatcher V2 unique
  → journal → materialize → resolve → solve
```

[`RuntimeCaptureSourceCircuit`](../src/runtime/capture/capture-source-circuit.ts)
est le circuit player-scoped commun aux sources continues. Il indexe les
déclarations compilées par identité du perso et nom de source. Une ouverture
résout ensemble la règle, l’event de départ et la déclaration de capture ; le
circuit émet cet event via `RuntimePlayer.emit()` et ne démarre la session que
si l’émission réussit. Il met en attente les samples reçus pendant cette
émission, puis conduit tracking, fermeture et annulation par le contrôleur de
capture existant. Il ne connaît ni les événements DOM, ni les nodes, ni le
journal.

Les sources utilisent le port borné `RuntimeCaptureSourcePort`. L’adaptateur
pointeur garde l’association des événements natifs aux persos et la conversion
des samples ; il utilise le même circuit. Un composant peut aussi recevoir ce
port player-scoped et ouvrir sa source à partir de son identité compilée. Pour
le scroll, `ScrollContainerComponent.initialize()` attache les listeners à la
racine matérialisée et demande au circuit la règle `scroll` de ce perso. La
factory HTML `scroll-container` reste propriétaire des observations de
descendants ; elle ne résout ni le scrollport ni ses captures. Le contexte de
factory n’expose aucune opération de capture bas niveau. Les contrats propres
au scroll sont dans la
[spécification scroll-container](./scroll-container-spec.md).

## Vérification des comportements documentés

Le [contrôleur de capture](../src/runtime/player/runtime-player/capture-controller.ts),
le [circuit des sources](../src/runtime/capture/capture-source-circuit.ts),
les [déclarations auteur](../src/scene/capture/authoring-types.ts), le
[validateur](../src/scene/compiled/capture-event-validation.ts), le
[résolveur de cible](../src/runtime/capture/capture-event-target.ts) et le
[codec](../src/scene/compiled/codec.ts) portent le contrat. Les tests de
[session](../tests/runtime/capture/runtime-capture-session.spec.ts),
[player](../tests/runtime/player/runtime-capture-player.spec.ts),
[circuit source](../tests/runtime/capture/capture-source-circuit.spec.ts),
[adaptateur pointeur](../tests/runtime/capture/html-pointer-capture-source-adapter.spec.ts)
et [codec](../tests/scene/compiled/codec.spec.ts) couvrent les frontières
source-agnostiques et leurs portées. Le test d’intégration scroll avec le vrai
[`HtmlPlayerRunner`](../../authoring/component-v2/tests/scroll-container-player-integration.spec.ts)
vérifie le passage du node matérialisé au circuit, au contrôleur et au journal,
y compris seek et teardown.

Le 2026-09-26, la suite CodPlay (108 fichiers, 710 tests) et la suite
`component-v2` (12 fichiers, 47 tests), les typechecks CodPlay,
`component-v2` et démos V2, ainsi que le build des démos V2 ont réussi. Les
validations navigateur S5 et Seek S6 encore ouvertes restent suivies dans
leurs plans dédiés.
