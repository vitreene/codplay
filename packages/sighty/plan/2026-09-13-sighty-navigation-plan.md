# Sighty — plan principal de navigation, préchargement et cycle de vie

## Statut

**En cours — implémentation autorisée de la tranche navigation.**

Ce plan met en œuvre et éprouve la base de conception de la note
[`2026-08-17-modele-fichier-declaratif.md`](../notes/2026-08-17-modele-fichier-declaratif.md).
La démo 4 est seulement une fixture d'acceptation. Elle ne définit pas le
modèle de parcours, la navigation, le préchargement ni la politique de
ressources.

Les contrats exécutables déjà retenus sont décrits dans
[`authoring-library-spec.md`](../specs/authoring-library-spec.md). Les
ressources CodPlay sont encadrées par
[`2026-08-30-sighty-scene-resource-lifecycle.md`](../../codplay/plan/notes/2026-08-30-sighty-scene-resource-lifecycle.md)
et [`media-preload-plan.md`](../../codplay/plan/media-preload-plan.md).

Les documents antérieurs utilisent parfois `ViewGraph` pour nommer la
structure interne. Dans le fichier auteur cible, la structure se nomme
`Views` et se répète récursivement ; aucune propriété auteur `graph` n'est
retenue. Cette forme est maintenant raccordée à la première tranche exécutable
du runtime ; ses extensions restent soumises aux gates indiqués plus bas.

Les corrections visuelles, traitées en premier, sont suivies séparément dans
[`2026-09-13-demo4-visual-plan.md`](./2026-09-13-demo4-visual-plan.md).

Les corrections de fiabilité de la navigation, du filtrage des scènes actives
et du cycle de vie sont suivies dans
[`2026-09-13-sighty-navigation-fiabilisation-plan.md`](./2026-09-13-sighty-navigation-fiabilisation-plan.md).

## 1. Objet principal

Construire dans Sighty le mécanisme générique qui permet à un scénario
déclaratif de :

1. décrire une structure récursive de vues qui réclame des scènes du
   catalogue ;
2. recevoir un fait ou une intention sous forme d'événement ;
3. résoudre l'action et la destination déclarées ;
4. changer la sélection d'un slot ;
5. conduire le cycle de vie de l'occurrence concernée ;
6. gérer le préchargement et la libération selon la propriété réelle des
   ressources.

La démo 4 doit uniquement fournir un scénario lisible, des scènes et les
features de présentation nécessaires pour observer ce mécanisme. Son layout
de page est extérieur au scénario. Il ne doit pas être confondu avec le
dispositif de montage de la vue, décrit par les slots du scénario et raccordé
par Sighty/CodPlay.

## 2. Concepts à implémenter et à éprouver

| Concept | Rôle Sighty | Cas de preuve Demo 4 |
| --- | --- | --- |
| scénario | fichier sérialisable contenant les `Views`, routes et références d'actions | `sighty-file.ts` décrit tout le parcours, sans source de chargement |
| `resources` | aucune forme de ressources de scènes n'est portée par cette tranche du scénario ; les données seront traitées séparément | aucun `resources.scenes` ne réintroduit des sources ou des chemins dans Demo 4 |
| catalogue de scènes | registre interne de sources disponibles, distinct du scénario et alimenté par l'application | les sept scènes, dont la scène d'erreur, sont déclarées une fois sous une `SceneKey` typée |
| `SceneKey` | clé unique attribuée à une source lors de sa déclaration ; seule référence de scène admise par le scénario | TypeScript refuse une clé absente du catalogue Demo 4 |
| `SceneDoc.id` | identité technique du document CodPlay obtenu après résolution d'une source | elle est validée comme identité du document, sans devenir une route de scénario |
| `SceneDoc.name` | libellé descriptif facultatif du document CodPlay | secours provisoire du menu Demo 4 ; ni clé de catalogue ni identité de navigation |
| `View` | nœud logique du parcours, distinct de la scène matérielle | menu, chapitre, A, B et C sont des vues identifiées |
| `Views` | structure récursive de vues, présente à la racine, dans une vue et dans un slot | le chapitre est une `ViewList` : A, B et C y sont déclarées dans leur ordre de parcours |
| `ViewId` | identité stable d'une vue dans un `ViewMap` ou une `ViewList` ; `start` et les chemins le désignent | `view-main` est la vue de départ, distincte de la `SceneKey` `scene-layout` qu'elle porte |
| `slot` | perso de rendu déclaré par une story du layout | la scène hôte reçoit l'action qui désigne l'enfant et le remplacement demandé ; CodPlay attache les racines |
| événement | fait ou intention sans destination calculée par l'émetteur | menu, `previous`, `next` et `sequence:end` suivent le même circuit |
| macro | référence nommée vers une séquence d'actions et d'événements définie dans le catalogue d'actions | les passages menu → chapitre, changement de scène et retour au menu réemploient des macros |
| action | référence de macro et/ou route déclarée | les chemins et directions sont dans le fichier auteur ; le corps des actions reste hors du scénario |
| cible d'erreur | vue déclarée atteinte lorsqu'une navigation ne peut pas être résolue | une route invalide affiche une scène d'erreur avec une relance du scénario |
| sélection | vue actuellement active dans un slot | Sighty la conserve et la publie par observation |
| transition de slot | rendu déclaré par l'action reçue par la scène hôte | le perso `slot` reçoit l'enfant et l'effet `replace` demandé |
| occurrence | instance CodPlay correspondant à une scène | chaque scène conserve son player et son état propres |
| preload | préparation des ressources avant materialization | les manifestes sont fournis au service CodPlay unique |
| release | fin explicite de la propriété de ressources | le démontage libère seulement ce que l'occurrence possède |

