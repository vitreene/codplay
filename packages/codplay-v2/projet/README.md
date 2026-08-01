# docs/projet

Status: En cours
CodPlay version: V2 foundation

Réflexions **projet** — les axes de travail (« où on veut aller, et pourquoi ») qui **précèdent** le
découpage en plans. Ce ne sont pas des specs ; ce sont les axes qui les justifient.

**Séparation par app** :

- [`codplay-v2/`](./codplay-v2/) — le moteur. La plupart de ces documents forment le **cahier des charges
  codplay V2** (réécriture conceptuelle, cœur inclus).
- [`sighty/`](./sighty/) — l'**orchestrateur** qui pilote des suites de scènes autonomes. Horizon distinct,
  **au-dessus** de codplay : un client du moteur, non une de ses fonctions.

- [`notes/`](./notes/) — notes **transverses** aux deux apps. Dont
  [`2026-07-28-note-generale-projet.md`](./notes/2026-07-28-note-generale-projet.md) : **l'ampleur du
  projet, son organisation, l'état de chaque pièce, le socle conceptuel tenu, le canal d'**export**, un
  inventaire des **pièces à venir avec la contrainte que chacune ajoute** à l'existant — dont l'analyse des
  deux endroits où ces contraintes s'accumulent : le **cœur de codplay** (trois coutures — adressage,
  point de présentation, frontière du substrat — dont aucune ne demande de mécanisme neuf) et le **format
  d'artefact** (cinq exigences, et une décision cachée : intention ou exécution dans le paquet, qui est la
  même question que la frontière de bundle du builder). Puis les **manques repérés** —
  paquet d'œuvre et compatibilité de versions non définis, conduite dégradée en diffusion sans politique,
  données personnelles jamais mentionnées ; accessibilité et i18n en revanche **résolues par l'échelle**
  (éditeurs et révision des composants), non par le moteur — l'accessibilité étant en outre une **capacité
  de Projection** (nulle sur canvas, qui n'a pas de document), sans objet pour un spectacle public comme le
  signage, et parfois mieux servie par un **canal équivalent** que par une animation rendue accessible.

**Organisation interne** : chaque app a un dossier `notes/` pour les discussions, descriptions et
recommandations. Le plan operatoire de CodPlay V2 est dans `packages/codplay-v2/plan/`.

**Distinction avec les autres dossiers** :
- `docs/formalisation/` — specs normatives v1 (comportement figé, fait foi).
- `packages/*/plan/` — plans et specs **colocalisés** avec leur package.
- `docs/projet/` (ce dossier) — la direction, avant qu'elle se décline en chantiers.

## Le système d'ensemble — des échelles cloisonnées, combinables

Les deux dossiers ci-dessus ne sont pas deux projets voisins : ce sont deux **échelles** d'un même
système, sous lesquelles se rangent les outils d'auteur.

| échelle | ce qu'elle connaît | outil d'auteur |
|---|---|---|
| **métier** | vues, promotions, chapitres, parcours, profils | des **éditeurs**, variant sur deux axes : par **domaine** (et plusieurs par domaine selon l'ambition) et par **rôle / contexte d'usage** (structure au bureau, contenu au mobile) |
| **orchestration** (Sighty) | nodes, séquences, instances, arrangement | l'éditeur transcrit vers le `Scenario` |
| **scène** (codplay) | persos, actions, pistes | l'éditeur de scène transcrit ses *concepts* en *persos* |

**Chaque échelle est close.** Un éditeur connaît son métier ; Sighty n'apprend jamais ce qu'est une
promotion ni un chapitre ; codplay ne connaît que des persos. Les aspects métier sont **résolus avant**
d'être passés à l'échelle inférieure, par transcription.

**C'est ce cloisonnement qui rend le système combinatoire.** Parce qu'aucune échelle ne fuit dans la
suivante, on peut en ajouter au-dessus sans toucher à ce qui est dessous : N éditeurs sur un Sighty sur un
codplay, dont l'**agencement** produit des solutions que personne n'a conçues comme telles.

**Les invariants ne sont donc pas de l'hygiène, ils en sont la condition.** « Le sens vit un étage
au-dessus », « un canal par responsabilité », « le défaut autonome qui s'efface » — leur liste et leur
force obligatoire sont au §11 de `codplay-v2/notes/2026-07-26-conduite-chantier-v2.md`. Qu'un seul cède,
qu'un éditeur commence à savoir ce qu'est un perso, et la multiplication s'arrête : chaque nouvel éditeur
devient une modification du moteur.

**Critère pratique qui en découle.** Devant une demande nouvelle, la question n'est pas « comment
l'implémenter » mais **« à quelle échelle se résout-elle »**. La réponse est le plus souvent un éditeur de
plus, ou un agencement différent des mêmes pièces — rarement une capacité de plus dans le moteur.

**La combinatoire joue dans trois directions.** Vers le haut, les échelles et leurs **éditeurs**. Vers
l'intérieur, les trois points d'extension de codplay : ses **composants**, ses **tiers**, ses
**Projections**. Vers l'extérieur, les **exports** — transcript accessible, paquet SCORM, transcription
vers un autre système — qui consomment la donnée sans passer par l'exécution, et forment eux aussi une
famille dont le moteur ne connaît aucun membre. Beaucoup de choses sont ainsi rendues possibles que ce
dépôt n'exercera jamais.

D'où une nuance à ne pas manquer : `codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §10 #4 décide de
**ne pas reconduire une surface non exercée** — mais cela vise les *hooks* sans consommateur, poids mort.
Un **point d'extension** est aussi non exercé, et pourtant c'est un **contrat** : sa justesse ne peut pas
venir de l'usage, puisque l'usage est ailleurs ; elle vient de sa forme. La règle §10 #4 ne s'y applique
pas.

**Par où entrer** : [`codplay-v2/notes/2026-07-28-carte-projet-v2.md`](./codplay-v2/notes/2026-07-28-carte-projet-v2.md)
donne l'articulation du moteur et le classement conservé / revu / à statuer ; il rappelle qu'il s'agit
d'une **mise à jour**, ce que le volume du corpus fait facilement oublier.
