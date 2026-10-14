# Elcé — accès exclusif entre navigateurs

**Statut : décisions de reprise et de forçage acceptées le 12 octobre 2026 ; implémentation et validation en cours.**
Les comportements mis en place et vérifiés figurent dans les spécifications
propriétaires ; les décisions acceptées mais non appliquées et les preuves
inter-navigateurs restantes sont suivies dans ce plan.

## Résultat attendu

Un document possède une seule édition active, même si deux navigateurs l'ont
ouvert. Les autres pages montrent la dernière révision confirmée par le serveur
et restent en lecture seule. Au changement de focus, la page sortante termine
ses commandes, enregistre le document et ses médias, puis libère l'édition
seulement après confirmation du serveur. La page entrante relit alors cette
révision avant de permettre une commande. L'historique Undo reste local.
**Décisions acceptées le 12 octobre 2026 :** le serveur attribue un bail
renouvelable au détenteur. Quand il cesse de recevoir les renouvellements, le
droit devient automatiquement récupérable et une autre page peut reprendre le
projet avec un identifiant de droit neuf. La nouvelle page relit la révision
confirmée avant d'activer l'édition ; l'ancien droit est clôturé et ne peut
plus écrire. Le forçage n'ajoute pas de copie automatique ni de circuit de
préservation ; il ne récupère pas automatiquement les changements locaux non
confirmés.

« Forcer l'accès » est un secours temporaire, disponible même si le bail paraît
encore actif : il révoque immédiatement le droit courant et permet à la page
demandeuse de reprendre le projet. L'ancienne page passe en lecture seule ;
ses opérations avec l'ancien droit sont refusées par le serveur.
Chaque utilisation répétée signale un défaut du mécanisme normal à diagnostiquer ;
le forçage n'est pas le fonctionnement attendu après la phase de mise au point.
Retirer cette issue temporaire quand les validations démontrent que l'accès
normal reste récupérable après perte de connexion.

La règle est inscrite dans le [plan de synchronisation](./2026-10-06-elce-local-first-synchronisation-plan.md).
Les contrats actuellement vérifiés sont l'[accès par fenêtre](../specs/editor-window-access-spec.md),
la [session du projet](../specs/project-session-spec.md) et l'[API projet](../specs/project-api-spec.md).

## Frontière réutilisable retenue

**Décisions confirmées le 11 octobre 2026 :** la politique de
synchronisation doit pouvoir servir à une autre application, notamment
l'éditeur, sans importer Remix ni connaître le contenu du document. Une classe
métier côté application doit porter les décisions communes : un seul
détenteur du droit d'édition, attente de la confirmation avant transfert,
comparaison des révisions, mise en lecture seule, reprise et traitement des
échecs. Elle reçoit une valeur opaque et une opération de publication qui ne
confirme la synchronisation qu'après l'enregistrement du document et de ses
éventuels médias. Elle ne possède ni l'état éditorial ni son historique Undo.

Cette classe doit prolonger le circuit de coordination existant, et non créer
une seconde synchronisation concurrente. Les accès au serveur et au cache, la
publication des médias, les notifications de focus, le verrou navigateur et
l'installation dans l'acteur XState restent derrière des adaptateurs. Le droit
exclusif entre navigateurs doit aussi être vérifié au serveur : une classe
cliente seule ne peut pas le garantir. L'API et la persistance Elcé restent
libres d'utiliser Remix ; cela ne doit imposer aucune dépendance Remix à la
classe métier ou à une application consommatrice.

La classe est placée dans `packages/authoring/exclusive-sync`, package
`@codplay/exclusive-sync`, et exposera un port de droit serveur, un port de
lecture de révision et de valeur, un port de publication complète et un port
de projection d'accès et de valeur. `ProjectSyncCoordinator` conserve seul les
écritures Elcé, leurs médias et leur checkpoint ; `ProjectSessionCoordinator`
raccorde cette classe à l'acteur XState ; `ProjectEditorLock` conserve Web
Locks, `BroadcastChannel` et les signaux de focus. Aucune de ces frontières ne
possède un second document. Le besoin de l'éditeur sert de critère de
réutilisabilité ; son raccordement effectif demande son propre plan.

