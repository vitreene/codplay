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

Chaque instantané reçu monte une nouvelle composition du lecteur. La
progression, les réponses et l’historique restent locaux à cette session de
lecture et ne sont pas persistés.

Le document de l’éditeur reste la source unique. La communication entre les
fenêtres transporte des demandes et des instantanés ; elle ne crée ni document,
ni catalogue, ni navigation parallèle. Pour un média dont le transfert est
confirmé dans le checkpoint du projet, le lecteur utilise l’URL stable fournie
par l’API Elcé ; le navigateur charge le fichier comme une ressource ordinaire
et peut réutiliser son cache HTTP. Tant qu’un transfert reste en attente, le
lecteur crée une URL objet depuis le Blob conservé localement. Après
confirmation du transfert d’une image, le Blob n’est pas requis par le lecteur.

Le lecteur rend le menu, le titre de page, le contenu Flux et la navigation
précédente/suivante avec les compositions Sighty/CodPlay existantes. Le menu et
l’ordre de lecture reprennent la séquence racine du document : les pages
autonomes sont au même niveau que les chapitres. Les pages du catalogue restent
exclues du scénario.

## Preuves

- [`ProjectApplication`](../src/app/remix/project-application.ts) ouvre le
  popup depuis la page sélectionnée et détruit sa liaison à la fermeture de
  l’application auteur.
- [`PopupPreviewHost`](../src/app/player/popup-preview-host.ts) transmet les
  instantanés et les demandes au moyen du protocole de messages existant,
  attaché à l’acteur XState auteur.
- [`PopupPlayer`](../src/app/player/popup-player.ts) est rendu par le routeur
  `remix/spa`. Il reçoit les instantanés, résout les médias confirmés par l’URL
  de l’API Elcé et crée temporairement des URLs objet pour les transferts en
  attente. Il remonte la composition réelle à chaque instantané.
- [`popup-player.css`](../src/app/player/popup-player.css) conserve les
  libellés sur ordinateur et masque le texte au profit des icônes à 800 px et
  en dessous.
- [`popup-preview-host.test.ts`](../src/app/player/popup-preview-host.test.ts)
  vérifie la page de départ, la synchronisation du document édité et la
  sélection de la page courante.
- [`popup-player.test.ts`](../src/app/player/popup-player.test.ts) vérifie la
  synchronisation unique lorsqu’une page éditée vient d’être créée et la
  résolution d’un média confirmé dont le Blob n’est plus présent en local.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie la réutilisation des sources de scènes inchangées après une
  réorganisation et la reconstruction de la scène d’une page éditée.
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
- Les tests du workspace Elcé, le typecheck et le build passent. Le build
  signale un chunk JavaScript supérieur à 500 kB ; la validation du popup ne
  réduit pas ce chunk.
