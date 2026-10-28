# Elcé — surface de preview

## Statut

**En cours — le contrat de consultation, la fenêtre distincte, la navigation
indépendante, la synchronisation manuelle, la composition Sighty/CodPlay et la
progression sont vérifiés. Le lecteur est rendu par Remix sans dépendance
React. Le sommaire présente encore un `aria-expanded` incohérent au passage de
800 à 801 px et un retour de focus tardif à la fermeture ; ces points restent
suivis dans le plan de construction.**

## Contrat

Le bouton « Prévisualiser » ouvre le lecteur dans une fenêtre distincte. Cette
fenêtre reçoit le document de l’éditeur et la page sélectionnée au moment de
son ouverture.
Si une ancienne session n’a plus de liaison avec l’éditeur, cliquer de nouveau
sur « Prévisualiser » relance une session fraîche dans la même fenêtre nommée
`elce-player-preview`. Elle reçoit alors le document courant et la page active.

Une preview de session ne charge que l’instantané transmis par son éditeur.
Si la fenêtre émettrice est absente, le lecteur demande de rouvrir la preview
depuis l’éditeur. Si aucun instantané n’arrive, il termine l’attente et indique
que l’éditeur n’a pas transmis le document. Il ne remplace pas cet instantané
par un document local par défaut, qui pourrait appartenir à une autre session
ou à une version antérieure.

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
Le bouton « Test auteur » suit la même adaptation : son libellé est masqué sur
petit écran, tandis que son nom accessible descriptif reste disponible.
Les icônes d’interface du lecteur, y compris l’ouverture et la fermeture du
sommaire Sighty/CodPlay, suivent la hauteur de capitale de la police courante
avec `block-size: 1cap` et une largeur automatique, sans taille fixe dans les
attributs SVG. Les boutons gardent leur gabarit propre : la barre conserve ses
cibles de 40 px sur mobile et le menu garde ses cibles tactiles de 44 px.

La popup auteur propose « Test auteur » pour ouvrir les réglages du profil et
de la progression. Son icône Lucide List est la même que celle du bouton
« Sommaire » dans l’éditeur.

Chaque instantané reçu monte une nouvelle composition du lecteur. La
navigation et l’historique restent propres à cette session. Avant une
reconstruction, le lecteur conserve la sélection active de Sighty comme page de
départ ; les autres slots et les directions de navigation sont dérivés du
graphe. Le profil, la progression, les réponses, les évaluations et cette
sélection restent dans la session lecteur, séparément des sources de scènes
réutilisées. Ces sources ne capturent pas l’état de consultation et le cache
des ressources est libéré à la fermeture de la fenêtre.

Le lecteur peut charger l’état test initial depuis l’API du projet. Tout l’état
de consultation — navigation, réponses, progression, profil et évaluations —
reste dans la session mémoire de la preview. Une preview ne l’enregistre jamais
sur le serveur : le popup local comme la preview réseau n’envoient aucun
`PUT /test-state`, et fermer le popup détruit cet état mémoire. La preview
réseau peut lire l’état initial en `GET` ; sa politique refuse toute écriture.
Le `PUT /test-state` du serveur reste destiné aux contextes auteur qui
enregistrent explicitement l’état test, hors preview. Le contrat du stockage
et de sa révision figure dans la
[spécification Sommaire et profils](./summary-profile-spec.md).

Dans la popup, une reconstruction provoquée par la remise à zéro de la
progression reprend la page courante du lecteur depuis Sighty. Une demande
explicite « Synchroniser » utilise la page sélectionnée dans l’éditeur. Le
[test d’intégration popup](../src/mods/learning/integration/learning-preview-session.test.tsx)
exerce ces deux actions avec la composition Sighty/CodPlay réelle et vérifie
qu’une réponse de preview ne déclenche aucune écriture API. Les tests de
[composition du player](../src/mods/learning/reading/learning-player.test.ts) vérifient
la réutilisation des scènes Flux/Diapo, la restauration ou la suppression des
réponses, et l’absence d’une nouvelle validation.

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
`createElcePlayerScenario`. Les styles partagés du lecteur, d’expansion du
viewport et d’apparence documentaire sont attachés à la source de la scène
layout persistante. Les styles de géométrie des builders restent attachés aux
scènes de page. La feuille layout porte les définitions `@font-face` uniques
pour les familles, styles et poids utilisés par le document ; les scènes de
page n’en redéclarent aucune. Dans la preview, `/fonts/<famille>/<style>-<poids>.ttf` est
servi par le routeur Elcé via le service d’assets Remix, qui le résout depuis
`/assets/elce/assets/fonts/`. Dans le package Sighty, l’exporteur copie les
fichiers utilisés et leurs licences ; la feuille emploie `./fonts/` pour rester
autonome après extraction.
Les classes d’apparence sont lisibles, réutilisables et indépendantes des
identifiants de cibles. Elles restent distinctes des classes de layout et de
transition des builders. Les identifiants DOM et les cibles `data-part` ne
changent pas.

