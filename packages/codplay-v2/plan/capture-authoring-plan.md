# Capture continue V2 — plan core

## Statut

`Fini` — ce document porte uniquement le mécanisme core de capture
continue, indépendant de sa source et de sa materialisation. Il doit être
validé avant toute modification de `src/`.

La validation d’une fixture HTML et de la telco est décrite séparément dans
[`capture-s5-validation-plan.md`](./capture-s5-validation-plan.md). Elle ne
fait pas partie du contrat core.

## Autorité et périmètre

Le contrat actif est défini par les specs V2 déjà établies. La spec V1
[`v1-capture-spec.md`](../../../docs/formalisation/v1-capture-spec.md) est la
référence comportementale du portage lorsqu’une décision V2 ne la modifie pas.

Ce plan couvre :

- le cycle source-agnostique `begin -> track -> end/cancel` ;
- l’état éphémère de capture et les samples ;
- les `CaptureAction` live et leur résolution vers des actions compilées ;
- `endEmit`, `endCapture`, leur routage et leur matérialisation ;
- l’ancrage temporel des sorties persistantes ;
- le passage par le dispatcher, le journal et la frontière composant/materializer ;
- le seek, l’annulation et le diagnostic de relecture.

Ce plan ne définit pas :

- un adaptateur DOM, SVG, Canvas, Three.js ou autre source concrète ;
- une telco ou un remote de validation ;
- le DnD, une liste, un ghost, un hit-test ou un placement ;
- une scène de démonstration ;
- `setNodePose` ou l’intégration de l’éditeur.

## Contrat core à porter

### Session et état

- Une capture est ouverte par une entrée discrète et possède une session
  identifiée, son hôte, son scope de lecture et son instant d’ouverture.
- `initCaptureState` est appelée une fois à l’ouverture ; sans elle,
  `captureState` commence à `{}`.
- `captureState` est propre à la session. Il n’est ni le state applicatif, ni
  une entrée du journal, ni une valeur rejouée au seek.
- `trackCommand` reçoit le sample courant, le cumul brut et le dernier
  `captureState`.
- `trackCommand` peut retourner une `CaptureAction`, un remplacement de
  `captureState` et une mise à jour partielle `updateState` du scope lu par la
  capture. `updateState` n’entre pas dans le journal et n’est pas rejouée au
  seek ; le résultat seek-safe passe par une sortie de fin et un strap. Aucun
  de ces résultats ne devient un événement par sample.

### Actions live

- Une `CaptureAction` sélectionne une action déjà déclarée dans
  `CompiledPerso.actions` par `actionName`.
- Elle ne crée jamais d’action au runtime et n’est jamais ajoutée au journal.
- Les cibles sont préparées lors de la compilation ou de l’initialisation du
  player à partir de l’index compilé ; aucune recherche de cible n’est faite
  pendant le tracking.
- L’application live suit la frontière commune
  `component.update() -> services -> materializer`.
- Elle ne connaît pas le substrat final et n’écrit jamais directement dans un
  node ou une API DOM.
- Une absence d’action sur un sample retire l’action live précédente au lieu
  de la laisser active implicitement.

### Sorties de fin

`initCaptureState`, `trackCommand`, `endEmit` et `endCapture` sont quatre
mécanismes distincts du cycle de capture : chacun est indépendant et
optionnel.

- `endEmit` est un `StoryEvent` normal. Il passe par le dispatcher standard et
  sa donnée contient toujours `captureState` sous la clé réservée, en
  conservant les données explicites de l’auteur.
- `endCapture` reçoit les samples bruts, le dernier `captureState`, le state en
  lecture seule et les métadonnées. Il peut retourner des `StoryEvent` ou ne
  rien retourner.
- `endCapture` ne modifie jamais directement le state. Toute écriture passe
  par un strap déclenché par un événement normal.
- Tout événement retourné par `endCapture` est `persist-only` par son
  positionnement ; aucun marqueur supplémentaire n’est nécessaire.
- L’insertion `persist-only` est une frontière atomique : l’événement est
  ajouté au journal, mais la tête de lecture à l’instant de `endCapture` ne le
  voit pas. Il ne participe ni à la matérialisation courante, ni à la
  résolution, ni au solve, ni à l’application de cette fermeture. Une
  reconstruction ultérieure peut ensuite le prendre en compte selon son
  `applyAtMs`.
- `endEmit` suit la politique d’insertion d’un événement normal, avec
  `apply-now` par défaut.
- Les sorties de fin passent toutes par le dispatcher normal. Le runtime ne
  crée pas de circuit de capture concurrent.

### Ancrage et relecture

- La session conserve son instant d’ouverture.
- La durée d’une sortie `endCapture` est résolue selon `duration`/
  `durationMode` du contrat, notamment la durée réelle en mode `capture`.
- Une capture ouverte et fermée dans le même tick conserve une durée effective
  minimale de `1 ms`, contrainte par le moteur de transitions qui refuse une
  durée nulle ; l’ancrage reste `now - duréeRésolue`.
