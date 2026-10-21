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

La reprise conserve la page, les pages terminées, le profil, les réponses et
les machines d’Évaluation, donc les tentatives. Le codec utilise la limite de
`suspend_data` exportée par le noyau partagé et refuse tout dépassement sans
tronquer l’état. En 1.2, le signet est écrit dans
`cmi.core.lesson_location` ; en 2004, dans `cmi.location`.

## Actions Sighty et résultats

Les handlers `MARK_PAGE_FINISHED`, `RECORD_QUESTION_RESULT`,
`SAVE_PROFILE_VALUES` et `SUBMIT_PROFILE` transmettent l’état courant à
`ElceScormAdapter.saveReaderState()`. `REFRESH_EVALUATION_RESULT` enregistre
également le signet de la page admise. Quand la machine d’Évaluation possède
un résultat complet, l’action transmet son résultat, le chapitre et les
réponses validées à `recordEvaluationResult()`.

En `monoSco`, l’adaptateur calcule la moyenne des scores de chapitres pour le
résultat global et considère le SCO échoué dès qu’un chapitre a échoué. Pour
SCORM 2004, il demande aussi la mise à jour de l’objectif `obj_<chapterId>` et
calcule la progression depuis les pages terminées des chapitres. Pour SCORM
1.2, il fournit le résultat et le score agrégés sans objectif ni mesure de
progression 2004. Hors `monoSco`, le résultat est celui du chapitre courant.
Le noyau partagé écrit les valeurs calculées dans les éléments CMI.

Les réponses et tentatives complètes restent conservées dans l’état suspendu
pour les trois éditions ; les interactions LMS `choice` complètent ce stockage
à la fin du chapitre d’évaluation.

## Preuves

- [`scorm-state-codec.test.ts`](../src/scorm/scorm-state-codec.test.ts) vérifie
  l’encodage, la validation et les limites.
- [`elce-scorm-adapter.test.ts`](../src/scorm/elce-scorm-adapter.test.ts)
  vérifie le mapping Elcé des sessions, résultats, objectifs, progression,
  interactions, modes lecture et erreurs.
- [`scorm-player-runtime.test.ts`](../src/scorm/scorm-player-runtime.test.ts)
  vérifie la restauration avant Sighty, la sauvegarde après navigation admise
  et l’absence de session SCORM dans la preview. Le test d’export Sighty vérifie
  aussi que les handlers de page restent exportables avec cette intégration
  optionnelle.
