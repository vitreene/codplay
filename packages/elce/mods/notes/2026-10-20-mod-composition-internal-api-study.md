# Elcé — construction progressive des fonctionnalités et composition des mods

Date : 20 octobre 2026.

Le sujet présent est un mode de construction permettant d’ajouter et de
développer des fonctionnalités en préservant le fonctionnement existant.
L’idéal d’un mod réduit à une composition de modules fournit un cap lointain
pour éviter des couplages précoces. Cette étude complète la
[reconfiguration du noyau et du mod Learning](2026-10-20-elce-reconfiguration-study.md).
Les possibilités ci-dessous restent des propositions. Les conclusions et
décisions sont réunies dans le
[plan des mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md).

Chaque mod possède aussi son assemblage : choix des ressources, instanciation
des classes et raccords auteur/lecture/serveur restent dans son dossier. Les
points de lancement applicatifs utilisent ses entrées publiques.
Aucune API nouvelle n’est définie comme un contrat acquis.

## Un cap de composition pour guider les choix actuels

À terme, un mod pourrait se limiter à la sélection de modules, de paramètres
et de raccords déjà éprouvés. Aujourd’hui, l’intérêt de ce cap est de donner
aux fonctionnalités une responsabilité identifiable et des dépendances
explicites. La forme finale d’une déclaration de mod reste ouverte.

Un comportement nouveau peut être développé dans un module propre à son
usage, y compris lorsqu’il coordonne d’autres modules. Les interfaces utiles
se dégagent des raccords réels. Leur généralisation demande ensuite des
usages qui la justifient.

Le cap concerne la composition du logiciel. Le contenu d’un projet — notamment
son calendrier DGS — reste une donnée éditoriale distincte de la définition
du mod. L’interface de création reste ouverte.

