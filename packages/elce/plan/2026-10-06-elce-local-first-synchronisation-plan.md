# Elcé — plan de stockage local et synchronisation

**Statut : En cours — synchronisation automatique entre navigateurs implémentée ;
la validation avec deux navigateurs distincts est en réserve depuis le 9 octobre
2026, en attente d’une mise à jour de Firefox qui corrige l’erreur empêchant son
fonctionnement via MCP.** Les écritures concurrentes ne font pas partie du
parcours retenu. Le
périmètre local et le transfert des médias sont établis.
Le modèle persistant v4 est assez défini pour commencer SQLite. L’acceptation
du raccord d’Évaluation au player reste un travail du POC, sans données de
session à persister dans cette base ; les résultats de lecture seront traités
ultérieurement par SCORM. Le seuil de conservation locale des vidéos dépendra
du serveur réel et est reporté après le POC. Le preload CodPlay existant n’est
pas un chantier Elcé.

## Cadre

- Première installation locale : navigateur, API Elcé, SQLite et répertoire
  média sur une seule machine. Le navigateur appelle l’API directement ; aucun
  proxy local ne relaie les requêtes.
- Le serveur Elcé lit et écrit les données SQLite et reçoit, enregistre et sert
  les fichiers média. Il n’assure pas d’autres fonctions serveur dans ce
  périmètre.
- Plusieurs projets pour une personne. Pas de comptes, rôles, partage,
  historique de versions ni fusion de documents.
- XState reste propriétaire du document actif de chaque fenêtre. IndexedDB est
  un cache local distinct de SQLite : une entrée par projet ouvert, avec les
  médias dont le transfert n’est pas confirmé et son checkpoint de
  synchronisation. Les projets fermés restent côté serveur. Après transfert
  confirmé, les images sont lues par URL et passent par le cache HTTP natif du
  navigateur plutôt que par une copie Blob durable dans IndexedDB.
- Chaque commande ou geste continu est d’abord conservé localement. Le serveur
  reçoit l’état stabilisé, pas les mouvements de pointeur intermédiaires.
- SQLite contient les projets et leur version courante. Les originaux média
  sont des fichiers dans un répertoire serveur séparé.
- Ce choix de SQLite concerne la première étape locale. Le moteur de la base
  finale de la V1 aboutie n’est pas fixé et sera probablement différent. Les
  `CHECK` sont écartés temporairement du premier schéma ; leur pertinence et
  leur forme seront revues prudemment pour le moteur retenu.

## Tranches et critères de sortie

### 0. Modèle persistant v4 avant SQLite — Fixé le 7 octobre 2026

Les décisions qui changent les tables sont représentées par le document v4 :
BDC média fusionné dans Carte, réglages de chapitre, et références de révélation
au niveau projet, parent et entrée de Carousel. L’acceptation runtime du BDC
Résultat reste au plan du POC ; la base de l’éditeur ne stocke pas les réponses
ni l’état d’une session de lecture.

- [x] Unifier le modèle en un BDC Carte, disponible selon le contexte dans
  Flux, Diapo, comme enfant inline d’une Section, comme enfant d’un Carousel ou
  au catalogue. La Carte porte sa référence média ; l’ancre Tiptap référence
  seulement le BDC. Aucun champ `media_type` distinct n’est stocké : le rendu
  image/vidéo est déduit du MIME. Une ressource média reste réutilisable et
  chaque insertion garde son BDC Carte propre. Voir la
  [spécification du modèle](../specs/document-model-spec.md).
- [x] À l’ajout d’une image ou vidéo, créer une Carte « Photo ou vidéo plein cadre ».
  Une icône placée sur l’image ouvre l’édition du layout et des paramètres de
  la Carte. La durée s’applique aux entrées Carousel, pas à une Carte seule.
- [x] Garder distincts le format de page (`flux` ou `diapo`) et le type de chapitre
  (`standard` ou `evaluation`). Le BDC Résultat est proposé dans un chapitre
  Évaluation, sur une page Flux ou comme BDC direct unique d’une Diapo. La
  whitelist et les builders Flux/Diapo appliquent ce placement sans traiter
  Évaluation comme un format de page.
