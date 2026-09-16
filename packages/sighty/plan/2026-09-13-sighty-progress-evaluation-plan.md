# Sighty — plan d’évaluation du traitement de la progression

## Statut

**Fini — implémentation et validation exécutées le 2026-09-15.**

Ce document fixe l’évaluation de la progression séparément du plan de
reconstruction de la navigation.

Le transport historique `progress:update` a été retiré de Demo 4 lors de la
reprise de la navigation. Il ne sera pas réintroduit : la progression reste une
observation vivante et passe par une surface de projection dédiée.

Une instrumentation temporaire, limitée à Demo 4, a été utilisée pour mesurer
le phénomène avant de choisir une solution de progression. Elle a été retirée
immédiatement après la mesure et ne fait pas partie du scénario, de Sighty ou
de CodPlay.

## Références et frontière

- [`2026-09-15-sighty-navigation-reconstruction-plan.md`](./2026-09-15-sighty-navigation-reconstruction-plan.md)
  traite les changements de vue, l’invalidation des sources sorties de la vue
  et la remise à zéro du contexte de navigation ;
- [`2026-08-01-composition-et-avancement-evenementiel.md`](../notes/2026-08-01-composition-et-avancement-evenementiel.md)
  distingue les faits discrets de l’observation de l’avancement ;
- [`2026-07-28-sighty-premiere-intention.md`](../notes/2026-07-28-sighty-premiere-intention.md)
  pose Sighty comme orchestrateur de vues et laisse le rendu aux scènes ;
- [`authoring-library-spec.md`](../specs/authoring-library-spec.md) décrit les
  surfaces publiques actuellement disponibles.

La progression est une valeur d’observation vivante. Elle ne doit pas être
transformée en événement normal, quelle que soit sa fréquence, ni être ajoutée
au journal de lecture. Le système d’événements reste réservé aux faits et aux
intentions discrets. Cette contrainte est héritée du cadre CodPlay ; elle ne
constitue pas une nouvelle responsabilité de Sighty.

## Problème à traiter

Le cas de Demo 4 comporte deux responsabilités distinctes :

1. **Source :** la telco de la scène active fournit l’état de progression via
   `getProgress()` et `onProgress()` ;
2. **Projection :** le contrôle visuel de progression affiche cet état sans
   envoyer de message normal et sans modifier le journal.

Sighty doit, si la solution le lui confie, garantir que l’observation est
limitée à la vue active et qu’elle est abandonnée lors d’un changement de vue.
La scène ou le composant CodPlay reste responsable du rendu de son contrôle.
Une lecture de propriétés internes du moteur ou une recherche DOM directe ne
constitue pas une solution acceptable.

Le défaut historique à éliminer était le chemin qui convertissait les
échantillons de progression en émissions périodiques `progress:update`. Il
n’est plus présent dans Demo 4. Réduire la fréquence, regrouper ces émissions
ou les rejouer différemment ne résoudrait pas le problème de frontière : ces
valeurs ne doivent pas entrer dans le journal des événements normaux.

## Décision d’implémentation

La demande explicite d’implémentation valide la combinaison suivante :

- la source est `CodPlayTelco.onProgress()` de la scène active ;
- Demo 4 conserve cette observation uniquement pour l’occurrence sélectionnée
  et la retire dès que la vue change ;
- la telco de scène déclare son contrôle comme un perso `input` identifié ;
- CodPlay expose une projection publique et transitoire de valeur d’input,
  `instance.projection.setInputValue()`, qui met à jour le composant sans
  événement, sans révision de journal et sans accès DOM depuis Sighty ;
- la projection est réappliquée après chaque échantillon de la telco active,
  puis remise à zéro par le cycle d’entrée de la telco ;
- l’owner CodPlay de Demo 4 conserve `engine.idle: false` : la telco ne peut
  donc pas hériter de l’idle par défaut et terminer artificiellement sa
  lecture ; `pauseOnDocumentHidden: false` reste une option indépendante de
  cette politique ;
- le couplage existant garde le seek comme commande discrète (`pause`, puis
  `seek`) et ne devient pas un transport de progression.

Cette décision ouvre une évolution ciblée du contrat public CodPlay pour la
projection de valeurs vivantes sur les composants `input`. Elle ne modifie pas
le contrat des événements, ne crée pas une horloge supplémentaire et ne rend
pas la progression persistante.

## Mesure temporaire réalisée

L'instrumentation a été posée dans la télécommande Sighty globale, puis retirée
une fois la mesure effectuée. Elle additionnait directement la taille des
tracks du journal live de `scene-telco`, sans ajouter elle-même d'événement au
journal mesuré.

