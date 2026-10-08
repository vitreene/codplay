# Elcé — entrée Remix SPA

## Rôle

Cette entrée compose l’application auteur dans le routeur navigateur
`remix/spa`. Le routeur API Fetch est servi séparément par le serveur local.
Les builders et scènes restent des responsabilités Elcé, Sighty et CodPlay ;
le portage ne crée pas de scène, d’état de lecture ni de commande parallèle.

## Composition

- [`browser-entry.ts`](../src/app/remix/browser-entry.ts) compose le
  contrôleur XState, IndexedDB, la synchronisation de projet et une unique
  `EditorActionsFacade` pour l’application auteur. Sur une URL de popup, il ne
  crée pas de contrôleur ou de store auteur.
- [`remix-spa-router.ts`](../src/app/remix/remix-spa-router.ts) place l’acteur
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
  directe et Carousel à chaque ligne BDC.
- La Section utilise `renderRemixSectionEditor` et `SectionTiptapAdapter`.
  Remix rend le titre, les commandes et les ancres ; `@tiptap/core` garde le
  DOM ProseMirror. Les transactions, dépôts média, déplacements d’ancres et
  persistance empruntent les façades métier et l’acteur XState existants.
- `RemixCardEditorFields` est partagé par les Cartes directes Flux/Diapo et les
  Cartes enfants du Carousel. Les réglages et l’ordre des enfants restent dans
  `RemixCarouselEditor`. Les champs et imports média empruntent les façades
  Carte et Carousel existantes.
- Les icônes Elcé sont créées à partir de `lucide-static` comme éléments SVG
  natifs ; aucun adaptateur d’icônes React n’est chargé.
- [`elce-local-server.ts`](../src/server/elce-local-server.ts) sert le document
  Remix et ses assets, puis réutilise ou lance le serveur projet API sur
  `127.0.0.1:5181`. La réponse HTML fournit l’import map Remix et les styles.

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

- [`workspace/page-editor.test.ts`](../src/app/remix/workspace/page-editor.test.ts)
  monte l’éditeur de production. Il vérifie l’ordre et l’unicité des cinq BDC,
  leurs éditions, les Cartes Carousel et leur réordonnancement, le déplacement
  d’un BDC, le changement de page, la Carte directe Flux/Diapo et la
  restitution des sélections enregistrées. Un parcours importe aussi des
  médias Question, Carte et Carousel par le stockage et la file XState réels.
- [`workspace/chapter-settings.test.ts`](../src/app/remix/workspace/chapter-settings.test.ts)
  vérifie le réglage enregistré d’un chapitre après remontage.
- [`remix-section-production.test.ts`](../src/app/editor/section/remix-section-production.test.ts)
  vérifie dans le même `RemixPageEditor` le contenu, le titre, les commandes
  Tiptap, le dépôt et la persistance d’une image, l’aperçu et le déplacement
  d’ancre, ainsi que la conservation de l’instance Editor et de son DOM.
- [`project-application.test.ts`](../src/app/remix/project-application.test.ts)
  vérifie le montage de l’éditeur natif dans `ProjectApplication` et le
  remplacement de la zone centrale après sélection d’un chapitre.
- [`remix-spa-router.test.ts`](../src/app/remix/remix-spa-router.test.ts)
  vérifie que l’URL de popup rend le lecteur sans monter l’application auteur.
- [`popup-player.test.ts`](../src/app/player/popup-player.test.ts) exerce le
  protocole de messages et le chargement du média serveur sans Blob IndexedDB.
- Brave DevTools, le 8 octobre 2026, a ouvert `npm run dev:elce` sur
  `http://localhost:5176` puisque `localhost:5175` était occupé. La route a
  rendu la liste des projets de l’API réutilisée. Dans le même contexte, Projet
  1 a été ouvert et son popup natif a affiché la Diapo sélectionnée avec cinq
  images complètes chargées depuis les URL API ; « Réafficher la page éditée »
  a renvoyé cette page. Les consoles étaient vides et aucun asset React,
  ReactDOM, `@react-refresh` ou `react/jsx-runtime` n’a été demandé.
- Les 206 tests Elcé passent, le typecheck passe et `vite build` réussit. Le
  bundle JavaScript fait `1 314,22 kB` minifiés (`372,16 kB` gzip) et conserve
  l’avertissement Vite au-dessus de `500 kB`.