Les notions `guards`, `data`, `meta`, `context`, `state` et sauvegarde sont
hors de la tranche de navigation en cours. Elles ne doivent pas être
reconstituées dans Demo 4 ; elles constituent la tranche Sighty immédiatement
suivante après l'implémentation et la validation de cette navigation.

## 3. Responsabilités

### Sighty

Sighty est l'unique point d'entrée. Une instance expose les surfaces
`scenario` pour les données d'auteur et `runtime` pour l'exécution. Le runtime :

- normalise et valide les `Views` ;
- construit son catalogue interne à partir des sources déclarées par
  l'application, sans les charger toutes ;
- vérifie les `SceneKey` du scénario contre ce catalogue ;
- compile une scène et prépare son manifeste lorsqu'elle est obtenue ;
- obtient une scène à la demande lorsqu'une vue la sélectionne ; le preload
  appelle cette même source plus tôt lorsqu'une politique le demande ;
- coordonne le preload sans créer de second loader ;
- crée les occurrences nécessaires, les met à disposition de la scène hôte et
  pilote leur cycle de vie ;
- reçoit les événements publics CodPlay et les événements extérieurs ;
- résout actions, routes et directions dans les portées des `Views` ;
- publie un diagnostic structuré et atteint la cible d'erreur déclarée lorsqu'une
  navigation ne peut pas être résolue ;
- conserve la sélection active par slot ;
- séquence les changements de sélection concurrents ;
- réinitialise une cible avant de la démarrer ;
- relance une session neuve lorsque la vue d'erreur le demande ;
- ferme les ressources lorsqu'une occurrence est effectivement détruite ou
  qu'une politique d'éviction l'exige.

Sighty ne crée pas le contenu HTML des scènes, ne décide pas de leur rendu et
ne réalise pas la transition visuelle d'un `slot`.

### CodPlay

CodPlay reste propriétaire de la compilation V2, de la materialization, des
players, des événements publics, de l'attachement aux hôtes et du service
preload. Sighty utilise ses surfaces publiques ; il ne reconstruit pas leurs
services internes.

La scène hôte possède son rendu. L'action est déclarée dans ses `actions`, sur
le perso `slot` concerné ; elle indique la scène à recevoir et la transition
`replace` à réaliser. CodPlay matérialise ce rendu et attache les racines ; le
`slot` ne prend aucune décision sur le cycle de vie du player enfant.

### Frontière pilotage / rendu

Une route Sighty choisit une vue et rend son occurrence disponible ; elle ne
constitue pas une commande de rendu. Sighty passe à la scène layout l'action
déjà déclarée dans ses `actions`. Cette action vise son perso `slot`, indique la
scène à représenter et la transition demandée. La scène et CodPlay exécutent ce
rendu ; Sighty pilote les occurrences concernées avant et après cette demande.

Ce raccord emploie le mécanisme ordinaire d'`actions` de scène. Il ne crée ni
format d'action Sighty, ni canal de rendu parallèle dans Demo 4.

Une valeur `ViewAction.action` est une référence de macro. Le catalogue
d'actions associe ce terme à des actions et événements déjà écrits dans le
code. La séquence associée à cette référence peut en ordonner l'exécution et
attendre leurs achèvements, mais la macro ne contient ni fonction sérialisée,
ni destination absente de `go` ou du parcours déclaré.

### Demo 4

La démo conserve uniquement :

- le fichier scénario ;
- les sources de scènes déclarées auprès du catalogue interne, hors du
  scénario ;
- les documents et styles de ses scènes ;
- le layout unique, dont une story `main` contient les deux persos `layout` du
  carrousel et les deux persos `slot` nécessaires au montage ;
- une composition d'erreur, atteinte seulement par la voie d'erreur Sighty ;
- les boutons de cette telco et son slider ;
- le relayage du slider vers l'occurrence active ;
- l'observation de la sélection et des états utiles à la présentation.
- la désactivation explicite de l'inactivité automatique CodPlay dans cette
  fixture, qui ne valide pas ce comportement.

Elle ne conserve ni index courant, ni table de routes, ni routeur local, ni
politique de preload/release, ni progression globale Sighty.

Le layout de démonstration, sa composition de page et la télécommande générale
de Sighty sont hors du scénario. La télécommande générale appartient au layout
partagé ; elle n'est pas un élément du dispositif de montage de la vue et reste
hors du périmètre de la navigation étudiée ici.

