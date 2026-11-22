# Plan — POC d’une page externe pilotée par CodPlay

**En cours —** le POC de lecture et le transport source de progression/seek
sont implémentés, validés dans le navigateur MCP et documentés. Le lecteur
6.2.1 n’expose pas de signal parent de fin de page : aucune occurrence
`finished` n’est fabriquée. Ce point reste un prérequis distinct avant
l’intégration complète d’un module dans Elcé.

## Objectif et périmètre

Prouver le pilotage d’une page réelle du lecteur RISQUE CHIMIQUE dans une scène
CodPlay V2 : Play, Pause, Reprise, Seek, Reset, sortie et fin hôte. Le contenu,
son audio, son routeur et ses animations restent exécutés par le lecteur source.
Ce POC n’importe pas de chapitre et ne modifie ni le lecteur, ni le core
CodPlay, ni le modèle de page Elcé.

## Décisions et contrats à conserver

- Le composant optionnel `external-course-page` possède une iframe non chargée
  jusqu’au premier Play. L’adaptateur passe par `HtmlSourceAdapterFactory` et
  le cycle de vie du runner HTML existant. Le layout V2 partagé garde le player,
  le journal et la télécommande.
- L’hôte et le lecteur sont servis sur deux origines distinctes. Le pont vérifie
  l’origine, la fenêtre, la version et la session des messages.
- Play/Pause pilotent les méthodes natives du lecteur. `instance.telco.seek`
  suspend toujours le lecteur sans déplacer sa timeline ; le seek de la
  télécommande commune passe par la façade source décrite ci-dessous. Reset et
  destruction ferment la session.
- À réception d’un `sequence:end` public, l’adaptateur demande Pause, ignore les
  réponses tardives et garde l’iframe montée à son dernier rendu. Reset ou
  destruction la libèrent.
- Ne pas déduire la fin des indicateurs internes du lecteur ou de la durée du
  son. Le détail du profil, du protocole, des sessions et des limites est dans
  la [spécification du composant](../../authoring/component-v2/specs/external-course-page-spec.md).

## Évolution acceptée — progression native et seek

**Fixée ; implémentée, testée et vérifiée dans le navigateur.** La télécommande
commune reprend la timeline de page du lecteur source. Le composant
`external-course-page` possède l’adaptation du protocole et expose la façade de
progression/seek au layout ; il ne reconstitue pas la progression depuis la
timeline CodPlay ou les durées audio. La télécommande reste rendue par le layout
partagé, sans contrôle parallèle.

1. [x] Qualifier le lecteur 6.2.1 : la configuration de la distribution active
`timeLineInSequency`; `currentPage.pageTimeLine.time()` et
`currentPage.totalDuration` donnent la position/durée globales. Le seek natif
passe par `timeLineSlider`, `onSlideDown` et `onSlideUp`.
2. [x] Étendre le pont et le protocole du composant pour remonter les
changements de progression (échantillonnés toutes les 100 ms et dédupliqués) et
acheminer/confirmer les commandes de seek dans la session active. La progression
passe par une façade dédiée au transport, jamais par un `commands.emit` répété
dans le journal CodPlay. Le script du pont reçoit un suffixe de version SHA-256
dans son URL pour éviter qu’un cache conserve une version périmée.
3. [x] Relier cette façade à la télécommande officielle via le layout V2 partagé :
   - les commandes de lecture restent raccordées au cycle de vie existant ;
   - `getProgress`/`onProgress` reflètent la position et la durée du lecteur ;
   - `seek` (et le retour à zéro s’il est exposé par la télécommande) est acheminé
     vers le composant, sans appeler le seek de la timeline CodPlay.
4. [x] Ajouter les tests ciblés du protocole et de la façade, puis valider dans
le navigateur MCP : progression active pendant lecture, seek depuis la
télécommande, synchronisation après seek, pause maintenue, retour au début,
reset et destruction. Vérifier l’absence d’un flux de progression dans le
journal d’événements. Le seek est appliqué via les callbacks natifs; le pont
force ensuite Pause car le lecteur peut reprendre depuis son propre état de
navigation.
5. [x] Mettre à jour la spécification du composant et celle du layout partagé
avec le contrat validé et leurs références d’implémentation. Ne pas modifier le
core CodPlay.

La progression ne vaut pas preuve de fin de page : le signal fiable de fin
reste un chantier distinct pour l’intégration Elcé.

## Distribution témoin

Source en lecture seule :
`/Users/hervesaintmacary/Projets/e-learning/projets standards recents/RISQUE_CHIMIQUE_2024/1-PROD/dist`.
La distribution déclare 6.2.1. Page sélectionnée :
`01_introduction/page112`, route `#/lesson/01_introduction/page112`.

Empreintes SHA-256 des fichiers servis :

- `static/js/index.js` :
  `31866071914918a893f20b833e24345a575269dd871141a0222038be6a0e84a6`
- `content/xml/01_introduction.xml` :
  `d4a3cce9695e6e65cc274e07e85ac9709a5766295688c784c826348918a6d85e`

