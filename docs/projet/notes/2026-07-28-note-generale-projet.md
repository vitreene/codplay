# Note générale — ampleur du projet et organisation

Vue d'ensemble à l'usage de qui arrive, ou de qui revient après une pause. Elle dit **ce que le projet
couvre**, **comment il est rangé**, **où en est chaque pièce**, et **ce qui manque encore**.

Elle ne développe rien : le cadre des échelles et de la combinatoire est dans `../README.md`, le détail
dans les notes de chaque app.

## 1. L'ampleur

Le projet n'est pas une bibliothèque d'animation, c'est un **système à trois échelles**, chacune close
sur son vocabulaire, communiquant par transcription :

- **scène** — `codplay` : persos, actions, pistes, `f(t)`. Un moteur qui joue une scène et se laisse
  piloter.
- **orchestration** — `Sighty` : nodes, séquences, instances, arrangement. Pilote des suites de scènes
  autonomes, sans rien dessiner.
- **métier** — les apps et leurs éditeurs : vues, promotions, chapitres, parcours, profils. Chaque domaine
  nomme ses propres choses et les transcrit vers l'échelle du dessous.

À quoi s'ajoutent deux directions d'extension : vers le haut, **des éditeurs par domaine** (plusieurs
possibles pour un même domaine) ; vers l'intérieur, les trois points d'extension de codplay —
**composants**, **tiers**, **Projections**.

Ce que cela rend possible dépasse largement ce que ce dépôt exercera : c'est l'objet même du cloisonnement.

### Les deux figures

Un graphe unique de toutes les parties est illisible ; deux lectures séparées valent mieux.