## Protocole technique retenu

**Classe commune côté application.** `ExclusiveSyncSession<T>` dans ce package
ne dépend ni d'Elcé, ni de Remix, XState, DOM, Fetch ou IndexedDB. Elle reçoit
par injection les opérations suivantes : acquérir/libérer un droit, lire la
révision et la valeur confirmées, attendre l'achèvement local et la publication
complète de la valeur opaque `T`, installer une valeur confirmée et
autoriser/suspendre les commandes. Elle sérialise acquisition, sortie et
réception et distingue droit occupé, conflit de révision et panne récupérable.
Le port de publication Elcé appelle le seul `ProjectSyncCoordinator` ; la
classe commune ne construit ni document, ni historique, ni transport réseau.
Les signaux de focus et de nouvelle révision entrent par ses méthodes ; elle
ne possède ni écouteur navigateur ni minuteur.

**Adaptateurs Elcé.** `ProjectSessionCoordinator` reste le raccord avec
l'unique acteur XState et le cache du projet. `ProjectEditorLock` garde les
événements de focus, les Web Locks et `BroadcastChannel` du même profil ; il
demande les transitions à la classe commune. L'adaptateur de publication Elcé
réutilise les commandes documentaires, le stockage média et le checkpoint
existants. Il ne confirme la synchronisation complète qu'après l'accusé du
document et de ses médias. Le mode de secours « Enregistrer sous… » et la
récupération des médias manquants restent dans Elcé, hors de la classe commune.

**Droit serveur.** SQLite garde, dans chaque projet, une clé de page détentrice
et un identifiant de droit neuf à chaque acquisition.
`POST /api/projects/:projectId/edit-access` reçoit `{ pageId }`. Si le projet est
libre, il accorde le droit et renvoie `{ grantId }` ; tant que cette même
page le détient, une répétition renvoie le même identifiant ; une autre page
reçoit `409 edit_access_occupied`. Une recharge du même onglet peut reprendre
son droit avec sa clé après restauration et
synchronisation locale. `DELETE` sur ce chemin libère uniquement la paire
clé-identifiant courante ; une libération répétée n'accorde jamais le droit à
une autre page. La lecture du catalogue, du document et des médias reste libre.
La clé identifie une page, sans constituer une identité utilisateur.
`GET` sur ce même chemin, avec la paire courante, indique seulement si elle
est encore détentrice ; il permet de résoudre une réponse de libération perdue
sans reprendre involontairement un droit déjà libéré.

Les écritures du document, le renommage, la suppression, les uploads et la
libération présentent `X-Elce-Page-Id` et `X-Elce-Edit-Grant`. L'API ajoute ces
en-têtes au prévol CORS. Le dépôt vérifie
la paire dans la même transaction que la mutation ; `If-Match` reste requis
pour le document. Pour un upload, le fichier temporaire peut être reçu avant
la vérification, mais `storeMediaFile()` revérifie la paire au moment de publier
sa clé dans SQLite et nettoie le fichier si le droit a changé. Une demande
d'un ancien droit reçoit `409 edit_access_lost`, même si la même page
a repris ensuite un nouveau droit. Une réponse de publication perdue est
réconciliée avec la révision et le contenu serveur par le circuit existant.
La création d'une copie emploie un nouvel identifiant et n'exige aucun droit
sur la source. Remix reste l'adaptateur HTTP/SQLite/fichiers d'Elcé ; il ne
fait pas partie de la classe commune.

**Identité de page.** Une clé aléatoire est conservée dans `sessionStorage`
pour permettre une recharge du même onglet.
Ce stockage peut être copié quand un onglet est dupliqué : l'adaptateur ne
réutilise la clé que pour une navigation reconnue comme rechargement et la
renouvelle à toute nouvelle ouverture. Le Web Lock et un échange
`BroadcastChannel` évitent qu'une page vivante de même profil partage cette
clé avec une copie. Une navigation dont la nature est incertaine reçoit une
nouvelle clé et reste lectrice si l'ancienne détient encore le droit ; elle
peut alors utiliser « Enregistrer sous… ». La compatibilité de cette
distinction avec les navigateurs de validation fait partie de l'acceptation.

