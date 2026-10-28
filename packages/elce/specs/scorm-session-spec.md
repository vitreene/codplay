# Elcé — adaptateur de session SCORM

Cette spécification décrit la traduction de l’état Elcé vers le contrat de
session partagé [`@codplay/sighty-scorm`](../../sighty-scorm/specs/scorm-session-spec.md).
La génération du package reste suivie dans le
[plan d’export SCORM](../plan/2026-10-21-elce-scorm-export-plan.md).

`@codplay/sighty-scorm` est le package compagnon SCORM des applications basées
sur Sighty ; il est distinct du runtime Sighty et n’appartient pas à Elcé.
Elcé est l’un de ses consommateurs : son adaptateur traduit les modèles Elcé,
et les actions de page Sighty déclenchent les appels métier. Les autres projets
basés sur Sighty peuvent réutiliser le même package avec leur propre adaptateur.

## Rôle de l’adaptateur

`ElceScormAdapter` est le seul point qui connaît à la fois `ProjectTestState`,
`EvaluationMachineState` et le noyau SCORM partagé. Il encode et valide l’état
de reprise Elcé, réconcilie les résultats d’évaluation et mappe les réponses,
les scores et les objectifs vers les types génériques du noyau. Il ne contacte
pas directement Pipwerks ; `ScormSession`, dans `@codplay/sighty-scorm`, est
l’unique classe qui appelle l’API SCORM.

`ElcePlayerComposition` fournit l’adaptateur via le contexte runtime Sighty,
sous la clé `ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY`. Les handlers exportables
des actions de page lisent ce service optionnel après l’admission de leur
événement et après mise à jour de l’état de contexte. Le paquet Sighty simple
et la preview ne fournissent pas ce service ; les actions n’y ouvrent donc
aucune session LMS. Les scènes restent sans dépendance SCORM.
Le runtime du SCO crée l’adaptateur et restaure les données avant
l’initialisation de Sighty. Il le ferme dans le cycle de vie du player. La
preview auteur ne crée pas d’adaptateur et n’ouvre pas de session LMS.

Si l’API LMS retourne un seuil de réussite non nul, `ElceScormAdapter` expose
sa valeur normalisée à travers le même service de progression déjà fourni au
contexte Sighty. La machine d’Évaluation utilise alors ce seuil pour le résultat
et le garde de navigation ; il prévaut sur le seuil auteur pendant cette session
SCORM. Les résultats d’Évaluation déjà suspendus sont recalculés sans perdre
réponses, tentatives ni réglages de reprise. Sans valeur LMS utilisable, le
seuil auteur ou son défaut s’applique. La preview, qui n’a pas d’adaptateur,
reste régie par le seuil auteur.

## État de reprise Elcé

`cmi.suspend_data` contient un objet JSON versionné :

```ts
interface ScormReaderState {
  schemaVersion: 1
  currentPageId: string | null
  projectTestState: ProjectTestState
}
```

`decodeScormReaderState()` rejette une structure mal formée, une version
inconnue et les champs qui ne satisfont pas les types d’état existants. Une
valeur invalide ou absente revient à l’état auteur initial. Un signet SCORM
valide reste utilisable indépendamment du contenu suspendu. À l’ouverture,
`startScormPlayerRuntime()` réconcilie l’état avec le document par
`reconcileProjectTestState()`, puis fournit l’état et la page courante à
`ElcePlayerComposition` avant l’initialisation Sighty.

La page courante vient du signet LMS : `cmi.core.lesson_location` en 1.2 et
`cmi.location` en 2004. Si ce champ est vide ou absent, le lecteur démarre à
la première page du SCO, comme Shell ; il ne reprend pas
`suspend_data.currentPageId` comme solution de repli. Le reste de l’état
suspendu reste restauré : pages terminées, profil, réponses et machines
d’Évaluation, donc les tentatives. Ainsi, une nouvelle lecture dont le LMS a
effacé le signet recommence au début tout en gardant les réponses déjà
enregistrées, qui peuvent satisfaire les gardes de lecture et de Question.
Le codec utilise la limite de `suspend_data` exportée par le noyau partagé et
refuse tout dépassement sans tronquer l’état.

## Actions Sighty et résultats

