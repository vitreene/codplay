# Suppression du catalogue global et découverte des actions

> Décision de suppression : **Fixe**, confirmée par l'utilisateur le
> 2026-10-19. Application : **non commencée**. Plan d'application : **A relire**.
> La demande présente porte sur ce plan pour application future ; elle ne
> déclenche aucun changement du cœur. Les choix encore ouverts ci-dessous
> doivent être tranchés avant les travaux qui en dépendent.

## Décision et résultat attendu

Supprimer `actionTargetIndex`, ses références et la copie globale construite
en mémoire par le player. Maintenir le principe existant de découverte des
actions : consulter les déclarations pour le nom effectivement traité, puis
appliquer les règles de portée, de résolution et de présentation existantes.

Le rapport entre un événement et ses destinataires reste `1 -> n`, avec zéro,
un ou plusieurs destinataires et aucune borne contractuelle sur `n`.
L'application ne doit ni énumérer les sorties possibles des straps ni exiger
une liste préalable des destinataires de leurs émissions.

La suppression ne se réduit pas au champ JSON : aucun catalogue exhaustif
équivalent ne doit être déplacé vers un autre objet, renommé, reconstruit à
l'initialisation ou dissimulé derrière un cache global. Les résultats locaux
nécessaires au traitement d'une action effective restent des données de ce
traitement, pas une nouvelle autorité de routage.

## Autorité et circuit à conserver

Les spécifications décrivent encore le comportement actuellement vérifié :

- [Scène auteur](../specs/scene-authoring-spec.md) et
  [codec](../specs/compiled-codec-v2-spec.md) : déclaration, normalisation,
  artefact immuable et frontière JSON.
- [Pipeline événementiel](../specs/event-pipeline-v2-spec.md),
  [straps](../specs/strap-execution-v2-spec.md) et
  [reconstruction](../specs/runtime-reconstruction-v2-spec.md) : journal unique,
  sélection des occurrences, résolution et Seek sans réexécution des straps.
- [Capture](../specs/capture-v2-spec.md) et
  [scroll](../specs/scroll-container-spec.md) : sorties live éphémères,
  résolution de leurs actions et update des composants.
- [Motion](../specs/motion-frame-v2-spec.md) : transport des occurrences
  matérialisées vers le runner HTML.

Le circuit à prolonger est déjà identifié :

```text
événement effectivement traité + portée + journal
  -> materialize : consultation de perso.actions[event.name]
  -> resolveActionDefinition -> resolve -> solve -> présentation

sortie live effective d'une source
  -> contrôleur live existant : découverte du nom dans les déclarations
  -> resolveLiveActionState -> update des composants -> services/materializer
```

Le second chemin conserve le cycle live existant : aucun sample n'est
transformé en événement ou ajouté au journal pour réutiliser artificiellement
le premier. La suppression du catalogue ne change pas la valeur d'action
déclarée ni la politique existante de fusion avec `data`.

## Constat causal et surfaces concernées

Le [builder](../src/scene/compiled/scene-builder.ts) parcourt toutes les clés
de toutes les `perso.actions` des stories conservées. Ce recensement ne dépend
ni des straps exécutés ni des eventimes utiles et comprend les
auto-références `null`. Le
[contrôleur live](../src/runtime/player/live-actions/live-action-controller.ts)
le convertit en une seconde map globale, portant cette fois les valeurs
d'actions. Le volume dépend donc du total des associations déclarées, même
si aucun événement ne les sollicite. Aucun coût chiffré n'est établi.

La [matérialisation](../src/runtime/player/pipeline/materialize.ts) utilise
déjà directement les déclarations, avec le
[résolveur commun](../src/runtime/player/pipeline/action-resolution.ts).
Le runner HTML reçoit les occurrences produites par ce circuit. La fonction
exportée `compileMotionSchedule` utilise encore le catalogue pour les faits
du journal ; ses seuls appels recensés dans le dépôt sont ses tests.

| Surface | Travail prévu |
|---|---|
| `scene/compiled/scene-builder.ts`, `types.ts`, `index.ts` | Retirer la dérivation, le champ, `CompiledActionTargetIndex` et les types/exports devenus sans usage |
| `scene/compiled/codec.ts`, `semantic-validator.ts` | Retirer forme et diagnostics propres au catalogue ; préserver les contrôles sémantiques utiles |
| `runtime/player/live-actions/` | Retirer la map globale et `action-target-index.ts` ; découvrir les actions effectives dans le contrôleur existant et préserver l'application live |
| `runtime/player/capture/` | Retirer la réexportation et l'alias `indexCompiledCaptureActionTargets`, puis les fichiers devenus inutiles |
| `runtime/motion/motion-schedule.ts`, `index.ts` | Fermer la dépendance au catalogue selon la décision M1 ci-dessous ; préserver les helpers utilisés par les occurrences réelles |
| Tests CodPlay et `tools/scene-export/tests/` | Retirer les champs de fixtures et assertions du catalogue ; vérifier les comportements par des fixtures propres aux tests |
| Specs et plans | Actualiser les contrats après vérification et retirer les références qui présentent le catalogue comme mécanisme actuel |

