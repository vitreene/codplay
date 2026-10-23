# Elcé — entrée Remix SPA

## Rôle

Cette entrée compose l’application auteur dans le routeur navigateur
`remix/spa`. Le routeur API Fetch est servi séparément par le serveur local.
Les builders et scènes restent des responsabilités Elcé, Sighty et CodPlay ;
le portage ne crée pas de scène, d’état de lecture ni de commande parallèle.

## Composition

- [`browser-entry.tsx`](../src/app/remix/browser-entry.tsx) compose le
  contrôleur XState, IndexedDB, la synchronisation de projet et une unique
  `EditorActionsFacade` pour l’application auteur. Sur une URL de popup, il ne
  crée pas de contrôleur ou de store auteur.
- [`remix-spa-router.tsx`](../src/app/remix/remix-spa-router.tsx) place l’acteur
  et la façade auteur dans `EditorContextProvider`, puis rend
  `ProjectApplication`. Sur l’URL de popup, la même route rend directement
  `PopupPlayer` dans Remix, sans import dynamique d’une entrée historique.
- [`ProjectApplication`](../src/app/remix/project-application.ts) rend la
  gestion des projets, le Scénario, les réglages de chapitre, le catalogue,
  l’aperçu popup et la zone centrale. Une sélection de page monte
  [`RemixPageEditor`](../src/app/remix/workspace/page-editor.ts). Leurs
  commandes et leur persistance restent attachées au même acteur XState.
- `RemixPageEditor` conserve l’ordre `page.bdcIds`, les séparateurs de
  déplacement, les titres éditables, les commandes de création et le nettoyage
  au changement de page. Il rend dans Remix Section, Question, Résultat, Carte
  directe et Carousel à chaque ligne BDC. Les marqueurs de type du chapitre
  courant et de la page sélectionnée mesurent tous deux 14 × 14 px. L’échelle
  commune des icônes Lucide de l’interface est 14 × 14 px ; les commandes
  conservent leurs dimensions propres à leur rôle, avec 2 px de padding autour
  des icônes seules et 4 px d’écart entre l’icône et son libellé ou voisin.
- La Section utilise `renderRemixSectionEditor` et `SectionTiptapAdapter`.
  Remix rend le titre, les commandes et les ancres ; `@tiptap/core` garde le
  DOM ProseMirror. Les transactions, dépôts média, déplacements d’ancres et
  persistance empruntent les façades métier et l’acteur XState existants.
- `RemixCardEditorFields` est partagé par les Cartes directes Flux/Diapo et les
  Cartes enfants du Carousel. Les réglages et l’ordre des enfants restent dans
  `RemixCarouselEditor`. Les champs et imports média empruntent les façades
  Carte et Carousel existantes. Dans la barre des vues, l’ajout d’une Carte
  montre l’icône Carte et l’ajout d’un Graphe son icône Graphe ; le libellé
  court reste sous l’icône. Le retrait d’un média de Carte utilise l’icône
  corbeille `Trash2` ; la croix du panneau d’édition ferme ce panneau.
- Les icônes Elcé sont créées à partir de `lucide-static` comme éléments SVG
  natifs ; aucun adaptateur d’icônes React n’est chargé.
- Les vues Remix sont écrites en JSX dans des fichiers `.tsx`. TypeScript est
  configuré avec `jsx: "react-jsx"` et `jsxImportSource: "remix/ui"` : le
  runtime émis est celui de Remix (`remix/ui/jsx-runtime`), sans dépendance ni
  import React.
- [`elce-local-server.ts`](../src/server/elce-local-server.ts) sert le document
  Remix et ses assets, puis réutilise ou lance le serveur projet API sur
  `127.0.0.1:5181`. La réponse HTML fournit l’import map Remix et les styles.
  En développement, elle n’émet pas les `modulepreload` de l’entrée Remix :
  les modules sont chargés à leur import et le navigateur n’affiche pas les
  avertissements de préchargements inutilisés. En production, les indications
  `modulepreload` restent présentes.
- Le mode réseau opt-in `npm run dev:elce:network` sert les mêmes ports `5175`
  et `5181` sur l’IPv4 privée active. Le serveur Web n’affiche aux clients
  réseau que les assets nécessaires et la route `/` avec le paramètre
  `elce-preview-project` ; l’application auteur reste locale. Le bouton
  « Prévisualiser » ouvre cette route avec l’identifiant du projet et la page
  sélectionnée. `browser-entry.tsx` ne monte alors ni contrôleur auteur ni
  stockage IndexedDB ; `PopupPlayer` lit la dernière révision confirmée par
  l’API et utilise les médias serveur. Un rechargement récupère la version
  courante ; la preview n’est pas poussée en direct pendant qu’elle reste
  ouverte.
- En développement, [`dev-elce.mjs`](../scripts/dev-elce.mjs) lance le
  superviseur `remix/node-hmr`. Le canal HMR Remix surveille les assets ; toute
  mise à jour non vide, JSX ou CSS, déclenche un rechargement automatique de
  l’onglet. Ce choix évite qu’une acceptation de module racine laisse un DOM
  périmé dans l’éditeur. Le rechargement reprend l’état du projet par les
  mécanismes existants de persistance et de synchronisation. L’interface reste
  sur 5175 et l’API sur 5181 ; le flux HMR utilise son canal local interne,
  sans serveur Vite navigateur supplémentaire.

