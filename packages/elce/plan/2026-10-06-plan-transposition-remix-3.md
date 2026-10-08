# Elcé — plan de transposition vers Remix 3

**Statut : En cours — étapes 0 à 4 finies ; le portage Remix de l’étape 5 est appliqué. Une validation reste ouverte : relire une IndexedDB v4 existante après remplacement du serveur sur le même origin, sans remise à zéro.** L’auteur, le lecteur popup et les tests Elcé utilisent le runtime Remix sans React ; les composants et tests qui rendent du JSX sont en `.tsx`. `npm run dev:elce` lance l’asset server Remix et réutilise l’API Elcé active. Typecheck réussi, 206 tests réussis sur 206, build réussi ; le chunk JavaScript fait 1 314,76 kB minifiés (372,33 kB gzip) et conserve l’avertissement Vite au-dessus de 500 kB. Brave a vérifié la liste des projets depuis `localhost:5176`, l’ouverture du lecteur natif et ses images serveur depuis l’API ; après conversion TSX, les 16 modules de composants se chargent, la console est vide et aucun asset React/ReactDOM n’est demandé. Le port `localhost:5175` reste occupé par un ancien serveur Vite ; après rechargement, il renvoie `504 (Outdated Optimize Dep)`. Il n’a pas été arrêté et aucune base n’a été réinitialisée. L’auteur a reporté à une tranche ultérieure l’amélioration de reprise du verrou après un changement réel de visibilité : sans utilisateur en situation réelle, aucun développement ni test dédié n’est justifié. Cette décision ne bloque pas le portage.

Ce plan complète le [plan de stockage local et synchronisation](./2026-10-06-elce-local-first-synchronisation-plan.md). Ce dernier reste l’autorité sur IndexedDB, SQLite, les révisions, les fichiers média et l’ordre de synchronisation.

## Invariants de migration

- La cible est le runtime de composants Remix 3 sans React ; la version fixée pour ce portage est `3.0.0-rc.4`, acceptée le 7 octobre 2026, pas Remix v2 ni React Router Framework Mode.
- La cible finale est zéro React dans le workspace Elcé, sans exception pour le lecteur. Les scènes et leur composition restent gérées par Sighty/CodPlay ; toute vue ou tout adaptateur d’interface React qui les entoure dans Elcé doit aussi être porté vers Remix.
- L’interface auteur utilise le routeur navigateur `remix/spa` ; les routes API utilisent un routeur Fetch serveur distinct. L’API n’affiche pas l’éditeur et ses réponses ne remplacent pas l’état éditorial.
- Le contrôleur XState reste propriétaire de l’état éditorial. Les gestes métier passent par les commandes et façades déjà définies.
- Les classes métier, le modèle ElceDocument, les builders de scènes et la composition Sighty/CodPlay ne dépendent pas de Remix.
- La migration d’interface ne change ni les documents v4 d’IndexedDB, ni le scénario, ni les scènes et contenus existants.
- Le serveur utilise les frontières d’infrastructure Elcé pour SQLite et les fichiers ; les règles métier ne sont pas déplacées dans les contrôleurs.
- Les autres paquets du monorepo peuvent conserver React. Après les étapes 4 et 5, aucune surface de production Elcé ni aucun test Elcé ne doit en dépendre ; les dépendances React du workspace sont supprimées une fois tous leurs usages portés.

## Étapes et critères de sortie

### 0. Préparer le moteur Remix — Fini

- Déclarer Node 24.3.0 ou plus récent comme moteur minimal du seul workspace Elcé. C’est fait dans `packages/elce/package.json` ; le Node local 26.10.0 satisfait cette contrainte.
- Installer et fixer `remix@3.0.0-rc.4` dans le seul workspace Elcé. C’est fait ; l’installation npm a réussi.
- Démarrer l’éditeur avec le routeur navigateur `remix/spa` et un routeur serveur séparé réservé aux réponses API.
- L’entrée POC a d’abord monté temporairement l’éditeur React existant sous un hôte conservé par `data-rmx-preserve-dom`. Ce raccord partageait l’acteur XState et la persistance ; il a été supprimé à l’étape 4 après le portage des surfaces auteur. Le montage provisoire du lecteur popup reste suivi à l’étape 5.
- Préparer le routeur Fetch API dans un module serveur distinct, sans démarrer de listener ni ajouter de route avant les opérations SQLite et fichiers prévues aux étapes 2 et 3.
- Vérifier que l’installation, le démarrage, les scripts du workspace et le build fonctionnent sous le moteur retenu, sans modifier les autres workspaces.

**Sortie :** le workspace Elcé a démarré et s’est construit avec la SPA Remix et un hôte React provisoire. Cet hôte auteur a ensuite été retiré à l’étape 4 ; le routeur Fetch API reste séparé du routeur navigateur.

