# Eventime model - domaines temporels et scheduler

## But

Formaliser la gestion des events "times" (eventimes) dans un modele event-driven:

- un cue est defini dans un temps local
- le runtime le projette en event discret global
- les stories consomment ensuite ces events comme n'importe quel autre event

## Intention

Decoupler la narration du temps session absolu.

Un meme cue `atMs=1400` doit rester correct quel que soit:

- le moment ou l'utilisateur declenche la lecture
- les pauses/reprises
- les seeks
- la vitesse de lecture

Donc un cue ne depend pas de "l'heure de la scene", mais d'un **domaine temporel** explicite.

## Concepts

1. Domaine temporel

Repere de temps local echantillonnable par le runtime.

Domaines cibles V1:

- `media` (playhead d'une instance media)
- `story` (playhead logique d'une instance story, si expose)
- `session` (temps global de session)

2. Eventime group

Ensemble ordonne de cues relies a un domaine unique.

3. Cue

Point temporel local qui emet un event quand il est franchi.

## Structure logique

Un eventime group contient:

- identite (`id`)
- domaine (`domainRef`)
- liste de cues (`cues[]`)

Un cue contient:

- identite (`id`)
- position locale (`atMs`)
- nom d'event a emettre (`event`)
- data optionnelle (`data`)
- politique de declenchement (`firePolicy`)

Politique V1 recommandee:

- `firePolicy = on-cross-forward`
- `once = true` par passage runtime (avec reset explicite en cas de rewind/rebuild selon policy)

## Regle fondamentale de declenchement

A chaque tick, le scheduler lit la fenetre du domaine:

- `prevDomainMs`
- `nextDomainMs`

Un cue est eligible si:

- `prevDomainMs < cue.atMs <= nextDomainMs` (mode forward)

Cette regle donne un comportement stable meme avec jitter de tick.

## Exemple de projection (cas utilisateur)

Cas:

- click utilisateur a `tSession=5000ms`
- media demarre a ce moment
- cue media a `atMs=1400`

Resultat:

- le cue est emis quand le playhead media franchit 1400ms
- en session cela arrive vers `~6400ms` si rate=1 et sans pause
- la regle reste valide meme si la session n'est pas lineaire

## Comportement par commande runtime

1. `play`

- reprise de progression du domaine
- les cues sont evalues a chaque tick

2. `pause`

- domaine fige
- aucun nouveau cue emis tant que pas de progression

3. `seek`

- deplacement instantane du playhead domaine
- policy V1:
  - `seek forward`: emettre les cues franchis sur la fenetre de saut
  - `seek backward`: ne pas reemettre automatiquement les cues deja tires

4. `rewind`

- reset du domaine vers le debut
- reset de l'etat de tir des cues (rearmement V1)
- mode replay par defaut `refaire`; selection `refaire`/`revoir` pilotee par `RuntimeContext`

5. `rate change`

- pas de changement de regle de franchissement
- seule la correspondance domaine->session varie

6. `loop`

- chaque boucle cree un nouveau passage domaine
- les cues se reemetent a chaque boucle (V1)

## Determinisme et ordonnancement

Quand plusieurs cues sont emis dans le meme tick:

- trier d'abord par `atMs`
- puis par ordre de declaration
- puis par `cue.id`

Les events issus des eventimes rejoignent ensuite le tri global runtime (meme contrat que les autres sources).

## Validation normative (eventimes)

Erreurs bloquantes recommandees:

- domaine inexistant
- type de domaine inconnu
- cue sans `event`
- `atMs` negatif ou non numerique
- IDs dupliques dans un meme group

Warnings recommandes:

- cues hors duree probable du domaine media
- groups sans cues
- event names jamais consommes

## Observabilite minimale

Chaque emission issue d'un cue doit tracer:

- `groupId`, `cueId`, `domainRef`
- `prevDomainMs`, `nextDomainMs`, `cueAtMs`
- `sessionMs`
- `emittedEventName`

Objectif: diagnostiquer facilement les cas "pourquoi ce cue s'est declenche ici".

## Interaction avec Story `listen`

Les eventimes emettent des events globaux.

Ensuite, pour chaque story active:

- la story recoit l'event global
- `listen` peut le convertir (`event -> as`, alias-only)
- les persos/straps locaux reagissent sur l'alias interne

Ainsi, eventime et interaction utilisateur convergent vers le meme pipeline event.

## Diagramme conceptuel

```mermaid
flowchart LR
  DG[Domaine temporel\n(media/story/session)] --> SCH[Scheduler]
  EG[Eventime group + cues] --> SCH
  SCH --> EV[Event global discret]
  EV --> BUS[Bus global]
  BUS --> ST[Story ingress listen]
  ST --> INT[Bus interne story]
  INT --> ACT[Actions persos/straps]
```

## Decisions V1 a figer ensuite

- format final `meta.domainRef` dans l'enveloppe event
- details de mapping `RuntimeContext` -> params/events scene