## Invariants

- Le contrôleur XState reste l’unique propriétaire du document et de l’accès
  au projet. Le Context Remix ne possède qu’une référence vers cet acteur ; les
  snapshots locaux servent au rendu.
- Chaque vue auteur utilise `EditorActionsFacade` et les façades métier
  établies. Aucun composant Remix ne conserve un second document, ne fabrique
  un circuit de synchronisation ou ne contourne les services métier.
- Les BDC directs gardent l’ordre de `page.bdcIds`. Les Cartes enfants gardent
  leurs relations Carousel et leur ordre propre ; elles ne deviennent pas des
  BDC directs de page.
- Les sélecteurs natifs affichent les valeurs du snapshot documentaire au
  montage et après navigation ou rechargement. Une configuration donne les
  valeurs initiales des objets créés ; elle ne remplace pas une valeur
  enregistrée.
- Le routeur API reste séparé du routeur SPA. Ses réponses ne remplacent pas
  l’état documentaire possédé par XState.
- Aucun code de production ou test du workspace Elcé n’importe React,
  ReactDOM, `@xstate/react`, `@tiptap/react` ou `lucide-react`. Vite reste un
  outil de build, de tests et de chargement SSR du point d’entrée local ; il ne
  sert pas l’interface auteur dans le navigateur.

## Preuves

- [`workspace/page-editor.test.tsx`](../src/app/remix/workspace/page-editor.test.tsx)
  monte l’éditeur de production. Il vérifie l’ordre et l’unicité des cinq BDC,
  leurs éditions, les Cartes Carousel et leur réordonnancement, le déplacement
  d’un BDC, le changement de page, la Carte directe Flux/Diapo et la
  restitution des sélections enregistrées. Un parcours importe aussi des
  médias Question, Carte et Carousel par le stockage et la file XState réels.
- [`workspace/chapter-settings.test.tsx`](../src/app/remix/workspace/chapter-settings.test.tsx)
  vérifie le réglage enregistré d’un chapitre après remontage.
- [`remix-section-production.test.tsx`](../src/app/editor/section/remix-section-production.test.tsx)
  vérifie dans le même `RemixPageEditor` le contenu, le titre, les commandes
  Tiptap, le dépôt et la persistance d’une image, l’aperçu et le déplacement
  d’ancre, ainsi que la conservation de l’instance Editor et de son DOM. Il
  vérifie aussi que le bouton de retrait du média rend `lucide-trash-2`, tandis
  que le bouton de fermeture du panneau rend `lucide-x`.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  vérifie le montage de l’éditeur natif dans `ProjectApplication` et le
  remplacement de la zone centrale après sélection d’un chapitre.
- [`remix-spa-router.test.ts`](../src/app/remix/remix-spa-router.test.ts)
  vérifie que l’URL de popup rend le lecteur sans monter l’application auteur.
- [`elce-local-server.test.ts`](../src/server/elce-local-server.test.ts)
  vérifie que la réponse de développement omet les `modulepreload`, tandis que
  la réponse de production les conserve.
- [`popup-player.test.tsx`](../src/app/player/popup-player.test.tsx) exerce le
  protocole de messages et le chargement du média serveur sans Blob IndexedDB.
- Brave DevTools, le 8 octobre 2026, a ouvert `npm run dev:elce` sur
  `http://localhost:5176` puisque `localhost:5175` était occupé. La route a
  rendu la liste des projets et l’éditeur depuis les entrées `.tsx`; les
  16 modules de composants Remix ont été chargés avec succès. La console était
  vide et aucun asset React ou ReactDOM n’a été demandé. Le parcours précédent
  du même portage a aussi affiché le lecteur popup et ses cinq images serveur.
- Le 9 octobre 2026, après remplacement du serveur Elcé sur le même port,
  Brave DevTools a relu l’origine `http://localhost:5175` sans réinitialiser
  IndexedDB. La base existante `elce-poc` (schéma v2) contient les documents
  v4 de Projet 3 et Projet 1 ; ce dernier conserve 2 chapitres, 7 pages, 15 BDC,
  5 références média et le checkpoint synchronisé à la révision 93. Les cinq
  images serveur chargent. Après rechargement, Projet 3 est restauré et la
  console ne contient aucune erreur.
- Le 9 octobre 2026, Brave vérifie le HMR sur 5175 : une modification JSX
  temporaire devient visible après rechargement automatique sans redémarrer le
  serveur ; une règle CSS temporaire est également appliquée automatiquement.
  Après chaque rechargement, Projet 1 reste ouvert et l’état revient à
  « Synchronisé ». Les deux modifications de vérification sont retirées.
- Le 13 octobre 2026, Brave vérifie le lancement réseau sur 5175/5181 et
  l’ouverture du lecteur `elce-document` depuis l’éditeur. En émulation mobile
  390 × 844, la page « Titre » et ses médias s’affichent sans en-tête Elcé ni
  actions de synchronisation. La lecture API retourne la révision serveur 10.
  L’API refuse la liste des projets et le prévol d’une mutation. Le téléphone
  physique reste à vérifier sur le réseau local.
- Les 206 tests Elcé passent, le typecheck passe et `vite build` réussit. Le
  bundle JavaScript fait `1 314,76 kB` minifiés (`372,33 kB` gzip) et conserve
  l’avertissement Vite au-dessus de `500 kB`.