- [x] Porter les valeurs de révélation par défaut sur le BDC parent. Dans un BDC
  Texte/Section, déclencher la révélation à la visibilité au scroll selon le
  circuit d’observation de la démo 5. Dans un Carousel, permettre une valeur
  d’entrée ou de sortie propre à chaque Carte, héritée du Carousel si elle
  n’est pas renseignée. Une Carte déjà visible au chargement n’exécute pas son animation
  d’entrée. Capsule Automation fournit les références et définitions de
  transition pour les deux contextes ; le Carousel reprend son preset `fade`.
  La démo 5 fixe le déclenchement enter/leave au scroll ; l’animation vient
  des définitions nommées de Capsule Automation.
- [x] Définir les valeurs de repli au niveau du projet, sans réglage propre à chaque
  page à cette étape. Une Carte directe dans la séquence racine d’une page Flux
  hérite donc des valeurs du projet, initialisées depuis la configuration. Un
  BDC parent peut définir ses propres défauts pour ses enfants ; les vues
  Carousel peuvent les remplacer au niveau de leur placement. L’interface ne
  propose pas de réglage par page ou par Carte individuelle à cette étape.
- [x] Utiliser le registre de définitions Capsule Automation, dont
  `DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`, pour résoudre les références de
  transition. Réutiliser le circuit `AutoCapsuleChildInput.events` pour les
  transitions Carousel et les événements `emit.observe` de visibilité déjà
  exercés dans la démo 5 pour le scroll, puis déclarer les actions sur les
  persos CodPlay concernés. N’ajouter ni minuteur, ni définitions locales de
  transition, ni circuit d’animation parallèle.
- [x] Mettre à jour le modèle, ses commandes, la surface d’édition, les builders,
  leurs spécifications et les tests d’intégration avant d’ouvrir le DDL SQLite.

**Acceptation des données :** une image ou vidéo ajoutée devient une seule BDC
Carte ; le média reste une ressource partageable et n’est pas dupliqué. Le
layout et les références de média sont éditables, et la même Carte survit aux
déplacements permis. Le document conserve les transitions séparées d’entrée et
de sortie : défaut projet, remplacement du parent, puis remplacement facultatif
de l’entrée Carousel. Les builders résolvent ces valeurs au moyen des
définitions Capsule Automation. Le type de chapitre garde les réglages
d’Évaluation ; le type de page reste Flux ou Diapo. Ces champs suffisent au
schéma relationnel, sans dépendre du rendu ou du calcul d’une session lecteur.

**Acceptation player encore suivie au POC :** vérifier les événements de
révélation dans le player réel, l’absence d’entrée animée au premier montage,
et la lecture du BDC Résultat en Flux et Diapo d’un chapitre Évaluation. Cette
validation ne bloque plus l’ouverture du schéma SQLite : elle ne change aucune
donnée documentaire à persister.

### 1. Serveur local et projets SQLite

Créer une petite API Elcé accessible directement depuis l’application et
adossée à SQLite.

- Catalogue multi-projets : créer, lister, ouvrir, renommer et supprimer.
- Persister le modèle en tables relationnelles, sans colonne contenant le
  document complet en JSON. Le JSON généré par Tiptap reste le contenu riche
  de ses Sections ; le HTML statique exporté pour leur projection est une
  colonne distincte.
- Le serveur conserve la version courante des lignes de chaque projet ; aucun
  historique métier n’est créé.

La correspondance du serveur local est fixée : un projet est un
`ElceDocument` v4, `project_id` et `name` proviennent de `id` et `name`, et
`POST /api/projects` reçoit le document créé dans le navigateur. Le schéma de
tables et les choix de nullabilité sont fixés dans le
[premier état des tables SQLite](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md).
La validation HTTP réutilise `ElceDocument.fromJSON()` et
`assertDocumentInvariants()` ; le dépôt ne stocke pas le document complet en
JSON.