Actualiser cet inventaire à la reprise, y compris les imports, commentaires,
diagnostics, noms de fichiers et éventuels artefacts générés suivis. Les
mentions explicatives de cette suppression dans son plan ne constituent pas
des références exécutables à conserver.

## Invariants d'application

- Comparaison exacte du nom ; zéro destinataire reste un cas valide. Ne pas
  exiger que les noms produits par un strap soient connus au build.
- Conserver les déclarations `perso.actions`, l'auto-référence `null`, les
  payloads runtime, la fusion actuelle, les séquences et les TweenAction
  selon leurs contrats respectifs.
- Préserver les portées, l'activité des tracks, l'isolation et les resets des
  événements. Pour les actions live, conserver les destinataires du contrat
  actuel ; ne pas ajouter un filtre de montage, d'activité ou de story par
  analogie avec la V1 ou avec les événements journalisés.
- Préserver l'ordre des actions, des sources et des destinataires, les
  updates des composants et la restauration de l'état après retrait d'une
  source. Résoudre et réappliquer les seules sorties live actuellement utiles.
- L'unicité exigée pour `observe.liveAction` reste propre à ce contrat ; elle
  ne devient jamais une restriction générale du routage `1 -> n`. La
  validation peut parcourir les déclarations pour le nom concerné, sans
  produire un catalogue transporté ou conservé pour la lecture.
- Le journal reste l'autorité des faits persistants ; Seek/replay ne rejouent
  ni les straps ni les samples. La motion reste issue des occurrences
  canoniques, sans nouvelle découverte exhaustive des mouvements futurs.

## Choix à valider avant application

| ID | Statut | Décision attendue et gate |
|---|---|---|
| F1 — format | **A relire** | Choisir la version du schéma et le traitement des paquets existants. Direction proposée : nouveau schéma et régénération des paquets, refus explicite des anciens formats, sans restauration du catalogue ni lecteur parallèle. Validation requise avant modification du codec/loader. La compatibilité player/paquet reste également ouverte au [plan export](./2026-10-15-export-diffusion-plan.md). |
| M1 — ancien schedule | **A relire** | Vérifier les consommateurs et le statut de l'export `compileMotionSchedule`. Direction proposée : retirer ce constructeur exhaustif s'il est confirmé sans usage contractuel ; préserver `createScheduledMotionIntent` et les autres helpers du circuit d'occurrences. Si un usage est découvert, décider son raccord au circuit canonique avant toute modification ; ne pas remplacer l'index par un second scan général du journal. |
| L1 — application live | **A relire** | Revoir les détails de la découverte dans le contrôleur existant, y compris les réapplications et le retrait d'une source. Direction fixée : aucune map globale de noms vers toutes les cibles. Aucun nouveau contrat public ni nouveau service de routage n'est nécessaire ou autorisé par ce plan. |

`storyActivationIndex` concerne un autre objet. Son retrait demeure une
proposition distincte au [plan CompiledScene](./compiled-scene-plan.md) ; cette
demande de suppression du catalogue des actions ne tranche pas ce point.
L'éventuelle révision de la sémantique des valeurs d'actions live reste elle
aussi distincte de la suppression décidée ici.

## Tranches ordonnées et acceptation

Toutes les tranches ci-dessous restent ouvertes. F1, M1 et L1 précèdent le code
qui en dépend ; la direction de suppression déjà acceptée n'est pas à
rediscuter. Préparer une modification cohérente de bout en bout avant de la
présenter comme utilisable, sans bridge temporaire.

