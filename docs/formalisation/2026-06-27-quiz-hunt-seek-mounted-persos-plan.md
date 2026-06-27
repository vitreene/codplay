# Plan — réduire le coût de `loadPersos` au seek en distinguant épreuve active / dormante

## Statut

**Non implémenté.** Document de cadrage pour discussion, suite à la mesure du 2026-06-27 (voir
contexte). Ne pas implémenter avant d'avoir choisi une des deux options ci-dessous (ou une autre).

## Constat mesuré

`player.seek()` coûte ~60-90ms dans quiz-hunt après seulement 5 épreuves jouées, et ce coût est
quasiment **constant** quel que soit la cible du seek (`seek(0)` ≈ `seek(27000)`). Décomposition
mesurée (instrumentation temporaire, retirée après mesure) :

| Étape | Coût mesuré |
|---|---|
| `loadMountedRuntimePersos` (→ `renderer.load()` → `orchestrator.loadPersos()`) | 36 à 72 ms — dominant, fixe |
| `replayDueTimelineEventsForSeek` (rejoue les events réellement dus) | 0.2 à 11 ms |
| reste (reset curseurs, sync animations, sync média…) | < 1 ms chacun |

`loadPersos` (`runtime-component-orchestrator.ts:401`) itère sur **tous les persos de toutes les
stories montées** (`Object.values(runtimePersos.persos)`), sans filtre, et rafraîchit chacun
(`refreshLoadedRuntimeComponent` → `tryInitComponent(..., "refresh")`). Dans quiz-hunt, les 32
stories d'épreuve (16 mots + 16 finales) sont **toutes montées dès le chargement de la scène** et
ne sont jamais démontées — chacune avec ~10-15 persos (panneau, champs de réponse, contrôles,
résultat…), soit plusieurs centaines de persos rafraîchis à chaque seek, alors qu'une seule
épreuve est visible à la fois (les autres sont seulement masquées par une classe CSS
`is-hidden`/`is-visible`, pas démontées ni détachées du DOM).

## Contrainte existante à respecter

Un commentaire déjà présent dans `runtime-component-orchestrator.ts` (`loadPersos`, autour du
seek) documente une décision délibérée : **pas de détachement DOM transitoire** à chaque
refresh/seek — un détachement répété casse le décodage des médias (`<img>`/`<video>`,
`naturalWidth` corrompu au refresh suivant). Voir aussi `v1-seek-spec.md` (appendice
2026-06-25) et la mémoire `project-orchestrator-detach-false-optimization`.

Cette contrainte ne bloque pas un détachement **persistant**, posé une fois à la fermeture réelle
d'une épreuve (un événement rare, pas à chaque seek) — seulement un détachement répété à chaque
cycle de refresh/seek.

## Le nœud du problème

Aujourd'hui, rien dans le plan runtime ne distingue "épreuve active" d'"épreuve dormante" :
- Il n'existe **aucune capacité de démontage** (`unmount`) dans le moteur — `mountStory`
  (`create-player.ts:1007`) existe et est appelé via les hooks de scène
  (`createLifecycleOptions`), mais une fois montée, une story reste montée pour toujours.
- Toutes les épreuves de quiz-hunt sont déplacées (`move`) sous le même conteneur
  (`game:zone:main`) dès leur création ; seule une classe CSS les cache.
- `loadPersos` n'a donc aucun signal exploitable pour limiter son travail aux persos
  effectivement pertinents.

## Deux options envisagées

### Option A — démontage réel des stories (capacité moteur nouvelle)

Ajouter une vraie capacité `unmount` au joueur (symétrique de `mountStory`). Quiz-hunt démonterait
une épreuve à sa fermeture (après le délai de résultat) plutôt que de la garder montée
indéfiniment. `loadPersos` n'itérerait alors que sur les stories réellement montées au moment du
seek — le nombre de persos traités tomberait au nombre de l'épreuve active (+ les stories
toujours actives : grille, panier, minuteur), au lieu de 32 épreuves complètes.

- Avantage : règle le problème à la racine, bénéfice pour toute scène à beaucoup de stories
  ponctuelles (pas seulement quiz-hunt).
- Coût : vraie nouvelle capacité de cycle de vie côté moteur — démontage propre (libération des
  composants, des nœuds DOM, des éventuelles ressources média), à spécifier et tester
  soigneusement (impact sur seek/replay : que devient une story démontée puis re-ouverte après un
  seek en arrière dans le temps ?).

### Option B — marqueur actif/dormant sur le plan runtime (sans toucher au cycle de vie mount/unmount)

Sans ajouter de démontage, enrichir le plan runtime d'un signal "cette story est actuellement
active" (porté par exemple par l'état de scène — `currentTrialId` existe déjà dans quiz-hunt) et
faire filtrer `loadPersos` sur ce signal : ne rafraîchir que les persos des stories actives, sans
toucher à celles qui restent montées mais inactives.

- Avantage : ne touche pas au cycle de vie mount/unmount existant, changement plus contenu côté
  moteur.
- Coût : nécessite que CHAQUE scène avec beaucoup de stories dormantes expose explicitement ce
  signal "actif" (sinon comportement par défaut = tout reste rafraîchi comme aujourd'hui) — sémantique
  nouvelle à définir clairement (qu'est-ce qu'une story "active" pour une scène qui n'a pas de
  notion de trial unique, par ex. un dashboard avec plusieurs zones simultanément visibles ?).
- Reste à clarifier : un perso non rafraîchi au seek garde-t-il un état RUNTIME potentiellement
  périmé jusqu'à sa prochaine activation ? Faut-il un rattrapage au moment où la story redevient
  active ?

## Points à trancher avant d'implémenter (les deux options)

- Sémantique exacte d'un perso "dormant" pendant un seek : son état interne doit-il rester
  strictement gelé jusqu'à réactivation, ou y a-t-il des cas où il doit malgré tout refléter le
  nouveau timelineMs (ex. un minuteur visible en arrière-plan) ?
- Mesure de l'impact réel attendu : avec ~10-15 persos par épreuve active (au lieu de ~300-450 sur
  32 épreuves), le gain visé est de l'ordre d'un facteur 20-30 sur `loadPersos` — à valider une
  fois l'option choisie implémentée, par la même mesure que celle de ce document.
- Si Option A : définir précisément ce qu'un démontage doit libérer (composants, nœuds DOM,
  écouteurs média) et comment `seek` vers un timelineMs où l'épreuve était encore active doit la
  remonter correctement (replay cohérent avec l'état reconstruit).

## Prochaine étape

Choisir une option (A, B, ou une troisième) avec l'auteur avant tout code. Ce document ne
contient aucune implémentation.