**Vérification :** installation `remix@3.0.0-rc.4` dans le workspace Elcé ; route `/` et fallback rendus par `remix/spa` ; Safari confirme l’affichage de l’éditeur et conserve exactement le host lors d’une navigation SPA vers une route inconnue. Le test Fetch confirme la réponse 404 du routeur API sans serveur en écoute. Typecheck, 164 tests et build passent. Le build actuel émet un chunk de 1 557 292 octets minifiés (441 916 octets gzip) ; la limite Vite de 500 KiB s’applique avant gzip. L’audit du graphe montre que le chunk inclut aussi le player par import statique ; l’avertissement ne peut donc pas être attribué à la seule cohabitation React/Remix.

### 1. Prouver l’interface Remix avec les vraies frontières Elcé — Fini

Dans une tranche isolée de l’application Elcé, utiliser le vrai routeur SPA Remix : `createRouter`, le middleware `render()` et `run()`. Une route retourne le composant Remix de la surface ; les routes API restent dans le routeur serveur et ne font pas partie de cette preuve.

- **Fini :** contrats et transformations documentaires déplacés dans `domain/commands/` ; façades déplacées dans `app/facades/` ; props React des champs Carte déplacées dans `app/editor/card/`. Les tests, le typecheck et le build passent sans changement de comportement.
- **Fini :** l’entrée navigateur compose l’acteur, le store et l’attachement de persistance une seule fois. La racine Remix reçoit cet acteur dans son Context ; le pont React reçoit la même instance. Safari recharge l’éditeur restauré sans erreur de console.
- **Fini le 7 octobre :** extraire de `AppLayout` la façade d’actions et le modèle de vue prévus par l’audit. L’entrée navigateur crée `EditorActionsFacade` une fois et transmet la même instance ; `AppLayout` ne fabrique plus les commandes documentaires et utilise le sélecteur pur `selectEditorViewModel`. Les événements, commandes et règles UI restent identiques.
- **Fini le 7 octobre, preuve temporaire retirée à l’étape 4 :** le runtime Remix a vérifié l’accès au contrôleur par `EditorContextProvider`, l’abonnement aux snapshots, le rendu par `handle.update()` et le désabonnement à la fin du cycle de vie. Le test de production `RemixPageEditor` couvre maintenant l’abonnement et son nettoyage au changement de page et au démontage.
- **Fini le 7 octobre, preuve temporaire remplacée à l’étape 4 :** l’éditeur de Carte Remix éprouvait les champs et les façades Carte/Carousel. La page de production vérifie maintenant la Carte directe en Flux et en Diapo, les Cartes enfants, le changement de preset, l’ordre et les imports média.
- **Fini le 7 octobre — Section Tiptap sans React dans Remix :** `SectionTiptapAdapter` utilise `@tiptap/core`, le cycle `ref` et les commandes Remix `on`; il garde les transactions, dépôts et déplacements ProseMirror raccordés aux mêmes façades et au même acteur XState. Le test de production vérifie le titre, le contenu, les commandes, le dépôt d’image, sa persistance, l’aperçu, le déplacement d’ancre et la conservation de la même instance Editor/du DOM. Safari Technology Preview via MCP avait vérifié l’identité du `.ProseMirror` pendant la preuve de portage ; la vue de preuve séparée a été retirée.
- **Fini le 7 octobre :** « Prévisualiser » continue d’ouvrir le lecteur Sighty/CodPlay. Le player conserve les paramètres de la route auteur ; le routeur ignore les preuves temporaires quand l’acteur n’est pas présent. Safari confirme l’ouverture de « Lecture Elcé » sans erreur de console après rechargement.
- **Fini le 7 octobre :** compiler isolément les entrées de preuve Carte et Section et contrôler leur graphe d’import. Aucun module React, `@tiptap/react` ou `lucide-react` n’est présent dans ces surfaces Remix. La page auteur de production utilise maintenant ce circuit sans îlot React. La dépendance React du montage popup reste provisoire à l’étape 5.
- **Fini le 7 octobre :** exécuter les tests de composant avec le runtime Remix et le parcours SPA dans le navigateur MCP fourni par l’environnement. Safari Technology Preview via MCP vérifie les parcours Carte et Section, la preview et la conservation de l’identité DOM après `&frame=2`, sans erreur de console. Aucun navigateur hors de cette configuration n’est requis.
- Ne pas toucher aux API, au schéma SQLite, au transfert des médias, au modèle v4 ou aux scènes du player dans cette étape.