La mesure a relevé environ **110 événements** avant l'apparition perceptible de
la vibration du progress. Ce résultat est un point d'observation de Demo 4,
pas un seuil universel de réactivité. Le bouton, la sortie, la lecture directe
du journal et le callback de transport ne sont plus présents dans le code.

## Critères de comparaison

Les options ont été comparées sur les points suivants :

| Critère | Question à vérifier |
| --- | --- |
| Journal | La progression reste-t-elle absente du journal et de sa révision ? |
| Vue active | Une ancienne scène peut-elle encore alimenter le contrôle après sa sortie ? |
| Cycle de vie | L’abonnement est-il créé, remplacé et supprimé avec la vue ? |
| Rendu | La donnée atteint-elle un point de projection public, sans DOM interne ni message normal ? |
| Réactivité | Le clic et l’affichage suivent-ils l’état sans file de navigation parasite ? |
| Réutilisation | La solution sert-elle à autre chose qu’au seul curseur de Demo 4 ? |
| Portée | Demande-t-elle une évolution de Sighty, de CodPlay, ou seulement de la démo ? |
| Validation | Peut-on tester l’entrée/sortie de vue, pause, relance et navigations répétées ? |

## Options examinées et choix

### A — Patch dédié : lecture directe de la telco publique

La démo conserve sa telco de scène et lit directement la telco de la scène
active. La forme retenue est A1 :

- **A1 — observation directe :** utiliser `onProgress()` et transmettre la
  dernière valeur à un contrôle explicitement prévu pour recevoir une mise à
  jour de présentation ; **retenue**.
- **A2 — lecture cadencée :** appeler `getProgress()` depuis une boucle de
  présentation appartenant à la démo ; **écartée**, car `onProgress()` fournit
  déjà la source nécessaire sans ticker supplémentaire.

Dans les deux cas, la valeur ne passe ni par `events.emit()`, ni par un
`progress:update`, ni par le journal. Le terme « moteur » ne doit pas conduire
à lire une API interne : la proposition porte sur la telco publique.

**Avantages :**

- portée minimale et réversible ;
- aucun changement de contrat Sighty ou CodPlay lorsqu'A1 est utilisée seule ;
- permet de vérifier rapidement que la cause des oscillations est bien le
  journal utilisé comme transport de progression ;
- A1 évite un polling si le signal public actuel suffit.

**Inconvénients et inconnues :**

- le raccord entre la valeur et le contrôle de la scène doit déjà disposer
  d’une surface de présentation autorisée ; sinon un accès DOM ou une méthode
  interne serait un contournement interdit ;
- A2 introduit une cadence de lecture propre à la démo et une responsabilité de
  nettoyage locale ;
- le code resterait spécifique à Demo 4 et ne fournirait pas une capacité
  Sighty réutilisable.

**Validation ciblée :** vérifier que la révision du journal ne change pas
pendant la lecture, que le changement A/B coupe immédiatement l’ancienne
source et que la remise à zéro ne conserve aucune valeur de la scène quittée.

### B — Port d’observation Sighty, sans transport par événements (non retenu)

Sighty observe la telco de la scène sélectionnée et expose une observation
éphémère limitée au slot ou à la vue active. Le nom d’API reste à choisir ; il
pourrait prendre la forme d’un abonnement de progression en lecture seule,
mais ce nom n’est pas proposé comme contrat arrêté.

Deux variantes sont à comparer :

- **B1 — callback :** Sighty appelle le consommateur lorsque la valeur observée
  change ;
- **B2 — état lisible :** Sighty maintient la dernière valeur observable et le
  consommateur la lit depuis une surface dédiée, avec une cadence de rendu
  choisie par lui.

Sighty porte ici la règle de portée : une seule source correspond à la vue
  active, son abonnement est remplacé à la sélection suivante et il est
  invalidé à la sortie. Sighty ne rend pas lui-même la barre.

**Avantages :**

- place la responsabilité de l’activité de vue au bon niveau ;
- supprime le risque de sources concurrentes après navigation ;
- réutilisable par une telco, un indicateur externe ou une autre interface ;
- conserve les messages Sighty pour les commandes discrètes.

**Limites pour cette tranche :**

- ajouterait un contrat Sighty d'observation alors que `CodPlayTelco` fournit
  déjà la source publique requise ;
- ne suffit pas si la scène ne possède aucune surface publique de projection
  pour son propre contrôle ;
- déplacerait la responsabilité de branchement sans apporter de capacité
  nécessaire à Demo 4.

