# Réconciliation spec / code / tests après le chantier seek (2026-06-26)

## Statut

Analyse — non normatif. Sert à décider, cas par cas, du sort des 8 tests rouges restants
après que le chantier seek (rendu + calcul d'horizon) a été revu, corrigé et validé au rendu.

## Problème

Le chantier seek a été corrigé et validé **au rendu**. Trois artefacts peuvent désormais
diverger :

1. le **comportement runtime validé** (rendu, position de seek, chrono d'horizon),
2. le **code** qui l'incarne,
3. la **spec** (`v1-seek-spec.md`, `v1-horizon-spec.md`) et les **tests** qui en dérivent.

Risque signalé : « rapprocher la spec » naïvement (= rendre les tests verts contre l'ancienne
spec) peut **réintroduire des régressions** si la correction a été menée en dépit de la spec,
ou sans la mettre à jour.

## Critère de départage

La hiérarchie de vérité « la spec est autorité » ne s'applique plus telle quelle sur ce
périmètre. Le critère opérationnel devient :

> **La surface réellement exercée par la validation au rendu couvre-t-elle ce comportement ?**
>
> - **Oui**, et le rendu est correct → le test asserte un comportement superseded → mettre à
>   jour le test **et** la spec pour suivre le code validé.
> - **Non** (métrique purement diagnostique, ou chemin de bord non exercé par les démos) → la
>   validation ne prouve rien sur ce point ; on retombe sur l'accord spec ↔ intention-du-code.
>   S'ils concordent et que le code échoue quand même → **vraie régression masquée**, à corriger
>   (le fix ne touche pas la surface validée, donc ne rétro-introduit pas de bug de rendu).

Résultat global (après instrumentation) : sur 8 tests, **5 étaient des tests périmés** (mauvais
câblage des straps vs feature story-straps) et **3 de vraies régressions** sur des chemins non
exercés par le rendu. Le critère ci-dessus, complété par une **trace de l'exécution réelle**, a
permis de ne pas confondre les deux — voir le tableau de synthèse en fin de doc.

## Constat par cluster (valeur attendue vs valeur réelle du code committé)

### 1. Horizon — `horizon-diagnostics.spec.ts` (3 tests)

Scène : master-track avec event à **200 ms** ; support-track portant un strap
`planned.wait(1000 → support:future)` → event matérialisé à **1000 ms**.

| Test | Attendu | Réel | Métrique exercée au rendu ? |
|---|---|---|---|
| playedEndMs stable + filtre futur | `authorEndMs = 1000` | `200` | Non (`authorEndMs` ne sert qu'à la policy `author-unrestricted`) |
| authorEndMs canonique | `authorEndMs = 1000`, `projectedMaster = 200` | `200 / 200` | Non |
| strap-track étend si `role:master` | `projectedMaster = 1000` | `200` | Marginal (aucune démo n'utilise un strap-track `role:master`) |

Intention du code : `resolveAuthorEndMs = max(resolveTimelineEndMsFromPlan(timelinePlan), projectionMaster)`,
et `resolveTimelineEndMsFromPlan` parcourt **tous** les `sortedEvents` sans filtrer par rôle.
**Le code est donc conçu pour qu'`authorEndMs` inclue l'event support à 1000** — exactement la
spec `v1-seek-spec §67-70` et l'attente du test. Pourtant il renvoie 200 : l'event `support:future`
(planned, matérialisé à 1000) ne parvient pas au `timelinePlan` utilisé.

→ **Verdict : régression masquée**, mais **cause corrigée après instrumentation (2026-06-26)** :
ce n'est **pas** un bug du résolveur d'horizon. Sondes posées dans `syncHorizonFromRuntimePlan`,
`getState` et `materializeHelperSteps` :

- à chaque calcul d'horizon **et** au `getState` du test, `getAllEvents()` ne contient que
  `support:start` (0) et `master:anchor` (200) ;
- `support:future` (1000) n'est **jamais** matérialisé dans aucune track ;
- `materializeHelperSteps` n'est **jamais appelé** dans ces tests → le strap `support-counter`
  ne matérialise pas son `context.planned.wait(1000 → support:future)` à l'init/play.

Le résolveur d'horizon reflète donc correctement les tracks ; le défaut est **en amont**, dans
l'exécution du strap / la matérialisation des occurrences `planned` dans ce scénario (eventime
`support:start` à 0 → listen → strap, sans passage par `materializeHelperSteps`).

**Cause finale (2026-06-26) — TEST PÉRIMÉ, pas une régression.** Le strap `support-counter` ne
matérialise rien parce qu'il est fourni via la **`strapCollection` globale** de `init`, alors que sa
règle `listen` est **story-local** (`support-story`). Or `resolveStrap` (`player.ts:1021-1026`)
applique l'**isolation stricte story-straps** (spec `v1-story-spec §90-93`, plan
`2026-06-19-story-straps-plan.md`) : une règle story-local ne résout ses straps **que** dans
`story.straps`, jamais dans la collection globale. `story.straps` valant `undefined`, le strap est
introuvable → jamais exécuté → occurrence à 1000 jamais matérialisée → horizon = 200.

**Vérifié empiriquement** : en embarquant `supportCounterStraps` dans `support-story.straps`, les
**3 tests horizon passent** (10/10). Le résolveur d'horizon était correct depuis le début.

→ **Fix = corriger le câblage du test** (straps dans la story, conformément à la feature
story-straps), **pas le code**. Aligner le code (retirer l'isolation) aurait rétro-introduit le bug
de portabilité des stories.

### 2. Seek — duplication de la synchro d'animation — `lot13/create-player.spec.ts` (2 tests)

| Test | Attendu | Réel |
|---|---|---|
| L13-T5 | 2 appels `adapter.seek` (à 1000, 1500) | **3** |
| L13-T6 | `[500]` | `[500, 500]` |

La synchro d'animation est appelée une fois de trop. Au rendu c'est **invisible** : `adapter.seek`
positionne `currentTime`, donc idempotent visuellement. Le nouveau pipeline (reset → reattach →
replay → `syncAnimationsToTimeline`, suite au retrait du detach-all) a pu légitimement déplacer le
nombre d'appels.

**Mécanisme tracé (2026-06-26).** La scène n'a qu'**un** perso, **une** animation (`x` 0→100),
**un** event, **un** adaptateur mock. Les 3 appels vont donc au même `adapter.seek` pour la même
animation — répétition, pas appel multi-bibliothèque. Trois `syncAnimationsToTimeline` durant un
seek :

- `create-player.ts:1248` — par event rejoué → à `event.ms` (1000). **Légitime** (appel #1).
- `create-player.ts:1256` — `finally` de `replayDueTimelineEventsForSeek` → à `timelineMs` (1500).
  Ajoutée par le chantier detach-all (commentaire 1254-1255 : « sync … before any async boundary,
  preventing the browser from painting »).
- `create-player.ts:1980` — dans `seek()`, après l'ajustement `sequence:end` (1975-1977) →
  à `this.timelineMs` (1500). Synchro finale **autoritaire** (post-ajustement).

1256 et 1980 ciblent la même position en cas normal → `adapter.seek(1500)` en double.

→ **Verdict : régression (double application).** Le test a raison d'attendre 2.

⚠️ **Garde-fou pour le fix** : 1256 existe pour garantir la synchro **dans la même tâche
synchrone** (anti-repaint du chantier detach-all). Le bloc 1975-1982 est une continuation
synchrone après le seul `await` (1970), et 1980 synchronise après l'ajustement `sequence:end`.
Donc retirer **1256** (redondante, pré-ajustement) et garder **1980** (autoritaire) — **pas
l'inverse**. À valider qu'aucune frontière async réelle ne s'insère dans `replayDueTimelineEventsForSeek`
(la spec-appendice du 25/06 affirme « boucle sans await »).

### 3. Media — `currentTime` non clampé — `lot19/media-player-sync.spec.ts` (1 test)

| Attendu | Réel |
|---|---|
| `getCurrentTimeMs() ≈ 9000` (durée media) | `12000` |

Le `currentTime` suivi par le composant dépasse la durée effective du media. Au rendu c'est
**invisible** : l'élément `<video>` clampe nativement à la durée, donc la frame affichée est
correcte ; seule la **valeur suivie** est fausse. Concerne le repositionnement media en seek
(seek-spec §64 « durée effective », §138).

**Mécanisme tracé (2026-06-26).** Aucun clamp à la durée nulle part :
- `media-component.ts:241` (`setCurrentTimeMs`) : `Math.max(0, mediaMs)/1000` — borne basse seule.
- `media-component.ts:175` (`getCurrentTimeMs`) : `Math.max(0, currentTime*1000)` — idem.

Un vrai `<video>` clampe nativement `currentTime` à `[0, durée]` ; le faux node du test stocke la
valeur brute (12000). Donc **frame correcte au rendu réel** (clamp natif → 9000), **valeur suivie
fausse** (12000) → invisible au rendu.

→ **Verdict : régression/bug de la valeur suivie.** Décision sur l'**emplacement du clamp** :
- (a) dans CodPlay (`setCurrentTimeMs`/`getCurrentTimeMs` bornent à `getDurationMs()`) → correct
  indépendamment du navigateur, suppose la durée connue ;
- (b) déléguer au `<video>` natif (actuel) → le faux node du test doit imiter le clamp (fix infra).

**Décision auteur (2026-06-26) : (a) — le clamp appartient à CodPlay.** Avec preload-media la durée
est connue d'avance, et la config du perso peut ne lire qu'une **portion** du media. La borne de
clamp est la **fenêtre de lecture effective** `[in, out]`, pas la durée brute.

**Contrat amendé dans les specs (2026-06-26).** La portion existait déjà via `broadcast.startAt` /
`broadcast.endAt` (`v1-perso-spec §7`). Ajouté :
- `v1-perso-spec §7bis` — fenêtre effective `[in, out]` (`in = startAt ?? 0`,
  `out = min(endAt ?? durée, durée)`), clamp normatif de `getCurrentTimeMs` et de toute position de
  sync (lecture/seek) à `[in, out]`, durée connue via preload (pas la métadonnée DOM), responsabilité
  CodPlay (indépendant du clamp natif `<video>`) ;
- `v1-seek-spec §64` — « durée effective » = longueur de la fenêtre `out - in`.

**Implémenté (2026-06-26).** `media-component.ts` :
- `clampToPlaybackWindowMs` borne `getCurrentTimeMs` et `setCurrentTimeMs` à `[0, out]`
  (`out = getDurationMs()`), point unique où le narrowing `startAt`/`endAt` se branchera ;
- `render()` crée la racine via le `nodeFactory` (`buildNode('div')` au lieu du parse de template
  `'<div></div>'`) : la durée effective remonte alors correctement à la node media (en prod : vraie
  durée chargée ; en test : durée déclarée portée par la node). Sans ça, la racine issue du parse de
  template ne portait pas la durée et la node retombait sur le défaut.

lot19 9/9, **suite complète 236/0**. Reste en suivi : narrowing `startAt`/`endAt` (fenêtre `[in,
out]` complète) et sourcing explicite de la durée depuis le manifest preload (aujourd'hui via la
node, équivalent en prod après preload).

### 4. Live — `scene-bootstrap.spec.ts` (2 tests)

| Test | Attendu | Réel |
|---|---|---|
| update strap visible à l'event live suivant | `className = 'revealed'` | `''` |
| strap émet live même si l'event déclencheur est `persist-only` | `className = 'resolved'` | `''` |

Ces tests portent sur le **routage d'événements live**, pas sur le seek. Le 2ᵉ encode mot pour mot
CLAUDE.md / event-spec : « a strap body always emits apply-now regardless of the triggering event's
mode ». Comportement affectant le rendu, mais aucune démo connue n'exerce un déclencheur
`persist-only` produisant un reveal via strap.

**Cause finale (2026-06-26) — TEST PÉRIMÉ, même racine que le cluster 1.** Trace de
`routeSceneEvent` → `routeMatchingRules` → `executeStrap` : les règles `listen` matchent bien
(`storyRulesCount: 1`), mais `executeStrap` sort en amont car `resolveStrap` ne trouve pas le strap.
Les straps sont fournis via la `strapCollection` globale (ou en `string[]` de noms dans
`story.straps`), alors que les règles sont story-local → isolation stricte → strap introuvable → ni
`update` ni `reveal` → className vide. Ce n'est ni un défaut de propagation d'état ni d'application
d'action : le strap **ne s'exécute pas du tout**.

**Vérifié empiriquement** : en mettant la vraie `StrapCollection` (map nom→fonction) dans
`story.straps`, les **2 tests passent** (scene-bootstrap 6/6).

→ **Fix = corriger le câblage du test**, pas le code. La règle CLAUDE.md « strap body always emits
apply-now » reste vraie ; elle n'était jamais atteinte ici faute d'exécution du strap.

## Décisions / statut (mis à jour 2026-06-26)

| # | Cluster | Nature réelle | Action faite / à faire |
|---|---|---|---|
| 1 | Horizon `role:master` + `authorEndMs` (3) | **Test périmé** (isolation story-straps) | ✅ Câblage test corrigé (`support-story.straps`) → 10/10. Code non touché. |
| 2 | lot13 `adapter.seek` ×3 (2) | **Régression code** (double sync) | ✅ `create-player.ts:1256` retirée → lot13 12/12, aucune régression. |
| 4 | scene-bootstrap live (2) | **Test périmé** (isolation story-straps) | ✅ Câblage test corrigé (`story.straps` = map fonctions) → 6/6. Code non touché. |
| 3 | lot19 clamp `currentTime` (1) | **Régression valeur suivie** + contrat à spécifier | ✅ Contrat amendé (`v1-perso-spec §7bis`, `v1-seek-spec §64`) **et implémenté** (clamp + racine media via factory). lot19 9/9. Suivi : narrowing `startAt/endAt`, durée explicite via manifest preload. |

## Enseignement (validation de l'avertissement auteur)

Sur 8 tests, **2 clusters (1 et 4, soit 5 tests) étaient des tests périmés**, pas des régressions :
ils câblaient un strap story-local via la `strapCollection` globale, ce que la feature **story-straps
(19/06)** interdit volontairement. **« Corriger le code » pour les verdir aurait retiré l'isolation
et cassé la portabilité des stories** — exactement la régression que l'avertissement visait. Le bon
geste était de corriger le **câblage des tests**.

Le départage qui a marché : ne jamais conclure « régression » sur la seule lecture spec↔test ;
**tracer l'exécution réelle** (ici : le strap ne tournait pas du tout) puis confronter à la feature
en vigueur. Les deux vraies régressions (2 = double sync ; 3 = clamp manquant) touchent des chemins
non exercés par la validation au rendu, et leur fix ne ré-introduit aucun bug de rendu.
