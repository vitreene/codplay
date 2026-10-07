# Elcé — plan de transposition vers Remix 3

**Statut : En cours — étape 0 Fini ; étape 1 En cours.** Node minimum déclaré, Remix 3.0.0-rc.4 installé, routeur SPA et composition XState partagée vérifiés dans Safari. Le POC actuel reste la référence de comportement à préserver, sans constituer un préalable à la migration.

Ce plan complète le [plan de stockage local et synchronisation](./2026-10-06-elce-local-first-synchronisation-plan.md). Ce dernier reste l’autorité sur IndexedDB, SQLite, les révisions, les fichiers média et l’ordre de synchronisation.

## Invariants de migration

- La cible est le runtime de composants Remix 3 sans React ; la version fixée pour ce portage est `3.0.0-rc.4`, acceptée le 7 octobre 2026, pas Remix v2 ni React Router Framework Mode.
- Le périmètre du portage est l’interface auteur de l’éditeur. Le player, ses scènes et sa composition restent gérés par Sighty/CodPlay et ne sont pas portés vers Remix.
- L’interface auteur utilise le routeur navigateur `remix/spa` ; les routes API utilisent un routeur Fetch serveur distinct. L’API n’affiche pas l’éditeur et ses réponses ne remplacent pas l’état éditorial.
- Le contrôleur XState reste propriétaire de l’état éditorial. Les gestes métier passent par les commandes et façades déjà définies.
- Les classes métier, le modèle ElceDocument, les builders de scènes et la composition Sighty/CodPlay ne dépendent pas de Remix.
- La migration d’interface ne change ni les données v3 d’IndexedDB, ni le scénario, ni les scènes et contenus existants.
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

**Vérification :** installation `remix@3.0.0-rc.4` dans le workspace Elcé ; route `/` et fallback rendus par `remix/spa` ; Safari confirme l’affichage de l’éditeur et conserve exactement le host lors d’une navigation SPA vers une route inconnue. Le test Fetch confirme la réponse 404 du routeur API sans serveur en écoute. Typecheck, 164 tests et build passent ; le build signale le bundle temporairement supérieur à 500 kB, attendu tant que React et Remix cohabitent.

### 1. Prouver l’interface Remix avec les vraies frontières Elcé — En cours

Dans une tranche isolée de l’application Elcé, utiliser le vrai routeur SPA Remix : `createRouter`, le middleware `render()` et `run()`. Une route retourne le composant Remix de la surface ; les routes API restent dans le routeur serveur et ne font pas partie de cette preuve.

- **Fini :** contrats et transformations documentaires déplacés dans `domain/commands/` ; façades déplacées dans `app/facades/` ; props React des champs Carte déplacées dans `app/editor/card/`. Les tests, le typecheck et le build passent sans changement de comportement.
- **Fini :** l’entrée navigateur compose l’acteur, le store et l’attachement de persistance une seule fois. La racine Remix reçoit cet acteur dans son Context ; le pont React reçoit la même instance. Safari recharge l’éditeur restauré sans erreur de console.
- **À faire :** extraire de `AppLayout` l’adaptateur d’actions et le modèle de vue applicatifs comme prévu par l’audit avant de raccorder de nouvelles surfaces Remix. Ce déplacement ne change ni les événements ni les commandes XState.
- **À faire :** les composants Remix lisent l’acteur par le `Context` ; une vue s’abonne à ses snapshots, conserve uniquement le snapshot nécessaire au rendu et demande une mise à jour avec `handle.update()`. Elle désabonne avec le signal de durée de vie de son `Handle`. À la navigation SPA puis au démontage, vérifier l’absence d’acteur dupliqué ou d’abonnement orphelin.
- Éditer une Carte autonome directe dans une Diapo et une Carte enfant de Carousel avec le même rendu de champs et `ElceCardFacade`. Une modification passe par la façade, la commande existante et l’acteur XState ; le document doit conserver leurs placements distincts.
- Remplacer le raccord React de la Section par `@tiptap/core` `Editor`, sans réécrire l’extension d’ancre. Monter l’éditeur sur l’élément DOM fourni par le cycle de vie documenté du composant Remix ; vérifier édition, sélection de toolbar, import d’image et déplacement d’ancre. Vérifier le maintien du DOM ProseMirror à travers une navigation de frame ; si nécessaire, éprouver `data-rmx-preserve-dom` sur le plus petit hôte Tiptap.
- Vérifier que la commande de prévisualisation de l’éditeur continue de lancer le player Sighty/CodPlay existant ; ne pas porter son rendu, ses builders ou sa composition.
- Vérifier que le bundle de la surface Remix portée n’utilise pas React. Le contrôle complet de l’éditeur sans React reste à l’étape 5, après retrait du `ReactEditorTempBridge`. Garder les dépendances du workspace encore requises par le player hors périmètre.
- Exécuter un test de composant dans le navigateur avec le runtime Remix, puis le parcours réel SPA dans Safari, Firefox et Chromium. Le premier valide le montage, l’abonnement XState et son nettoyage ; le second vérifie le rendu après commande, la navigation et le cycle Tiptap.
- Ne pas toucher aux API, au schéma SQLite, au transfert des médias, au modèle v3 ou aux scènes du player dans cette étape.

**Sortie :** parcours auteur vérifié dans le vrai routeur SPA Remix avec commande, Carte et Section Tiptap ; état éditorial toujours possédé par le même acteur XState ; aucune route API, table SQLite, scène ni composition Sighty/CodPlay modifiée. L’étape 1 suit l’étape 0 ; les validations POC restantes ne conditionnent pas son démarrage.

### 2. Établir les routes API et la persistance SQLite — À faire

Procéder par une tranche verticale ; ne pas construire la base séparément des
opérations HTTP qui la sollicitent.

1. Décrire dans le plan de routes les opérations déjà définies par le plan
   local-first : lister, créer, ouvrir, renommer et supprimer un projet ;
   enregistrer et lire son instantané avec révision.
2. Déclarer chaque chemin et méthode dans le routeur Remix, puis écrire le
   contrôleur correspondant. Le contrôleur valide la requête et appelle une
   frontière de persistance Elcé ; il ne porte pas les règles du document.
3. Implémenter cette frontière avec remix/data-table/sqlite et ses migrations.
   Le schéma relationnel suit le [premier état des tables SQLite](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md) : aucune table ne stocke le document Elcé complet en JSON. Seul le contenu Tiptap d’une Section reste dans `content_json`, avec son export dans `markup_html`.
4. Pour chaque opération, tester le parcours routeur → contrôleur → adaptateur
   SQLite avec une base isolée. Ensuite, vérifier le même parcours avec le
   fichier SQLite du serveur local après redémarrage.

Les routes servent d’abord le contrat d’API ; le schéma et les requêtes SQLite
sont établis avec leur contrôleur, sans exposer SQLite aux classes métier. Le
routeur navigateur SPA et le routeur serveur API gardent leurs tables et
responsabilités distinctes.

**Sortie :** les opérations de projet traversent les routes et contrôleurs
Remix jusqu’à SQLite ; une révision périmée est refusée sans écrasement.

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
- Vérifier les documents v3 présents dans IndexedDB au même origin, sans remise à zéro, migration implicite ou perte de médias.
- Exécuter typecheck, build, tests domaine/commandes/stockage, tests HTTP SQLite/fichiers et parcours auteur dans Safari, Firefox et Chromium.
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
- [Plan local-first](./2026-10-06-elce-local-first-synchronisation-plan.md)