**Sortie :** parcours auteur vérifié dans le vrai routeur SPA Remix avec commande, Carte et Section Tiptap ; état éditorial toujours possédé par le même acteur XState ; aucune route API, table SQLite, scène ni composition Sighty/CodPlay modifiée. L’étape 1 suit l’étape 0 ; les validations POC restantes ne conditionnent pas son démarrage.

### 2. Établir les routes API et la persistance SQLite — Fini

Le contrat des routes de projet est fixé pour un serveur local sans comptes :
un projet correspond à un `ElceDocument` v4. Son identifiant et son nom sont
ceux du document. La création envoie le document déjà créé côté éditeur ; le
serveur ne fabrique pas un second document initial. Cette correspondance est
retenue parce que le modèle courant ne possède pas d’entité Projet distincte.

- `GET /api/projects` renvoie `{ projects: [{ id, name, revision }] }`.
- `POST /api/projects` reçoit la valeur structurée `ElceDocumentData` v4 et
  renvoie `201` avec `{ project: { id, name, revision } }`. La révision initiale
  vaut `0`.
- `GET /api/projects/:projectId` renvoie `{ project, document }` et un `ETag`
  contenant la révision courante entre guillemets, par exemple `"0"`.
- `PATCH /api/projects/:projectId` reçoit `{ name }`, renomme le document et
  renvoie `{ project }` avec le nouvel `ETag` et une révision incrémentée.
- `DELETE /api/projects/:projectId` supprime le projet et renvoie `204`.
- `PUT /api/projects/:projectId/document` reçoit la valeur structurée v4 et
  `If-Match: "<revision>"`. Il renvoie le nouvel `ETag` ; une valeur périmée
  donne `412` et ne modifie rien. L’absence de `If-Match` donne `428`.
- La création renvoie aussi son `ETag`. Un JSON illisible, une version de
  document non prise en charge, un nom non textuel ou un document dont
  l’identifiant ne correspond pas à l’URL donne `400` ; un projet absent donne
  `404` ; un identifiant de création déjà présent donne `409`.
- Les erreurs JSON suivent `{ error: "<code>" }` avec les codes
  `invalid_request`, `project_not_found`, `project_already_exists`,
  `revision_mismatch` et `if_match_required`.
- Un corps JSON illisible ou d’une version de document non prise en charge
  donne `400` ; un projet absent donne `404` ; un identifiant de création déjà
  présent donne `409`.

L’implémentation active porte sur le routeur, le contrôleur HTTP et leur
frontière de persistance. La validation des données du document réutilise
`ElceDocument.fromJSON()` et `assertDocumentInvariants()` ; le contrôleur ne
reproduit pas les règles métier.

- **Fini le 7 octobre — contrat HTTP routeur/contrôleur :** les six opérations
  sont enregistrées dans le routeur Fetch Remix. Neuf tests exercent les
  réponses, les ETags, le renommage, la création en double, les documents
  invalides et le refus d’une révision périmée avec un dépôt isolé. Ils ne
  valident pas l’adaptateur SQLite ni le serveur en écoute.

- **Fini le 7 octobre — migration et dépôt SQLite :** `project-database.ts`
  applique la migration Remix versionnée ; `SqliteProjectPersistence` lit,
  écrit, renomme, liste et supprime les projets sans colonne de document JSON.
  Les tests routeur → contrôleur → SQLite couvrent les six opérations, les
  données relationnelles v4, l’ordre des relations, les révisions atomiques et
  la conservation des métadonnées média. Une base fichier contenant deux
  projets est fermée puis rouverte ; les projets restent lisibles.

Le schéma relationnel est fixé dans le
[premier état des tables SQLite](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md) :
les réglages d’évaluation sont des colonnes facultatives de `chapters`, les
entrées du scénario gardent l’ordre des pages/chapitres, les BDC gardent un
placement relationnel, et seuls `content_json` / `markup_html` contiennent le
contenu produit par Tiptap. La clé serveur d’un média reste `NULL` jusqu’à son
transfert ; les fichiers restent l’étape suivante du plan local-first. Le
raccord d’Évaluation au player est indépendant de ces données auteur et ne
bloque pas SQLite.

Procéder par une tranche verticale ; ne pas construire la base séparément des
opérations HTTP qui la sollicitent.

1. [x] Déclarer chaque chemin et méthode dans le routeur Remix, puis écrire le
   contrôleur correspondant. Le contrôleur valide la requête et appelle la
   frontière de persistance Elcé ; il ne porte pas les règles du document.
2. [x] Tester le contrat HTTP avec un dépôt de test. Ces tests vérifient les
   réponses routeur/contrôleur et ne remplacent pas les tests d’intégration
   SQLite.