Les handlers `MARK_PAGE_FINISHED`, `SAVE_PROFILE_VALUES` et `SUBMIT_PROFILE`
transmettent l’état courant à `ElceScormAdapter.saveReaderState()`.
`RECORD_QUESTION_RESULT` enregistre aussi cet état ; pour une Question hors
Évaluation, il demande à l’adaptateur d’écrire son interaction immédiatement
avec ce même état. Pour une Question d’Évaluation, il garde la réponse et ses
métadonnées dans l’état repris. `REFRESH_EVALUATION_RESULT` enregistre le
signet de la page admise et, quand la machine possède un résultat complet,
transmet son résultat, le chapitre et les réponses validées à
`recordEvaluationResult()`.

En `monoSco`, l’adaptateur calcule la moyenne des scores de chapitres pour le
résultat global et considère le SCO échoué dès qu’un chapitre a échoué. Pour
SCORM 2004, il met à jour l’objectif `obj_<chapterId>` du chapitre courant avec
sa position de page 1-based, puis calcule la progression globale à partir des
chapitres terminés, comme le lecteur de référence. La complétion globale est
écrite à la fin d’un chapitre et ne devient `completed` qu’une fois tous les
chapitres terminés. Pour SCORM 1.2, il fournit le résultat et le score agrégés
sans objectif ni mesure de progression 2004 ; il transmet le statut global à
la fin d’un chapitre. Hors `monoSco`, la progression correspond à la position
de page courante dans le SCO, arrondie au centième. Le statut reste inchangé
pendant la consultation ordinaire et devient `completed` au repère de fin de la
dernière page. Le noyau partagé écrit les valeurs calculées dans les éléments
CMI.

Pour un SCO par chapitre, le runtime transmet à l’adaptateur les identifiants de
pages du chapitre lancé et les pages qui contiennent une Question. La mesure
2004 reprend la position de la page courante, comme dans le lecteur de
référence ; elle ne dépend pas du nombre de pages déjà terminées. Le statut
reste inchangé avant la fin du chapitre. Au repère bas de sa dernière page, une
page Question doit également avoir une réponse pour que le chapitre soit
considéré terminé. Les pages d’autres chapitres ne contribuent jamais à la
mesure. En 1.2, seul le statut de chapitre est écrit, au moment où la fin est
atteinte ; pour un chapitre d’Évaluation dont le résultat est connu, `passed`
ou `failed` reste le statut final du SCO.

Les réponses et tentatives complètes restent conservées dans l’état suspendu
pour les trois éditions. L’action Sighty `RECORD_QUESTION_RESULT` reçoit
`timeMs` sur l’événement public après admission ; le temps logique de la scène
Question sert de latence, sans timer ajouté. Elle conserve aussi la description,
le type de Question, ses réponses possibles dans leur ordre auteur et
l’horodatage de validation. Dans un chapitre ordinaire, l’adaptateur écrit
l’interaction immédiatement avec l’état de lecture. Dans un chapitre
d’Évaluation, l’action conserve ces métadonnées dans la machine d’Évaluation,
puis l’adaptateur écrit toutes les interactions à l’envoi du résultat du
chapitre. Le noyau écrit les interactions uniquement en SCORM 2004 ; en 1.2,
Elcé conserve réponses et tentatives dans l’état suspendu, en omet les
métadonnées propres aux interactions, et écrit le résultat et le score sans
interaction CMI.

L’identifiant reprend la forme `<pageId>_0`. En CMI, une Question « Vrai / Faux »
utilise le type `true-false` et les libellés de réponse ; les Questions à choix
utilisent le type `choice` et les positions de réponse commençant à `1`, jointes
par `[,]` dans l’ordre auteur. La description CMI contient le texte du titre et
de l’énoncé suivi des réponses numérotées dans leur ordre auteur. Le résultat,
l’horodatage, la latence et la pondération `0` suivent le format de la référence. Les états
suspendus antérieurs sans métadonnées restent acceptés ; leur type est alors
traité comme `choice`, leur description comme vide, et ils ne fournissent pas
d’horodatage ni de latence CMI.

## Runtime d’un package Sighty SCORM

Le lanceur généré importe `scenario.mjs`, `loader.mjs` et le runtime SCORM Elcé
du package existant. `startElceScormPackageRuntime()` ouvre la session SCORM
avant d’initialiser Sighty, valide les métadonnées compactes du scénario,
réconcilie le signet, les pages terminées, les réponses, les tentatives et le
profil avec les identifiants présents dans le package, puis injecte l’état et
`ElceScormAdapter` dans le contexte du loader. Le player reste masqué pendant
cette restauration. Après `runtime.initialize()`, le runtime Sighty reçoit
l’événement de sélection de la page restaurée ; le player ne devient visible
qu’après cette transition et une sauvegarde de l’état restauré.