**Édition et prévisualisation.** En mode édition, la disponibilité préalable
des médias n'est pas exigée : le circuit vérifié peut enregistrer le document
avant d'avoir transféré tous ses médias. Un média encore absent reste signalé
comme indisponible, sans empêcher l'édition du document. La prévisualisation
constitue une autre frontière : elle résout les médias confirmés par leur URL
serveur et les médias en attente par leur Blob local, puis utilise le
[préchargement Sighty/CodPlay](../../codplay/specs/preload-v2-spec.md) pour les
ressources du lecteur, selon la
[spécification de la preview](../specs/player-preview-spec.md). Ne pas ajouter
de préchargeur Elcé ni inverser l'ordre de publication de l'API pour résoudre
un problème de prévisualisation. Au transfert de l'édition à B, l'attente de
confirmation du document et des médias reste la règle distincte décrite
ci-dessous. Dans le circuit actuel du popup, l'absence du Blob local d'un
média non transféré empêche déjà la préparation de l'instantané et remonte une
erreur ; cette frontière doit rester observable dans les tests.

**Transfert normal.** Au `blur`, A suspend immédiatement les nouvelles
commandes, attend celles déjà acceptées et leur sauvegarde locale, puis attend
la confirmation serveur du document et des médias par
`waitUntilCurrentDocumentSynced()` dans le coordinateur existant. A libère
ensuite le droit serveur, puis le Web Lock local. B obtient son propre droit
serveur, relit et installe la révision confirmée avant de rendre l'éditeur
actif. Si A échoue avant la demande de libération, elle reste suspendue et
détentrice du droit ; B reste lectrice. Si la réponse à la libération se perd,
A reste suspendue et vérifie au serveur si elle détient encore le droit avant
de conclure : la libération peut avoir réussi malgré l'erreur réseau. Une
panne réseau récupérable reçoit trois tentatives ; un
`412` est signalé sans répéter la même écriture. B doit suivre les révisions
confirmées tandis qu'elle reste lectrice et retenter l'accès lorsqu'elle est
visible. Le serveur détecte la disparition du détenteur par l'expiration d'un
bail renouvelé tant que la page détient le droit. La page suivante obtient un
droit neuf et relit la révision confirmée. Le bouton temporaire « Forcer
l'accès » peut révoquer immédiatement un bail encore actif. Dans les deux cas,
une ancienne paire doit être refusée même si la page A revient ; les changements
non confirmés de cette ancienne page ne sont ni fusionnés ni copiés par ce
secours.
Si la sortie échoue alors que A détient encore le Web Lock local, un retour de
focus ou du réseau reprend la sortie sur cette même session ; il n'attend pas
une nouvelle acquisition du Web Lock. Après une réponse de libération perdue,
la lecture de l'état du droit permet soit de confirmer qu'il est libre et de
libérer le Web Lock, soit de continuer la libération avec la même paire. A ne
redevient éditrice qu'après vérification de son droit et de la révision serveur.

**Fusion d'un média en cours.** `media.merge` est une commande métier déjà
utilisée après `409 media_already_exists`. Pendant le transfert, XState refuse
les nouvelles commandes auteur, mais doit pouvoir terminer cette
normalisation déclenchée par l'upload déjà accepté. Ajouter un événement
interne de synchronisation, gardé par le projet et le droit courants, qui
applique la commande `media.merge` existante sans créer d'entrée Undo. Le
coordinateur attend ensuite l'enregistrement local et la publication du
nouveau document jusqu'à stabilisation, sans réactiver l'édition. Ce chemin
reste propre à l'adaptateur Elcé, sans enrichir la classe commune avec la
sémantique des médias. `waitUntilCurrentDocumentSynced()` devra suivre cette
nouvelle version produite par la normalisation au lieu d'échouer sur le simple
changement d'identité du document ; un changement provenant d'une nouvelle
commande auteur pendant la suspension reste interdit.

