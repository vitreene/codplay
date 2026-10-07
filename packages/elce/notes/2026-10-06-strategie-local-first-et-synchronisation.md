# Évolution d’Elcé — stockage local et synchronisation

**Rôle : note d’exploration.** Elle explique les choix de conception et les
contraintes vérifiées. Les actions, critères d’acceptation et points encore
ouverts sont dans le [plan de réalisation](../plan/2026-10-06-elce-local-first-synchronisation-plan.md).

## Besoin retenu

La première étape fonctionne avec un seul utilisateur, plusieurs projets et un
serveur lancé localement. Le navigateur appelle directement l’API de ce
serveur ; ce serveur est le backend de l’application, pas un proxy vers un
autre service. La même frontière HTTP pourra être appelée à distance plus tard.
Elcé n’ajoute à ce stade ni comptes, ni rôles, ni collaboration.

L’édition reste locale : XState applique les commandes et IndexedDB conserve le
document. Un geste continu est enregistré dans cette copie locale ; Elcé
synchronise son résultat une fois le geste stabilisé. Les changements rapprochés
peuvent être regroupés en un instantané courant, sans envoyer au serveur chaque
mouvement de pointeur ou chaque état intermédiaire. Si le serveur est
inaccessible, la dernière copie locale reste disponible et sera envoyée au
prochain accès au réseau.

SQLite conserve la liste des projets et leur unique version courante. Le serveur
local lit et écrit les données SQLite et reçoit, enregistre et sert les fichiers
média dans un répertoire séparé. Le client garde les octets d’un média dans
IndexedDB tant que son transfert n’est pas confirmé. Après transfert, une image
est chargée depuis son URL serveur et s’appuie sur le cache HTTP natif du
navigateur plutôt que sur un Blob durable dans IndexedDB. Ce cache est
opportuniste et ne garantit pas l’accès hors connexion ; cette limite est
acceptée à cette étape. Les vidéos sont transférées et conservées comme fichiers
côté serveur. Le seuil à partir duquel une vidéo sera conservée localement ou
lue depuis une URL serveur sera fixé après le POC, selon les contraintes du
serveur réel. La possibilité d’associer ultérieurement un média par lien externe
fera l’objet d’une étude séparée.

## Frontières déjà présentes dans Elcé

Le modèle `ElceDocument` v3 se sérialise en JSON. Les commandes XState sont le
chemin de modification métier.
[`ElceDocumentStore`](../src/infrastructure/indexed-db/document-store-types.ts)
et [`IndexedDbDocumentStore`](../src/infrastructure/indexed-db/document-store.ts)
conservent le document par identifiant et les médias locaux ; le POC stocke
actuellement leurs octets comme `Blob` dans IndexedDB.
[`attachDocumentPersistence`](../src/app/controller/document-persistence.ts)
sérialise les sauvegardes, mais n’expose pas encore un résultat de sauvegarde
exploitable à l’interface : les erreurs vont à la console. L’application démarre
encore sur un document initial, sans catalogue multi-projets ni API serveur.

La spécification du document v3 rejette les documents v1 et v2. Le stockage
serveur devra conserver la version de format et ne pas convertir silencieusement
un ancien document.

Le [modèle de document d’`editor`](../../editor/plan/app/2026-07-11-ed2-document-model.md)
décrit les types et le contenu des médias, sans service vérifié qui les copie
vers un répertoire serveur. Le répertoire serveur est donc une décision Elcé
déjà donnée, pas un mécanisme que l’on peut reprendre tel quel depuis `editor`.

## Synchroniser le résultat d’une commande

La commande complète met à jour l’état XState et la copie IndexedDB. Le client
marque le projet comme « à synchroniser », puis appelle directement l’API
locale du serveur avec le dernier instantané JSON. Les commandes rapprochées
peuvent être coalescées en une seule sauvegarde de l’état courant ; Elcé n’a pas
à rejouer un historique de frappes ou de positions.