> **Lecture des figures.** Les **MODULES** (ce qui s'exécute) sont en capitales, les `[artefacts]`
> (ce qui se sérialise) entre crochets. Les boîtes ne portent que leur nom : toute qualification est
> sur les **flèches**, qui disent la relation et son sens. Rien d'anecdotique n'y figure — une
> capacité qui ne tient qu'à une hypothèse appartient à la note de cette hypothèse.

**1. La chaîne d'une scène — production et sorties**

```
   ÉDITEUR DE SCÈNE
        │
        │ transcrit concepts → persos
        ▼
   [SceneDoc] ─────────────── l'intention ──────────────────┐
        │                                                   │
        │ compilé par                                       ▼
        ▼                                                EXPORTS
     BUILDER                                    transcript · paquet · transcription
        │                                                   ▲
        │ produit                                           │
        ▼                                                   │
   [CompiledScene] ─────── l'exécution fidèle ──────────────┘
        │    │
        │    └──── déclare ses besoins ────►  ENGINE  ◄──── s'enregistrent ──── composants
        │ joué par                              │                               tiers
        ▼                                       │ fournit catalogue,            modules
   PLAYER × N  ◄────────────────────────────────┘ horloge, cache
        │
        │ rend par
        ▼
   PROJECTION ──── set · measure · mount ────► DOM · canvas · Flutter
```

L'export part **avant** l'exécution : depuis le `SceneDoc` quand on veut l'intention, depuis le
`CompiledScene` quand on vise une exécution fidèle ailleurs. Et la flèche des besoins va **de la scène vers
l'engine**, jamais l'inverse.

**2. Le pilotage**

```
                 ÉDITEURS D'ŒUVRE
                        │
                        │ transcrivent concepts → scénario
                        ▼
                 [Scénario] ──── revendique ses besoins ────► [Catalogue de scènes]
                        │                                              │
                        │ exécuté par                                  │ fournit les scènes
                        ▼                                              │
   APP ◄─────────────► SIGHTY ◄────────────────────────────────────────┘
    pilote · amende ►    │  ▲
    ◄ observe            │  │ events publics
     monte · commande    │  │
     telco · injection   │  │
     cycle de vie        ▼  │
                       PLAYER × N
```

Les scènes ne se parlent jamais entre elles : tout passe par Sighty. Le `[Scénario]` et le
`[Catalogue de scènes]` sont deux déclarations **détachées** — une scène est une ressource employable par
plusieurs scénarios, et un scénario revendique ses besoins sans contenir le catalogue. Enfin, un player
peut en héberger un autre (une instance jouée dans une autre) : c'est une relation entre instances, pas un
étage de plus dans la chaîne.

## 2. L'organisation

```
docs/
  formalisation/            specs normatives V1 — comportement figé, fait foi
  projet/
    README.md               le routeur : les échelles, la combinatoire, par où entrer
    notes/                  notes transverses aux apps (cette page)
    codplay-v2/
      README.md
      notes/                cahier des charges V2 du moteur
    sighty/
      README.md
      notes/                l'orchestrateur, première intention
  plans/                    plans et défauts datés, historiques
packages/*/plan/            plans et specs colocalisés avec leur package (dont l'éditeur)
```

**Convention** : `notes/` accueille discussions, descriptions et recommandations. Le plan operatoire de
CodPlay V2 est dans `packages/codplay/plan/`; Sighty reste sans plan ouvert.

**Frontière normative** : seul `docs/formalisation/` fait foi. Tout ce qui est dans `docs/projet/` est de
la direction, pas de la norme — à une exception près, qui a force obligatoire : la **matrice des
intentions** (`codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §11), dont un risque de contournement
déclenche une analyse et jamais un contournement silencieux.

## 3. Où en est chaque pièce

| pièce | état |
|---|---|
| **codplay V1** | implémenté, spécifié (25 documents normatifs), démos nombreuses. Non destiné à la production en l'état. |
| **codplay V2** | cahier des charges constitué, noyau ACE et structure de package amorcés. Réécriture franche décidée, sans cohabitation de runtimes ; les tests V1 servent d'oracle. |
| **Sighty** | première intention. Objectif, principe et esquisse posés ; ni spec ni code. |
| **éditeur de scène** | fonctionnel, à l'échelle d'**une** scène. |
| **éditeurs d'œuvre** | n'existent pas. Consommateurs nommés du mode auteur de Sighty. |

**Ordre de travail** : codplay V2 se construit *avant* Sighty, mais l'**ordre de définition est inverse** —
les specs codplay doivent préparer l'usage avec Sighty, donc Sighty doit être défini avant qu'elles ne se
figent. Le même décalage se reproduit d'un étage : la définition de Sighty doit anticiper les éditeurs
d'œuvre.

## 4. Le socle conceptuel tenu

Ce que le projet sait nommer aujourd'hui, et qui n'aura pas à être réinventé :

- **Le flux** — `materialize → resolve → solve → project → render` ; le player calcule un état, les
  composants le projettent.
- **L'état comme fonction de `t`** — seek = évaluation réversible, non rejeu ; interrogation par mode
  (continu, discret, capturé, interaction) ; irréductibles isolés.
- **La Projection** — cible de rendu déclarée, exposant `set`/`measure`/`mount` ; le DOM en est une.
- **L'engine** — catalogue de capacités et ressources partagées ; il fournit les instances, ne lit pas la
  scène ; horloge et stratégie de preload délégables.
- **Le perso hôte** — un perso dont le contenu n'est pas fonction de son `t` : flux direct, instance
  imbriquée, composant tiers.
- **Les events comme contrat primaire**, avec une portée déclarée et des phases d'émission dont seules les
  transitions émettent.
- **La façade multi-canaux** — telco, injection, authoring, cycle de vie, observation, à droits
  différenciés.
- **Le scénario** — graphe de nodes, séquences, arrangement ; catalogue de scènes détaché ; "straps"
  impératifs nommés depuis le déclaratif.
- **La transcription** — chaque échelle traduit vers celle du dessous, et n'apprend jamais son vocabulaire.
- **Les huit invariants** de la matrice, et leur force obligatoire.

## 5. Un canal non traité — l'export

Sujet ouvert et jamais abordé : **exporter les données**, sur une progression allant du plus étroit au plus
large.

- **Encapsuler** pour qu'un module soit lu dans un autre contexte.
- **Compiler un projet** pour un environnement **SCORM**.
- **Transcrire vers un autre système**, avec une autre écriture du format.
- **Produire un transcript des scènes** pour une lecture accessible.

**C'est un canal distinct du player, en sortie du builder — ou mieux, du `SceneDoc`.**

*Pourquoi la source compte.* Le `CompiledScene` est résolu **pour le player** : horaires aplatis,
identifiants résolus, orienté exécution. Le `SceneDoc` garde l'**intention** — ordre narratif, textes,
structure d'auteur. D'où le discriminant : exporter vers un autre système d'écriture ou produire un
transcript se fait depuis le **`SceneDoc`** ; ne partir du `CompiledScene` que pour viser une **exécution
fidèle** ailleurs.

*Ce canal ne demande rien au moteur.* `SceneDoc` et `CompiledScene` étant de la donnée sérialisable, un
export en est un simple consommateur. La seule garantie requise est déjà tenue : que les artefacts restent
**lisibles** — pas d'opacité, pas de code embarqué, les straps nommés et non inclus. Il n'y a pas d'« API
d'export » à ajouter, et **les exports sont une famille**, un par cible, comme les éditeurs — sans que le
moteur en connaisse aucune.

*Il referme la question de l'équivalent accessible* (§6) : l'équivalent qu'une œuvre déclare n'est pas un
livrable écrit à la main, c'est un **export de la même source**.

*Deux natures dans la famille export.* Le **transcript** et la **transcription** vers un autre système
transforment le **contenu** — travail sur la donnée. L'**empaquetage** transforme la **livraison** :
fichiers, descripteur, archive. La seconde n'est pas du code du projet.

*Forme concrète de SCORM* : l'export y crée un **manifeste** et d'autres fichiers, le tout **zippé**, par
un **script shell** lancé une fois les modules obtenus. **Ce chemin doit exister** — hors périmètre pour le
moment, mais sujet réel. **Cible de l'e-learning uniquement** : le signage n'a pas de SCORM.

*Deux modèles de livraison, à ne pas fondre* :
- **Le paquet** — remis à un hôte, froid, versionné, archivé. Cas e-learning / SCORM.
- **Le flux** — entre une **app auteur** et une **app diffuseur**, chaud, incrémental, **temps réel**. Cas
  signage, où le dispositif vit dans une app autonome et reçoit ses mises à jour à distance.

*Le flux ne change pas le modèle, il ajoute un transport.* Côté diffuseur, c'est la situation déjà posée —
une app amont envoie des modifications que Sighty répercute, sous sa responsabilité de **continuité
d'activité**. Le transport distant est celui que
`../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §10 #5 gardait ouvert sans demandeur ; il en a
désormais **deux**, indépendants : le calendrier distribuant à N Sighty, et l'app auteur alimentant l'app
diffuseur.

*Précision qui évite de rouvrir une décision arrêtée* : « app auteur → app diffuseur en temps réel » sonne
comme de l'**authoring à distance**, exclu par ailleurs (l'authoring reste local). Il n'y a pas de
contradiction — l'app auteur ne manipule ni persos ni poses par le canal authoring, elle **envoie de la
donnée** que le diffuseur applique par le chemin ordinaire d'amendement. C'est de l'**injection**, non de
l'authoring.

*Topologie **rhétorique** pour le signage* — dispositif d'illustration, pour donner une forme au « flux ».
**Aucun projet derrière, rien à décrire plus précisément à ce stade** ; ce qui suit sert à penser, non à
prévoir.

```
app bureau (structure générale) ─┐
                                  ├─► serveur ─► app player (× N) ─► Sighty ─► codplay
éditeurs mobiles (édition)       ─┘
```

Le **serveur** est la pièce qui manquait : c'est lui l'« app amont », c'est chez lui que vit le
**calendrier**, et c'est lui qui distribue. Le transport distant est donc **serveur ↔ app player**, non
éditeur ↔ diffuseur. « Player » y est un **nom commercial**, hors du registre du code : aucune collision
avec le `Player` de codplay.

*La famille d'éditeurs varie sur deux axes.* Par **domaine** — et plusieurs par domaine selon l'ambition.
Et par **rôle et contexte d'usage** : ici le bureau crée la structure, le mobile édite le contenu, pour un
même domaine métier. C'est la distinction structure / contenu, projetée sur des appareils différents.

*Question que cette rhétorique fait apparaître*, et qui ne se poserait qu'avec un tel dispositif :
plusieurs éditeurs simultanés — deux mobiles sur la même vue, une édition mobile pendant que le bureau
restructure. L'ordonnancement et la résolution de conflit ne seraient ni de Sighty ni de codplay.

D'où **la seule obligation que le projet porte** : un script ne consomme que ce qui est sur le disque, donc
le build doit **émettre des fichiers**, avec une disposition **stable** et des noms scriptables. Rien de
plus — ni API, ni connaissance de SCORM. C'est la forme la plus externe de l'export, et la moins exigeante.

*Séparation à tenir sur SCORM* : **empaqueter** est un export, hors runtime ; **dialoguer** avec SCORM
pendant la lecture — remonter un achèvement, un score — passe par les **effets à side-effect**, canal déjà
spécifié et déjà classé irréductible. Deux choses, deux lieux ; les confondre ferait entrer du protocole
d'hébergeur dans le moteur.

*Effet sur l'articulation* : la figure allait en ligne jusqu'au rendu ; elle gagne une **sortie latérale
avant le player**. Le système transcrit **vers le bas** pour jouer, et **vers l'extérieur** pour exporter —
l'export étant la transcription sortante, symétrique de celle de l'éditeur qui entre (*concepts → persos*).

## 6. Les manques repérés

Recensés en vérifiant le corpus, non supposés. Classés par coût de découverte tardive.

**Flagrants**

- **Le paquet d'œuvre n'est pas défini.** Le niveau scène a ce qu'il faut (`schemaVersion`, `createdAt`,
  extraction des fonctions pour la diffusion). Le niveau **œuvre** n'a rien : comment un scénario, son
  catalogue de scènes et ses ressources sont assemblés, versionnés, livrés, mis à jour à distance. Le
  signage en dépend (pousser du contenu sur des appareils qui ne se mettent pas à jour ensemble) et
  l'e-learning aussi.
  **Deux formes, deux clients nommés** (§5) : le **paquet** — l'empaquetage SCORM de l'e-learning,
  manifeste et archive, qui réduit l'obligation du projet à une **disposition de sortie stable** — et le
  **flux**, l'envoi distant d'une app auteur vers une app diffuseur en signage. Leurs exigences valent
  mieux qu'une spécification abstraite : ce sont les consommateurs qui disent ce que « paquet d'œuvre »
  doit signifier, et ils ne demandent pas la même chose.