3. [x] Implémenter cette frontière avec `remix/data-table/sqlite` et ses migrations.
   Le schéma relationnel suit le [premier état des tables SQLite](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md) : aucune table ne stocke le document Elcé complet en JSON. Seul le contenu Tiptap d’une Section reste dans `content_json`, avec son export dans `markup_html`.
4. [x] Tester les six opérations routeur → contrôleur → adaptateur SQLite sur
   une base isolée, puis fermer et rouvrir une base fichier et vérifier la
   lecture de plusieurs projets. Le listener HTTP local est assemblé avec les
   routes fichier à l’étape 3 ; cette étape exerce directement le routeur Fetch.

Avant le parcours multi-projets de l’éditeur, remplacer l’identifiant fixe de
`createInitialDocument()` par un identifiant propre à chaque nouveau document.
Le POST conserve l’identifiant ainsi créé ; le serveur n’en fabrique pas un
second.

Les routes servent d’abord le contrat d’API ; le schéma et les requêtes SQLite
sont établis avec leur contrôleur, sans exposer SQLite aux classes métier. Le
routeur navigateur SPA et le routeur serveur API gardent leurs tables et
responsabilités distinctes.

**Sortie :** atteinte. Les opérations de projet traversent les routes et
contrôleurs Remix jusqu’à SQLite ; une révision périmée est refusée sans
écrasement. Le listener et les routes de fichiers ont été assemblés et vérifiés
dans l’étape 3 ; l’étape 2 reste couverte par ses tests routeur/SQLite propres.

### 3. Brancher les fichiers média — Fini le 7 octobre

- **Méthode d’import fixée le 7 octobre :** `PUT` en corps brut. Les
  métadonnées et la taille attendue proviennent de `media_resources` ; le corps
  est écrit en flux dans un temporaire, puis transféré vers FileStorage Remix
  avant la publication de `storage_key` dans SQLite. Le parseur multipart
  `remix@3.0.0-rc.4` construit le `FileUpload` depuis les morceaux accumulés et
  ne convient donc pas aux vidéos longues dans ce parcours.
- Stocker les octets dans le FileStorage filesystem de Remix, et les métadonnées/références dans SQLite, en gardant l’étape de finalisation avant publication prévue par le plan local-first.
- Le serveur renvoie l’identifiant canonique quand les mêmes octets existent
  déjà dans une autre ressource du projet. La réconciliation du document par
  la commande métier de fusion appartient au transfert local-first, pas à ce
  listener.
- Lire les médias par `createFileResponse()` de Remix ; régler les entêtes de cache prévues par le plan local-first. L’aide fournit déjà le transfert fichier et les requêtes Range pour les médias, sans implémentation Elcé dédiée.
- Le builder reçoit les URL via son mapping `mediaSources`. Le transfert local-first choisira la source à fournir ; Sighty compile le manifeste puis appelle le preload CodPlay avant le montage de la scène. Elcé n’ajoute aucun préchargeur.

**Vérification :** `createElceHttpServer()` lance un vrai listener Node assemblant
les routes Remix, SQLite et FileStorage. Le test d’intégration envoie les
requêtes au serveur en écoute : import image/vidéo en flux, rejet d’une taille
incorrecte, URL de lecture, réponse vidéo `206 Range`, idempotence, signalement
d’un contenu déjà enregistré sous une autre ressource, retrait du fichier lors
de `media.merge`, nettoyage après suppression du projet, et reprise après
fichiers temporaires/orphelins présents au démarrage. Les tests ciblés SQLite/API,
les 190 tests Elcé, le typecheck et le build passent.

Le service média n’est pas encore raccordé au transfert local IndexedDB ou à
la sélection de source `mediaSources` du builder ; cette synchronisation
appartient au plan [local-first](./2026-10-06-elce-local-first-synchronisation-plan.md).
Pour la lecture, Sighty/CodPlay reste responsable du preload avant montage de
scène ; Elcé n’ajoute pas de circuit séparé.

**Sortie :** le listener serveur média, les routes HTTP et le stockage fichiers
sont intégrés et vérifiés en HTTP réel. La synchronisation de l’éditeur avec
cette API reste dans les étapes local-first.

### 4. Porter l’application par surfaces — Fini le 8 octobre

Porter l’affichage en gardant les commandes et l’ordre métier existants :

1. démarrage, restauration IndexedDB, gestion des projets, organisation des pages et réglages de chapitre ;
2. Section Tiptap, ancres, dépôt de médias et barre d’outils ;
3. éditeurs Question, Résultat, Carte autonome et Carousel ; l’éditeur de Carte
   reste partagé entre une Carte directe Flux ou Diapo et les Cartes enfants du Carousel.

