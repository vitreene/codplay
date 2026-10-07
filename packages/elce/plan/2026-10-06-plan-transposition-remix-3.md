# Elcé — plan de transposition vers Remix 3

**Statut : En cours — étapes 0, 1 et 2 Finies ; étape 3 À faire.** Node minimum déclaré, Remix 3.0.0-rc.4 installé, routeur SPA et composition XState partagée vérifiés dans Safari Technology Preview via MCP. L’acceptation globale du POC ne bloque pas le portage de l’interface. Le schéma persistant est maintenant fixé dans le plan local-first et sa note de données.

Ce plan complète le [plan de stockage local et synchronisation](./2026-10-06-elce-local-first-synchronisation-plan.md). Ce dernier reste l’autorité sur IndexedDB, SQLite, les révisions, les fichiers média et l’ordre de synchronisation.

## Invariants de migration

- La cible est le runtime de composants Remix 3 sans React ; la version fixée pour ce portage est `3.0.0-rc.4`, acceptée le 7 octobre 2026, pas Remix v2 ni React Router Framework Mode.
- Le périmètre du portage est l’interface auteur de l’éditeur. Le player, ses scènes et sa composition restent gérés par Sighty/CodPlay et ne sont pas portés vers Remix.
- L’interface auteur utilise le routeur navigateur `remix/spa` ; les routes API utilisent un routeur Fetch serveur distinct. L’API n’affiche pas l’éditeur et ses réponses ne remplacent pas l’état éditorial.
- Le contrôleur XState reste propriétaire de l’état éditorial. Les gestes métier passent par les commandes et façades déjà définies.
- Les classes métier, le modèle ElceDocument, les builders de scènes et la composition Sighty/CodPlay ne dépendent pas de Remix.
- La migration d’interface ne change ni les documents v4 d’IndexedDB, ni le scénario, ni les scènes et contenus existants.
- Le serveur utilise les frontières d’infrastructure Elcé pour SQLite et les fichiers ; les règles métier ne sont pas déplacées dans les contrôleurs.
- Les autres paquets du monorepo peuvent conserver React. Les surfaces auteur portées ne l’utilisent plus ; dans le workspace Elcé, ne retirer une dépendance React que si le player hors périmètre ne l’utilise pas.

## Étapes et critères de sortie

### 0. Préparer le moteur Remix — Fini

- Déclarer Node 24.3.0 ou plus récent comme moteur minimal du seul workspace Elcé. C’est fait dans `packages/elce/package.json` ; le Node local 26.10.0 satisfait cette contrainte.
- Installer et fixer `remix@3.0.0-rc.4` dans le seul workspace Elcé. C’est fait ; l’installation npm a réussi.
- Démarrer l’éditeur avec le routeur navigateur `remix/spa` et un routeur serveur séparé réservé aux réponses API.
- Monter temporairement l’éditeur React existant sous un hôte conservé par `data-rmx-preserve-dom`, nommé `ReactEditorTempBridge`. Ce raccord réutilise exactement l’acteur XState et la persistance existants ; il ne crée aucun état ni commande parallèle. Le supprimer après le portage de toutes les surfaces auteur prévu à l’étape 4.
- Préparer le routeur Fetch API dans un module serveur distinct, sans démarrer de listener ni ajouter de route avant les opérations SQLite et fichiers prévues aux étapes 2 et 3.
- Vérifier que l’installation, le démarrage, les scripts du workspace et le build fonctionnent sous le moteur retenu, sans modifier les autres workspaces.

**Sortie :** le workspace Elcé démarre et se construit avec la SPA Remix et `ReactEditorTempBridge`; le routeur Fetch API reste séparé et sans listener jusqu’à la tranche serveur.

**Vérification :** installation `remix@3.0.0-rc.4` dans le workspace Elcé ; route `/` et fallback rendus par `remix/spa` ; Safari confirme l’affichage de l’éditeur et conserve exactement le host lors d’une navigation SPA vers une route inconnue. Le test Fetch confirme la réponse 404 du routeur API sans serveur en écoute. Typecheck, 164 tests et build passent. Le build actuel émet un chunk de 1 557 292 octets minifiés (441 916 octets gzip) ; la limite Vite de 500 KiB s’applique avant gzip. L’audit du graphe montre que le chunk inclut aussi le player par import statique ; l’avertissement ne peut donc pas être attribué à la seule cohabitation React/Remix.

### 1. Prouver l’interface Remix avec les vraies frontières Elcé — Fini

Dans une tranche isolée de l’application Elcé, utiliser le vrai routeur SPA Remix : `createRouter`, le middleware `render()` et `run()`. Une route retourne le composant Remix de la surface ; les routes API restent dans le routeur serveur et ne font pas partie de cette preuve.