Pour un package multi-SCO, le lanceur transmet à
`startElceScormPackageRuntime()` la table des identifiants `ITEM-*` du
manifeste. Les actions Sighty « Suivant » et « Précédent » au dernier et au
premier écran appellent l’adaptateur Elcé, qui enregistre le signet et les
données suspendues, renseigne `adl.nav.request`, committe et termine le SCO.
Le bouton inter-chapitre est disponible seulement si le manifeste fournit
l’identifiant stable du chapitre voisin.
Le test d’export Sighty vérifie que le scénario compact d’un parcours à
plusieurs chapitres contient `action:elce:navigate-scorm-chapter` dans
`scenario.actions` même si le graphe statique ne la référence pas ; le test du
runtime vérifie sa mutation de frontière et la demande d’item `ITEM-*`.

« Précédent » dépend uniquement de la présence d’une page précédente dans le
SCO ou d’un identifiant stable pour le chapitre précédent ; il n’exige pas la
complétion de la page. « Suivant » combine la garde de sortie de la page et la
disponibilité de la page ou du SCO cible. La garde de sortie n’inclut pas la
présence du chapitre voisin. Comme l’action inter-SCO n’a pas de route `go`,
son handler vérifie de nouveau que la page est à la limite du chapitre, que la
page est terminée pour « Suivant » et que le SCO voisin possède son identifiant
stable avant d’appeler l’adaptateur.

Le lanceur initialise le conteneur avec `visibility: hidden`. Après le succès
de la restauration, de l’initialisation Sighty, de la sélection de page et de
la sauvegarde, le runtime force sa visibilité à `visible` au lieu de rétablir
la valeur initiale masquée. Si une étape échoue, il restaure cette valeur
initiale et laisse le conteneur caché pendant que le lanceur signale l’erreur.
Le test du runtime démarre avec un conteneur masqué, vérifie qu’il le reste
pendant l’initialisation, puis vérifie l’affichage après succès et le maintien
du masquage après échec.

La fermeture du runtime détruit le player et ferme la session SCORM une seule
fois. `pagehide` et `beforeunload` déclenchent cette fermeture. Le lanceur
n’ajoute aucun circuit d’événement dans les scènes ; les écritures pendant le
parcours restent aux handlers Sighty décrits plus haut. La preview auteur
n’utilise pas ce runtime.

Elcé fournit la durée de session depuis l’instance persistante `scene-layout`
avec la surface publique de la telco CodPlay :
`telco.getProgress().timelineMs`. Cette valeur suit l’horloge logique déjà
employée par le parcours ; aucun timer SCORM parallèle n’est ajouté. Le noyau
partagé l’écrit dans le champ de durée propre à l’édition lors des sauvegardes
de lecture.

Cette preuve utilise le loader Sighty et le runtime Elcé dans un environnement
de test avec faux LMS. Elle valide le raccord et la restauration du parcours ;
l’interopérabilité des écritures et de la reprise avec un LMS qui conserve les
données reste à vérifier.

Une vérification du package Demo5 2004v4 dans la route locale 2J Learning a
confirmé que le contenu devient visible avec le runtime généré. Cette route
fonctionne en mode `browse` et son API de test n’enregistre pas les écritures ;
elle vérifie le lancement et l’affichage, pas la persistance ni la reprise LMS.

### Lancement d’un SCO par chapitre

En `monoSco=false` sans sommaire, le manifeste contient une ressource et un
lanceur HTML par chapitre. Chaque lanceur transmet le `chapterId` à
`startElceScormPackageRuntime()` ; l’assembleur embarque une seule copie du
paquet Sighty complet et ne modifie pas son export. Le runtime garde le
contenu masqué pendant l’initialisation Sighty, dont la page globale par défaut
peut être hors du chapitre, puis sélectionne la page du chapitre lancé avant
d’afficher le player.

Le contexte Sighty porte l’identifiant du chapitre courant. Les gardes
d’accès/sortie et les actions de page n’admettent ensuite que ses pages ; le
sommaire du SCO ne liste que ces pages. `reconcilePackagedReaderState()` filtre
le signet, les pages terminées, les réponses et les états d’Évaluation selon
la portée du chapitre. Le LMS conserve ces valeurs séparément pour chaque SCO.
`monoSco=true` continue d’utiliser le scénario complet.

