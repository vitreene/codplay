# Acceptation restante — média et preload V2

> Status: En cours — les contrats vérifiés du service preload et de la
> synchronisation média sont dans leurs spécifications ; les gates ci-dessous
> restent ouvertes.
> CodPlay version: V2 foundation

- Service de ressources : [spécification preload](../specs/preload-v2-spec.md).
- Lecture et synchronisation natives : [spécification media-sync](../specs/media-sync-v2-spec.md).

Ce plan garde les décisions acceptées mais non appliquées, les points à
trancher et leurs critères d'acceptation. Il ne recopie pas les contrats déjà
vérifiés.

## Décision acquise, implémentation ouverte

Une future façade `run()` de diffusion autonome enchaîne le chargement explicite
des ressources, l'initialisation synchrone du player, puis `play()` :

```text
preload.load(manifest) -> player.init() -> player.play()
```

Elle ne rend pas le preload implicite dans `init()` et ne modifie pas la
surface du service `RuntimePreload`. La façade `run()` n'est pas encore exposée
par `CodPlay`.

## Décision acceptée, application non planifiée — source média en direct

Une source déclarée comme direct reste au temps réel (`now`) ; un Seek ne la
rembobine pas. Le `rate` logique est ignoré pour son contenu, et pause/reprise
ne figent pas puis ne rattrapent pas la source : la reprise retrouve l'instant
courant. Le mode doit être déclaré par l'auteur, car l'adresse d'une source ne
permet pas de distinguer sûrement un direct d'un média enregistré.

La déclaration auteur, l'interaction avec le rôle de master, les effets visibles
de pause et de masquage, ainsi que la propriété et la libération de la source
restent à définir. Aucune API `live` n'est adoptée. Avant implémentation, arrêter
ces choix puis valider le média, son hôte et le module de synchronisation sur
Seek, rate, pause/reprise, reset, teardown et navigateur réel. Le comportement
actuel de média enregistré reste celui de la
[spécification media-sync](../specs/media-sync-v2-spec.md).

## Commandes vidéo par broadcasts dédiés — A relire

**Statut : A relire.** Le besoin Quiz Hunt est maintenant de conserver le
broadcast `START` d'entrée, retirer l'attribut HTML `controls`, puis placer
sous la vidéo deux petits boutons : Play/Pause et rewind. Ils doivent agir sur
le seul perso `media` par ses broadcasts et ne doivent pas piloter le transport
général de la timeline. Cette entrée consigne le contrat à examiner ; elle
n'autorise pas une modification de `packages/codplay`.

### Besoin et constat

Le rewind est prévu comme un broadcast `START` média avec `startAt: 0`. La
pause utilise le broadcast média `PAUSE`. Le bouton Play/Pause doit alterner
entre ces commandes selon le comportement décidé ci-dessous ; son libellé
n'implique pas encore une sémantique de reprise validée.

Le circuit `media-sync` actuel connaît `START`, `PAUSE` et `STOP`. `START`
remet le média à la position `startAt` donnée, ou à `0` si elle est absente.
`PAUSE` fige la position attendue depuis la timeline de la scène. Aucune action
`RESUME` n'est déclarée dans le type des broadcasts. Par conséquent, `START`
après `PAUSE` ne reprend pas à lui seul la position suspendue. Il reste à
confirmer si le parcours Quiz Hunt peut accepter le redémarrage depuis `0`, ou
si une capacité de reprise doit être conçue dans le circuit existant.

Le démarrage automatique reste lié à `START` : un essai Safari avec l'attribut
HTML `autoplay` sur le nœud déjà préchargé n'a pas démarré la vidéo. La cause du
saut de première image reste ouverte ; une trace doit comparer `currentTime`
avant et après le seek de resynchronisation initial. Le `STOP` de fin de
feedback reste en place jusqu'à ce que le cycle de vie réel prouve qu'il est
redondant.

### Invariants à préserver

- Les deux boutons sont sous la vidéo, de petite taille, et remplacent les
  contrôles natifs dans le parcours Nostromo ; le style réutilise les éléments
  du projet et n'invente pas un nouveau traitement visuel.
- Les actions portent sur l'occurrence du perso vidéo seulement. Elles ne
  changent pas la position, l'état Play/Pause/Seek ni le contenu de la timeline
  générale et ne contrôlent pas la scène panier/minuteur.
- L'entrée en question continue d'émettre `START` à `startAt: 0`. La question
  conserve les 5 s d'indice, son formulaire et son feedback.
- La vidéo reste `master: false`. L'identité du nœud préchargé est conservée ;
  les boutons ne provoquent ni nouveau `load()` ni réassignation de `src`.
- Le `STOP` à la fin du feedback est conservé jusqu'à validation du cycle de
  sortie d'une scène question masquée.

### Décision ouverte avant implémentation

Choisir la sémantique de Play après Pause :

1. **Reprise exacte** à la position suspendue. Il faut d'abord vérifier si un
   chemin auteur déjà existant permet cette reprise ; sinon, concevoir une
   extension de `media-sync` et la faire accepter. Toute modification du cœur
   CodPlay demande une autorisation explicite distincte.
2. **Redémarrage depuis 0**, avec `START startAt: 0`. Ce choix utilise le
   circuit existant `PAUSE`/`START`, mais le bouton ne reprend pas la position
   où la vidéo a été suspendue.

Dans les deux cas, le bouton rewind émet `START startAt: 0`. Ne pas remplacer
les broadcasts du perso par des accès directs au nœud DOM, par le transport de
la timeline générale, ni par un circuit local parallèle. Si la reprise exacte
est retenue, documenter d'abord le comportement et l'acceptation du circuit
CodPlay dans ce plan ; ne pas déduire une nouvelle action `RESUME` de la seule
demande de boutons.

