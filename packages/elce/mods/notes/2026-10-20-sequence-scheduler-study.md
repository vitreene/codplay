# Sighty-TV — programmes et scheduler pour digital-signage

Étude ouverte le 20 octobre 2026 ; cadrage repris le 11 novembre 2026.

## Discussion en cours — premier périmètre

Le mod demandé est `digital-signage`, présenté comme **Sighty-TV**. Son
organisation remplace le Sommaire par un scheduler et un créateur de programmes.
La démarche demandée est une discussion, suivie de questions puis d'un plan.
Cette note rassemble la matière de cette discussion ; elle ne décrit ni une
API disponible, ni un format documentaire arrêté, ni un contrat vérifié.

Les sections exploratoires suivantes conservent des pistes plus larges.
Pour le premier périmètre, le présent cadrage prévaut : un calendrier pour
un écran, vues jour et semaine. La vue mensuelle, la multi-diffusion et
l'affectation de plusieurs récepteurs sont ultérieures. Les pistes de calcul
serveur ne constituent pas un choix de déploiement pour cette première étape.

L'ordre de réalisation retenu est de créer d'abord le calendrier, puis la
structure des programmes. La suite, dont l'exécution de la diffusion et sa
prévisualisation, appartient à des tranches ultérieures. Les règles de
lecture étudiées ci-dessous donnent le contexte métier ; leur discussion
n'engage pas leur implémentation dans ces deux premiers blocs.

La création de plusieurs calendriers et l'action « diffusion » qui active
l'un d'eux sont également reportées à une tranche suivante.

Le [plan calendrier et programmes](../plan/2026-11-11-digital-signage-calendar-program-plan.md)
prépare ces deux blocs et distingue les décisions retenues des raccords
encore à arrêter. Les exemples et le raisonnement restent dans cette note.

### Moteur commun et chantier parallèle BDC Calendrier

Le moteur calendaire sert deux usages : le scheduler de programmes Sighty-TV
et un BDC Calendrier destiné à afficher des contenus datés. Ce second usage
est un chantier parallèle ; il ne gère pas de programmes.

| Ensemble | Responsabilité |
| --- | --- |
| Moteur calendaire partagé | Dates, périodes, récurrences, occurrences, exceptions et projection sur la période demandée, sans référence aux programmes ou aux slots. |
| Scheduler et programmes de `digital-signage` | Placer et organiser les programmes Sighty-TV ; leur métier reste propre au mod. |
| BDC Calendrier partagé | Présenter un planning, par exemple l'occupation d'une salle sur la semaine ; Learning peut le recevoir comme premier consommateur, puis les autres mods. |

Le moteur et le BDC sont partagés dès leur conception. Le scheduler et
surtout les programmes restent dans `digital-signage`. Si un autre projet
en a besoin, leur partage pourra être étudié ensuite ; ce besoin futur ne
justifie pas leur extraction préalable. Le BDC Learning n'attend ni ces
fonctionnalités ni l'entrée du nouveau mod dans le sélecteur.

Le BDC réutilise le calcul du moteur, sans dépendre du scheduler ni du mod
Sighty-TV. Les choix de présentation appartiennent au BDC. Les règles
d'interlude et d'enchaînement de programmes ne lui sont pas transférées.
Le [BDC Graphe](../../specs/statistical-graph-spec.md) fournit un exemple
vérifié de raccord d'un contenu spécialisé au document, à son édition et
aux builders de rendu existants ; ce raccord est à réemployer pour le BDC
Calendrier selon ses placements retenus.

Pour le BDC Calendrier, distinguer l'interface de création et de configuration
du rendu final diffusé. La première peut employer le calendrier graphique ;
le second est une vue statique en V1, sans outils de déplacement, de
redimensionnement ou de navigation auteur. Le rendu partage les données et
les projections du moteur, sans imposer le widget d'édition dans la scène.

La première étape de rendu retient un calendrier foreign opaque, hébergé
dans un composant CodPlay. Il peut être une illustration ou un menu dont
les activations émettent des intentions vers Sighty, sans faire des items
des persos de scène. Son intégration reçoit aussi les données ou commandes
de présentation nécessaires. Le raccord des deux usages est porté par le
[plan distinct des widgets autonomes](../../../sighty/plan/2026-11-11-widgets-foreign-plan.md).
Le support de `emit` sur les zones/items appartient au futur composant intégré,
à préciser d'après les usages observés. Les outils de gestion du calendrier
ne sont pas prévus dans le rendu diffusé.

Exemple de présentation envisagée : « Salle de réunion — semaine du 16 au
22 novembre 2026 », avec « Réunion équipe » le lundi de 9 h à 10 h et
« Atelier » le mercredi de 14 h à 16 h. Ces entrées sont des contenus
calendaires affichés, sans référence à un programme de diffusion.
La forme précise des contenus et les réglages de présentation du BDC restent
à élaborer dans ce chantier ; cet exemple ne fixe pas son format persistant.

Une évolution permettra l'import ou l'abonnement à un calendrier public,
par exemple au format iCal. L'import apportera une copie ponctuelle ;
l'abonnement permettra d'actualiser les affichages depuis la source.
Les deux emprunteront une conversion vers les données calendaires communes,
sans imposer le format d'échange au modèle auteur ni à celui des programmes.
Les règles de synchronisation et le contrat du format seront précisés pour
cette évolution ; aucun connecteur n'est à implémenter dans le premier moteur.

### Rendre le BDC Calendrier dans CodPlay — étude du composant

La question porte sur le calendrier visible dans une composition CodPlay,
distinct de la grille auteur du scheduler. La première étape retenue est un
**rendu foreign opaque**, monté dans un hôte CodPlay. Elle permet d'éprouver
les vues et les usages avant de définir un composant Calendrier intégré.
Les études de ce composant et de ses parts sont conservées ci-dessous comme
évolution ; elles ne sont plus des prérequis de ce premier affichage.
Aucun rendu Calendrier n'est encore implémenté.
La normalisation du montage et des échanges avec le Sommaire global relève
du [plan des widgets foreign](../../../sighty/plan/2026-11-11-widgets-foreign-plan.md).
Les développements suivants conservent le raisonnement de l'étude ; les
actions et critères communs ont leur propriétaire dans ce plan distinct.

#### Première étape — contenu foreign hébergé

Le [contrat du composant `slot`](../../../codplay/specs/slot-component-spec.md)
prévoit une boîte HTML pour un contenu foreign opaque : autre scène,
iframe, média ou représentation possédée par un fournisseur externe. Sa
surface `foreignContent` attache et détache des racines, sans en faire des
persos, parts ou cibles CodPlay. Le contenu ne demande pas un nouveau type
core `foreign-object` ; ce terme désigne ici la stratégie d'intégration.

La séparation proposée est :

| Propriétaire | Responsabilité dans la première étape |
| --- | --- |
| Scène et hôte CodPlay | Place, dimensions et présentation de la boîte ; montage/détachement par la frontière foreign existante. |
| Intégration Calendrier externe | Données de présentation, vues Liste/Jour/Semaine, widget, styles et libération de ses ressources. |
| Intégration Sighty | Admission des événements métier, commandes vers le calendrier et coordination avec le parcours. |

Le contenu est visible à l'intérieur de l'hôte, mais ses rendez-vous et ses
cellules restent hors du graphe de scène. Cette première étape ne raccorde
ni clic d'item à `Perso.emit`, ni `data-part` internes, ni perso enfant dans
une cellule. Elle n'implémente pas les outils d'édition du scheduler dans
le calendrier diffusé. La boîte hôte peut conserver les actions CodPlay
qui concernent sa présentation ; cela n'étend pas ces actions au contenu
opaque.

Le cycle du widget reste explicite : création, alimentation, mise à jour,
détachement et destruction relèvent de son propriétaire. Un détachement
foreign ne détruit pas la ressource. Un Seek de la scène ne reconstitue pas
les rendez-vous, l'état interne ou l'horloge du widget ; seule la boîte
CodPlay suit le temps de scène. Le constat sur l'intervalle interne
EventCalendar, détaillé plus bas, ne justifie donc pas d'imposer à cette
première étape toute la synchronisation du futur composant intégré.
Aucun tick du widget n'est converti en flux d'événements CodPlay/Sighty.

Le chargement de la bibliothèque et de ses styles appartient au raccord
extérieur. Un simple perso `slot` ne déclare pas, à lui seul, un requirement
EventCalendar. Conserver un propriétaire unique de cette préparation et
qualifier sa livraison réelle ; ne pas présenter la dépendance comme déjà
déduite automatiquement par le build de scène.

**Limite du raccord actuel.** La surface HTML foreign est vérifiée, mais la
façade publique `instances.mount` décrite par le contrat monte aujourd'hui
une autre instance CodPlay. Elle ne constitue pas une API publique déjà
validée pour un widget DOM arbitraire. Le
[plan foreign](../../../codplay/plan/foreign-scene-component-plan.md)
garde le raccord générique au propriétaire de représentation à définir.
Avant de réaliser ce calendrier, arrêter ce raccord minimal en prolongeant
la surface existante. Sighty ne recherche pas l'hôte par sélecteur et ne
déplace pas lui-même les racines dans le slot. Aucune scène enfant factice
ne doit être créée pour faire passer le widget pour une scène CodPlay.

#### Échanges applicatifs avec Sighty

