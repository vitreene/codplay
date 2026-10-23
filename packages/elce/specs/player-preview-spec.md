# Elcé — surface de preview

## Statut

**En cours — la fenêtre distincte, la navigation indépendante, la
synchronisation manuelle et la composition Sighty/CodPlay sont vérifiées. Le
lecteur est rendu par Remix sans dépendance React. Le sommaire présente encore
un `aria-expanded` incohérent au passage de 800 à 801 px et un retour de focus
tardif à la fermeture ; ces points restent suivis dans le plan de construction.**

## Contrat

Le bouton « Prévisualiser » ouvre le lecteur dans une fenêtre distincte. Cette
fenêtre reçoit le document de l’éditeur et la page sélectionnée au moment de
son ouverture.

Le lecteur monte la composition Sighty/CodPlay réelle dans son propre contexte
de navigateur. Sa navigation est indépendante de celle de l’éditeur. Les
modifications de l’éditeur ne changent pas le rendu ouvert tant qu’une
synchronisation n’est pas demandée.

La barre du lecteur propose deux commandes :

- « Réafficher la page éditée » sélectionne la page active dans l’éditeur. Si
  cette page n’existe pas encore dans l’instantané du lecteur, la commande
  demande une synchronisation une seule fois avant de l’afficher.
- « Synchroniser » transmet le document courant de l’éditeur et sa page
  sélectionnée. Le lecteur affiche cette page dans le nouvel instantané.

Chaque commande associe une icône à son libellé. À 800 px et en dessous, le
libellé visible est masqué et l’icône reste seule. Le texte reste disponible
dans `title` et dans le nom accessible du bouton. Au-dessus de 800 px, l’icône
et le libellé sont visibles ensemble.
Les icônes d’interface du lecteur, y compris l’ouverture et la fermeture du
sommaire Sighty/CodPlay, sont rendues en 14 × 14 px dans l’application Elcé.
Les boutons gardent leur gabarit propre : la barre conserve ses cibles de 40 px
sur mobile et le menu garde ses cibles tactiles de 44 px.

La popup auteur propose « Test auteur » pour ouvrir les réglages du profil et
de la progression. Son icône Lucide List est la même que celle du bouton
« Sommaire » dans l’éditeur.

Chaque instantané reçu monte une nouvelle composition du lecteur. La
navigation et l’historique restent propres à cette session. L’état du test —
profil, progression et réponses — est chargé et enregistré séparément du
document ; la popup auteur et la preview réseau utilisent le même état serveur.
La popup locale peut fonctionner sans persistance lorsque le serveur est
indisponible. Le contrat détaillé figure dans la
[spécification Sommaire et profils](./summary-profile-spec.md).

Le document de l’éditeur reste la source unique. La communication entre les
fenêtres transporte des demandes et des instantanés ; elle ne crée ni document,
ni catalogue, ni navigation parallèle. Pour un média dont le transfert est
confirmé dans le checkpoint du projet, le lecteur utilise l’URL stable fournie
par l’API Elcé ; le navigateur charge le fichier comme une ressource ordinaire
et peut réutiliser son cache HTTP. Tant qu’un transfert reste en attente, le
lecteur crée une URL objet depuis le Blob conservé localement. Après
confirmation du transfert d’une image, le Blob n’est pas requis par le lecteur.

### Sources de style du scénario

La preview et l’export consomment le même scénario produit par
`createElcePlayerScenario`. Les styles partagés du lecteur et d’expansion du
viewport sont attachés à la source de la scène layout. Les feuilles CSS
produites par les builders restent attachées à la source de leur scène de page.
Le paquetage Sighty peut ainsi conserver chaque feuille dans le paquet CodPlay
de la scène qui l’utilise, sans déplacer les styles vers un registre runtime
global.

### Preview réseau sur mobile

Le lancement local opt-in `npm run dev:elce:network` publie une origine de
preview sur l’adresse IPv4 privée de la machine. Depuis « Prévisualiser »,
`PopupPreviewHost` ouvre cette origine avec l’identifiant du projet et la page
sélectionnée. Cette URL autonome ne reçoit pas de copie IndexedDB :
`PopupPlayer` relit le document confirmé par le serveur avec une requête sans
cache et utilise les URL serveur des médias. Recharger cette URL récupère la
dernière révision synchronisée ; les changements qui ne sont pas encore
confirmés par le serveur n’y apparaissent pas.