Les réglages d’apparence du document s’appliquent par classes et feuilles CSS
de scène. Le fond projet cible la racine layout, tandis que sa typographie et
sa densité visent la zone de contenu ; les réglages de page et de chaque BDC
conservent leurs surfaces propres. Les déclarations statiques restent dans les
classes CSS ; les attributs CodPlay `style` restent réservés aux propriétés
animées et à leur état de repos. Le détail du résolveur, du panneau et des rôles
de surface figure dans la [spécification d’apparence](./appearance-spec.md).

Le lecteur charge comme assets les feuilles de palette, de famille, de densité
et la règle de lecture commune effectivement utilisées. La feuille de la scène
layout porte les règles de couleurs personnalisées et les `@font-face` propres
au document. Les feuilles de l’application d’édition ne sont pas ajoutées au
document lecteur. Dans le package Sighty, les mêmes feuilles utilisées sont
importées localement par la scène layout et le paquetage les développe selon
son circuit CSS existant.

[`appearance-font-assets.test.ts`](../src/player/appearance-font-assets.test.ts)
vérifie la déduplication des règles et les chemins preview/package ;
[`elce-local-server.test.ts`](../src/server/elce-local-server.test.ts) vérifie
le routage local des fichiers `.ttf`. La validation Safari du rendu Demo5 après
chargement de la migration v7 reste ouverte dans le
[plan Style](../plan/2026-10-22-elce-style-tab-plan.md).

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

« Précédent » dépend de l’existence d’une page précédente, sans condition de
complétion. « Suivant » demande que la page courante puisse être quittée et que
sa destination soit accessible. En multi-SCO, la destination de bordure est
disponible seulement avec l’identifiant stable du SCO voisin. La garde de sortie
ne vérifie pas l’existence de cette destination ; l’action inter-SCO la
revalide avec la complétion de la page avant d’appeler le LMS.

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

