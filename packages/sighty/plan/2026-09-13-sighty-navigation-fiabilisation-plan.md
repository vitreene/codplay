# Sighty — reconstruction du code de navigation

## Statut

**A relire — modèle interne à valider avant toute implémentation.**

Ce plan concerne la reconstruction du code qui exécute la navigation Sighty.
Il ne propose pas un nouveau format de scénario et ne transforme pas Demo 4
en solution de remplacement. Le scénario existant est l'entrée ; le runtime
doit en déduire une composition active, piloter les scènes et isoler leur
cycle de vie.

Le progress est exclu. Il reste traité dans le
[plan dédié](./2026-09-13-sighty-progress-evaluation-plan.md) et ne doit pas
être réintroduit dans le canal d'événements de navigation.

## Objet du plan

À partir du scénario déjà défini et validé par `scenario`, Sighty doit fournir
un exécuteur de navigation qui :

- démarre la vue de départ déjà déclarée ;
- résout les vues récursives, les slots, les actions et les directions sans
  recalcul dispersé dans plusieurs méthodes ;
- maintient un état unique de la composition réellement active ;
- pilote l'entrée, la conservation, la sortie, la remise à zéro et la
  destruction des scènes ;
- admet les événements discrets uniquement lorsqu'ils proviennent encore de la
  composition active ;
- applique les actions prévues dans le scénario et transmet à la scène hôte ce
  qui concerne le rendu de son slot ;
- prépare et libère les ressources au moment défini par le runtime, sans faire
  du chemin d'un fichier une donnée de navigation ;
- expose une erreur exploitable lorsque la résolution ou l'acquisition échoue.

Sighty décide quelle scène est disponible et quelle scène doit être pilotée.
La scène hôte et les scènes reçues décident de leur rendu dans leurs propres
`actions`. Sighty ne crée pas de markup.

## Problématiques à résoudre

| Problème observé | Ce que la reconstruction doit garantir |
| --- | --- |
| Après `menu → A → B → C → menu → A`, des réactions de scènes sorties semblent encore atteindre la telco. | Une source sortie est désabonnée, invalidée et ne peut plus être admise par la navigation. |
| Les contrôles deviennent parfois inactifs après plusieurs remontées et réentrées. | Une seule composition publiée est active ; aucune ancienne sélection ne reste dans le routage. |
| La livraison d'un événement peut chevaucher un changement de vue. | Toute demande porte une identité de source et une révision contrôlées avant exécution. |
| `dispatch` est sérialisé, mais `send` émet directement vers une instance. | Toute émission pilotée par une action passe par le même point d'admission et le même ordre. |
| Le démontage, la conservation, `rewind()` et la destruction sont actuellement mêlés. | Chaque étape du cycle de vie possède une opération et une garantie distinctes. |
| Le runtime prépare actuellement toutes les scènes au démarrage. | La résolution d'une scène et l'acquisition de ses ressources sont séparées et peuvent devenir lazy. |
| Le progress a mis en évidence une surcharge, mais son traitement n'est pas décidé. | Aucun événement continu n'est ajouté à ce plan. |
| `guards`, `meta`, `data`, `context`, `state` et sauvegarde restent à raccorder. | Ils sont ajoutés par des tranches ultérieures dans la même machine, sans circuit propre à une démo. |

## 1. Contrat d'entrée : le format existant reste inchangé

Le runtime consomme les contrats déjà définis dans
[`authoring-library-spec.md`](../specs/authoring-library-spec.md) et exposés par
`Sighty` :

- `scenario.getViewGraph()` fournit la structure récursive normalisée déjà
  portée par `SightyFile.views` ;
- `ViewList` conserve l'ordre déclaré et les identifiants stables ;
- `ViewMap` conserve ses clés et son départ déclaré ;
- `view.views`, `view.slots`, `view.scene`, `actions` et les cibles de route
  sont lus tels qu'ils existent ;
- les directions `next` et `previous` suivent l'ordre des listes ; à une borne,
  la résolution remonte selon le mécanisme hiérarchique déjà décrit dans les
  notes ;
- `scenario.validate()` reste le contrôle auteur préalable à l'exécution.

Ces éléments ne sont pas redéfinis ici. Le plan n'ajoute ni propriété de
fichier, ni nouvelle forme de `views`, ni champ de source de scène. Un chemin
de fichier relève du preload ou de l'acquisition d'une ressource, pas de la
destination d'une vue. Le support futur d'une factory, d'un objet ou d'un
fetch devra donc être traité dans la surface d'acquisition du runtime et son
contrat propre, sans être encodé dans le scénario.

## 2. Ce que montre le code actuel

L'analyse de `packages/sighty/src/runtime.ts` fournit les frontières à
reconstruire :