- **Fini :** contrats et transformations documentaires déplacés dans `domain/commands/` ; façades déplacées dans `app/facades/` ; props React des champs Carte déplacées dans `app/editor/card/`. Les tests, le typecheck et le build passent sans changement de comportement.
- **Fini :** l’entrée navigateur compose l’acteur, le store et l’attachement de persistance une seule fois. La racine Remix reçoit cet acteur dans son Context ; le pont React reçoit la même instance. Safari recharge l’éditeur restauré sans erreur de console.
- **Fini le 7 octobre :** extraire de `AppLayout` la façade d’actions et le modèle de vue prévus par l’audit. L’entrée navigateur crée `EditorActionsFacade` une fois et transmet la même instance ; `AppLayout` ne fabrique plus les commandes documentaires et utilise le sélecteur pur `selectEditorViewModel`. Les événements, commandes et règles UI restent identiques.
- **Fini le 7 octobre :** éprouver dans le runtime Remix l’accès au contrôleur par `EditorContextProvider`, l’abonnement d’une vue aux snapshots, le rendu par `handle.update()` et le désabonnement au signal de durée de vie. Le composant et la route `?__remixProof=1` sont des preuves temporaires de cycle de vie : les retirer quand les vues Carte et Section portées remplacent leur équivalent React et que leurs propres parcours valident le même abonnement et nettoyage.
- **Fini le 7 octobre :** la route temporaire `?__remixCardProof=1` édite une Carte directe de Diapo et une Carte enfant de Carousel avec les mêmes champs, presets et règles de Carte. Les modifications passent par `EditorActionsFacade`, les façades Carte/Carousel existantes et l’acteur XState ; les deux placements restent distincts. Tests de composant et parcours Safari réussis, y compris conservation des champs au changement de preset et rendu des icônes Lucide.
- **Fini le 7 octobre — preuve Section Tiptap sans React dans Remix :** `SectionTiptapAdapter` utilise `@tiptap/core`, le cycle `ref` et les commandes Remix `on`; il garde les transactions, dépôts et déplacements ProseMirror raccordés aux mêmes façades et au même acteur XState. Les tests vérifient le titre, le JSON/HTML, H3 italique, gras, dépôt d’image, persistance, aperçu média, déplacement d’ancre et conservation de la même instance Editor/du DOM. Safari Technology Preview via MCP confirme que `&frame=2` garde le même élément `.ProseMirror` après navigation, vérifié par identité DOM, et ne produit pas d’erreur ni d’avertissement dans la console de la session de test. Le parcours ne contient aucun import React ; la surface principale reste dans le pont temporaire en attendant le portage des autres surfaces.
- **Fini le 7 octobre :** « Prévisualiser » continue d’ouvrir le lecteur Sighty/CodPlay. Le player conserve les paramètres de la route auteur ; le routeur ignore les preuves temporaires quand l’acteur n’est pas présent. Safari confirme l’ouverture de « Lecture Elcé » sans erreur de console après rechargement.
- **Fini le 7 octobre :** compiler isolément les entrées de preuve Carte et Section et contrôler leur graphe d’import. Aucun module React, `@tiptap/react` ou `lucide-react` n’est présent dans ces surfaces Remix. Ce contrôle ne prétend pas retirer React de l’entrée complète, qui conserve `ReactEditorTempBridge` et le player hors périmètre.
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
écrasement. Le listener local et les routes de fichiers restent à réaliser à
l’étape 3.

### 3. Brancher les fichiers média — À faire

- Déclarer les routes d’import et de lecture média, puis recevoir images et
  vidéos avec le parsing multipart en flux de Remix.
- Stocker les octets dans le FileStorage filesystem de Remix, et les métadonnées/références dans SQLite, en gardant l’étape de finalisation avant publication prévue par le plan local-first.
- Conserver le service de déduplication et le transfert local déjà définis.
- Lire les médias par réponse fichier Remix ; vérifier les entêtes de cache décidées par Elcé et les réponses Range pour les vidéos sans charger le fichier complet en mémoire.

**Sortie :** upload réel, réutilisation d’un média identique, accès URL à une image et lecture partielle d’une vidéo vérifiés dans le navigateur.

### 4. Porter l’application par surfaces — À faire

Porter l’affichage en gardant les commandes et l’ordre métier existants :

1. démarrage, restauration IndexedDB, catalogue, organisation des pages et réglages de chapitre ;
2. Section Tiptap, ancres, dépôt de médias et barre d’outils ;
3. éditeurs Question, Résultat, Carte autonome et Carousel ; l’éditeur de Carte
   reste partagé entre une Carte directe Diapo et les Cartes enfants du Carousel.

Chaque surface d’édition passe par l’acteur et les commandes existants. Les tests de chaque étape vérifient qu’une édition, un changement de page et une réouverture ne modifient pas le document de façon inattendue. Le player mobile et le rendu de lecture restent sous Sighty/CodPlay et hors du portage.

**Sortie :** les parcours auteur fonctionnent dans le runtime Remix avec le même document ; la sortie vers le player Sighty/CodPlay reste inchangée.

### 5. Clore le portage de l’interface auteur — À faire

- Retirer des surfaces de l’éditeur les imports React, @xstate/react, @tiptap/react et lucide-react remplacés par le runtime Remix. Supprimer une dépendance du workspace uniquement si elle n’est plus utilisée ailleurs ; préserver celles requises par le player hors périmètre.
- Relier les scripts du workspace Elcé au CLI, au serveur et au rendu d’assets Remix. Garder Vite dans les autres workspaces ; ne le retirer d’Elcé que si le nouveau serveur remplace réellement son usage.
- Porter les tests de route, composants et interactions de l’éditeur vers les outils Remix documentés. Garder les tests purs du domaine et de XState indépendants du navigateur ; ne pas porter les tests du player.
- Vérifier que les documents v4 présents dans IndexedDB restent lisibles au même origin, sans remise à zéro ni perte de médias. Les documents v1, v2 et v3 sont rejetés par le modèle actuel, sans migration implicite.
- Exécuter typecheck, build, tests domaine/commandes/stockage, tests HTTP SQLite/fichiers et parcours auteur dans le navigateur MCP fourni par l’environnement de validation.
- Mettre à jour les spécifications touchées avec le comportement et les preuves réellement vérifiés ; clore le plan seulement quand les preuves navigateur et données sont complètes.

**Sortie :** l’interface auteur ne dépend plus de React ; son build, ses tests, les parcours document et serveur sont acceptés. Le player reste dans son circuit Sighty/CodPlay inchangé.

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