**Décision appliquée le 8 octobre — aucun pont React dans la page Remix :**
`RemixPageEditor` rend chaque type BDC à sa position dans la séquence. La
Section conserve `SectionTiptapAdapter`. Question, Résultat, Carte directe et
Carousel avec ses Cartes enfants reçoivent des vues Remix natives. Ces vues
réutilisent `EditorActionsFacade`, les façades de domaine et l’unique acteur
XState ; elles ne créent ni état documentaire, ni commande, ni circuit média
parallèles. L’ancien `ReactBdcEditorTempBridge` et les routes de preuve ont été
supprimés après validation de la page de production.

**Décision de placement acceptée par l’auteur le 8 octobre :** une Carte peut
être ajoutée directement à une page Flux dans sa séquence BDC, et directement
à une Diapo comme son unique BDC ; les Cartes enfants du Carousel restent dans
son éditeur partagé. Les commandes, builders Elcé, tests de placement et page
Remix de production couvrent ces deux placements. Les spécifications du modèle
documentaire et du Carousel ont été actualisées.

Les scènes et leur composition Sighty/CodPlay ne changent pas. Le lecteur popup
est maintenant lui aussi rendu par Remix dans l’étape 5 ; le workspace Elcé ne
garde aucune surface React.

**Avancement du 8 octobre :** `ProjectApplication` et `RemixPageEditor` rendent
les surfaces auteur et les cinq BDC dans Remix. Question, Résultat, Carte
autonome et Carousel réutilisent les façades existantes ; les Cartes directes
Flux et Diapo et les Cartes enfants du Carousel partagent les mêmes champs.
Les tests de production vérifient l’ordre, l’édition, l’import média par
Question/Carte/Carousel, la relation et le réordonnancement des Cartes enfants,
le déplacement d’un BDC, le changement de page et le désabonnement XState. Le
test Section vérifie également son média et son ancre dans la même page de
production. Les preuves et le pont BDC temporaires ont été retirés. Brave
DevTools est maintenant appelable dans cette session ; son contexte isolé a
vérifié les réglages d’un chapitre Évaluation, l’édition Question/Résultat/
Carte, les Cartes directes Flux/Diapo, le Carousel et son ordre, ainsi que le
dépôt d’une image dans une Section. Le lecteur a aussi chargé cette image depuis
l’URL serveur. Les projets des premiers parcours ont été supprimés et leur
IndexedDB nettoyée. Le test de régression actuel a créé un nouveau Projet 2
avec son document et un média ; il reste présent après le rejet de la demande
de suppression permanente par l’auto-review, faute d’autorisation explicite.
La restitution des sélections est vérifiée. La réacquisition après un
changement réel de visibilité est explicitement reportée par l’auteur à une
tranche fondée sur l’usage réel ; elle ne bloque pas la fin du portage auteur.
Le Projet 2 créé pour un test reste intact après le rejet de sa suppression par
l’auto-review ; ce nettoyage de données n’est pas une acceptation du portage.

**Acceptation de la composition :** les tests du runtime Remix couvrent une
page contenant les cinq types BDC, l’ordre, les commandes, la sélection,
l’édition des champs, les imports média, les relations et l’ordre des Cartes
enfants, la Carte directe en Flux et Diapo et le nettoyage au changement de
page. Les preuves temporaires et le pont React BDC sont supprimés. Brave
DevTools est configuré avec `npx -y brave-mcp@latest` et expose 30 outils
appelables dans cette session. Dans un projet d’essai isolé, le parcours a
vérifié les réglages centraux d’un chapitre Évaluation (seuil 80 %, tentatives
illimitées, toutes les questions), l’édition de Question/Résultat/Carte, les
Cartes directes Flux et Diapo, la Carte enfant, et le réordonnancement du
Carousel. Un dépôt d’image synthétique dans la Section de production a créé une
ancre et chargé l’image depuis l’URL média serveur. Les scripts de la page
auteur et lecteur servis par Remix n’ont demandé aucun asset React ou ReactDOM.

- [x] Recharger l’éditeur dans Brave et vérifier que Brave DevTools reste
  callable, puis contrôler la liste API et l’IndexedDB de l’origine de test.
- [reportée — nettoyage de données hors acceptation du portage] Le Projet 2
  temporaire reste conservé : l’auto-review a rejeté sa suppression définitive
  faute d’autorisation explicite. Aucune suppression n’a été retentée.
- [x] Résoudre les médias confirmés par leur URL serveur dans le lecteur et
  garder le Blob local seulement pendant un transfert en attente. **Décision
  acceptée le 8 octobre :** URL serveur et cache HTTP. La régression ciblée du
  popup, le typecheck et le build passent. Brave confirme le transfert de
  `brave-preview-contract.png`, son absence du store IndexedDB après upload,
  puis son rendu dans l’éditeur et le lecteur depuis la même URL API ; le popup
  affiche une image décodée de 1 × 1 px, sans alerte ni erreur console.