**Lecture des pages en attente.** La page prépare sa vue lectrice depuis la
révision serveur même si le Web Lock local est détenu ailleurs. Elle conserve
séparément toute copie locale `pending` ou `conflict`, sans la présenter comme
la version commune. Tant qu'elle est ouverte, visible et sans droit, un relevé
du catalogue toutes les deux secondes détecte une nouvelle révision ; la
lecture et l'installation du document passent ensuite par l'acteur XState.
Le relevé s'arrête lorsque la page devient éditrice ou est masquée ; le retour
de focus déclenche une lecture immédiate. Si la page possède aussi le focus,
elle retente l'acquisition après un refus « occupé » au même rythme : la
libération dans un autre navigateur n'a pas de signal direct. Une réponse
tardive ne peut pas
remplacer le document après une nouvelle acquisition ou une nouvelle révision.
Ce relevé appartient à l'adaptateur Elcé, non à la classe commune.

**Reprise et vérification.** Après rechargement, la page détentrice réacquiert
d'abord le Web Lock local, présente sa clé au serveur, restaure sa copie locale
et termine toute publication en attente avant de réactiver l'édition. Une
lecture serveur qui échoue interdit cette réactivation. Les
tests doivent aussi couvrir un onglet dupliqué, une requête dont la réponse a
été perdue après commit, un redémarrage serveur, et une écriture/upload en
vol pendant la libération du droit. Une ancienne clé libérée ne doit plus
autoriser d'écriture.

## Avancement et preuves encore requises

La classe générique, le droit SQLite, le transfert par le coordinateur
existant, la lecture confirmée, la copie de secours et le média doublon sous
suspension sont implémentés. Leurs tests ciblés passent ; typecheck, build et
test HTTP sur port local autorisé passent également. Dans Safari, les signaux
de focus synthétiques ont exercé A → B, une page bloquée par un droit externe,
« Enregistrer sous… » et la relecture au focus.
Les tests ajoutés vérifient la répétition d’une acquisition dont la première
réponse est perdue après commit, la rétention du Web Lock et du droit serveur
après trois échecs de publication, puis leur libération au retour du réseau.
Un cache en conflit reste récupérable depuis la vue lectrice ; un média source
disparu laisse la copie locale en attente sans upload incomplet.
Une copie de secours rouverte sans focus affiche son document local en lecture
seule au lieu de rester sur « Ouverture du projet ».
La suite Elcé complète atteint 266 tests réussis sur 273 : sept assertions du
test de composition du player échouent sur le titre ou la navigation. Aucun
fichier du player n'a été modifié dans cette tranche ; leur cause et leur
baseline restent à établir avant de déclarer la suite complète verte.

Avant de clôturer cette tranche, exercer deux navigateurs ou profils réellement
isolés, avec transfert au focus réel, relevé des révisions pendant qu'une page
lectrice reste visible, fermeture brutale et recharge de la page détentrice.
Rejouer dans un navigateur réel les frontières couvertes par tests ciblés :
réponse d’acquisition perdue après commit, upload en vol pendant la libération,
trois tentatives réseau échouées et copie rechargée avec un média source
introuvable. La preview avec média encore en attente
doit passer par le circuit de préchargement Sighty/CodPlay. Garder le statut
`En cours` jusqu'à ces preuves ; ne pas présenter le transfert réel entre deux
navigateurs comme validé par les seuls signaux synthétiques.

### Vérification Brave du 12 octobre 2026

Le `405` observé sur le renouvellement venait de l'instance API déjà ouverte,
qui n'avait pas chargé la nouvelle route. Le redémarrage du processus Elcé
existant a rechargé ensemble l'éditeur sur `5175` et son API sur `5181`, sans
lancer `5173` ni une seconde instance.

Sur un projet temporaire, Brave a actionné « Forcer l'accès » après le
remplacement du droit par une page simulée. L'éditeur est redevenu actif et une
écriture avec le droit remplacé a reçu `409 edit_access_lost`. Le projet
temporaire a ensuite été supprimé. Cinquante-cinq tests ciblés passent pour le
verrou, l'API, SQLite, le coordinateur de session et la synchronisation ; le
typecheck Elcé est vert.