**Modèle documentaire v4 — réalisé le 7 octobre 2026 :** `Bdc` n’a plus de
référence média générique. Une Carte unique porte `card.mediaId`, y compris
lorsqu’elle est créée depuis un dépôt d’image/vidéo ; une Question porte son
illustration dans `question.mediaId`. `MediaMetadata` conserve `mimeType`, et
le type de rendu est dérivé du MIME. L’ancre Tiptap porte seulement l’identifiant
BDC et une Carte ancrée est enfant de sa Section. Le schéma relationnel garde
`cards.media_id`, `questions.media_id` et `media_resources.mime_type`, sans
`media_type` ni référence média générique dans `content_blocks`. Les tests de
commande vérifient les versions v1, v2 et v3 refusées sans conversion.

**Décision de révélation acceptée le 7 octobre 2026, non implémentée :**
ajouter une image ou une vidéo crée une BDC Carte au layout « Photo ou vidéo
plein cadre ». Une icône dans un coin de l’image ouvre l’édition du layout et
de ses paramètres. La durée ne concerne pas une Carte placée seule ; dans un
Carousel, la durée reste une option de son entrée. La révélation est distincte
de cette durée et dépend du contexte : au scroll dans un BDC Texte/Section,
avec le déclenchement de visibilité de la démo 5 ; dans un Carousel, par les
événements d’entrée/sortie de chaque Carte. Le parent peut définir les valeurs
par défaut d’entrée et de sortie. Le Carousel peut fournir une valeur propre à
une Carte, comme pour sa durée ; ces remplacements sont stockés sur le
placement, tandis que les valeurs par défaut sont stockées dans `sections` ou
`carousels`. Une Carte déjà visible au chargement ne joue pas son animation
d’entrée, notamment la première Carte du Carousel. Les valeurs sont des
références de transition déclarées en configuration et résolues depuis
Capsule Automation, source des définitions pour le scroll et le Carousel. Le
Carousel reprend le preset `fade`. La démo 5 fournit les événements enter/leave
de visibilité au scroll. Le projet porte les valeurs de repli ; une page n’a
pas ses propres réglages à ce stade. Un BDC parent peut remplacer ces défauts,
et le placement d’une Carte Carousel peut remplacer ceux du Carousel. Le futur
éditeur pourra choisir
d’exposer ces réglages individuellement ; ce choix d’interface est reporté.

Les valeurs d’entrée et de sortie sont stockées séparément au niveau du projet,
du BDC parent et du placement Carousel. Le sélecteur actuel de transition reste
un choix de paire logique. Une constante Elcé associe chaque choix à deux
références Capsule Automation, une pour `intro` et l’autre pour `outro`; ces
références peuvent être identiques ou différentes. Le nom d’une paire exprime
le trajet complet : le preset qui fait entrer depuis la gauche fait sortir vers
la droite. Cette correspondance est extensible sans changer le modèle de
données.

Le contrat `AutoCapsuleChildInput.events` accepte déjà des événements
`intro`/`outro` propres à un enfant ; le builder Elcé actuel passe la transition
commune du Carousel à tous les enfants. La démo 5 observe l’entrée et la sortie
de visibilité du média dans le scroll. L’implémentation devra résoudre les
références depuis le registre Capsule Automation et déclarer leurs actions sur
le perso média, sans ajouter de minuteur ou d’animation parallèle.

Le modèle documentaire v4 distingue les types de BDC métier sans créer de BDC
`image` ou `video`. La whitelist de types et de layouts selon le contexte
appartient à l’interface auteur ; le schéma conserve des placements génériques
et n’encode pas cette whitelist dans des `CHECK`.

**Format local v4 — implémenté :** le modèle est en version 4. Un enregistrement local v3 est rejeté sans conversion et
remplacé par le nouveau document initial. Ses médias locaux associés sont
également nettoyés afin de ne pas laisser des ressources orphelines dans le
POC mono-document. `fromJSON()` continue de refuser les versions inconnues.

Inclure également le contrat Diapo : une seule entrée BDC directe, choisie
dans les types proposés par la whitelist. Dans un chapitre Évaluation, le BDC
Résultat peut occuper cette entrée unique. Le type de chapitre détermine le
suivi de résultat et la disponibilité du BDC Résultat ; le type de page reste
un choix indépendant entre Flux et Diapo. Les Cartes d’un Carousel et les BDC
inline d’une Section gardent des placements parents distincts. Le schéma
sépare les tables de projet, chapitres, pages, entrées de scénario, catalogue,
médias, placements BDC et détails propres aux BDC.