- [x] Corriger et vérifier l’édition d’une Carte ancrée après dépôt PNG dans
  la Section Remix. L’ancien test dispatchait un clic synthétique sur le SVG
  et ne prouvait pas la réponse à un clic physique. Le conteneur large laisse
  maintenant passer les pointeurs ; seul le bouton de `1.75rem` capte le
  clic. Brave vérifie après rechargement que son centre cible le bouton,
  qu’un clic physique ouvre l’éditeur partagé du même BDC et que le point
  central du conteneur retombe sur le contenu dessous. Le layout `photo-basic`
  et l’ajustement `cover` sont affichés ; le test de production clique le vrai
  bouton et vérifie le même éditeur. Les deux suites ciblées passent et le
  typecheck réussit. Aucun BDC ni circuit média supplémentaire n’est créé.
- [x] Corriger la restitution des sélections enregistrées dans les sélecteurs
  natifs Remix. Décision de l’auteur du 8 octobre : la configuration fournit
  les valeurs initiales ; une valeur sauvegardée ne change pas après navigation
  ou rechargement. Cause : le renderer appliquait `value` au `<select>` avant
  d’insérer ses options, ce qui laissait la première option sélectionnée au
  montage. Les options reflètent maintenant le snapshot dans Chapitre,
  Question, Résultat, Carte et Carousel. Les tests couvrent les remounts, dont
  une transition Zoom explicitement sauvegardée. Dans Brave, Manuel et Zoom
  restent affichés après Page A → Page B → Page A et rechargement complet ;
  IndexedDB et l’API confirment `playbackMode: manual` et
  `revelation.intro/outro: zoom`. La Carte ancrée restitue également
  `photo-basic` et `cover`. Le détail vérifié est inscrit dans les
  spécifications Remix, Carousel et ancre.
- [reportée — nettoyage de données hors acceptation du portage] Le Projet 2
  temporaire et son média ne sont pas supprimés. L’auto-review a rejeté cette
  suppression faute d’autorisation utilisateur explicite ; ne pas retenter
  cette action sans nouvel accord.
- [x] Brave DevTools, hors réseau : après édition du titre d’une page, le
  `PUT /document` échoue avec `ERR_INTERNET_DISCONNECTED`. L’ouverture de l’autre
  projet échoue aussi sur `GET /api/projects` ; le projet courant reste ouvert,
  son document local conserve le nouveau titre avec le checkpoint `pending`,
  puis le retour réseau le synchronise à la révision serveur 1. Le projet
  temporaire est supprimé ensuite.
- [x] Brave DevTools, deux pages du même contexte : la seconde fenêtre qui
  ouvre le même projet affiche l’attente et le rappel de fermer l’autre fenêtre.
  Elle prend ensuite le verrou, modifie le titre et le synchronise à la
  révision serveur 1 ; IndexedDB contient le même document. Après fermeture de
  la seconde page, la première reste en attente jusqu’à son rechargement, qui
  restaure le titre local et le synchronise. Les deux pages restaient
  `visibilityState: visible` dans MCP ; le comportement après un vrai
  changement de visibilité n’a donc pas été observé. Par décision de l’auteur
  du 8 octobre, cette amélioration est reportée à une tranche ultérieure, après
  un usage réel susceptible d’en établir le besoin. Aucun correctif ni test
  dédié n’est à ajouter dans cette tranche. Le projet temporaire a
  été supprimé et le Projet 1 reste à la révision 0.

**Menu et cycle de vie des projets — parcours de base vérifiés le 7 octobre :**

- [x] Menu Remix au titre « Elcé » ; liste serveur, création, ouverture,
  fermeture, renommage, suppressions active et inactive.
- [x] Mêmes façade et acteur XState ; restauration du projet par onglet,
  transfert du verrou et retour à l’éditeur après activation.
- [x] Safari Technology Preview via MCP : création, renommage, fermeture,
  réouverture, suppression active/inactive, deux onglets sur des projets
  différents et restauration après rechargement. Les projets temporaires ont
  été supprimés ; `elce-document` est resté à la révision 0.
- [x] Tester le contrôleur, la persistance locale et le coordinateur de
  synchronisation quand une commande Section est acceptée pendant une demande
  de changement : l’édition est enregistrée avant l’envoi et reste dans le
  projet courant après un conflit ou une erreur réseau. Vérification ciblée
  dans `project-operations.test.ts`.
- [x] Brave DevTools : une édition en attente reste dans le projet courant
  quand le `PUT /document` et la lecture du catalogue échouent hors réseau ; sa
  synchronisation reprend après la reconnexion.
