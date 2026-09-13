# Sighty — plan de correction de la navigation et du cycle de vie

## Statut

**A relire — aucune implémentation de cette correction n'est autorisée avant
validation du plan.**

Ce plan corrige les défauts observés lors des parcours répétés de Demo 4 :
événements d'une scène sortie de la vue, messages envoyés pendant un changement
de vue, désactivation progressive des contrôles et conservation indue de l'état
de la scène telco.

Il met en œuvre des responsabilités déjà posées pour Sighty. Il n'introduit
pas un nouveau modèle d'événements, ne modifie pas le vocabulaire du scénario
et ne fait pas de Demo 4 une seconde implémentation du runtime.

Références de conception :

- [`2026-08-17-modele-fichier-declaratif.md`](../notes/2026-08-17-modele-fichier-declaratif.md) ;
- [`2026-08-01-composition-et-avancement-evenementiel.md`](../notes/2026-08-01-composition-et-avancement-evenementiel.md) ;
- [`authoring-library-spec.md`](../specs/authoring-library-spec.md) ;
- [`2026-09-13-sighty-navigation-plan.md`](./2026-09-13-sighty-navigation-plan.md).

La progression de lecture est explicitement hors de ce plan. Elle fait l'objet
d'une [évaluation séparée](./2026-09-13-sighty-progress-evaluation-plan.md),
avec une solution d'observation ou de projection qui ne passera jamais par des
événements périodiques.

## 1. Constat à corriger

La tranche actuelle possède déjà une sélection par slot et une chaîne qui
sérialise `runtime.dispatch()`. Les défauts se situent aux frontières que cette
chaîne ne couvre pas encore :

- les écouteurs d'événements publics sont installés pour toute la durée de vie
  des scènes, même lorsqu'elles ne sont plus dans la vue active ;
- la réception d'un événement ne vérifie pas l'appartenance de sa source à la
  composition active ;
- un événement accepté avant un changement de vue peut encore être exécuté
  après ce changement ;
- `send` atteint directement une scène CodPlay sans passer par la même
  séquence que la navigation ;
- le démontage d'un slot retire le montage mais ne choisit pas le devenir de la
  scène et de son état ;
- Demo 4 contient donc des gardes locaux qui compensent ces absences au lieu de
  s'appuyer sur Sighty ;
- les logs exposent les changements de scène et les erreurs, mais pas la
  décision Sighty d'accepter, d'ignorer ou d'annuler une livraison.

Le contrôle du statut `playing` ne doit pas remplacer ce mécanisme : une scène
présente peut être en pause et recevoir une action discrète. La frontière est
la composition active, pas l'état de lecture.

## 2. Invariants à obtenir

1. Sighty est l'autorité unique de l'appartenance à la vue active.
2. Un événement produit par une scène qui n'est plus dans la vue active est
   ignoré avant d'entrer dans le parcours.
3. Une livraison en attente qui devient obsolète lors d'un changement de vue
   ne peut pas modifier la nouvelle vue.
4. Les messages émis par Sighty et ses actions empruntent un seul ordre de
   livraison, partagé avec la navigation.
5. Un message destiné à une scène absente de la composition active n'est pas
   émis vers cette scène.
6. Le changement de vue expose une composition cohérente : l'ancienne vue est
   invalidée avant que la nouvelle ne soit autorisée à recevoir des messages.
7. La sortie de `chapter` remet la scène telco dans un état neuf pour sa
   prochaine entrée. Le passage A → B → C ne réinitialise pas la telco qui
   reste attachée au chapitre.
8. Sighty ne crée aucun markup et ne décide aucune présentation visuelle.
9. Demo 4 ne possède ni garde d'appartenance à la vue, ni canal de messages
   parallèle au runtime Sighty.

## 3. Tranches de correction

### 3.1. Modèle interne de composition active

Ajouter au runtime Sighty une représentation unique de la composition active,
à partir des sélections déjà maintenues par les slots.

Cette représentation doit permettre de répondre génériquement à deux
questions :

- la scène source appartient-elle à la vue active ?
- la scène cible peut-elle encore recevoir un message ?

Le layout configuré reste toujours le point d'accueil actif. Les autres scènes
ne sont admissibles que lorsqu'elles sont sélectionnées dans un slot de la
composition courante.

**Preuve attendue :** aucune décision ne dépend d'un nom de slot particulier
comme `slot-telco`.

### 3.2. Invalidation d'une vue devenue obsolète

Associer aux changements de composition une génération interne de vue, inconnue
du fichier auteur.

À chaque changement effectif de composition :

1. Sighty invalide la génération précédente ;
2. il suspend les scènes qui sortent ;
3. il retire les montages devenus inactifs ;
4. il établit la nouvelle composition ;
5. il autorise seulement cette génération à recevoir des messages.

Toute réception ou livraison différée doit vérifier sa génération au moment de
son exécution. Une livraison obsolète est abandonnée et ne doit pas être
rejouée plus tard.

Cette génération est un mécanisme interne de fiabilité. Elle ne devient ni une
propriété du scénario, ni une donnée d'auteur.

### 3.3. Réception des événements publics

Conserver le raccordement CodPlay existant, mais faire de Sighty la frontière
d'admission :

- vérifier la composition active dès la réception ;
- vérifier à nouveau la génération avant l'exécution si la navigation est déjà
  occupée ;
- ne pas faire intervenir un test de statut `playing` pour décider de
  l'appartenance à la vue ;
- ne pas laisser une source inactive participer au choix d'une action héritée.