**Acceptation :** plusieurs projets restent présents après redémarrage du
serveur ; un aller-retour entre lignes SQLite et modèle Elcé conserve les
relations et l’ordre ; une Carte média peut être relue comme placement direct
de Flux/Diapo, enfant inline de Section, enfant ordonné de Carousel ou BDC du
catalogue ; la position inline vient de Tiptap et les Cartes distinctes peuvent
partager le même média. Les valeurs par défaut du projet, les remplacements des
BDC parents et ceux des vues Carousel sont conservés au chargement. Une Diapo
restitue son unique entrée directe et les Sections conservent le JSON Tiptap et
le HTML exporté ; aucun document complet JSON opaque n’est nécessaire au
stockage. Une branche Réussite/Échec se restitue aussi dans une Diapo
d’Évaluation, sans changement des tables selon le format. Les anciens formats
ne sont pas migrés implicitement.

**État vérifié le 7 octobre 2026 :** les six opérations projet traversent le
routeur Fetch et le contrôleur jusqu’au dépôt SQLite Remix. Les tests couvrent
le round-trip v4, deux projets après fermeture puis réouverture du fichier,
les révisions et l’ordre relationnel. L’assemblage du listener HTTP et le
transfert depuis le cache local sont suivis aux tranches 3 et 4.

### 2. Cache locale des projets ouverts et reprise de synchronisation

IndexedDB reste une cache locale au navigateur, distincte du stockage durable
SQLite/FileStorage du serveur. Elle garde une entrée séparée pour chaque projet
ouvert dans un onglet ; les projets non ouverts restent côté serveur. Des
fenêtres sur des projets différents peuvent éditer indépendamment.

- Restaurer le document actif depuis le cache local au démarrage et le modifier
  uniquement par les commandes XState existantes.
- Enregistrer localement chaque commande stabilisée. Garder l’état « à
  synchroniser » jusqu’à l’accusé du serveur.
- Conserver localement les octets des médias dont le transfert serveur n’est
  pas confirmé.
- Dans un onglet, un changement de projet attend l’accusé de sauvegarde serveur
  du document courant et de ses médias avant de le remplacer. Pendant cette
  attente, le projet reste ouvert. En cas d’échec ou de conflit, rester sur le
  projet et conserver sa cache.
- Le menu de gestion des projets est placé au niveau du titre « Elcé » et est
  distinct du catalogue de contenus de l’éditeur. Il permet de créer, ouvrir,
  fermer et supprimer des projets ; l’exportation est reportée. Toute opération
  qui ferme ou remplace le projet actif attend la confirmation du document et
  de ses médias. La suppression active efface ensuite le cache uniquement
  après confirmation du serveur. La suppression d’un projet inactif ne change
  pas le cache actif. « Fermer » revient à la liste des projets sans supprimer
  le projet serveur et retire la copie locale après confirmation. Le nom d’un
  projet créé est généré automatiquement et reste modifiable.
- `ProjectEditorLock` reste exclusif par projet. Deux fenêtres sur des projets
  distincts éditent chacune leur document et leur cache ; deux fenêtres sur le
  même projet se transfèrent le verrou et relisent cette cache avant de reprendre.

**Acceptation :** IndexedDB conserve séparément les documents, médias non
transférés et checkpoints des projets ouverts. Après rechargement, chaque
fenêtre restaure son projet et reprend sa synchronisation. La disponibilité
hors connexion du document ou des médias n’est pas exigée. Dans un même onglet,
le changement de projet attend l’accusé serveur et ne modifie pas les caches
des autres projets.