Le [contrat d'intégration Sighty](../../../sighty/specs/authoring-library-spec.md#4-api-dintégration-publique)
fournit l'entrée `runtime.dispatch` et la sortie `runtime.events.onEvent`.
Le raccord extérieur peut transmettre les événements métier du calendrier
à cette entrée et recevoir les événements publics utiles via l'abonnement,
ou une commande explicitement portée par une action d'intégration.
Ne pas inventer une `sourceSceneKey` pour le widget extérieur : cette valeur,
lorsqu'elle est fournie, désigne une vraie scène active. Tout `dispatch`
n'est pas supposé être automatiquement réémis à l'abonnement public.

Les messages conservent des données métier sérialisables. Le DOM et les
handles de bibliothèque restent chez leur propriétaire. Les abonnements
sont retirés au démontage de l'intégration ; il n'y a ni bus de navigation
parallèle ni boucle d'écho entre réception et émission. En usage illustratif,
aucune navigation n'est attachée aux items. En usage menu, une activation
d'item émet une intention vers Sighty et ses actions/guards ; elle ne devient
pas une émission de perso ni une opération directe sur le player.

Le Sommaire dans l'aside fournit un précédent de composition complet. Le
[layout Elcé](../../src/mods/learning/reading/learning-layout-scene-builder.ts)
déclare la région `aside`, son ancre et le `slot` nommé du menu. Le
[scénario](../../src/mods/learning/reading/learning-scenario-builder.ts)
y conserve le Sommaire comme sélection persistante, distincte des pages qui
changent dans la région de contenu. Le
[Sommaire Elcé](../../src/mods/learning/organization/reading/learning-summary-scene-builder.ts)
émet des événements publics par ses entrées et les
[actions de scénario](../../src/mods/learning/reading/learning-scenario-actions.ts)
lui envoient l'état de présentation : page active, accès et progression.
Il fournit donc déjà la séparation entre cadre, contenu autonome par rapport
aux pages et coordination événementielle Sighty.

La [décision Sighty sur les composants standard](../../../sighty/notes/2026-10-07-composants-standard-scenario.md)
prévoit en outre de remplacer Sommaire et commandes de navigation par des
composants JavaScript autonomes, facultatifs, hébergés comme contenu foreign.
Elle conserve ouverts leur fourniture, leur alimentation et leur cycle de
montage. Ce cadrage existe donc déjà ; le calendrier ne doit pas inventer
un raccord foreign spécifique pour le même besoin de présentation externe.

Dans le code courant, le Sommaire de l'aside est encore une scène CodPlay.
Le modèle de widget autonome est une orientation retenue, pas un montage
foreign déjà réalisé. Rattacher la décision du raccord Calendrier à cette
frontière commune, sans lui imposer la réalisation complète des futurs
widgets standard. Réemployer le circuit de composition et d'échange sans
dépendance de la ressource Calendrier au mod Learning. Le métier des
programmes et des calendriers ne devient pas une capacité de Sighty.

Le plan commun possède l'acceptation du montage foreign, de son cycle et
des échanges : un affichage illustratif, puis une activation de menu vers
Sighty. Le Calendrier apporte ses vues, sa lisibilité, ses occurrences et
les styles livrés. Observer ensuite quels usages demandent des émissions
intégrées aux persos, une reconstruction temporelle ou l'insertion de
persos ; ces besoins guideront l'évolution étudiée dans les rubriques
suivantes.

#### Circuit existant à reprendre — composant intégré ultérieur

Le [contrat de matérialisation](../../../codplay/specs/component-materialization-v2-spec.md)
sépare le composant de son rendu HTML. Un `layout` fournit un template ;
`tag` reçoit notamment texte, attributs, classes et style. Le
[contrat de layout](../../../codplay/specs/layout-component-spec.md)
permet d'y monter des persos sur des ancres commentaire, sans conteneur
supplémentaire. Le [contrat auteur](../../../codplay/specs/scene-authoring-spec.md)
conserve ensuite le chemin `SceneDoc → compilation → lecture → matérialisation`.

Le précédent Elcé concret est le
[builder du BDC Graphe](../../src/resources/bdcs/statistical-graph/reading/statistical-graph-scene-builder.ts).
Il produit markup, feuille de style et persos éventuels. Les
[builders Diapo](../../src/resources/pages/diapo/diapo-scene-builder.ts),
[Flux](../../src/resources/pages/flux/flux-scene-builder.ts) et
[Carousel](../../src/resources/bdcs/carousel/reading/carousel-scene-builder.ts)
intègrent cette contribution dans leurs scènes. Ce précédent prouve
l'existence du raccord, pas la validation d'un futur calendrier dans ces
placements.

Le circuit proposé serait :

```text
Données calendaires + période + fuseau d'affichage
    → classe métier commune : occurrences de la période
    → builder du BDC : configuration de présentation et perso calendrier
    → SceneDoc du placement retenu
    → compilation, préparation tierce et matérialisation CodPlay
    → composant externe : rendu de la vue dans sa propre racine HTML
```

La classe métier conserve dates, récurrences et exceptions. Le builder du
BDC prépare les occurrences et les choix de présentation pour le composant.
Le rendu possède les colonnes de jours, en-têtes, échelle horaire, position
des rendez-vous, continuation d'un item sur plusieurs jours et répartition
visuelle des items qui se chevauchent. Un chevauchement
dans un planning affiché peut être une information à montrer ; la règle de
concurrence des programmes Sighty-TV ne lui est pas transférée.

#### Alternative composée avec les composants existants

Une grille HTML/CSS construite par le builder reste possible : textes accessibles,
titres de jours et horaires lisibles, dimensions relatives à la zone du
BDC. Les blocs horaires peuvent être positionnés à partir des bornes
calculées, sans créer une cellule ou un perso pour chaque seconde. Le SVG
reste possible, comme pour le Graphe, mais n'est pas nécessaire à une grille
de textes et de rendez-vous.

Exemple : « Salle de réunion — semaine du 16 novembre », affichée de 8 h à
18 h. Le rendez-vous du lundi de 9 h à 10 h occupe la colonne du lundi,
commence à 10 % de la hauteur horaire et en utilise 10 %. Ces proportions
décrivent sa place dans le calendrier : elles ne programment pas une action
à la neuvième heure de lecture CodPlay. La même vue doit pouvoir être
affichée à n'importe quel instant de la scène.

Les en-têtes et rendez-vous sans comportement propre peuvent rester dans
le markup du layout. Chaque élément parent auteur garde un `id` explicite.
Un rendez-vous à animer ou à activer individuellement peut devenir un perso
`tag`, ou `layout` si son contenu est structuré, monté sur une ancre
`<!-- data-part="…" -->`. La géométrie reste celle de la présentation
calendaire ; les animations passent par les actions et le temps CodPlay.
Une feuille CSS statique n'introduit ni animation autonome ni horloge privée.

Pour une action sur un item, conserver l'identité métier de l'occurrence,
distincte de celle de la série et des identifiants de montage du placement.
Si un rendez-vous est représenté sur deux jours, ses deux fragments
renvoient à la même occurrence. Les
[liens inline existants](../../src/mods/learning/inline-text/learning-inline-text-scene.ts)
montrent le montage d'un perso interactif sur une ancre commentaire ; la
[source HTML de Perso.emit](../../../codplay/specs/perso-emit-v2-spec.md)
fournit le circuit d'entrée. Le choix des actions proposées et de leur
portée reste à définir pour le BDC, sans importer les liens ou les événements
propres à Learning. Un affichage statique n'exige aucun événement ; un clic
facultatif ne devient pas une source continue.

#### Builder ou nouveau composant

| Option | Intérêt et limite pour ce besoin |
| --- | --- |
| Builder BDC avec `layout` et les `tag` utiles | Réemploie la compilation, le montage, les actions et le cycle du player ; adapté à une période préparée pour l'affichage statique. La logique de présentation reste regroupée dans le builder Calendrier. |
| Composant CodPlay externe dédié | Regroupe les vues liste/jour/semaine et la projection de leur état ; utile au réemploi dans plusieurs scènes, même sans interaction. Peut utiliser un renderer propre ou EventCalendar préparé en tierce. Son état, ses actions et sa reconstruction sont à définir. |
| Composant ajouté au core | Aucun besoin générique manquant n'est établi pour cette vue statique. Une éventuelle promotion demanderait un contrat et une autorisation propres ; le BDC ne l'impose pas. |
| EventCalendar derrière le composant externe | Réemploie ses vues en sélectionnant les plugins utiles. Son état DOM, ses styles, son horloge interne et ses callbacks demandent un raccord explicite ; ses outils d'édition restent désactivés en diffusion. |

Le `layout` lit son markup initial dans
[`render()`](../../../codplay/src/runtime/components/layout/layout-component.ts) ;
son `update()` applique classes, styles et attributs. Il ne fournit pas une
action de remplacement du calendrier complet. La composition proposée
convient donc à une période et à un jeu d'occurrences préparés pour la scène ;
elle ne prouve pas un renouvellement à minuit, un changement de semaine en
lecture ou une actualisation d'abonnement dans une scène conservée.

Pour le composant externe étudié, la frontière existante
[`BaseHTMLComponent`](../../../codplay/src/runtime/components/base-html-component.ts)
fournit une racine HTML matérialisée. Le composant reste une présentation :
calcul des récurrences, connecteurs et scheduler gardent leurs propriétaires.
La différence avec la composition `layout` est l'encapsulation des vues et
de leurs mises à jour dans une même instance de composant.

#### EventCalendar comme renderer tiers : capacités examinées

Le [paquet consulté](https://github.com/vkurko/calendar/blob/master/packages/core/package.json)
déclare la version 5.18.1 et la licence MIT. Sa distribution JavaScript
s'appuie sur Svelte 5 en interne ; l'API de montage ne demande pas d'écrire
une application Svelte. La [documentation officielle](https://github.com/vkurko/calendar#javascript-module)
expose `createCalendar`, `destroyCalendar` et des plugins de vues séparés.

| Présentation | Vue EventCalendar correspondante | Périmètre à qualifier |
| --- | --- | --- |
| Liste des rendez-vous | `listDay`, `listWeek` ; également `listMonth` et `listYear` | Une liste groupée par date, notamment adaptée à un cadre étroit. |
| Journée avec horaires | `timeGridDay` | Une colonne horaire et ses rendez-vous. |
| Semaine avec horaires | `timeGridWeek` | Colonnes de jours et chevauchements horaires. |
| Grille de jours | `dayGridDay`, `dayGridWeek`, `dayGridMonth` | Autre présentation disponible ; le mois n'est pas ajouté au premier scheduler par cette capacité de bibliothèque. |

La liste utilise le plugin `List`, les grilles horaires `TimeGrid` et la
grille de jours `DayGrid`. Charger seulement les plugins retenus ;
`Interaction`, qui fournit les gestes de manipulation, est distinct et
n'est pas requis pour les vues. La sélection de plugins réduit le périmètre
fonctionnel ; son effet réel sur le poids du bundle reste à mesurer.
La documentation précise toutefois que
[`dateClick`](https://github.com/vkurko/calendar#dateclick), pour un clic sur
une date ou un horaire, requiert `Interaction`. Si ce raccord est retenu,
charger ce plugin en gardant déplacement, redimensionnement et sélection
d'édition désactivés ; la présence du plugin n'autorise pas ces gestes dans
la diffusion.

Les [méthodes documentées](https://github.com/vkurko/calendar#methods)
permettent notamment `setOption`, `gotoDate` et la mise à jour des événements.
Le wrapper doit projeter un état complet et reproductible ; les mutations
du widget ne deviennent pas le document métier. Les callbacks de rendu
comme `datesSet` ne provoquent pas, par eux-mêmes, une modification du
document ou un nouvel événement logique CodPlay.

#### Propriétaires et surface du composant à définir

| Propriétaire | Rôle |
| --- | --- |
| Ressource calendaire commune | Calcul des occurrences, récurrences, exceptions, périodes et conversions calendaires. |
| Intégration externe CodPlay | Classe du composant, validation de son profil, déclaration de bibliothèque, conversion des données de présentation et cycle du renderer. Elle reste indépendante des mods Elcé. |
| BDC Calendrier Elcé | Contenu éditorial, configuration auteur, persistance et builder produisant le perso de rendu. |
| Composition de l'application | Inscription de l'intégration, livraison des styles et choix des actions admises. |

La surface auteur doit rester limitée : vue choisie, date ou période affichée,
occurrences à présenter, fuseau de présentation, langue, premier jour de la
semaine et plage horaire visible. Un item conserve son identité d'occurrence,
son lien éventuel à une série, ses bornes, son titre et sa présentation.
Ces notions sont une proposition de profil, pas des propriétés CodPlay déjà
disponibles. Les options et callbacks bruts du widget ne sont pas exposés
comme un sac de configuration auteur.

Une même occurrence peut produire plusieurs fragments visuels. L'identifiant
du widget doit être fourni explicitement depuis la projection : son
[parseur](https://github.com/vkurko/calendar/blob/v5.18.1/packages/core/src/lib/events.js)
fabrique sinon des identifiants séquentiels. Les identités logiques restent
stables lors d'un changement de vue et ne dépendent pas du DOM créé.

Exemple d'usage à viser : un BDC « Salle de réunion » présente la semaine du
16 novembre avec les deux rendez-vous déjà décrits. L'auteur choisit Liste
pour un bandeau étroit, Jour pour une page quotidienne ou Semaine pour un
écran large. Ce sont les mêmes occurrences. Une action CodPlay pourrait
ultérieurement changer la vue ou la date affichée ; son nom et son payload
restent à définir. La diffusion V1 conserve l'absence de navigation auteur,
de déplacement et de redimensionnement des items.

#### Préparation de la bibliothèque et propriété du DOM

Le [contrat de préparation tierce](../../../codplay/specs/third-party-library-spec.md)
possède déjà le raccord : l'intégration déclare un `RuntimeLibraryDefinition`
et la définition du composant référence son ID dans `libraries`.
Le build dérive le requirement ; la préparation précède l'initialisation.
La classe reçoit la bibliothèque préparée par `runtime.getLibrary()` et ne
fait aucun import asynchrone depuis son constructeur, `initialize()` ou
`update()`. Le chargement est partagé par propriétaire, tandis que chaque
perso conserve sa propre instance de calendrier.

`render()` peut fournir le conteneur HTML du composant, avec son `id` auteur.
Après sa matérialisation, `initialize()` y monte le calendrier préparé.
CodPlay possède le placement de cette racine ; la bibliothèque possède son
sous-arbre interne. Le composant peut aussi exposer des parts publiques
stables pour accueillir d'autres persos, avec des zones hors du sous-arbre
que le widget remplace. Les cellules reconstruites par la bibliothèque ne
deviennent pas automatiquement des parts CodPlay. Leur éventuelle ouverture
demande le contrat de coexistence étudié ci-dessous. Les items du widget ne
deviennent pas automatiquement des persos animables individuellement.

`update()` applique uniquement les changements d'état utiles par l'API du
renderer, sans recréer le calendrier à chaque passage. Seek et reset
reprojettent le même état résolu ; ils ne rejouent pas une suite de `next()`
ou de `addEvent()`. Les animations de la racine restent celles de CodPlay.

La [déclaration de types amont](https://github.com/vkurko/calendar/blob/master/packages/core/types/index.d.ts)
annonce `destroyCalendar()` comme retournant une promesse. Le contrat local
`BaseComponent.destroy()` est synchrone : il faudra vérifier le retrait
effectif des listeners, effets différés et tâches du widget sans supposer
que le player attend cette promesse. Les effets réactifs Svelte peuvent
aussi décaler la disponibilité de la géométrie ; le premier affichage,
le redimensionnement et le retour d'une vue masquée doivent être qualifiés.

Les vues doivent aussi tenir dans le cadre de diffusion : une grille auteur
peut utiliser du scroll ou un lien ouvrant les items supplémentaires, alors
qu'une vue diffusée sans manipulation doit rendre son contenu lisible dans
la zone prévue. Qualifier la plage horaire, la densité, les textes longs,
les items de journée entière et l'état vide. Si un découpage en plusieurs
pages est retenu, son enchaînement rejoint CodPlay ; le widget n'ajoute pas
de défilement ou de pagination temporisés autonomes.

La feuille `@event-calendar/core/index.css` est une dépendance du rendu.
Son chargement, son isolation sous la racine et son inclusion dans la
publication doivent être explicites. Le seul requirement de bibliothèque
JavaScript ne garantit pas sa livraison. Les styles partagés ne sont pas
retirés à la destruction d'un seul widget si un autre les utilise. Le
[contrat d'export existant](../../../codplay/specs/scene-package-export-v1-spec.md)
sépare le paquet scène et l'intégration du site ; il faut vérifier ce vrai
parcours avec les styles et la bibliothèque retenus. La préparation reste
interne au raccord : une scène unique utilise le chargement public habituel,
sans demander à son auteur de gérer plusieurs instances ou le catalogue.

#### Conditions de fidélité temporelle et événementielle

**Horloge du widget.** Dans les
[effets de la version 5.18.1](https://github.com/vkurko/calendar/blob/v5.18.1/packages/core/src/storage/effects.js),
`setNowAndToday()` installe un intervalle d'une seconde. L'effet est raccordé
sans condition dans l'[état du widget](https://github.com/vkurko/calendar/blob/v5.18.1/packages/core/src/storage/state.svelte.js).
`nowIndicator: false` masque le repère d'heure sans supprimer cet intervalle.
L'utilisation telle quelle n'établit donc pas un rendu temporel entièrement
piloté par CodPlay. Pour une diffusion reproductible, il faut un mode sans
horloge autonome, avec date de référence explicite et repères dépendant de
l'état reçu. Aucune option publique examinée ne réalise ce mode. Étudier
une adaptation ciblée de la bibliothèque, avec provenance et licence
conservées, ou un renderer propre si cette adaptation devient trop coûteuse.
Ne pas neutraliser les timers globaux et ne pas créer un événement par tick.

**Temporal et fuseaux.** L'API tierce accepte `Date` et chaînes ISO ; elle
n'expose pas Temporal. Le [contrat timeZone documenté](https://github.com/vkurko/calendar#timezone)
accepte `local`, `UTC` ou un décalage fixe, sans annoncer les noms IANA.
La classe métier conserve Temporal si retenu et le fuseau nommé ; une
conversion explicite appartient à l'adaptateur de présentation. Un offset
fixe ne remplace pas `Europe/Paris` sur une période changeant d'heure.
Les heures civiles projetées doivent rester distinctes des instants d'origine,
y compris dans les callbacks qui retournent des `Date`. Qualifier une semaine
traversant un changement d'heure et un navigateur situé dans un autre fuseau.

**Évolution intégrée : support de `emit` requis.** Le composant doit permettre de déclarer des
émissions sur ses zones et items. Le parcours visé est clic → événement
CodPlay configuré → action correspondante, avec `listen`/strap lorsque la
réponse demande ce traitement. Le calendrier ne réalise pas lui-même la
navigation ou l'action applicative. L'absence de gestion auteur dans le
rendu n'exclut pas ces interactions.

`eventClick` fournit l'événement du widget, son élément et l'événement natif.
`dateClick` fournit la date ou l'horaire d'une zone de grille. Ces callbacks
ne fournissent pas automatiquement un événement CodPlay. Le circuit ordinaire
[`Perso.emit`](../../../codplay/specs/perso-emit-v2-spec.md)
ne déduit pas une identité d'occurrence depuis des cellules créées après
la matérialisation. La traduction de cette activation doit être définie.
L'extension de source HTML déjà employée par
[`scroll-container`](../../../codplay/specs/scroll-container-spec.md)
offre un raccord à étudier, avec `HtmlSourceAdapterContext.commands.emit`
vers le dispatcher existant, ses règles de lecture/pause et son cycle Seek.
Elle ne justifie pas un second bus ni deux émissions pour le même clic.

Le payload logique proposé identifie la zone, l'item/occurrence lorsqu'il
existe, ou la date et l'horaire d'une zone vide, et éventuellement sa
série/source ; aucun nœud DOM, objet Svelte ou événement natif n'entre dans
le journal. Nom d'événement et portée restent configurés selon l'usage.
Le support de l'émission doit être qualifié dans la première réalisation du
composant ; une scène peut choisir de ne déclarer aucune règle `emit`.
Récurrences et abonnements restent dans leurs services ; le composant reçoit
des occurrences et leurs révisions, sans fetch ou synchronisation propres.

#### Accueillir d'autres persos dans des `data-part`

Le mécanisme n'est pas réservé à `layout`. La
[matérialisation HTML](../../../codplay/src/runtime/runner-html/component-materializer.ts)
lit le résultat de `render()` de tout `BaseHTMLComponent`, découvre ses parts
et sélectionne celles rendues publiques par sa définition. Le
[catalogue](../../../codplay/src/runtime/catalog/runtime-capability-catalog.ts)
prévoit `mountableParts` et `mountablePartResolver`, avec le module `markup`.
`InputComponent` exerce déjà la séparation entre parts internes et cibles
publiques pour ses icônes. Le composant Calendrier peut employer cette même
frontière, sans circuit de placement supplémentaire.

La proposition simple consiste à déclarer les zones stables dans son template
initial, autour d'un hôte privé où la bibliothèque est montée. Exemple de
structure envisagée pour un perso `calendar-a` :

```html
<section id="calendar-a-root">
  <header id="calendar-a-heading">
    <!-- data-part="calendar-a:title" -->
  </header>
  <div id="calendar-a-view" data-part="calendar-a:renderer"></div>
  <footer id="calendar-a-footer">
    <!-- data-part="calendar-a:legend" -->
  </footer>
</section>
```

La définition publierait `calendar-a:title` et `calendar-a:legend`, en
conservant `calendar-a:renderer` comme part interne. Un perso `tag` affichant
le nom de la salle pourrait viser `move: { target: 'calendar-a:title' }` ;
une image ou un autre layout pourrait viser la légende. Les noms sont des
conventions et des identités explicites : aucun mot `title` ou `legend` ne
déclenche de comportement. Le profil devra préciser quelles zones l'auteur
peut configurer. Cette structure illustre le contrat proposé du composant,
pas un type Calendrier déjà disponible.

| Emplacement souhaité | Condition de faisabilité |
| --- | --- |
| Titre, légende, panneau complémentaire stable | Part du template initial, publiée et conservée hors de la zone remplacée par le renderer ; réemploi direct du montage CodPlay existant. |
| Contenu d'un rendez-vous connu au départ | À qualifier : cible découverte avant le montage des enfants, conservation du nœud hôte et de ses enfants lorsque le widget redessine ou change de vue. |
| Cases ou rendez-vous créés dynamiquement après une mise à jour | Contrat manquant pour cette intégration : apparition/retrait des cibles, réconciliation du placement et traitement des enfants lorsque la cible disparaît. Aucun support automatique ne doit être promis. |

Les [hooks de contenu EventCalendar](https://github.com/vkurko/calendar#eventcontent)
acceptent une représentation HTML ou des `domNodes`. C'est une ouverture pour
étudier un hôte réservé au contenu CodPlay dans un rendez-vous. Ce n'est pas
une garantie que le widget préserve sa parenté ou ses enfants à chaque
reconstruction. Un rendez-vous sur plusieurs jours peut produire plusieurs
fragments ; un même perso ne peut pas être simultanément monté dans plusieurs
hôtes DOM. L'identité du fragment et le choix de l'hôte doivent être définis
si cette composition interne est retenue.

Écrire `data-part` dans un `eventContent` construit après `initialize()` ne
suffit pas. Le chemin actuel découvre les parts lors de
`materializeTemplateString(component.render())` ;
[`BaseHTMLComponent`](../../../codplay/src/runtime/components/base-html-component.ts)
conserve ensuite les références reçues par `_materialize()`. Le
`mountablePartResolver` sélectionne les IDs publiables au montage ; il ne
surveille pas les futurs nœuds ajoutés par le widget. Aucun scan permanent,
mutation observer de remplacement ou inscription manuelle dans un registre
interne n'est à introduire pour contourner cette frontière.

La première proposition peut donc ouvrir des zones stables. Les zones
internes aux cellules demandent une décision et une preuve distinctes avant
de choisir leur réalisation. Si elles deviennent indispensables et que la
bibliothèque détruit leurs hôtes, comparer son adaptation et un renderer
propre capable de préserver ces cibles. Toute extension du circuit core de
parts dynamiques reste soumise à son contrat et à une autorisation distincte.

Pour une zone accueillant un enfant, le composant conserve la boîte et le
point de montage ; CodPlay conserve le placement et le cycle du perso enfant.
Le renderer ne doit ni effacer ses enfants ni remplacer leurs racines pour
refaire la cellule. L'articulation des émissions du parent et de l'enfant
doit aussi éviter de publier deux fois une même intention par propagation
du clic. Une part publique de montage et une zone d'émission sont deux
déclarations distinctes ; le marqueur seul ne crée aucune émission.

Pour une future réalisation intégrée, qualifier les vues Liste, Jour et Semaine,
leur changement avec les mêmes occurrences, des items simultanés, un item
traversant minuit, une occurrence récurrente neutralisée et deux placements
du même BDC sans collision d'identifiants. Vérifier les fuseaux et changements
d'heure, les styles et la publication, les conteneurs étroits ou masqués,
puis le vrai montage, Seek, reset/relecture et destruction. La préparation
tierce doit être dédupliquée et chaque widget isolé. Vérifier l'absence
d'horloge autonome après l'adaptation retenue et l'absence d'effets après
destruction. Vérifier les émissions configurées sur un item et une zone,
leur identité, leur portée, les frontières lecture/pause et l'absence
d'émissions dupliquées. Pour les parts stables retenues, monter de vrais
persos enfants et vérifier leur identité, leurs actions et leur conservation
après changement de vue, Seek, reset, resize et destruction. La composition
interne aux cellules garde son acceptation distincte tant qu'elle n'est pas
décidée et prouvée.
La gestion d'une période relative (« cette semaine »), du renouvellement
pendant une diffusion longue et des données d'abonnement actualisées demande
une décision de cycle de mise à jour avant son implémentation.

### Adaptateurs de sources calendaires à prévoir

L'évolution des sources dépasse les calendriers publics au format iCalendar.
L'utilisateur retient aussi les environnements Microsoft et Google comme
adaptateurs pertinents pour alimenter l'affichage, notamment le planning
d'une salle.

| Source | Raccord de référence |
| --- | --- |
| iCalendar | Import ponctuel ou abonnement à une source publique, suivant le cadrage précédent. |
| Microsoft 365 / Outlook, avec réunions Teams | [API calendrier Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0) ; les [événements](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0) peuvent porter les informations de réunion Teams. |
| Google Calendar, avec réunions Google Meet | [Google Calendar API](https://developers.google.com/workspace/calendar/api/v3/reference/events) ; les événements peuvent porter les informations de conférence Meet. |

Ces adaptateurs sont des capacités calendaires partagées. Ils ne dépendent
ni du mod `digital-signage` ni des programmes. Chaque source convertit ses
données vers la représentation commune ; le BDC choisit leur présentation.
L'accès à la source et son actualisation appartiennent au connecteur ; le
noyau de calcul ne dépend pas des API Microsoft ou Google.

Les fournisseurs peuvent déjà livrer des occurrences développées, comme
Microsoft Graph `calendarView`. Elles sont consommées comme des occurrences,
sans développer une deuxième fois leur récurrence. La distinction entre
séries et occurrences, ainsi que leurs identités, devra être conservée dans
le raccord commun.

Les guides de [suivi des changements Microsoft](https://learn.microsoft.com/en-us/graph/delta-query-events?view=graph-rest-1.0)
et de [synchronisation Google](https://developers.google.com/workspace/calendar/api/guides/sync)
fournissent les références pour leur future actualisation. Le choix précis
du calendrier accessible, des droits et du mode d'actualisation sera traité
dans cette évolution ; aucune connexion de compte n'est engagée ici.

### Interface calendrier — repères et simplicité d'usage

L'utilisateur souhaite une interface qui masque la complexité du moteur et
se rapproche de l'usage d'`iCal.app`. La recherche prend comme repère
Calendrier d'Apple ; les références suivantes servent à étudier les gestes
et leur présentation, sans décider d'un widget ou d'une copie d'interface.

| Référence d'interface | Ce qu'elle apporte à l'étude |
| --- | --- |
| [Calendrier d'Apple — événements récurrents](https://support.apple.com/en-ca/guide/calendar/icl1018/mac) | Détails d'événement ouverts à la demande ; menu de répétition avec réglage personnalisé pour les intervalles et jours ; fin de répétition distincte ; actions sur des occurrences sélectionnées. |
| [Google Agenda — événements périodiques](https://support.google.com/calendar/answer/37115?hl=fr) | Une entrée simple « Une seule fois » donnant accès à la récurrence ; fréquence et fin réglables ; portée de modification choisie pour la série. |
| [Fantastical — création](https://flexibits.com/fantastical/help/adding-events-and-tasks) | Aperçu déplaçable pendant la création et sélection directe d'une plage par glissement dans la grille. |

L'interface retenue est graphique : le calendrier jour/semaine est la surface
de travail principale, avec des programmes représentés par des blocs
manipulables. Les propositions à concrétiser dans la maquette sont :

- Placer un programme dans la grille, le sélectionner, le déplacer et le
  retirer par des interactions graphiques. Le départ et l'étendue du bloc
  rendent son horaire et sa durée visibles.
- Ajuster graphiquement les bornes d'un créneau à fin fixée ; distinguer
  ce mode du placement dont la durée provient du programme.
- Sélectionner plusieurs blocs ou une plage pour copier-coller les passages
  consécutifs. La sélection et la destination sont visibles dans la grille.
- Représenter les passages issus d'une récurrence et le passage neutralisé
  en conservant leur appartenance à la série.
- Choix de répétition en français : une seule fois, à l'heure, au jour, à la
  semaine, toutes les deux semaines ou au mois ; commandes et réglages
  contextuels associés à la sélection, avec intervalle, jours concernés et
  fin de répétition.
- Graduation lisible et ajustement précis à la seconde accessible sur la
  sélection ; la précision ne demande pas une grille de 86 400 lignes.
- Résumé lisible de la règle et de sa période. Les objets Temporal, chaînes
  RRULE, identifiants de source et particularités de bibliothèque restent
  dans le raccord technique.
- Neutralisation formulée comme « Ne pas diffuser ce passage », avec
  indication visible conservant le lien à la série. Elle exprime le besoin
  accepté de neutraliser un passage sans retirer sa récurrence.

Exemple de manipulation à maquetter : poser « Accueil » le lundi 16 novembre
2026 à 9 h, puis étendre son créneau jusqu'à 10 h. Sur le bloc sélectionné,
choisir une répétition toutes les deux semaines jusqu'au 31 mars 2027. Les
passages correspondants apparaissent dans les semaines concernées. Neutraliser
un passage le conserve identifiable et permet de placer un autre programme
sur ce créneau. Le résumé peut accompagner la sélection : « Accueil, un lundi
sur deux de 9 h à 10 h, du 16 novembre au 31 mars. » Le comportement du contenu
pendant cette heure demeure celui du programme.

Les réglages contextuels accompagnent la manipulation du calendrier. La
sélection de scènes et la logique d'attente, de filtrage ou de synchronisation
des slots restent dans l'édition graphique du programme.

Les contrôles temporels utiles au BDC peuvent partager les mêmes conventions
et calculs. Le BDC conserve son propre contenu à afficher. Les gestes et
l'apparence doivent rester cohérents avec les panneaux, commandes et
conventions auteur déjà employés dans Elcé.

### Bibliothèques d'interface graphique — choix pour la première version

La priorité exprimée est une première version simple à employer. La
comparaison porte d'abord sur le parcours graphique offert à l'auteur et
son raccord à Elcé. La complétude d'un moteur de récurrences n'est pas le
critère premier, ni un préalable à la validation de cette interface.

| Bibliothèque et référence récente | Apports documentés | Point de choix |
| --- | --- | --- |
| [FullCalendar Standard v7.1.4](https://fullcalendar.io/docs/timegrid-view), annoncé le 3 novembre 2026 | Vues jour/semaine ; [déplacement et redimensionnement](https://fullcalendar.io/docs/editable) ; [sélection graphique de plages](https://fullcalendar.io/docs/selectable) ; API JavaScript. | Option étudiée. Les fonctions Standard sont sous [licence MIT](https://fullcalendar.io/license). Temporal est utilisé en interne, avec une API publique encore en `Date`. |
| [EventCalendar v5.18.0](https://github.com/vkurko/calendar/releases), publié le 21 octobre 2026 | [Bibliothèque MIT](https://github.com/vkurko/calendar), grilles temporelles, interactions et API JavaScript de création/destruction ; [démo](https://vkurko.github.io/calendar/). | Référence retenue pour le système visuel et les interactions V1, sans obligation d'intégrer le widget complet. Une reprise ciblée de code reste possible si elle sert le besoin. |
| [Schedule-X v4](https://schedule-x.dev/docs/calendar/major-version-migrations) | Interface calendrier avec valeurs Temporal ; modules d'interaction. | Déplacement et redimensionnement ont été déplacés dans les modules Premium en v4. Comparer l'offre interactive réelle et sa licence ; le critère n'est pas seulement son API Temporal. |

Les applications Apple, Google Agenda et Fantastical restent des repères
d'ergonomie. EventCalendar sert de modèle récent pour le système visuel et
les interactions. L'utilisateur précise que le widget pourrait porter trop
de responsabilités pour le besoin : sa sélection comme référence ne demande
pas son intégration complète.

La surface Elcé se limite aux gestes retenus et appelle la classe métier
partagée et les commandes existantes. Une reprise ciblée de code peut être
étudiée si elle simplifie un geste, avec provenance et licence conservées.
Le parcours à qualifier est
court : poser un programme réel, déplacer le bloc, ajuster un créneau à fin
fixée, sélectionner une plage puis appliquer une répétition simple. Évaluer
la lisibilité, le nombre de gestes et la cohérence avec Elcé. La précision
à la seconde et la copie de plusieurs passages doivent être qualifiées ;
une sélection de plage fournie par la bibliothèque ne prouve pas qu'elle
assure toute seule la copie des programmes de 9 h–11 h vers 15 h–17 h.

Le calcul intégré ou raccordé doit couvrir les usages retenus : dates,
durées, récurrences demandées et neutralisation d'un passage. Les mécanismes
avancés et la reprise complète d'un noyau peuvent venir ensuite. L'intérêt
de Temporal et de `rrule-temporal` est conservé pour cette comparaison,
sans imposer d'abord un moteur exhaustif.

Les gestes de l'interface rejoignent les commandes du propriétaire documentaire
et le même historique. Le document reste la source de vérité ; l'état visuel
de la grille n'est pas un second document. Les adaptations communes
de la grille restent dans une ressource partagée, les références de
programmes et compositions propres à Sighty-TV dans leurs propriétaires.

### EventCalendar, récurrences et abonnements — référence technique

Les capacités ci-dessous décrivent la bibliothèque étudiée. Elles éclairent
la séparation entre interface, calcul et sources, sans imposer ses API au
calendrier Elcé.

L'[API de sources](https://github.com/vkurko/calendar#eventsources) accepte
une URL retournant des événements JSON ou une fonction qui fournit les
événements de la période demandée, y compris par une promesse. La méthode
[refetchEvents](https://github.com/vkurko/calendar#refetchevents) recharge
les sources. C'est le raccord disponible pour alimenter la grille depuis
des sources externes actualisées.

L'[entrée des événements](https://github.com/vkurko/calendar#parsing-event-from-a-plain-object)
et le [parseur examiné](https://github.com/vkurko/calendar/blob/master/packages/core/src/lib/events.js)
traitent des événements déjà datés ; ils ne développent pas de règle RRULE.
Le choix de la grille ne supprime donc pas le besoin de calculer les
récurrences créées dans Elcé. `rrule-temporal` reste une option pour ce
complément ultérieur, sans être nécessaire au seul affichage d'événements
datés. Pour la V1, l'orientation retenue est une classe métier dédiée aux
besoins du calendrier, selon la séparation ci-dessous.

Un abonnement est faisable en raccordant une source à cette API. L'adaptateur
possède la lecture, la conversion et l'actualisation ; la grille affiche son
résultat. Un flux ICS doit être converti : une URL ICS n'est pas une source
JSON directement comprise par EventCalendar. Microsoft Graph `calendarView`
peut fournir les occurrences développées ;
[Google Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
le permet avec `singleEvents=true`. Dans ces cas, le seul affichage ne
requiert pas de développement local des récurrences.

La méthode de rechargement ne réalise pas à elle seule un abonnement ou une
synchronisation avec un fournisseur. Ce raccord reste dans les adaptateurs
de sources prévus pour une évolution ; il ne devient pas une responsabilité
du scheduler ou du programme.

### Classe métier V1 et substitution future du moteur

L'utilisateur retient une classe métier dédiée aux besoins du calendrier,
clairement séparée de son interface. Elle est une ressource partagée : ni
EventCalendar, ni le scheduler, ni le BDC ne doivent posséder leur propre
copie du calcul des récurrences.

La classe couvre le sous-ensemble V1 : périodes, occurrences bornées,
récurrences à l'heure, au jour, à la semaine, toutes les deux semaines et
au mois, avec neutralisation d'un passage. Elle reçoit les données
calendaires et retourne les résultats utiles à ses consommateurs ; le
document et son historique restent dans le circuit propriétaire d'Elcé.

Les conventions doivent conserver une correspondance claire avec RRULE :
ancrage du début, fréquence, intervalle, jours concernés, fin de série et
exceptions identifiant un passage. Deux semaines correspondent ainsi à une
fréquence hebdomadaire d'intervalle 2. Les données auteur restent lisibles.
Une surface métier limitée, à formaliser dans le plan, permet de remplacer
le calcul par un adaptateur `rrule` ou autre si les besoins évoluent.
Il n'y a pas de moteur générique à plugins à créer pour cette V1.

Temporal reste privilégié si son intégration convient : ses types servent
aux calculs et les éventuelles conversions nécessaires à une reprise de
code graphique restent au raccord de la vue. Les conventions persistées restent
indépendantes du moteur et des instances de la bibliothèque. Le rendu du
BDC utilise les mêmes résultats, sans dépendre du widget d'édition.

### Références pour les conventions du moteur et son évolution

L'absence de moteur calendaire dans Elcé ne signifie pas qu'il faut en
inventer les conventions. Les réalisations éprouvées étudiées fournissent
les références sémantiques et des cas de test pour la classe métier V1 ;
elles restent des possibilités de reprise ou de substitution ultérieure.
Le calcul des récurrences et des exceptions s'appuie sur ces notions standard.

| Référence primaire | Apport et rôle proposé |
| --- | --- |
| [rrule-temporal](https://github.com/ggaabe/rrule-temporal) et ses [sources](https://github.com/ggaabe/rrule-temporal/tree/main/src) | Référence Temporal et possibilité d'évolution du moteur : fréquences incluant l'heure, intervalles, exclusions et recherche sur une période ; occurrences exposées en `Temporal.ZonedDateTime`. |
| [rrule.js](https://github.com/jkbrzt/rrule) et ses [sources TypeScript](https://github.com/jkbrzt/rrule/tree/master/src) | Référence de comparaison pour les récurrences et possibilité de reprise à confronter à la piste Temporal. Le projet est un port partiel de `python-dateutil`. |
| [Tests rrule.js](https://github.com/jkbrzt/rrule/tree/master/test) | Matériau de non-régression à conserver pour les parties reprises, complété par les cas d'acceptation Elcé. |
| [ical.js](https://github.com/kewisch/ical.js) et son [guide](https://github.com/kewisch/ical.js/wiki/Common-Use-Cases) | Autre réalisation calendaire de référence ; particulièrement utile pour le futur échange iCalendar, les occurrences modifiées et les fuseaux. Son calcul de récurrences ne doit pas devenir un second moteur concurrent de celui retenu. |
| [FullCalendar TimeGrid](https://fullcalendar.io/docs/timegrid-view) | Référence d'interface jour/semaine. Le [modèle de dates v7](https://fullcalendar.io/docs/date-library) utilise Temporal en interne via un polyfill, mais son API publique expose encore `Date`. Aucun widget n'est sélectionné ici. |
| [Schedule-X](https://schedule-x.dev/docs/calendar/events) | Référence d'interface avec dates d'événements en `Temporal.PlainDate` ou `Temporal.ZonedDateTime`. Son [plugin de récurrence](https://schedule-x.dev/docs/calendar/plugins/recurrence) documente une couverture partielle qui n'inclut pas la fréquence horaire demandée. |
| [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545.html) | Référence sémantique pour `RRULE`, `DTSTART`, `RDATE`, `EXDATE` et l'identification des occurrences modifiées. |

La [licence de rrule.js](https://github.com/jkbrzt/rrule/blob/master/LICENCE)
autorise la reprise et la modification avec conservation des mentions et
conditions de redistribution ; elle conserve aussi les attributions à
`python-dateutil`. `ical.js` est publié sous
[MPL-2.0](https://github.com/kewisch/ical.js/blob/main/LICENSE).
La provenance et les licences des sources et tests effectivement repris
devront être conservées avec eux.

Pour une évolution du calcul, `rrule-temporal` reste un candidat Temporal à
qualifier derrière la surface métier commune. Il n'est pas imposé dans la
classe métier V1. Sa
[licence MIT](https://github.com/ggaabe/rrule-temporal/blob/main/LICENSE)
permet la reprise en conservant les mentions correspondantes. Le
[manifeste consulté](https://github.com/ggaabe/rrule-temporal/blob/main/package.json)
déclare la version 2.2.8 ; cette valeur ne fige pas encore les sources à reprendre.
Le périmètre des sources nécessaires et leur version ou commit d'origine
doivent être fixés avant la copie ; le dépôt amont mutable n'est pas une
référence de livraison suffisante. L'analyse des dépendances doit précéder
le retrait de fonctions inutilisées pour préserver les comportements repris.

La [documentation Temporal du TC39](https://tc39.es/proposal-temporal/docs/)
fournit les distinctions utiles : date et heure civiles sans fuseau,
date-heure avec fuseau et instant exact. Leur emploi dans le moteur et les
conversions des adaptateurs doivent préserver ces sens. Le document auteur
conserve une représentation lisible et persistable, distincte des instances
de calcul de la bibliothèque.

La qualification de `rrule-temporal` doit couvrir ses
[tests existants](https://github.com/ggaabe/rrule-temporal/tree/main/tests),
les changements d'heure, exclusions, bornes et résultats avec Temporal natif
ou polyfill. Sa conformité annoncée par le projet ne constitue pas une
certification du raccord Elcé. Pour `rrule.js`, examiner aussi les
[différences documentées avec la RFC](https://github.com/jkbrzt/rrule#differences-from-icalendar-rfc)
et les conventions UTC/heure locale. Les exemples et tests amont ne suffisent
pas à promettre la bonne adaptation aux fuseaux Elcé.
Pour `ical.js`, le guide précise que les données IANA des fuseaux ne sont
pas incluses par défaut ; elles demandent leur propre raccord si cette base
est retenue. Aucun moteur n'est encore installé, repris ou validé dans Elcé.

Le premier lot construit le calcul limité aux usages V1 dans la classe
métier et privilégie la prise en main graphique. La reprise d'un noyau
éprouvé reste une possibilité d'évolution, sans recherche de complétude
préalable. L'import ou l'abonnement public reste une
évolution ultérieure : le choix du moteur et les références iCalendar
préparent ce raccord sans l'implémenter maintenant.

### Vocabulaire proposé

| Terme | Sens pour la discussion |
| --- | --- |
| Scène | Contenu lu par CodPlay ; son origine et sa fabrication dans Elcé restent à préciser pour ce mod. |
| Layout | Scène qui organise les zones d'affichage et désigne son slot principal. |
| Slot | Zone nommée du layout pouvant recevoir une scène ou un programme. |
| Slot principal | Slot désigné par le layout, qui fournit la référence suivie par les autres selon les règles décrites dans le programme. |
| Programme | Composition réutilisable : titre, description, layout, affectations aux slots et règles d'enchaînement. |
| Passage programmé | Un emploi du programme dans le calendrier ; plusieurs passages peuvent référencer le même programme. Terme proposé, à valider. |
| Diffusion | Terme employé par l'utilisateur pour l'ensemble programmé sur une période, par exemple la journée ou la semaine. |
| Interlude | Programme par défaut diffusé dans les plages libres du calendrier. |

Le mot `sequence` employé dans l'étude initiale désigne les règles locales
d'enchaînement. Il ne décide pas du nom de l'objet auteur, désormais décrit
comme un programme. Une répétition calendaire de programme et une répétition
de scène dans un programme restent deux opérations distinctes.

### Répartition des responsabilités retenue

| Propriétaire | Responsabilités |
| --- | --- |
| Scheduler | Calendrier, placements de programmes, horaires, récurrences, copie de plages et sélection du programme à diffuser à l'heure prévue ; interlude dans les plages libres et demandes de comportement hors diffusion. |
| Programme | Logique de diffusion interne : affectations aux slots, suites, répétitions, alternance, tirage pseudo-aléatoire, délais, attente, filtrage, synchronisation et alignement sur le slot principal. |
| Layout | Organisation des slots et désignation du slot principal. |
| Scène | Déroulé propre, signal de fin fonctionnelle et éventuelle boucle d'attente interne, distincts du démontage. |

Le scheduler reste léger : il référence des programmes et applique leur
programmation calendaire. La logique d'attente et de filtrage appartient au
programme. Les choix d'enchaînement et d'alignement sont exprimés dans le
programme ; ils ne demandent pas une politique globale supplémentaire dans
le scheduler.

### Scheduler demandé

- Précision à la seconde ; vues jour et semaine, pour un écran.
- Ajouter, déplacer et retirer un passage ; programmer plusieurs fois le
  même programme par référence.
- Placer uniquement des programmes dans le calendrier. Le programme détermine
  son layout, ses slots et les scènes ou programmes qu'ils accueillent.
- Proposer les deux modes de durée : créneau avec début et fin propres, ou
  début et fin calculée depuis la durée du programme.
- À l'échéance suivante, changer à l'heure prévue et interrompre le programme
  courant concerné. L'attente d'une fin naturelle ne repousse pas cette
  échéance calendaire.
- Récurrences à l'heure, au jour, à la semaine, toutes les deux semaines et
  au mois. « Bimensuelle » dans la demande désigne toutes les deux semaines,
  et non deux fois par mois.
- Pouvoir neutraliser un passage issu d'une récurrence sans supprimer la
  récurrence elle-même. Ce passage neutralisé permet de placer un autre
  programme dans le créneau, décrit comme un placement « au-dessus ».
- Un calendrier peut couvrir l'année ou une période plus courte, notamment
  une saison.
- Copier-coller une suite de passages consécutifs, par exemple de 9 h–11 h
  vers 15 h–17 h.
- Diffuser le programme interlude dans les plages calendaires sans programme
  affecté. Le scheduler ne décide pas de ce qui remplit les slots libres
  d'un programme en cours.
- Définir le comportement demandé hors des plages de diffusion, notamment
  allumage, extinction et veille selon les capacités du support. Le raccord
  événementiel entre dans la discussion ; l'exécution matérielle est exclue
  de cette étape.

La seconde est une précision d'édition et de décision calendaire. Elle
n'implique pas un flux d'événements CodPlay émis chaque seconde. Les échéances
de diffusion sont distinctes des animations et du temps logique des scènes.

### Application des modifications

Les modifications de programme s'appliquent immédiatement par défaut, avec
possibilité de choisir une autre modalité d'application. La règle métier
et sa présentation dans l'interface sont deux décisions distinctes ; cette
orientation ne fixe pas à elle seule un contrôle visible particulier.
Le raccord à la diffusion effective sera traité dans la tranche de lecture.

### Créateur de programmes demandé

Un programme reçoit un titre et une description. Il associe une scène layout
à des scènes ou programmes affectés à ses slots. Un programme peut donc être
inséré dans un slot d'un autre programme ; le contrat d'imbrication reste à
préciser.

Sa durée propre peut être saisie ou calculée depuis les règles de son
contenu. Elle reste distincte de la durée du créneau affecté dans le
scheduler. Lorsque la suite de scènes finit avant la durée prévue, l'auteur
choisit une règle dans le programme : recommencer la suite, maintenir le
dernier affichage ou enchaîner un autre contenu. Le remplissage n'est donc
pas imposé par le scheduler.

Le programme possède l'organisation de ses slots, leur enchaînement et leur
comportement lorsqu'ils sont libres, ainsi que la logique d'attente et de
filtrage. Deux programmes ne peuvent pas occuper simultanément le même slot ;
ils peuvent jouer en parallèle dans des slots
différents du programme parent. Cette règle appartient à la composition du
programme. Le scheduler ne programme pas directement les slots et n'affecte
pas directement de scènes. Plusieurs slots sur un même écran ne
constituent pas une multi-diffusion sur plusieurs écrans.

Le layout désigne son slot principal. Celui-ci fournit la référence à suivre
et sur laquelle s'aligner ; le programme décrit cet alignement et le partage
du temps entre les scènes par ses propres règles. Le mot
« principal » désigne un rôle de composition ; aucune signification
opératoire n'est attribuée au seul nom d'un slot.

L'interface présente les scènes et programmes disponibles ainsi que le layout
choisi, et une zone regroupant les éléments sélectionnés. L'auteur affecte
une ou plusieurs règles à cette sélection : suite, répétition, alternance,
tirage pseudo-aléatoire, délai ou synchronisation.

| Règle exprimée | Rôle dans le programme |
| --- | --- |
| Auto | Une scène commence à la fin de la précédente, dans l'enchaînement décrit par le programme. |
| Sync | Attendre les signaux de fin de déroulé des scènes des slots choisis avant la suite. Le programme décrit leur comportement pendant l'attente ; une scène peut poursuivre sa propre boucle d'attente. |
| Délai | Changer après une durée saisie en minutes. |
| Délai automatique | Diviser la durée du programme par le nombre de scènes ; le programme décrit l'application de cette règle et l'alignement sur le slot principal désigné par le layout. |
| Répétition | Lire une scène X fois selon la règle affectée à la sélection. |
| Alternance | Alterner une suite de scènes selon l'organisation du programme. |
| Tirage pseudo-aléatoire | Tirer les scènes selon la règle du programme, avec le seed prévu par les règles du projet. |

L'auteur affecte une ou plusieurs règles à sa sélection. Le programme décrit
les éléments concernés et leurs conditions d'enchaînement. Attente, filtrage
et alignement relèvent de cette logique ; le scheduler ne les réinterprète pas.

### Édition visuelle des programmes — rendre la logique lisible

La difficulté centrale identifiée est l'interface : les règles composent une
logique proche d'un programme, mais l'auteur doit pouvoir l'organiser et la
comprendre visuellement. Ajouter des blocs et des flèches ne suffit pas si
leur manipulation exige de connaître des structures de programmation.
La représentation et les gestes sont donc à qualifier avant de figer le
format documentaire détaillé ou l'API d'édition.

Le SVG est une possibilité retenue pour l'étude, notamment pour les blocs
et les relations fléchées. Aucune bibliothèque, aucun moteur de diagrammes
et aucun choix de rendu tout-SVG ne sont arrêtés. Cette piste concerne la
surface auteur ; elle n'impose pas un nouveau composant narratif CodPlay.

Les pistes suivantes servent à préparer la maquette, sans fixer sa notation :

- Les scènes et programmes sont des cartes identifiables par leur titre et
  leur aperçu. Le layout et ses slots restent visibles pour comprendre où
  le contenu sera diffusé ; le slot principal désigné par le layout est
  reconnaissable sans dépendre de son nom.
- Une suite simple se lit dans un sens constant. Les flèches rendent les
  relations utiles explicites, avec un sens formulable en langage courant,
  par exemple « à la fin, passer à… ». Le dessin ne demande pas de relier
  des ports techniques ou de saisir des noms d'événements.
- Une règle peut s'appliquer à une sélection ou à un groupe visible.
  Une répétition pourrait être une enveloppe « Répéter 3 fois » autour des
  éléments concernés, plutôt qu'une flèche revenant au début au milieu des
  autres liens. Alternance ou tirage doivent aussi montrer leur périmètre.
- Plusieurs slots peuvent être présentés en pistes ou zones parallèles.
  Une synchronisation montre quels éléments attendent quelles fins ; elle
  ne doit pas être confondue avec une simple succession ou avec la grille
  d'horaires du scheduler.
- Les réglages détaillés accompagnent la sélection. Le regroupement et une
  vue synthétique doivent éviter d'afficher simultanément toutes les
  relations d'un programme imbriqué. Le besoin de déplier un groupe ou
  d'ouvrir un sous-programme sera évalué dans la maquette.
- La durée saisie et la fin signalée par une scène restent distinguées.
  Une représentation proportionnelle au temps ne doit pas donner une durée
  certaine à un déroulé dont la fin n'est connue qu'en lecture.

Exemple visuel à explorer : « Accueil », puis un groupe « Actualités →
Offres » portant la règle « Répéter 3 fois ». L'auteur doit identifier
immédiatement les deux éléments répétés, leur ordre et la sortie du groupe.
Un second exemple utilise le principal et un bandeau ; leur liaison indique
les fins attendues avant le passage suivant, sans obliger l'auteur à déduire
la synchronisation de la position des blocs à l'écran.

La maquette doit permettre de lire le programme existant autant que de le
construire : sélectionner, affecter à un slot, ordonner, regrouper, appliquer
une règle, modifier une relation et comprendre sa portée. Les commandes
doivent rester accessibles au clavier et suivre les conventions d'édition
Elcé. La cohérence de la représentation, l'absence de relations ambiguës
et le nombre de gestes sont des critères de choix avant le détail du SVG.

Le modèle auteur possède la logique. Le diagramme la présente et les gestes
proposent des changements au circuit documentaire existant ; le DOM/SVG et
les positions graphiques ne deviennent pas un deuxième modèle d'exécution.
La lecture effective reste dans la tranche ultérieure prévue, sans moteur
de lecture local ajouté à l'éditeur pour faire fonctionner sa maquette.

### Projets publics de référence pour l'éditeur de programmes

La recherche porte sur des interfaces qui rendent visibles des suites,
groupes, répétitions et relations temporelles. Les références suivantes
servent à choisir une notation et des gestes à maquetter. Les capacités
documentées d'un projet ne prouvent ni sa simplicité pour nos auteurs, ni
son intégration au circuit documentaire Elcé. Aucune bibliothèque n'est
retenue par cette comparaison.

| Référence et accès public | Apport documenté | Piste pour les programmes et limite |
| --- | --- | --- |
| [Sequential Workflow Designer](https://github.com/nocode-js/sequential-workflow-designer), [démo](https://nocode-js.github.io/sequential-workflow-designer/examples/live-testing.html), [composants](https://nocode-js.com/docs/category/step-components) | Éditeur TypeScript avec rendu SVG, indépendant d'un moteur d'exécution ; tâches, conteneurs et branches. Le composant `Container` contient une séquence et sert notamment à représenter des boucles. | Premier candidat à examiner pour une suite de cartes et une règle portée par un groupe. Les libellés et réglages métier sont à construire ; les capacités de synchronisation entre slots ne sont pas fournies par la seule forme du diagramme. |
| [ossia score](https://ossia.io/), [déclenchements](https://ossia.io/score-docs/quick-start/breaking-the-timeline.html), [enchaînements non linéaires](https://ossia.io/score-docs/quick-start/non-linear-timelines.html), [boucles](https://ossia.io/score-docs/common-practices/1-looping.html) | Séquenceur audiovisuel interactif : des parties attendent un déclenchement ; le scénario mêle éléments temporels et connexions, avec sous-scénarios et boucles. | Référence pour représenter attente, durée et relations entre contenus parallèles lorsque le temps seul ne décide pas la suite. Son vocabulaire de spectacle et sa richesse sont à simplifier pour l'auteur Elcé ; aucun moteur ossia n'est proposé en remplacement de Sighty/CodPlay. |
| [Xibo, éditeur de playlists](https://docs.xibosignage.com/layouts/layouts_editor_playlists), [code du CMS](https://github.com/xibosignage/xibo-cms) | Playlists éditées dans un layout ou réutilisées indépendamment, ordre des médias, durée, limites de quantité et choix aléatoire par cycle. | Référence métier pour l'association layout/contenus et une édition visuelle depuis les zones d'écran. La synchronisation documentée sur cette page concerne des playlists sur plusieurs layouts d'un événement synchronisé ; elle ne prouve pas notre attente de fins entre slots. |
| [Blockly](https://docs.blockly.com/guides/get-started/what-is-blockly/) | Bibliothèque d'édition par blocs emboîtés, conçue pour représenter des constructions comme les boucles sans saisie de syntaxe. | Étudier la lisibilité de la portée d'un groupe « Répéter 3 fois » et les contraintes de connexion. Les blocs proposés à l'auteur devraient rester des contenus et règles de diffusion ; la bibliothèque ne décide pas de leur synchronisation. |
| [React Flow, groupes et sous-flux](https://reactflow.dev/examples/grouping/sub-flows), [cartes personnalisées](https://reactflow.dev/learn/customization/custom-nodes), [liens SVG](https://reactflow.dev/learn/customization/custom-edges) | Composants de nœuds personnalisables, relations et regroupements ; les chemins des liens sont rendus en SVG. | Candidat si la maquette demande des cartes riches et une disposition plus libre entre slots. La notation, les liens autorisés et la simplification pour l'auteur restent à concevoir ; le diagramme ne fournit pas les règles du programme. |

Une référence complémentaire est
[Node-RED et ses sous-flux](https://nodered.org/docs/user-guide/editor/workspace/subflows) :
une sélection de nœuds peut être remplacée par un bloc réutilisable dont on
ouvre le contenu dans un espace distinct. Ce principe peut aider à présenter
un sous-programme sans afficher tous ses détails. Le modèle de messages et
les outils de programmation Node-RED ne sont pas un modèle de diffusion à
reprendre dans Elcé.

#### Points de choix avant une éventuelle reprise technique

Le cœur de Sequential Workflow Designer est sous
[licence MIT](https://github.com/nocode-js/sequential-workflow-designer/blob/main/LICENSE).
Son catalogue distingue des fonctions Pro, notamment le repli de régions,
le copier-coller et certaines personnalisations. Le
[Launch Pad](https://nocode-js.com/docs/sequential-workflow-designer/step-components/launch-pad)
est présenté comme une disposition permettant de représenter des éléments
indépendants ou simultanés, dans la version standard ; cela ne certifie pas
un moteur parallèle ou une barrière de synchronisation conforme au programme.
Le [Container](https://nocode-js.com/docs/sequential-workflow-designer/step-components/container)
offre une séquence contenue ; une partie de sa personnalisation est Pro.
La qualification doit porter sur les gestes réellement accessibles dans la
version et la licence étudiées, pas sur l'ensemble des captures commerciales.

React Flow possède aussi un
[cœur MIT](https://github.com/xyflow/xyflow/blob/main/LICENSE)
et un catalogue d'exemples qui comprend des offres Pro. Ne pas déduire que
tous les exemples avancés sont livrés dans le cœur. La possibilité de
personnaliser les cartes et liens est utile, mais augmente les choix de
conception si le graphe est trop libre. Xibo reste ici une référence de
produit ; le CMS consulté est sous AGPL-3.0 et n'est pas une dépendance
proposée pour notre éditeur.

Une reprise de bibliothèque graphique conserverait un seul document et un
seul historique Elcé. Les gestes doivent être traduits en commandes validées,
avec Annuler/Rétablir par le circuit propriétaire. Les modèles JSON et les
historiques internes des outils ne deviennent pas une seconde source de
vérité. Sequential Workflow Designer est documenté comme indépendant de
son moteur compagnon ; aucune démonstration d'exécution amont ne justifie
d'introduire ce moteur dans la lecture des programmes.

#### Piste de comparaison pour les maquettes

L'ordre proposé pour examiner les références est : Sequential Workflow
Designer pour la composition structurée, ossia score pour les relations
temporelles, puis Xibo pour leur traduction en gestes de signalétique.
Blockly et React Flow fournissent des pistes complémentaires de notation
et de réalisation graphique.

Comparer deux familles sur les mêmes contenus :

- Une composition guidée de cartes, groupes et règles visibles, inspirée
  des conteneurs de Sequential Workflow Designer et de Blockly.
- Une disposition de contenus par slots, avec quelques liens explicites
  d'attente et d'enchaînement, éclairée par ossia score et les cartes/liens
  personnalisables de React Flow.

Les scénarios de comparaison reprennent les besoins déjà établis : une
suite avec un groupe répété ; deux slots dont le programme attend les fins
à 20 et 35 secondes ; un sous-programme dans un slot de layout. Évaluer la
lecture sans explication préalable, la modification du périmètre d'une règle,
les erreurs possibles de connexion et la lisibilité à plusieurs niveaux.
Le résultat doit permettre de choisir une piste d'interface avant de choisir
une bibliothèque ou de figer une représentation de stockage.

### Fin du déroulé et attente dans la scène

La scène signale elle-même la fin de son déroulé. Cette fin fonctionnelle
est distincte de son démontage : la scène peut rester montée, continuer à
s'afficher et entrer dans une boucle d'attente qu'elle définit elle-même.
Le programme reçoit son signal de fin et applique ses règles d'enchaînement
ou de synchronisation. Recevoir ce signal n'impose ni de figer l'affichage,
ni de retirer la scène.

La boucle d'attente n'est pas une nouvelle lecture du déroulé principal.
Elle ne constitue pas une répétition demandée par le programme. Ce terme
décrit un comportement interne de la scène ; il n'introduit aucun émetteur
`loop` ni flux continu d'événements.

Le signal établit une fin constatée pendant la lecture. Il ne suffit pas à
connaître la durée avant lecture : les données nécessaires au calcul d'une
durée de programme restent à préciser pour les contenus concernés.

### Premier exemple à résoudre ensemble

Le programme « Accueil » utilise deux slots : `main` présente des scènes
d'information ; `side` présente une suite d'images. Il est placé à 9 h, puis
réutilisé plus tard. Un autre programme doit commencer à 10 h. Les plages
libres reçoivent l'interlude.

Cet exemple permet de distinguer la durée du programme, la durée de son
passage dans le calendrier et les fins réelles des scènes. L'utilisateur a
retenu les deux modes de durée et le changement à l'heure prévue. Le
calendrier reçoit le programme « Accueil ». À l'intérieur de ce programme,
ses slots peuvent accueillir des programmes simultanés différents, avec
refus de deux occupations concurrentes du même slot. Leur éventuelle vacance
est gérée par le programme. Le scheduler ne compose pas ces occupations.

Pour une suite de quatre minutes dans un programme de dix minutes, les
trois règles de remplissage retenues sont des choix auteur : recommencer
la suite, maintenir son dernier affichage ou enchaîner un autre contenu.
Leur application doit respecter la durée du programme et l'échéance
calendaire qui peut l'interrompre.

### Synchronisation et répartition du temps décrites dans le programme

Deux scènes démarrent ensemble dans les slots A et B ; leurs fins arrivent
à 20 et 35 secondes. Le mode sync attend les fins des slots choisis par
l'auteur avant d'enchaîner. À 20 secondes, la scène A signale sa fin de
déroulé ; le programme décrit ce qui se passe pendant l'attente. Si cette
organisation la conserve montée, elle peut poursuivre sa propre boucle
d'attente.
À 35 secondes, la scène B signale sa fin et le groupe peut enchaîner selon
les règles du programme. La scène A n'a pas à être figée pendant ces quinze
secondes et n'a pas à recommencer son déroulé principal. Ce cas concerne
l'attente d'un groupe synchronisé, distincte du remplissage de la durée
totale du programme.

Pour le délai automatique, un programme de dix minutes contient deux scènes
successives dans le slot principal et cinq dans le bandeau. Le slot principal
est désigné par le layout ; le bandeau le suit selon les règles du programme.
Le programme décrit les enchaînements, les attentes, le filtrage et les bornes
d'alignement. Le nombre total de scènes réparties dans les différents slots
ne justifie pas de remplacer cette logique par une règle globale du scheduler.

Les choix de composition, d'attente, de filtrage et d'alignement sont portés
par le programme. Ils ne sont plus des questions de politique globale à
soumettre pour le scheduler. Les sujets distincts encore à examiner sont :

- la distinction entre plage libre avec interlude et période de fermeture ;
- les autres gestes sur les séries récurrentes, leurs dates de validité
  et le passage de minuit ; la neutralisation d'un passage est retenue ;
- la copie d'une plage : conservation des intervalles libres, programmes
  partiellement inclus, références conservées et récurrences éventuellement
  copiées ;
- le contexte horaire du premier écran, dans la continuité de l'heure locale
  du récepteur déjà étudiée ; les changements d'heure restent à décider ;
- pour la tranche de lecture, le démarrage tardif et la reprise après arrêt,
  ainsi que les autres modalités d'application proposées en complément de
  la mise à jour immédiate par défaut ;
- le contenu de la bibliothèque initiale : scènes construites dans Elcé,
  scènes CodPlay importées, layouts disponibles et édition de leurs slots ;
- les événements d'état du diffuseur, les demandes adressées au support et
  leur éventuelle confirmation : une demande d'extinction ne prouve pas
  l'extinction physique.

### Appuis vérifiés et frontières de conception

Le [mod Quiz Hunt](../../specs/quiz-hunt-mod-spec.md) montre un document et des
compositions propres au mod utilisant les ressources partagées. L'édition du
calendrier et des programmes devra rejoindre le circuit documentaire et son
[historique commun](../../specs/document-history-spec.md), avec un geste
cohérent pour une copie ou un déplacement ; aucun historique parallèle n'est
nécessaire au seul motif d'introduire le scheduler.

Le [contrat Sighty](../../../sighty/specs/authoring-library-spec.md) possède
déjà les graphes de vues, leur composition par slots, les actions et guards,
et l'admission des intentions par `runtime.dispatch`. Le
[contrat du slot CodPlay](../../../codplay/specs/slot-component-spec.md)
possède le montage d'une scène enfant, sans décider de sa lecture ni de sa
durée. Ce sont les circuits à prolonger, pas un scheduler calendaire ou un
créateur de programmes déjà disponibles.

La fin fonctionnelle `scene:end` laisse Sighty décider de la suite ;
`sequence:end` termine la lecture technique du player. La synchronisation
des slots du programme devra définir quelles fins elle attend et comment
elle les raccorde au scénario existant. Le plan viendra après ces choix ;
aucune extension du core CodPlay n'est déduite de cette discussion.

## Exploration initiale et pistes ultérieures

Cette étude prolonge l’[intention DGS](2026-10-20-dgs-mod-study.md) et la
[composition des modules](2026-10-20-mod-composition-internal-api-study.md).
L’utilisateur distingue un module `sequence`, qui représente des boucles de
lecture locales et leurs règles d’enchaînement, et un module `scheduler`, qui
en donne une projection temporelle. Cette distinction constitue le point de
départ. Les structures et responsabilités proposées ci-dessous servent à la
discussion ; elles ne définissent aucune API disponible ni format persistant.
Les décisions ouvertes sont centralisées dans
le [plan des mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#sequence-et-scheduler).

## Deux questions métier différentes

`sequence` répondrait à « que présenter ensuite, selon quelles règles
locales ? ». Une séquence décrit des passages successifs ou des scènes
présentées en parallèle dans plusieurs zones, leurs répétitions et leurs
conditions de fin. Son origine temporelle est locale :
le début de son exécution. Elle n’a pas besoin de connaître lundi ou 8 h 45
pour décrire page 1, trois lectures du chapitre A, puis page 2.

`scheduler` répondrait à « quelle séquence doit être diffusée à cet instant
du calendrier ? ». Il référence les séquences, applique les programmations
et détermine leurs occurrences datées. Pour construire une grille, il utilise
les informations temporelles calculées par `sequence`. Il ne recalcule pas
son ordre interne ou ses règles de répétition.

L’autonomie de `sequence` vis-à-vis du calendrier est une piste de composition :
un mod pourrait demander son exécution sans sélectionner `scheduler`. Cela
n’impose ni de l’ajouter à Learning, ni d’en faire un module universel dès le
premier usage DGS. L’utilisateur demande explicitement de laisser cette
question ouverte dans l’étude. Son classement initial peut rester près de DGS.

| Élément | Responsabilité proposée | Données consommées |
| --- | --- | --- |
| Contenus Elcé | Posséder pages, chapitres, BDC et leurs builders. | Données éditoriales canoniques. |
| `sequence` | Décrire les règles locales et contribuer à leur génération en scénario ; fournir les calculs métier nécessaires aux actions et guards. | Références de contenu, composition par zones et réglages de passage. |
| `scheduler` | Projeter les programmations dans le calendrier et déterminer la diffusion attendue. | Références de séquence, calendrier et projections locales. |
| Assemblage DGS | Produire le scénario, les scènes, actions et guards ; raccorder le calendrier au circuit de lecture existant. | Document auteur, contributions des builders, résultats métier et contexte de diffusion. |
| Sighty / CodPlay | Conduire le parcours puis exécuter les scènes et médias. | Scénario et scènes construits par les contributions retenues. |

L’assemblage DGS est un rôle de composition, pas nécessairement un troisième
module. Il évite que deux dispositifs décident séparément du passage suivant.
Le scheduler choisit la séquence autorisée par le calendrier. Les règles
locales de cette séquence sont traduites par Elcé dans le scénario produit ;
Sighty conduit ensuite son parcours.

## Des classes métier, un état possédé par le circuit appelant

Une classe TypeScript `Sequence` pourrait porter les règles locales pour
vérifier les données auteur, préparer leur génération et calculer une projection
de durée. Les actions et guards du scénario produit appelleraient les classes
métier pour les calculs nécessaires en lecture, notamment la fin collective.
Une classe `Schedule` pourrait porter les règles calendaires : développer
les récurrences sur un intervalle borné et déterminer les occurrences attendues.
Ces noms illustrent des responsabilités ; leurs méthodes restent à définir.

Les mêmes classes fourniraient les calculs au calendrier auteur, au service
de diffusion et au lecteur pour les parties exécutées localement.
L’interface afficherait leur résultat et transmettrait ses intentions par les
façades. Une machine éventuelle organiserait les attentes et les transitions,
en déléguant les règles à ces classes. Aucun acteur supplémentaire n’est
justifié par la seule existence de deux modules.

À l’édition, le document, la file des commandes et l’historique conservent leur
propriétaire commun. À la lecture, l’orientation déjà demandée place le
pilotage de l’état au niveau du scénario Sighty, avec les modules appelés par
ses actions. Une classe métier peut recevoir un état et produire une décision
sans devenir propriétaire d’un second état mutable du lecteur.

## Document auteur et production du scénario

Comme pour les autres projets Elcé, le mod décrit une intention éditoriale
enregistrable, puis Elcé la transforme pour produire la lecture.

| Niveau | Contenu et rôle |
| --- | --- |
| Document auteur persisté | Contenus, séquences, calendriers et réglages modifiables par l’auteur ; source de référence pour l’édition et la sauvegarde en BDD. |
| Production de lecture | Scénario Sighty avec ses vues, scènes CodPlay, données de lecture, actions et guards, générés depuis ce document par les builders et contributions du mod. |

La forme documentaire et sa projection vers les tables doivent être définies
pour la persistance. La forme des objets attendus par Sighty appartient à la
génération. Le [contrat actuel des projets](../../specs/project-api-spec.md)
distingue déjà le document structuré échangé et sa projection relationnelle ;
le format DGS reste à définir.

### Données auteur de sequence

Les informations ci-dessous décrivent ce que l’auteur doit pouvoir conserver.
Elles ne fixent ni noms de champs, ni tables, ni format de scénario Sighty.

| Information éditoriale | Sens |
| --- | --- |
| Identité et nom | Retrouver et référencer la séquence éditée. |
| Passages successifs | Ordre et identité des emplois de contenus dans le cas linéaire. |
| Contenu d’un passage | Référence à une page ou un chapitre existant. |
| Composition par zones | Layout, contenus affectés aux zones et règle de fin collective ; les références de scènes produites seront établies à la génération. |
| Répétition d’un passage | Nombre total de lectures ; 3 signifie trois lectures, pas une lecture plus trois reprises. |
| Condition de fin | Durée imposée ou fin de présentation fournie par le contenu selon un contrat à établir ; attente de toutes les fins pour le cas par zones. |
| Répétition de la séquence | Une lecture, un nombre fini de cycles, ou une boucle jusqu’à une interruption extérieure. |

Les deux niveaux de répétition ont des effets différents : répéter le
chapitre A trois fois produit A, A, A dans un cycle ; répéter la séquence
reprend aussi les autres entrées. Leur vocabulaire devra être lisible dans
l’interface et dans les données.

Exemple d’intention auteur, sans forme de stockage imposée : la séquence
« Informations du matin » contient les passages suivants et joue trois cycles.

| Ordre | Contenu référencé | Durée par lecture | Nombre de lectures |
| --- | --- | --- | --- |
| 1 | Page Accueil | 30 secondes | 1 |
| 2 | Page Informations | 45 secondes | 2 |

Le budget nominal d’un cycle serait ici 120 secondes, et celui des trois
cycles 360 secondes. Ces sommes n’incluent aucun coût implicite de chargement
ou de transition. Le point de départ du décompte et le traitement de ces coûts
doivent être décidés avant de promettre six minutes de diffusion effective.

Un passage est distinct du contenu : deux entrées peuvent référencer la même
page avec des durées différentes, sans la copier ni changer sa durée propre.
Une référence à un chapitre ne fixe pas encore la façon dont ses pages
consomment un budget : durée par page, durée du chapitre ou fin naturelle
demandent une décision explicite. L’exemple initial « chapitre A trois fois »
doit rester représentable sans deviner cette répartition.

### Fin collective dans un layout à plusieurs zones

L’utilisateur rappelle un cas déjà décrit dans la
[première intention Sighty, §6.1](../../../sighty/notes/2026-07-28-sighty-premiere-intention.md#61-affichage-dynamique-digital-signage) :
un layout est divisé en zones, chacune présentant une scène. Dans ce cas,
la fin naturelle de la séquence attend le signal de fin de chacune des scènes.
La séquence doit donc aussi représenter cette composition parallèle ; le
modèle linéaire illustré plus haut ne suffit pas à couvrir les usages exprimés.

**Fin de séquence = fin scène A ET fin scène B ET fin scène C.**

La « somme des fins » signifie ici que toutes les fins attendues sont réunies.
Si les scènes démarrent ensemble et signalent leur fin à 10, 20 et 30 secondes,
la séquence se termine à 30 secondes. Une première fin ne suffit pas ; le
dernier signal attendu satisfait la condition collective.

Le document auteur conserve la composition par zones et sa règle de fin.
La génération produit les scènes, vues, actions et guards nécessaires à cette
règle. À la lecture, les actions et guards concernés appelleraient la classe
métier de `sequence` pour évaluer les fins reçues pour cette exécution.
Une même occurrence terminée ne compte qu’une fois ; une fin d’un cycle
précédent ne satisfait pas le cycle suivant. Ces faits sont un état de lecture,
distinct du document auteur ; leur pilotage reste au niveau du scénario Sighty.

Le [contrat Sighty actuel](../../../sighty/specs/authoring-library-spec.md)
permet de faire remonter `scene:end` sans quitter la vue ni libérer la scène.
Les actions du scénario produit seraient raccordées à ces signaux ; lorsqu’un
changement de vue doit suivre la fin collective, il passe par l’admission
Sighty existante. Le signal CodPlay `sequence:end` termine, lui, la séquence
technique d’un player : il ne désigne pas cette condition collective DGS.
Le raccord exact et la forme des données restent à qualifier, sans nouvelle
API ni agrégation automatique supposée dans Sighty.

La fin réelle est constatée sur le récepteur. Le serveur peut en prévoir
l’heure si les durées et départs des scènes sont connus ; sinon la projection
conserve une fin inconnue. Si une décision serveur doit dépendre de cette
fin constatée, un retour du récepteur sera nécessaire ; son protocole reste
à définir. Le scheduler garde la responsabilité de la programmation calendaire.

Ce cas concerne les zones d’un même layout sur un récepteur. Il ne suppose
aucune synchronisation entre les récepteurs associés à des schedulers distincts.

### Données auteur de scheduler

| Donnée candidate | Sens |
| --- | --- |
| Identité du calendrier | Programmation réutilisable, interprétée dans le contexte local du récepteur. |
| Identité de la programmation | Distinguer plusieurs emplois d’une même séquence. |
| Référence de séquence | Séquence à diffuser, conservée dans son propriétaire. |
| Règle de récurrence | Jours de semaine ou intervalle de jours ancré sur une date, selon les formes retenues. |
| Heure locale de début | Par exemple 8 h 45 chez le récepteur ; son fuseau effectif est fourni par le contexte de diffusion. |
| Période de validité | Bornes de dates éventuelles de cette programmation. |
| Borne de fin éventuelle | Fenêtre de diffusion à distinguer de la durée propre de la séquence. |
| Références d’interlude | Contenu ou séquence à présenter dans les intervalles concernés, selon la politique retenue. |

Le calendrier référencerait « Informations du matin » à 8 h 45, 9 h 30 et 11 h 20.
Ces trois emplois ne créeraient ni trois séquences auteur ni trois copies
des pages. Le scheduler produirait des occurrences datées à partir des règles.
Une projection sur la journée ou la semaine visible suffit ; il n’a pas à
stocker une liste infinie d’occurrences.

Une alternance « un jour sur deux » demande un ancrage de date et ne se réduit
pas à une liste de jours de semaine. Plusieurs calendriers n’indiquent pas
encore lequel est actif. Les jours et dates de programmation sont également
interprétés localement. Le contexte du récepteur permet de convertir ces
horaires en occurrences datées.

### Génération Elcé pour la lecture

Les builders et contributions du mod transforment les données auteur en
scénario Sighty et scènes CodPlay, avec les actions et guards associés.
Le [builder Diapo actuel](../../specs/diapo-scene-builder-spec.md#fin-fonctionnelle-de-diapo)
illustre déjà cette chaîne : il produit la scène et son signal public ;
`buildScenario` raccorde ce signal à une action Sighty.

| Intention auteur DGS | Production à étudier |
| --- | --- |
| Références de pages et chapitres | Scènes construites par les builders compatibles et références dans les vues Sighty. |
| Layout et contenus par zones | Scènes et surfaces CodPlay, avec leur composition dans les vues et slots Sighty. |
| Ordre et répétitions | Graphe de vues, routes et actions correspondant aux règles retenues. |
| Durée imposée ou fin collective | Signaux, actions et guards appelant les classes métier ; leur raccord exact reste à qualifier. |

`sequence` fournit donc des données auteur et des contributions à cette
génération. Son modèle persisté ne constitue pas un programme que lirait un
interpréteur de séquences distinct de Sighty. Les paramètres utiles en lecture
peuvent être projetés dans le scénario et transmis aux classes par ses actions.
Les builders doivent établir les références entre contenus auteur et éléments
produits ; leur correspondance exacte reste à définir.

Preview et player exporté doivent partager cette génération et les mêmes
règles de lecture. La [forme auteur Sighty](../../../sighty/specs/authoring-library-spec.md#33-scénario-et-fonctions-dauteur)
peut contenir des fonctions ; leur conditionnement pour l’export est une
frontière distincte, qui ne fixe pas le schéma BDD du projet Elcé.

### Projections calculées et état de diffusion

Les projections seraient des résultats dérivés : passage local prévu,
durée connue ou non, occurrence datée et intervalle concerné. Elles ne
deviendraient pas une deuxième source éditoriale à synchroniser avec le document.
Les productions de lecture peuvent être publiées ou conservées comme artefacts
dérivés ; leur éventuel stockage ne les confond pas avec le document éditable.

La connaissance temporelle mérite une représentation explicite : durée finie
calculable, durée non encore connue, ou boucle sans fin propre. Une durée
inconnue ne vaut ni zéro ni une durée infinie. Une borne de calendrier peut
limiter une boucle sans en changer les règles internes.

L’état courant pourrait identifier la programmation et son occurrence,
l’exécution de séquence, le passage, les compteurs de répétition, les fins de
scènes déjà reçues dans une composition par zones et les faits temporels utiles
à sa reprise. Il doit distinguer présentation demandée et
présentation admise. Les handles de scènes, abonnements et minuteurs sont
des ressources d’exécution, pas des données auteur ni des valeurs durables.
La projection sérialisable et son besoin de conservation restent à décider.

## Projection serveur selon l’heure locale du récepteur

Le principe retenu est une programmation en heure locale : la même séquence
prévue à 8 h 45 est attendue à 8 h 45 à Tokyo et à 8 h 45 à New York, pour le
même jour local et la même édition du programme. Le fuseau effectif appartient
au contexte de diffusion ; le calendrier conserve ses horaires locaux.

La variante étudiée place le calcul calendaire sur le serveur. Le récepteur
fournit son identité et son fuseau, ou son identité permet de retrouver ce
contexte. Le serveur combine son horloge et ce fuseau pour déterminer la date
et l’heure locales, sélectionner le calendrier applicable et calculer les
occurrences à exécuter.

La réponse envisagée est une description de diffusion adaptée au récepteur :

| Donnée | Rôle |
| --- | --- |
| Version du programme | Identifier l’édition publiée utilisée. |
| Identité des occurrences | Distinguer chaque diffusion et conserver une exécution lors d’une actualisation qui renvoie la même occurrence. |
| Productions de lecture | Désigner les scénarios, scènes, actions et guards produits par Elcé pour les séquences à diffuser, avec les ressources ou leurs références. |
| Échéances datées | Déterminer les débuts et changements programmés pour ce contexte local. |
| Ressources | Permettre le chargement des scènes et médias nécessaires. |
| Prochaine actualisation | Renouveler la projection servie au récepteur. |

Les échéances peuvent être transportées en UTC après résolution dans le fuseau
du récepteur : elles sont alors propres à cette exécution locale. Le serveur
peut fournir plusieurs prochaines diffusions pour permettre leur préparation.
Le récepteur charge les productions Elcé et les exécute par Sighty/CodPlay.
La répartition des séquences entre scénarios, leur activation et le transport
de ces productions restent à qualifier ; le nom des champs et le protocole
de cet échange ne sont pas fixés.

## Diffusion uniforme et diffusion par destination

Dans une même salle, deux récepteurs peuvent présenter des parties distinctes
d’un même propos, issues du même projet DGS. Le projet permet de déterminer
l’association d’un système de diffusion à l’adresse d’un scheduler distinct.
Le réseau local transporte alors des diffusions adaptées à ces associations.

| Usage étudié | Récepteur | Scheduler associé dans le projet | Présentation |
| --- | --- | --- | --- |
| Diffusion uniforme | A et B | Scheduler commun | Même programmation dans leur contexte local. |
| Diffusion par destination | A | Scheduler accueil | Séquences de présentation générale. |
| Diffusion par destination | B | Scheduler détails | Séquences complémentaires du même projet. |

Les adresses désignent les programmations à consulter. Plusieurs adresses de
scheduler peuvent être servies par le même service, avec les mêmes classes
métier. Les pages, chapitres et séquences restent les contenus du projet et
sont référencés par ses différentes programmations.

Un module supplémentaire d’affectation des destinations est une piste à
étudier dans DGS. Son rôle serait de décrire l’association récepteur/adresse
de scheduler et de fournir ce contexte au service de diffusion et au lecteur.
Une association directe suffit à représenter l’exemple. L’intérêt d’ajouter
des destinations logiques, des groupes ou une gestion de parc reste à établir.
Les règles calendaires restent dans `scheduler`, et les enchaînements locaux
dans `sequence`.

La sélection serveur prend donc en compte le scheduler associé au récepteur,
en plus de son heure locale. Deux récepteurs ayant le même fuseau et la même
heure peuvent recevoir des séquences différentes. Cette association doit aussi
participer à l’identification de la réponse et de sa réutilisation en cache.

L’étude reste dans un même mod DGS. « Diffusion uniforme » et « diffusion par
destination » pourraient devenir deux mods ou offres distincts pour une raison
commerciale ; cette possibilité ne décide pas aujourd’hui d’un découpage
technique en deux mods. Le contrat d’affectation, l’emplacement de sa
configuration et le besoin éventuel de coordination entre écrans sont les
points ouverts SQ10/SQ11 du plan.

### Identifier les diffuseurs et leur affecter un programme

L’affectation suppose une interface de préparation et de suivi des diffuseurs.
L’utilisateur propose deux appareils nommés « TV entrée » et « TV salle »,
chacun associé à un programme. Ici, « programme » désigne la programmation
du projet accessible par le scheduler concerné ; la discussion n’introduit
pas un nouveau format éditorial. L’interface peut proposer son nom, puis
résoudre son adresse technique.

Le diffuseur désigne le lecteur qui se déclare : navigateur de la TV,
application installée ou boîtier relié à l’écran, selon le matériel retenu.
La procédure ci-dessous reste une proposition, sans API disponible.

| Information envisagée | Rôle |
| --- | --- |
| Identité technique conservée par le lecteur | Retrouver le diffuseur après redémarrage, indépendamment de son nom ou de son adresse IP. Le support de conservation dépendra du lecteur. |
| Nom lisible | Identifier l’usage ou le lieu : « TV entrée », « TV salle ». Un renommage conserve l’association au même diffuseur. |
| Programme affecté | Référence à la programmation du projet et au scheduler qui la sert. |
| État observé | Attente d’affectation, dernière présence, chargement, lecture confirmée ou erreur remontée. |

**Piste 1 — Configuration sur le diffuseur.** Au premier lancement, un
formulaire demande le service de diffusion s’il n’est pas préconfiguré,
le nom du diffuseur et le programme à consulter. Par exemple : « TV entrée »
et « Accueil ». Le lecteur conserve son identité et retrouve sa configuration
aux lancements suivants. Cette piste convient avec une télécommande, un
clavier ou un dispositif de configuration utilisable sur place. La procédure
concerne l’installation ; la diffusion destinée au public reste autonome.

**Piste 2 — Déclaration puis association depuis l’administration.** Le lecteur
démarre avec l’adresse d’un service connu et s’y déclare. Il apparaît parmi
les diffuseurs à associer et affiche un code sur la TV. Dans l’administration,
l’opérateur reconnaît cet écran par le code, lui donne le nom « TV entrée »
et choisit « Accueil ». Un QR code affiché sur la TV pourrait aussi ouvrir
la même fiche d’association sur le téléphone de l’opérateur. Le code sert
à l’association initiale ; l’identité durable du lecteur reste distincte.
Le lecteur récupère ensuite l’affectation et la diffusion correspondante.

Cette deuxième piste est la recommandation de départ de l’étude : elle permet
de préparer plusieurs écrans depuis l’administration avec peu de saisie sur
les TV. L’apparition automatique résulte de la déclaration du lecteur auprès
du service. Elle suppose donc son démarrage et la connaissance de ce service.

**Faisabilité entièrement web.** Le parcours de déclaration puis association
peut employer une page de lecture sur chaque diffuseur, une administration
web et un service HTTP. La page demande son association, affiche le code
fourni par le service, puis récupère le programme choisi par l’administrateur.
Des requêtes périodiques avec [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
suffisent pour ces échanges et les remontées de présence ; une connexion
permanente n’est pas une condition du parcours.

Un identifiant peut être conservé dans le stockage du navigateur, par exemple
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API),
pour retrouver l’association après fermeture et réouverture. Il identifie
l’installation du lecteur pour cette origine ; l’effacement des données
demanderait une réassociation. Il ne constitue pas une identité matérielle.

L’étude suppose le diffuseur configuré en mode kiosque pour ouvrir le lecteur
web dans les conditions nécessaires à une diffusion autonome. La configuration
de ce mode et de l’équipement relève de l’installation, hors du périmètre de
cette étude. Le parcours étudié commence avec le lecteur web lancé dans cet
environnement et connaissant l’adresse du service de diffusion.

**Piste 3 — Préparation avant installation.** L’opérateur crée à l’avance une
fiche « TV salle », lui attribue « Informations de la salle », puis obtient
un lien ou un code d’installation. Le lecteur utilise ce lien ou ce code à
son premier lancement pour s’associer à la fiche préparée. Cette variante
inverse l’ordre de la deuxième piste et convient lorsque les affectations
sont connues avant la mise en place des écrans.

Ces parcours peuvent employer le même circuit métier d’affectation. Dans la
variante centralisée proposée, le service conserve l’affectation de référence ;
le formulaire local et l’administration la modifient par ce circuit commun.
Le lecteur peut transmettre sa présence et la configuration effectivement
appliquée lors des échanges de diffusion déjà envisagés, sans imposer un
second canal de communication. Un programme demandé reste distinct du
programme dont le lecteur confirme le démarrage.

Le suivi pourrait afficher « connecté », « en lecture » et « dernière présence
à … ». La présence est déduite de contacts renouvelés et d’un délai à définir.
Ces informations décrivent le lecteur ; connaître l’allumage physique de la
TV demanderait une capacité matérielle supplémentaire, à qualifier si nécessaire.

**Découverte locale complémentaire.** Un agent ou service local pourrait
annoncer et rechercher les diffuseurs par DNS-SD/mDNS, qui prévoit la découverte
de services nommés sur le lien local
([RFC 6763, §1](https://www.rfc-editor.org/rfc/rfc6763.html#section-1)).
Cette option dépend du logiciel installé et du réseau. Une page web ordinaire
ne fournit pas directement les sockets UDP nécessaires à cette approche ;
Chrome expose ces capacités dans les Isolated Web Apps
([documentation Direct Sockets](https://developer.chrome.com/docs/iwa/direct-sockets)).
Le matériel et le conditionnement du lecteur doivent être connus avant de
retenir cette piste. La découverte du service de diffusion lui-même peut
également relever de l’installation.

Dans le découpage envisagé, les programmes restent des données du projet DGS ;
les présences et associations aux lecteurs relèveraient du contexte de
déploiement. Le module d’affectation porterait leurs règles dans des classes
TypeScript, appelées par les façades et machines concernées. Le scheduler
continuerait à résoudre le calendrier. L’administration peut être une surface
DGS de la même application et le service peut être hébergé avec celui de
diffusion. Cette piste ne décide ni d’une application supplémentaire ni des
utilisateurs et ACL, toujours hors de l’étude.

L’identité persistante, le parcours d’installation retenu, la conservation
des affectations, le suivi de présence et la réassociation après remplacement
ou réinitialisation restent les décisions ouvertes SQ10 du plan.

## Fonctionnement envisagé

1. L’auteur construit ses contenus avec les ressources compatibles, puis
   compose une séquence par références et la programme dans un calendrier.
   Ces données auteur sont conservées par le circuit documentaire.
2. Elcé génère le scénario Sighty, les scènes, actions et guards depuis ce
   document avec les builders et classes concernés. Les classes métier
   fournissent aussi les diagnostics et la projection de grille ; une durée
   impossible à calculer reste visible comme telle.
3. Dans la variante serveur, le récepteur consulte l’adresse de scheduler qui
   lui est associée. Le serveur résout cette programmation dans son contexte
   local et retourne les occurrences et ressources correspondantes.
4. Le lecteur prépare la composition produite et ses ressources. Le scénario
   Sighty conduit l’enchaînement local ; ses actions et guards appellent les
   classes métier nécessaires. L’état avance selon le résultat réellement
   admis ; une intention envoyée ne constitue pas une présentation réussie.
5. Les faits de lecture et échéances reçues repassent par ce circuit.
   L’actualisation renouvelle la projection de diffusion du même scheduler.

La façon de traduire une décision métier en route déclarée Sighty reste à
qualifier. Le contrat actuel exécute un handler après sa route éventuelle :
on ne peut pas supposer qu’il calcule d’abord une destination arbitraire.
L’admission refuse également une nouvelle transition pendant `changing`.
Le raccord devra traiter ces limites sans second routeur ou file locale
destinée à masquer les refus.

Quatre temporalités restent séparées : heure civile du calendrier, temps
écoulé de la séquence, temps logique d’une scène et temps des médias.
Un réveil de minuteur tardif ou un retour d’onglet suspendu ne prouve pas que
tous les passages intermédiaires ont été diffusés. La décision de rattraper,
repartir ou rejoindre la position attendue appartient au métier à arrêter.
Un temps local de séquence ne se convertit pas automatiquement en Seek CodPlay.

## Ajout dans un mod

L’assemblage du mod sélectionnerait les contributions nécessaires :

- données, validation et classes métier de chaque module ;
- façades et commandes raccordées au commit documentaire existant ;
- surfaces auteur, notamment liste de séquences et calendrier ;
- codec et projection persistante possédés par la composition du mod ;
- génération du scénario, des scènes, actions et guards, puis raccord au
  contexte de diffusion et gestion du cycle de vie.

La définition logicielle du mod exprime les capacités choisies ; les séquences
et calendriers d’un projet sont les contenus de ces capacités. Aucun format
déclaratif général de module n’est nécessaire pour commencer : des raccords
TypeScript explicites peuvent suffire lorsque la tranche sera acceptée.

`sequence` dépendrait de la lecture des références de contenu et des
informations nécessaires à leur présentation. `scheduler` dépendrait de la
surface métier de `sequence` et d’une source de temps fournie par la composition.
`sequence` ne dépendrait pas de `scheduler`. Le passage réel reste possédé par
Sighty et les scènes par CodPlay.

Supprimer une page référencée ou une séquence programmée implique plusieurs
invariants dans un seul geste documentaire. Les règles devront être vérifiées
avant le commit commun ; des suppressions réparées par notifications après
coup ne remplacent pas cette cohérence. Les projections et caches devront
tenir compte des données éditoriales dont ils dépendent.

L’arrêt du lecteur devra fermer les sources d’échéances et abonnements du
raccord. Une réponse tardive d’une exécution quittée ne doit pas faire avancer
sa remplaçante. Les ressources restent attachées au cycle de vie qui les possède.

## Circuits existants à prolonger et lacunes à qualifier

| Référence relue | Appui et limite pour cette étude |
| --- | --- |
| [Document](../../specs/document-model-spec.md) et [historique](../../specs/document-history-spec.md) | Un document, commandes pures et un commit ordonné. Le v5 reste un document Learning, pas un format DGS déjà disponible. |
| [API projets](../../specs/project-api-spec.md) | Persistance explicite des données ; ajouter un champ TypeScript ne suffit pas à le conserver dans SQLite. |
| [Carousel](../../specs/carousel-bdc-spec.md) | Circuit automatique interne aux BDC Carte/Graphe. Ses enfants et son placement ne représentent pas une liste de pages/chapitres. Le contenu reste réemployable, sans étendre son rôle par analogie. |
| [Diapo](../../specs/diapo-scene-builder-spec.md#fin-fonctionnelle-de-diapo) | `elce:page:finished` correspond notamment à l’apparition de la dernière Carte, pas à sa durée complète d’exposition. Le contrat de fin de présentation DGS manque. |
| [Preview et vidéos](../../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page) | Médias indépendants et STOP de sortie réels. Démarrage autonome, répétition et interruption DGS restent à éprouver ; aucune commande DOM n’est déduite de ce besoin. |
| [Sighty](../../../sighty/specs/authoring-library-spec.md) | Actions, routes, événements et admission existants. `scene:end` est une fin fonctionnelle sans navigation implicite ; `sequence:end` termine la séquence technique du player. Aucune agrégation des fins par zones, aucun scheduler calendaire ni restauration complète sérialisée ne sont acquis. |
| [État de lecture](2026-10-16-reading-state-ownership-study.md) | Pilotage demandé au niveau du scénario ; raccord de restauration et de persistance encore à appliquer. |

Le module proposé concerne les passages de pages et chapitres ainsi que les
compositions par zones. Il ne remplace ni les séquences techniques CodPlay ni
l’éventuel BDC séquence interne à une Diapo. La fin collective est une règle
demandée ; son raccord aux signaux réels, le cas des chapitres et les récurrences
restent des sujets de contrat à préciser avant leur implémentation. La présente
proposition n’en déduit aucun événement, service ou port moteur nouveau.

Cette tâche produit une étude et le suivi des questions au plan. Aucun code,
spécification vérifiée, test logiciel ou comportement navigateur n’est modifié
ou validé par sa rédaction.

## Points discutés et cas envisagés

Les pistes ci-dessous conservent le détail de l’exploration. Les décisions
ouvertes correspondantes sont regroupées sous les mêmes références dans
le [plan des mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#sequence-et-scheduler).

| Réf. | Piste discutée | Exemple pour préciser le comportement |
| --- | --- | --- |
| SQ1 | Laisser ouverte l’autonomie de `sequence` : usage réservé à DGS ou sélection possible sans calendrier dans un mod. Distinguer cette décision de la séparation logique des responsabilités. | Un cas d’usage concret et son propriétaire ; exercice sans scheduler seulement si cette composition est retenue. |
| SQ2 | Format documentaire à persister et projection BDD des passages, zones, références et répétitions ; transformation distincte vers les vues et scènes produites, avec la correspondance des identités. | Sauvegarder puis rééditer l’intention auteur ; en dériver une composition Sighty dont la lecture conserve cette intention ; même contenu employé plusieurs fois sans copie implicite. |
| SQ3 | Durée propre, durée de passage et contrat des signaux de fin. Appliquer la fin collective demandée aux scènes des zones. Préciser le cas chapitre, le départ du décompte, le coût des transitions et chargements, la fin précoce, le dépassement et le maintien d’un contenu terminé. Le signal Learning existant n’est pas une fin de diffusion DGS. | Fin collective seulement après toutes les fins attendues, quel que soit leur ordre ; doublon sans effet et fin d’un ancien cycle ignorée. Dernière Carte exposée pendant toute la durée attendue, sans détourner `elce:page:finished`. |
| SQ4 | Projection temporelle : durée finie calculable, inconnue ou boucle ; calcul adapté aux passages successifs ou aux scènes parallèles, selon leurs départs et durées connus. | Sommes pour les passages successifs ; dernière fin attendue pour les scènes parallèles ; impossibilité de projection exacte rendue explicite ; borne calendaire distincte de la durée de la séquence. |
| SQ5 | Formes calendaires : fuseau, semaine, récurrence datée ancrée, périodes de validité, heures ambiguës ou absentes, plages traversant minuit et choix entre plusieurs calendriers. | Trois horaires pour une séquence ; un jour sur deux au changement de semaine ; changement d’heure et minuit selon le périmètre retenu. |
| SQ6 | Arrivée tardive, reprise après arrêt ou suspension, horloge corrigée ; fenêtre de diffusion et chevauchement ; interruption immédiate ou à une borne ; interlude et comportement hors plage. Définir aussi pause auteur et pause de diffusion si proposées. | Démarrage à 8 h 47 pour 8 h 45 ; échéance pendant un contenu ou une transition ; absence de rattrapage implicite ; résultats attendus définis avant les tests. |
| SQ7 | Génération des routes, actions et guards raccordés à l’admission Sighty : ordre route/handler, confirmation, refus pendant `changing`, signaux de présentation et réponses tardives. Préciser l’arbitrage entre échéance et fin locale. | Scénario produit réellement exécuté, changement de vue et refus sans avancement fictif ; aucun interpréteur DGS parallèle ni file locale de compensation. Qualifier les lacunes chez leur propriétaire avant tout travail dépendant. |
| SQ8 | Document auteur, productions de lecture et état d’exécution distincts : éventuelle conservation des artefacts, identité d’occurrence, position utile et politique de restauration ; réconciliation après modification auteur. | Aller-retour du document via le stockage réel, productions régénérées depuis la bonne révision, état restauré selon les règles acceptées et aucun handle sérialisé. |
| SQ9 | Contributions des modules dans le mod : classes métier, façades, commandes, vues auteur, codec, persistance et assemblage de lecture. Définir suppression d’un contenu référencé ou d’une séquence programmée avant commit. | Un geste cohérent et annulable, références valides, sauvegarde/réouverture ; calendrier et lecteur utilisent les mêmes règles ; pas de propriétaire documentaire supplémentaire. |