La manipulation de pages Brave ne prouve pas le transfert réel entre deux
navigateurs. Cette validation reste en attente, conformément à la consigne de
ne pas lancer Firefox tant que son MCP ne fonctionne pas.

## Travail à réaliser, dans cet ordre

1. **Définir puis éprouver la frontière métier commune.** Identifier dans les
   trois coordinateurs existants les décisions de synchronisation qui peuvent
   être extraites sans changer le propriétaire du document. Définir les ports
   minimaux pour le droit d'édition, la révision confirmée et la publication
   d'une valeur opaque ; vérifier ce contrat avec un contenu sans dépendance
   Elcé, Remix ou XState. Ne brancher aucun second circuit en parallèle.
2. **Réserver le document côté serveur.** Étendre l'API projet et sa
   persistance SQLite avec un détenteur par projet. Une session d'onglet possède
   son identité propre ; un nouvel onglet doit demander un nouveau droit, même
   dans le même navigateur. Une recharge du même onglet peut reprendre sa
   session, mais le Web Lock actuel continue d'exclure ses autres pages. Toutes
   les mutations du projet existant vérifient le droit, y compris le
   remplacement, le renommage, la suppression et la publication d'un média.
   La vérification d'un upload doit encore tenir au moment de sa publication,
   dans la transaction de `storeMediaFile()` ; un upload rejeté retire son
   fichier non publié.
   `If-Match` reste exigé pour le document. Une ancienne session révoquée ne
   peut plus écrire, même après une reconnexion ou un redémarrage du serveur.
   Conserver l'ordre de publication actuel du document et des médias pendant
   l'édition ; aucun changement de cette API n'est requis pour la disponibilité
   préalable de la preview.
3. **Raccorder le droit au circuit d'édition existant.**
   `ProjectEditorLock` conserve son rôle entre onglets du même profil ;
   `ProjectSessionCoordinator` n'active l'acteur XState qu'après obtention du
   droit serveur et installation de la révision confirmée. Le transfert
   réutilise `waitUntilCurrentDocumentSynced()` pour rendre visible tout échec
   de publication, sans créer de second circuit. Au `blur` et à
   « Fermer », suspendre les commandes, attendre les écritures locales et la
   confirmation du document et des médias, puis libérer le droit serveur. Si
   cette confirmation échoue, A conserve le droit serveur sans rester éditable
   hors focus ; B reste en lecture seule. Un `412` devient immédiatement un
   conflit, tandis qu'une erreur réseau récupérable reçoit trois tentatives.
   Une session qui garde le Web Lock après échec reprend la sortie au focus ou
   au retour du réseau sans attendre une nouvelle acquisition native.
   Couvrir le `409` média qui requiert `media.merge` pendant une suspension,
   avant de considérer le transfert comme terminé.
   **Décision acceptée le 14 octobre — sélecteur de fichier natif :** garder
   le droit serveur et le Web Lock pendant le dialogue déclenché par un input
   fichier, même si la fenêtre perd le focus ou devient masquée. Si `change` ou
   `cancel` arrive avant le retour du focus, garder aussi l’accès XState actif
   jusqu’au retour d’une page visible et focalisée ; un transfert ordinaire
   demandé pendant cette séquence attend sa fermeture. La sélection est ainsi
   envoyée au contrôleur actif avant le transfert. Le forçage explicite et la
   fermeture de page gardent leurs règles actuelles. Tests automatiques du
   verrou et du chemin Remix/XState appliqués le 14 octobre ; la sélection et
   l’annulation par le dialogue système réel restent à valider dans un
   navigateur, avec le transfert concurrent et le blur ordinaire hors sélecteur.
4. **Faire suivre la révision confirmée aux lecteurs.** Réutiliser la liste
   légère des projets pour détecter un changement de révision pendant que la
   page lectrice est ouverte et visible, puis lire et installer le document par
   le même acteur XState. L'observation périodique reste à créer ; la lecture
   actuelle n'est déclenchée qu'au focus. Relire aussi à chaque retour de
   focus. Une page sans droit n'envoie aucune écriture du document source. Sa
   copie locale en attente est préservée pour récupération, sans être présentée
   comme la version serveur. Relever la liste toutes les deux secondes tant
   que la page lectrice est visible et vérifier que cela cesse lorsqu'elle
   n'est plus lectrice.