**État vérifié le 7 octobre 2026 :** le store IndexedDB conserve maintenant
plusieurs documents, leurs blobs et leurs checkpoints sans évincer les autres
projets lors d’une sauvegarde. `deleteDocument()` et le rejet d’un document v3
ne retirent que le cache visé et ses médias non partagés. Safari Technology
Preview a vérifié deux entrées simultanées, la sauvegarde et la suppression
ciblée, puis le rejet d’un v3 sans perte du projet courant. Le verrou exclusif
pour un même projet reste vérifié. Le menu Remix, la sélection par onglet, le
rechargement et les parcours de base entre projets différents ont depuis été
portés et vérifiés dans Safari Technology Preview. Le test
[`project-operations.test.ts`](../src/app/controller/project-operations.test.ts)
vérifie aussi qu’une commande Section déjà acceptée est sauvegardée localement
avant l’attente réseau et que le projet courant est conservé en cas de conflit
ou d’erreur réseau. Le parcours navigateur intégré de ces deux échecs reste
ouvert dans le [plan de transposition Remix](./2026-10-06-plan-transposition-remix-3.md).

### 3. Synchronisation directe du dernier état

Relier le store local à l’API, sans transmettre une suite de gestes ou de
frappes.

- Après une commande locale, regrouper les changements rapprochés puis envoyer
  directement le dernier instantané au serveur.
- Une sauvegarde distante à la fois par projet ; les changements reçus pendant
  son envoi restent dans le dernier état local et sont envoyés ensuite.
- Après une coupure, reprendre au lancement et au retour du réseau. Le statut
  local reste explicite tant que le serveur n’a pas confirmé.
- Le serveur compare la révision attendue ; il refuse toute mise à jour fondée
  sur une version dépassée. Pas de dernier-écrit-gagnant ni de fusion.

**Acceptation :** un geste continu est sauvegardé en local puis transmis une
fois stabilisé ; une coupure ne perd pas l’état local ; une révision périmée
produit un conflit visible sans écrasement.

**État vérifié le 7 octobre 2026 :** `ProjectSyncCoordinator` regroupe les
enregistrements pendant 500 ms, sérialise les requêtes et envoie le dernier
document par `POST` ou `PUT If-Match`. La réponse `412` est comparée au document
local ; un document divergent est conservé dans le cache et affiché comme
conflit. L’entrée Safari vérifie un `POST 201` réel du document initial et le
statut `Synchronisé`. Le conflit et les mises à jour rapides sont également
couverts par les tests du coordinateur. Le code réessaie au retour du réseau ;
la coupure et la reprise restent à vérifier dans l’acceptation intégrée.

`waitUntilCurrentDocumentSynced()` vide le délai de regroupement puis attend le
même coordinateur sérialisé jusqu’à la confirmation du document et de tous ses
médias. Il échoue sans effacer le cache si le document change pendant l’attente,
si la synchronisation échoue ou si le serveur signale un conflit. Le parcours
de changement, fermeture ou suppression du projet actif dans un onglet attend
cette confirmation ; une opération dans une autre fenêtre ne modifie pas la
cache locale du projet courant.

Le menu de gestion des projets au titre « Elcé » et ses opérations créer,
ouvrir, fermer et supprimer sont portés dans Remix et utilisent le même acteur
et le même coordinateur. L’exportation est hors de cette étape. Le test
[`project-operations.test.ts`](../src/app/controller/project-operations.test.ts)
vérifie l’attente d’une écriture locale en cours, puis la conservation du
document et du cache si la synchronisation échoue. Le parcours de ces échecs
depuis le menu reste à valider dans le navigateur MCP décrit au plan de
transposition.

### 4. Transfert des images et vidéos, cache navigateur

Enregistrer les originaux comme fichiers côté serveur et leurs identifiants et
métadonnées dans SQLite.

- Le serveur reçoit les octets par `PUT` brut, les écrit en flux dans un
  temporaire en calculant SHA-256, les finalise dans le FileStorage filesystem
  Remix puis publie `storage_key` dans SQLite. Il vérifie la taille déclarée
  dans `media_resources`, nettoie les fichiers temporaires ou orphelins au
  démarrage et après les suppressions. Ce trajet serveur est implémenté et
  vérifié par le test HTTP intégré.
- Réutiliser les mêmes octets au sein d’un projet à partir de leur empreinte.
- Garder les octets locaux jusqu’à confirmation du transfert. Pour une image
  confirmée, résoudre sa référence média vers l’URL serveur et retirer son Blob
  persistant d’IndexedDB. Le navigateur la charge comme ressource image normale
  et utilise son cache HTTP ; le serveur déclare explicitement sa politique de
  cache et l’URL identifie un contenu immuable.
