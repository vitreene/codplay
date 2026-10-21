# Elcé — export d’un paquet Sighty

## Statut

**Fini le 21 octobre 2026.** Le bouton, l’adaptateur de ressources, la route
ZIP et la structure autonome de son contenu sont vérifiés. Le loader et le
runtime partagés sont exercés visuellement par la démo Sighty Demo 5.

## Contrat

Dans un projet éditable, « Exporter le scénario » prend le document présent
dans l’acteur XState, y compris les changements qui ne sont pas encore
synchronisés. Elcé construit les scènes par `createElcePlayerScenario`, le
même producteur DOM-free que la preview. Les pages du catalogue restent
exclues. Le client transmet le document et les seuls fichiers média référencés
par ces scènes au serveur local Elcé.

Dans l’espace éditable, l’action « Exporter le scénario » se trouve à droite
dans la barre de titre du projet. « Prévisualiser » reste dans la barre de
commandes du workspace. Le déplacement conserve le même traitement, son état
occupé et les annonces accessibles du résultat ou de l’erreur.

Le serveur adapte les sources temporaires au CLI Sighty existant en lui
fournissant les capacités engine d’Elcé et demande sa distribution autonome.
Il résout le CLI via l’entrée de package
`@codplay/sighty/tools/scenario-export/cli.mjs` et lance le processus depuis le
répertoire de travail du projet appelant. L’adaptateur n’a pas besoin de
connaître la racine du monorepo ; le chemin de source temporaire normalisé suit
ce même répertoire de travail.
Le ZIP est prêt à être extrait et chargé par `loader.mjs`. Il contient une
seule copie de CodPlay, de Sighty et de l’engine configuré dans `runtime/`, le
manifeste de distribution, puis le manifeste Sighty, `scenario.mjs` et un
paquet CodPlay autonome par scène directe. Le module d’intégration fourni par
Elcé est nommé `runtime/elce-engine.js`, avec son manifeste
`runtime/elce-engine-manifest.json`, pour le distinguer du moteur CodPlay dans
`runtime/codplay.js`. Chaque paquet de scène contient la scène compilée dans
`scene/scene.json`, ses fonctions, sa feuille de style et ses ressources. Le
player et l’intégration Elcé ne sont pas recopiés dans les paquets enfants ;
chaque paquet scène reste intégral et remplaçable.
Les styles communs du lecteur restent sur la scène layout et les styles
produits par un builder restent sur la scène de page qui les utilise.

`elce-engine.js` ne contient que les capacités Elcé nécessaires au catalogue
CodPlay, ici les définitions du composant et du module `scroll-container`.
L’adaptateur HTML optionnel reste raccordé par le player Elcé. Le bundle
n’embarque pas la table de couleurs ACE : le validateur `component-v2` conserve
son garde `isPlainRecord` local, et la configuration engine importe les seules
définitions requises plutôt que la barre qui réexporte aussi cet adaptateur.

La diffusion Elcé utilise le format compact Sighty V2. `scenario.mjs` contient
le graphe et les données nécessaires à l’exécution ainsi que les seuls
callbacks Sighty référencés ; il ne contient ni `ElceDocument`, ni `SceneDoc`,
ni les constructeurs auteur de scène. Chaque enfant contient le paquet CodPlay
V1 de sa scène compilée (`scene/scene.json`), avec ses seules fonctions
référencées, sa CSS et ses médias. L’entrée temporaire fournie au CLI réutilise
le builder de scénario de la preview, puis désigne explicitement ses groupes
`scenarioFunctions` et `sceneFunctions`. CodPlay vérifie les références de
fonction par identité avant de générer le module compact de chaque paquet.
Pour les straps Elcé, les paramètres propres à la scène sont placés dans
l’état compilé et lus par des fonctions top-level regroupées dans
`builders/scene-functions/scene-functions.ts`.

L’export fournit des ressources. Il n’appelle ni le loader ni
`runtime.initialize()`, ne démarre pas la lecture et ne sérialise pas la
progression du test auteur. À la consommation, `loadSightyPackage({ root })`
prépare le paquet depuis le loader inclus ; l’application appelle ensuite
explicitement `runtime.initialize()` au moment de créer les occurrences.

La route `POST /api/exports/sighty` reçoit un formulaire multipart. Elle
valide le document et les octets transmis, appelle l’exporteur Sighty, puis
renvoie `application/zip` avec un nom de téléchargement dérivé du projet. La
route ne persiste ni document ni média. Le navigateur démarre le téléchargement
`<nom-du-projet>.sighty.zip` seulement après réception d’un ZIP valide ; il
annonce l’attente, le nom du fichier ou l’erreur à l’aide d’un état accessible.
Un document ou média invalide, ou une erreur de paquetage, n’entraîne pas de
téléchargement partiel.

## Preuves

- [`elce-scenario-exporter.test.ts`](../src/export/elce-scenario-exporter.test.ts)
  vérifie le manifeste Sighty, toutes les scènes directes, un paquet CodPlay
  intact, la CSS du Carousel de page, la CSS du layout, les octets du média,
  l’absence de chemins temporaires, le loader, le manifeste de distribution,
  le nom `elce-engine.js`, l’unicité des fichiers runtime, la résolution du CLI Sighty par son
  entrée de package, les imports relatifs vers l’unique `codplay.js` et
  l’absence de copies runtime dans les scènes. Il contrôle aussi la scène
  compilée, l’absence des documents et constructeurs auteur dans le scénario
  livré, et l’absence de code de construction dans les modules compacts de
  fonction. Il vérifie que `runtime/elce-engine.js` ne contient pas la table de
  couleurs ACE, ainsi que le refus d’octets manquants pour un média utilisé.
  L’export complet s’exécute avec un répertoire de travail temporaire situé
  hors du dépôt.
- [`scene-functions.test.ts`](../src/builders/scene-functions/scene-functions.test.ts)
  vérifie les straps Question, formulaire, Carousel et agrandissement avec des
  paramètres de scène fournis par l’état et les événements.
- [`elce-sighty-export-client.test.ts`](../src/export/elce-sighty-export-client.test.ts)
  vérifie l’envoi du document et des médias référencés ainsi que le traitement
  des erreurs.
- [`sighty-export-api-controller.test.ts`](../src/server/export/sighty-export-api-controller.test.ts)
  vérifie la réponse ZIP et l’absence d’écriture de persistance.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  vérifie le bouton à droite de la barre de titre, son action, son état occupé
  et l’annonce du téléchargement ;
  [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx)
  vérifie qu’il n’est plus rendu dans la barre de commandes responsive.
- Safari, le 20 octobre 2026, sur `http://localhost:5175`, exporte le Projet 1
  depuis l’interface avec ses deux médias référencés : les deux lectures
  média répondent `200`, puis `POST /api/exports/sighty` répond `200` avec un
  ZIP de 476 051 octets, `Content-Disposition: attachment; filename="Projet-1.sighty.zip"`
  et `Cache-Control: no-store`. L’interface annonce le téléchargement et la
  console ne contient pas d’erreur. Cette requête ne déclenche aucune
  sauvegarde du document.
- Les 385 tests Elcé passent sur l’exécution complète et le rerun des tests
  d’intégration qui ouvrent un serveur local ; le typecheck et le build passent.
  Le parcours visuel
  Sighty/CodPlay sur Demo 5 — préparation sans occurrence, initialisation,
  défilement, navigation, réponse au quiz, remise à zéro puis réinitialisation
  — est décrit dans la [spécification de la démo](../../demos/specs/sighty-export-demo-spec.md).
