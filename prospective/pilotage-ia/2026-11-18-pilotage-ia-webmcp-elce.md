# Pilotage IA — enseignements d’OpenFilm, WebMCP, Elcé et Editor

Étude exploratoire demandée le 18 novembre 2026. La première partie est extraite
de l’[étude OpenFilm](../openfilm/2026-11-18-openfilm-comparison.md), fondée sur le
commit OpenFilm `715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36`.
La recherche WebMCP s’appuie sur les sources primaires consultées à cette date.

**Objectif étudié : employer un agent pour construire puis modifier des contenus
Elcé et des scènes libres Editor à partir d’instructions de l’utilisateur, avec
des capacités propres à chaque éditeur.** Les commandes et les services métier
existants constituent le point d’appui ; WebMCP est un raccord possible.
La forme des instructions reste à déterminer.

Ce document conserve une exploration ; il ne définit ni API de pilotage IA
disponible, ni contrat vérifié de pilotage IA, ni plan d’implémentation accepté.
Les observations sur OpenFilm ne démontrent pas qu’OpenFilm emploie WebMCP.

## Cadrage de l’usage

L’hypothèse de diffusion est celle d’un Elcé probablement accessible derrière
un accès payant. L’usage premier concerne l’utilisateur autorisé qui demande
à un agent de travailler sur son contenu dans sa session. L’accès public et
la découverte par des agents extérieurs ne sont pas des objectifs de cette
première exploration. Le paywall reste une hypothèse produit ; aucun mécanisme
commercial ou d’authentification n’est réputé implémenté par cette étude.

La collaboration recherchée couvre la construction initiale et les corrections
successives : comprendre la demande et le contenu courant, effectuer les
changements par les commandes existantes, observer le résultat et poursuivre
sur demande. L’utilisateur garde la possibilité de retoucher directement son
travail ; l’agent doit pouvoir reprendre à partir de cet état.

L’intervention par dialogue est retenue comme approche du besoin. Le travail
confié à l’agent doit être indépendant du focus de la fenêtre : passer à un
autre onglet ou à une autre application ne doit pas suspendre son exécution.
La poursuite après fermeture complète du site reste à déterminer. Cette
exigence d’usage ne vaut pas validation d’une nouvelle architecture d’édition.