- Transférer aussi les vidéos comme fichiers et conserver leur référence côté
  serveur. Le seuil de conservation locale et le choix entre lecture locale ou
  depuis une URL serveur sont reportés après le POC, selon les contraintes du
  serveur réel. Une vidéo fournie au player par URL serveur passe par le
  preload Sighty/CodPlay existant avant le montage de la scène ; Elcé ne crée
  pas de circuit de préchargement distinct.
- Le cache HTTP navigateur est opportuniste : il peut être évincé et ne garantit
  pas l’accès hors connexion. Si l’image n’est pas en cache, elle est rechargée
  du serveur au retour du réseau. Une vidéo distante n’est pas lisible hors
  connexion ; le document reste éditable et l’interface indique le média
  inaccessible. La disponibilité hors connexion des images n’est pas exigée à
  cette étape.

**Acceptation :** les images transférées s’affichent depuis leur URL serveur,
leur Blob est retiré d’IndexedDB et une relecture utilise le cache HTTP si la
réponse est encore fraîche. L’import d’une vidéo est transféré et référencé côté
serveur ; le choix de sa lecture locale ou distante n’est pas fixé à cette
étape. Après éviction du cache et hors connexion, une image peut être
inaccessible sans invalider le document.

**État vérifié le 7 octobre 2026 :** le navigateur appelle directement l’API
locale depuis `localhost:5175`. Dans Safari Technology Preview, le document a
été créé (`POST 201`), son image transférée (`PUT 201`), puis relue depuis
l’URL serveur (`GET 200`). Après transfert confirmé, le Blob de l’image est
absent d’IndexedDB ; après rechargement, l’image est à nouveau demandée depuis
le serveur et le statut reste `Synchronisé`, y compris après redémarrage de
l’API. SQLite contient la ligne de projet et les métadonnées du média ; son
fichier se trouve dans
`packages/elce/.elce-data/media/`. L’intégration vidéo côté navigateur et la
coupure/réconciliation réseau restent à valider. Les tests de
`ProjectSyncCoordinator` vérifient l’envoi des octets vidéo tout en gardant
leur Blob dans la cache locale, ainsi que l’état en attente après une erreur
réseau puis la reprise sur l’événement `online`.

### 5. Exclusivité entre fenêtres sur une machine — Fini le 7 octobre 2026

Employer les mécanismes natifs du navigateur pour les fenêtres de même origine
sur la machine locale. La première version ne coordonne pas plusieurs appareils.

- Un verrou Web Locks exclusif par document ouvert autorise une seule fenêtre
  d’édition pour ce document.
- BroadcastChannel transmet une demande de transfert à la fenêtre active.
- À `visibilitychange` vers `hidden`, l’éditeur suspend les commandes, termine
  les changements déjà en cours et confirme leur sauvegarde dans la cache
  IndexedDB partagée avant de libérer le verrou. Au retour au premier plan,
  il demande le verrou, relit le document et son checkpoint depuis cette cache,
  puis reprend la synchronisation serveur si nécessaire. La copie locale la
  plus récente ne doit pas être remplacée par une révision serveur plus ancienne.
- Si le verrou n’est pas libéré, demander de fermer l’autre fenêtre. Pas de
  minuteur d’inactivité ni d’API Idle Detection dans cette étape.

**Acceptation :** tester deux fenêtres sur la machine : transfert après demande,
attente avec indication de fermer l’autre fenêtre si elle ne libère pas le
verrou, restauration de l’état local le plus récent après réactivation et
absence de commandes acceptées depuis la fenêtre inactive. Un état local en
attente de synchronisation reste conservé et repart vers le serveur depuis la
nouvelle fenêtre active.

**État vérifié le 7 octobre 2026 :** `ProjectEditorLock` utilise le Web Lock
natif par document et `BroadcastChannel` pour demander un transfert. La machine
XState démarre suspendue et refuse les commandes tant que le verrou n’est pas
acquis. En cas de transfert, elle arrête les nouvelles commandes et requêtes
serveur, finit les changements acceptés, puis confirme leur cache IndexedDB.
À la reprise, elle recharge cette cache avant de réactiver l’édition. Les tests
vérifient l’import asynchrone, le refus des commandes et la reprise des
synchronisations en attente. Safari Technology Preview a vérifié le transfert
entre deux onglets, la demande BroadcastChannel depuis une fenêtre visible,
l’attente devant un verrou retenu et le retour après rechargement. Aucun
contenu éditorial n’a été modifié durant ces essais. Le détail est dans la
[spécification d’accès entre fenêtres](../specs/editor-window-access-spec.md).

