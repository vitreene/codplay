# docs/projet/sighty

Réflexions **projet** de **Sighty** — l'orchestrateur qui pilote des suites de scènes autonomes. Horizon
**distinct de la V2 codplay**, au-dessus du moteur : Sighty est un *client* de codplay, non une fonction de
codplay.

**Organisation** : `notes/` accueille discussions, descriptions et recommandations. Les parties **spec**
et **plan** ne sont pas ouvertes.

**Ordre de construction et ordre de définition ne coïncident pas** : codplay V2 se construit *puis* Sighty,
mais les specs codplay doivent préparer son usage — donc Sighty doit être suffisamment défini **avant**
qu'elles ne se figent. Ce dossier a vocation à s'enrichir avant, non après.

**Frontière tenue avec `docs/projet/codplay-v2/`** : ce qui incombe à codplay y reste. Codplay ne connaît
ni le mot *page* ni le mot *groupe* — il reçoit des ensembles d'instances.

## notes/

- [`2026-07-26-meta-orchestrateur-preambule.md`](./notes/2026-07-26-meta-orchestrateur-preambule.md) —
  **le préambule qui ouvre l'horizon**. La suite logique de codplay, un **framework** qui orchestre
  plusieurs scènes autonomes (ex. quiz-hunt appelant space-bubble comme épreuve). Le méta-orchestrateur est
  un *client* de codplay (pilote N players via la façade multi-canaux), pas une fonction du moteur. Trois
  niveaux distingués (widget-dans-scène / segment async / orchestration multi-scènes).
- [`2026-07-28-sighty-premiere-intention.md`](./notes/2026-07-28-sighty-premiere-intention.md) — le
  recueil principal, **explicitement non normatif** : des intentions premières, pas des décisions arrêtées.
  Le **§0 en tête** donne les conclusions provisoires — objectif, principe de fonctionnement, ce que Sighty
  tient seul, ce qu'il n'est pas, frontière avec codplay, ce qui reste ouvert ; la suite consigne la
  discussion qui les a produites.

  En bref : **machine à états**, pas fonction du temps ; lit des **scénarios sérialisables** structurés en
  **graphe de nodes** ; **aucun rendu visuel** — il compose en hébergeant, jamais en dessinant ; **classe
  métier** entourée d'une app qui porte UI, stockage et calendrier ; **mode auteur / mode diffusion** comme
  codplay. Il tient seul la **distribution entre instances**, l'**arrangement**, les **stratégies de
  preload**, la **continuité d'activité**, le **déterminisme du séquencement** et un **état central vivant**
  injecté en lecture seule.

  **Transposable comme codplay** (§0) : la contrainte Flutter y est satisfaite par construction — aucun
  rendu, aucun nœud, seulement de la donnée et des events. Propriété à ne pas perdre, non chantier.

  §6 déroule deux **cas d'usage réels** — affichage dynamique en carrousel de vues zonées, e-learning à
  chapitres avec questionnaires, rattrapage et activités tirées — puis ce qu'ils valident et ce qu'ils font
  apparaître. §7 propose une **esquisse élémentaire** : types, les deux hypothèses traduites en objets,
  esquisse d'API, et la liste de ce qu'elle a dû choisir arbitrairement.

  **Trois étages de vocabulaire** (§7.0) : chaque app définit son **vocabulaire métier** selon ses besoins,
  qu'une **transcription** convertit en objet `Scenario`. Sighty n'apprend jamais ce qu'est une promotion ni
  un chapitre — il ne connaît que nodes, séquences et instances. Même figure que l'éditeur, qui propose des
  *concepts* ensuite transformés en *persos*. Chaque app a donc son propre builder.

  **Symétrie à deux étages** (§1) : codplay a l'éditeur de scène, Sighty aura des **éditeurs d'œuvre** — une
  famille, un par domaine métier et plusieurs possibles par domaine. Ils sont les consommateurs nommés du
  mode auteur et intègrent Sighty en processus ; leur définition doit être anticipée, comme celle de Sighty
  l'est par les specs codplay.