- L’événement `endCapture` est ancré à `now - duréeRésolue` ; les transitions
  concernées reçoivent la durée résolue lorsqu’elles n’en déclarent pas.
- Cet ancrage n’est pas ramené artificiellement à zéro : le journal accepte un
  `applyAtMs` runtime fini négatif, tandis que le temps de lecture reste dans
  son domaine non négatif. Cela conserve la sémantique V1 de `now - durée`.
- Le tracking live n’est jamais rejoué au seek.
- Un seek annule les sessions live ouvertes, sans détruire les éléments
  materialisés persistants ; la destruction intervient au teardown final du
  player.
- Si aucune sortie persistante n’est produite, le mode auteur émet un warning
  non bloquant indiquant que la relecture peut différer. Cette absence reste
  un choix valide pour les usages sans relecture seek.

## Architecture cible

```text
source continue
      -> façade RuntimePlayer de capture
      -> session éphémère
      -> trackCommand
      -> CaptureAction -> actionTargetIndex compilé
      -> Component.update() -> services -> materializer

endCapture / endEmit
      -> RuntimeEventDispatcher
      -> journal / materialize / resolve / solve
```

Le core ne connaît ni l’origine native du sample ni le substrat de
materialisation. Ces responsabilités appartiennent aux adaptateurs et aux
plans de validation spécifiques.

## Ordre d’implémentation core

### 1. Contrats auteur, compilés et runtime

- aligner les types auteur, `CompiledScene` et runtime sur les formes de la
  spec : state scope, actions, sorties de fin, durée et métadonnées ;
- conserver les fonctions comme références compilées conformément au contrat
  V2 des fonctions extraites ;
- compiler les événements de fin avec leur déclaration complète.

### 2. Session source-agnostique

- reconstruire l’ouverture, l’initialisation, le tracking, la fin et
  l’annulation autour d’une session unique ;
- conserver instant d’ouverture, samples, state scope et `captureState` ;
- distinguer dans le résultat les sorties `endCapture`, `endEmit` et leurs
  politiques de placement ;
- produire le warning uniquement lorsqu’aucune sortie persistante n’existe.

### 3. Player et application live

- exposer la façade core sans listener de source ;
- résoudre une fois les cibles des actions compilées ;
- transmettre l’état live par la frontière composant/services/materializer ;
- éliminer les applications répétées ou concurrentes ;
- faire disparaître l’action live précédente lorsqu’un sample ne la remplace
  pas.

### 4. Dispatcher, journal et seek

- faire transiter les deux sorties par le dispatcher normal ;
- ancrer les événements `endCapture` au temps résolu ;
- conserver `persist-only` pour les reconstructions futures sans double
  application immédiate ;
- annuler une session ouverte au seek et au destroy ;
- préserver le cycle de vie persistant des composants materialisés.

### 5. Vérification core

Les tests core doivent utiliser une source abstraite et un materializer de test,
sans DOM ni scène de démonstration. Ils vérifient :

- initialisation unique et state scope ;
- samples absents du journal ;
- actions compilées et absence de recherche live ;
- retrait d’une action live ;
- séparation et optionalité de `endEmit`/`endCapture` ;
- `data.captureState` systématique sur `endEmit` ;
- persist-only implicite des sorties `endCapture` ;
- durée et ancrage ;
- warning en l’absence de sortie persistante ;
- annulation au seek et destruction uniquement au teardown.

## Hors périmètre et plans liés

- validation S5 HTML, adaptateur pointer et telco :
  [`capture-s5-validation-plan.md`](./capture-s5-validation-plan.md) ;
- façade DnD auteur : après validation d’une capture classique ;
- materializers spécifiques : plans des materializers concernés ;
- authoring éditeur et `setNodePose` : plan de l’éditeur.

## Critère de sortie du core

Le core est prêt lorsque ses contrats et tests source-agnostiques sont cohérents
avec les specs, que le player ne contient aucun chemin de démonstration, et que
la fixture S5 peut être branchée sans ajouter de sémantique au mécanisme core.

## Suivi d’implémentation

- [x] contrats auteur, compilés et runtime alignés sur les sorties de capture,
  `updateState`, les scopes et les durées ;
- [x] session unique avec séparation `endCapture`/`endEmit`, ancrage temporel,
  propagation de durée et warning de relecture ;
- [x] façade player source-agnostique, index compilé des cibles d’action,
  retrait d’une action live et maintien des mises à jour live hors journal ;
- [x] frontière `persist-only` maintenue pendant toute la fermeture, y compris
  lorsque `endEmit` est présent ;
- [x] annulation au seek/destroy et conservation des composants jusqu’au
  teardown final ;
- [x] tests core source-agnostiques et tests compilés : `57` fichiers, `351`
  tests passants au 2026-08-21 ;
- [ ] validation S5 HTML/telco, suivie exclusivement dans
  [`capture-s5-validation-plan.md`](./capture-s5-validation-plan.md).
