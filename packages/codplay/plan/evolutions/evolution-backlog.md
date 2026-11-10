# Évolutions CodPlay — sujets à cadrer et planifier

> Cible : V2.5 ou V3 à décider par sujet. Ces évolutions ne conditionnent
> pas la stabilisation des circuits V2 existants. Les décisions acceptées
> gardent leur portée ; le classement ne valide aucune API proposée.

Les contrats courants restent dans les spécifications. Une réalisation
demande son cadrage, son acceptation et l’autorisation explicite de toute
modification du cœur. Les plans détaillés de [découverte des actions](./action-discovery-plan.md)
et des [unités](./unit-values-plan.md) sont conservés dans ce même dossier.

## Comportements temporels et exposition auteur ACE

Ces sujets ne font pas partie de l'acceptation de la tranche logique actuelle.
Avant une intégration de rendu continu, décider explicitement :

- si `TweenAction` suffit comme surface auteur ou si un type public `Behavior`
  est nécessaire ;
- si les options temporelles ACE `loop`, `loopDelay`, `reversed` et
  `alternate` sont acceptées sur un comportement auteur, et comment vérifier
  leur reconstruction de scène aux frontières Play/Seek ;
- si un chemin préparé doit être disponible aux `TweenAction` auteur. Le chemin
  de `move` est déjà couvert par sa spécification ; cette décision concerne
  uniquement les tweens continus autonomes ;
- si `spring`, les keyframes explicites ou les coordonnées polaires ont une
  surface auteur. Leurs primitives ACE testées isolément ne leur donnent pas
  ce statut ; définir aussi le raccord éventuel entre durée de stabilisation
  du ressort et durée du tween ;
- comment plusieurs actions continues composent leur présentation et si un
  mode pondéré/additif est nécessaire. `blend`, ses poids et ses modes ne sont
  pas un contrat V2 adopté ; fixer la règle avant toute intégration qui en
  dépend ;
- où passe la frontière entre l'évaluation logique et la matérialisation pour
  HTML, SVG et les projections natives ;
- si un scheduler, `context.live` ou des hooks d'annulation/lifecycle ont une
  place dans ce contrat futur.

Aucune de ces extensions n'est décrite comme comportement V2 certifié. Leur
acceptation devra préserver le chemin logique Play/Seek spécifié et être reliée
à ses preuves runtime. Les calculs ACE vérifiés isolément sont décrits dans la
[spécification ACE](../../specs/ace-calculation-v2-spec.md). L'inventaire des cas
V1 et le contexte de ces questions restent dans la
[note Behavior](notes/2026-08-23-v1-behavior-inventory.md) ; elle n'ajoute
aucune API V2.

## Observation des changements de snapshot

L'API vérifiée reste `instance.snapshot.get()`, `set(patches)` et `clear()`.
Une notification telle que `snapshot.onChange` n'est ni décidée ni implémentée.
Le contrat existant reste suffisant tant qu'aucun consommateur ne demande une
observation directe.

Si un besoin concret justifie cette extension, décider avant toute modification
du cœur :

1. quels changements sont observés : état de base présenté, opérations de
   preview réussies, ou les deux ;
2. si une preview change le signal alors que `get()` continue de renvoyer l'état
   de base ;
3. la forme de la donnée relue par le consommateur et l'appel initial éventuel ;
4. l'ordre des notifications par rapport à `set`, `clear`, `seek` et à la
   présentation ;
5. l'isolation des erreurs, le désabonnement et le comportement après
   destruction.

Le parcours d'acceptation devra couvrir la lecture initiale, la pose, le
remplacement et l'effacement d'une preview, un seek vers un autre temps puis le
retour, ainsi que la destruction. Il devra prouver qu'un seul circuit de
présentation est observé. Aucun nom de méthode, DTO ou événement ne constitue
un contrat avant cette décision.

## Sources média en direct

**Décision acceptée, non appliquée ; version à affecter.**

