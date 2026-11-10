# Stabilisation V2 — sources et observations de scroll

> Statut : En cours. Contrat vérifié :
> [scroll-container](../specs/scroll-container-spec.md).

## Circuit et décisions conservés

Le composant possède progression et capture ; l’adaptateur HTML facultatif
possède la résolution et le cycle des observers. Les événements et actions
live passent par les ports existants du player. Les fonctions sont déjà
exercées par les suites composant et `HtmlPlayerRunner` ; ce plan conserve
leurs acceptations d’intégration restantes.

L’observation initiale déclarative synchronise la phase par défaut. Avec
`initial: enter/leave`, seule la phase correspondante peut émettre. Si cette
première mesure arrive en `ready`, l’émission retenue est envoyée une fois au
passage à `playing`, puis annulée si la phase change, au Seek/reset, à la fin
ou à la destruction. Ne pas ajouter de dispatcher ni rejouer toutes les
transitions reçues avant Play.

## Acceptation de la remise à zéro des observations

Le reset renouvelle les observers dans leurs bindings initiaux, retire les
phases et actions live obsolètes et invalide les callbacks en attente. Les
règles `once` déjà consommées restent conservées.

- [ ] Rejouer le parcours Sighty réel après reset : une cible visible
      synchronise sa phase sans faux `enter`, les transitions suivantes
      restent actives et le ratio du titre reprend sur la géométrie courante.
- [ ] Vérifier le titre avec sa surface d’observation sticky de 50 % du
      scrollport : progression 0→1 sur cette hauteur, cartouche et paragraphes
      conservés. Cette déclaration de scène exerce le ratio natif existant.

## Acceptation du reset de position

Décision acceptée et implémentée : `onReset()` remet uniquement l’axe configuré
à l’origine (`scrollTop` pour block, `scrollLeft` pour inline), puis rattache et
échantillonne la source. L’autre coordonnée et les règles `once` sont conservées.
Les tests source couvrent les deux axes ; le retour réel à la page initiale
après échec Sighty est vérifié sous Firefox pour block.

- [ ] Vérifier dans Safari le même parcours de réadmission/reset et l’origine
      du scrollport avant de clore cette acceptation.

## Acceptation LMS restante

- [ ] Rejouer le package SCORM reconstruit dans la LMS réelle : animation
      d’apparition et déverrouillage CMI de la page après émission initiale.

## Clôture

Conserver le composant, l’adaptateur HTML et le circuit source commun de la
spécification. Les tests du composant et du vrai runner couvrent Play, Seek,
reset, fin et destruction ; les parcours navigateur et LMS ci-dessus restent
nécessaires. Mettre à jour les seuls contrats nouvellement prouvés, puis
retirer ce plan lorsque ces validations sont closes.
