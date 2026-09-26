# Acceptation du contenu foreign et du composant `slot`

> Statut : **En cours**. Le profil `slot`, la surface HTML de rattachement,
> `replace` pour `slot` et la première façade `instances.mount` ont des
> comportements vérifiés décrits dans les spécifications liées ci-dessous.
> L'intégration générale du contenu foreign et ses parcours complets restent
> à accepter.

## Autorité des contrats

Ce plan ne redéfinit pas les comportements déjà vérifiés. Leur interprétation
fait foi dans :

- la [spécification du composant `slot`](../specs/slot-component-spec.md) ;
- la [spécification du pont runtime `rel`](../specs/third-party-target-bridge-spec.md) ;
- la [spécification de façade et des instances](../specs/facade-v2-spec.md) ;
- les spécifications des bibliothèques qui possèdent une représentation native.

Les scénarios d'application Sighty restent des preuves de consommation ; ils ne
modifient pas le contrat générique de CodPlay. Les modifications du cœur restent
conditionnées par un plan accepté et une autorisation explicite.

## Décisions encore ouvertes

| Sujet | État | Travail requis |
|---|---|---|
| Référence sérialisable pour un contenu foreign générique | **À décider** | Arrêter sa forme avec le propriétaire de représentation concerné. Ne pas ajouter une forme universelle au composant `slot`. La valeur ne doit pas transporter de nœud DOM, de player, de fonction ni d'objet runtime mutable. |
| Disponibilité asynchrone | **Décision prise, application à valider** | Une disponibilité tardive réentre par le circuit déterministe du runtime avec l'identité de cible et la génération de session ; une réponse périmée est ignorée ou diagnostiquée. Définir et prouver le raccord du propriétaire de représentation sans callback qui écrit directement dans le DOM. |
| Remplacement d'une iframe ou d'une représentation non clonable | **À décider** | Choisir, pour la capacité concernée, entre remplacement sans transition et élément visuel de substitution. Le clone DOM de `slot` ne prouve pas la reproduction d'un rendu natif. |
| Enfants interinstances à plusieurs racines | **À valider** | Vérifier le comportement public de `codplay.instances.mount` avec plusieurs racines de premier niveau et documenter sa limite. La surface `foreignContent` multi-racines ne suffit pas à certifier ce parcours façade. |

Les profils `replace-split-*` restent hors du contrat `slot` : `replace.split`
est accepté puis ignoré par ce profil. Toute autre sémantique exige une
spécification et une décision propres au composant concerné.

## Acceptation restante

| Gate | Preuve attendue |
|---|---|
| Manifeste et diagnostics d'intégration | Exercer la correspondance exacte des portées utilisées par les intégrations, avec références inconnues, ambiguës ou sans déclaration correspondante ; vérifier que l'erreur de composition est actionnable et ne choisit jamais une cible par approximation. |
| Propriétaire de représentation asynchrone | Exercer disponibilité tardive, remplacement concurrent, annulation et destruction par le vrai propriétaire ; prouver que les réponses anciennes ne réattachent pas de contenu et que les ressources restent possédées par leur fournisseur. |
| Montage interinstances | Valider les racines simples et multiples, leur ordre, le détachement, le remontage et la destruction d'une instance sans détruire l'autre. Garder les players hôte et enfant indépendants pendant les opérations publiques. |
| Module `replace` partagé | Exercer le même module sur `slot`, `img` déjà raccordé et `tag` avant d'étendre le contrat. Couvrir interruption, remplacement répété, nettoyage, Seek et replay sur le parcours réel du composant ajouté. |
| Cycle de vie consommateur | Compléter le parcours A/B avec pause/reprise, replay, fins de séquence, interruptions et ressources, en conservant la propriété du cycle de chaque instance chez son appelant. |
| Validation navigateur | Rejouer les parcours réellement touchés dans Safari et un navigateur complémentaire, avec Play, Seek, resize et teardown selon le composant et le propriétaire validés. |

Chaque ligne est un gate distinct. Une fixture Sighty ne remplace pas les tests
de contrat du composant ou du pont ; un test unitaire de surface ne clôt pas le
cycle d'une représentation native réelle.

## Critères de clôture

- Les décisions de référence et de transition propres aux représentations
  concernées sont arrêtées ou explicitement exclues de la tranche.
- Les parcours asynchrones et multi-racines effectivement retenus sont testés
  par leur propriétaire jusqu'au montage CodPlay.
- Le module partagé n'est étendu qu'aux composants dont le parcours réel est
  accepté et documenté.
- Le cycle consommateur et les contrôles navigateur applicables sont validés.
- Les comportements vérifiés sont transférés dans leurs spécifications ; le
  présent plan ne conserve ensuite que les gates restantes, ou est retiré si
  aucun travail ne subsiste.