| Tranche | Actions | Preuve attendue |
|---|---|---|
| A0 — cadrage | Relire specs/plans, actualiser les références, valider F1/M1/L1, relever les résultats initiaux des suites concernées | Propriétaires identifiés, décisions applicables et plan accepté avant code |
| A1 — découverte live | Adapter le contrôleur et la réapplication en prolongeant les règles de découverte/résolution existantes ; retirer le catalogue runtime et ses alias | Zéro/un/plusieurs destinataires, plusieurs sources/actions ordonnées, remplacement, retrait et restauration de l'état ; aucun recensement global à la création du player |
| A2 — compilation et validation | Retirer champ/types/dérivation/diagnostics ; contrôler `observe.liveAction` depuis ses déclarations ; appliquer F1 au codec et au chargement | Builds auteur/export et round-trip sans le champ ; validation d'observation conservée ; politique d'anciens artefacts explicitement testée |
| A3 — motion et références | Appliquer M1 ; nettoyer les imports/exports et toutes les fixtures, outils et références du mécanisme supprimé | Runner alimenté par les occurrences réelles ; aucun lecteur, producteur, alias, fichier ou catalogue équivalent résiduel |
| A4 — intégration | Exécuter la matrice ci-dessous sur les parcours auteur et exporté avec le vrai runtime | Équivalence logique et de présentation sur les frontières touchées ; preuves identifiées et limites explicites |
| A5 — documentation et clôture | Mettre à jour les specs avec les comportements vérifiés, aligner les plans et l'index ; retirer ce plan une fois entièrement couvert | Aucune décision ou preuve restante ; liens et statuts alignés |

## Matrice de validation

| Frontière | Cas et preuves nécessaires |
|---|---|
| Découverte | Fixtures propres aux tests avec 0, 1 et N destinataires ; plusieurs stories ; nom produit par un strap au runtime ; abonnements jamais sollicités ; auto-référence et données variables. Vérifier les résultats effectifs, sans recopier l'algorithme dans les assertions. |
| Événements/straps | Sorties immédiates et planifiées, tracks/visibilités, journalisation unique et ordre ; mêmes états par Play/Seek/replay sans nouvelle exécution des straps. |
| Live | Capture et observation via le contrôleur et les composants réels ; ordre, payloads/TweenAction, plusieurs sources, pause, fin/annulation, seek, reset et destruction ; samples hors journal et restauration du dernier état logique. |
| Observation | Existence et forme de la TweenAction sur le perso observé, refus du nom partagé incompatible avec ce contrat ; maintien du `1 -> n` pour les autres usages. |
| Motion/structure | Événement statique et événement runtime à payload dynamique ; placements parent/enfant et reparent, Seek avant/après frontière, replay, reset, resize, `persist-only`, persistance et lifecycle. Préserver les occurrences et les identités du journal. |
| Artefact/paquet | Build ordinaire et export, JSON round-trip, paquet déplacé, fonctions/straps restaurés, chargement et lecture par le même player ; format rejeté selon F1, sans remplissage silencieux de l'ancien champ. |
| Cardinalité/coût | Constater l'absence de structure persistante proportionnelle à toutes les associations d'actions ; comparer les coûts de création et de traitement sur une fixture de taille explicite. Ne pas imposer de borne fonctionnelle à N ni de seuil temporel fragile en test. |
| Vérifications finales | Suites CodPlay et `component-v2`, tests des outils d'export, typechecks des packages affectés et des démos V2, build player et démos ; parcours navigateur du runtime réel pour événement à plusieurs destinataires, capture/observation et paquet exporté. |

Réutiliser en priorité les suites `scene/compiled`, `runtime/player/pipeline`,
`runtime-player`, `runtime-capture-player`, `runtime-event-dispatcher`,
`runtime/capture`, `runtime/runner-html`, les intégrations scroll de
`component-v2` et les suites façade/export. Les catégories structurelles,
resize, persistance ou lifecycle ne peuvent être omises que si l'analyse
finale démontre explicitement qu'elles ne sont pas affectées. Une suite
isolée réussie ne clôt pas l'intégration.

Avant toute validation navigateur/MCP, confronter la configuration MCP locale
à l'inventaire complet des outils réellement exposés, selon `AGENTS.md`.
Une frontière navigateur sans outil callable demeure une preuve en attente.

## État des preuves et clôture

L'analyse initiale du 2026-10-19 a exécuté six suites existantes :
`scene-builder`, `codec`, `pipeline`, `story-isolation`,
`runtime-capture-player`, `motion-schedule` ; **100 tests réussis** sur
l'implémentation avec catalogue. Ce résultat n'est pas une preuve de sa
suppression et sera actualisé lors de l'application. Aucun test runtime ni
parcours navigateur de la solution future n'est déclaré exécuté ici.

La clôture exige l'absence de références exécutables et de catalogue global
équivalent, les preuves A1–A4 et la mise à jour des specs scène, codec, capture,
scroll et, selon M1, motion. Actualiser la spec du paquet si F1 modifie sa
compatibilité. Le plan général et le plan CompiledScene doivent ensuite
pointer vers ces preuves. Garder ce plan tant qu'une décision acceptée reste
inappliquée ou qu'une validation requise manque.