À l’ouverture d’un SCO de chapitre, le conteneur reste masqué pendant que le
runtime installe les actions de frontière avec les mutations `reset` Sighty.
Ces resets repartent de l’entrée globale du scénario ; le runtime applique
donc l’identifiant de chapitre au contexte après ces mutations, puis joue le
layout et restaure la page du SCO avant de rendre le conteneur visible. Une
reprise dans un SCO déjà complété garde son signet et ses données suspendues ;
le reset de configuration ne déclenche pas de boucle d’accès sur l’entrée d’un
autre chapitre.

Les tests de runtime et de scénario vérifient le routage depuis la page globale
initiale, le refus d’accès aux autres chapitres, la navigation locale et la
restauration filtrée. Le test intégré avec le runtime Sighty réel relance aussi
un SCO déjà complété, retrouve sa page suspendue et vérifie l’absence de
`SIGHTY_ACCESS_REDIRECT_LOOP`. Des ZIP Demo5 en 1.2, 2004v3 et 2004v4
contiennent chacun quatre lanceurs et quatre ressources `sco` ; leurs archives
et manifestes passent respectivement `unzip -t` et les schémas XSD fournis.
Cette preuve ne valide pas encore l’isolation des données, la reprise ou les
résultats dans un LMS réel qui persiste les valeurs CMI.

## Preuves

- [`scorm-state-codec.test.ts`](../src/scorm/scorm-state-codec.test.ts) vérifie
  l’encodage, la validation et les limites.
- [`elce-scorm-adapter.test.ts`](../src/scorm/elce-scorm-adapter.test.ts)
  vérifie la lecture du seuil LMS, son application aux résultats suspendus et
  le mapping Elcé des sessions, résultats, objectifs, progression,
  interactions immédiates et différées, les formats de réponses par type,
  la complétion du chapitre courant après consultation et réponse à ses
  Questions en multi-SCO 1.2/2004, le retour à la page initiale quand le
  signet LMS manque tout en conservant l’état suspendu, l’absence
  d’interactions 1.2, les modes lecture et les erreurs.
- [`scenario-builder.test.ts`](../src/builders/scenario/scenario-builder.test.ts)
  vérifie la conservation de `timeMs`, de la description et de l’horodatage
  dans la réponse de la machine d’Évaluation. Il vérifie aussi l’admission de la
  page de démarrage Sighty masquée, l’entrée dans le chapitre lancé, le refus
  des pages des autres chapitres, les gardes de complétion, les boutons de
  navigation aux limites de SCO et le refus de l’action inter-SCO sans page
  terminée ou identifiant cible stable.
- [`elce-player-composition.test.ts`](../src/mods/learning/reading/learning-player.test.ts)
  vérifie qu’une Question d’Évaluation jouée par le player Sighty/CodPlay
  produit une latence par réponse sans ajouter de timer.
- [`scorm-player-runtime.test.ts`](../src/scorm/scorm-player-runtime.test.ts)
  vérifie la restauration avant Sighty, la sauvegarde après navigation admise
  et l’absence de session SCORM dans la preview. Le test d’export Sighty vérifie
  aussi que les handlers de page restent exportables avec cette intégration
  optionnelle.
- [`scorm-package-runtime.test.ts`](../src/scorm/scorm-package-runtime.test.ts)
  vérifie l’injection du contexte dans le loader du package, la réconciliation
  des identifiants, la reprise à la première page quand le signet LMS est vide,
  la conservation des réponses et pages terminées, la page restaurée, la
  sauvegarde et la fermeture.
  Il couvre également le conteneur masqué au lancement, visible après succès et
  toujours masqué après échec, ainsi que la sélection du chapitre du SCO et le
  filtrage des données restaurées à cette portée. Il vérifie aussi que la
  complétion est calculée dans ce seul chapitre et écrite par le runtime
  multi-SCO vers le faux LMS. Dans le player Sighty réel, il clique « Suivant »
  après la fin d’une page pour atteindre la page suivante, puis après la
  validation de la Question finale pour vérifier l’écriture de la destination
  `ITEM-*` dans `adl.nav.request`. Il relance enfin un SCO déjà complété,
  vérifie le retour à sa page suspendue et s’assure que le warning
  `SIGHTY_ACCESS_REDIRECT_LOOP` ne réapparaît pas.
- [`elce-scenario-exporter.test.ts`](../src/export/elce-scenario-exporter.test.ts)
  exporte un scénario à plusieurs chapitres par le CLI Sighty et vérifie que
  `scenario.mjs` contient le handler de navigation inter-SCO dans
  `scenario.actions`.