La story `main` n'est pas une propriété de `View` et ne constitue pas une
branche menu ou chapitre. Elle est la portée CodPlay unique du `SceneDoc`
layout. Les deux branches du scénario sont représentées par deux persos
`layout` ordinaires du carrousel ; les actions de ces persos et des deux persos
`slot` sont déclarées dans cette même story.

### Principes de conception de Sighty

Les principes KISS et DRY s'appliquent à Sighty, pas à l'apparence de la démo :

- une seule façade publique `Sighty`, avec `scenario` et `runtime` comme
  surfaces cohérentes ;
- une seule structure auteur `Views` comme source des vues, des chemins et de
  leur ordre ;
- un seul mécanisme générique pour les événements, les directions et le
  pilotage des occurrences ;
- aucune duplication de routeur, de catalogue, de preload ou de progression
  dans les démos ;
- chaque responsabilité reste dans la couche qui la possède : scénario,
  navigation, cycle de vie ou raccordement CodPlay.

## 4. Parcours générique visé

Le chemin normal est :

```text
fichier scénario
  → validation des `Views` et de leurs `SceneKey` contre le catalogue interne
  → acquisition de la seule scène requise au départ
  → compilation et enregistrement CodPlay de cette scène
  → création des occurrences
  → montage des départs déclarés
  → lecture des scènes initiales

événement public ou extérieur
  → action déclarée dans la portée active
  → route déclarée
  → macro référencée par l'action
  → Sighty rend la cible disponible à la demande ou récupère son résultat préchargé
  → le catalogue d'actions déclenche les actions et événements déjà déclarés
    du layout
  → l'action du layout déplace le perso slot vers le point d'accès actif et
    demande au perso slot de recevoir la cible avec
    la transition déclarée
  → CodPlay matérialise le remplacement
  → rewind et lecture des occurrences nouvellement montées pilotés par Sighty

route non résolue pendant le parcours
  → diagnostic structuré publié à l'auteur
  → préparation de la cible d'erreur déclarée
  → action déclarée du layout vers la composition d'erreur
  → scène d'erreur et action de relance utilisateur
  → recréation de la session depuis le départ déclaré
```

L'ordre précis entre disponibilité de la cible et actions du layout doit être
fixé par les tests de la tranche. L'invariant est que Sighty met la cible à
disposition au point où l'action de rendu déclarée par le layout en a besoin ;
la référence de macro n'est ni un chargeur de scènes ni une transition
visuelle. La séquence qu'elle relie peut demander cette mise à disposition à
Sighty, puis déclencher les actions de layout qui lui sont associées.

Le scénario de Demo 4 doit seulement déclarer :

- les vues menu et chapitre, ainsi que leurs compositions de slots ;
- les accès directs du menu vers A, B et C à l'intérieur du chapitre ;
- les directions `previous` et `next` dans le chapitre actif ;
- le retour de `sequence:end` vers le menu.

Le `SceneDoc` du layout déclare une seule story `main`. Elle porte les deux
persos `layout` du carrousel (`layout-menu` et `layout-chapter`) et les deux
persos `slot` (`slot-scene` et `slot-telco`). Les macros du scénario les
référencent par les événements déclarés dans leurs `actions`, sans réécrire
leurs cibles dans le fichier auteur.

## 5. Préchargement et libération des ressources

### Provenance et identité des scènes

Avant d'interpréter un scénario, l'application déclare ses sources de scènes
auprès de Sighty. Cette déclaration associe une `SceneKey` unique à chaque
source et alimente le catalogue interne ; le scénario ne conserve que cette
clé. Lorsqu'il est écrit en TypeScript, ses clés doivent être contrôlées par le
catalogue déclaré. Lorsqu'il est sérialisé, la validation Sighty doit produire
un diagnostic pour toute clé absente.

Cette déclaration reprend le modèle CodPlay de référencement des scènes : une
clé est attribuée avant l'usage et désigne ensuite une capacité disponible. Le
catalogue reste interne à Sighty ; Demo 4 ne construit aucun registre parallèle.

Une source peut fournir directement un `SceneDoc`, passer par une factory,
être lazy ou distante. Ces modes restent derrière la même résolution du
catalogue. Un chemin éventuel appartient à la configuration de cette source et
au mécanisme qui l'acquiert ou la précharge ; il ne figure ni dans le scénario,
ni dans une table `resources.scenes`. Une `SceneKey` enregistrée exprime donc
une capacité de résolution, pas la disponibilité immédiate de la scène.

Après résolution, `SceneDoc.id` reste l'identité technique du document CodPlay.
`SceneDoc.name` reste un libellé facultatif : dans Demo 4 il peut alimenter le
menu à titre provisoire, mais il ne sert ni de `SceneKey`, ni de route, ni de
contrôle de chargement.

### Ce que la démo doit prouver

La démo 4 est petite. Elle peut précharger certaines scènes, mais doit aussi
prouver qu'une scène non préparée est acquise à sa sélection. Le preload n'est
donc ni une condition de disponibilité, ni une seconde voie de chargement.
Cette facilité de preuve ne doit pas devenir la politique générale de Sighty.

La preuve doit néanmoins vérifier que :

