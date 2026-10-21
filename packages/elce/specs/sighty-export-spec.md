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

Le serveur adapte les sources temporaires au CLI Sighty existant en lui
fournissant les capacités engine d’Elcé et demande sa distribution autonome.
Le ZIP est prêt à être extrait et chargé par `loader.mjs`. Il contient une
seule copie de CodPlay, de Sighty et de l’engine configuré dans `runtime/`, le
manifeste de distribution, puis le manifeste Sighty, `scenario.mjs` et un
paquet CodPlay autonome par scène directe avec ses fonctions, sa feuille de
style et ses ressources. Le player et l’engine partagés ne sont pas recopiés
dans les paquets enfants ; chaque paquet scène reste intégral et remplaçable.
Les styles communs du lecteur restent sur la scène layout et les styles
produits par un builder restent sur la scène de page qui les utilise.

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
  l’unicité des trois fichiers runtime, les imports relatifs vers l’unique
  `codplay.js` et l’absence de copies runtime dans les scènes. Il vérifie aussi
  le refus d’octets manquants pour un média utilisé.
- [`elce-sighty-export-client.test.ts`](../src/export/elce-sighty-export-client.test.ts)
  vérifie l’envoi du document et des médias référencés ainsi que le traitement
  des erreurs.
- [`sighty-export-api-controller.test.ts`](../src/server/export/sighty-export-api-controller.test.ts)
  vérifie la réponse ZIP et l’absence d’écriture de persistance.
- [`editor-workspace.test.tsx`](../src/app/remix/workspace/editor-workspace.test.tsx)
  vérifie le bouton et ses états près de « Prévisualiser ».
- Safari, le 20 octobre 2026, sur `http://localhost:5175`, exporte le Projet 1
  depuis l’interface avec ses deux médias référencés : les deux lectures
  média répondent `200`, puis `POST /api/exports/sighty` répond `200` avec un
  ZIP de 476 051 octets, `Content-Disposition: attachment; filename="Projet-1.sighty.zip"`
  et `Cache-Control: no-store`. L’interface annonce le téléchargement et la
  console ne contient pas d’erreur. Cette requête ne déclenche aucune
  sauvegarde du document.
- Les 381 tests Elcé, le typecheck et le build passent. Le parcours visuel
  Sighty/CodPlay sur Demo 5 — préparation sans occurrence, initialisation,
  défilement, navigation, réponse au quiz, remise à zéro puis réinitialisation
  — est décrit dans la [spécification de la démo](../../demos/specs/sighty-export-demo-spec.md).