**Décision :** Sighty limite l’observation à la sélection active et la scène
consommatrice relie cette valeur à la surface de présentation CodPlay déclarée
par son contrôle. Sighty ne rend pas lui-même la barre et ne crée pas une API
de progression globale.

### C — Surface CodPlay de projection d’état vivant

CodPlay fournit une surface publique et typée permettant à un composant
monté de recevoir une valeur vivante nommée, par exemple la progression. Le
composant applique cette valeur à son rendu ; Sighty ne touche ni au
DOM ni aux détails du composant.

Le principe est une projection d’état vivant, pas un événement, pas un
snapshot de journal et pas une nouvelle horloge globale. `presentation`, qui
décrit déjà une pose, ne doit pas être élargi implicitement à cette fin : la
forme exacte de la surface est définie dans
[`input-projection-spec.md`](../../codplay/specs/input-projection-spec.md).

**Avantages :**

- frontière de rendu claire : la scène et ses composants restent responsables
  de leur affichage ;
- capacité potentiellement réutilisable pour d’autres valeurs vivantes ;
- aucune recomposition ou relecture du journal ;
- Sighty ne connaît pas la structure DOM du contrôle.

**Inconvénients et décisions :**

- évolution du cœur CodPlay, réalisée dans le plan de façade et la
  spécification dédiée ;
- contrat de montage, remplacement de vue, valeur initiale, ordre des mises à
  jour et remise à zéro fixé par la surface d’input transitoire ;
- la surface reste volontairement bornée aux `input` et ne constitue pas une
  écriture générique d'état ;
- les frontières player, composant et scène sont couvertes par les tests ciblés
  et le parcours Demo 4.

**Conditions de réussite :** la surface doit être publique, typée, liée à un
composant identifié et explicitement non journalisée. Une écriture arbitraire
dans un arbre de scène ne répondrait pas à cette proposition.

### D — Extension de `capture` pour des échantillons vivants de longue durée

`RuntimeCaptureSession.track()` traite déjà des échantillons vivants sans les
ajouter au journal. Une évolution plus ambitieuse pourrait généraliser cette
sémantique à une session de flux vivant : ouverture, réception d’échantillons,
mise à jour de l’état courant, puis `end()` ou `cancel()`.

Cette proposition doit être formulée comme une extension de capture pour des
**échantillons continus**, et non comme une interface d’événements continus.
Les échantillons intermédiaires resteraient éphémères ; seule une décision
distincte pourrait éventuellement produire un fait discret à la clôture.

**Avantages :**

- réutilise une frontière déjà conçue pour le vivant et sans journal ;
- possède un cycle explicite de début, mise à jour et annulation ;
- pourrait couvrir à terme gestes, capteurs ou autres flux temporaires ;
- permet de séparer une valeur courante d’une éventuelle validation finale.

**Inconvénients et inconnues :**

- chantier le plus important et disproportionné pour une barre de progression
  seule ;
- `capture` est actuellement orienté vers une interaction capturée, pas vers
  une observation permanente d’un player ;
- il faut définir le propriétaire d’une session longue, la cadence, la
  coalescence, la pression mémoire et l’annulation au changement de vue ;
- risque de détourner un concept d’interaction pour en faire un bus de données.

**Point de passage obligatoire :** ne retenir cette option que si plusieurs
cas Sighty ont besoin d’un flux vivant avec ce cycle de vie. La progression
seule ne justifie pas encore l’évolution du cœur.

### E — Contrôle de progression appartenant au layout de la démo

Le curseur quitterait la scène telco et serait placé dans la zone de contrôle
du layout général. Il lirait l’observation de la scène active par A ou B,
mais ne demanderait aucune projection dans un composant de scène.

Cette option est une alternative d’architecture visuelle pour l’évaluation.
Elle ne doit pas être appliquée à Demo 4 sans décision explicite, car la démo
actuelle demande que la telco de scène conserve son contrôle de progression.

**Avantages :**

- frontière de rendu très simple ;
- aucun raccord vivant à injecter dans une scène CodPlay ;
- le contrôle disparaît naturellement au menu ;
- facilite un premier test de la source et de la portée active.

**Inconvénients :**

- ne valide pas la projection d’un état vivant dans une scène ;
- modifie l’organisation visuelle demandée pour Demo 4 ;
- pourrait concentrer dans le layout des contrôles qui devraient rester propres
  à la scène.

### F — Politique de lecture au rythme de présentation