Une source déclarée comme direct reste au temps réel (`now`) ; un Seek ne la
rembobine pas. Le `rate` logique est ignoré pour son contenu, et pause/reprise
ne figent pas puis ne rattrapent pas la source : la reprise retrouve l'instant
courant. Le mode doit être déclaré par l'auteur, car l'adresse d'une source ne
permet pas de distinguer sûrement un direct d'un média enregistré.

La déclaration auteur, l'interaction avec le rôle de master, les effets visibles
de pause et de masquage, ainsi que la propriété et la libération de la source
restent à définir. Aucune API `live` n'est adoptée. Avant implémentation, arrêter
ces choix puis valider le média, son hôte et le module de synchronisation sur
Seek, rate, pause/reprise, reset, teardown et navigateur réel. Le comportement
actuel de média enregistré reste celui de la
[spécification media-sync](../../specs/media-sync-v2-spec.md).

## Commandes vidéo et reprise après pause

> Statut : A relire. La décision de reprise précède toute implémentation
> dépendante ; aucune évolution du cœur n’est autorisée par cette demande.

Besoin Quiz Hunt : conserver `START startAt: 0` à l’entrée, les 5 s d’indice,
le formulaire et le feedback ; retirer les contrôles natifs et ajouter deux
petits boutons sous la vidéo avec le style existant. Ils commandent le seul
perso `media`, en `sync: auto`, sans modifier la timeline ni la scène panier/minuteur.

Décision à prendre pour Play après Pause : reprise exacte à la position
suspendue, ou redémarrage à zéro. Le circuit courant expose START, PAUSE et
STOP ; START utilise startAt, zéro par défaut, et aucune commande RESUME
n’est adoptée. Le rewind demandé utilise START à zéro. Garder le STOP de fin
de feedback jusqu’à preuve qu’il est redondant.

Ordre et acceptation :

1. Fixer la sémantique de reprise. Rechercher le circuit existant ; si une
   nouvelle capacité est nécessaire, la faire accepter et obtenir
   l’autorisation explicite du cœur avant réalisation.
2. Après cette décision, câbler les boutons sur les broadcasts du perso.
   Aucun accès direct au nœud ni autre circuit de transport n’est accepté.
3. Avec des fixtures indépendantes, vérifier pause, reprise selon la décision,
   rewind, fin native, lecture/Seek de scène et nettoyage.
4. Dans Safari, vérifier START à l’entrée, boutons, réponse/STOP, nouvelle
   entrée à zéro et identité du nœud, sans réassignation de src ni nouveau load.
   Relever currentTime autour du START pour diagnostiquer le saut de première
   image ; le seul attribut autoplay n’a pas démarré la source préchargée lors
   de l’essai existant.
5. Après validation, mettre à jour les seules spécifications vérifiées et
   fermer ce sujet sans déclarer closes les autres acceptations média.

## Composition des packages et nouveaux composants tiers

1. **Granularité des packages d’intégration — à décider.** Le code courant
   regroupe plusieurs composants dans `@codplay/component-v2`, mais ce fait ne
   tranche pas si Three.js, Rive et Lottie doivent rester regroupés ou devenir
   des packages séparés. Consigner la décision après la comparaison des
   besoins, sans la déduire de l’organisation actuelle du code.
2. **Surface auteur des composants Three.js — à définir.** Les scénarios
   caméra, couleur et déplacement passent aujourd’hui par `TweenAction`. La
   forme d’éventuelles opérations auteur portées par les composants reste
   ouverte jusqu’à l’inventaire des besoins. Ne pas ajouter d’API avant cette
   décision.
3. **Hôte Lottie simple — décision prise, implémentation et vérification
   ouvertes.** Le périmètre retenu est une composition linéaire contrôlée par
   CodPlay avec Play et pause. Les segments, marqueurs, layers et cibles
   internes ne font pas partie de cette tranche. Vérifier si ce périmètre
   suffit à démontrer le pont ; sinon, faire décider l’extension avant de
   l’implémenter.