5. **Reprise après détenteur perdu et secours temporaire — implémentés ;
   validation inter-navigateurs restante.** Le serveur renouvelle le bail du
   détenteur et permet l'acquisition d'un droit neuf après son expiration. Le
   contrôle temporaire « Forcer l'accès » révoque un droit avant son expiration.
   La page entrante lit la dernière révision confirmée avant d'activer les
   commandes ; l'ancien droit est clôturé. Les écritures, uploads et opérations
   projet de l'ancien détenteur sont refusés. Aucun instantané, accusé de
   réception ou circuit de copie supplémentaire n'est ajouté au forçage ; il
   installe la révision serveur et ne préserve pas automatiquement les
   changements non confirmés. Toute utilisation répétée reste un signal pour
   diagnostiquer une panne de la reprise normale.
   « Enregistrer sous… » part de la dernière révision confirmée affichée par B,
   crée un nouveau projet et laisse le document source intact. En mode de secours hors connexion,
   créer la copie locale éditable sans attendre les médias absents. Elle garde
   le nouvel identifiant du projet, les identifiants des médias et, pour chaque
   fichier manquant, l'identifiant de son projet source afin de le relire plus
   tard par l'API existante. Au retour du réseau, récupérer les octets encore
   présents à la source puis publier la copie par le circuit documentaire et
   média existant. Si le fichier source a disparu, montrer cette impossibilité
   et laisser la copie locale éditable, sans la déclarer synchronisée. Ne
   confirmer la copie sur le serveur que lorsque son document et ses médias
   nécessaires y sont enregistrés.

## Récupérations retenues

**Décision appliquée le 12 octobre 2026 ; validation inter-navigateurs restante :**
le droit est récupéré automatiquement après expiration du bail renouvelable.
Le forçage manuel est un secours temporaire qui révoque immédiatement un droit
actif et installe la révision serveur avant l'édition. Il ne fait ni copie ni
isolation automatique des changements non confirmés. Une utilisation fréquente
signale un problème sous-jacent à corriger. Retirer le forçage temporaire après
validation durable de la reprise normale.

**Décision confirmée, appliquée ; validation complète des médias restante :** hors connexion, B n'a pas nécessairement
les octets des médias confirmés : leur Blob peut avoir été retiré d'IndexedDB
et le cache HTTP peut être évincé. « Enregistrer sous… » crée alors
immédiatement une copie locale éditable, sans précharger tous les médias chez
chaque lecteur. Les médias absents restent identifiés comme indisponibles et
en attente de récupération ; l'interface l'indique. Au retour du réseau,
l'adaptateur Elcé récupère leurs octets par l'API de lecture du projet source
et termine la publication de la copie par le circuit existant. Jusque-là,
cette copie n'est pas présentée comme entièrement synchronisée sur le serveur.
Si la source est devenue inaccessible, la copie reste locale et l'interface
signale le média à remplacer. Cette gestion reste propre à Elcé et n'entre
pas dans la classe commune.

## Acceptation

- La politique commune est testée avec au moins deux contenus distincts et
  sans import Elcé, Remix, XState ou DOM ; l'adaptateur Elcé exerce ce même
  chemin. Aucune dépendance Remix n'est ajoutée à l'éditeur par ce travail.
- Deux navigateurs ouvrent le même projet : A édite, B lit et reçoit une
  révision confirmée sans rechargement. Un changement de focus transfère le
  droit seulement après l'accusé serveur ; B relit avant d'éditer. Pendant
  l'attente, B relève les révisions toutes les deux secondes quand elle est
  visible et conserve sa copie locale `pending` séparée de la vue serveur.