Cette option ne constitue pas une nouvelle API. Elle peut compléter A, B ou C :
la source fournit une valeur courante, puis l’interface la lit au rythme de sa
présentation, par exemple avec `requestAnimationFrame`, sans produire une
émission par frame.

**Avantages :**

- découple la fréquence de la source et celle du rendu ;
- évite d’empiler des mises à jour lorsque l’interface est masquée ;
- applicable à une surface de lecture ou de projection déjà validée.

**Inconvénients :**

- ne résout pas seule la question de la propriété de la source ni celle de la
  surface cible ;
- peut masquer une mauvaise gestion de cycle de vie si la boucle n’est pas
  arrêtée à la sortie de vue ;
- ne doit pas devenir une justification pour réintroduire des événements
  périodiques.

## Approches écartées

Les variantes suivantes ne sont pas des solutions à retenir :

- émettre `progress:update` moins souvent, regrouper les valeurs ou les
  dédupliquer : la progression entrerait toujours dans le journal normal ;
- simuler la progression avec une animation CSS : l’affichage ne refléterait
  pas nécessairement la position réelle de la scène et ne traiterait pas les
  pauses, relances ou changements de vue ;
- relire, cloner ou reconstruire la scène pour obtenir la valeur : cela mélange
  progression, navigation et rendu ;
- accéder au moteur interne, aux racines matérialisées ou au DOM pour forcer
  le contrôle : ce serait une dépendance hors contrat et un contournement de la
  responsabilité de rendu.

## Ordre d’évaluation exécuté

1. **Vérifier la surface cible existante.** Le contrôle de la telco de scène a
   été déclaré comme un perso `input` et reçoit une surface de présentation
   publique limitée.
2. **Implémenter A1 avec la projection dédiée.** La telco publique fournit la
   source ; aucune révision de journal ni émission normale n'est produite et
   l'observation est arrêtée à la sortie de vue.
3. **Conserver C bornée aux inputs.** La surface CodPlay ne devient pas une
   écriture générique d'état : elle projette une valeur d'input explicitement
   ciblée.
4. **Ne pas ouvrir F.** La source pousse déjà les échantillons et aucune boucle
   de présentation supplémentaire n'est nécessaire.
5. **Reporter D.** Aucun autre cas réel ne justifie encore une extension de
   `capture` pour une session longue.
6. **Écarter E pour Demo 4.** Le contrôle reste dans la telco de scène comme
   demandé par la référence visuelle.

## Acceptance minimale commune

La solution retenue démontre :

- aucune trace `progress:*` dans le journal des événements normaux ;
- aucune modification de révision du journal provoquée par la progression ;
- une seule source observée pour la vue active ;
- arrêt immédiat de l’ancienne observation lors de menu, chapitre, précédent,
  suivant et relance ;
- comportement correct après plusieurs parcours `menu → A → B → C → menu → A` ;
- remise à zéro du contrôle lorsque la scène telco est réinitialisée ;
- absence de dépendance à une racine DOM ou à une API interne ;
- tests séparés de la source, du cycle de vie Sighty et de la projection de
  rendu.

## Validation exécutée

- tests ciblés de projection et Demo 4 : 2 fichiers, 11 tests passés ;
- suite complète CodPlay : 104 fichiers, 645 tests passés ;
- suite Sighty : 3 fichiers, 26 tests passés ;
- typechecks CodPlay, Sighty et démos : succès ;
- build Vite des démos : succès ;
- Safari MCP sur une instance fraîche : le progress avance pendant Play,
  reste stable après Pause, reprend après Play et atteint 10 000 ms à la fin de
  la scène ; aucune erreur applicative dans la console.

## Tableau de décision

| Proposition | Portée | Journal | Réutilisation | Statut |
| --- | --- | --- | --- | --- |
| A1 — observation directe telco | Demo / faible | préservé | faible | Retenue |
| B — observation Sighty | Sighty / moyenne | préservé | moyenne à forte | Non retenue : la telco publique suffit |
| C — projection CodPlay | CodPlay + Sighty / forte | préservé | forte | Retenue, bornée aux `input` |
| D — extension `capture` | CodPlay + Sighty / très forte | préservé si bien borné | potentiellement forte | Reportée |
| E — contrôle dans le layout | Demo / faible | préservé | faible | Écartée pour Demo 4 |
| F — lecture au rythme de présentation | Complément | préservé | transversale | Non nécessaire |

La décision et l’évolution de contrat ont été inscrites dans ce plan avant
l’implémentation. Les alternatives B, D, E et F restent disponibles comme
études ultérieures, mais ne font pas partie de cette tranche.