- une `SceneKey` est connue du catalogue avant que sa source soit acquise ;
- une source directe, une factory, une source lazy ou distante empruntent la
  même résolution de catalogue ;
- le preload anticipe cette résolution sans en créer une autre ;
- les manifestes sont fusionnés et dédupliqués par le service CodPlay existant ;
- Sighty enregistre le résultat avant la materialization ;
- un changement de scène ne relance pas inutilement une source déjà résolue ;
- la fin temporelle d'une scène ne déclenche pas à elle seule sa libération ;
- le reset complet de la session ferme bien les ressources de la session.

### Politique Sighty à préciser

Le contrat générique doit ensuite décider, avec des tests dédiés :

1. preload initial de toutes les `Views`, du seul chemin actif ou d'un voisinage
   connu ;
2. moment où une source lazy ou distante est demandée, annulée ou réessayée ;
3. moment où une occurrence inactive reste réutilisable ou devient évictable ;
4. propriété des URLs lorsqu'elles sont partagées par plusieurs occurrences ;
5. conservation et adoption des handles média ;
6. identité d'un slot CSS par occurrence ;
7. ordre exact entre arrêt, détachement, nettoyage CSS, destruction et release ;
8. comportement après échec partiel d'une résolution, d'un démontage ou d'une transition.

La règle de base à préserver est : pas de nettoyage automatique à la fin de la
lecture ; nettoyage explicite au démontage effectif, limité aux ressources
possédées par l'occurrence concernée.

## 6. Sémantique de navigation à fixer

- Une destination est toujours déclarée par `path`, `label` ou `direction`.
- L'émetteur ne fournit pas une décision de parcours cachée dans l'événement.
- Une référence de macro relie des actions et événements écrits hors du
  scénario ; elle ne contient ni fonction sérialisée, ni destination cachée.
- Dans une `ViewList` de chapitre, l'ordre détermine la suite locale de `next`
  et `previous`. À une borne de liste, Sighty poursuit la recherche du même
  événement dans les portées parentes. Une action héritée peut déclarer la
  sortie du chapitre, par exemple le chemin du sommaire. La telco émet
  seulement ces intentions ; elle ne calcule aucune destination.
- Une action locale directionnelle est prioritaire lorsque sa cible existe.
  Si elle atteint une borne, la résolution remonte en cascade par les actions
  parentes jusqu'à trouver une cible. Cette remontée ne constitue ni une
  direction `up` automatique, ni une erreur. Sans action parente résolue, la
  sélection courante reste inchangée ; la politique de voie d'erreur reste
  indépendante de cette absence de voisin.
- Une entrée de `ViewList` reçoit un `ViewId` stable. Un accès direct vise ce
  `ViewId`, jamais l'index du tableau ; le chemin conserve les noms de vues et
  de slots nécessaires à cette adresse hiérarchique.
- Dans un `ViewMap`, `start` désigne exclusivement un `ViewId` de son propre
  `views`. Après cette sélection, la vue peut référencer une `SceneKey` par son
  champ `scene` ; `start` ne sélectionne jamais une scène directement.
- `Views` est le seul nom de structure dans le fichier auteur. Les noms
  `ViewGraph` ou équivalents peuvent rester internes à l'implémentation, sans
  devenir une propriété du scénario.
- Les événements publics CodPlay et les événements extérieurs sont traités par
  le même routeur Sighty.
- Une action locale remplace l'action héritée de même nom ; elle ne s'ajoute
  pas silencieusement.
- Une route inconnue produit un diagnostic explicite et atteint la cible
  d'erreur déclarée ; elle ne laisse jamais une sélection incohérente.
- Un changement de sélection déjà en cours est sérialisé ; les choix de concurrence et
  d'annulation doivent être testés, pas improvisés dans la démo.
- La transition demandée à un `slot` appartient à l'action de rendu de la scène
  hôte. Sighty ne choisit ni n'exécute son effet visuel.
- Une scène arrivée en fin de séquence reste montée tant qu'une route Sighty ne
  demande pas son remplacement ou sa destruction.
- Une cible nouvellement sélectionnée repart de zéro avant sa lecture ; le
  slider propre à Demo 4 reste hors de ce contrat.

### Voie d'erreur de navigation à fixer

L'équivalent d'une page 404 est une vue d'erreur déclarée par le scénario. Elle
ne résulte pas d'un rendu implicite de Sighty : le scénario désigne la cible,
et le `SceneDoc` layout porte la story, les actions et le perso `slot` qui la
présentent.

Une erreur de navigation a deux destinataires :

1. l'utilisateur atteint la vue d'erreur, qui offre une action de relance ;
2. l'auteur reçoit un diagnostic structuré, publiquement observable, contenant
   au minimum l'événement reçu, l'action résolue, la destination demandée, la
   sélection active et la cause de l'échec.

La cible d'erreur est obligatoire pour un scénario exécutable. Sa présence et
sa `SceneKey` sont vérifiées avant le démarrage ; une faute statique connue est
donc signalée à l'auteur lors de la validation. Une faute de résolution qui
survient pendant le parcours ne modifie pas d'abord la sélection courante :
Sighty prépare la cible d'erreur, puis réalise le passage déclaré par le
layout. Il ne tente ni route de remplacement implicite, ni reprise de la route
en échec.