## Relation d’horloges des composants tiers

**Décision acceptée le 14 octobre 2026 ; réalisation différée à la demande
de l’utilisateur.** La relation `sync` discutée pour `media` doit également
être considérée pour les composants apparentés aux médias Rive, Three.js et
Lottie, avec deux valeurs seulement :

- `auto`, par défaut : pilotage temporel par CodPlay, correspondant au
  comportement actuel ;
- `independent` : progression temporelle indépendante, avec maintien des
  commandes explicites prises en charge par l’intégration.

Ces familles ne proposeront pas `master`. Le mode indépendant de `media`
est maintenant vérifié dans la
[spécification média](../../specs/media-sync-v2-spec.md) ; l’extension aux tiers
reste suivie ici.
Leurs profils ne sont pas présentés comme possédant déjà cette propriété.
Pour Lottie, le comportement de référence reste le périmètre de pilotage
CodPlay décidé plus haut ; cette mention ne certifie pas une intégration
Lottie déjà implémentée et vérifiée.

Avant une future réalisation, ce plan devra fixer :

- la portée de `sync` dans chaque intégration : hôte, animations linéaires,
  state machine ou composants logiques concernés, sans l’ajouter
  indistinctement à tous les persos ;
- le raccord du temps indépendant aux circuits existants de présentation et
  de commit. La décision n’autorise pas une seconde boucle de rendu, un
  nouveau player ou une horloge privée par composant ;
- le traitement des commandes existantes, des transitions de transport de
  scène et des frontières de montage, masquage et destruction ;
- la validation auteur des deux valeurs admises, du défaut `auto` et du refus
  de `master`, puis les preuves réelles de continuité en mode indépendant et
  de non-régression du mode `auto`.