L’instantané envoyé porte la révision serveur qu’il a lue. Le serveur enregistre
le nouvel instantané dans une transaction SQLite courte et retourne sa nouvelle
révision. Si une autre fenêtre a changé le projet entre-temps, l’API refuse la
révision dépassée au lieu d’écraser silencieusement le document. La copie
IndexedDB conserve les changements locaux jusqu’à la décision de résolution.

Après une coupure, une tentative au prochain lancement et lorsque le navigateur
signale le retour du réseau suffit au premier périmètre. Il n’est pas nécessaire
de dépendre d’un service worker en arrière-plan : l’API Background Sync n’est
pas largement disponible. IndexedDB fournit déjà la transaction locale pour
enregistrer le document et son état de synchronisation.

## Fichiers média

Le serveur reçoit chaque original comme fichier et conserve ses métadonnées,
son identifiant et sa révision dans SQLite. Pour ne pas publier une référence
vers un fichier incomplet, l’API reçoit le média sous un nom temporaire, le
finalise dans le répertoire dédié, puis enregistre sa référence SQLite. Une
interruption peut laisser un fichier temporaire ou orphelin ; le plan prévoit
une vérification de ce cas. Une empreinte du contenu peut éviter les imports
identiques.

Pour les images dont le transfert serveur est confirmé, le document résout la
référence média en URL. Le navigateur les charge directement comme images ; le
cache HTTP standard peut réutiliser la réponse, sans logique de cache écrite en
JavaScript. L’URL doit identifier le contenu immuable et la réponse doit annoncer
explicitement sa politique `Cache-Control`. Ce cache peut être évincé par le
navigateur : il ne constitue pas une copie persistante garantie hors connexion.
Cette disponibilité hors connexion n’est pas exigée à cette étape. Tant que le
transfert n’est pas confirmé, les octets locaux restent conservés pour ne pas
perdre un import hors connexion.

Le choix entre lire une vidéo depuis IndexedDB ou directement depuis une URL
serveur, ainsi que le seuil correspondant, est reporté après le POC selon les
contraintes du serveur réel. Si la lecture distante est retenue, le serveur
devra répondre aux requêtes HTTP `Range` pour permettre les chargements partiels
et le seek. Elcé réutilise le système de preload CodPlay existant ; sa
revalidation ne fait pas partie de ce plan.

## Une seule fenêtre active avec les API du navigateur

Pour des fenêtres locales de la même origine, les Web Locks peuvent assurer
qu’un seul onglet détient le verrou d’édition du projet. BroadcastChannel peut
transmettre une demande de transfert à l’onglet actif. Lorsqu’une page devient
masquée, `visibilitychange` fournit un signal largement disponible pour
suspendre l’édition et libérer le verrou ; au retour visible, la fenêtre demande
à le reprendre et recharge la révision courante avant toute écriture.

Un simple événement `blur` ne signifie pas toujours que la page est masquée.
L’API de détection d’inactivité du système est expérimentale et non largement
disponible ; un minuteur d’inactivité applicatif n’est donc pas requis dans le
premier périmètre. Si une autre fenêtre garde le verrou, l’éditeur demande de
la fermer ou d’y terminer l’activité. Les Web Locks et BroadcastChannel ne
coordonnent pas des appareils distincts ; ce cas dépendra du futur contexte
d’intégration et d’identité, encore non défini.

## Références techniques

- [Article LogRocket — « Practical demo: building an offline notes app »](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [SQLite — Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)
- [MDN — IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction)
- [MDN — Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN — Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [MDN — Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [MDN — Idle Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API)
- [MDN — Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [MDN — HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [MDN — `video` and its `preload` hint](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video)
- [CodPlay V2 — preload](../../codplay/specs/preload-v2-spec.md)
- [Sighty — authoring and runtime](../../sighty/specs/authoring-library-spec.md)