| Code actuel | Limite pour la navigation cible |
| --- | --- |
| `selections`, `mounts` et `mountedChildren` indexés par seul nom de slot | Deux slots homonymes dans des branches différentes ne disposent pas d'une identité suffisante. |
| `observeInstance()` installé pour toute la durée du runtime | Une instance sortie reste une source observée jusqu'à la destruction générale. |
| `navigationChain` autour de `dispatch` | La sérialisation existe, mais elle ne suffit pas à invalider une demande déjà admise. |
| `executeAction().send()` appelant directement `instance.events.emit()` | Ce chemin contourne l'admission de la composition active. |
| `synchronizeComposition()` modifiant progressivement les maps et les montages | Une erreur au milieu peut laisser une sélection partielle. |
| `rewind()` puis `play()` pour une entrée | Rien ne démontre encore que cette séquence constitue une session neuve. |
| compilation et preload de toutes les scènes dans `initialize()` | La disponibilité de toutes les scènes est imposée avant la navigation. |
| `destroy()` comme principal nettoyage | Il manque un nettoyage normal à la sortie d'une branche. |
| résolution des candidats en parcourant toutes les sélections | La source et la portée active ne sont pas représentées par un contexte unique. |

Ces limites sont des constats de conception, pas des comportements à masquer
dans Demo 4. La reconstruction ne prendra pas le découpage actuel comme
ossature si une garantie exige une autre séparation.

## 3. Modèle interne retenu

Les éléments suivants sont des structures privées d'implémentation. Ils ne
sont pas des props de `SightyFile`, ne sont pas sérialisés et ne constituent
pas une nouvelle API auteur.

### 3.1. Index de navigation

Un index est construit une fois à partir du résultat de
`scenario.getViewGraph()` après validation. Il conserve :

- l'adresse interne de chaque vue ;
- son parent et le conteneur qui la porte ;
- l'ordre des entrées d'une `ViewList` ;
- le départ et les clés d'une `ViewMap` ;
- le propriétaire et le nom de chaque slot ;
- les portées d'actions utiles à la recherche hiérarchique.

Cet index ne contient ni `CodPlayInstance`, ni montage, ni DOM, ni historique
d'événements. Sa seule responsabilité est de rendre la structure existante
adressable et déterministe.

### 3.2. État actif

L'état interne publié par la machine contient :

- la phase (`non initialisée`, `prête`, `en changement`, `en erreur` ou
  `détruite`) ;
- une révision monotone de composition ;
- le point de vue actif ;
- la liste complète des sélections de slots actifs ;
- l'erreur courante, lorsqu'il y en a une.

Chaque sélection active porte l'adresse de son slot propriétaire, l'adresse de
la vue choisie et sa `SceneKey`. Le nom du slot seul n'est donc pas une clé
suffisante pour le runtime.

### 3.3. Liaisons actives

La liaison entre une scène et le routage est distincte de son montage physique.
Elle porte :

- une identité interne de liaison ;
- la révision qui l'a ouverte ;
- la `SceneKey` source ;
- la fonction de désabonnement de l'observation publique ;
- la référence physique nécessaire à l'exécuteur pour détacher ou libérer.

À la sortie, la liaison est invalidée avant le détachement. Une représentation
physique conservée pour une transition ne reste donc pas une source de
navigation.

### 3.4. Opération de navigation

Une opération éphémère contient l'entrée discrète, le contexte de résolution,
la composition cible et la différence entre composition courante et cible :

- sélections conservées ;
- sélections entrantes ;
- sélections sortantes ;
- remplacements de slots.

Elle contient aussi les actions déjà résolues à exécuter. Elle ne contient pas
de destination recalculée pendant l'exécution et ne devient jamais un journal
à rejouer.

### 3.5. Registre d'acquisition

La résolution de `SceneKey` et l'acquisition de la ressource restent deux
étapes distinctes. Un registre interne pourra suivre, pour chaque scène :

```text
clé de scène → source fournie au runtime → document résolu → build CodPlay
→ ressource acquise → occurrence montée
```

Cette chaîne décrit l'exécution interne. Elle ne change pas la structure du
scénario et ne décide pas de la destination d'une route.

## 4. Machine de navigation

Le modèle retenu est une petite machine hiérarchique interne, sans dépendance
obligatoire à une bibliothèque externe. Elle sépare trois responsabilités :

1. **résolveur pur** : lit l'état actif, l'entrée et le scénario ; trouve
   l'action, la destination, l'ordre de liste et la remontée hiérarchique ;
2. **coordinateur d'opération** : sérialise les demandes, attribue une
   révision et refuse les sources obsolètes ;
3. **exécuteur d'effets** : acquiert, monte, pilote, notifie, détache et
   libère via les surfaces autorisées.

Les états et passages internes sont :