- [x] Brave DevTools : une seule fenêtre obtient le verrou du même projet ; la
  deuxième attend avec son espace auteur masqué. Après le changement de titre
  et la fermeture de la fenêtre active, le rechargement restaure la dernière
  copie locale et reprend la synchronisation.
- [reportée — prochaine tranche, sur signal d’un usage réel] Réacquisition à la
  reprise de focus ou de visibilité sans rechargement. L’auteur juge cette
  amélioration prématurée tant qu’aucun utilisateur en situation réelle n’en a
  montré l’utilité ; les simulations actuelles ne l’établissent pas. Ne pas
  développer ni ajouter de test dédié maintenant. Réexaminer le besoin si
  l’usage réel le fait apparaître. `project-operations.test.ts` couvre
  séparément le conflit de révision `If-Match`.

Le détail du comportement vérifié est dans la
[spécification de gestion du projet actif](../specs/project-session-spec.md).

**Organisation du Scénario, réglages et catalogue — portage Remix en cours :**

- [x] Rendre le Scénario, ses déplacements par séparateurs, les réglages
  centraux de chapitre et le catalogue dans le runtime Remix, en s’abonnant au
  même acteur XState et en utilisant `EditorActionsFacade`.
- [x] Garder deux commandes distinctes de création à la racine : une page Flux
  et une Diapo. Chaque chapitre propose également une page Flux ou une Diapo.
  Le contrat d’organisation a été actualisé pour refléter ces commandes.
- [x] Tests du workspace et de `ProjectApplication` : création contextualisée,
  ordre mixte, déplacement par séparateurs, sélection de chapitre, onglets du
  catalogue et remplacement de la zone centrale.
- [x] Safari Technology Preview via MCP : Diapo racine, séparateur racine,
  onglets du catalogue et absence d’identifiants DOM dupliqués.
- [x] Brave DevTools : sélectionner un chapitre Évaluation affiche le seuil
  fixe de 80 %, les tentatives illimitées et la reprise de toutes les
  questions. Ce parcours a utilisé un projet isolé, ensuite supprimé.

Un menu de gestion des projets se trouve au niveau du titre « Elcé ». Il permet de créer, ouvrir, fermer et supprimer des projets. L’exportation viendra plus tard. Cette liste de projets est distincte du catalogue de contenus (pages, BDC et médias) de l’éditeur. Le menu, le Scénario, les réglages de chapitre et le catalogue sont portés dans Remix, sans ajouter une seconde source d’état ni un circuit de commandes parallèle.

La liste des projets lit les résumés du serveur. Plusieurs onglets peuvent éditer indépendamment leurs projets. La base IndexedDB reste locale au navigateur et conserve une entrée distincte par projet ouvert ; ce n’est pas une réplication de la cache vers le serveur. `ProjectEditorLock` reste exclusif par projet : des projets différents peuvent être édités en parallèle, tandis qu’un même projet reste éditable par une seule fenêtre à la fois. Dans un onglet, le changement de projet attend l’accusé serveur du document et de ses médias ; en cas d’échec ou de conflit, le projet courant reste ouvert.

La commande « Fermer » revient à la liste des projets sans supprimer le projet serveur ; elle retire la copie locale après la confirmation de synchronisation. À la création, le nom est généré automatiquement et peut être modifié ensuite.

L’acceptation vérifie deux fenêtres sur des projets différents, éditant chacune son document sans modifier la cache de l’autre, puis deux fenêtres sur le même projet, où le verrou existant n’autorise qu’un seul éditeur. L’IndexedDB garde les caches locales distinctes par identifiant de projet ; les projets non ouverts restent servis par SQLite et FileStorage.

Chaque surface d’édition passe par l’acteur et les commandes existants. Les tests de chaque étape vérifient qu’une édition, un changement de page et une réouverture ne modifient pas le document de façon inattendue. Les scènes restent composées par Sighty/CodPlay ; les vues et l’hôte popup Elcé restent inclus dans la cible de retrait complet de React.

**Acceptation de la gestion des projets :** depuis le menu au titre, parcourir la liste serveur, créer et ouvrir un projet, fermer le projet courant sans le supprimer, ouvrir un autre projet après l’accusé serveur complet, supprimer un projet inactif, puis supprimer le projet actif. Vérifier qu’une erreur de réseau/conflit conserve le document et la cache du projet concerné, qu’une édition faite pendant l’attente est aussi enregistrée, et que le rechargement restaure le projet propre à l’onglet. Le parcours navigateur utilise le MCP Brave DevTools, seul des deux serveurs locaux fonctionnel actuellement. Le menu appelle la même façade et le même acteur XState que l’éditeur.