Le XML contient neuf éléments directs `<sequency>` et les pistes `112_1.mp3`
à `112_9.mp3`. Le lecteur observé expose dix identifiants runtime (`_1` à
`_10`) avant de poser ses indicateurs internes de fin. Leur correspondance
n’est pas établie et ne sert pas à fabriquer un signal de fin.

Le dossier temporaire actuel est
`/tmp/external-course-page-poc.oZWxNG`; la source y est servie sur
`http://127.0.0.1:4174`. La démo V2 est servie sur
`http://127.0.0.1:5173/?demo=external-course-page`. Pour le recréer sans écrire
dans la distribution, lancer depuis le dépôt :

```sh
python3 packages/authoring/component-v2/tools/external-course-page/prepare-poc-fixture.py \
  "/Users/hervesaintmacary/Projets/e-learning/projets standards recents/RISQUE_CHIMIQUE_2024/1-PROD/dist" \
  "$courseReaderPocDir"
```

## Implémentation

| Fichier ou propriétaire | Résultat |
| --- | --- |
| `packages/authoring/component-v2/src/external-course-page/` | Profil, bibliothèque runtime, composant iframe, URL de lancement et adaptateur HTML. |
| `packages/authoring/component-v2/tools/external-course-page/` | Pont versionné du lecteur et préparation reproductible du dossier temporaire. |
| `packages/demos/src/v2/demos/external-course-page/` et `registry.ts` | Scène témoin enregistrée dans le layout V2 partagé. |
| `packages/authoring/component-v2/specs/external-course-page-spec.md` | Contrat vérifié, protocole, frontières de session et limites. |

## Vérifications réalisées

- Page autonome et page intégrée : même page et mêmes ressources, pistes
  `112_1.mp3` à `112_9.mp3` chargées.
- Play, Pause et Reprise : le premier son observé dure environ 5 916 ms; une
  pause reçue pendant l’ouverture a maintenu la position à 0 ms, et la reprise
  a continué la même séquence.
- Seek hôte vers 5 880 ms : la source est passée en pause sans déplacer son
  horloge (séquence 3 observée à environ 1 349 ms). Le redimensionnement de la
  fenêtre redimensionne l’iframe.
- Télécommande commune : la progression source MCP a rendu la plage active en
  lecture (`max=24 393 ms`) et sa position a avancé. Depuis la pause, un seek à
  12 000 ms a été confirmé à 12 002 ms; le lecteur est resté en pause après
  attente, et le retour au début a fonctionné. Un seek lancé en lecture a aussi
  laissé le lecteur en pause.
- Lecture continue MCP du début à 24 393 ms : la page a traversé ses séquences
  jusqu’à la dernière; après Pause et retour au début, elle est restée en pause.
- Le pont est servi avec son empreinte dans l’URL; le navigateur charge ainsi le
  code courant au lieu de réutiliser sa copie en cache.
- Tests ciblés du pont natif et du store de progression : 2 fichiers, 3 tests
  réussis. Les typechecks component-v2 et demos et le build demos réussissent.
- Reset, sortie vers une autre démo et retour : l’ancienne iframe est libérée;
  le prochain Play ouvre une nouvelle session.
- Route de page absente (`page-does-not-exist`) : un diagnostic bootstrap du
  lecteur est affiché, puis l’iframe est libérée. Le délai hôte ne produit pas
  de second diagnostic.
- Fin hôte : un `sequence:end` public à 8 000 ms a laissé la page intégrée
  visible. Le pont a confirmé l’application de Pause (`paused === true`) et
  aucune réponse tardive n’a tenté d’émettre un fait après le terminal. Cet
  eventime n’est pas conservé dans la scène témoin. Un Reset après ce terminal
  a remis le player à 0 et retiré l’iframe.
- `npm run typecheck` réussit dans `packages/authoring/component-v2` et
  `packages/demos`; `npm run build` réussit dans `packages/demos`. Le build
  signale des chunks supérieurs à 500 kB. La syntaxe du pont JavaScript et du
  préparateur Python est valide.

## Point restant avant le module Elcé

`Lesson.endOfPage()` pose `currentPage.isEnded` et `currentPage.isCompleted`,
mais le lecteur intact ne transmet aucun signal de fin vérifié au parent. Le
pont n’émet donc pas `external-course:finished`, et aucune progression Elcé
n’est simulée.

**Décision ouverte :** obtenir du propriétaire du lecteur un signal de fin
stable, compatible avec les interactions exigées par la page. Après cette
décision, un plan distinct pourra ajouter le message `finished` au pont puis
relier son occurrence à `elce:page:finished`. La durée audio, les champs
internes et la différence entre neuf éléments XML et dix séquences runtime ne
suffisent pas à établir cette fin.

Le chapitre, ses pages, les droits d’édition et le catalogue de modules
appartiennent au [plan d’intégration Elcé](external-course-module-plan.md),
qui est suivi séparément.
