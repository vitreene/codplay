# Validation S5 — capture HTML classique V2

## Statut

`Fini` — la fixture S5, l’adaptateur HTML, la telco de validation et les tests
d’intégration sont terminés. Ce document organise la validation d’intégration ;
il ne définit pas le contrat core de capture et ne peut pas le modifier.

Le contrat de capture source-agnostique est suivi dans
[`capture-authoring-plan.md`](./capture-authoring-plan.md). La présente tranche
a utilisé le scénario S5 comme fixture de validation, puis a raccordé cette
capture à une source HTML et à la telco de validation V2.

## Périmètre

Cette tranche couvre uniquement :

- l’adaptation V2 de la fixture S5 `Drag & Capture` déjà existante ;
- l’adaptateur source HTML de pointeur ;
- le raccord à la telco de validation existante ;
- les tests d’intégration navigateur et player nécessaires à cette fixture.

Elle ne crée :

- aucune nouvelle sémantique de capture ;
- aucun circuit `list-dnd`, preview ou commit parallèle ;
- aucune façade `emit.dnd` ;
- aucune nouvelle entrée de démo ;
- aucun comportement propre au DOM dans le core capture.

Cette validation S5 est close. L'entrée active de
`demos/validation/player` peut porter une tranche différente ; son état et ses
critères sont suivis par le plan correspondant, actuellement
[`list-dnd-integration-plan.md`](./list-dnd-integration-plan.md).

## Références obligatoires

- contrat normatif : [`v1-capture-spec.md`](../../../docs/formalisation/v1-capture-spec.md) ;
- fixture V1 : `packages/demos/src/scenes/s5-drag-scene.ts` ;
- plan core V2 : [`capture-authoring-plan.md`](./capture-authoring-plan.md) ;
- telco de validation V2 et son modèle de progression stabilisé ;
- flux V2 réel : `RuntimeEventDispatcher -> journal -> materialize -> resolve -> solve -> component -> materializer`.

La fixture de validation est portée sur les frontières V2. Les décisions V2
déjà établies peuvent modifier une frontière d’implémentation, mais pas la
sémantique de capture sans spec explicite.

## Ordre de reprise

### 1. Geler l’état de travail

- ne pas prendre `drag-scene.ts`, le remote ou l’adaptateur actuels comme
  référence normative ;
- supprimer le style final direct qui masque le cycle de relecture ;
- ne pas multiplier les fichiers ou entrées de démo ;
- ne pas modifier le core `packages/codplay` V1.

### 2. Porter S5 sans changer son comportement

La scène doit conserver les rôles séparés de :

- l’événement de début ;
- `initCaptureState` ;
- `trackCommand` et son `CaptureAction` live ;
- `endCapture` et ses événements persistants ;
- `endEmit` lorsqu’il est déclaré par la fixture ;
- le strap qui inscrit le résultat dans le state.

Le calcul de la position finale reste `from = state` et `to = captureState`.
La position finale ne doit pas être commitée directement dans la scène pour
masquer un défaut du seek.

Le portage doit vérifier séparément :

- la pose live pendant le geste ;
- la sortie persistante destinée à la reconstruction ;
- la sortie normale de fin et son `data.captureState` ;
- l’écriture du state par le strap ;
- une seconde capture qui relit ce state.

### 3. Brancher l’adaptateur HTML

L’adaptateur est une source de capture, pas un moteur DnD. Il doit :

- indexer les déclarations compilées à l’initialisation ;
- déclencher l’événement de début puis ouvrir la capture dans un ordre
  déterministe ;
- retenir le perso et le `pointerId` qui ont ouvert la capture ;
- transmettre les samples natifs sans recalculer les deltas ;
- continuer à recevoir le pointeur lorsqu’il quitte le perso ;
- ne pas installer de pointer capture natif : la cible globale porte le suivi,
  conformément au circuit global de suivi retenu pour cette source ;
- écouter les événements `trackOn` et `endOn` déclarés ; `pointercancel` et
  `lostpointercapture` n'ont aucun effet particulier lorsqu'ils ne sont pas
  déclarés dans `endOn` ;
- fermer ou annuler une session exactement une fois ;
- annuler les sessions encore ouvertes lors de sa destruction.

Aucun hit-test de liste, ghost, reparentage ou preview n’est introduit dans
cette étape.

### 4. Reprendre la telco existante

Le contrôle de validation doit fournir un seul chemin stable pour :

- `play` ;
- `pause` ;
- `seek` par glissement du progress ;
- `rewind`.

Le glissement doit afficher la position courante, transmettre régulièrement
les positions intermédiaires si le contrat le prévoit, et garantir l’envoi de
la dernière position au relâchement. Les commandes en cours, la pause avant
seek et les erreurs doivent être gérées par un seul propriétaire.

Toute façade locale strictement nécessaire à cette fixture est limitée à la
démonstration et marquée `temp`. Elle ne devient pas le contrat telco V2.

État de cette reprise : `createRuntimeTelco` est la façade V2 utilisée par
`HtmlPlayerRunner`, et `demos/shared/telco-remote.ts` est le remote temporaire
de validation qui reprend le comportement de contrôle V1 sans importer la
façade V1 ni créer de pont `PlayerApi`. Dans la page courante, la zone telco
est rendue après la scène et le relevé d'état est le dernier panneau. La
La vérification manuelle de la démo courante couvre le glissement complet ;
l’automatisation Safari reste indisponible dans l’environnement.