- **La compatibilité entre versions n'est pas traitée.** Corollaire du précédent : une scène compilée par
  une version, jouée par une autre. Un champ `schemaVersion` existe ; aucune politique ne dit ce qu'on en
  fait.
- **L'échec à l'exécution en diffusion n'a pas de politique au niveau œuvre.** Le moteur de warning est
  réservé au mode auteur, et la diffusion « ne re-diagnostique pas ». Mais une ressource qui ne charge pas,
  une librairie tierce qui échoue, un dispositif qui refuse — un écran de signage tenu de tourner en
  continu a besoin d'une conduite dégradée. C'est le pendant manquant de la **continuité d'activité**, que
  l'on a posée comme responsabilité de Sighty sans dire ce qu'elle fait quand quelque chose casse. La
  classe d'échec « indisponibilité à l'exécution » est déjà notée comme ouverte côté émetteurs.
- **Les données personnelles ne sont mentionnées nulle part.** Zéro occurrence dans le corpus, alors que
  l'e-learning enregistre des réponses et que les émetteurs traitent gestes filmés et capteurs. Une
  propriété favorable existe pourtant déjà par construction — la **réduction vers l'intention** fait qu'un
  geste ne sort pas de l'appareil, seul le sens en sort. Elle n'est simplement jamais énoncée comme une
  garantie.