Pour tous les mods, les données auteur enregistrées en BDD et les productions
de lecture sont distinctes. Les builders et contributions Elcé transforment le
document en scénario Sighty, scènes CodPlay, actions et guards. Les modules
apportent leurs données et leurs contributions à cette génération ; leurs
classes métier sont appelées par les actions et guards lorsque la lecture
l’exige. La [déclinaison sequence/scheduler](2026-10-20-sequence-scheduler-study.md#document-auteur-et-production-du-scénario)
suit cette même chaîne.

## Classes métier et responsabilités des appelants

L’utilisateur précise la règle de construction : le métier est toujours
implémenté dans des classes TypeScript. Les machines, les façades et les
autres appelants sollicitent ces classes selon leur rôle. Les machines
coordonnent les événements et les transitions ; leurs actions et gardes
délèguent les calculs et décisions métier aux classes concernées.

L’interface présente les valeurs et traduit les gestes en intentions par
les façades prévues. Elle ne contient pas d’implémentation métier. Le partage
d’une fonctionnalité passe donc aussi par le réemploi de ses classes, avec
les raccords d’édition ou de lecture adaptés à l’appelant.

L’exemple DGS donné par l’utilisateur illustre cette répartition : le scheduler
fera appel à une ou plusieurs classes, ensuite employées par l’affichage.
Les classes portent les règles de programmation et de diffusion concernées ;
le scheduler coordonne leur emploi dans le temps et l’affichage présente les
contenus et les valeurs qu’elles permettent de déterminer. Ces règles gardent
la même implémentation lorsqu’elles servent aux deux usages.

## Appuis actuels et raccords manquants

| Appui vérifié | Ce qu’il permet d’envisager | Limite actuelle |
| --- | --- | --- |
| [Façades applicatives et commandes pures](../../specs/document-model-spec.md) | Donner à un module une surface d’intentions tout en gardant le domaine et l’interface séparés. | L’assemblage actuel connaît directement les types et les fonctions du mod Learning ; la composition de modules par mod n’est pas implémentée. |
| [Un acteur XState et un historique documentaire](../../specs/document-history-spec.md) | Raccorder plusieurs fonctionnalités à la même file de validation et de commit. | Des modules autonomes ne doivent pas devenir plusieurs propriétaires du même document. |
| [Machine d’Évaluation](../../specs/evaluation-machine-spec.md) | Encapsuler les transitions métier d’un module avec un état sérialisable conservé par son hôte. | Son existence ne prouve pas une interface commune à toutes les machines ni une intégration complète des actions Résultat. |
| [Composition Remix](../../specs/remix-spa-spec.md) | Réutiliser les surfaces auteur et les façades raccordées au même acteur. | La composition des contributions d’interface selon le mod reste à construire. |
| [API Sighty](../../../sighty/specs/authoring-library-spec.md) | Projeter la logique métier par les actions et gardes du scénario et utiliser l’admission existante pour la navigation. | Les échanges entre modules Elcé et la persistance de leurs états ne sont pas fournis par un contrat universel Sighty. |

Les inspections ciblées montrent déjà une injection simple de dépendances :
[ElceCardFacadeOptions](../../src/app/facades/card/card-facade-types.ts) reçoit
les fonctions de commande et d’import ;
[EditorActionsFacade](../../src/app/facades/editor-actions-facade.ts) les raccorde
à l’acteur. Cette approche peut guider l’extraction. La façade globale importe
encore directement les fonctionnalités disponibles et leurs intentions propres.

Les types de commandes et leur
[application](../../src/domain/commands/document-commands/apply-document-command.ts)
sont également assemblés statiquement. Il reste à décider comment composer
leurs contributions sans contourner cette voie de modification. Plusieurs
intentions de façade retournent actuellement `void` : envoyer une demande ne
fournit donc pas, à lui seul, un contrat de confirmation de son succès.

## Mode de construction à privilégier

Les raccords peuvent être écrits directement en TypeScript, avec des interfaces
limitées aux besoins concrets des fonctionnalités. Façades et machines à états
restent les moyens de structurer ces échanges et leurs transitions.

| Choix de construction proposé | Ce qu’il permet de préserver |
| --- | --- |
| Isoler une fonctionnalité et ses dépendances. | Comprendre la portée d’un ajout et les usages concernés par sa modification. |
| Séparer les mécanismes communs des politiques du mod Learning. | Réemployer les BDC et services sans imposer Sommaire, navigation ou Évaluation à DGS. |
| Passer par les façades et les circuits propriétaires existants. | Garder un document, un ordre de commit et un historique cohérents. |
| Définir chaque interface à partir d’un échange réel. | Faire évoluer l’implémentation interne en contrôlant ses effets sur ses consommateurs connus. |
| Vérifier les usages existants concernés avec chaque évolution commune. | Détecter les régressions du mod Learning et des compositions effectivement prises en charge. |

Un langage de règles d’interaction entièrement déclaratives est hors de
portée de cette étude. L’utilisateur situe une éventuelle réflexion sur ce
sujet après un recul sur de nombreux mods fonctionnels, de l’ordre d’une
dizaine. Ce repère exprime le besoin d’expérience préalable ; il ne constitue
pas un programme de réalisation de ces mods.

## Ce que signifierait une API interne de module

Il s’agirait d’interfaces de programmation au sein de l’application. Un module
consomme les interfaces dont il a besoin ; la composition lui fournit leurs
implémentations. Un accès à l’état privé de son voisin ou à son acteur complet
créerait une dépendance plus large que le service attendu.

Les éléments suivants servent à comprendre un échange concret et son
propriétaire. Ils seront précisés au rythme des fonctionnalités retenues ;
ils ne définissent pas une API universelle préalable à tout développement.

| Surface | Rôle à préciser pour le module concerné |
| --- | --- |
| Données et validation | Définir ses données documentaires et leurs références, ainsi que leur lecture et leur persistance. |
| Façade d’intentions | Exposer les opérations métier permises et les transmettre au propriétaire d’exécution concerné. |
| Lecture d’état | Fournir des valeurs ou projections lisibles, avec un propriétaire d’état identifié. |
| Résultats et notifications | Distinguer une demande, son acceptation, son résultat et un fait déjà produit ; préciser les erreurs et les garanties d’ordre utiles. |
| Classes métier | Implémenter les règles, calculs et décisions du domaine réemployés par les appelants concernés. |
| Machine d’orchestration | Organiser les événements, transitions et effets ; appeler les classes métier depuis ses actions et gardes. |
| Contributions auteur et lecture | Fournir les outils d’édition, builders, actions ou gardes nécessaires à son usage. |
| Dépendances et cycle de vie | Déclarer les interfaces attendues et les ressources possédées ; organiser initialisation, arrêt, désabonnement et annulation selon son rôle. |

Les façades constituent une frontière utilisable par l’interface et les autres
modules. Les classes TypeScript implémentent le métier ; les machines
coordonnent les transitions et appellent ces classes. La composition raccorde
ces surfaces. Les classes concrètes, les noms de méthodes et la forme des
résultats restent à décider au plan.

## Propriétaires d’état et opérations communes

À l’édition, le contrôleur actuel reste propriétaire du document et de
l’historique. Les modules peuvent fournir leurs transformations pures et
leurs validations ; l’application conserve l’ordre et le commit communs.
L’état visuel local d’un panneau garde sa portée d’interface.

Une opération qui touche plusieurs modules doit préserver leurs invariants
ensemble. Par exemple, supprimer une page utilisée par une séquence DGS
demande une décision sur ces références avant le commit. Le choix de refuser,
de modifier ou de supprimer les références reste une décision métier ouverte.
Une chaîne de notifications après plusieurs commits ne prouve pas l’intégrité
de ce geste ni son annulation cohérente.

En lecture, les états métier ont eux aussi un propriétaire explicite. La
classe `EvaluationMachine` actuelle expose des transitions pures : elle reçoit
un état et un événement et retourne l’état suivant, conservé par son hôte.
Le choix du propriétaire d’état reste distinct de l’implémentation du métier
dans les classes. Un traitement asynchrone durable peut justifier
un acteur avec un cycle de vie propre ; la présence d’un module ne suffit pas
à justifier un acteur supplémentaire.

La logique de lecture continue de passer par Sighty : actions et gardes du
scénario, événements admis par `runtime.dispatch` et sorties publiques existantes.
CodPlay conserve ses scènes et leur exécution. Le pilotage demandé pour la
restauration et l’enregistrement suit l’[étude dédiée](2026-10-16-reading-state-ownership-study.md) ;
il reste à appliquer et ne devient pas une API universelle acquise.

Les liaisons entre modules peuvent être réalisées par des appels typés ou par
le raccord explicite d’une sortie à une entrée. Le transport d’une notification
ne décide pas d’une transaction, d’une navigation ni de la priorité entre
deux réactions. Ces responsabilités restent dans leurs circuits propriétaires.

## Exemple de composition pour Learning et DGS

Les noms suivants décrivent des rôles possibles, sans créer de nouveaux
modules ni d’API.

| Contribution | Learning | DGS |
| --- | --- | --- |
| Matière éditoriale | BDC et formats de page compatibles. | Réemploi des mêmes BDC et formats compatibles avec la diffusion autonome. |
| Organisation | Parcours ordonné, Sommaire et réglages du mod Learning. | Inventaire de pages/chapitres, séquences et calendrier. |
| Conduite de lecture | Navigation, progression et Évaluation selon le projet. | Programmation des émissions, répétitions, durées et interludes. |
| Exécution | Scénario Sighty et scènes CodPlay issus de ces contributions. | Même infrastructure de scénario et de scènes, avec les règles DGS. |

Pour DGS, la génération traduit les règles locales des séquences dans le
scénario, ses scènes, actions et guards. Le raccord calendaire demande les
diffusions prévues ; le parcours reste conduit par Sighty. Les classes métier
concernées seraient aussi employées par l’affichage.
Les ressources de contenu fourniraient leurs constructions de vues. Le raccord
à Sighty utiliserait son admission réelle. Les règles de programmation et les
durées resteraient dans les modules concernés, avec leurs horloges distinctes.
La forme exacte et l’acceptation de ce raccord restent ouvertes.

À terme, la définition du mod pourrait se limiter à choisir et paramétrer ces
modules, puis à sélectionner les raccords nécessaires. Ce cap ne conditionne
pas les premiers développements. Les fonctions de coordination
propres à Learning ou DGS peuvent constituer des modules avec un seul
consommateur. Leur classement physique initial peut rester près du mod ;
leur contrat et leur responsabilité déterminent leur autonomie.

Cette piste prolonge la reconfiguration déjà étudiée : le noyau conserve les
mécanismes communs et les définitions des mods assemblent les fonctionnalités.
Les utilisateurs, ACL et droits commerciaux d’accès aux mods, BDC ou options
avancées restent dans leur chantier distinct. La fabrication de l’export et
l’injection SCORM restent également hors périmètre.

## Portée de cette analyse

La pertinence de ces interfaces doit être éprouvée sur les usages réels
Learning/DGS. Un module peut être vérifié isolément ; ses raccords, les opérations
communes et les cycles de vie exigent aussi une acceptation par composition
prise en charge. Les contrats de dépendances réduisent certaines combinaisons
invalides, sans supprimer le coût de validation des interactions.

Cette tâche reste documentaire : les spécifications vérifiées et le code
restent inchangés. Les décisions nouvelles sont à relire dans le plan.
