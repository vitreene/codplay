# Elcé — plan de transposition vers Remix 3

**Statut : Fixe — cible, moteur et mode SPA acceptés ; migration non commencée.** Le POC actuel reste la référence à préserver pendant le portage.

Ce plan complète le [plan de stockage local et synchronisation](./2026-10-06-elce-local-first-synchronisation-plan.md). Ce dernier reste l’autorité sur IndexedDB, SQLite, les révisions, les fichiers média et l’ordre de synchronisation.

## Invariants de migration

- La cible est Remix 3 stable et son runtime de composants sans React, pas Remix v2 ni React Router Framework Mode.
- Le périmètre du portage est l’interface auteur de l’éditeur. Le player, ses scènes et sa composition restent gérés par Sighty/CodPlay et ne sont pas portés vers Remix.
- L’interface utilise le mode SPA de Remix ; le serveur Remix porte les routes backend sans rendre ni remplacer l’état éditorial.
- Le contrôleur XState reste propriétaire de l’état éditorial. Les gestes métier passent par les commandes et façades déjà définies.
- Les classes métier, le modèle ElceDocument, les builders de scènes et la composition Sighty/CodPlay ne dépendent pas de Remix.
- La migration d’interface ne change ni les données v3 d’IndexedDB, ni le scénario, ni les scènes et contenus existants.
- Le serveur utilise les frontières d’infrastructure Elcé pour SQLite et les fichiers ; les règles métier ne sont pas déplacées dans les contrôleurs.
- Les autres paquets du monorepo peuvent conserver React. Les surfaces auteur portées ne l’utilisent plus ; dans le workspace Elcé, ne retirer une dépendance React que si le player hors périmètre ne l’utilise pas.

## Étapes et critères de sortie

### 0. Préparer le moteur Remix — À faire

- Faire évoluer le moteur d’exécution d’Elcé vers Node 24.3.0 ou plus récent. Le dépôt tourne actuellement sous Node 22.14.0 ; l’auteur accepte cette mise à niveau.
- Utiliser Remix 3.0.0 stable et le mode SPA accepté.
- Vérifier que l’installation, le démarrage, les scripts du workspace et le build fonctionnent sous le moteur retenu, sans modifier les autres workspaces.

**Sortie :** Node mis à niveau et le workspace Elcé démarre en SPA Remix.

### 1. Prouver l’interface Remix avec les vraies frontières Elcé — À faire

Dans une tranche isolée, rendre une surface Elcé existante avec remix/component et y monter le contrôleur XState réel.

- Créer l’acteur et le store une seule fois dans l’entrée navigateur, puis les fournir aux vues de l’éditeur via la frontière commune de l’application. Une vue s’abonne aux snapshots, conserve seulement le snapshot à rendre et déclenche `handle.update()` ; elle désabonne son abonnement avec `handle.signal`. À la navigation puis au démontage de l’application, vérifier qu’il n’existe ni acteur dupliqué, ni abonnement orphelin.
- Envoyer une commande par la façade actuelle et constater le nouvel état dans l’interface.
- Remplacer le raccord React de la Section par @tiptap/core Editor, sans réécrire l’extension d’ancre ; vérifier édition, sélection de toolbar, import d’image et déplacement d’ancre.
- Vérifier que la commande de prévisualisation de l’éditeur continue de lancer le player Sighty/CodPlay existant ; ne pas porter son rendu, ses builders ou sa composition.
- Vérifier que le bundle de l’éditeur n’utilise pas React. Garder les dépendances du workspace encore requises par le player hors périmètre.

**Sortie :** parcours d’édition réel dans Remix, sans nouveau circuit de commande ou d’état ; la prévisualisation existante continue de déléguer au player Sighty/CodPlay.

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
   Le schéma stocke les métadonnées de projet, la révision courante et le JSON
   ElceDocument.toJSON().
4. Pour chaque opération, tester le parcours routeur → contrôleur → adaptateur
   SQLite avec une base isolée. Ensuite, vérifier le même parcours avec le
   fichier SQLite du serveur local après redémarrage.

Les routes servent d’abord le contrat d’API ; le schéma et les requêtes SQLite
sont établis avec leur contrôleur, sans exposer SQLite aux classes métier.

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
3. éditeurs Question, Résultat et Carousel.

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
- [Modèle de document Elcé](../specs/document-model-spec.md)
- [Édition d’une Section](../specs/section-editor-spec.md)
- [Preview lecteur](../specs/player-preview-spec.md)
- [Plan local-first](./2026-10-06-elce-local-first-synchronisation-plan.md)