### 5. Tester le chemin réel

Les tests d’intégration doivent couvrir :

- `pointerdown -> pointermove -> pointerup` sur le DOM materialisé ;
- sortie du pointeur hors du perso ;
- événements non déclarés (`pointercancel`, `lostpointercapture`) sans
  fermeture implicite, événement déclaré dans `endOn` et double fermeture ;
- application live par `Component.update()` et materializer ;
- absence des samples dans le journal ;
- ancrage correct de la sortie persistante ;
- `endEmit` avec `data.captureState` ;
- strap et state final ;
- seek avant, pendant et après la transition ;
- seconde capture utilisant le state précédent ;
- capture sans sortie persistante et warning auteur ;
- glissement complet du progress de la telco ;
- conservation des éléments materialisés pendant le seek et destruction
  uniquement au teardown final.

Une compilation, un typecheck ou un test qui appelle directement
`RuntimePlayer.trackCapture()` ne suffit pas à valider cette tranche.

## Hors périmètre

- façade auteur `emit.dnd` ;
- capacités de liste et placement DnD ;
- capture Three.js, Canvas ou autre source non HTML ;
- authoring `setNodePose` ;
- nouvelle architecture de telco ;
- nouvelles démos.

## Audit des écarts V1/V2 — 2026-08-21

Sources relues : la spec normative
[`v1-capture-spec.md`](../../../docs/formalisation/v1-capture-spec.md), le
runtime V1 `packages/codplay/src/runtime/capture-runtime.ts`, le contrat core
V2 [`capture-authoring-plan.md`](./capture-authoring-plan.md) et le circuit
V2 `RuntimePlayer -> dispatcher -> component -> materializer`.

### Conservé en V2

- une session unique avec `initCaptureState` à l'ouverture, samples bruts et
  `captureState` éphémère ;
- un tracking global qui reste actif quand le pointeur quitte le perso, en
  phase de capture, sans recalculer les deltas natifs ;
- l'absence de samples et d'actions live dans le journal ;
- la séparation et l'optionalité de `endEmit` et `endCapture` ;
- `endCapture` persist-only, la frontière de tête de lecture et la
  reconstruction ultérieure par seek ;
- l'annulation au teardown et la conservation des éléments materialisés
  pendant un seek.

### Adapté par une décision V2 déjà établie

- les `CaptureAction` lisent l'`actionTargetIndex` compilé et passent par
  `Component.update()` puis les services et le materializer ; ils ne reprennent
  pas le chemin V1 d'écriture DOM directe ;
- `endEmit` reçoit systématiquement `data.captureState`, y compris lorsque la
  déclaration fournit déjà d'autres données ;
- les sorties et les straps passent par le dispatcher V2 unique, dont l'entrée
  est asynchrone ; l'adaptateur ouvre donc la session après la résolution de
  l'événement de début, en mettant en file les événements `trackOn` et `endOn`
  reçus pendant cette attente puis en les rejouant dans leur ordre natif ;
- cette tranche HTML ne porte que la source pointeur. Les sources clavier,
  Canvas, Three.js et autres restent source-agnostiques dans le core et hors
  de S5.

### Écarts corrigés car non pertinents

- suppression de `setPointerCapture()` et de sa libération : ce circuit natif
  n'existe pas dans V1 et introduisait un `lostpointercapture` parasite ;
- suppression de l'annulation implicite sur `pointercancel` et
  `lostpointercapture` : seuls les événements explicitement déclarés dans
  `endOn` ferment une capture ; la destruction reste une annulation du cycle
  de source ;
- enregistrement et retrait des listeners globaux avec `{ capture: true }`,
  comme dans V1.

Ces décisions empêchent l'adaptateur HTML et la démo de créer un second
comportement de capture. Toute extension future doit être ajoutée au contrat
core ou à un adaptateur de source identifié, jamais au remote de validation.

## Critère de sortie

La validation est terminée lorsque la fixture S5 traverse le circuit V2 réel,
que le seek et la seconde capture sont corrects, que la telco est utilisable par
glissement, et que le code ne contient aucun chemin de démonstration concurrent
ou de commit direct ajouté pour compenser une lacune du core.

## État de vérification — 2026-08-22

- [x] verticale runner HTML : capture live, fermeture persist-only, seek et
  seconde capture ;
- [x] adaptateur pointer : `pointerId`, sortie du perso, fin par `endOn`,
  annulation au teardown et conservation des `pointermove` reçus avant la fin
  asynchrone de l'événement de début ;
- [x] verrou d'interaction de la scène raccordé à la lecture ;
- [x] telco V2 et remote unique : play, pause, seek continu, dernière valeur au
  relâchement et rewind ;
- [x] typecheck, build de la page et `59` fichiers Vitest / `366` tests ;
- [x] gestes pointer et seek vérifiés manuellement lors de la clôture S5 ;
  l'automatisation JavaScript Safari reste indisponible par les réglages système
  de l'environnement. La validation navigateur de l'entrée active est suivie
  dans le plan de la tranche correspondante.
