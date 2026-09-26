# CodPlay V2 — Engine, Player et Seek groupé

## Périmètre certifié

Cette spécification décrit les comportements Engine/Player couverts par les
tests ciblés. La surface exposée à l’hôte est dans la
[spécification de façade](./facade-v2-spec.md). La reconstruction temporelle
est décrite par les spécifications du [pipeline événementiel](./event-pipeline-v2-spec.md)
et de la [reconstruction logique](./runtime-reconstruction-v2-spec.md). La
préparation et la présentation motion restent suivies par le
[plan player](../plan/player-engine-plan.md) et les plans motion.

## Engine et horloge

[`RuntimeEngine`](../src/runtime/engine/runtime-engine.ts) avance ses instances
dans leur ordre d’enregistrement. Il peut recevoir une position externe
déterministe ou un payload de `TimeTicker` ; il transmet au player les mesures
`prevMs`, `deltaMs` et `marginMs` fournies par le ticker. Après `stop()`, les
frames de l’horloge externe ne sont pas propagées tant que le transport n’a pas
repris.

L’engine prépare les bibliothèques requises une seule fois et refuse la
préparation d’une scène quand une bibliothèque ou une capacité compilée n’est
pas disponible. Les détails de catalogue et de projection tierce sont décrits
dans leurs spécifications respectives.

## Player et temps logique

Le player reçoit un `CompiledScene` et son engine ; il ne crée pas sa propre
horloge. Il possède le cycle de vie et le temps logique de son instance. Une
reconstruction par Seek utilise le pipeline logique partagé.

Une occurrence `sequence:end` atteinte pendant la lecture arrête la séquence et
place le player dans son état terminal. Un Seek qui franchit cette borne
reconstruit la position demandée sans déclencher la fin terminale. Le test de
cycle terminal vérifie qu'un `reset()` rétablit l'état initial puis permet de
reprendre la lecture. L'intégration d'inactivité vérifie aussi que
`instance.telco.play()` après une fin `sequence:end` reprend à `0 ms`. L'appel
direct à `RuntimePlayer.play()` et son effet complet sur le journal, les modules
et les callbacks restent au [plan Player](../plan/player-engine-plan.md).

Un `sequence:end` compilé déclaré `public` traverse le dispatcher ordinaire une
seule fois avant le nettoyage terminal ; ses règles `listen` sont également
exécutées une seule fois. Un `sequence:end` injecté à l'avance devient terminal
à la prochaine frame de lecture.

Les callbacks de cycle de vie `init`, `onStart` et `onSequenceEnd` sont extraits
par le builder dans la collection de fonctions puis invoqués par le player à
leurs frontières respectives. Ils reçoivent les options de cycle prévues, dont
un `schedule` appelable.

Le player publie un résultat structuré de Seek contenant `ok`, `timeMs` et les
diagnostics. Si la matérialisation échoue pendant le commit, le Seek échoue et
le player restaure la scène précédemment présentée. Les diagnostics du groupe
sont associés aux instances concernées.

## Seek groupé

`RuntimeEngine.seek()` traite les cibles sélectionnées par phases ordonnées :

```text
validateSeek -> prepareSeek -> commitSeek -> presentSeek
```

Les phases sont synchrones. Une cible invalide empêche la préparation du
groupe. Si un commit échoue après préparation, les cibles déjà traitées sont
restaurées et aucune présentation partielle n’est publiée. Le seek groupé ne
fait pas avancer l’horloge partagée ni ne redistribue une frame.

## `RenderSync`

[`RenderSync`](../src/runtime/player/render-sync.ts) transmet les mesures
temporelles aux adapters enregistrés, dans leur ordre d’enregistrement. Le
premier tick après une baseline vaut zéro pour les deltas muraux et logiques.
Un Seek ou une reprise réinitialise la baseline ; `stop()` l’efface. Une erreur
d’un adapter ne bloque pas les adapters suivants.

## Preuves

- [`runtime-engine.spec.ts`](../tests/runtime/engine/runtime-engine.spec.ts)
  vérifie l’ordre des instances, le ticker, l’arrêt, les requirements et les
  phases de Seek groupé, dont validation et rollback.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  vérifie le cycle de vie, le terminal `sequence:end`, le résultat structuré
  d’un Seek, la restauration après échec, le groupement et les services par
  player, ainsi que le dispatch unique de la fin et les callbacks de cycle.
- [`idle-config.spec.ts`](../tests/facade/idle-config.spec.ts) vérifie le
  redémarrage par `instance.telco.play()` après l'événement terminal d'inactivité.
- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie l'extraction des callbacks de scène sous forme de références de
  fonctions compilées.
- [`render-sync.spec.ts`](../tests/runtime/player/render-sync.spec.ts)
  vérifie les deltas, les baselines, l’ordre des adapters et l’isolation des
  erreurs.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/engine/runtime-engine.spec.ts \
  tests/runtime/player/runtime-player.spec.ts \
  tests/runtime/player/render-sync.spec.ts \
  tests/scene/compiled/scene-builder.spec.ts
4 fichiers, 70 tests réussis
```

## Limites

La validation de la préparation motion par occurrence, du reset chaud et de la
réutilisation de l’état logique pendant Play/Seek reste dans les plans actifs.
Le redémarrage direct de `RuntimePlayer.play()` depuis l'état terminal, avec
ses effets sur le journal, les modules, les captures et les callbacks, reste au
[plan Player](../plan/player-engine-plan.md). La reprise par
`instance.telco.play()` après une fin d'inactivité est couverte par sa
spécification dédiée.
Cette spécification n’établit pas la validation complète du runner HTML en
navigateur.