### 6. Acceptation intégrée

Vérifier le parcours réel local, pas un store ou un player simulé : plusieurs
projets, redémarrage, commandes éditoriales, coupure/rétablissement réseau,
conflit entre fenêtres, transfert puis lecture d’une image depuis son URL,
ajout/réutilisation d’images et de vidéos, stockage local et API serveur.
Tester dans le navigateur MCP exposé par l’environnement courant. Ne pas
supposer ni lancer d’autres navigateurs s’ils ne sont pas fournis par cet
environnement.

**Avancement le 8 octobre 2026 — En cours :** les tests SQLite/API vérifient
plusieurs projets et leur restauration après réouverture de la base ; Safari
Technology Preview a confirmé la restauration du document actif depuis
IndexedDB, la reprise du verrou et les parcours de base du menu projet. Le
transfert de l’image par l’éditeur a été vérifié à la tranche 4. Les tests
ciblés vérifient maintenant qu’une commande déjà acceptée est sauvegardée
localement avant un changement de projet et qu’un conflit ou une panne réseau
conserve le document et le cache. Brave DevTools a vérifié le 8 octobre le cas
hors réseau : le `PUT /document` échoue, le projet courant et son document local
restent ouverts avec l’état `pending`, puis l’édition est synchronisée à la
reconnexion. Brave a aussi exercé le verrou sur deux pages du même contexte :
la seconde attend l’accès, puis édite et synchronise après transfert. Après sa
fermeture, la première ne reprend qu’après rechargement ; elle restaure alors
le titre enregistré localement et le synchronise. MCP a conservé
`visibilityState: visible` dans les deux pages, donc la reprise automatique au
retour de focus/visibilité reste à valider. Le conflit HTTP `If-Match` est
couvert par `project-operations.test.ts`. Le transfert navigateur de vidéo
reste à vérifier.
Brave DevTools a aussi confirmé le 8 octobre qu’une image transférée charge
dans l’éditeur et le lecteur via la même URL serveur ; son Blob est absent du
store média IndexedDB. Le projet d’essai et ses entrées locales ont été
supprimés après vérification.
Le menu et son raccord au coordinateur de synchronisation sont implémentés ;
les preuves restantes sont suivies dans le [plan de transposition Remix](./2026-10-06-plan-transposition-remix-3.md).

### 7. Synchronisation automatique entre navigateurs — implémentée, validation en réserve

Le même projet doit pouvoir rester ouvert dans plusieurs navigateurs et les
modifications enregistrées dans l’un doivent parvenir automatiquement aux
autres sans fermeture ni rechargement. Cette direction a été acceptée le
8 octobre 2026. La règle d’usage retenue est qu’une seule page active reçoit
les éditions de l’utilisateur ; la fusion de changements concurrents n’est pas
demandée. Le flux doit réutiliser l’API projet, la révision serveur et l’acteur
XState de chaque éditeur ; il ne crée pas un deuxième document, un cache
partagé entre navigateurs ou un circuit de commandes éditoriales parallèle.

Le délai local existant reste de 500 ms. Quand la page perd le focus, elle
suspend les nouvelles commandes, termine et sauvegarde les commandes déjà
acceptées, puis tente immédiatement de confirmer le document et ses médias sur
le serveur avant de libérer son accès. Une erreur réseau conserve la copie
locale en attente et n’empêche pas la libération. Une fenêtre visible mais
sans focus ne demande pas le verrou et reste non éditable. Au retour du focus,
après restauration du cache local et obtention de l’accès, l’éditeur compare le
checkpoint local à la révision serveur. Si le cache local est synchronisé et
que le serveur est plus récent, il installe ce document dans le même acteur
XState, conserve la sélection de page encore valide et rétablit ses sources de
média. Un cache `pending` ou `conflict` n’est jamais remplacé. Le changement de
focus constitue donc le déclencheur de réception entre navigateurs ; aucun
rechargement de page n’est requis.

