# Validation S5 — capture HTML classique V2

## Statut

`En cours` — la fixture S5, l’adaptateur HTML, la telco et leurs validations
avaient été exercés avant la décision de remplacer `cascade` par `visibility`.
La validation doit être reprise lorsque la migration core suivie dans le
[plan capture](./capture-authoring-plan.md) sera autorisée et implémentée.

Le cycle source-agnostique vérifié est décrit dans la
[spécification capture V2](../specs/capture-v2-spec.md). La portée cible
`visibility` reprend le vocabulaire des événements V2 défini dans la
[spécification du pipeline événementiel](../specs/event-pipeline-v2-spec.md).
Ce plan suit uniquement l’acceptance de la fixture S5 par le chemin HTML réel.

## Périmètre

La tranche couvre la fixture `Drag & Capture`, l’adaptateur HTML de pointeur,
la telco V2 et les tests d’intégration associés. Elle n’introduit ni sémantique
de capture parallèle, ni circuit DnD, ni nouvelle démo.

La fixture reste sous `packages/codplay/tests/fixtures`. Elle n’est pas exposée
comme démo ; le layout V2 conserve la propriété de la page, du remote et de la
telco.

## Acceptance à reprendre

Lorsque le contrat `visibility` sera implémenté :

- vérifier les événements d’ouverture, `endEmit` et `endCapture` sur le chemin
  HTML ;
- couvrir les portées `story`, `scene`, `public` et le défaut ordinaire ;
- vérifier l’adaptateur pointeur : `pointerId`, sortie du perso, événements de
  fin explicitement déclarés et annulation au teardown ;
- vérifier l’absence de samples dans le journal, la sortie live par les actions
  compilées et le routage des événements de fin ;
- vérifier l’ancrage, `persist-only`, le seek avant/pendant/après transition et
  la seconde capture qui relit l’état produit ;
- valider Play, pause, seek continu, dernière valeur au relâchement et rewind
  avec la telco unique ;
- exécuter les tests d’intégration, typecheck et build concernés, puis valider
  la démo dans un navigateur visible.

Une compilation ou un test direct de `RuntimePlayer.trackCapture()` ne suffit
pas à accepter cette tranche : la validation doit traverser le dispatcher, le
journal, la présentation et le cycle de vie HTML concernés.
