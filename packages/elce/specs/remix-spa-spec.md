# Elcé — entrée Remix SPA

## Rôle

Cette entrée compose l’application auteur dans le routeur navigateur
`remix/spa`. Le routeur API Fetch est servi séparément par le serveur local.
Les builders et scènes restent des responsabilités Elcé, Sighty et CodPlay ;
le portage ne crée pas de scène, d’état de lecture ni de commande parallèle.

## Dépendance du workspace

`packages/elce/package.json` est l’unique déclaration directe de `remix` dans
le monorepo, fixée exactement à `3.1.0`. Cette version fournit les API
`remix/component`, `remix/component-hmr` et `remix/spa` utilisées par les surfaces ci-dessous.
La racine ne déclare pas de seconde version de Remix.

Le lockfile résout une seule installation de `remix@3.1.0`, remontée dans le
`node_modules` racine par npm. Les sous-paquets `@remix-run/*` conservent les
versions requises par cet arbre ; leurs numéros de version sont indépendants
de celui du paquet `remix`. La branche RC4 et ses anciens runtimes `ui` et
`ui-hmr` ne sont plus installés.

## Composition

- [`browser-entry.tsx`](../src/app/remix/browser-entry.tsx) choisit la
  composition auteur depuis la route du document. `/learning/:documentId`
  construit Learning et `/hunt/:documentId` construit Quiz Hunt ; `/` et
  `/new` choisissent Learning par défaut ou consomment la sélection temporaire
  de « Autre… ». Une route documentaire transmet son identifiant au bootstrap
  de la composition. Une URL de preview construit seulement la composition de
  lecture correspondante, sans acteur ni store auteur.
- [`createLearningAuthoringComposition`](../src/mods/learning/composition/authoring-composition.tsx)
  et [`createQuizHuntAuthoringComposition`](../src/mods/quiz-hunt/composition/quiz-hunt-authoring-composition.tsx)
  créent chacun leur store, leur session, leur acteur XState et leurs façades.
  Chaque composition expose aussi l’ouverture d’un identifiant de document à
  son coordinateur, utilisée par l’historique navigateur.
- [`remix-spa-router.tsx`](../src/app/remix/remix-spa-router.tsx) reçoit
  `authoringRoot` et `previewRoot`. Il route `/`, `/new`,
  `/learning/:documentId` et `/hunt/:documentId` vers la racine auteur, et les
  paramètres de preview vers la racine de lecture. La route par défaut répond
  404. Il ne construit ni machine, ni façade, ni application projet, ni player.
- [`renderCoreProjectApplication`](../src/core/authoring/layout/project-application.tsx)
  fournit le sélecteur commun superposé à l’application sur `/` et `/new`.
  `/` liste les documents du mod choisi ; Learning est le défaut et « Autre… »
  charge le catalogue de l’autre mod. Un clic ouvre la route du document ; la
  corbeille lance sa suppression confirmée. `/new` demande un nom avant
  d’envoyer la création au coordinateur et d’ouvrir la route obtenue.
- [`LearningProjectApplication`](../src/mods/learning/authoring/learning-project-application.tsx)
  assemble le workspace Learning avec
  [`renderCoreProjectApplication`](../src/core/authoring/layout/project-application.tsx),
  qui possède l’en-tête projet, l’accès, l’historique et le cadre commun.
  [`LearningWorkspace`](../src/mods/learning/authoring/learning-workspace.tsx)
  et [`ScenarioPanel`](../src/mods/learning/authoring/scenario-panel.tsx)
  gardent le parcours et ses placements. Leurs intentions passent par la
  façade Learning et le même acteur auteur.
- [`LearningPageEditor`](../src/mods/learning/authoring/learning-page-editor.tsx)
  assemble les éditeurs de ressources et les contributions propres au mod ;
  [`renderPageEditorView`](../src/core/authoring/page/page-editor-view.tsx)
  possède la présentation commune du titre, des lignes BDC et des séparateurs.
  Les sessions Section/ancres gardent leurs callbacks de montage, d’actualisation
  et de destruction.