Cette route masque l’en-tête Elcé et la barre d’actions de la preview. Le lecteur
occupe la hauteur disponible sans marge extérieure. Le sommaire et les
commandes de navigation du lecteur Sighty/CodPlay restent présents pour
parcourir le document.

Le lecteur rend le menu, le titre de page, le contenu Flux et la navigation
précédente/suivante avec les compositions Sighty/CodPlay existantes. Le menu et
l’ordre de lecture reprennent la séquence racine du document : les pages
autonomes sont au même niveau que les chapitres. Les pages du catalogue restent
exclues du scénario.

La page sélectionnée dans l’éditeur au démarrage d’un instantané devient
l’origine de sa progression en avant. Le réglage du Sommaire `endpage | free`
détermine si la complétion est requise pour Suivant et l’accès direct aux pages
ultérieures ; `endpage` est le défaut. `free` retire cette attente pour les
pages ordinaires, mais les gardes Sighty continuent d’appliquer la Visibilité,
les prérequis de chapitre et les règles d’Évaluation. Un BDC Résultat conserve
son garde global et reste inaccessible tant que le parcours requis pour son
évaluation n’est pas terminé. Les pages antérieures à l’origine de preview ne
reçoivent aucune progression ni réponse.

## Lecture des vidéos et sortie de page

Les builders Flux et Diapo déclarent leurs vidéos `media` avec
`initial.sync: 'independent'`. Elles conservent leurs contrôles natifs et les
broadcasts déclarés par leur builder ; leur temps ne suit pas celui de la
scène. Le défaut générique CodPlay reste `auto`, selon la
[spécification média](../../codplay/specs/media-sync-v2-spec.md).

`ElcePlayerComposition` observe le changement du slot de contenu par
`runtime.onSlotChange`. Elle conserve le handle public de l’occurrence
précédente et lui adresse un événement privé par `instance.events.emit`, dans
chaque story contenant ses médias indépendants. Le catalogue déclare dans ces
stories le broadcast `STOP` et son `listen`, pour le livrer même après leur
pause par Sighty. Les cibles viennent du snapshot logique existant ; aucun
accès au nœud vidéo ne commande la lecture.

Cette sortie arrête et remet à zéro ensemble. Le retour sur la page n’ajoute
pas une commande de reset : ses éventuelles commandes d’entrée existantes
restent celles du builder. La destruction désabonne cette observation et
détruit les ressources du lecteur.

## Preuves

### Médias indépendants

- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  exerce une vidéo Carte dans la composition Sighty/CodPlay réelle : fin de
  page par l’adaptateur d’observation, clic Suivant, `STOP` à zéro, clic
  Précédent et réutilisation du même nœud et de la même source à zéro.
- Les tests [Flux](../src/builders/flux/flux-scene-builder.test.ts) et
  [Diapo](../src/builders/diapo/diapo-scene-builder.test.ts) couvrent aussi le
  mode indépendant des vidéos de Question et les commandes de viewport Flux
  conservées. Leurs 22 tests passent le 14 octobre 2026.
- Safari MCP, le 14 octobre 2026, monte un document et un MP4 produits pour la
  validation, sans modifier un projet enregistré. Les clics Suivant puis
  Précédent donnent A → B → A ; à la sortie comme au retour, la vidéo est
  suspendue à zéro, avec le même nœud et la même source, sans erreur du
  lecteur. L’onglet MCP étant masqué, la fixture utilise un ordonnanceur de
  frames par timer et injecte le signal public de fin de page dans Sighty.
  Ce parcours vérifie navigation et transport média ; il ne certifie pas
  l’observation native du bas de page en onglet masqué.
- Vérification du 14 octobre : typecheck et build réussis. La suite complète
  compte 293 succès et 9 échecs, tous reproduits sur `HEAD` avant changement :
  sept assertions de composition/navigation, une attente de paramètres fetch
  et un listener SQLite refusé par l’environnement (`listen EPERM`). Les
  suites globales restent donc à corriger séparément.

### Preuves antérieures de preview

- [`ProjectApplication`](../src/app/remix/project-application.ts) ouvre le
  popup depuis la page sélectionnée et détruit sa liaison à la fermeture de
  l’application auteur.
- [`PopupPreviewHost`](../src/app/player/popup-preview-host.ts) transmet les
  instantanés et les demandes au moyen du protocole de messages existant,
  attaché à l’acteur XState auteur.
