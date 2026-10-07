# Elcé — plan de stockage local et synchronisation

**Statut : Fixe.** Le périmètre local et le transfert des médias sont établis.
Le seuil de conservation locale des vidéos dépendra du serveur réel et est
reporté après le POC. Le preload CodPlay existant n’est pas un chantier Elcé.

## Cadre

- Première installation locale : navigateur, API Elcé, SQLite et répertoire
  média sur une seule machine. Le navigateur appelle l’API directement ; aucun
  proxy local ne relaie les requêtes.
- Le serveur Elcé lit et écrit les données SQLite et reçoit, enregistre et sert
  les fichiers média. Il n’assure pas d’autres fonctions serveur dans ce
  périmètre.
- Plusieurs projets pour une personne. Pas de comptes, rôles, partage,
  historique de versions ni fusion de documents.
- XState reste propriétaire du document actif. IndexedDB garde les documents,
  les médias encore à transférer et l’état de synchronisation. Après transfert
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

Avant le DDL, relire le [premier état des tables SQLite](../notes/2026-10-06-premier-etat-modele-donnees-bdd.md)
et valider les décisions qu’il laisse ouvertes : correspondance entre projet
et `ElceDocument`, placement relationnel des pages, validation des sous-types
BDC, représentation et contraintes des placements BDC, séparation ou non des
réglages d’évaluation dans une table liée, colonnes du registre média et
frontière de validation des données reçues.
Le schéma proposé sépare les tables de projet, chapitres, pages, entrées de
scénario, catalogue, médias, placements BDC et détails propres aux BDC.

**Acceptation :** plusieurs projets restent présents après redémarrage du
serveur ; un aller-retour entre lignes SQLite et modèle Elcé conserve les
relations et l’ordre ; les Sections conservent le JSON Tiptap et le HTML
exporté ; aucun document complet JSON opaque n’est nécessaire au stockage.
Les formats v1/v2 ne sont pas migrés implicitement.

### 2. Copies locales et édition hors connexion

Étendre le store IndexedDB existant aux projets multiples et à leur état de
synchronisation.

- Restaurer le document local au démarrage et le modifier uniquement par les
  commandes XState existantes.
- Enregistrer localement chaque commande stabilisée. Garder l’état « à
  synchroniser » jusqu’à l’accusé du serveur.
- Conserver localement les octets des médias dont le transfert serveur n’est
  pas confirmé.

**Acceptation :** créer et réouvrir plusieurs projets, poursuivre l’édition
hors connexion et retrouver les changements après fermeture du navigateur. Les
images transférées au serveur peuvent être indisponibles hors connexion si le
cache HTTP du navigateur les a évincées ; cette limite est acceptée à cette
étape.

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

### 4. Transfert des images et vidéos, cache navigateur

Enregistrer les originaux comme fichiers côté serveur et leurs identifiants et
métadonnées dans SQLite.

- Recevoir un média sous un nom temporaire, le finaliser dans le répertoire
  média puis publier sa référence dans SQLite. Contrôler les fichiers
  temporaires ou orphelins après interruption.
- Réutiliser les mêmes octets au sein d’un projet à partir de leur empreinte.
- Garder les octets locaux jusqu’à confirmation du transfert. Pour une image
  confirmée, résoudre sa référence média vers l’URL serveur et retirer son Blob
  persistant d’IndexedDB. Le navigateur la charge comme ressource image normale
  et utilise son cache HTTP ; le serveur déclare explicitement sa politique de
  cache et l’URL identifie un contenu immuable.
- Transférer aussi les vidéos comme fichiers et conserver leur référence côté
  serveur. Le seuil de conservation locale et le choix entre lecture locale ou
  depuis une URL serveur sont reportés après le POC, selon les contraintes du
  serveur réel.
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

### 5. Exclusivité entre fenêtres sur une machine

Employer les mécanismes natifs du navigateur pour les fenêtres de même origine
sur la machine locale. La première version ne coordonne pas plusieurs appareils.

- Un verrou Web Locks exclusif par projet autorise un seul onglet éditeur.
- BroadcastChannel transmet une demande de transfert à la fenêtre active.
- À `visibilitychange` vers `hidden`, l’éditeur suspend les commandes et
  libère le verrou après sauvegarde locale. Au retour visible, il demande le
  verrou et recharge la révision courante avant de reprendre.
- Si le verrou n’est pas libéré, demander de fermer l’autre fenêtre. Pas de
  minuteur d’inactivité ni d’API Idle Detection dans cette étape.

**Acceptation :** tester deux fenêtres sur la machine : transfert après demande, conflit si
l’autre ne répond pas, reprise de l’état le plus récent après fermeture et
absence de modifications depuis la fenêtre inactive.

### 6. Acceptation intégrée

Vérifier le parcours réel local, pas un store ou un player simulé : plusieurs
projets, redémarrage, commandes éditoriales, coupure/rétablissement réseau,
conflit entre fenêtres, transfert puis lecture d’une image depuis son URL,
ajout/réutilisation d’images et de vidéos, stockage local et API serveur.
Tester Safari, Firefox et Chromium pour les APIs retenues.

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
- [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [Note de stratégie](../notes/2026-10-06-strategie-local-first-et-synchronisation.md)
