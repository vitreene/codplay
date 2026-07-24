# Analyse — illusion de « lecture inversée » sur la démo mashup

Statut : analyse + proposition, **non validées**. Pas d'implémentation avant
confirmation (dernière section).

## Cadrage demandé

À un instant réel `t` (ex. 5000ms), un event déclenche une séquence
d'**actions réelles, valeurs en dur** qui donne l'illusion que la scène
« repart en arrière » pendant 1,5s jusqu'à ressembler à son état à `t-3000`
(2000ms), tient une pause de 1s dans cet état, puis repart en avant. Ce n'est
**pas** un `seek` : l'horloge maître du player n'est ni gelée ni manipulée,
aucune reconstruction par replay de track n'entre en jeu (`v1-seek-spec.md`).

Le planning original (visèmes, mots, ticks du compteur — statique, connu à
l'avance) est transformé en un planning augmenté : une partie du contenu est
décalée plus tard, une tranche « en sens inverse » est insérée entre les
deux, puis la fenêtre rejouée est **dupliquée à l'identique** (mêmes
valeurs, même espacement — pas de rejeu accéléré/ralenti). Un seul planning
continu par section, jamais deux flux concurrents sur les mêmes persos au
même instant.

## Track dédié — mécanisme déjà existant, pas à construire

`v1-scene-spec.md:184` : « une seule track dédiée par nom de strap et par
story » — chaque strap obtient déjà automatiquement son propre track
(`createStrapTrackId(scopeStoryId, strapName)`, confirmé
`player.ts:669-670,1149`). Donc « les events du retour arrière vont sur un
track dédié » ne demande **aucune nouvelle story ni aucun nouveau mécanisme
scene-level** : il suffit de répartir la logique de l'illusion sur des
**straps distincts**, chacun retournant son propre `context.planned.sequence`
— chaque strap matérialise alors ses events sur son propre track,
automatiquement isolé de celui des eventimes existants de
`mashup-root-story` (qui restent, eux, sur le track `story.id` par défaut,
`v1-scene-spec.md:181,185`).

Deux straps suffisent, ciblant chacun les persos **existants** de la scène
(aucun perso dupliqué) :

- `mashup-rewind-back` — joue la tranche inversée compressée.
- `mashup-rewind-resume` — rejoue à l'identique la fenêtre concernée puis
  enchaîne sur la suite du phrasé/compteur original.

`Scene.tracks`/`Story.trackId` existent aussi (registre scene-level,
activation `track:activate`/`deactivate`/`toggle`, `role: "master"` pour
l'horizon — `v1-scene-spec.md:171-197`) mais ne sont pas nécessaires pour ce
design : la granularité par strap suffit à isoler le retour arrière du
planning normal.

## Le helper est un outil de construction, pas un composant de la scène

`buildReverseIllusionSchedule` ne connaît ni story, ni track, ni strap, ni
perso : il prend une liste de cues **relatives** (déjà connues, ex. les
tables `MOUTH_CUES`/`phraseWordsFR`, ou les ticks du compteur) et un point de
coupe, et rend deux listes relatives-depuis-zéro, prêtes à être passées
telles quelles à `context.planned.sequence` dans les deux straps ci-dessus.
Rien dans ce helper ne dépend du moteur codplay — il pourrait aussi bien
être testé seul.

```ts
type TimedEntry<T> = { offsetMs: number; value: T }

type ReverseIllusionSpec = {
  /** Coupe basse, dans la séquence originale (ex. 2000) — l'état qu'on mime de retrouver. */
  targetOffsetMs: number
  /** Coupe haute, dans la séquence originale (ex. 5000) — l'instant du déclenchement. */
  triggerOffsetMs: number
  /** Durée du trajet retour, compressée depuis (triggerOffsetMs - targetOffsetMs). */
  reverseDurationMs: number
  /** Durée du palier figé une fois "arrivé" à targetOffsetMs. */
  pauseDurationMs: number
}

type ReverseIllusionSplit<T> = {
  /** Relatif-depuis-zéro : à passer à context.planned.sequence dans le strap "back". */
  back: TimedEntry<T>[]
  /** Relatif-depuis-zéro : à passer à context.planned.sequence dans le strap "resume". */
  resume: TimedEntry<T>[]
}

function buildReverseIllusionSchedule<T>(
  entries: TimedEntry<T>[],
  spec: ReverseIllusionSpec
): ReverseIllusionSplit<T>
```

Mécanique :

1. `windowEntries` = entrées avec `offsetMs` dans `[targetOffsetMs,
   triggerOffsetMs)` — la fenêtre à rejouer. Le reste de la séquence
   originale (`< targetOffsetMs` et `>= triggerOffsetMs`) n'est jamais touché
   par le helper.
2. `back` : chaque entrée de `windowEntries` est repositionnée par
   `distanceFromTrigger = triggerOffsetMs - entry.offsetMs`, mis à l'échelle
   par `reverseDurationMs / (triggerOffsetMs - targetOffsetMs)` — l'ordre
   inverse sort naturellement du calcul.
3. `resume` = `windowEntries` **dupliquées à l'identique** (mêmes valeurs,
   même espacement que l'original — aucune mise à l'échelle), repositionnées
   à partir de l'offset 0, suivies de la queue originale (`entries` avec
   `offsetMs >= triggerOffsetMs`), re-basée pour continuer immédiatement
   après.
