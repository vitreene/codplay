# Défaut corrigé — insertion d'un event différé désynchronisait le curseur de track pendant un rejoué groupé

## Statut

Défaut découvert et corrigé le 2026-06-29, en validant visuellement la démo `move-off` (Phase 3 de
`2026-06-28-unify-action-execution-and-move-off-plan.md`). Préexistant, indépendant de cette Phase 3
et du défaut de seek déjà cadré dans `2026-06-28-seek-continuous-engine-overwrite-defect.md` — un
troisième mécanisme distinct, qui se combinait avec eux dans la démo pour produire une incohérence
visuelle entre `play` et `seek`.

## Le défaut

`TrackManager.collectDueEvents` (et les boucles `create-player.ts` qui l'appelaient) collectaient
**tous** les events dus en un seul lot, en avançant le curseur de chaque track (`nextIndex`) pour
l'ensemble du lot, **avant qu'aucun de ces events n'ait été traité**.

Quand le traitement du premier event du lot matérialise un nouvel event différé — via
`appendGeneratedEvents`/`TrackManager.appendEvents` (le mécanisme partagé par `ActionSequence` et
les helpers de strap `wait`/`repeat`/`stagger`/`sequence`) — `appendEvents` faisait `push()` puis
**retriait tout le tableau par ms**. Si le nouvel event devait chronologiquement s'intercaler
**avant** un autre event déjà présent dans le lot en cours (donc déjà compté par le curseur, mais
pas encore traité), le tri le déplaçait à un index antérieur à celui que `nextIndex` pointait
désormais — désynchronisant le curseur de deux façons à la fois :

- le nouvel event, désormais à un index **antérieur** à `nextIndex`, n'était plus jamais revisité —
  **perdu silencieusement** ;
- l'event déjà présent dans le lot se retrouvait, après le tri, à un index **postérieur** ou égal à
  `nextIndex` — **rejoué une seconde fois** au tour suivant de la boucle.

## Manifestation concrète (démo move-off)

Seek direct vers ms3000 (`detach`@1000 et `attach`@3000 dus dans le même lot) : `detach` déclenche
une `ActionSequence` (fondu puis `move:"off"`) dont l'étape différée tombe à ms1500, donc **avant**
`attach`. Cette étape était perdue ; `attach` était rejoué deux fois. Résultat visible : le panneau
revenait dans le DOM (par `attach`) mais avec l'opacité laissée par le fondu (`0`), invisible — sans
lien avec le défaut de ré-évaluation de tween déjà cadré séparément. Explique aussi l'asymétrie
observée entre lecture normale (jamais affectée : les events arrivent un par un au fil du temps réel,
jamais groupés) et seek direct vers une cible lointaine (où plusieurs events dus se retrouvent
fréquemment dans le même lot).

## Correction

Deux changements complémentaires :

1. **`TrackManager.appendEvents`** ne retrie plus tout le tableau. Le préfixe déjà collecté
   (`events[0, nextIndex)`) est gelé ; seul le suffixe non encore collecté est fusionné avec les
   nouveaux events puis trié (`TrackManagerCodec.sortEventsForTrack`, nouvelle méthode, factorisée
   depuis `sortTrackEvents`). `nextIndex` reste valide par construction.
2. **Traitement event par event, pas par lot** : nouvelle méthode
   `TrackManager.collectNextDueEvent({nowMs})`, qui retourne l'event dû le plus proche
   chronologiquement parmi toutes les tracks actives et n'avance que **son** curseur, d'une seule
   position. `replayDueTimelineEventsForSeek`, `runDueTimelineEventsSync` et
   `runDueTimelineEvents` (`create-player.ts`) l'utilisent désormais à la place de
   `collectDueEvents`, dans une boucle qui retraite à chaque itération — un event matérialisé par le
   traitement du précédent est ainsi pris en compte au bon rang chronologique dès l'itération
   suivante, plutôt que coincé derrière un event déjà groupé dans un lot figé.

Le premier changement seul aurait évité la perte silencieuse de l'event différé, mais pas son
intercalation au bon rang chronologique avant un event déjà groupé dans le même lot (il aurait
simplement été traité **après**, pas dans l'ordre). Le second changement est ce qui restaure l'ordre
correct.

`collectDueEvents` reste en place (toujours testé directement, `tests/v1/track-manager.spec.ts`) —
plus consommé par `create-player.ts`, mais pas retiré : changer son propre contrat par lots aurait
été un changement plus risqué et non nécessaire une fois le traitement event-par-event en place côté
appelant.

## Tests ajoutés

- `tests/v1/move-off-detach.spec.ts` — reproduit exactement le scénario (perso-level
  `ActionSequence`, deux events dus dans le même lot, l'étape différée devant s'intercaler entre
  eux).
- `tests/v1/action-sequence-strap.spec.ts` (AS-STRAP-T2) — même scénario via le mécanisme
  strap-level (`context.planned.sequence`), pour confirmer que la correction n'est pas spécifique à
  `ActionSequence` mais corrige bien le mécanisme partagé de matérialisation.

Suite complète (252 tests) et gates verts après correction.

## Démos à revérifier visuellement

Le correctif est posé au niveau commun (`TrackManager` + boucles de rejoué), donc il s'applique
uniformément sans patch par démo. Risque résiduel limité aux démos qui (a) matérialisent des events
différés via `ActionSequence` ou `context.planned.*`, et (b) sont scrutées par un seek direct vers
une cible qui regroupe plusieurs events dus en même temps (peu probable en lecture normale, plus
probable lors d'un scrubbing large). Candidates identifiées par recherche de motif :
`s4-quiz-reference-scene.ts` (`context.planned.delay`), `quiz-hunt` (volume d'events le plus élevé).
Aucune vérification visuelle indépendante de la mienne n'a été faite sur ces démos au-delà des tests
automatisés déjà verts.