L'action de relance émise par la vue d'erreur recrée une session depuis le
départ déclaré du scénario. Elle abandonne la sélection en échec et les
opérations de navigation en cours ; elle ne restaure pas de contexte ou d'état,
ces capacités restant hors de cette tranche. La forme exacte de la déclaration
de cible d'erreur et de la surface d'observation du diagnostic est à fixer à
l'étape de modèle, sans introduire une API locale dans Demo 4.

Une fin de `ViewList` sans action parent résolue n'est pas une route inconnue :
la sélection courante reste inchangée. Elle ne rejoint la voie d'erreur
qu'après une décision explicite de cette politique d'erreur.

Les directions `up` et `down`, les guards et les structures de `Views`
imbriquées complexes restent à éprouver dans des scénarios génériques dédiés
avant d'être considérés comme stabilisés.

## 7. Étapes et gates

| Étape | Travail | Gate |
| --- | --- | --- |
| 0. Séparation | valider le plan visuel et le présent plan de navigation | aucun changement visuel ne porte une règle de runtime |
| 1. Modèle | fixer `Views` récursif (`view.views` et slots), `ViewId` stable dans une liste, clés issues du catalogue interne et référence de macro | le fichier reste sérialisable ; il ne contient ni source de scène, ni `resources.scenes`, ni story de layout |
| 2. Routage | exécuter les références de macro via le catalogue fourni au runtime, puis fixer et tester chemins, directions, cascade d'action parente en fin de liste, héritage, événements publics, cible d'erreur, diagnostic et relance | le handler reçoit l'événement et peut envoyer une action à une scène ; il ne choisit aucune route ; les tests Sighty restent indépendants de Demo 4 ; une direction locale essaie d'abord son voisin puis la même action dans les portées parentes ; une erreur active sa vue déclarée et reste observable |
| 3. Raccord de rendu | tester les événements et actions du layout, dont les cibles story et `slot` restent déclarées dans le `SceneDoc`, puis pause, rewind et play des occurrences nouvellement montées | Sighty ne réalise aucun rendu ni effet visuel ; aucune occurrence sœur n'est pilotée par erreur |
| 4. Preload | tester résolution d'une source directe, factory, lazy ou distante, preload, manifests, déduplication, enregistrement et réutilisation | une même source sert au preload et à la sélection ; aucun second loader |
| 5. Release | fixer puis tester propriété, CSS, media, destruction et idempotence | aucune ressource d'une autre occurrence n'est libérée |
| 6. Fixture | raccorder le fichier Demo 4 au runtime générique | la composition ne possède plus de navigation locale |
| 7. Intégration | parcourir menu → chapitre/A → B → C → menu avec vrais players | une seule occurrence layout, passage entre ses deux persos `layout`, événements, reset de cible, présence de la telco et fin de C sont observés |
| 8. Navigateur | vérifier projection, reset, responsive et Safari | les écarts sont affectés au bon plan ou contrat |
| 9. Affinage | transformer chaque constat en décision, spécification et test | aucune décision générique ne reste cachée dans la démo |

## 8. Critères d'acceptation principaux

- Les tests de navigation Sighty n'importent aucun module Demo 4.
- Le scénario Demo 4 contient toutes les routes ; la composition ne contient
  aucune table de navigation.
- L'accès direct depuis le menu sélectionne la vue chapitre puis sa scène cible ;
  le traitement associé à la référence de macro déclenche les actions des deux
  persos `layout` du carrousel dans la story `main`.
- La scène layout possède une seule story `main`. Elle contient deux persos
  `layout`, `layout-menu` et `layout-chapter`, placés dans le même point d'accès
  et animés horizontalement par leurs actions ordinaires.
- Le scénario menu ne sélectionne que `slot-scene`. Le scénario chapitre
  sélectionne `slot-scene` et `slot-telco` ; il n'y a donc pas de slot telco dans
  la composition menu.
- Le parcours ne crée jamais une occurrence ou un player CodPlay dédié au
  layout de chapitre.
- Chaque `ViewAction.action` référencée est résolue dans le catalogue fourni à
  `Sighty.runtime` ; l'absence d'un handler est rejetée avant le démarrage et
  le handler peut envoyer l'action déclarée d'une scène.
- Les événements du menu, de la telco et de la fin de C empruntent la même
  entrée runtime.
- Une route inconnue atteint la composition d'erreur par les actions réelles du
  layout ; l'auteur observe le diagnostic et la relance recrée la session au
  départ du scénario.
- Le test générique d'un scénario imbriqué vérifie qu'une direction locale
  essaie d'abord son voisin puis l'action parente à la borne ; sans action
  parente résolue, la sélection reste inchangée.
- Le scénario ne contient ni chemin de fichier, ni factory, ni fonction de
  chargement, ni `resources.scenes` ; ses `SceneKey` sont contrôlées contre le
  catalogue interne.
- Une scène non préchargée devient disponible à sa sélection par la même source
  que celle employée par le preload.