- [`PopupPlayer`](../src/app/player/popup-player.tsx) est rendu par le routeur
  `remix/spa`. Il reçoit les instantanés, résout les médias confirmés par l’URL
  de l’API Elcé et crée temporairement des URLs objet pour les transferts en
  attente. Il remonte la composition réelle à chaque instantané.
- [`popup-player.css`](../src/app/player/popup-player.css) conserve les
  libellés sur ordinateur et masque le texte au profit des icônes à 800 px et
  en dessous.
- [`popup-preview-host.test.ts`](../src/app/player/popup-preview-host.test.ts)
  vérifie la page de départ, la synchronisation du document édité et la
  sélection de la page courante.
- [`popup-player.test.tsx`](../src/app/player/popup-player.test.tsx) vérifie la
  synchronisation unique lorsqu’une page éditée vient d’être créée et la
  résolution d’un média confirmé dont le Blob n’est plus présent en local. Il
  vérifie aussi l’icône partagée du bouton « Test auteur ».
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie la réutilisation des sources de scènes inchangées après une
  réorganisation et la reconstruction de la scène d’une page éditée. Il
  vérifie aussi le départ direct à la Question D, son achèvement par réponse et
  scroll-end, l’accès à F, le maintien du verrou de G tant que ses prérequis
  globaux restent incomplets. Le test de révélation monte la composition réelle,
  garde stable la racine observée, vérifie une première mesure sans animation,
  puis fait passer la Carte de `inside` à `outside` et de nouveau à `inside` ;
  il contrôle l’opacité et la translation horizontale du média sur les deux
  trajets. Il utilise un `IntersectionObserver` contrôlé et ne remplace pas la
  validation visuelle de l’observer natif dans le navigateur. Les contrôles de
  composition passent tous les 45.
- Brave DevTools, le 5 octobre 2026, a vérifié l’ouverture dans une fenêtre
  distincte, la navigation indépendante, la synchronisation manuelle, le
  retour à la page éditée et la synchronisation unique d’une nouvelle page.
  Il a aussi vérifié les libellés accessibles à 390 px, 800 px et 801 px.
- Brave DevTools, le 8 octobre 2026, a vérifié le chargement d’une image
  confirmée depuis l’URL serveur dans l’éditeur et dans le popup, sans Blob
  conservé dans IndexedDB ; l’image y était décodée à `1 × 1 px` et la console
  ne contenait ni alerte ni erreur.
- Brave DevTools, le 8 octobre 2026, a lancé l’application Remix avec
  `npm run dev:elce`, puis ouvert le popup natif depuis l’auteur. Le lecteur
  « Lecture Elcé » a affiché la Diapo sélectionnée avec cinq images complètes
  chargées depuis leurs URL API. « Réafficher la page éditée » a réaffiché la
  même page. Les consoles étaient vides et aucun asset React, ReactDOM,
  `@react-refresh` ou `react/jsx-runtime` n’a été demandé.
- Brave DevTools, le 9 octobre 2026, confirme sur 5175 que les commandes de la
  barre et les icônes d’ouverture/fermeture du sommaire mesurent 14 × 14 px. À
  390 px, la barre garde des boutons de 40 px et le menu des boutons de 44 px ;
  à 1280 px, les commandes conservent leurs libellés et noms accessibles.
- Brave DevTools, le 13 octobre 2026, a ouvert depuis l’éditeur synchronisé
  `elce-document`, page « Titre », l’URL réseau
  `http://192.168.1.47:5175/?elce-preview-project=elce-document&elce-preview-page=page-a`.
  L’API a répondu `200` à la lecture du document, révision 10, et les médias
  visibles ont chargé. À 390 × 844, l’en-tête et les actions de preview sont
  absents ; le lecteur occupe l’écran et garde ses commandes de navigation.
  L’API refuse la liste des projets (`403`) et un prévol d’écriture (`403`).
  Brave émule ici un téléphone ; l’accès depuis un téléphone réel reste à
  vérifier sur le même réseau local.
- Pour cette correction, le typecheck et le build passent ; le build signale un
  chunk JavaScript supérieur à 500 kB. La suite de composition Sighty/CodPlay
  passe 28/28. La suite complète compte 218 succès et un échec d’environnement :
  le test de persistance SQLite n’a pas pu ouvrir son listener local (`listen
  EPERM: operation not permitted 127.0.0.1`). La vérification browser du départ
  direct dans Projet 1 reste suivie au plan de construction.