**Résolus par l'échelle — pas des manques du moteur**

Deux sujets que l'on croit manquants tant qu'on les cherche dans le corpus du moteur, alors qu'ils se
résolvent un étage plus haut. C'est le critère du routeur (« à quelle échelle se résout-elle ? ») appliqué :
leur absence dans les specs de codplay n'est pas un trou, c'est un bon rangement.

- **L'accessibilité** se règle **par les éditeurs**, plus une **révision des composants** pour en faciliter
  l'intégration. Le moyen existe déjà : `attr` est un canal de mutation de premier rang à côté de `style`
  et `className`, donc `role`, `aria-*`, `lang` sont expressibles aujourd'hui sur n'importe quel composant.
  Ce n'est pas une capacité à ajouter mais une intégration à rendre naturelle.

  *Périmètre de la révision* : tout n'est pas attribut. L'**ordre de focus** dépend de l'ordre du DOM que
  le moteur génère, la **navigation au clavier** du routage d'events, et l'**annonce** d'un changement du
  moment où l'animation le rend effectif. Ces trois-là relèvent de la construction du composant.

  *Mais le sujet est équivoque, et sur trois plans* :

  - **C'est une capacité de Projection, pas une propriété du moteur.** Même famille que l'injection CSS
    (§10 #2) : déclarée, propre au substrat, neutralisable. `DomProjection` l'a ; une `FlutterProjection`
    en a une autre (arbre sémantique propre) ; une **Projection canvas n'en a aucune**, l'accessibilité
    reposant sur la notion de **document** qu'un canvas n'offre pas. Le moteur ne peut donc rien garantir —
    couverture partielle assumée, dégradation propre, comme `measure` optionnel.
  - **La question ne se pose pas partout.** Elle concerne une **interface** — ce qu'une personne opère ou
    lit pour accomplir quelque chose. Le **signage** est un **spectacle** : diffusion visuelle publique,
    sans utilisateur à qui rendre une tâche possible ; il n'engage pas la question. L'e-learning, lui, est
    une interface et ne s'en exempte pas.
  - **« Ne pas le faire » est parfois la seule réponse juste.** Une animation qui porte de l'information
    est, pour certains, un obstacle et non un support ; la corriger en « animation accessible » est souvent
    une impasse. La réponse est un **autre canal** — texte, piste audio, route séparée — éventuellement
    hors de codplay. Ce n'est pas un renoncement mais une **substitution**, et c'est ce que les obligations
    légales acceptent : l'accès équivalent plutôt que l'accès identique.

  D'où la règle d'écriture, cohérente avec le reste du corpus : **l'œuvre déclare qu'un équivalent
  existe**, plutôt que le moteur ne prétende rendre l'animation accessible.
- **L'internationalisation** se sépare en deux pièces déjà situées : le **trajet** varie par langue —
  durées, placement des mots — et c'est le multi-scénario ; le **contenu** relève d'une notion de *texte*
  élargie, chantier ouvert par l'auteur. Restent hors de ces deux pièces la direction d'écriture et les
  formats de date et de nombre.

**Secondaires** — notés sans être instruits : le **budget de performance** (le player est déclaré chemin
chaud, rien ne dit à quoi l'on mesure que c'est assez rapide), le **test au niveau œuvre**, et les formats
d'écriture (direction, dates, nombres) hors du multi-scénario.

## 7. Les pièces à venir, et la contrainte que chacune ajoute

Distinct du §6 : les **manques** sont des sujets non traités ; les **pièces** ci-dessous sont nommées,
comprises, et n'existent simplement pas encore. Aucune n'est un chantier ouvert. Elles arriveront, et
**devront jouer ensemble** — d'où la colonne qui importe le plus, celle de la contrainte ajoutée à
l'existant.

| Pièce | Ce que c'est | Contrainte qu'elle ajoute |
|---|---|---|
| **L'engine** | L'étage qui déclare les capacités et détient les ressources partagées d'un dépôt d'instances. | Codplay doit cesser de tenir de l'état en portée de module ; les instances deviennent adressables ; l'ordre de tick doit être garanti. |
| **La factory de `CompiledScene`** | La compilation empaquetée à part du runtime. | Le builder doit être utilisable sans le player, et la frontière de bundle doit être décidable. |
| **Le catalogue de scènes** | Déclaration détachée, partagée par N scénarios. | L'identité d'une scène doit être **stable et déclarée** — un identifiant qui survit d'un scénario à l'autre. |
| **Sighty** | L'orchestrateur : machine à états, pilote des suites de scènes. | Cycle de vie propre, events bidirectionnels, surface publique de scène, mode hôte, seek atomique sur un ensemble (liste au §5 de sa note). |
| **Les éditeurs d'œuvre** | Famille d'outils d'auteur à l'échelle de l'œuvre, par domaine et par rôle. | Sighty doit avoir un **mode auteur** : validation au chargement, moteur de warning, sémantique d'undo/redo ; et le scénario doit être **inspectable sans exécution**. |
| **Les builders d'app** | La transcription d'un vocabulaire métier vers le `Scenario`. | Le vocabulaire du modèle doit être **assez complet pour servir de cible** : ce qu'une app ne peut pas exprimer devient une fuite vers le haut ou un trou. |
| **Le distributeur** | Ce qui alimente N diffuseurs — serveur, calendrier, app amont. | Le protocole doit **franchir un réseau** : rien de non sérialisable, et un ordonnancement déclaré. |
| **L'app diffuseur autonome** | Le dispositif qui joue, sans éditeur. | L'œuvre doit être **livrable en donnée + ressources**, et une **conduite dégradée** doit exister en cas d'échec. |
| **Le paquet d'œuvre** | L'artefact assemblant scénario, catalogue et ressources. | Disposition de sortie **stable sur disque**, politique de **versionnement**, et compatibilité entre la version qui compile et celle qui joue. |
| **Les exports** | Famille : transcript, empaquetage, transcription vers un autre système. | Les artefacts doivent rester **lisibles** — pas d'opacité, pas de code embarqué — et le `SceneDoc` doit préserver l'**intention**, pas seulement l'exécution. |
| **Le moteur de warning** | Le canal qui explique à l'auteur, distinct de la sanitisation. | Le builder doit produire une sortie **diagnosticable** ; le canal est présent en mode auteur et absent en diffusion. |
| **La Projection** | Le substrat déclaré, exposant `set`/`measure`/`mount`. | Toute capacité propre à un substrat doit être exprimable comme **optionnelle et neutralisable** — y compris l'accessibilité, nulle sur canvas. |
| **La révision des composants** | Ce qui rend l'intégration d'accessibilité naturelle. | Ordre de focus, routage clavier et **moment de l'annonce** deviennent des responsabilités de composant. |
| **Le texte élargi** | La notion de texte couvrant le multilingue, ouverte par l'auteur. | Le **contenu** doit être séparable du **trajet** — ce dernier relevant déjà du multi-scénario. |

**Où les contraintes s'accumulent.** Deux pièces existantes en reçoivent le plus : le **cœur de codplay**
et le **format d'artefact**. C'est là que se joue la compatibilité de l'ensemble — non dans chaque pièce
prise isolément.

### 7.A Le cœur de codplay — trois coutures, aucun mécanisme neuf

Cinq sources le contraignent (engine, Sighty, éditeurs, Projection, révision des composants), mais elles
ne se dispersent pas : elles convergent sur trois endroits.

**Adressage et portée.** Quatre demandes de même nature — identité d'instance, visibilité des events,
portée d'une commande, ciblage qui ne fuit pas dans la scène. Le cœur n'a aujourd'hui qu'un booléen pour
ça.
*Solution* : un **champ** et un **déménagement**. Un event porte une **visibilité**
(`story | scene | public`), fixée à l'émission, jamais réécrite ; il ne porte **aucune destination**, le
ciblage appartenant au côté qui écoute — c'est déjà le modèle de `listen`. L'identité d'instance ne demande
rien : il suffit que l'état aujourd'hui en **portée de module** redescende dans l'objet de contexte qui
circule déjà par instance (racine de mesure, singleton du glisser-déposer, propriété du cache de preload,
horloge). La question « de quelle instance suis-je » se dissout, plus rien n'ayant à la poser. Et la portée
d'une commande sur un ensemble est un **paramètre d'appel**, non un schéma d'adressage : l'engine reçoit
une liste et des cibles.

**Le point de présentation.** Quatre demandes convergent : seek atomique (reconstruire N *puis* présenter
une fois), ordre de tick hôte-avant-hébergé, savoir quand un changement est visuellement effectif
(annonce d'accessibilité), correction de dérive du média contre la timeline. Le cœur a aujourd'hui trois
entrées vers le substrat — `RenderSync`, `run()`, et la capture qui les contourne.
*Solution* : **une frame en deux phases**. (1) **Évaluation** — chaque instance calcule son état à `t`,
aucune écriture vers le substrat, dans l'ordre de l'engine. (2) **Présentation** — écriture, en une passe,
après toutes les évaluations. Les quatre demandes en tombent d'elles-mêmes. **Ce n'est pas un mécanisme
neuf : c'est `solve`/`project` remonté d'un cran**, du composant à l'engine — la V2 le décide déjà pour le
composant. Le contournement de la capture cesse d'être un cas particulier pour devenir une violation à
supprimer.
*Exception à nommer, sinon la règle est fausse* : `measure` est irréductible. Formulation juste —
**l'évaluation peut lire, seule la présentation écrit**. Un seul écrivain, plusieurs lecteurs.

**La frontière du substrat.** Projection, `measure`, injection CSS, preload, accessibilité nulle sur
canvas : toutes disent « le substrat déclare ce qu'il sait faire ». La moins risquée, la réponse étant
décidée.
*Solution* : composer deux décisions existantes. Une capacité est **déclarée et neutralisable** ; une scène
**déclare ses besoins**. Une Projection qui ne l'a pas rend un no-op, une scène qui la réclame échoue
**avant lecture** — la dégradation silencieuse disparaît sans rien ajouter.

**L'argument, en une phrase** : ces trois coutures ne sont pas des chantiers, ce sont trois endroits où
des décisions **déjà prises** doivent être appliquées **ensemble**. Le risque n'est pas de ne pas savoir
quoi faire, c'est de les appliquer séparément et de découvrir tard qu'elles se contredisaient.

### 7.B Le format d'artefact — cinq exigences et une décision cachée

On lui demande d'être **stable** (identité de scène survivant d'un scénario à l'autre, politique de
version), **lisible** (sans opacité ni code embarqué, pour les exports), **partitionnable** (le flux
pousse une scène modifiée, pas l'œuvre entière : la granularité du paquet doit épouser celle du
changement), **porteur de variantes** (langues, profils, sans duplication) et **auto-descriptif** (il
déclare ses besoins, vérifiables avant lecture).

**La décision cachée** : l'**intention** et l'**exécution** ne sont pas dans le même artefact. L'export
veut le `SceneDoc` — ordre narratif, textes, structure d'auteur ; le player veut le `CompiledScene` —
horaires aplatis, identifiants résolus. Le paquet d'œuvre doit donc trancher : soit il **transporte les
deux**, et la charge de diffusion grossit ; soit il ne transporte que le compilé, et **tout export
réclamant l'intention doit se faire en amont**, au moment de l'authoring, jamais chez le diffuseur.

C'est la question déjà ouverte de la **frontière de bundle de la factory**, vue de l'autre côté : « qui
embarque le builder » et « qui peut encore exporter » sont **la même décision**, et il n'y en a qu'une à
prendre.

## Statut

Note de présentation, non normative. Les manques du §6 sont des constats de couverture et les pièces du §7
des inventaires : aucun n'a été arbitré, aucun chantier n'est ouvert.
