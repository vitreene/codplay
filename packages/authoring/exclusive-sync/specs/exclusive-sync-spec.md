# Session de synchronisation exclusive

## Rôle

`ExclusiveSyncSession<T>` coordonne le passage d’une valeur confirmée en
lecture seule à une édition exclusive, puis sa publication et sa libération.
`T` reste opaque : la classe ne connaît ni document, ni média, ni interface,
ni transport. Elle ne possède pas la valeur éditée ni son historique.

## Contrat vérifié

Les ports injectés acquièrent, vérifient et libèrent un droit ; lisent une
valeur avec sa révision ; publient entièrement les modifications locales ;
installent une valeur confirmée ; et activent ou suspendent les commandes.
`requestEdit()` attend dans cet ordre l’acquisition, la publication, la lecture
confirmée et son installation avant d’activer l’édition. Un droit occupé ou
une lecture échouée ne l’active pas. `yieldEdit()` suspend immédiatement les
commandes, attend la publication, puis libère le droit. Un échec de
publication garde le droit. Une réponse de libération perdue est réconciliée
par `stillHeld()` sans réclamer un nouveau droit.
Une application qui a d’abord conservé la valeur locale dans une copie
indépendante peut appeler `releaseAfterIndependentCopy()` pour libérer
délibérément le projet source sans publier cette ancienne valeur. Ce chemin
ne crée pas la copie : l’adaptateur doit l’avoir sauvegardée avant l’appel.

`refreshReader()` installe une révision seulement lorsqu’elle diffère de la
dernière révision affichée. Les opérations de lecture, d’acquisition et de
sortie sont sérialisées pour qu’une réponse tardive ne remplace pas une valeur
installée par une transition suivante. La classe n’écoute pas le navigateur
et ne déclenche pas de relevé périodique ; ces signaux appartiennent à
l’adaptateur de l’application.

## Utilisation

L’adaptateur Elcé se trouve dans
[`project-session-coordinator.ts`](../../../elce/src/app/projects/project-session-coordinator.ts).
Il fournit la paire de droit de l’API Elcé, le `ProjectSyncCoordinator` pour
la publication complète du document et des médias, et l’acteur XState pour
l’installation. La classe commune n’importe ni Elcé, ni Remix, ni XState, ni
DOM. Les [tests génériques](../tests/exclusive-sync-session.test.ts) exercent
la même politique avec un objet et avec une liste ; les tests Elcé vérifient
son raccord à l’application.