- Chaque changement de sélection réinitialise et démarre les occurrences
  nouvellement montées, conserve celles déjà actives et ne détruit pas une
  occurrence sans décision explicite ; la transition visible reste celle
  demandée par l'action de la scène hôte à son `slot`.
- Le preload utilise la surface CodPlay existante et libère les ressources selon
  une propriété identifiée.
- Les ressources partagées, les feuilles CSS et les démontages répétés sont
  couverts par des tests d'isolement et d'idempotence.
- La démo n'ajoute aucune API de progression globale ni aucun traitement
  particulier pour masquer un défaut du runtime.
- La validation navigateur vient après les tests de frontière et ne remplace
  pas leur preuve.

## 9. Hors périmètre de la tranche de navigation

Ne pas ajouter dans cette tranche :

- guards exécutables sans catalogue validé ;
- résolution des bindings `data`/`meta` ;
- contexte, état sauvegardé et restauration ;
- optimisation mémoire spécifique à Demo 4.

Ces sujets devront avoir leur propre décision, plan, contrat et tests Sighty,
mais ils ne sont pas repoussés au-delà de la prochaine tranche.

## 10. Scénario hiérarchique de la démo 4

La démo 4 doit valider une structure de scénario, et non une simple liste plate
de scènes. Trois niveaux sont volontairement distincts :

1. les `Views` du scénario, qui décrivent le parcours et les compositions ;
2. le `SceneDoc` layout, qui possède les stories, leurs actions et leurs
   persos `slot` ;
3. le layout de page de la démo, extérieur au scénario et au dispositif de
   montage des vues.

### Exemple minimal à valider

Cet exemple exprime uniquement le scénario. Il ne décrit ni la page de démo,
ni le rendu des scènes, ni le cycle de vie. Les `SceneKey` `scene-layout`,
`scene-menu`, `scene-a`, `scene-b`, `scene-c`, `scene-telco` et `scene-error`
sont issues du catalogue interne ; elles sont contrôlées par TypeScript lorsque
ce scénario est écrit en code.
Le fichier ne contient ni chemin de fichier, ni source de chargement, ni
`resources.scenes`.

Pour éviter toute confusion entre la structure et ses identifiants, l'exemple
emploie la convention suivante : `view-*` pour les `ViewId`, `scene-*` pour les
`SceneKey` et `slot-*` pour les noms de slots. La story CodPlay du layout est
`main` ; elle ne sert pas de nom aux vues du scénario. Les propriétés de
structure restent sans préfixe : `views`, `view`, `scene`, `slots`, `actions`
et `go`.

`start` désigne toujours l'entrée de `views` dont le nom est un `ViewId`. Dans
l'exemple, `start: 'view-main'` sélectionne donc `views['view-main']` ; cette
vue porte ensuite la `SceneKey` `scene-layout`. Les deux identités sont
volontairement différentes.

```ts
const demo4Scenario = {
  id: 'scenario-demo4',

  // Racine du parcours : un ViewMap.
  views: {
    // `view-main` est un ViewId : il sélectionne une entrée de `views`, pas une scène.
    start: 'view-main',
    views: {
      'view-main': {
        view: {
          // La propriété `scene` reçoit ici la SceneKey `scene-layout`.
          scene: 'scene-layout',

          // Les vues internes au layout forment un second ViewMap.
          views: {
            // La première vue interne est le sommaire.
            start: 'view-summary',
            views: {
              'view-summary': {
                view: {
                  slots: {
                    // `slot-scene` est le nom du slot ; `scene` reste une propriété de `view`.
                    'slot-scene': {
                      start: 'view-summary-menu',
                      views: {
                        // `view-summary-menu` est un ViewId ; `scene-menu` une SceneKey.
                        'view-summary-menu': { view: { scene: 'scene-menu' } },
                      },
                    },
                  },
                },
                actions: {
                  // Un événement du menu vise une vue précise du chapitre.
                  'menu:scene-a': {
                    action: 'demo4:enter-chapter',
                    go: { path: 'view-main/view-chapter/slot-scene/view-page-a' },
                  },
                  'menu:scene-b': {
                    action: 'demo4:enter-chapter',
                    go: { path: 'view-main/view-chapter/slot-scene/view-page-b' },
                  },
                  'menu:scene-c': {
                    action: 'demo4:enter-chapter',
                    go: { path: 'view-main/view-chapter/slot-scene/view-page-c' },
                  },
                },
              },
              'view-chapter': {
                actions: {
                  // Action héritée lorsque la direction locale atteint une borne.
                  previous: {
                    action: 'demo4:return-menu',
                    go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                  },
                  next: {
                    action: 'demo4:return-menu',
                    go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                  },
                },
                view: {
                  slots: {
                    // Une ViewList : son ordre porte la navigation next/previous.
                    'slot-scene': [
                      // `view-page-a` est un ViewId ; `scene-a` est une SceneKey.
                      {
                        id: 'view-page-a',
                        actions: {
                          previous: { go: { direction: 'previous' } },
                          next: { go: { direction: 'next' } },
                        },
                        view: { scene: 'scene-a' },
                      },
                      {
                        id: 'view-page-b',
                        actions: {
                          previous: { go: { direction: 'previous' } },
                          next: { go: { direction: 'next' } },
                        },
                        view: { scene: 'scene-b' },
                      },
                      {
                        id: 'view-page-c',
                        actions: {
                          previous: { go: { direction: 'previous' } },
                          next: { go: { direction: 'next' } },
                          // Choix propre à Demo 4 : après C, retour au sommaire.
                          'sequence:end': {
                            action: 'demo4:return-menu',
                            go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                          },
                        },
                        view: { scene: 'scene-c' },
                      },
                    ],

                    // Une seconde composition de slot, stable dans le chapitre.
                    'slot-telco': {
                      start: 'view-chapter-telco',
                      views: {
                        'view-chapter-telco': { view: { scene: 'scene-telco' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const
```