La réalisation devra étendre les circuits identifiés par les spécifications
et respecter leurs propriétaires. Toute lacune générique sera cadrée dans le
[plan du pont](../2026-09-18-third-party-components-v2-plan.md#acceptation-commune-du-pont)
avant modification du cœur. Cette extension reste au plan ; les
spécifications ne seront enrichies qu’après implémentation et vérification.

## Suppression de l’index d’activation des stories

> Proposition : **A relire** ; aucune application engagée.

`storyActivationIndex` dérive des positions de `story.listen` où
`active === true`. Le dispatcher possède déjà les règles par nom et construit
aussi une map d'activation, complétée par un parcours des déclarations.
La [spécification d'isolation](../../specs/story-isolation-spec.md) et le
[codec](../../specs/compiled-codec-v2-spec.md) décrivent encore cet index.

La proposition consiste à consulter les règles story déjà sélectionnées pour
l'événement avant le filtre d'éligibilité, puis à retirer cet index et sa map
distincte. Préserver le refus des doublons, le réveil ciblé, la priorité des
règles story/scène et la transition atomique activation/reset. Décider le
format, puis vérifier journal, activation/désactivation, isolation, Play/Seek,
replay et lifecycle avec les gates du
[plan d'isolation](../story-isolation-plan.md). La décision sur le catalogue
des actions ne vaut pas validation de cette proposition d'activation.

## Sémantique de SceneDoc.defaults

La propriété apparaît dans le type auteur, la normalisation et la donnée
compilée, mais aucun test ne certifie de règle qui l'applique et aucun
consommateur n'a été trouvé dans `packages/codplay/src`. Elle n'est donc pas un
mécanisme de defaults certifié par les specs.

Décider le rôle de cette propriété dans la version retenue. Si elle est conservée, préciser les
champs auxquels elle s'applique et sa priorité par rapport aux valeurs
explicites, aux actions déjà résolubles et aux defaults des composants/services.
La hiérarchie envisagée dans les versions précédentes de ce plan n'est pas un
contrat. Aucun code ne doit l'interpréter avant la décision et son parcours
d'acceptation.

## Extensions du transport et du journal

Décisions non prises, à affecter à une version avant implémentation :

- Lecture bornée d’un intervalle `[t1, t2]` : API, règle de fin,
  synchronisation média et traitement des effets antérieurs à `t1`.
- Politique des événements utilisateur après un Seek arrière : conserver les
  faits futurs, les retirer ou définir une règle auteur. Aucun `onSeekBack`
  n’est adopté. Couvrir les tracks story et scène, le retour arrière, la reprise
  et une nouvelle interaction.
- Lecture arrière : arrêter son périmètre et ses interactions avec le rate,
  les médias et RenderSync. La validation du rate positif existant reste en V2.
- Construction live sans journal : conserver le cadrage exploratoire dans
  [la note dédiée](./notes/2026-09-23-construction-live-non-reconstructible.md).
  Aucune API, option de scène ni autre politique de Seek n’est décidée.
- API `live`, répétition conditionnelle ou scheduler de frames pour les straps :
  aucune forme n’est adoptée ; définir le besoin et l’acceptation avant réalisation.

## Représentations foreign supplémentaires

| Sujet | État | Travail requis |
|---|---|---|
| Référence sérialisable pour un contenu foreign générique | **À décider** | Arrêter sa forme avec le propriétaire de représentation concerné. Ne pas ajouter une forme universelle au composant `slot`. La valeur ne doit pas transporter de nœud DOM, de player, de fonction ni d'objet runtime mutable. |
| Disponibilité asynchrone | **Décision prise, application à valider** | Une disponibilité tardive réentre par le circuit déterministe du runtime avec l'identité de cible et la génération de session ; une réponse périmée est ignorée ou diagnostiquée. Définir et prouver le raccord du propriétaire de représentation sans callback qui écrit directement dans le DOM. |
| Remplacement d'une iframe ou d'une représentation non clonable | **À décider** | Choisir, pour la capacité concernée, entre remplacement sans transition et élément visuel de substitution. Le clone DOM de `slot` ne prouve pas la reproduction d'un rendu natif. |

L’acceptation doit couvrir le propriétaire réel, la disponibilité tardive,
le remplacement concurrent, l’annulation et la destruction. Une réponse
périmée ne doit pas réattacher de contenu. Les fournisseurs gardent leurs
ressources ; un clone DOM ne certifie pas une représentation native.

## Autres extensions de projection

- Sanitation des templates : décision A relire. Le chemin actuel parse
  `template.innerHTML`, extrait les parts et conserve les nœuds ; ses tests
  ne certifient pas un filtrage des balises et attributs. Décider si un
  filtrage doit être introduit, puis définir son contrat et son acceptation
  avant toute modification. L’ancien nom `readAndSanitize` n’est pas une API adoptée.
- Defaults des familles de propriétés autres que les transformations : décider
  leur introduction et leur frontière avant de les intégrer au contrat courant.
- Media queries génériques : traiter l’écart de seuil 800/801 et les cibles
  HTML comme canvas, indépendamment des méthodes HTML de focus. La décision
  et les preuves restent à établir ; aucun correctif Elcé local ne remplace ce contrat.
- Éventuel correctif `blur` pour les inputs : définir le défaut concret et le
  contrôle natif visé avant tout changement. Conserver les usages actuels de
  `focus` sur boutons et conteneurs.

Les [sources utilisateur complexes](./notes/2026-07-27-emetteurs-et-events-user-complexes.md)
restent une exploration sans capacité ni API acceptée.

## Ressources et formats de diffusion

Les sources de scène distantes et la compatibilité player/paquet sont suivies
dans le [plan d’export futur](./scene-export-plan.md).
La correction éventuelle de dérive des médias non master demande d’abord des
mesures ; sa nécessité, sa politique et ses garde-fous de lancement, pause et
Seek restent à décider. Elle ne s’applique pas au master.

## Périmètre TalkingHead supplémentaire

Décider d’inclure, de reporter ou d’exclure les réactions pilotées par volume,
Dynamic Bones et rééquilibrage physique, statistiques et callbacks de diagnostic.
Chaque comportement retenu doit être reconstructible ou disposer d’une limite
Play/Seek explicitement acceptée. Aucun de ces ajouts n’est certifié par les
capacités Avatar existantes ni requis pour leur stabilisation V2.

## Extensions des composants input et img

### Glyph de correction input

Version à affecter ; réalisation différée.

permettre à
      `InputComponent` d'effacer son propre texte de correction lorsque l'état
      revient à `idle`, sans effacer un perso enfant monté dans le slot
      `correctionIcon`. Dans le runtime actuel,
      `InputComponent.applyCorrectionIcon()` ne projette plus le contenu dès
      qu'un enfant existe dans le slot. Quiz Hunt résout son besoin immédiat par
      un perso `tag` auteur monté dans ce slot et réinitialisé par l'événement
      quiz existant ; cette évolution du composant n'est donc pas un prérequis
      du chantier Sighty. Avant de l'implémenter, définir comment le composant
      distingue son texte projeté d'un enfant auteur et établir son propre
      parcours d'acceptation ; ne pas modifier le contrat vérifié avant
      implémentation et validation.

### Rendu alternatif du composant img

**A relire — contrat non décidé, aucune implémentation engagée.** Le
[plan de construction Elcé](../../../elce/plan/2026-10-01-elce-construction-plan.md)
demande qu’un markup choisi puisse remplacer le rendu HTML par défaut du
composant image. Un bdc image Elcé à contenu unique génère un seul perso
`img`, sans `figure` ajoutée par ce bdc, y compris si ce rendu alternatif est
ajouté plus tard. Le preset Elcé « image avec légende » possède son propre
markup fixe avec une zone image et une zone texte ; sa structure HTML est à
définir par Elcé et ne modifie pas le composant `img`.
Le [contrat de scène](../../specs/scene-authoring-spec.md) fait déclarer par
l’application les persos et leurs cibles de montage. Le contrat vérifié de
`img` prévoit actuellement un conteneur fixe et un nœud image natif créé par
CodPlay, conservé par source ; `ImageInitial` ne porte pas de markup
alternatif. La composition avec un `layout` peut entourer ce conteneur ;
la [démo scroll-container](../../../demos/src/v2/demos/scroll-container/main.ts)
déclare déjà un perso `tag` de type `figure` qui accueille un perso `img`.
Cette configuration à deux persos est précisément celle qu’Elcé écarte pour
ses images.

Pour cette évolution, le builder Elcé fournit le markup alternatif dans la
scène, tandis que CodPlay reste propriétaire de la balise image native.
Dans Elcé, l’utilisateur de l’éditeur ne saisit jamais de HTML, pour le POC
comme pour ses suites. Avant de retenir une modification du cœur, décider
comment le markup accueille l’image native dans ce seul perso et quelle
forme garde le rendu par défaut.
Préserver ou redéfinir explicitement les invariants de
source, texte alternatif, services, animation, nœuds persistants et
matérialisation. Toute nouvelle entrée auteur doit être validée et
sérialisable. La politique de sanitation des templates est encore **A relire**
dans le [évolutions de projection](#autres-extensions-de-projection) ;
ce point doit être tranché avant l’introduction d’un markup image auteur.

Le parcours d’acceptation à établir devra exercer les deux rendus par le
vrai player, y compris le changement et le retour de source, Play, Seek,
resize, reparent, persistance, lifecycle et navigateur ; les catégories
non concernées pourront être écartées seulement sur analyse causale. Le
markup auteur devra respecter la règle d’`id` explicite pour chaque parent.
Aucun code du cœur ne doit être modifié avant validation du contrat, plan
accepté et autorisation explicite prévus par les règles du dépôt.
