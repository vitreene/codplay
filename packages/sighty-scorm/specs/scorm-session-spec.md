# SCORM pour Sighty — session LMS

## Propriété et frontière

`ScormSession` est l’unique classe qui appelle directement l’API Pipwerks et
écrit les éléments CMI. Elle appartient au package compagnon
`@codplay/sighty-scorm` : celui-ci apporte SCORM aux contenus exécutés avec
Sighty, mais ne fait pas partie du runtime `@codplay/sighty` et ne dépend ni de
Sighty ni d’Elcé au niveau du code. Sighty conserve la navigation et l’admission
des événements ; ses actions de page sont les points d’appel de l’intégration.
Un lecteur fournit son adaptateur métier pour transformer l’état de reprise,
les résultats et les réponses vers les types génériques de ce package.

Dans Elcé, `ElceScormAdapter` réalise cette traduction et les actions de page
Sighty l’appellent. Un autre projet basé sur Sighty peut réutiliser le package
et fournir son propre adaptateur. Le package SCORM et l’adaptateur restent donc
des composants compagnons de Sighty et d’Elcé, et non des fonctions internes à
l’un de ces deux projets.

Le package accepte les éditions `1.2`, `2004v3` et `2004v4`. Il configure
Pipwerks avec `1.2` ou `2004` selon l’édition et applique les limites CMI de
signet, de `suspend_data` et d’identifiant d’interaction. Le wrapper conservé
avec le package est Pipwerks SCORM API Wrapper v1.1.7 ; sa provenance et sa
licence figurent dans [`pipwerks-notice.md`](../pipwerks-notice.md).

## Contrat de session

Une instance représente un SCO et reçoit sa version, éventuellement une API
injectée pour les tests, et un callback de diagnostic. `initialize()` ouvre la
session puis retourne la valeur brute du signet, de `cmi.suspend_data` et du
mode. Le package ne désérialise pas `suspend_data` et ne connaît pas le format
de reprise du lecteur.

`saveReaderState()` écrit le signet et l’état suspendu puis committe. Un lecteur
peut y joindre la mesure de progression et l’état de complétion SCORM 2004.
`recordEvaluationResult()` écrit le même état de lecture, le statut global, les
champs de score, éventuellement un objectif déclaré au manifeste, et les
interactions `choice`, puis committe. Les identifiants d’interaction déjà
présents sont mis à jour au lieu d’être dupliqués.

En mode LMS `browse` ou `review`, les écritures sont ignorées. En sortie,
`close()` écrit le dernier état fourni, marque la sortie `suspend`, committe et
termine la session ; l’opération est idempotente. Une API ou un wrapper absent,
ou une connexion refusée, produit un diagnostic et laisse le lecteur démarrer
sans reprise SCORM. Un échec d’écriture remonte à l’appelant.

Pour SCORM 1.2, le résultat utilise `cmi.core.lesson_status` et le score brut.
Pour SCORM 2004, il utilise `cmi.completion_status`, `cmi.success_status`, les
bornes et les valeurs brute et normalisée du score. L’adaptateur détermine les
valeurs de résultat et les identifiants d’objectif ; la classe partagée réalise
uniquement leur transposition en CMI.

## Preuves

- [`scorm-session.test.ts`](../src/scorm-session.test.ts) vérifie la connexion,
  la reprise opaque, les trois éditions, les résultats et objectifs génériques,
  les interactions, la progression, les limites, le mode lecture, les erreurs
  et la fermeture.
- [`public-api.test.ts`](../src/public-api.test.ts) vérifie l’usage par le point
  d’entrée du package sans importer de modèle Elcé.