Les points de modèle suivants encadrent l'exemple désormais exécutable ; les
extensions qui ne sont pas encore contractuelles restent hors de cette
première tranche :

- `Views` est la même structure récursive à la racine, dans `view.views` et
  dans chaque slot. `graph` ne figure pas dans le fichier auteur ; il peut
  demeurer un terme d'implémentation interne.
- un `ViewId` identifie une vue, y compris la cible de `start` et les entrées
  d'une `ViewList`. Ici, `view-main`, `view-summary`, `view-page-a`,
  `view-page-b`, `view-page-c`, `view-summary-menu` et `view-chapter-telco`
  sont des `ViewId` ; `scene-layout`, `scene-menu`, `scene-a`, `scene-b`,
  `scene-c` et `scene-telco` sont des `SceneKey`. Les noms `slot-scene` et
  `slot-telco` sont des noms de slots. L'ordre du tableau reste la seule
  source de la suite locale de `next` et `previous`.
- `demo4:enter-chapter` et `demo4:return-menu` sont des références de macro.
  Le catalogue d'actions
  relie chacune à des actions et événements écrits ailleurs ; leur corps ne
  figure pas dans le scénario.
- Les entrées de la `ViewList` déclarent la direction locale. Lorsque A reçoit
  `previous` ou C reçoit `next` sans voisin, la résolution en cascade atteint
  l'action parente du chapitre, qui retourne au sommaire.
- le `sequence:end` de `scene-c` qui retourne au menu est un choix explicite de
  Demo 4. Il est distinct des boutons `previous`/`next` et ne déclenche pas la
  cascade de borne.
- les chemins de l'exemple identifient les vues et slots de la structure, sans
  index numérique. La syntaxe définitive de ce chemin est un point de l'étape
  de modèle ; elle ne doit pas réintroduire une propriété de représentation.
- la forme de la déclaration qui associe l'échec de navigation à la cible
  `view-error` reste à fixer. Elle est absente de cet exemple tant que ce contrat
  n'est pas validé ; elle ne doit pas devenir une route locale de la démo.

### Structure de scénario

```text
Views
└── view-main : scene-layout
    ├── view-summary
    │   └── slot-scene : view-summary-menu : scene-menu
    └── view-chapter
        ├── slot-scene : ViewList [view-page-a : scene-a, view-page-b : scene-b, view-page-c : scene-c]
        └── slot-telco : view-chapter-telco : scene-telco
```

Le sommaire est la vue initiale et se situe au-dessus du chapitre dans le
parcours. La même forme permet d'ajouter `chapter-2` sans modifier le mécanisme
de navigation. Les accès directs visent une vue de chapitre identifiée ;
`previous` et `next` utilisent l'ordre de la `ViewList` active, puis l'action
parente en cas de borne.
La cible `view-error` reste hors de ce parcours normal : aucun contrôle de menu ou
de telco ne la sélectionne directement.

### Dispositif de montage du `SceneDoc` layout

Le `SceneDoc` de `scene-layout` ne crée pas une story par branche du scénario.
Une seule story `main` porte les persos du dispositif de montage ; la branche
menu et la branche chapitre sont deux persos `layout` ordinaires du même
carrousel.

```text
SceneDoc scene-layout — une occurrence CodPlay, un player
└── story main
    ├── perso layout-menu   → item menu du carrousel
    ├── perso layout-chapter → item chapitre du carrousel
    ├── perso slot-scene    → point d'accès scène, déplacé par ses actions
    └── perso slot-telco    → point d'accès telco du chapitre
```

Le scénario ne porte aucune propriété `story`. Le traitement associé à la
référence de macro envoie les événements déclarés dans les `actions` des deux
persos `layout`. Le perso `slot-scene` est unique : il est déplacé vers le
point d'accès menu ou chapitre, puis reçoit la scène sélectionnée avec le
`replace` déclaré dans son état initial. Le perso `slot-telco` n'est sélectionné
que dans la composition chapitre ; le menu ne possède donc qu'un slot actif.

L'adresse de la story `main` et des persos `slot` vit dans les actions de la
scène layout et dans le manifeste CodPlay, jamais dans une inspection DOM. La
transition gauche-droite du carrousel est portée par les actions des persos
`layout`, produites comme artefact d'auteur avec `capsule-automation` ; elle ne
devient pas une responsabilité de Sighty.