Le débrayage explicite du suivi du focus et de l’exclusivité d’édition est un
besoin général distinct du pilotage IA. Son cadrage et son application sont
suivis dans le [plan d’accès Elcé](../../packages/elce/plan/2026-10-11-elce-acces-exclusif-inter-navigateurs-plan.md#évolution-demandée--débrayage-explicite).

Trois questions se distinguent dans l’exploration :

- **Exprimer le travail demandé.** Consigne libre, références à une sélection,
  ressources fournies et contraintes de conservation sont des possibilités à
  examiner. Leur forme reste à déterminer ; les exemples de cette note
  illustrent des usages, sans fixer une syntaxe à imposer à l’utilisateur.
- **Donner à l’agent les capacités d’agir.** Lire le contexte, construire,
  modifier et inspecter le contenu en réutilisant les propriétaires métier.
- **Raccorder l’agent à l’application.** Hébergement de l’agent et accès aux
  commandes métier depuis le dialogue, avec une exécution indépendante du
  focus. WebMCP et d’autres raccords restent des possibilités à examiner.

### Deux périmètres de création

Le besoin couvre les deux éditeurs, chacun avec ses capacités propres :

| Éditeur | Travail à confier à l’agent | Circuit existant à conserver |
| --- | --- | --- |
| Elcé | Construire et modifier des pages Flux ou Diapo, leurs blocs et leur organisation dans le parcours, selon le mod actif. | Document du mod, façades de ressources, commandes et contrôleur Elcé. |
| Editor | Construire et modifier une scène libre : items, contenus, capsules, placement, décor, animations et repères temporels. | `EditorScene`, commandes du contrôleur Editor, Builder et player existants. |

Les consignes pourraient ainsi viser « ajoute une Question après cette
Section » dans Elcé, ou « fais entrer ces trois éléments successivement et
retarde le deuxième » dans Editor. Ce sont des illustrations du besoin ; la
forme des instructions reste ouverte.

La démarche de collaboration recherchée est commune : lire le contexte,
comprendre la demande, appliquer les changements, inspecter le résultat et
reprendre après une retouche humaine. Les opérations disponibles et leurs
règles restent celles de l’éditeur actif. Cette communauté d’usage ne décide
pas encore d’un partage de code ou d’une interface d’outils commune.

Les identités, les unités auteur, la distribution temporelle et les frontières
de commit restent gouvernées par chaque contrat existant. L’historique reste
celui de l’éditeur concerné ; son éventuel regroupement pour une demande IA
est à étudier séparément selon les capacités déjà présentes.

Références : [document Elcé](../../packages/elce/specs/document-model-spec.md),
[document Editor](../../packages/editor/specs/editor-document-model-spec.md),
[intégration Editor](../../packages/editor/specs/editor-v2-integration-spec.md),
[historique Elcé](../../packages/elce/specs/document-history-spec.md) et
[historique Editor](../../packages/editor/specs/editor-history-spec.md).

## 1. Enseignements OpenFilm — décrire une scène à un agent qui la construit

### Ce qu’OpenFilm apporte

L’agent travaille sur les mêmes fichiers que l’éditeur. Un manuel lui enseigne
le format, la fabrication des plans et la vérification du résultat avec
`openfilm look`. Le travail ne s’arrête donc pas à la génération : il comprend
une observation des images et des corrections.

OpenFilm transmet aussi les références visuelles sous forme de liens : clip,
instant, intervalle ou région d’image. La personne peut ainsi désigner ce qui
doit changer sans reformuler toute la scène.
[Manuel de création][of-film-manual], [références communes aux outils][of-plugins].

Les corrections manuelles internes aux plans sont appliquées par
`overrides`, séparément du code des pages. Cette protection dépend de la
stabilité des sélecteurs ciblés. Le code détecte également des retouches omises
par une réécriture externe et des champs manuels remplacés par une ancienne
valeur. Ce n’est pas une garantie générale de fusion de toutes les éditions.
[Application des retouches][of-overrides], [détection des retouches perdues][of-dropped].

### Notre point d’appui existe déjà

Le chemin à réutiliser est :

```text
Intentions de l’agent
    → commandes du contrôleur Editor
    → EditorScene committée
    → Builder existant
    → CodPlay V2
```

`EditorActionsFacade.runCommand()` et `runTransaction()` adressent déjà
l’acteur propriétaire du document. La transaction constitue le point d’appui
pour une modification regroupée dans l’historique. Le catalogue de commandes
inclut notamment création d’item et de capsule, contenu, décor, rattachement,
keyframes et marqueurs.

L’agent devrait modifier ces données auteur, conserver leurs identités et
laisser le Builder résoudre le résultat. Construire un autre document runtime,
patcher directement le DOM ou écrire SQLite pendant que le document est ouvert
introduirait une seconde voie d’écriture.
[Contrat d’intégration](../../packages/editor/specs/editor-v2-integration-spec.md),
[historique](../../packages/editor/specs/editor-history-spec.md),
[façade applicative](../../packages/editor/src/app/facades/editor-actions-facade.ts) et
[commandes reconnues](../../packages/editor/src/app/controller/types.ts).

### Exemple de collaboration à viser

> Construis une scène de 20 secondes : un titre, puis trois cartes qui entrent
> successivement. Utilise les images fournies, conserve le titre pendant la
> présentation et termine par une conclusion.

Une capsule et sa distribution peuvent exprimer cette intention sans recopier
manuellement tous les timings calculés. Une correction comme « commence la
deuxième carte à 8 secondes et conserve sa couleur » devrait porter sur la
borne concernée, en préservant le décor déjà choisi.

L’assistance utile combine quatre capacités : comprendre le document courant,
construire une proposition, appliquer les commandes et inspecter le rendu.
Un message peut être accompagné de la sélection et du temps auteur ; les
identifiants d’item et de keyframe sont des références plus adaptées à notre
modèle que les sélecteurs DOM d’OpenFilm.

### Ce que le serveur fait réellement pour la coédition

La protection dépasse les `overrides`. Dans `film.mjs`, `changeProjectFilm()`
sérialise les modifications par projet, lit le film courant, applique le
changement sur une copie et écrit seulement si le fichier n’a pas changé
entre-temps. `editProjectFilm()` applique les opérations par identifiant et
revalide le résultat ; certaines opérations sur une ancienne révision sont
réappliquées, tandis qu’un changement périmé de disposition des pistes est refusé.
[Écriture du film][of-film-server].

`person-edits.mjs` conserve les versions vues et les champs modifiés par la
personne. `mergeFilmWrite()` appelle le calcul de fusion de `person-merge.mjs`.
Ce dernier recherche une base parmi les versions connues et fusionne par clip,
champ ou propriété ; les ambiguïtés peuvent conserver le choix humain. Les
notifications déjà transmises aux agents interviennent aussi dans ce calcul.
L’état de suivi est en mémoire de session, distinct du fichier du film.
[Suivi des retouches][of-person-edits], [calcul de fusion][of-person-merge].

Ce mécanisme répond à leur choix de laisser un agent réécrire des fichiers
entiers. Pour Editor, il renforce l’intérêt d’une entrée par commandes nommées
sur le document courant : reproduire tout leur système de fusion serait une
décision architecturale supplémentaire, pas un préalable démontré.

Les références visuelles sont également construites dans le code : `clipRef()`
transmet identité, source, découpage et vitesse ; `regionRef()` associe instant,
rectangle, clips concernés et extrait visuel. C’est une capacité de contexte
précise, au-delà d’une simple zone de conversation.
[Construction des références][of-studio-refs].

### Ce qui reste à concevoir

- **Accès de l’agent.** Aucun protocole de coédition par agent n’est établi
  dans les références Editor consultées. Le choix entre agent externe,
  conversation intégrée et transport d’outils reste une étude d’intégration.
- **Lecture et résultats.** La façade applicative reçoit des commandes mais
  ses méthodes retournent `void`. La réception par l’agent des identifiants
  créés, erreurs et résultats ne constitue pas aujourd’hui une API exposée.
- **Éditions simultanées.** Le contrôle de révision SQLite protège une
  sauvegarde, pas à lui seul une proposition d’agent fondée sur un document
  devenu ancien. La proposition doit pouvoir être confrontée à l’état courant
  avant application.
- **Vérification visuelle.** Lire le document ne prouve pas que le texte tient
  dans son cadre ou qu’une entrée est lisible. Une inspection de plusieurs
  instants, sur le vrai player, complète les diagnostics structurels.
- **Ressources.** Le catalogue et la persistance des octets médias restent
  incomplets dans Editor. Une première expérimentation peut utiliser des
  ressources stables fournies, sans supposer une chaîne de génération média.

La graine pseudo-aléatoire auteur doit rester stable pendant l’édition. Un
agent ne doit pas régénérer un tirage à chaque correction de la composition.
Les previews continuent d’utiliser leur circuit temporaire ; elles ne deviennent
pas une seconde persistance des propositions.
[Persistance actuelle](../../packages/editor/specs/editor-sqlite-persistence-spec.md).

**Appréciation :** piste favorable, avec un adaptateur applicatif à étudier
autour des commandes existantes. Aucun besoin de modification du cœur CodPlay
n’est démontré par cette étude.

## 2. Ce que sont les outils WebMCP

### Une application décrit les actions qu’un agent peut appeler

Un outil WebMCP est une fonction JavaScript exposée par la page, accompagnée
d’un nom, d’une description et d’un schéma d’entrée. Un agent compatible
découvre ces outils et les appelle avec des arguments structurés.
Le draft du 13 novembre 2026 appartient au Web Machine Learning Community
Group ; il ne constitue pas un standard W3C.
[Spécification WebMCP][wmcp-spec].

Par exemple, l’intention « renomme cette page » pourrait être traduite en un
appel portant l’identifiant de la page et son nouveau nom. L’application
exécuterait alors sa logique habituelle et actualiserait son interface.
L’intérêt pour Elcé est de donner à l’agent des opérations exprimées dans son
vocabulaire métier, avec leurs contraintes et leurs résultats.

Le cycle général est : enregistrement par la page, découverte par l’agent,
appel structuré, exécution dans le contexte de la page, puis retour du résultat.
Le contexte courant et la session utilisateur restent ceux de l’application.
L’agent et son modèle sont fournis séparément : WebMCP ne produit pas lui-même
les contenus demandés. [Présentation du projet][wmcp-explainer].

### Différence avec MCP et avec le pilotage du navigateur

| Mécanisme | Point d’entrée | Conséquence pour le besoin étudié |
| --- | --- | --- |
| Serveur MCP classique | Outils proposés par un service auquel se connecte l’agent. | Le raccord au document ouvert et à son état doit être conçu. |
| WebMCP | Fonctions proposées par la page en cours d’exécution. | Peut réutiliser le même contexte applicatif que l’interface. |
| Automatisation navigateur, dont Safari MCP | Lecture de page, clics, saisie, navigation et autres capacités exposées par l’outil connecté. | Permet d’observer et de manipuler l’interface ; sa présence ne prouve pas que des outils WebMCP sont disponibles. |

La distinction service/page est décrite dans l’[explainer WebMCP][wmcp-explainer].
Les conséquences pour Elcé sont une appréciation d’intégration.

Un outil nommé « créer une page » n’élimine pas les règles du document : son
implémentation doit toujours les appliquer. De même, un appel d’outil réussi
ne prouve pas à lui seul la qualité visuelle ou pédagogique du résultat.
L’observation du vrai lecteur reste complémentaire.

### Forme actuelle de l’API

L’entrée actuelle est `document.modelContext.registerTool()`. Les exemples
plus anciens fondés sur `navigator.modelContext` doivent être confrontés à
la version réellement disponible. Le retrait d’un outil passe par le
`AbortSignal` fourni lors de son enregistrement.
[API impérative documentée par Chrome][wmcp-imperative].

Exemple autonome de lecture, sans dépendance à une API Elcé supposée :

```js
const toolController = new AbortController();

if ("modelContext" in document) {
  await document.modelContext.registerTool({
    name: "read_page_title",
    description: "Read the current browser document title.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    /** Returns the title of the current browser document. */
    async execute() {
      return { title: document.title };
    },
  }, { signal: toolController.signal });
}

// When the owning view is disposed:
// toolController.abort();
```

L’API JavaScript n’impose pas React ; elle peut être raccordée au cycle de vie
de notre application Remix. Chrome documente aussi une variante déclarative
pour les formulaires HTML. Le dépôt du groupe précise que cette variante est
explorée séparément et ne fait pas partie de sa spécification actuelle.
[API JavaScript][wmcp-imperative], [périmètre du draft][wmcp-explainer].

## 3. Application possible à Elcé

### Le circuit existant est adapté

Les contrats Elcé donnent déjà le chemin suivant :

```text
Intention auteur
    → façade de la composition active et façades de ressources
    → file du contrôleur XState propriétaire
    → commandes et invariants métier
    → document, historique et persistance existants
    → builders et lecteur réels
```

Le raccord de l’agent envisagé serait un adaptateur de ces intentions, qu’il
emploie WebMCP ou les capacités d’une conversation intégrée à l’application.
Le document reste dans le même acteur ; IndexedDB, SQLite et les nœuds du
lecteur conservent leurs responsabilités.

Learning possède son document et ses commandes d’organisation. Les ressources
Carte, Question, Carousel et Graphe possèdent leurs capacités partagées.
Quiz Hunt conserve ses propres règles de composition. Le catalogue d’outils
devrait refléter le mod actif et les actions qu’il permet, en s’appuyant sur
ces propriétaires existants.

Références : [document et commandes Elcé](../../packages/elce/specs/document-model-spec.md),
[session](../../packages/elce/specs/project-session-spec.md),
[ressource Question partagée](../../packages/elce/specs/question-bdc-spec.md).

### Exemples d’actions utiles

Les noms ci-dessous illustrent les intentions à étudier ; ils ne désignent
pas des outils déjà implémentés ni une API acceptée.

| Intention illustrative | Informations ou action | Propriétaire existant à réutiliser |
| --- | --- | --- |
| `elce_read_context` | Mod, projet, page sélectionnée, structure utile, identités et accès d’édition. | Snapshot et projections du contrôleur courant. |
| `elce_create_page` | Créer une page Flux ou Diapo à un emplacement explicite. | Façade et commandes d’organisation du mod. |
| `elce_update_section` | Modifier le contenu d’une Section identifiée, en préservant les ancres non concernées. | Ressource Section et circuit d’édition/ancrage existant. |
| `elce_update_question` | Modifier énoncé et réponses d’une Question identifiée. | Façade et service Question partagés, dans les règles du mod actif. |
| `elce_move_bdc` | Déplacer un bloc existant vers une destination autorisée. | Commandes de placement et invariants existants. |
| `elce_undo` / `elce_redo` | Annuler ou rétablir un geste documentaire. | Historique du même contrôleur. |

Une requête concrète pourrait être :

> Dans le chapitre sélectionné, crée une page Flux d’introduction et une page
> d’évaluation contenant une Question à trois réponses. Utilise l’image déjà
> présente au catalogue. Conserve les titres que j’ai retouchés.

L’agent aurait besoin de lire le contexte et les ressources disponibles,
d’appliquer les intentions permises, de recevoir les identifiants créés,
puis d’observer le résultat. Les placements et les restrictions du mod
restent décidés par les services Elcé ; l’agent ne reconstruit pas ces règles.

### Les points de conception déterminants

**Résultats asynchrones.** Plusieurs intentions documentaires de
`LearningEditorFacade`, dont `createPage()`, retournent `void`. À l’inverse,
`CoreEditorFacade` possède déjà des attentes de résultat pour certaines
opérations de projet, telles que création et ouverture.
La lacune est donc à qualifier par famille d’action : il ne faut ni déclarer
toute l’application sans retour, ni annoncer « page créée » au seul envoi
d’un événement. L’acquittement documentaire, les identités retournées et les
erreurs exposées à un agent restent à définir.
[Façade commune](../../packages/elce/src/core/authoring/core-editor-facade.ts),
[façade Learning](../../packages/elce/src/mods/learning/authoring/learning-editor-facade.ts).

**Retouches humaines et état courant.** Une instruction calculée avant une
retouche humaine peut devenir périmée, même si les événements sont ensuite
traités dans l’ordre. Les préconditions d’application doivent être étudiées
à partir du document actuel ; la révision de sauvegarde serveur ne remplace
pas cette vérification. La protection des retouches est un enseignement
d’OpenFilm, sans nécessité démontrée de recopier sa fusion de fichiers.

**Historique.** Elcé possède un historique unique et un ordre de traitement des
commandes. Le regroupement temporel des saisies ne définit pas une transaction
générale de plusieurs outils IA. « Créer tout un chapitre et l’annuler en une
fois » reste une décision de produit et de contrat à étudier.
[Historique documentaire](../../packages/elce/specs/document-history-spec.md).

**Focus et accès d’édition.** Le contrat actuel accepte les commandes et imports
lorsque `editAccess` est `active`. La fenêtre doit normalement être visible et
focalisée pour prendre son verrou ; perdre le focus suspend l’édition selon
les exceptions établies. Ce fonctionnement actuel ne satisfait pas l’exigence
de continuité du travail de l’agent en arrière-plan. La propriété du document
et l’autorisation d’exécuter les actions IA doivent donc être réexaminées, en
conservant une coordination unique avec les gestes humains. Une conversation
intégrée ne résout pas à elle seule cette dépendance. Le futur mécanisme reste
à définir ; les règles vérifiées actuelles ne sont pas modifiées par l’étude.
[Accès par fenêtre](../../packages/elce/specs/editor-window-access-spec.md).

**Médias et texte riche.** Elcé possède déjà son import média, sa déduplication
et ses règles d’ancrage. Les outils éventuels doivent les réutiliser ; la
référence à un média existant et l’import de nouveaux octets sont deux besoins
distincts. Un outil de texte doit respecter le contenu structuré de Section et
ses ancres. La génération d’images ou de voix serait une capacité supplémentaire
à raccorder, pas un effet automatique de WebMCP.
[Modèle et médias](../../packages/elce/specs/document-model-spec.md),
[Section](../../packages/elce/specs/section-editor-spec.md),
[ancrage](../../packages/elce/specs/anchor-spec.md).

**Observation du résultat.** La preview existante monte la vraie composition
Sighty/CodPlay. Elle constitue la référence pertinente pour inspecter les pages.
Ouvrir cette fenêtre peut toutefois modifier le focus de l’éditeur ; édition
et inspection doivent respecter leur cycle de vie actuel.
[Preview](../../packages/elce/specs/player-preview-spec.md).

Ces points rejoignent les recommandations WebMCP : partager la logique de
l’application, retourner un succès correspondant à l’état obtenu et tenir
compte d’un état de travail devenu ancien.
[Bonnes pratiques Chrome][wmcp-practices].

### Exposition des capacités

Les outils doivent proposer un périmètre clair et des paramètres métier
limités. Une entrée générique exécutant du JavaScript fourni par l’agent
n’apporte pas les garanties attendues de commandes typées.

Les annotations telles que `readOnlyHint` décrivent les effets d’un outil ;
elles ne remplacent pas les contrôles d’accès de l’application.
La lecture de contenus renvoie des données que l’agent doit traiter comme
telles. Les origines auxquelles les outils sont exposés demandent aussi un
choix explicite. [Exposition et annotations][wmcp-security].

## 4. Intégration dans le site et rôle du serveur

La conversation intégrée au site constitue le point de collaboration avec
l’utilisateur. Le travail de l’agent doit continuer lorsque cette fenêtre
n’a plus le focus. La poursuite après fermeture du site reste une question
distincte et ouverte.

Trois responsabilités se distinguent :

| Responsabilité | Emplacement envisagé | Rôle |
| --- | --- | --- |
| Conversation et contexte auteur | Site | Consigne, document courant, sélection, ressources et présentation du résultat. |
| Orchestration IA | Service côté serveur | Appels au modèle, choix des actions suivantes et suivi des résultats ; gestion de la consommation par compte si ce modèle commercial est retenu. |
| Exécution documentaire | À déterminer, avec indépendance au focus | Application des intentions par le circuit métier de chaque éditeur, avec propriété du document, historique, sauvegarde et observation du rendu à coordonner. |

Héberger l’agent côté serveur ne suffit pas si ses actions attendent ensuite un
contrôleur suspendu par la perte de focus. Le point de conception porte aussi
sur le lieu d’exécution des commandes et sur l’autorisation de travail portée
par la tâche ou la session. L’agent doit recevoir un résultat confirmé de ses
actions. Aucun protocole de pilotage IA ni nouvelle forme de droit n’est encore
établi dans les contrats consultés.

Deux directions peuvent être comparées sans préjuger du choix :

| Direction à étudier | Conséquence à examiner |
| --- | --- |
| Garder l’exécution dans une session auteur du navigateur, capable de traiter la tâche en arrière-plan. | Définir comment cette tâche conserve une autorisation valide malgré la perte de focus, avec la coordination et les limites de cycle de vie du navigateur. |
| Héberger l’exécution auteur indépendamment de la fenêtre, côté serveur. | Réutiliser les commandes et services métier en définissant la propriété du document, l’historique, la synchronisation de l’interface et l’observation du vrai rendu. |

Dans les deux directions, la coordination avec les retouches manuelles doit
être explicite. Les choix entre exécution exclusive, alternance des gestes et
gestion des conflits restent à examiner. Le besoin ne justifie pas un second
circuit d’écriture indépendant de celui de chaque éditeur.

Une CLI peut être le processus qui héberge l’agent côté serveur. Son intérêt
dépend de ses capacités d’appel d’outils et de suivi des résultats ; elle
ne détermine pas, à elle seule, la manière d’éditer Elcé ou Editor. Un service
appelant une API de modèle est une autre forme d’hébergement à comparer.

Écrire directement le document serveur pendant que l’éditeur travaille
interviendrait hors de son historique et de ses états locaux en attente.
Les contrôles de révision et de droit protègent la persistance ; ils ne
transforment pas une sauvegarde externe en commande du contrôleur ouvert.
L’analyse s’appuie sur l’[API Elcé](../../packages/elce/specs/project-api-spec.md),
la [session Elcé](../../packages/elce/specs/project-session-spec.md), la
[persistance Editor](../../packages/editor/specs/editor-sqlite-persistence-spec.md)
et les historiques propres aux deux éditeurs cités plus haut.

La perte de focus ne doit pas retirer l’autorisation de travail du futur agent
par simple conséquence du verrou de fenêtre actuel. Cette indépendance demande
un contrat d’accès adapté, respectant la propriété du document et les autres
éditions ; elle ne consiste pas à simuler la visibilité ou le focus. Les
spécifications actuelles restent les références du fonctionnement implémenté.
La fermeture du site et une éventuelle exécution autonome prolongée devront
être décidées séparément.

WebMCP reste une option pour exposer les outils de la page à un agent compatible.
Le raccord interne entre notre service IA et notre application peut être conçu
sans dépendre de son adoption par les navigateurs. Ce choix est distinct du
lieu d’exécution de l’agent : MCP décrit un échange de contexte et d’outils,
sans imposer la façon d’orchestrer les appels au modèle.
[Périmètre de MCP][mcp-architecture], [rôle de WebMCP][wmcp-explainer].

## 5. Disponibilité et choix de transport

La compatibilité demande deux vérifications : le navigateur doit héberger
l’API et l’agent doit savoir découvrir puis appeler les outils de cette page.
L’existence de l’un ne prouve pas l’autre.

| Environnement | État décrit dans les sources consultées |
| --- | --- |
| Chrome | Origin trial depuis Chrome 149 ; flag `enable-webmcp-testing` pour le développement local. |
| Edge | Origin trial annoncé pour Edge 150. |
| Safari / WebKit | La position publiée par WebKit est `oppose`. Une disponibilité native Safari n’est pas établie par les références consultées. |
| Agent choisi | Son raccord effectif aux outils de la page doit être vérifié dans l’environnement retenu. |

Sources : [Chrome][wmcp-chrome], [état des implémentations][wmcp-status],
[position WebKit][wmcp-webkit]. Ces éléments ne constituent pas un essai
de compatibilité d’Elcé ou d’Editor dans ces navigateurs.

La connexion Safari MCP utilisée pour piloter l’interface est un mécanisme
distinct. Elle ne permet pas de conclure que Safari offre nativement WebMCP.
Un polyfill ou un pont éventuel devrait aussi démontrer comment l’agent trouve
et appelle les outils ; déclarer seulement les fonctions dans la page ne
prouve pas ce raccord.

**Recommandation d’étude :** préciser le travail de construction et de
modification attendu de l’agent, son contexte et les résultats nécessaires sur
les façades existantes de chaque éditeur. Le critère de choix du raccord est sa
capacité à servir ce parcours dans la session de l’utilisateur autorisé.
L’indépendance au focus est une exigence ; la poursuite après fermeture du site
reste à déterminer.
La place de la conversation, l’hébergement de l’agent et le raccord aux
commandes sont trois choix à comparer séparément. WebMCP et MCP sont des
possibilités de raccord ; une conversation intégrée peut les employer ou
utiliser un raccord interne au service.
La découvrabilité publique ne constitue pas un critère de cette exploration.

L’expérience discriminante serait, dans chaque éditeur, une petite construction
réelle suivie d’une retouche humaine, d’une correction par l’agent, d’Undo/Redo
et d’un rechargement. Elle permettrait d’évaluer la conservation des identités,
des retouches, de l’historique et de la persistance. Le passage à un autre
onglet ou à une autre application pendant le travail devrait prouver que
l’exécution continue sans focus, puis que les changements sont correctement
présentés au retour. La qualité visuelle se jugerait dans le vrai lecteur.
Cette étude ne démontre aucun besoin de modification du cœur CodPlay.

## 6. Reconstruire une scène à partir d’une vidéo de motion design

**Appréciation : piste plausible pour une reconstruction éditable, avec une
fidélité à évaluer sur des vidéos représentatives.** Une vidéo fournit les
images composées dans le temps ; retrouver le document auteur et ses choix
de construction constitue un problème d’inférence. Plusieurs compositions
peuvent produire une apparence similaire. Le résultat recherché serait donc
une nouvelle scène que l’auteur peut retoucher, avec une proximité visuelle
et temporelle mesurée.

### Indices de faisabilité

Le travail de recherche *Editing Motion Graphics Video via Motion
Vectorization and Transformation* reconstruit un programme SVG représentant
des objets, leurs transformations et leurs relations d’occultation. Le
mouvement devient modifiable ; l’apparence des objets reste fondée sur des
images de référence, ce qui ne garantit pas des textes ou des tracés vectoriels
sémantiquement éditables. La méthode vise notamment des fonds statiques et
des mouvements affines ; les déformations et fortes occultations dégradent
la reconstruction. [Article de recherche][motion-vectorization-paper],
[code des auteurs][motion-vectorization-code].

Le projet MotionClone annonce une reconstruction de vidéos en projets
HyperFrames éditables par une approche agent. Son README précise que le
résultat reste approximatif, notamment pour les petits textes, les polices,
les photographies et la 3D complexe. Ce positionnement est un autre indice
de faisabilité ; sa qualité réelle et son intégrabilité n’ont pas été testées
ici. [Présentation du projet][motionclone-project].

### Rôle de l’agent et correspondance avec notre modèle

Le parcours envisagé est :

```text
Vidéo de référence et ressources éventuellement fournies
    → observation des séquences, objets et mouvements
    → hypothèse de composition et mesure des temps/trajectoires
    → construction du document Editor par ses commandes
    → Builder existant et vrai player CodPlay
    → comparaison d’images aux mêmes instants et corrections
```

L’agent organiserait les observations et les corrections. La reconnaissance
des textes, la séparation des objets, leur suivi et les mesures temporelles
peuvent nécessiter des outils spécialisés. L’objectif serait d’exprimer une
animation lisible avec des items, des contenus, des décors et des keyframes,
en utilisant les capsules lorsque leur orchestration correspond au mouvement
observé. La hiérarchie d’origine ne peut pas être supposée connue.

Les mesures dans les images vidéo restent transitoires ; la construction
auteur respecte les unités `cqw` du document Editor. La reconnaissance d’une
forme ou d’un effet ne prouve pas sa disponibilité dans l’interface auteur.
Il faut examiner les capacités réellement exposées par Editor avant de choisir
une représentation, même si le moteur CodPlay possède d’autres composants.
[Modèle Editor](../../packages/editor/specs/editor-document-model-spec.md),
[circuit vers CodPlay](../../packages/editor/specs/editor-v2-integration-spec.md).

### Cas favorable : ressources originales disponibles

La disponibilité des images et de la voix d’origine contraint beaucoup mieux
la reconstruction. L’agent peut associer des objets observés aux fichiers
fournis, puis estimer leur composition et leur animation. Le scénario à
privilégier pour une évaluation serait une vidéo de référence accompagnée de
ses ressources séparées et identifiables.

| Ressource fournie | Apport à la reconstruction |
| --- | --- |
| Images, logos et illustrations d’origine, séparés et avec transparence si nécessaire | Réemploi des objets complets, y compris des parties masquées dans la vidéo ; estimation du cadrage et des transformations. |
| Voix d’origine isolée | Réemploi de la narration et référence de durée ; son décalage et ses éventuelles coupes par rapport au film restent à retrouver. |
| Texte de narration et transcription horodatée | Repérage des phrases et des mots auxquels associer les événements visuels. |
| Textes affichés et polices | Reconstruction de textes éditables avec une composition typographique mieux contrainte. |
| Ressources vectorielles ou calques séparés | Accès à une structure graphique supplémentaire, selon les capacités auteur effectivement disponibles. |

Une image composite reste un objet composite : sa disponibilité ne donne pas
automatiquement accès à ses éléments internes. Une voix mixée avec musique et
effets ne fournit pas les mêmes informations qu’une piste isolée. Si l’audio
n’est pas déjà horodaté, un outil d’alignement peut rapprocher une transcription
des instants prononcés. [Alignement texte/audio][audio-alignment].

L’agent pourrait alors interpréter une consigne telle que « fais apparaître le
schéma quand la narration annonce les trois étapes ». Les repères issus de la
source média et les repères auteur doivent conserver leurs propriétaires
actuels : les cues de contenu ne créent pas de liaison durable aux keyframes,
tandis que les marqueurs auteur peuvent porter ces attaches. Remplacer la voix
ne recale donc pas automatiquement toutes les animations selon le contrat
actuel. [Cues et marqueurs Editor](../../packages/editor/specs/sequence-editor-v2-cues-markers-spec.md).

La disponibilité des ressources ne résout pas les masques, les déformations,
les effets ou les courbes de mouvement absents du modèle de reconstruction.
Le réemploi durable doit aussi s’appuyer sur un circuit média établi : la
spécification Editor décrit encore des limites d’import et de stockage des
octets. Des ressources externes stables peuvent servir à l’évaluation, sans
présenter leur présence comme une gestion média déjà complète.
[Persistance Editor](../../packages/editor/specs/editor-sqlite-persistence-spec.md).

### Difficulté selon le contenu

Cette appréciation est une hypothèse d’évaluation pour notre intégration,
sans taux de réussite établi :

| Contenu observé | Appréciation |
| --- | --- |
| Titres, images et objets distincts, entrées/sorties et transformations 2D simples | Cas favorable pour une première évaluation. |
| Typographie fine, trajectoires complexes, recouvrements et accélérations précises | Mesures et corrections probablement nécessaires ; les ressources originales amélioreraient le résultat. |
| Déformations, particules, 3D, changements de caméra et effets fortement composés | Reconstruction générale et fidélité non acquises. |

La vidéo ne fournit pas avec certitude les polices, les contenus masqués ou les
courbes de mouvement originales. L’estimation doit aussi respecter les limites
actuelles d’Editor : les easings doivent être acceptés par ACE, et une courbe
`cubic-bezier` auteur n’est pas aujourd’hui rendue par ce circuit. Une différence
de mouvement doit être signalée et arbitrée, pas dissimulée par un autre calcul
d’animation. [Easing Editor](../../packages/editor/specs/motion-easing-spec.md).

Un résultat hybride peut associer des éléments natifs éditables et des
ressources image ou vidéo pour certaines parties complexes, si ce compromis
est explicitement choisi. Le niveau d’édition obtenu doit alors être clair :
déplacer une image n’équivaut pas à modifier ses éléments internes.
Les interactions futures demandent une consigne supplémentaire ; elles ne
se déduisent pas du seul film observé.

L’intérêt produit serait de pouvoir poursuivre par dialogue : remplacer un
texte, changer une couleur, retarder une entrée ou adapter la composition.
Une évaluation utile comparerait une courte animation 2D reconstruite à la
référence sur plusieurs instants, puis vérifierait ces retouches et leur
persistance. Pour conserver une scène libre éditable, Editor est le point
d’entrée naturel. Son éventuel usage dans un contenu Elcé reste une question
d’intégration distincte, à examiner selon les contrats d’Elcé.

[audio-alignment]: https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/workflows/alignment.html
[motion-vectorization-paper]: https://sxzhang25.github.io/publications/pdfs/motion-vectorization-paper.pdf
[motion-vectorization-code]: https://github.com/sxzhang25/MotionVectorization-ProgramTransformation
[motionclone-project]: https://github.com/badibadey/motionclone
[wmcp-spec]: https://webmachinelearning.github.io/webmcp/
[wmcp-explainer]: https://github.com/webmachinelearning/webmcp/blob/main/README.md
[wmcp-imperative]: https://developer.chrome.com/docs/ai/webmcp/imperative-api
[wmcp-practices]: https://developer.chrome.com/docs/ai/webmcp/best-practices
[wmcp-security]: https://developer.chrome.com/docs/ai/webmcp/secure-tools
[wmcp-chrome]: https://developer.chrome.com/docs/ai/webmcp
[wmcp-status]: https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md
[wmcp-webkit]: https://github.com/WebKit/standards-positions/issues/670
[mcp-architecture]: https://modelcontextprotocol.io/docs/learn/architecture

[of-film-manual]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/manual/film/SKILL.md
[of-plugins]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/plugins/README.md
[of-overrides]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/src/overrides.mjs
[of-dropped]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/studio/ui/src/lib/dropped-overrides.ts
[of-film-server]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/studio/server/film.mjs
[of-person-edits]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/studio/server/person-edits.mjs
[of-person-merge]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/studio/server/person-merge.mjs
[of-studio-refs]: https://github.com/openfilm/openfilm/blob/715c3a6e46b11a0b3ee038e8f7b3e3b4e19c5c36/packages/openfilm/studio/ui/src/lib/studio-refs.ts