- `LearningPageEditor` conserve l’ordre `page.bdcIds`, les séparateurs de
  déplacement, les titres éditables, les commandes de création et le nettoyage
  au changement de page. Il rend dans Remix Section, Question, Résultat, Carte
  directe et Carousel à chaque ligne BDC. Les marqueurs de type du chapitre,
  de la page et toutes les icônes Lucide d’interface utilisent `block-size: 1.4cap`
  et une largeur automatique, sans attributs SVG `width`/`height` fixes. Leur
  hauteur suit la capitale de la police courante ; les commandes conservent
  leurs dimensions propres à leur rôle, avec 2 px de padding autour des icônes
  seules et 4 px d’écart entre l’icône et son libellé ou voisin.
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
  configuré avec `jsx: "react-jsx"` et `jsxImportSource: "remix/component"` : le
  runtime émis est celui de Remix (`remix/component/jsx-runtime`), sans dépendance ni
  import React.
- [`elce-local-server.ts`](../src/server/elce-local-server.ts) sert le document
  Remix et ses assets, puis réutilise ou lance le serveur projet API sur
  `127.0.0.1:5181`. La réponse HTML fournit l’import map Remix et les styles.
  Le module partagé `packages/authoring/audio-capture/src` est autorisé par
  `allowFiles` et servi depuis son mount `audioCapture`, afin que l’éditeur
  puisse importer `@codplay/audio-capture` sans déplacer son code dans Elcé.
  Le mount `vendor` expose le `node_modules` racine et `elceVendor` expose
  `packages/elce/node_modules` sous `/assets/elceVendor/`. Ces deux mounts
  suivent la résolution des workspaces npm ; Remix 3.1.0 et son runtime
  `component` sont servis depuis `vendor` dans l’installation actuelle.
  Si le port API est déjà occupé en mode local, le serveur ne réutilise son
  listener que si `GET /api/projects`, envoyé avec une origine locale, renvoie
  le catalogue et les en-têtes `Access-Control-Allow-Origin` et `Vary: Origin`
  attendus. Une ancienne API sans ce contrat fait échouer le démarrage avec un
  diagnostic explicite du port ; l’éditeur ne démarre pas avec une API qui
  ferait échouer ses lectures navigateur.
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
  Le chargeur de composants est `componentHmr()` depuis
  `remix/component-hmr/assets` ; il complète le chargeur JSON existant.

## Imports JSON locaux

Le serveur d'assets Elcé accepte les imports de fichiers `.json` locaux dans
les sources navigateur autorisées, grâce à
[`json-module-loader.ts`](../src/server/json-assets/json-module-loader.ts).
Le chargeur complète `scripts.loaders` de Remix ; il ne modifie pas les
sources des paquets consommateurs.

- Les imports statiques, les imports dynamiques à chemin littéral et les
  réexports sont analysés avec `es-module-lexer`. Les chaînes et commentaires
  qui ressemblent à des imports ne sont pas transformés.
- Le fichier est validé comme JSON côté serveur, puis représenté par un module
  ESM embarqué exportant sa valeur par défaut. Ce module utilise `JSON.parse`
  pour préserver exactement les clés JSON, dont `__proto__`. Aucun catalogue
  ou fichier JavaScript généré n'est maintenu à côté de la source JSON.
- Deux consommateurs d'un même fichier canonique partagent la même instance
  de module, y compris via un lien symbolique autorisé. Deux fichiers distincts
  de même contenu conservent des identités distinctes.
- Les règles `allowFiles` et `denyFiles` des sources sont partagées avec le
  chargeur et contrôlées avant lecture et après résolution du lien symbolique.
  Un fichier absent, invalide ou interdit produit une erreur de compilation.
  Les imports JSON par nom de paquet ne font pas partie de ce raccord.