4. Le strap `mashup-rewind-back` enchaîne, après son `sequence`, un `wait`
   pour le palier figé (`pauseDurationMs`), puis émet l'event qui déclenche
   `mashup-rewind-resume`.

Le code appelant (dans la scène) doit aussi retirer de `mashup-root-story
.eventimes` toute entrée `offsetMs >= triggerOffsetMs` — sans quoi elle
continuerait de se déclencher à son horaire d'origine, en double de ce que
`resume` régénère. `[0, triggerOffsetMs)`, lui, reste inchangé : il se joue
normalement une première fois avant le déclenchement.

## Application aux canaux de la démo

- **Visèmes / mots** : un appel du helper chacun, avec le même `spec` (pour
  rester synchronisés) ; sorties injectées dans les deux straps, ciblant
  directement `mashup-avatar`/la légende — persos existants, actions
  existantes (`avatar:viseme`, `subtitle:word`).
- **Compteur** (`mashup-quiz-count`, perso existant, aucun doublon) : les
  ticks post-déclenchement sont eux-mêmes une table de cues relative
  (`{offsetMs:0,value:'10'}, {offsetMs:1000,value:'9'}, ...`), passée au
  même helper. `back`/`resume` ciblent directement l'action existante
  `mashup:quiz-count` (`data.content`). Le `context.live.loop` actuel
  (`mashup-quiz-countdown-start`) reste inchangé pour les 0–5s
  interruptibles par une réponse utilisateur ; au déclenchement du rewind,
  il s'arrête (`counter:stop`, déjà prévu) et la suite est entièrement
  statique — pas d'interruption possible pendant l'illusion elle-même,
  cohérent avec « illusion, pas système dynamique ».
- **Audio** (`mashup-audio`) : `broadcast:{type:'START', startAt}` est déjà
  réutilisable à tout instant, pas seulement au montage
  (`create-media-sync-module.ts:136-161`). Une liste d'échantillons
  `{offsetMs: t, value: t}` prise à pas fixe sur la fenêtre, passée au même
  helper : `back` donne les instants de déclenchement, `value` le `startAt`
  média (scrub par sauts).
- **Fond threejs** (`mashup-bg`) : pas une table de cues, juste deux points
  de contrôle (pas besoin du helper) — un ref custom lu par `simulate`,
  piloté par `action.set` (déjà câblé, `threejs-base-component.ts:135-145`) ;
  flip de direction au déclenchement, flip retour à la reprise. La closure
  devra accumuler une horloge virtuelle (`virtualElapsed += timelineDeltaMs
  * direction`) plutôt que dériver de `timelineMs` absolu.

## Points confirmés

1. Emplacement du helper : `packages/demos/src/scenes/shared/`.
2. Nom de la démo copiée : `mashup-back-and-fore`.
3. Aucun perso dupliqué — tous les canaux ciblent leurs persos/actions
   existants depuis les deux straps `mashup-rewind-back`/`-resume`.

Plus aucun point ouvert — prêt pour la duplication de la démo et
l'implémentation, sur confirmation finale de lancer l'exécution.