- Une panne réseau pendant le transfert laisse A propriétaire et B non
  éditable. Après reprise, la révision est transmise une fois ; un `412` n'est
  pas répété. Une ancienne session révoquée ne peut modifier ni le document,
  ni ses médias, ni son nom, ni le supprimer. Le prévol CORS accepte les
  en-têtes du droit. Un doublon média détecté par `409` pendant un transfert
  achève `media.merge`, sa sauvegarde et sa publication avant libération, sans
  nouvelle commande auteur ni entrée Undo.
- En édition, une coupure entre la publication du document et le transfert de
  ses médias n'empêche pas de continuer à éditer ; le média absent est signalé.
  La preview utilise une source locale encore disponible ou la ressource
  serveur et exerce le préchargement Sighty/CodPlay réel avant sa lecture. Si
  aucune source ne peut être fournie, son erreur reste visible et aucune
  prévisualisation incomplète n'est présentée comme prête.
- Après perte de connexion de A, le bail expire et B peut obtenir un droit neuf.
  Le bouton temporaire peut aussi révoquer le bail immédiatement. B relit le
  serveur avant toute édition ; une requête tardive de A avec l'ancien droit est
  refusée. Le forçage ne copie pas automatiquement les changements non
  confirmés. Vérifier que son usage reste exceptionnel et diagnostiquer toute
  répétition.
- Hors connexion, B peut éditer sa copie locale avec des médias signalés comme
  indisponibles. Après retour du réseau, ces médias sont récupérés et la copie
  n'est déclarée synchronisée qu'après confirmation du document et des médias.
  Vérifier aussi le rechargement de la copie locale pendant cette attente.
- Vérifier fermeture explicite, fermeture brutale, recharge du même onglet,
  nouvel onglet dans le même navigateur, deux profils isolés, médias et Undo.
  Une acquisition perdue après commit, une ancienne écriture retardée et un
  onglet dupliqué doivent aussi prouver que l'identité de page et le garde
  serveur finalement retenu maintiennent effectivement l'exclusivité.
  Ajouter les tests ciblés des frontières, puis typecheck, tests, build et
  parcours navigateur réel. Après validation, mettre à jour les trois
  spécifications propriétaires et retirer de ce plan les décisions appliquées.

## Correction du 12 octobre 2026 — reprise et anciens formats

**Statut : reprise de session vérifiée sur le parcours mono-fenêtre ; récupération d'un cache local ancien implémentée et vérifiée ; transfert réel entre navigateurs toujours en cours.** Le contrôleur capture le droit
d'édition avant de suspendre les commandes pour une opération projet. Le
coordinateur doit utiliser cette valeur capturée pour attendre la
synchronisation du projet actif ; la valeur transitoire `waiting` ne doit pas
faire échouer la création, l'ouverture, la fermeture ou la suppression active.
Lors d'un rechargement du même onglet, l'ancien coordinateur ferme son canal
d'identité avant d'attendre la libération réseau : sa réponse tardive ne doit
pas faire traiter le nouvel état du même onglet comme une deuxième fenêtre.
Après une sauvegarde locale confirmée, l'attente de publication doit aussi
prendre le document courant de l'acteur XState si son objet a changé depuis le
dernier `schedule()` ; sans confirmation de sauvegarde locale, le garde existant
continue de refuser la publication.

**Décision acceptée le 12 octobre pour un cache local de version non prise en
charge :** lors de l'ouverture d'un projet présent dans le catalogue serveur,
lire d'abord sa version serveur. Si elle est prise en charge, supprimer le
cache local de ce projet (document, checkpoint et médias locaux associés),
recréer ce cache depuis le document confirmé du serveur, puis ouvrir le projet
normalement. Ne pas convertir ni publier l'ancien cache. Si la lecture serveur
échoue, conserver le cache local et laisser le catalogue accessible afin que
l'utilisateur puisse réessayer ou supprimer le projet. Cette récupération
concerne les projets du serveur ; elle ne supprime pas une copie locale
indépendante qui n'existe pas sur le serveur.

**Validation du cache local terminée le 12 octobre 2026 :** les tests du
coordinateur couvrent l'ouverture depuis le catalogue et la conservation du
cache en cas d'échec de lecture serveur. Brave sur `5175` a rechargé le projet
avec un cache local v2 : le document serveur v4 et sa révision ont remplacé le
cache ciblé, le checkpoint est `synced`, l'éditeur s'est ouvert et aucune
écriture du document serveur n'a été émise.