```text
non initialisée → prête → en changement → prête
                                  ↘ en erreur
prête → détruite
```

Pour une demande discrète :

1. vérifier que la source est externe ou appartient à la composition publiée ;
2. résoudre l'action et sa destination contre l'index immuable ;
3. préparer la composition cible sans modifier l'état publié ;
4. appliquer les guards et résolutions de données lorsqu'ils seront raccordés ;
5. invalider les liaisons sortantes avant tout détachement ;
6. appliquer le montage et les actions de la scène hôte ;
7. publier la composition complète en une seule étape ;
8. ouvrir les nouvelles liaisons et piloter les scènes entrantes selon leur
   cycle de vie ;
9. terminer l'opération ou atteindre une erreur explicite.

Une demande arrivée d'une liaison dont la révision n'est plus active est
abandonnée. Elle n'est ni stockée, ni rejouée après la transition. Les demandes
externes peuvent être sérialisées ; les événements d'une scène quittée ne
doivent pas devenir une file de rattrapage.

Si la préparation échoue, l'état publié reste cohérent : soit l'ancienne
composition est conservée, soit une voie d'erreur déclarée est activée. Il ne
doit pas exister d'état intermédiaire où une partie des slots appartient à
l'ancienne vue et l'autre à la nouvelle.

## 5. Isolation et cycle de vie

### 5.1. Admission des événements

L'observation CodPlay doit être liée aux liaisons actives, et non à la durée de
vie globale du runtime. Sighty doit :

- ouvrir l'observation à l'activation d'une sélection ;
- vérifier la liaison et sa révision à la réception ;
- vérifier à nouveau cette identité avant l'exécution différée ;
- fermer l'observation et invalider la révision à la sortie ;
- faire passer le `send` fourni aux actions par le même point d'admission.

La télémétrie de diagnostic peut rester séparée du routage. Elle ne doit pas
réactiver une scène ni alimenter une relecture d'événements.

### 5.2. Opérations distinctes

Le runtime doit distinguer explicitement :

- **entrée** : rendre une sélection active et ouvrir sa liaison ;
- **conservation** : garder une sélection appartenant encore à la branche
  active ;
- **sortie** : invalider, désabonner et détacher ;
- **remise à zéro** : obtenir une session initiale selon une garantie réelle de
  CodPlay ;
- **destruction** : supprimer l'occurrence et libérer ses ressources.

Pour le scénario de Demo 4, ces règles donnent le comportement attendu sans
code spécial de démo :

```text
menu → chapitre : la telco du chapitre est créée et activée immédiatement
A → B → C       : la telco du chapitre est conservée
chapitre → menu : les liaisons du chapitre sont fermées et la session est remise à zéro
menu → chapitre : une nouvelle composition du chapitre est publiée
```

`rewind()` ne sera pas considéré comme une remise à zéro complète tant que la
surface CodPlay ne garantit pas l'absence d'état et de livraisons différées.

### 5.3. Navigation aux bornes

La machine ne recopie pas un parcours propre à Demo 4. Elle applique le
comportement déjà décrit : `next` et `previous` utilisent l'ordre de la liste ;
à une borne, la résolution recherche une action dans le niveau parent. Ainsi,
un chapitre peut remonter au sommaire ou à un autre niveau sans que le bouton
connaisse cette destination.

## 6. Acquisition et mémoire

Le code de navigation ne doit pas confondre trois décisions :

1. quelle `SceneKey` le scénario demande ;
2. comment le runtime obtient le document correspondant ;
3. quand CodPlay acquiert, conserve ou libère ses ressources.

La première est de la navigation. Les deux autres sont des services
d'exécution raccordés à la navigation, sans chemin de fichier dans le
scénario. Le catalogue actuellement fourni avec des `SceneDoc` déjà résolus
reste le point de départ mesurable ; factory, acquisition distante, preload
sélectif, annulation et éviction sont des extensions à concevoir à partir de
la surface réelle de CodPlay.

Une ressource partagée doit être libérée seulement lorsqu'aucune sélection
active ni préparation autorisée ne la réclame. Une préparation abandonnée ne
doit pas publier son résultat dans une composition plus récente.

## 7. Compléments prévus après le noyau

Ces sujets ne sont pas reconstitués dans Demo 4. Ils s'insèrent dans les
points d'extension de la même machine :

- **guards** : lecture avant la composition cible ; décision d'autoriser, de
  refuser ou d'atteindre l'erreur ;
- **meta** : données descriptives calculées pour la composition active ;
- **data** : résolution des données d'entrée d'une scène selon le contrat déjà
  prévu par les notes ;
- **context** : données durables modifiées uniquement par une action autorisée ;
- **state** : position et composition d'exécution, séparées du context ;
- **sauvegarde/restauration** : projection sérialisable de ces deux états, sans
  player, abonnement, montage ou ressource physique ;