- [`elce-player-composition.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  exerce une vidéo Carte dans la composition Sighty/CodPlay réelle : fin de
  page par l’adaptateur d’observation, clic Suivant, `STOP` à zéro, clic
  Précédent et réutilisation du même nœud et de la même source à zéro.
- Les tests [Flux](../src/mods/learning/integration/flux-scene-builder.test.ts) et
  [Diapo](../src/mods/learning/integration/diapo-scene-builder.test.ts) couvrent aussi le
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

- [`ProjectApplication`](../src/core/authoring/layout/project-application.tsx) ouvre le
  popup depuis la page sélectionnée et détruit sa liaison à la fermeture de
  l’application auteur.
- [`PopupPreviewHost`](../src/core/preview/popup-preview-host.ts) transmet les
  instantanés et les demandes au moyen du protocole de messages existant,
  attaché à l’acteur XState auteur.
- [`PopupPlayer`](../src/mods/learning/preview/learning-preview-view.tsx) est rendu par le routeur
  `remix/spa`. Il reçoit les instantanés, résout les médias confirmés par l’URL
  de l’API Elcé et crée temporairement des URLs objet pour les transferts en
  attente. Il remonte la composition réelle à chaque instantané.
- [`popup-player.css`](../src/core/preview/popup-player.css) conserve les
  libellés sur ordinateur et masque le texte au profit des icônes à 800 px et
  en dessous.
- [`popup-preview-host.test.ts`](../src/core/preview/popup-preview-host.test.ts)
  vérifie la page de départ, la synchronisation du document édité et la
  sélection de la page courante.
- [`popup-player.test.tsx`](../src/mods/learning/preview/learning-preview-view.test.tsx) vérifie la
  synchronisation unique lorsqu’une page éditée vient d’être créée et la
  résolution d’un média confirmé dont le Blob n’est plus présent en local. Il
  vérifie aussi l’icône partagée du bouton « Test auteur », ainsi que les
  messages de reprise sans éditeur et sans réponse initiale, sans chargement
  d’un ancien document local.
- [`elce-player-composition.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  vérifie la réutilisation des sources de scènes inchangées après une
  réorganisation et la reconstruction de la scène d’une page éditée. Il
  vérifie aussi le départ direct à la Question D, son achèvement par réponse et
  scroll-end, l’accès à F, le maintien du verrou de G tant que ses prérequis
  globaux restent incomplets. Le test de révélation monte la composition réelle,
  garde stable la racine observée, vérifie une première mesure sans animation,
  puis fait passer la Carte de `inside` à `outside` et de nouveau à `inside` ;
  il vérifie l’opacité média fixe à `0.92`, l’absence d’état `opacity` animé sur
  la racine image et la translation horizontale du média sur les deux trajets.
  Il utilise un `IntersectionObserver` contrôlé et ne remplace pas la
  validation visuelle de l’observer natif dans le navigateur. Les contrôles de
  composition passent tous les 45.
- Brave DevTools, le 5 octobre 2026, a vérifié l’ouverture dans une fenêtre
  distincte, la navigation indépendante, la synchronisation manuelle, le
  retour à la page éditée et la synchronisation unique d’une nouvelle page.
  Il a aussi vérifié les libellés accessibles à 390 px, 800 px et 801 px.
- Brave DevTools, le 26 octobre 2026, a vérifié la preview en largeur mobile et
  ordinateur : le contenu passe en une colonne sur mobile sans débordement
  horizontal ; le libellé « Test auteur » est masqué et son nom accessible
  conservé. Sur ordinateur, le libellé réapparaît et la composition reprend
  ses colonnes. Le test `popup-player.test.tsx` vérifie le libellé et son
  enveloppe responsive dans le DOM.
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
- Safari MCP, le 25 octobre 2026, confirme dans l’éditeur la prise en charge de
  `1cap` et l’absence d’attributs SVG de taille fixe sur les icônes. La feuille
  du popup applique la même règle ; ses cibles tactiles restent configurées à
  40 px et 44 px.
- Brave DevTools, le 13 octobre 2026, a ouvert depuis l’éditeur synchronisé
  `elce-document`, page « Titre », l’URL réseau
  `http://192.168.1.47:5175/?elce-preview-project=elce-document&elce-preview-page=page-a`.
  L’API a répondu `200` à la lecture du document, révision 10, et les médias
  visibles ont chargé. À 390 × 844, l’en-tête et les actions de preview sont
  absents ; le lecteur occupe l’écran et garde ses commandes de navigation.
  L’API refuse la liste des projets (`403`) et un prévol d’écriture (`403`).
  Brave émule ici un téléphone ; l’accès depuis un téléphone réel reste à
  vérifier sur le même réseau local.
- Brave DevTools, le 26 octobre 2026, a rechargé une ancienne URL de session
  sans fenêtre émettrice. Avant correction, le secours chargeait le document
  local par défaut v4 et affichait son erreur de version avec l’indication de
  chargement encore visible. Désormais, le lecteur affiche seulement la
  consigne de réouverture. Une nouvelle preview ouverte depuis l’éditeur rend
  le document v7, sans message d’erreur ni erreur console.
- Brave DevTools, le 26 octobre 2026, a aussi vérifié le rétablissement après
  « L’éditeur n’a pas transmis le document » alors que la fenêtre de l’éditeur
  restait ouverte. Un nouveau clic sur « Prévisualiser » réutilise la popup,
  crée une nouvelle session et charge la page active (« Repérer les grandes
  formes — itération 3 ») sans fermer la fenêtre.
- Safari MCP, le 27 octobre 2026, a validé une réponse dans la preview réseau
  d’un projet temporaire. À la réouverture, la Question était vierge ; une
  lecture API a confirmé l’état serveur à la révision 0 avec
  `questionAnswers: {}`. Un prévol `PUT` présenté avec l’origine preview a
  répondu `403` et n’a autorisé que `GET`, `HEAD` et `OPTIONS`.
- Safari MCP, le 28 octobre 2026, a exécuté le harnais browser du vrai
  `LearningPlayer` dans un onglet isolé. Le harnais injecte un scheduler de
  frames déterministe par l’option publique `frameScheduler`, car l’onglet MCP
  reste en arrière-plan ; le player conserve son scheduler normal en
  production. Sighty/CodPlay et l’`IntersectionObserver` natif sont réels. Le
  harnais laisse d’abord Safari distribuer les observations natives, puis vide
  les frames injectées ; cette attente ne change pas le runtime. Deux parcours
  dans des onglets frais, sans instrumentation de l’observer, ont soumis le
  profil, validé une réponse Question et amené le scrollport Flux au marqueur
  bas. La progression et « Suivant » se sont déverrouillés ; Page A → Page B →
  Page A a conservé le profil soumis, les deux pages terminées et la réponse.
  L’image locale de Page B est chargée (`complete`, largeur intrinsèque 8).
  Dans les deux parcours, la destruction vide le stage et l’inspecteur réseau
  ne compte aucune requête `/test-state`.
- Pour ce parcours, 114 tests ciblés sur 9 fichiers, le typecheck et le build
  passent. Le build conserve son avertissement existant de chunk JavaScript
  supérieur à 500 kB. La vérification browser du départ direct dans Projet 1
  reste suivie au plan de construction.
