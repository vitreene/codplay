# Media sync V2

> Status: En cours
> CodPlay version: V2 foundation

## Role

`media-sync` synchronise les composants `media` avec l'horloge du player. Il
est enregistré comme module core dans le catalogue runtime et créé une fois par
instance de player. Il ne précharge pas les ressources et ne lit pas le DOM
directement : il appelle l'API exposée par le composant materialisé.

## Contrat

- les actions compilées `broadcast` acceptent `START`, `PAUSE` et `STOP` ;
- `broadcast.startAt` et `broadcast.endAt` définissent la fenêtre de lecture
  effective ; toute position appliquée est clampée dans cette fenêtre ;
- `broadcast.transition` est transmis au composant pour interpoler les
  propriétés de lecture déclarées (`from`, `to`, `duration`) ;
- `initial.master: true` marque une source temporelle candidate ; ce n'est pas
  un nouveau type de composant ;
- le master actif fournit le temps logique à CodPlay ; le module ne le corrige
  pas pendant la lecture ordinaire ;
- lorsque plusieurs candidats sont actifs, le dernier `START` appliqué est
  prioritaire ; si le master devient indisponible, inactif, en pause ou
  terminé, le temps CodPlay revient au ticker ;
- un média à timeline native non-master avance avec sa propre horloge ; il n'est
  pas repositionné à chaque frame ;
- les médias déjà pilotés par le ticker restent dans leur circuit normal ;
- avant un seek, les médias natifs actifs sont mis en pause ; la scène est
  ensuite reconstruite, les positions sont repositionnées et la lecture reprend
  éventuellement ;
- un seek reconstruit les positions sans détruire ni recharger les nodes média ;
- un seek arrière rejoue les broadcasts actifs, y compris après que le média
  natif a atteint sa fin ;
- la durée utilisée pour la fin d'un média vient des métadonnées produites par
  le preload, et non de `HTMLMediaElement.duration` ;
- `setRate(rate)` est propagé aux composants media et à leurs nodes natives ; le
  master reste la source de l'horloge et n'est pas corrigé par le ticker à
  chaque frame ;
- les nodes ne sont libérées qu'au teardown final du player.

La correction de dérive en lecture continue est une optimisation ultérieure. Elle
ne fait pas partie de cette étape et ne pourra concerner que les médias natifs
non-master, jamais la source `master`.

Le `preload` reste une capacité externe. `HtmlPlayerRunner.run()` l'enchaîne
explicitement avant `init()` et `play()` pour la diffusion autonome, mais
`media-sync` n'en dépend pas par un circuit implicite.

## Frontière d'implémentation

`media-sync-capability.ts` est l'unique module player-scoped de cette tranche.
Il lit les actions de la `SolvedScene` et appelle la surface
`MediaSyncRuntimeComponent`, qui reste indépendante du DOM et peut donc être
fournie par le materializer approprié. Aucun second runtime de synchronisation
ne concurrence ce module. La surface arrive par le
`RuntimeComponentSurfaceResolver` du contexte module ; le module demande
`getSurface(runtimeItemId, 'media')` et ne récupère pas le composant concret.
La résolution est typée à la déclaration du catalogue et ne comporte pas de
duck typing à l'exécution.

## Preuves

- `tests/runtime/capabilities/media-sync-module.spec.ts` couvre master,
  arbitrage du master précédent, fallback ticker, absence de seek par frame,
  pause avant seek, seek, transition et rate ;
- `tests/runtime/runner/html-player-runner.spec.ts` couvre la persistance
  `node-per-src`, le choix audio/vidéo par métadonnée et le rate natif ;
- `tests/runtime/preload/runtime-preload.spec.ts` couvre la propagation des
  métadonnées de durée ;
- `demos/validation/player` valide le preload externe et le circuit de lecture
  média ; la validation visuelle Safari reste ouverte à cause d'un écran noir
  signalé pendant la lecture vidéo.