### Plan et acceptation

**P0 — Valider la sémantique de reprise (`A relire`).** Confirmer reprise exacte
ou redémarrage à 0. Si le choix est exact, préciser la capacité existante ou
proposer une évolution `media-sync` et obtenir son acceptation et l'autorisation
explicite requise. Aucun code dépendant ne commence avant cette validation.

**P1 — Contrôles dans Quiz Hunt.** Après P0, enlever `controls`, ajouter deux
boutons compacts sous la vidéo et faire émettre les broadcasts du seul perso
média. Garder `START` d'entrée et le `STOP` de fin de feedback. Une modification
de démo ne doit pas contourner le contrat `media-sync`.

**P2 — Contrat et non-régression CodPlay, si P0 l'exige.** Avec des fixtures
indépendantes de la démo, vérifier pause stable pendant la lecture de la scène,
reprise à la position attendue, rewind à zéro, interaction avec la fin native,
lecture/seek de scène et nettoyage. Si aucun code CodPlay n'est requis, ne pas
ajouter de test cœur redondant ; vérifier tout de même que les broadcasts
existants ciblent le seul média.

**P3 — Parcours navigateur réel.** Avec la vidéo préchargée, vérifier Safari :
`START` automatique à l'entrée, absence de contrôles HTML natifs, placement des
deux boutons sous la vidéo, Play/Pause selon P0, rewind du média sans seek de
scène, réponse et `STOP` de feedback, nouvelle entrée à zéro, identité du nœud
et absence de rechargement. Relever `currentTime` autour du `START` initial pour
diagnostiquer le saut de première image. Garder ouverts les gates preload et
cycle de vie qui ne sont pas exercés.

**P4 — Clôture documentaire.** Après validation runtime et navigateur,
compléter la spécification media-sync uniquement pour tout comportement de
cœur nouvellement implémenté et vérifié, mettre à jour les preuves de Quiz Hunt
et fermer les entrées correspondantes. Une vérification de démo seule ne
certifie pas une nouvelle capacité CodPlay.

**Gate d'autorisation.** Cette entrée reste `A relire` jusqu'à la décision P0.
La demande de boutons autorise leur mise en place dans la démo après clôture
du contrat ; elle n'autorise pas, à elle seule, une évolution de
`packages/codplay`.

## Preuves de service à compléter

La spec preload est limitée aux comportements déjà couverts. Les surfaces
suivantes existent dans le code ou les types, mais aucune preuve ciblée n'a été
trouvée pendant cette revue :

- [ ] état et compteurs d'une opération, résultat `skipped` sur cache déjà
      prêt, timeout par ressource et valeur par défaut ;
- [ ] `cancel()` pendant un chargement partagé, sans interrompre le propriétaire
      restant, et annulation par `CodPlay.destroy()` ;
- [ ] nettoyage par destruction des handles média non adoptés ou déjà
      transférés ;
- [ ] chemin public `registerStrategy()` et stratégies natives `audio`, `font`
      et CSS par URL ; le test CSS existant porte seulement sur le slot CSS en
      mémoire. Le CSS du paquet de diffusion dépend aussi du
      [plan de scène compilée](./compiled-scene-plan.md) ;
- [ ] seek et teardown après adoption d'une node préchargée, sans relancer son
      chargement.

## Acceptance navigateur restante

- [ ] Dans Safari, confirmer qu'une vidéo préchargée garde sa première frame
      visible avant `play()` lorsqu'elle est adoptée par le composant `media`.
- [ ] Vérifier le parcours réel lecture, pause, seek puis reprise après
      l'adoption du nœud préchargé, sans réassignation de `src`, appel à
      `load()` ni lecture native redondante à la matérialisation.
- [ ] Mettre à jour la spécification media-sync uniquement si le parcours
      navigateur confirme un comportement supplémentaire.

### Observation Safari — 2026-10-09

Une nouvelle navigation de Quiz Hunt Sighty a échoué avant le montage initial.
Un appel direct au service `createRuntimePreload()` avec la stratégie native
`video`, l'URL Nostromo et le mode `author` a renvoyé
`RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE`, détail : `Preload timeout after
10000ms`. Sur la même origine, l'URL répond `200` avec `video/mp4` et une
requête Range répond `206`. Une sonde native `<video>` est restée à
`readyState=0`, `networkState=3`, `currentSrc` vide, sans événement `canplay`
ou `error` pendant 12 s. Deux nouvelles navigations ont reproduit l'échec sur
`127.0.0.1` et `localhost`; un onglet antérieur garde un nœud préchargé à
`readyState=4`.

Cette preuve établit une divergence entre le handoff déjà observé sur un
parcours préparé et une nouvelle initialisation Safari ; elle ne révèle pas
encore la cause ni ne certifie un cache froid. Garder l'acceptation navigateur
ouverte et déterminer pourquoi la sélection native de la ressource ne démarre
pas. Ne pas contourner le résultat avec un mode `broadcast`, un preload HTML ou
un changement local à la démo. Toute correction du cœur exige une décision
acceptée dans ce plan et une autorisation explicite de l'utilisateur.

La correction de dérive des médias non master reste une décision distincte à
prendre après cette acceptation : mesurer d'abord les écarts réels et décider
si une correction est requise, avec des garde-fous autour du lancement, de la
pause et du seek. Elle ne s'applique pas au master et n'est pas une règle
certifiée.

## Fermeture

Ce plan reste `En cours` jusqu'à fermeture des preuves de service, validation
Safari du handoff média, revue puis acceptation ou abandon des commandes vidéo
par broadcasts dédiés après `START`, et décision de livrer ou d'abandonner la
façade `run()`.
Les suites liées aux spécifications couvrent seulement leur périmètre certifié ;
elles ne ferment pas les gates listées ici.