**Sortie :** les parcours auteur fonctionnent dans le runtime Remix avec le même document ; la sortie vers le player Sighty/CodPlay utilise les sources média confirmées par URL serveur. Les comportements encore ouverts restent au plan.

### 5. Retirer React du workspace Elcé — En cours, validation d’origine en attente

- [x] Rendre les contrôles du lecteur popup dans Remix, en gardant la fenêtre
  distincte, le protocole de synchronisation, le cycle de vie média et la
  composition Sighty/CodPlay. [`player-preview-spec.md`](../specs/player-preview-spec.md)
  décrit le comportement et ses preuves.
- [x] Retirer `AppLayout`, les vues BDC React, leur hôte auteur historique et
  les tests React remplacés par les tests du runtime Remix.
- [x] Supprimer `react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`,
  `@xstate/react`, `@tiptap/react` et `lucide-react` des dépendances Elcé.
  Aucun code de production ou test Elcé ne les importe. Le monorepo garde
  React pour `@codplay/editor`, un autre workspace explicitement hors de cette
  tranche.
- [x] Écrire en JSX les 16 composants Remix et les 6 tests Elcé qui construisent
  des éléments JSX ; renommer ces fichiers en `.tsx`. Configurer le runtime
  automatique TypeScript avec `jsxImportSource: "remix/ui"`. Tous les parents
  du markup natif ont un `id` explicite. Les modules compilés chargent le
  runtime Remix sans importer React.
- [x] Relier `npm run dev:elce` au serveur d’assets Remix, au routeur navigateur
  `remix/spa` et au serveur API Fetch séparé. Vite reste utilisé par le
  lanceur comme chargeur SSR du module serveur, et par build/tests ; il ne
  démarre pas de listener web ni de plug-in React pour Elcé.
- [x] Exécuter `npm run dev:elce` depuis la racine. Comme l’ancien serveur Vite
  occupe `localhost:5175`, le nouveau serveur Remix s’est lancé sur
  `localhost:5176` et a réutilisé l’API existante sur `127.0.0.1:5181`. Brave
  y a ouvert la liste des projets, puis Projet 1 et son popup natif. La page
  Lecture a affiché la Diapo B et cinq images complètes chargées depuis les
  URL API ; « Réafficher la page éditée » a renvoyé la page sélectionnée. Le
  lanceur avertit que le port de repli a une IndexedDB distincte. Les consoles
  étaient vides et aucun asset React ou ReactDOM n’a été demandé.
- [x] Exécuter la suite complète Elcé : 36 fichiers et 206 tests passent.
  Le typecheck passe. Le build Vite réussit sur 581 modules ; le chunk
  JavaScript fait `1 314,76 kB` minifiés (`372,33 kB` gzip) et garde
  l’avertissement de taille supérieur à `500 kB`.
- [ ] Relire les documents v4 déjà présents dans l’IndexedDB de
  `http://localhost:5175/`, sans réinitialiser cette base ni perdre ses médias.
  Le port 5175 reste occupé par un serveur Vite existant ; son rechargement Brave
  a renvoyé `504 (Outdated Optimize Dep)` et une page vide, donc cette preuve
  n’est pas valide. Le test sur `localhost:5176` ne peut pas la remplacer, car
  un port différent forme un autre origin. Laisser ce serveur et ses données
  intacts ; reprendre ce contrôle après son arrêt explicite, puis démarrer le
  lanceur Remix sur `localhost:5175`.
- [x] Actualiser les spécifications de l’entrée Remix et du lecteur avec les
  surfaces natives et les preuves validées. La continuité IndexedDB reste au
  plan jusqu’au contrôle d’origine ci-dessus.

**Sortie provisoire :** le portage est appliqué, les surfaces Elcé et les tests
sont sans React, et le nouveau lanceur Remix fonctionne. L’étape reste en
cours uniquement pour la validation de continuité des données sur l’origine
`localhost:5175` ; aucune base n’a été remise à zéro.

## Références

- [Étude de faisabilité Remix 3](../notes/2026-10-06-etude-transposition-remix-3.md)
- [Audit séparation métier/interface](./2026-10-06-audit-separation-metier-interface-remix.md)
- [Tables SQLite proposées](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md)
- [Modèle de document Elcé](../specs/document-model-spec.md)
- [Édition d’une Section](../specs/section-editor-spec.md)
- [Preview lecteur](../specs/player-preview-spec.md)
- [Entrée Remix SPA](../specs/remix-spa-spec.md)
- [API locale des projets](../specs/project-api-spec.md)
- [Plan local-first](./2026-10-06-elce-local-first-synchronisation-plan.md)