**Constat de focus du 12 octobre :** l'onglet Brave utilisé pour le contrôle
avait reçu le droit et renouvelait son bail. Dans ce contexte MCP, la page
rapportait encore `document.hasFocus() === true` après que l'utilisateur avait
focalisé Firefox ; elle n'a donc pas libéré le droit au changement de focus
réel. Après navigation de cet onglet vers `about:blank`, ses renouvellements
ont cessé et le bail est devenu récupérable après expiration. L'acquisition
depuis Firefox n'a pas pu être observée puisque cette page est hors du contrôle
du MCP. Garder la validation inter-navigateurs en `En cours` ; ne pas confondre
le focus déclaré par l'onglet automatisé avec le focus réel du poste.

**Décision acceptée le 12 octobre — priorité d'édition sur interaction :** une
page lectrice visible et focalisée qui reçoit une interaction utilisateur
(pointeur ou clavier) demande immédiatement la priorité d'édition. Avant de
prendre le droit, elle relit la dernière révision confirmée et vérifie que sa
copie locale ne porte pas de changements `pending` ou `conflict`. Si ces
conditions sont satisfaites, elle reprend le droit serveur par le chemin de
révocation existant, installe la révision serveur, puis active les commandes.
La page sortante devient lectrice et ses anciennes écritures sont refusées.
Un simple événement `focus`, une page masquée ou le relevé périodique ne
révoquent pas un détenteur. Si la révision ne peut pas être confirmée ou que la
copie locale est en attente, la page reste lectrice et conserve les actions de
récupération existantes.

**Décision d'interface acceptée le 12 octobre — état lecteur ordinaire :** une
page sans droit reste simplement indiquée comme « Lecture seule ». Les refus
`edit_access_occupied` et la perte du droit d'une autre page sont des états
ordinaires de coordination ; ils n'affichent ni message d'échec ni boutons
d'accès. Une interaction déclenche d'abord la reprise automatique. Le message
d'échec et les commandes de secours n'apparaissent qu'après trois reprises
consécutives déclenchées par interaction qui échouent. Une reprise réussie
réinitialise cet état ; les erreurs réelles de réseau et de synchronisation
gardent leurs messages propres.

**Acceptation à couvrir :** une interaction pointeur ou clavier dans une page
lectrice synchronisée lui donne le droit sans attendre l'expiration du bail ;
elle montre la dernière révision confirmée avant d'activer l'édition. Une
lecture serveur en échec ou un cache local `pending`/`conflict` ne déclenche pas
de reprise automatique. Une ancienne écriture du détenteur révoqué reçoit
`409 edit_access_lost`. Le focus passif et les tentatives périodiques ne
révoquent pas le droit. Un lecteur initial ne montre que son état de lecture
seule, sans message `edit_access_lost` ni commandes de secours. Celles-ci
restent absentes pendant les deux premiers échecs de reprise et apparaissent au
troisième ; une reprise réussie les efface.

**Validation Brave du 12 octobre :** les tests ciblés du verrou et de
l’interface (12 tests) ainsi que le typecheck Elcé passent. Sur un projet
temporaire dont l’identifiant serveur a été vérifié, le titre d’une page a été
modifié dans la fenêtre éditrice ; le blur du champ l’a publié à la révision 1.
Un second contexte Brave isolé a reçu ce titre en lecture seule, puis une
interaction lui a transféré l’édition ; la première fenêtre est repassée en
lecture seule. Le projet temporaire a ensuite été supprimé.

Cette validation ne couvre pas encore le changement de focus natif entre la
fenêtre Brave normale et la fenêtre privée fournie : `select_page` n’a produit
ni `blur` ni `focus` dans les pages contrôlées, et les deux signalaient encore
`document.hasFocus() === true`. La fenêtre privée existante, dont le champ de
titre avait une valeur locale différente de son `defaultValue`, a été laissée
intacte. Garder l’acceptation du focus natif en cours ; ne pas lancer Firefox.
