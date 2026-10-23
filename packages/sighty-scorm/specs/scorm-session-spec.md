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
mode. Il retourne aussi le seuil LMS `masteryScore` en pourcentage quand il est
défini et non nul : `cmi.student_data.mastery_score` en 1.2, ou
`cmi.scaled_passing_score * 100` en 2004. Une valeur absente, nulle ou non
numérique n’est pas fournie. Le package ne désérialise pas `suspend_data` et ne
connaît pas le format de reprise du lecteur.

`saveReaderState()` écrit le signet et l’état suspendu puis committe. Un lecteur
peut y joindre l’avancement, une complétion arrivée à son repère de fin et les
objectifs de chapitre calculés par son adaptateur. En 2004, la classe écrit
`cmi.progress_measure`, le `cmi.completion_status` fourni s’il y en a un, puis
les mesures des objectifs déclarés au manifeste. Elle n’invente pas un statut
`incomplete` pendant une simple consultation de page. En 1.2, elle écrit
`cmi.core.lesson_status` seulement quand l’adaptateur fournit un statut de
complétion ou de réussite ; aucune mesure de progression 2004 ni progression
d’objectif n’est écrite.
`recordInteraction()` écrit ensemble cet état et une interaction immédiate, puis
committe.
`recordEvaluationResult()` écrit le même état de lecture, le statut global, les
champs de score, éventuellement un objectif déclaré au manifeste, et les
interactions en SCORM 2004, puis committe. En 1.2, il écrit le résultat
et le score sans écrire `cmi.interactions`. Les identifiants d’interaction déjà
présents sont mis à jour au lieu d’être dupliqués.

Une interaction peut préciser son type CMI (`true-false`, `choice`, `fill-in`,
`long-fill-in`, `matching`, `performance`, `sequencing`, `likert`, `numeric` ou
`other`) ; le type absent vaut `choice` pour compatibilité. Elle peut fournir
sa description, son horodatage epoch en
millisecondes, sa latence en millisecondes et sa pondération. La classe écrit
les champs CMI `id`, `type`, `description`, `correct_responses.0.pattern`,
`learner_response`, `timestamp`, `latency`, `weighting` et `result`. La date
utilise les champs locaux de `Date`, deux chiffres de centièmes et le suffixe
`Z`, conformément au format de la référence. La latence arrondit les
millisecondes vers le bas à la seconde et utilise `PT<minutes>M<secondes>S`.
Une valeur de pondération absente ou nulle est écrite `0`. Sans horodatage ou
latence fournis, le champ CMI correspondant n’est pas écrit.

`navigateToSco()` lit l’autorisation de choix de l’item, écrit la requête
`adl.nav.request`, committe puis termine la session comme le lecteur de
référence. En mode LMS `browse` ou `review`, les écritures sont ignorées. En
sortie, `close()` écrit le dernier état fourni, committe et termine la session ;
il ne renseigne pas `cmi.exit`, conformément au lecteur de référence. L’opération
est idempotente. Une API ou un wrapper absent,
ou une connexion refusée, produit un diagnostic et laisse le lecteur démarrer
sans reprise SCORM. Un échec d’écriture remonte à l’appelant.

L’adaptateur peut joindre `sessionTimeMs` à un état. Le noyau l’écrit dans
`cmi.session_time` en 2004 ou `cmi.core.session_time` en 1.2 et utilise le
format d’édition du lecteur de référence.

Pour SCORM 1.2, le résultat utilise `cmi.core.lesson_status` et le score brut.
Pour SCORM 2004, il utilise `cmi.completion_status`, `cmi.success_status`, les
bornes et les valeurs brute et normalisée du score. L’adaptateur détermine les
valeurs de résultat et les identifiants d’objectif ; la classe partagée réalise
uniquement leur transposition en CMI.

## Preuves

- [`scorm-session.test.ts`](../src/scorm-session.test.ts) vérifie la connexion,
  la reprise opaque, la lecture du seuil LMS pour les trois éditions, les
  résultats et objectifs génériques,
  les champs d’interaction 2004 et leur format, l’absence d’interactions 1.2,
  la progression de page et des objectifs, la complétion différée, l’absence de
  statut de complétion pendant une consultation ordinaire, les durées de
  session, la navigation inter-SCO, les limites, le mode lecture, les erreurs
  et la fermeture sans écriture de sortie `suspend`.
- [`public-api.test.ts`](../src/public-api.test.ts) vérifie l’usage par le point
  d’entrée du package sans importer de modèle Elcé.