Le contrat de révision existant reste un garde-fou pour une écriture inattendue
depuis une copie obsolète : pas de dernier-écrit-gagnant ni de fusion. La copie
locale en attente reste conservée et le conflit est signalé.

**État vérifié le 8 octobre 2026 :** le circuit est implémenté dans
`ProjectEditorLock`, `ProjectSessionCoordinator`, `DocumentPersistence` et
`ProjectSyncCoordinator`. Les tests couvrent le push immédiat au blur,
l’installation d’une révision distante avant la reprise d’édition, l’attente
d’une fenêtre visible sans focus et le retour du focus pendant un transfert de
verrou en cours. Brave DevTools a exercé deux contextes isolés sur 5175 avec des
événements blur/focus explicites dans les deux sens : les révisions 1 et 2 ont
été reçues, les checkpoints sont revenus à `synced`, et aucun `PUT` périmé n’a
été émis au moment de la réception. La sélection Page A est restée valide.
Cette validation ne remplace pas encore l’essai entre deux navigateurs
distincts avec leurs événements OS réels. Dans Brave, une édition gardée en
`pending` après coupure réseau a aussi été envoyée après reconnexion et reprise
du focus, sans modification serveur concurrente.

**Vérification inter-navigateurs en réserve — décision du 9 octobre 2026 :**
reprendre après une mise à jour de Firefox qui corrige l’erreur empêchant son
fonctionnement via MCP. Ouvrir alors le même projet dans deux navigateurs
distincts ; modifier la page active, vérifier que son blur confirme la
sauvegarde serveur, puis vérifier que le focus de l’autre installe le document
sans rechargement et conserve sa sélection valide. Refaire le parcours inverse
avec des événements OS réels. Conserver en non-régression le refus `If-Match`
et la copie locale en cas d’écriture inattendue sur une révision dépassée.
Ne pas lancer Firefox avant la mise à jour. Cette vérification ne bloque pas le
portage Remix, terminé dans son plan dédié.

## Suites après le POC

### Consolider la persistance pour une V1 aboutie

Choisir le moteur de base cible selon les contraintes du serveur réel, puis
revoir le modèle relationnel pour ce moteur. Le premier schéma SQLite est une
étape locale provisoire ; l’absence de `CHECK` n’est pas une décision de les
écarter de la base finale. Évaluer prudemment les contraintes utiles et leur
forme portable avant de figer la V1.

- Déterminer, selon les contraintes du serveur réel, le seuil à partir duquel
  une vidéo sera lue depuis le serveur plutôt que gardée en copie durable dans
  le navigateur.
- Définir alors le parcours de lecture vidéo distante et le support des
  requêtes `Range` nécessaires aux chargements partiels. Le preload CodPlay
  existant est utilisé tel quel ; sa revalidation n’est pas au périmètre Elcé.

### Étudier les médias par lien externe

Après validation du parcours initial par fichier, étudier la possibilité
d’associer un média depuis une URL plutôt que de l’importer.

- Comparer ce parcours au stockage par fichier déjà prévu, pour les images et
  les vidéos.
- Vérifier les conséquences sur l’accès du player, la lecture des vidéos
  longues, la disponibilité hors connexion et la pérennité des liens.
- Proposer une décision de périmètre avant toute implémentation. Cette étude ne
  retarde pas les tranches précédentes et ne présume pas que les liens externes
  remplaceront l’import de fichiers.

**Sortie attendue :** une décision documentée indiquant les types de liens
acceptés, leurs limites d’usage et les changements éventuels au stockage ou au
player.

## Références

- [Modèle de document Elcé](../specs/document-model-spec.md)
- [Preload CodPlay V2](../../codplay/specs/preload-v2-spec.md)
- [Runtime Sighty](../../sighty/specs/authoring-library-spec.md)
- [Accès d’édition entre fenêtres](../specs/editor-window-access-spec.md)
- [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [Note de stratégie](../notes/2026-10-06-strategie-local-first-et-synchronisation.md)