Le filtrage doit être réalisé dans le runtime Sighty, près de
`receivePublicEvent()` et de la résolution des actions. Demo 4 ne doit plus
porter ce contrôle.

### 3.4. Canal unique des messages sortants

Introduire dans la surface runtime une opération générique de message, utilisée
par :

- les handlers du catalogue d'actions ;
- les fonctions de pilotage propres à une composition ;
- les messages adressés à la scène layout ou à une scène actuellement
  sélectionnée.

Cette opération doit être ordonnée avec la navigation et appliquer la même
vérification de génération et de cible active. Le handler d'action conserve sa
responsabilité de relier des actions écrites ailleurs ; il ne devient pas un
routeur ni un gestionnaire de cycle de vie.

**Preuve attendue :** aucune émission directe depuis Demo 4 ne peut atteindre
une scène retirée ou contourner l'ordre d'une navigation en cours.

### 3.5. Cycle de vie à la sortie d'une vue

Séparer explicitement trois opérations déjà distinctes dans les responsabilités
de Sighty :

- suspendre une scène conservée pour une vue ultérieure ;
- remettre une scène à son état initial sans conserver ses faits de session ;
- détruire et libérer une scène dont Sighty abandonne la propriété.

Pour Demo 4, la règle de la scène telco est :

```text
chapter → menu : suspendre, détacher, remettre à zéro pour la prochaine entrée
menu → chapter : monter, initialiser et démarrer une telco neuve
```

Le sens précis de « remettre à zéro » doit couvrir l'état de lecture, les
événements publics déjà observés et les travaux différés. `rewind()` seul ne
constitue pas cette opération.

Si la surface publique CodPlay ne permet pas cette remise à zéro ciblée, la
tranche s'arrête à cette frontière et le besoin est remonté dans un plan
CodPlay explicite. Aucun contournement dans Demo 4 n'est accepté.

### 3.6. Suppression des compensations Demo 4

Après les tranches précédentes :

- supprimer `isSceneTelcoMounted()` et tous ses appels ;
- supprimer les décisions d'acceptation fondées sur la présence de la telco
  dans la composition depuis la démo ;
- faire passer les messages discrets par le runtime Sighty ;
- conserver dans la démo uniquement les actions spécifiques de présentation et
  de pilotage qui ne sont pas génériques ;
- ne pas modifier la progression dans cette tranche.

### 3.7. Diagnostics Sighty

Ajouter une observation structurée, distincte des traces CodPlay, pour chaque
livraison pertinente :

- source ;
- vue ou composition active ;
- génération ;
- nom de l'événement ou du message ;
- cible ;
- décision : accepté, ignoré ou annulé ;
- raison de la décision.

Les diagnostics doivent rester désactivables en diffusion et ne doivent pas
devenir un nouveau circuit de commande.

## 4. Validation

### Tests unitaires et runtime Sighty

- une scène active peut publier un événement et déclencher sa route ;
- une scène retirée ne déclenche aucune route ;
- un événement reçu avant un changement de vue mais exécuté après celui-ci est
  annulé ;
- un message vers une scène retirée n'est pas émis ;
- les messages layout restent ordonnés avec le changement de vue ;
- la sortie du chapitre applique la remise à zéro prévue de la telco ;
- le retour au chapitre ne rejoue aucun fait de la visite précédente ;
- une scène en pause mais toujours active reste pilotable.

### Régression Demo 4

Rejouer plusieurs fois, avec des délais contrôlés :

```text
menu → A → B → C → menu
menu → A → suivant
menu → B → précédent
menu → C → suivant
menu → A → pause / lecture / retour au début
```

Vérifier uniquement dans ce plan :

- la scène active reçoit les commandes ;
- une ancienne scène ne modifie plus la vue ;
- les boutons de navigation conservent leur état cohérent ;
- aucune commande tardive ne réapparaît après une nouvelle entrée dans le
  chapitre ;
- la transition layout reçoit ses messages dans l'ordre.

La progression n'est pas un critère de validation ici. Elle sera testée dans
un plan séparé, sans émission d'événements périodiques.

### Diagnostics

Le parcours de régression doit permettre de lire dans les diagnostics :

- l'entrée et la sortie de chaque composition ;
- les événements rejetés parce que leur source n'est plus active ;
- les messages annulés par changement de génération ;
- la remise à zéro de la telco au retour au menu.

## 5. Gates

- **Gate de conception :** ce plan est `A relire` jusqu'à validation explicite.
- **Gate de responsabilité :** aucune garde spécifique à Demo 4 ne remplace le
  contrôle Sighty.
- **Gate de cycle de vie :** `rewind()` ne peut pas être présenté comme une
  remise à zéro complète.
- **Gate de progression :** aucune modification de cette capacité dans ce
  plan ; aucune émission périodique n'est une solution acceptable.
- **Gate CodPlay :** toute extension nécessaire de la surface CodPlay doit
  faire l'objet d'une autorisation et d'un plan séparés avant modification du
  package CodPlay.
- **Gate d'intégration :** les tests doivent utiliser le parcours public
  Sighty et les vrais players de la fixture ; aucun routeur de substitution ne
  peut rendre la démo passante.

## 6. État de suivi

| Tranche | État |
| --- | --- |
| composition active | Non commencée |
| invalidation de génération | Non commencée |
| réception des événements publics | Non commencée |
| canal unique des messages | Non commencée |
| cycle de vie et remise à zéro telco | Non commencée |
| retrait des gardes Demo 4 | Non commencée |
| diagnostics Sighty | Non commencée |
| validation runtime et Demo 4 | Non commencée |
| progression | Hors périmètre |
