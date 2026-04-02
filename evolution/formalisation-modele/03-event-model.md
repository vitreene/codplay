# Event model - langage commun du runtime

## But

Definir un modele d'event unique pour tout le systeme:

- entrees utilisateur
- emissions story/strap
- cues temporels (eventimes)
- signaux techniques player/runtime

L'objectif est d'avoir un flux d'events unique, deterministe et traçable.

## Intention

Le moteur doit rester event-driven de bout en bout.

- la scene ne "avance" pas par magie
- tout changement observable est cause par un event
- les events sont transportes dans une enveloppe commune

Ce modele sert de contrat entre builder, player et scenario.

## Typologie des events

1. Events metier (contenu)

- noms libres choisis par l'auteur
- ex: `form.submit.request`, `quiz.answer.correct`, `story:intro:end`

2. Events utilisateur

- produits par l'interface hote
- ex: `pointer:click`, `keyboard:enter`, `form:change`

3. Events temporels (eventimes)

- produits par le scheduler depuis un domaine de temps
- ex: `media:intro:beat`, `chapter:marker:2`

4. Events techniques runtime/player

- produits par le player, le media engine, la plateforme
- ex: `player:play`, `media:ended`, `runtime:error`

5. Events d'orchestration externe

- utilises entre une scene et son orchestrateur parent
- ex: `scene:start`, `scene:param:set`, `scene:end`, `scene:request-next`

## Enveloppe canonique

Chaque event transporte la meme forme logique.

- `name`: nom d'event (obligatoire)
- `data`: charge utile metier/technique (optionnel)
- `meta`: informations d'observabilite et d'ordonnancement (optionnel)

`meta` doit couvrir au minimum:

- `source`: `user | story | strap | eventime | player | system`
- `source`: `user | story | strap | eventime | player | scene | system`
- `sessionMs`: horloge session au moment de l'emission
- `traceId` ou `correlationId` (si disponible)
- `storyId` / `instanceId` quand applicable
- `domainRef` pour les events issus d'eventimes

## Namespaces et hygiene

Deux familles coexistent:

- plan metier: libre
- plan technique: prefixes reserves

Prefixes reserves runtime:

- `player:*`
- `runtime:*`
- `system:*`
- `media:*` (technique player/media)

Regle de base:

- le contenu metier ne doit pas reutiliser involontairement ces prefixes
- si un event technique est adapte vers le metier, cela passe par `listen` story

## Semantique de diffusion

1. Bus global

- tout event externe est diffuse aux stories actives
- la diffusion garde un ordre deterministe

2. Story ingress

- `listen` convertit `event -> as` en alias-only
- seul l'alias entre dans le bus interne story

3. Dispatch interne

- persos/straps reagissent par matching exact du nom
- pas de wildcard implicite

## Regles d'ordonnancement

Le runtime applique un ordre stable quand plusieurs events tombent "au meme moment".

Principes:

- tri temporel principal (`ms` croissant)
- tie-breakers stables (ordre de piste, index, source)
- politique explicite pour user vs story/system a egalite

Ce contrat doit rester identique entre mode player et mode debug.

## Regles de transformation

1. `listen` (story)

- transforme uniquement le nom (`event` vers `as`)
- ne filtre pas par payload
- ne modifie pas le payload

2. Effets strap

- peuvent emettre de nouveaux events globaux
- doivent renseigner `meta.source='strap'`

3. Scheduler eventime

- emet des events discrets quand un cue est franchi
- renseigne le domaine temporel dans `meta.domainRef`

## Validation normative (niveau event)

Erreurs bloquantes recommandee au chargement/compilation:

- nom d'event vide
- nom d'event invalide (format non conforme)
- collision avec prefixe reserve cote contenu
- regle `listen` incomplete (`event` ou `as` manquant)

Warnings recommandés:

- alias redondant (`event === as`)
- evenements definis mais jamais consommes
- actions referencees sur des noms jamais emis

## Observabilite

Le runtime doit pouvoir tracer chaque etape:

1. event recu (global)
2. event alias produit par `listen`
3. listeners internes resolves
4. actions appliquees
5. event(s) sortant(s) emis

Objectif: comprendre sans ambiguite "quel event a cause quoi".

## Diagramme de flux event

```mermaid
flowchart LR
  EXT[Event global entrant] --> S[Story ingress]
  S --> L[listen alias-only]
  L --> I[Event interne alias]
  I --> D[Dispatch exact actions]
  D --> A[Actions persos/straps]
  A --> O[Event(s) sortant(s)]
  O --> BUS[Bus global]
```

## Lien avec les prochains documents

- `04-eventime-model.md`: definition des domaines temporels et de la projection en events
- `05-graph-model.md`: modelisation explicite des liens signal/temps/contenu
- `06-runtime-contract.md`: frontiere builder vs player et responsabilites d'execution