La voie d'erreur suit le même raccord lorsque sa cible sera implémentée : après
son diagnostic, Sighty atteint la cible `view-error` déclarée ; une composition
déclarée du layout présente `scene-error`, puis l'événement de relance repasse
par Sighty et recrée la session au départ déclaré. Elle ne nécessite pas une
story dédiée.

Les événements émis par la telco et ceux de la scène active se résolvent dans
la même portée de chapitre. `previous` et `next` ne sont donc disponibles que
dans cette composition. Le retour au menu retire la sélection du chapitre et
sa telco, sans créer un player ou une occurrence de layout supplémentaire.
La telco n'est pas lancée tant que le menu est actif. À l'entrée dans le
chapitre, son occurrence nouvellement montée est remise à zéro et lancée avant
la notification de sélection qui lui envoie l'état `enable` ; son activation
ne dépend donc pas du temps écoulé sur le menu.

La construction du menu est une feature de composition de la démo. Elle
parcourt la structure du scénario pour créer les entrées correspondant aux
chapitres et aux scènes. À terme, le libellé affiché vient des métadonnées du
scénario ou de la vue. Leur forme et leur résolution relèvent de la tranche
Sighty `meta` suivante. Pour Demo 4 seulement, `SceneDoc.name` est accepté
comme secours provisoire pour afficher un libellé ; il n'est ni obligatoire, ni
une source de données normative pour le menu, ni une identité de navigation.
Sighty fournit la lecture du scénario et la résolution des chemins ; la feature
du menu ne duplique ni la structure des `Views`, ni la logique de navigation.

Le runtime générique conserve le chemin complet des `Views`, rend les
occurrences requises disponibles et résout la référence de macro associée.
Le catalogue d'actions déclenche alors l'action déjà déclarée dans les
`actions` de la scène layout. `previous`, `next` et les routes de fin
fonctionnent à l’intérieur de ce chemin, y compris la cascade vers l'action
parente à une borne. Aucun état de navigation ne doit être conservé dans la
démo en dehors des actions déclarées dans le scénario.

`story.listen.active` ne doit pas être détourné : ce contrat CodPlay isole les
faits et les actions d'une story, sans produire seul un changement de visibilité
ou de montage. La présentation du passage menu/chapitre reste déclarée et
exécutée par la scène layout lorsqu'elle reçoit son action ; Sighty ne choisit
pas sa présentation.

La question du préchargement et de la libération reste celle du mécanisme Sighty
générique : la démo 4 peut précharger ses scènes, mais elle ne doit pas imposer
cette politique aux autres scénarios.

## 11. Tranche Sighty immédiatement suivante

Dès que la tranche de navigation est implémentée et validée, Sighty enchaîne
sur une tranche consacrée aux capacités déjà prévues par la note :

- `data` et bindings d'entrée ou de mise à jour ;
- `meta` effective et transmission aux scènes ;
- `guards` et leurs décisions d'accès ;
- `context` modifiable selon les règles du scénario ;
- `state` représentant la position et les informations nécessaires à la
  reprise ;
- sauvegarde et restauration d'un parcours imbriqué.

Cette tranche doit d'abord fixer les contrats encore ouverts dans la note
(catalogue de guards, fusion des `meta`, contenu minimal du `state`, et format
de sauvegarde), puis les implémenter dans la façade `Sighty`. Elle ne doit pas
ajouter une implémentation concurrente dans une démo.

La fixture recommandée est une **Demo 5** construite sur le parcours de Demo 4.
Demo 4 reste ainsi la preuve de non-régression de la navigation hiérarchique,
tandis que Demo 5 ajoute les données, les conditions d'accès et la reprise.
Si la fixture est finalement portée directement dans Demo 4, elle devra
conserver intégralement cette preuve de navigation et ne pourra pas déplacer
ces responsabilités dans sa composition.

## 12. Suivi

La première implémentation reste une matière d'épreuve, pas une preuve de
contrat entièrement stabilisé. Le plan demeure `En cours` : la structure
récursive, les `ViewId` de `ViewList`, les routes de base, le changement de
branche et le raccord des références de macro sont implémentés et testés ; la
voie d'erreur, les sources lazy/distantes, le preload à la demande et la
libération sélective restent les gates suivantes.

Les propriétés historiques `resources.scenes`, `view.graph` et les tableaux
sans identifiant ne servent plus à construire Demo 4. Elles restent
uniquement dans la compatibilité de lecture et dans les tests de non-régression
le temps que les tranches correspondantes soient retirées ou spécifiées.

Validation effectuée le 2026-09-13 : typecheck et six tests Sighty passent ; la
suite CodPlay complète passe (103 fichiers, 641 tests) ; le test d'intégration
Demo 4 passe (7 tests), dont le cycle menu → chapitre → menu → chapitre qui
vérifie que la telco remontée réémet sa navigation, que son activation ne reste
pas retardée par une ancienne position temporelle, qu'elle expose un seul
toggle lecture/pause et qu'une navigation rapide conserve une seule
présentation sortante ; le build V2 des démos passe. Le typecheck legacy des
démos conserve des erreurs préexistantes hors de cette tranche.