- Les changements, suppressions et recréations JSON sont transmis aux modules
  consommateurs par le canal HMR existant. Le compilateur invalide ces modules
  et le canal émet le rechargement habituel. Le suivi des anciennes dépendances
  est retiré lorsqu'un import change et libéré à la fermeture du canal ; aucun
  watcher supplémentaire n'est créé.
- Les source maps sont composées avec celles de la compilation TypeScript.
  La transformation fonctionne aussi avec minification et HMR désactivé.

[`json-module-loader.test.ts`](../src/server/json-assets/json-module-loader.test.ts)
couvre l’identité des modules JSON, les imports/réexports, les valeurs
invalides ou absentes, les règles d’accès, les liens symboliques, l’invalidation
HMR, la récupération après erreur et le mode production.

## Invariants

- Le contrôleur XState reste l’unique propriétaire du document et de l’accès
  au projet. Le contexte Remix Learning expose une référence vers cet acteur
  et les façades injectées ; les snapshots locaux servent au rendu.
- `CoreEditorFacade` possède les gestes projet et l’historique communs.
  `LearningEditorFacade` délègue à ces gestes, aux façades de ressources et
  aux commandes Learning. Les vues communes reçoivent des actions typées et
  n’importent pas les façades concrètes.
- Aucune vue auteur ne conserve un second document, ne fabrique un circuit de
  synchronisation ou ne contourne les services métier.
- Les BDC directs gardent l’ordre de `page.bdcIds`. Les Cartes enfants gardent
  leurs relations Carousel et leur ordre propre ; elles ne deviennent pas des
  BDC directs de page.
- Les sélecteurs natifs affichent les valeurs du snapshot documentaire au
  montage et après navigation ou rechargement. Une configuration donne les
  valeurs initiales des objets créés ; elle ne remplace pas une valeur
  enregistrée.
- Le routeur API reste séparé du routeur SPA. Ses réponses ne remplacent pas
  l’état documentaire possédé par XState.
- Un identifiant de route est prioritaire sur le projet mémorisé. Le document
  doit exister dans le catalogue du mod de la route ; un identifiant absent
  affiche une erreur sans ouvrir un autre document.
- L’ouverture depuis l’historique passe par la façade et le coordinateur du
  même mod. Un changement de composition synchronise le document courant puis
  libère sa session en conservant sa copie IndexedDB confirmée. En cas d’échec,
  la session et la route courantes restent actives. Deux sessions documentaires
  ne coexistent pas dans l’onglet.
- `?mod=quiz-hunt` ne choisit plus la composition auteur. Ce paramètre reste
  réservé à la sélection de la composition de preview.
- Aucun code de production ou test du workspace Elcé n’importe React,
  ReactDOM, `@xstate/react`, `@tiptap/react` ou `lucide-react`. Vite reste un
  outil de build, de tests et de chargement SSR du point d’entrée local ; il ne
  sert pas l’interface auteur dans le navigateur.

## Références de validation

- [`elce-authoring-routes.test.ts`](../src/app/remix/elce-authoring-routes.test.ts)
  couvre le choix du mod, l’encodage des identifiants et les routes inconnues.
- [`remix-spa-router.test.ts`](../src/app/remix/remix-spa-router.test.ts)
  couvre les routes de choix et de document ainsi que la sélection de la racine
  Preview.
- [`learning-project-application.test.tsx`](../src/mods/learning/authoring/learning-project-application.test.tsx)
  couvre le sélecteur superposé et le formulaire de nommage.
- [`project-session-coordinator.test.ts`](../src/mods/learning/integration/project-session-coordinator.test.ts)
  et [`project-operations.test.ts`](../src/mods/learning/integration/project-operations.test.ts)
  couvrent la création nommée, l’ouverture demandée, la conservation de la
  session après erreur et la libération inter-mod via le même acteur.