- **erreur de navigation** : diagnostic auteur et vue d'erreur déclarée,
  permettant une relance sans conserver une sélection incohérente.

Les règles détaillées de ces compléments devront être validées dans leurs
tranches propres avant leur ajout au résolveur.

## 8. Évolutions CodPlay à évaluer

Sighty doit d'abord tester les garanties de la surface publique actuelle. Une
modification de `packages/codplay` est séparée de ce plan et nécessite une
autorisation explicite.

| Question issue du code | Évolution CodPlay seulement si le test la rend nécessaire |
| --- | --- |
| Le désabonnement `events.onEvent()` suffit-il à neutraliser une livraison déjà engagée ? | Une invalidation publique d'une occurrence ou de ses sorties. |
| `rewind()` garantit-il une session vierge ? | Une opération publique de reset complète, ou une séquence de destruction/recréation documentée. |
| Montage, remplacement et détachement peuvent-ils être appliqués sans état partiel ? | Une frontière atomique de montage si les surfaces existantes ne suffisent pas. |
| Build et preload peuvent-ils être annulés et libérés séparément ? | Une acquisition cancellable et un comptage de ressources. |
| Les diagnostics permettent-ils de distinguer une livraison tardive d'une erreur de route ? | Des traces de cycle de vie plus précises, sans journal de replay. |

Le progress n'est pas une évolution à déduire ici. Il reste hors de ce plan.

## 9. Construction et validation

Aucune tranche de code ne démarre tant que ce modèle n'est pas relu et
accepté.

### N0 — preuve du contrat existant

Écrire les cas de résolution à partir du scénario existant : départ, liste,
borne, remontée, slots récursifs et actions. Aucun nouveau champ de fichier.

### N1 — résolveur et index internes

Construire l'index à partir de `getViewGraph()`, puis tester la résolution pure
des routes et de la composition cible.

### N2 — état actif et machine

Introduire le snapshot de composition, les révisions, la sérialisation des
opérations et la décision atomique, sans CodPlay ni DOM dans le résolveur.

### N3 — exécuteur et isolation

Raccorder les liaisons actives, l'invalidation, le port des actions, le
montage, le détachement et la publication d'une composition complète.

### N4 — cycle de vie et acquisition

Éprouver entrée, conservation, sortie, reset, destruction, résolution lazy,
annulation, release et erreurs partielles contre les surfaces CodPlay
existantes. Ouvrir un plan CodPlay séparé si une garantie manque.

### N5 — compléments du scénario

Ajouter guards, meta, data, context, state, sauvegarde et erreur selon leurs
contrats validés, sans les simuler localement dans une démo.

### N6 — fixture Demo 4

Utiliser Demo 4 uniquement pour l'acceptation du parcours réel, avec ses vrais
players, ses actions et son rendu. La démo ne doit pas porter de routeur, de
registre de sources, de garde de montage ou de nettoyage parallèle.

## 10. Critères d'acceptation

### Résolution pure

- le scénario existant est la seule entrée de structure ;
- l'ordre des listes et les identifiants existants sont respectés ;
- `next` depuis la dernière entrée et `previous` depuis la première remontent
  au niveau parent quand une action y est déclarée ;
- une vue inconnue produit une erreur explicite sans sélection partielle ;
- deux slots homonymes de branches différentes restent isolés.

### Intégration Sighty/CodPlay

- `menu → A → B → C → menu → A`, répété, conserve une réactivité constante ;
- les événements d'une scène sortie et les demandes différées obsolètes sont
  ignorés ;
- `send` ne contourne jamais l'admission Sighty ;
- la telco est disponible immédiatement à l'entrée du chapitre ;
- la telco est conservée dans le chapitre et remise à zéro à sa sortie ;
- aucune sélection, observation ou montage ne s'accumule après les réentrées ;
- un échec de préparation ne publie pas une composition mixte.

### Validation navigateur

Rejouer les parcours avec les vrais players dans la démo, les clics rapprochés,
les sorties et réentrées, puis vérifier Safari. Les diagnostics doivent
distinguer au minimum source inactive, demande obsolète, route inconnue,
échec d'acquisition et échec de reset.

Le progress est exclu de ces critères.

## 11. Suivi

| Tranche | Statut |
| --- | --- |
| N0 — contrat et cas d'acceptation | À relire |
| N1 — index et résolveur | Bloquée |
| N2 — état et machine | Bloquée |
| N3 — exécution et isolation | Bloquée |
| N4 — cycle de vie et acquisition | Bloquée |
| N5 — guards, meta, data, context, state et erreur | Bloquée |
| N6 — validation Demo 4 | Bloquée |
| progress | Hors périmètre |
