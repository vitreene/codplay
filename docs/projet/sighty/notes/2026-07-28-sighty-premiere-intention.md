# Sighty — première intention

**Horizon distinct de la V2 codplay**, ouvert par `2026-07-26-meta-orchestrateur-preambule.md` :
l'orchestrateur qui pilote plusieurs scènes autonomes. Le préambule cadre le concept ; cette page
recueille les notions de **première intention** apparues en discutant le découpage de codplay.

**Nom retenu : Sighty** (contraction de *Synchronicity*, écarté pour sa longueur).

**Statut de ces notions : non normatif.** Ce sont des intentions premières, pas des décisions arrêtées —
elles serviront de matière quand l'auteur détaillera Sighty. Aucune ne doit être traitée comme une spec,
et aucune ne doit remonter dans le cahier V2 de codplay.

**Mais cette page n'est pas un horizon lointain — c'est une entrée du travail V2.** L'ordre de
construction est codplay V2 *puis* Sighty ; l'ordre de **définition** est l'inverse. Les specs codplay
doivent impérativement préparer l'usage avec Sighty, donc Sighty doit être suffisamment défini **avant**
qu'elles ne se figent — sans quoi la préparation se ferait après coup, soit exactement la « pièce
rapportée » que `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §0 traque. D'où la nécessité de bien le définir, et
la vocation de cette page à s'enrichir avant, non après, la spécification de codplay V2.

**Frontière tenue avec la page codplay.** `../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` ne contient
que ce qui incombe à codplay ; les notions ci-dessous sont hors de lui. Codplay ne connaît ni le mot
*page* ni le mot *groupe* : il reçoit des ensembles d'instances.

## 0. Conclusions provisoires — ce qu'on sait de Sighty

Synthèse de l'état actuel. Le détail et le cheminement sont dans les sections suivantes, qui consignent la
discussion ayant produit ces conclusions.

### Objectif

**Piloter des suites de scènes autonomes.** Sighty charge, joue et arrête des scènes selon un scénario et
selon les actions qu'une interaction provoque ; il injecte des ordres dans les scènes et en reçoit des
données. Il existe parce que **les scènes ne communiquent pas entre elles** — assurer cette circulation est
sa raison d'être.

Il est un **client de codplay**, non une fonction de codplay : codplay joue une scène et se laisse piloter,
Sighty est le pilote.

### Principe de fonctionnement

- **Machine à états, pas fonction du temps.** Un scénario enchaîne par **achèvement** et par
  **interaction**, jamais par horloge : ni `eventime`, ni piste à matérialiser, ni seek par transposition.
  Son état d'orchestration est petit et durable.
- **Le scénario est de la donnée sérialisable, structurée en graphe de nodes.** Un node est un état — ce
  qui est monté à cet instant — et ses sorties déclarées sont les arêtes. Les calculs (conjonction,
  temporisation, garde) n'entrent pas dans ce vocabulaire : ils sont **nommés** depuis le scénario et
  fournis à côté, comme un strap avec sa `strapCollection`. Une glu ne peut que *choisir parmi les sorties
  déclarées*, jamais inventer une destination — sinon le graphe ne serait plus dans la donnée.
- **Il pilote par events**, du même genre que ceux de codplay, l'aller et le retour empruntant le même
  canal. Il tient des **adresses**, jamais des objets players. Le **telco n'est pas remplacé** : il reste
  l'API de commande externe d'un player, et devient, sous Sighty, un canal de son pilotage interne — le
  point d'entrée extérieur monte d'un cran, le vocabulaire ne change pas.
- **Aucun rendu visuel par lui-même.** Il compose en **hébergeant**, jamais en dessinant : toute transition
  est jouée par une scène, à qui il la demande.
- **Classe métier à l'API pilotable**, entourée d'une app qui porte l'UI, le stockage et le calendrier. Son
  état central est donc **vivant, non persistant**, et injecté **en lecture seule** dans les scènes.
- **Mode auteur et mode diffusion**, comme codplay et avec les mêmes prérogatives : validation du scénario
  une fois au chargement puis confiance, moteur de warning présent en auteur et absent en diffusion, et le
  mode auteur pour lieu des éditions (undo/redo de la machine). Son consommateur est l'**éditeur complet**,
  qui gérera une œuvre entière là où l'éditeur actuel construit une scène — d'où une symétrie à deux
  étages : codplay/éditeur de scène, Sighty/éditeur complet.
- **La figure est fractale** : à chaque étage un catalogue de choses déclarées, des consommateurs qui y
  revendiquent leurs besoins, un arrangement au-dessus. Écrans → scénarios → séquences → nodes → scènes →
  capacités. Sighty y est tour à tour arrangeur et, un cran plus haut, piloté.

### Ce qu'il tient, et que personne d'autre ne peut tenir

La **distribution entre instances** — jamais confiée à une scène, quand bien même une scène en aurait la
capacité : le partage se fait par responsabilité, non par capacité. L'**arrangement** (« diffuse cette
séquence »). La **portée** d'une commande et la comptabilité de temps d'un ensemble. La **politique de
survie** des instances. Le **déterminisme du séquencement**. La **continuité d'activité** de la
présentation.

### Le pilotage vient toujours du dehors

Une scène *est* `f(t)` ; elle n'est pas propriétaire de la façon dont `t` est parcouru, et ne décide donc
jamais de sa propre lecture. En revanche **une scène peut en piloter une autre** — cas le plus net, une
**scène-telco** et une scène principale, que **Sighty pilote toutes deux** sans qu'elles dialoguent. La
forme qui préserve l'invariant : la première **émet une intention**, le scénario la traduit, Sighty
commande. Le ciblage reste dans le scénario ; une scène qui nommerait sa cible cesserait d'être autonome
(§6.3 quater).

### Transposable, comme codplay

Prématuré, mais à ne pas perdre : Sighty devra pouvoir être **transposé sur Flutter** si besoin, les
contraintes de concept étant identiques à celles de codplay
(`../../codplay-v2/notes/2026-07-26-portabilite-contrainte-redaction.md`).

La contrainte y est déjà satisfaite **par construction**, et plus aisément que pour le moteur : Sighty ne
produit aucun rendu, ne tient aucun nœud, ne manipule que de la donnée et des events — il n'a pas de
substrat dont s'affranchir. Seule une référence de rendu acquise le rendrait non transposable, ce que la
règle « aucun rendu visuel par lui-même » interdit déjà. Ce n'est donc pas un chantier mais une **propriété
à ne pas perdre** — et, comme pour codplay, elle discipline le TS qui sera écrit.

### Ce qu'il n'est pas

Pas d'interface utilisateur, pas de stockage, pas d'horloge murale (le calendrier est à l'app), pas de
rendu, pas de timeline. Aucune scène n'en atteint une autre à travers lui : il relaie, il n'ouvre pas de
canal direct.

### Frontière avec codplay

Codplay ne connaît ni le mot *page* ni le mot *groupe* — il reçoit des ensembles d'instances. Ce que Sighty
exige de lui est listé au §5 : cycle de vie propre, suspension et reprise, canal d'events bidirectionnel,
surface publique de scène, mode hôte, seek atomique sur un ensemble.

### Ce qui reste ouvert

Voir §8. Les plus chargés : **un chapitre est-il simplement une séquence** (ce qui décide du coût de
l'accès par profil), la **politique d'arrangement** et celle de **survie**, et la **surface publique
d'entrée** d'une scène — celle-ci relevant de codplay.

---

*La suite de ce document consigne la discussion qui a produit ces conclusions.*

## 1. Nature

**Rôle** : piloter des suites de scènes. Il charge, joue et arrête des scènes selon un **scénario** et
selon des **actions qu'une interaction peut provoquer**. Il injecte des ordres aux scènes et reçoit des
données en retour.

**Il ne produit aucun rendu visuel par lui-même.** Pas de surface, pas de perso, pas de `t` propre.

Conséquence qui tranche une attente spontanée : **une transition entre scènes ne peut pas être dessinée
par Sighty**. Un fondu, un glissement, un rideau entre deux pages est soit **dans une scène** — une
scène-layout qui anime ses hôtes, ce que le mode hôte permet — soit inexistant. Tout ce qui se voit est
une scène ; Sighty compose en hébergeant, jamais en dessinant. Corollaire : un contrôle de pilotage
visible est un perso dans une story, ou un outil d'éditeur, jamais une production de Sighty.

**L'exécution des transitions est confiée aux scènes ; Sighty la demande directement à la story layout.**
Trois conséquences :

- **La transition anime l'hôte, pas le contenu.** La story layout anime son perso hôte ; l'instance
  hébergée n'est pas touchée et continue à son propre `t`. Sighty a donc **deux destinataires** pour un
  seul geste apparent — la story layout (« fais la sortie ») et l'instance (« arrête-toi ») — et leur
  coordination, ordre et recouvrement, lui appartient.
- **La transition reste dans le modèle.** Jouée par une scène, elle est `f(t)` : matérialisée, seekable,
  reproductible. Une transition que Sighty aurait dessinée serait tombée hors de `f(t)`, dans la catégorie
  des irréductibles. La contrainte « aucun rendu visuel » préserve une propriété, elle n'en coûte pas une.
- **Elle exige un event d'achèvement.** Enchaîner sur achèvement suppose que la story layout signale
  « transition terminée » ; sinon Sighty ne peut que temporiser à l'aveugle. La surface publique de la
  scène fonctionne donc dans les deux sens — elle reçoit l'ordre et rend l'achèvement. Cas concret qui
  rend le point ouvert « surface publique d'une scène » non optionnel dès le premier scénario réel. Deux
  échelles à ne pas confondre : la sortie d'un **élément** s'achève à la fin de sa séquence — mécanisme
  identifié, `endEmit` libéré de `endOn` appliqué à une `ActionSequence`
  (`../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` §4) — tandis que l'évacuation de la **scène** est
  `sequence:end`, ce que Sighty écoute.

**Sighty lit des scénarios sous forme d'objets sérialisables.** C'est sa nature première : le scénario est
de la donnée, pas du code — donc stockable, éditable, transportable.

**Sighty est une machine à états, pas une fonction du temps.** Le parallèle avec une scène codplay tient
sur la structure et casse sur le temps : un scénario enchaîne par **achèvement**, pas par horloge. Il n'a
donc pas d'équivalent d'`eventime`, pas de piste à matérialiser, pas de seek par transposition. Son état
d'orchestration est petit et durable — quelle instance tourne, quels résultats sont collectés — et la
machinerie du `PersoState` ne s'y applique pas.

**Deux sources de transition, une seule mécanique** : l'**achèvement** d'une scène, et l'**interaction**.
Le scénario porte les états et les transitions ; ces deux sources les déclenchent.

**Deux achèvements distincts existent côté scène.** `v1-scene-spec.md` §9 distingue `scene:end` — **fin
métier** qui n'arrête pas la scène, pouvant être suivie de stories de fin ou d'attentes d'interaction — et
`sequence:end`, **fin technique** terminale, point de départ du nettoyage et de l'évacuation. Le point
d'accroche de la fin technique existe déjà : `Scene.onSequenceEnd(scene, options)`, prévu pour
l'application hôte, et que la spec écarte explicitement du montage d'une story de fin.

**Ce que Sighty écoute est déclaré par lui, selon des conventions à décrire.** Rien n'est fixé ici : ni
l'attachement de l'écoute à l'un des deux events, ni la répartition de la décision entre la scène et
l'orchestrateur. Les cas d'usage (§6) montrent qu'un enchaînement peut porter sur la fin narrative comme
sur la fin technique — c'est une observation d'usage, pas une règle.

**C'est la raison concrète pour laquelle Sighty ne peut pas être une timeline.** L'intervalle entre
`scene:end` et `sequence:end` peut dépendre d'une action utilisateur — une boucle d'attente après la fin
narrative. La durée d'une page n'est donc pas connaissable d'avance, et une évacuation dont l'instant
n'existe pas encore ne se planifie pas. « Machine à états » n'est pas une préférence de modèle, c'est la
seule forme compatible.

**Passé `sequence:end`, une instance n'est plus pilotable** : le player rejette `pause` et `emit` et
verrouille la séquence. Le seul geste qui reste à Sighty est la destruction — contrainte de protocole, pas
détail d'implémentation.

**Sighty pilote par events**, du même genre que ceux de codplay (`{ name, data }`). Il ne tient pas les
objets players, il tient des adresses ; l'aller et le retour empruntent le même canal.

**Sighty a un mode auteur et un mode diffusion**, comme codplay, avec les mêmes prérogatives.

- *La validation joue le rôle du builder, un étage plus haut.* Le scénario est vérifié **une fois au
  chargement** — nodes inatteignables, sorties non câblées, culs-de-sac, scène réclamée mais absente du
  catalogue — puis le pilotage fait confiance, selon le partage de
  `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §4.7. La forme en graphe rend cette inspection possible **sans
  exécuter**.
- *Le moteur de warning explique à l'auteur du scénario* ce qui ne fonctionne pas, et **disparaît en
  diffusion** : un scénario validé ne se re-diagnostique pas.
- *Le mode auteur est le lieu des éditions.* Les interventions décrites plus bas — mise à jour ou
  reconstruction d'une scène, undo/redo de la machine — en relèvent : c'est le canal authoring de Sighty,
  hors du mode diffusion.
- *Ses consommateurs sont les **éditeurs d'œuvre**.* L'éditeur construit aujourd'hui une seule scène ; un
  éditeur d'œuvre saura gérer un ensemble — un e-learning entier, par exemple — et **intégrera Sighty à cet
  autre niveau**. Ce n'est pas un outil mais une **famille** : un éditeur par domaine métier, et plusieurs
  possibles pour un même domaine selon les capacités qu'on veut lui prêter. La symétrie est alors
  complète :

  | niveau | moteur | outil d'auteur | canal |
  |---|---|---|---|
  | **scène** | codplay | éditeur de scène | authoring, local |
  | **œuvre** | Sighty | éditeurs d'œuvre (un par domaine) | mode auteur de Sighty |

  La transcription *concepts → persos* déjà pratiquée par l'éditeur a donc son pendant un cran plus haut,
  *concepts → scénario* (§7.0) — même figure, deux étages.

  Deux conséquences : l'authoring restant **hors protocole**, l'éditeur complet intègre Sighty **en
  processus**, non à distance — la limite « un éditeur ne pilote que des instances locales » est
  exactement son cas, donc n'en est pas une pour lui. Et **l'ordre se reproduit d'un étage** : si
  l'éditeur complet est le consommateur principal du mode auteur, la définition de Sighty doit
  l'anticiper, comme les specs codplay doivent anticiper Sighty.

**Le telco n'est pas remplacé — il change de statut.** Tel qu'il existe, il continue comme **API de
commande externe** d'un player : un player reste commandable directement, sans Sighty. Quand Sighty est
là, le point d'entrée extérieur **monte d'un cran** — l'extérieur parle à Sighty — et le telco devient un
canal de son **pilotage interne**. Le vocabulaire ne change pas : c'est la même surface employée à un
autre étage.

**Sighty est une classe métier à l'API pilotable ; une app l'entoure.** L'interface utilisateur, le
stockage et le reste appartiennent à cette app, pas à lui. Conséquence directe : **l'état central qu'il
tient est vivant, non persistant** — les réponses d'un apprenant qui survivent à une session relèvent de
l'app, Sighty les tenant pendant le parcours et l'app entre les parcours.

**Selon ce que l'app demande, Sighty met à jour ou reconstruit une scène** pour la remettre en phase avec
les intentions de l'utilisateur. Il gère alors l'**asynchronisme de construction**, le démontage puis le
remontage, et la reprise : soit un **seek au `currentTime` local de l'ancienne version**, soit un départ de
zéro, selon la demande. L'ensemble suit un scénario qui construit la séquence globale, laquelle peut ainsi
être **amendée par un pilotage utilisateur**.

**Ces interventions sont des éditions d'auteur, pas de la continuité de lecture.** Remplacer une scène
depuis un éditeur, revenir voir la modification : cela n'appartient pas à une timeline mais relève d'un
**undo/redo de la machine**. Donc **aucune transition à jouer, aucune superposition à ménager** — et le
seek au `currentTime` de l'ancienne version est un dispositif de **revue pour l'auteur**, non un raccord de
diffusion. C'est la frontière posée par `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §5 : dialogue auteur↔outil
d'un côté, œuvre de l'autre.

**Deux historiques de nature différente**, à ne jamais confondre :
- une **interaction utilisateur** avec une scène est pleinement intégrée à la séquence, comme dans codplay
  — matérialisée, relue ;
- une **édition d'auteur** ne l'est pas : elle vit dans l'undo/redo de la machine.

## 2. Déclaratif porteur, impératif nommé

Le pilotage a deux formes, qui n'occupent pas la même place :

- **Le scénario est déclaratif et sérialisable** — c'est le tronc.
- **L'écriture impérative sert à organiser un dispositif figé** — par exemple adapter une œuvre existante
  à sighty. Elle est **nommée depuis le scénario**, jamais le tronc.

C'est le patron du strap : une `SceneDoc` reste sérialisable parce qu'elle ne contient que le *nom* du
strap, le code arrivant à part par `strapCollection`. Transposé : un scénario nomme une glu, la glu reçoit
des events et rend des events, sans tenir d'objet player — même discipline qu'un strap qui ne touche pas
au DOM.

## 3. Page et groupe — deux notions de part et d'autre de la frontière auteur/diffusion

> **Registre de vocabulaire.** *Page* et *vue* appartiennent au vocabulaire **métier** d'une app (§6) —
> chaque domaine nomme la chose à sa façon, d'où leur variation. *Node* est le terme du **modèle** (§7).
> Les deux registres communiquent par **transcription** (§7.0), et finiront par fusionner quand le modèle
> se fixera ; d'ici là, la coexistence est normale et non une dérive à corriger.

- **Page** — unité **déclarée dans le scénario**. Durable, elle appartient à l'œuvre. C'est la portée
  légitime d'un seek de diffusion : « seek sur la page X ». Elle doit être **cohérente** — pas de
  chargement de scène en cours, par exemple.
- **Groupe** — **sélection temporaire et accessible** de plusieurs instances dont on veut vérifier la
  synchronisation, sans impliquer l'ensemble. Composé à la demande, il n'existe pas dans le scénario : il
  appartient à l'atelier.

Elles ne sont donc pas deux variantes d'un même concept mais les deux côtés de la frontière
auteur/diffusion (`../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §5).

**Une troisième notion n'est pas requise pour autant.** Le cas qui semblait l'appeler — une scène-telco
commandant « toutes les scènes sauf elle-même » (§6.3 quater) — se règle par l'arrangement : une scène
layout héberge la télécommande et la scène pilotée, et les règles du scénario **nomment leur cible**. On
nomme ce qu'on pilote. Si un besoin d'ensemble apparaît, il viendra d'un cas à nombreux membres.

**Conséquence pour codplay** : les deux se réduisent à la même chose — un ensemble d'instances. Le telco
reçoit une portée ; la provenance de l'ensemble (déclaré par un scénario, sélectionné par un éditeur) ne
le regarde pas. Aucune des deux notions n'a donc à entrer dans codplay.

**Un seek sur l'ensemble n'a pas de sens.** Raison structurelle, non prudentielle : un seek suppose une
fonction du temps ; à l'intérieur d'une scène tout est `f(t)`, mais sighty est une machine à états sans
timeline. Le seek s'arrête à la frontière d'un **état** — dedans il y a du `t` à parcourir, à travers une
transition il n'y a qu'un enchaînement par achèvement. Une page est un état de la machine, donc la portée
maximale où le seek signifie quelque chose.

## 4. Ce que Sighty tient, que personne d'autre ne peut tenir

- **La portée** — quel ensemble, à quel instant.
- **La comptabilité du temps d'un ensemble** — une **origine de temps**, et pour chaque membre son
  **décalage** par rapport à elle. Sans quoi « seek la page à 4200 » n'a pas de sens, chaque instance ayant
  son propre `t` et sa propre durée. C'est de l'état inscrit **au montage**. Codplay reçoit les cibles
  résolues, il ne les calcule pas.
- **La politique de survie** — ce qu'il advient d'une instance quand sa surface d'accueil disparaît, ou
  quand une cible de seek précède son montage : détruire, recréer, laisser. Codplay sait démonter ; il ne
  décide pas qui doit disparaître. Cette politique est réclamée par deux chemins indépendants (le mode
  hôte et le seek d'ensemble) et reste à écrire.
- **Le déterminisme du séquencement** — condition pour qu'une composition d'instances soit reproductible,
  donc utilisable comme scène de référence anti-régression.
- **La continuité d'activité de la présentation** — la diffusion ne s'interrompt pas parce qu'une app amont
  a modifié le scénario en cours de route (§6.4), ni parce que la scène suivante n'est pas encore chargée :
  un **interlude** comble l'intervalle (§6.3 quinquies).
- **La distribution entre instances** — elle ne se confie pas à une scène. Codplay et Sighty sont tous deux
  complets sur le traitement d'un état et leurs possibilités se croisent ; le partage se fait par
  **responsabilité**, non par capacité.
- **Les stratégies de preload**, quand il est employé — il est le seul à connaître la suite du graphe. Même
  situation pour un éditeur ; le preload de codplay ne sert que la **diffusion autonome** (§6.3 quinquies).
  C'est la stratégie qui remonte, non la ressource : le cache reste au niveau de l'engine.
- **L'arrangement** — « diffuse cette séquence, ou ce scénario ». Le **calendrier** (toutes les heures, deux
  fois par jour, toutes les minutes) appartient à l'**app de diffusion**, qui demande à Sighty de lancer une
  séquence : la gestion du temps de calendrier n'est pas organique à Sighty, qui ne consulte aucune horloge
  murale. En revanche, la façon dont la demande prend place — couper ou attendre la fin de la vue courante,
  ce qu'il advient de ce qui joue, comment le défaut reprend ensuite — est sa responsabilité.
- **Un état central** — note de première intention. Aujourd'hui un `state` de scène est une commodité pour
  gérer des variables de jeu, défini par défaut dans son contexte d'exécution et sa portée. Avec Sighty les
  variables prennent de l'importance et un état central apparaît : valeurs **injectées par events**,
  **en lecture seule** pour les scènes. Une scène qui doit contribuer une valeur **émet** ; Sighty décide
  s'il l'enregistre. Versant codplay (portées, capture, risques) : `../../codplay-v2/notes/2026-07-28-decoupage…` §8.

## 5. Ce que Sighty exige de codplay

Rappel, développé dans `../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` : instancier/détruire
proprement, suspendre/reprendre, un canal d'events dans les deux sens, une surface publique de scène (les
events qu'une scène fait remonter sans savoir que sighty existe), un mode hôte permettant qu'une instance
soit jouée dans une autre, et un seek **atomique** sur un ensemble d'instances vers une cible par membre.

## 6. Cas d'usage

Ce ne sont pas des scénarios construits, mais des **descriptions de situations réelles** donnant le
contexte d'usage. Le préambule en pose une troisième : quiz-hunt appelant space-bubble comme épreuve
incorporée, chaque scène restant entière et autonome.

### 6.1 Affichage dynamique (*digital signage*)

Un carrousel de vues. Chaque vue est fractionnée en zones — disons par tiers — et chaque zone publie une
scène, par exemple une promotion sur un produit. Toutes les trois vues, une vue différente montre un menu
animé, deux zones diffusant un bulletin météo et la troisième l'heure.

Une vue se termine soit quand **toutes ses scènes sont `scene:end`**, soit après un **délai fixe** (ex.
30 s). Via une interface externe, un utilisateur modifie une vue à la volée : remplacer une promotion,
changer une valeur ou une image, réordonner les vues. Il peut aussi arrêter et reprendre la lecture, ou
se rendre directement sur une vue et poursuivre.

### 6.2 Apprentissage en ligne (*e-learning*)

Une série de pages regroupées en **chapitres**, plusieurs chapitres formant l'œuvre. En diffusion,
l'utilisateur répond à des questionnaires ; ses réponses sont enregistrées et **conditionnent la suite de
son parcours**. En deçà d'un seuil, il suit un parcours de rattrapage et repasse une épreuve ; s'il
réussit, il poursuit. Des activités interactives, **tirées aléatoirement**, lui sont proposées à
certaines étapes.

### 6.3 Ce que ces cas valident

Vues fractionnées en zones hébergeant des scènes autonomes ; scènes différentes selon la vue ;
remplacement d'une instance dans un hôte ; arrêt et reprise ; réponses collectées dans l'état central et
injectées en lecture seule ; parcours conditionnel avec rattrapage ; activités tirées puis montées.

Point de confirmation : **« se rendre directement sur une vue » n'est pas un seek** mais une transition de
la machine vers un autre état. La portée du seek s'arrête bien à la page ; sauter d'une page à l'autre est
un geste d'une autre nature.

### 6.3 bis Accès par profil — même besoin, autre angle

Sur une **base commune**, certains chapitres ne sont accessibles qu'à un **profil d'utilisateur défini en
amont**. Aucun mécanisme neuf : c'est le multi-scénario sur catalogue conjoint (§7.1) vu d'un autre angle,
l'app choisissant le parcours puisqu'elle connaît le profil — comme pour le calendrier, elle dit *lequel*
et Sighty arrange *comment*.

**Mais la forme naïve coûte cher.** Un scénario par profil duplique le graphe commun, c'est-à-dire
justement ce qu'on veut partager : cinq profils sur un parcours long donnent cinq graphes quasi
identiques.

**D'où un argument concret pour le fork « un chapitre est-il une séquence ? »** (§8). Si un chapitre est
une séquence — un graphe de nodes nommé, comme celles du signage — un profil cesse d'être une variante de
graphe pour devenir un **arrangement** : `["c1","c2","c3","c4","c5"]` contre `["c1","c3","c5"]`. Même
catalogue, mêmes séquences, aucune duplication. Ce fork décide donc si l'accès par profil est cher ou
gratuit.

### 6.3 ter Plusieurs écrans — une couche de plus

Un même dispositif peut se répartir sur **plusieurs écrans** — pratique courante en signage. Chaque écran
diffuse un scénario, et il se peut que ce soit **plusieurs fois le même** (réplication). C'est l'étage
supérieur de la figure fractale du §7.1.

**Un Sighty pour N écrans, ou N Sighty ?** En configuration réseau, **N Sighty — un par appareil — et
l'outil calendrier distribue**. L'« app pilote général » n'est donc pas un composant de plus : c'est le
calendrier élargi, qui passe de « quelle séquence, quand » à « quelle séquence, quand, sur quel écran ».
Le partage de responsabilité est le même, remonté d'un cran : le calendrier dit *lequel et quand*, chaque
Sighty arrange *comment*.

Ce qui rend cette forme viable est la précision requise (ci-dessous) : un distributeur émettant « joue la
séquence X maintenant » vers N Sighty suffit.

**La continuité à la frame entre dalles se réserve à la configuration locale.** Un appareil pilotant
plusieurs écrans, c'est un engine et N racines de montage : l'ordre de tick y est déjà garanti, donc cette
continuité y est atteignable. Ce n'est pas une objection à la configuration réseau, c'est l'autre
configuration — deux régimes de précision, sans conflit.

**La réplication pose sa propre question** : plusieurs écrans jouant le même scénario sont-ils **en
miroir** (même état, même instant) ou **indépendants** (chacun sa progression, éventuellement décalée) ?
Les deux se rencontrent, et ils n'appellent pas le même dispositif.

**Deux configurations, toutes deux réelles** :
- *Locale* — une seule app pilotant plusieurs écrans sur un seul appareil : un engine, N racines de
  montage, aucun réseau.
- *Réseau* — plusieurs instances synchronisées, **un appareil = un écran**. Elle réclame une
  infrastructure et un **serveur / app pilote général** — qui peut être l'outil calendrier lui-même,
  distribuant aux instances de Sighty : une couche de plus, où **Sighty est à son tour piloté**. Fractal.

**Hors périmètre d'une V1 de Sighty**, mais cela trace l'amplitude que le dispositif peut prendre — et ce
qu'il ne faut pas fermer d'ici là.

- *Sighty piloté ne demande rien de neuf.* C'est la même surface, employée depuis l'étage du dessus, et
  c'est ce que la décision « events comme contrat primaire » achète : rien de non sérialisable ne traverse,
  donc la même API franchit un réseau sans être refaite. La seule chose à tenir pour une V1 est donc de
  **ne pas fermer la porte**, non de la construire.
- *La telco déportée trouve ici son usage idéal.* `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §10 #5 classait le
  telco comme transport réseau « très tentant mais éloigné pour le moment — porte à ne pas condamner » :
  faute d'usage, non faute d'intérêt. Le distributeur calendrier vers N Sighty sur N appareils **est** cet
  usage. La porte cesse d'être gardée ouverte par principe, elle l'est pour un consommateur nommé.
  Précision de niveau : ce qui est piloté à distance est ici un **Sighty**, non un player — la même forme
  un étage plus haut, ce qui est précisément le fractal.
- *Précision requise — bien en deçà du tick.* La synchronisation et la correction de dérive sont des points
  techniques en soi, mais la précision **n'a jamais besoin d'atteindre le niveau du tick** : un
  enchaînement de vues se juge à l'œil, pas à la frame. Le patron existe déjà un étage plus bas —
  `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §10 #1 décrit la sync média comme une **correction de dérive** (un
  maître, un seuil, un réalignement : `syncMasterToTimeline`, seuil 80 ms, soit cinq frames). Ce n'a jamais
  été un couplage au tick, et c'est la forme qu'appelle une synchronisation inter-écrans. Le réseau reste
  donc hors V1 pour ce qu'il coûte en infrastructure et en app pilote, non parce que la synchronisation
  serait un problème dur.
- *Réserve de nom.* « Projection » est déjà pris, et fortement : dans le cahier V2, une Projection est la
  cible de rendu déclarée exposant `set`/`measure`/`mount` — `DomProjection`, `FlutterProjection`
  (`../../codplay-v2/notes/2026-07-16-solve-project-moteur-custom.md` S8). Parler d'un Sighty « projeté sur plusieurs écrans »
  entrerait en collision frontale avec ce sens.
- *Hors périmètre.* Un dispositif de diffusion pose d'autres problèmes à résoudre — mode kiosque,
  extinction automatique, et le reste. Ils relèvent de l'appareil et de l'app, non de l'orchestration.

### 6.3 quater Piloter la lecture programmatiquement

Ce qui appartient à Sighty ici tient en une phrase : **il pilote la telco programmatiquement**, comme le
reste — un `telco:seek`, un `telco:pause` sont des messages parmi d'autres.

L'effet qui a fait surgir la question — un faux aller-retour de lecture dans
`mashup-back-and-fore-scene.ts` — est **méta et très limité** : il ne se justifie que dans une démo
expliquant le fonctionnement de codplay, et n'entame donc pas la prémisse « l'œuvre diffusée se joue en
avant » (`../../codplay-v2/notes/2026-07-27-emetteurs-et-events-user-complexes.md` §6.3).

La capacité qu'il appelle — la **lecture arrière** — est du ressort de **codplay**, non de
l'orchestration : `../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` §8.

**Une scène ne pilote pas sa propre lecture.** Raison de fond : une scène *est* `f(t)`, elle n'est pas
propriétaire de la façon dont `t` est parcouru — décider du parcours est d'un autre ordre que produire
l'état à un instant. Le pilotage vient toujours du dehors.

**Une scène pilotant une autre, en revanche, est trivial avec Sighty** — et cette idée est revenue
plusieurs fois. Cas le plus net : une **scène-telco**, surface de contrôle, et la **scène principale**.
Les deux ne dialoguent pas : **Sighty pilote l'une et l'autre** et fait le lien.

La forme qui tient est donc **A émet, le scénario traduit, Sighty commande** — la scène-telco publie une
intention (« lecture demandée »), une règle du scénario dit que cela signifie `telco:play` sur la scène
principale, Sighty l'exécute. A pilote en effet, sans jamais nommer B.

Observation : les contrôles de transport étaient jusqu'ici la seule exception admise à la règle « un
contrôle fonctionnel est un perso dans la scène ». Si la telco est elle-même une scène, l'exception n'a
plus lieu d'être.

**Comment cela se gère** : sur une **page**, une **scène layout** héberge la télécommande et la scène
pilotée, et gère leur présence. Deux instances hébergées ordinaires, le mode hôte dans son rôle.

- *La scène-telco ne s'applique pas ses propres commandes*, et il n'y a rien à inventer pour cela :
  l'adressage vit **dans le scénario**, qui nomme la cible. On nomme ce qu'on pilote, jamais « tout sauf
  moi ». La scène-telco émet une intention ; elle ignore qui la reçoit — autonomie préservée, comme pour
  le ciblage.
- *Ce qui commande tout, y compris la télécommande, est externe* : l'**app ombrelle**, non une scène. Une
  scène à ce niveau serait une **imbrication hypothétique** — possible, non justifiée.

C'est là qu'est la bifurcation : si A **nomme** sa cible, elle cesse d'être autonome — plus rejouable
seule ni réemployable ailleurs, puisqu'elle présuppose l'existence de B. **Le ciblage reste donc dans le
scénario.** Même arbitrage que celui qui fonde la surface publique : une scène dit ce qu'elle fait, non à
qui.

Rien de neuf n'est requis : c'est le relais déjà décrit, avec un émetteur d'un genre nouveau — une scène
plutôt qu'une app ou un calendrier. Et c'est un usage concret de plus pour le cran supérieur de visibilité
(`../../codplay-v2/notes/2026-07-28-decoupage…` §4) : une intention de pilotage est un event public.

### 6.3 quinquies L'interlude — combler l'attente d'une ressource

Le même arrangement par layout expose la gestion des **ressources asynchrones**. Dans un long chapitre,
les ressources ne sont chargées qu'au fur et à mesure : l'intervalle entre le `scene:end` d'une scène et
la **disponibilité** de la suivante peut être long. Un **interlude** doit se mettre en route dans cet
intervalle, et **cette séquence est gérée par Sighty**.

- *L'interlude est une scène comme une autre*, hébergée dans le même conteneur du layout. Sighty ne
  dessine rien : il **substitue un hébergé** le temps que le suivant soit prêt.
- *Le partage suit ce qui est déjà posé.* Le **preload charge et signale** — le signal existe,
  `scene:ready` étant un event de cycle de vie réservé au même titre que `scene:end` (`v1-scene-spec.md`
  §8). **Sighty décide ce qui joue en attendant** : c'est le cas concret de sa responsabilité de
  **continuité d'activité** (§4), jusqu'ici énoncée sans exemple.
- *La durée d'un interlude est inconnue.* Il ne se termine pas, il est **interrompu** quand le suivant
  devient disponible — patron de la boucle d'attente déjà rencontré après une fin narrative, arrêtée par
  un event. Mécanisme existant.
- *Les stratégies de preload lui reviennent.* Sighty est le seul à savoir ce qui vient après, puisqu'il
  tient le graphe — quand il est employé, il s'occupe donc aussi du préchargement. Même situation pour un
  **éditeur**, qui sait avant codplay ce qui est disponible ; `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` §10 #2
  le notait déjà (« l'éditeur préchargé de son côté »). **Le preload de codplay ne sert que la diffusion
  autonome**, quand rien n'existe au-dessus.
- *C'est la stratégie qui monte, pas la ressource.* Le **cache** reste au niveau de l'engine, partagé
  entre instances et compté par références (`../../codplay-v2/notes/2026-07-28-decoupage…` §2) — bien commun. Ce qui remonte est
  la décision de *quoi* et *quand*.

### 6.4 Ce que ces cas font apparaître

**Observation — l'enchaînement peut porter sur la fin narrative.** Le carrousel termine une vue quand
toutes ses scènes sont `scene:end`, l'évacuation technique venant après. C'est un **constat d'usage** :
il montre que l'écoute ne se réduit pas à `sequence:end`, il ne dit pas qui déclare quoi. Ce que Sighty
écoute relève de sa propre déclaration et de conventions à décrire (§1) — aucune règle à en tirer à ce
stade.

**Trois facultés apparaissent — conjonction, temporisation, garde — et aucune n'est une capacité de
Sighty** :
- *Conjonction* — « quand l'ensemble des scènes sont `scene:end` » est une **barrière** sur N membres.
- *Temporisation* — le repli à 30 s.
- *Garde* — le branchement sur un seuil de score, résultat d'un **calcul**, non un prédicat déclaratif.

**Ces facultés peuvent être confiées à une scène qui sait les gérer.** Une scène a une timeline, un état et
des straps : la temporisation y est un eventime, une accumulation y est ordinaire, une garde y est le
résultat d'un calcul dans un strap. Le calcul peut aussi vivre dans une fonction de Sighty — la glu
impérative nommée depuis le scénario (§2). Dans les deux cas, **rien n'entre dans le vocabulaire du
scénario** : ce sont des calculs, ils vivent là où vivent les calculs.

**Mais le partage ne se fait pas par capacité — il se fait par responsabilité.** Codplay est complet sur le
traitement d'un état, Sighty l'est aussi ; leurs possibilités se croisent, et ce croisement ne dit rien de
qui doit faire quoi. **La distribution entre instances est du domaine de Sighty et ne se confie pas à une
scène.** La conjonction sur les fins de membres d'une vue en relève : c'est de l'orchestration, pas le rôle
d'une scène.

Conséquence : *Sighty n'a pas besoin d'une source de temps propre* dès lors qu'une temporisation
appartient à qui possède une timeline. Le modèle « machine à états, pas fonction du temps » reste entier.

**Le versant entrée de la surface publique n'est pas traité.** Modifier une valeur ou une image à la volée
pose la question symétrique de « quels events remontent » : par quoi une scène est-elle réglable du
dehors ? Deux voies possibles, non tranchées — l'injection directe visant un élément (voir plus bas), ou
une déclaration explicite par la scène de ce qui est réglable.

**Le scénario change à chaud, et la modification vient d'en amont.** Ce n'est pas Sighty qui édite : une
**app amont** lui envoie des modifications qu'il doit **répercuter** — remplacer une promotion, changer une
valeur, réordonner les vues. D'où la responsabilité de **continuité d'activité de la présentation** (§4) :
la diffusion ne s'interrompt pas parce que le scénario a changé sous elle.

**Deux voies, choisies par la demande** (§1) : *mettre à jour* la scène en place, ou la *reconstruire* —
construction asynchrone, démontage, remontage, puis reprise au `currentTime` local de l'ancienne version ou
départ de zéro. Le point ouvert n'est donc plus la nature de la réponse mais **quelle voie pour quelle
modification**, et le sort des compteurs en vol.

Ces voies relèvent de l'**édition d'auteur** (§1) : pas de transition à jouer, pas de superposition à
ménager, et le seek de reprise est un dispositif de revue. Précaution malgré tout : si la modification a
changé les durées, la même milliseconde ne désigne plus le même point narratif — la reprise est une
approximation, pas une équivalence.

**Deux extensions envisagées** :

*Générateurs* — Sighty pourrait gérer, en plus de scènes, des **générateurs** : des fonctions qui
renvoient des stories, `(paramètres) → SceneStoryDoc`. Ce n'est pas une notion neuve — elle a déjà été
évoquée pour l'éditeur (widget), et la pratique en est pleine dans les démos :
`createQuizQuestionStory(question)`, `createSeriesProgressStory(options)`, `createResultStory(labels)`,
`createWorldStory()`… C'est le patron `scene-factory` que `2026-07-26-meta-orchestrateur-preambule.md`
cite pour le cas « widget dans scène ».

Rien de neuf non plus dans son intégration : un générateur est du **code**, un scénario est de la
**donnée** — le scénario le **nomme**, la fonction arrive à côté, comme un strap avec sa
`strapCollection`. Le partage déclaratif/impératif (§2) l'accueille tel quel.

Observation sur le *moment*, sans conclusion : un générateur produit une story, donc son résultat entre
dans un `SceneDoc` et passe par le builder — c'est un levier **avant compilation**, là où l'injection
directe est un levier **pendant la lecture**. Les deux permettent de modifier le contenu, à deux instants
différents ; pour le signage (§6.1), remplacer une promotion pourrait relever de l'un comme de l'autre.
Rien n'interdit d'appeler un générateur plus tard, cela signifie recompiler cette scène.

*Injection directe de valeurs dans une scène* — sous forme d'actions visant un élément : « modifie la
source de cette image », « change le texte de ce bloc ». Une convention d'adressage existe déjà côté
codplay — `v1-event-spec.md` : « le cas `event.name === perso.id` reste la convention la plus directe pour
désigner sans ambiguïté un perso cible ». Reste ouvert : si l'injection directe suffit, ou si une scène
doit déclarer ce qui est réglable du dehors.

**Rien à trancher ici sur la simultanéité d'une transition** : elle est réglée par codplay, pas par Sighty
— et sans jamais dédoubler une instance vivante. Voir `../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md`
§5.

**Le chapitre est une structure de scénario.** Page → chapitre → œuvre : le concept, jusqu'ici rangé du
côté codplay comme notion future, est un **regroupement ordonné de pages**, donc côté Sighty.

**Le tirage aléatoire n'est pas une indétermination.** C'est un tirage **déterministe sur un seed**, fixé à
la **construction du scénario** — donc reproductible par construction, sans rien à enregistrer au moment
où il tombe. Il ne rejoint pas la catégorie « indétermination résolue » des interactions
(`../../codplay-v2/notes/2026-07-26-etat-fonction-de-t.md`) : il relève de l'indétermination levée **à la compilation**
(`conduite-chantier-v2.md` §4.6). Le seed variant d'une construction à l'autre donne précisément ce que le
cas demande — chaque apprenant reçoit une variante, chaque scénario donné se rejoue à l'identique.

Nuance d'implémentation, sans effet sur la propriété : un tirage fait **au build** rend l'activité choisie
simple donnée et dispense le seed d'atteindre le runtime ; un tirage fait **au runtime depuis le seed**
reste reproductible mais dépend de l'ordre des tirages, donc du déterminisme du séquencement (§4). Non
tranché.

Deux points mineurs : « repasser une épreuve » suppose que l'état central **accumule des tentatives**
plutôt qu'il n'écrase une valeur ; et la zone qui donne l'heure est du `f(now)`, même catégorie que le flux
direct — une vue qui la contient n'est pas reproductible, avec la conséquence déjà posée sur les scènes de
référence.

## 7. Esquisse élémentaire

**Statut : esquisse de travail, non normative.** Écrite pour commencer à raisonner sur les hypothèses du
§6, pas pour fixer une forme. Les noms sont provisoires.

### 7.0 Trois étages, dont cette esquisse ne montre que le bas

Les deux hypothèses du §6 décrivent des **apps différentes employant la même librairie**. Chacune doit
donc définir son **vocabulaire métier**, organisé selon ses besoins — *vue, zone, promotion, carrousel*
d'un côté ; *chapitre, quiz, rattrapage, parcours, profil* de l'autre. Ces besoins sont ensuite
**transcrits** dans le vocabulaire et l'objet `Scenario` de Sighty.

```
vocabulaire métier de l'app  ──[transcription]──►  Scenario (nodes, séquences, instances)
```

**Le précédent existe côté éditeur** : il propose des **concepts**, transformés ensuite en **persos**. Même
figure — une transformation à sens unique, tenue par l'outil, qui laisse le moteur ignorer ce qu'est un
« concept ». Transposé : **Sighty n'apprend jamais ce qu'est une promotion ni un chapitre** ; il ne connaît
que nodes, séquences et instances. C'est l'invariant « le sens vit un étage au-dessus », appliqué au
vocabulaire.

Deux conséquences :

- *L'esquisse ci-dessous est l'étage bas.* Elle écrit directement des objets `Scenario`, en sautant l'étape
  où l'app nomme ses propres choses. Un scénario n'est pas ce que l'auteur d'une app écrit — c'est ce que
  la transcription **produit**.
- *La verbosité de l'esquisse cesse d'être un défaut.* Le `listen` qui énumère ses sources une par une
  (§7.6) appartient à la couche **produite**, non à la couche écrite : un vocabulaire métier dit « toutes
  les promotions de la vue », la transcription développe.

Et **chaque app a donc son propre builder**, produisant de la donnée sérialisable. Ce n'est pas un
mécanisme neuf, c'est un lieu à nommer — du côté de l'app, cohérent avec le fait que c'est elle qui envoie
les modifications à Sighty (§6.4).

### 7.1 Trois principes qui commandent la forme

- **Le scénario est un graphe de nodes.** Un node est un état de la machine — ce qui est monté à cet
  instant — et ses sorties déclarées sont les arêtes.
- **Une glu ne peut que choisir parmi les sorties déclarées d'un node**, jamais inventer une destination.
  Sans quoi le graphe ne serait pas représentable depuis la donnée : les arêtes seraient dans le code.
- **Le graphe est la structure d'une séquence**, pas du scénario entier. Au-dessus, une couche
  d'arrangement dit quelle séquence joue.
- **Le catalogue de scènes et le scénario sont deux déclarations détachées.** Une scène est une
  **ressource disponible**, employable par plusieurs scénarios ; un scénario **revendique ses besoins**
  auprès d'un catalogue conjoint, il ne le contient pas. Même figure qu'un étage plus bas, où une scène
  déclare ses besoins et l'engine les fournit depuis son catalogue de capacités
  (`../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` §2) — d'où la même propriété : un scénario
  réclamant une scène absente du catalogue échoue **avant lecture**, proprement.
- **La figure est fractale.** À chaque étage : un catalogue de choses déclarées, des consommateurs qui y
  revendiquent leurs besoins, un arrangement au-dessus qui dit lequel joue.

  ```
  écrans      →  arrangement de scénarios      (réplication possible)
  scénario    →  revendique des scènes         au catalogue de scènes
  séquence    →  graphe de nodes
  scène       →  revendique des capacités      au catalogue de l'engine
  ```

### 7.2 Types

```ts
type SceneCatalogue = Record<string, SceneEntry>   // déclaré à part, partagé par N scénarios

type Scenario = {
  id: string
  seed?: string                          // tirages déterministes, fixé au build
  instances: Record<string, InstanceDecl>  // `sceneId` réfère au catalogue, ne le contient pas
  sequences: Record<string, Sequence>    // chacune un graphe de nodes
  defaut: string[]                       // arrangement par défaut : séquences qui se suivent en boucle
  chapitres?: Record<string, { nodes: string[] }>
}

type Sequence = { start: string; nodes: Record<string, Node> }

type Node = {
  instances: string[]                    // monté dans cet état
  out: Record<string, { to: string }>    // sorties nommées — les arêtes
  listen: ListenRule[]
}

type ListenRule =
  | { on: string; take: string }         // relais direct : cet event prend cette sortie
  | { on: string; do: string }           // glu : elle calcule, puis choisit une sortie

type InstanceDecl = {
  sceneId: string
  host?: string                          // "<instance>/<perso hôte>" ; absent = racine fournie par l'app
  generator?: string                     // nomme une fonction (paramètres) → SceneStoryDoc
  params?: Record<string, unknown>
}

type Handler = (input: {
  event: { from: string; name: string; data?: Record<string, unknown> }
  state: DeepReadonly<Record<string, unknown>>          // état central, vivant
  node: { id: string; instances: string[]; out: string[] }
}) => {
  state?: Record<string, unknown>
  send?: Array<{ to: string; event: StoryEvent }>
  take?: string                                        // une des sorties déclarées
} | void
```

### 7.3 Hypothèse « affichage dynamique »

Séquences déclarées, arrangement par défaut qui boucle, **calendrier absent du scénario** — il appartient
à l'app de diffusion, qui demande le lancement d'une séquence (§7.5).

```json
{
  "id": "signage",
  "sequences": {
    "promos-a": { "start": "v1", "nodes": {
      "v1": { "instances": ["vue-1", "promo-a", "promo-b", "promo-c"],
              "out": { "suivante": { "to": "v2" } },
              "listen": [
                { "on": "vue-1:vue:expiree",   "take": "suivante" },
                { "on": "promo-a:scene:end",   "do": "compteFins" },
                { "on": "promo-b:scene:end",   "do": "compteFins" },
                { "on": "promo-c:scene:end",   "do": "compteFins" }
              ] },
      "v2": { "instances": ["vue-2", "promo-d", "promo-e", "promo-f"], "out": {}, "listen": [] }
    }},
    "menu":  { "start": "m1", "nodes": { "m1": { "instances": ["vue-menu"], "out": {}, "listen": [] } } },
    "meteo": { "start": "w1", "nodes": { "w1": { "instances": ["vue-infos", "meteo-1", "meteo-2"], "out": {}, "listen": [] } } },
    "heure": { "start": "h1", "nodes": { "h1": { "instances": ["vue-heure", "horloge"], "out": {}, "listen": [] } } }
  },
  "defaut": ["promos-a", "promos-b"],
  "instances": {
    "vue-1":   { "sceneId": "layout-tiers" },
    "promo-a": { "sceneId": "promo", "host": "vue-1/zone-1" },
    "horloge": { "sceneId": "horloge", "host": "vue-heure/zone-1" }
  }
}
```

Le repli à 30 s n'est pas dans le scénario : c'est un eventime de `layout-tiers` émettant `vue:expiree` —
la faculté confiée à une scène (§6.4). La conjonction sur les fins de membres est une glu de Sighty,
parce qu'elle relève de la distribution :

```ts
compteFins: ({ event, state, node }) => {
  const finies = new Set(state.finies as string[] ?? []).add(event.from)
  const membres = node.instances.filter(id => id !== "vue-1")
  return finies.size < membres.length
    ? { state: { finies: [...finies] } }
    : { state: { finies: [] }, take: "suivante" }
}
```

Une séquence sans sortie restante est terminée ; l'arrangement enchaîne sur la suivante du défaut. Le
carrousel est **perpétuel** parce que `defaut` boucle, non parce qu'un node reboucle.

### 7.4 Hypothèse « e-learning »

Une seule séquence, dont le graphe porte les branchements. Le rattrapage est un **cycle visible**, pas une
règle enfouie.

```json
{
  "id": "parcours-secu",
  "seed": "a3f9c1",
  "sequences": { "parcours": { "start": "c1-cours", "nodes": {
    "c1-cours":      { "instances": ["cours-1"],      "out": { "suite": { "to": "c1-activite" } },
                       "listen": [{ "on": "cours-1:scene:end", "take": "suite" }] },
    "c1-activite":   { "instances": ["activite-1"],   "out": { "suite": { "to": "c1-quiz" } },
                       "listen": [{ "on": "activite-1:scene:end", "take": "suite" }] },
    "c1-quiz":       { "instances": ["quiz-1"],
                       "out": { "reussi": { "to": "c2-cours" }, "echec": { "to": "c1-rattrapage" } },
                       "listen": [{ "on": "quiz-1:quiz:termine", "do": "apresQuiz" }] },
    "c1-rattrapage": { "instances": ["rattrapage-1"], "out": { "suite": { "to": "c1-reprise" } },
                       "listen": [{ "on": "rattrapage-1:scene:end", "take": "suite" }] },
    "c1-reprise":    { "instances": ["reprise-1"],
                       "out": { "reussi": { "to": "c2-cours" }, "echec": { "to": "c1-rattrapage" } },
                       "listen": [{ "on": "reprise-1:quiz:termine", "do": "apresQuiz" }] }
  }}},
  "defaut": ["parcours"],
  "chapitres": { "c1": { "nodes": ["c1-cours", "c1-activite", "c1-quiz", "c1-rattrapage", "c1-reprise"] } },
  "instances": {
    "quiz-1":     { "sceneId": "quiz",     "generator": "quizDepuisBanque", "params": { "chapitre": "c1", "n": 5 } },
    "activite-1": { "sceneId": "activite", "generator": "activiteTiree",    "params": { "pool": "c1" } }
  }
}
```

La garde est un calcul, donc une glu — réutilisable par les deux nodes de quiz puisqu'elle ne nomme que
des sorties, et qui **accumule les tentatives** au lieu d'écraser :

```ts
apresQuiz: ({ event, state }) => {
  const score = event.data.score as number
  const tentatives = [...(state.tentatives as number[] ?? []), score]
  return { state: { tentatives }, take: score >= 70 ? "reussi" : "echec" }
}
```

### 7.5 Esquisse d'API

```ts
class Sighty {
  constructor(input: { engine: Engine; handlers: HandlerCollection; generators?: GeneratorCollection })

  useCatalogue(catalogue: SceneCatalogue): Result<void>   // déclaration détachée, partagée
  load(scenario: Scenario): Promise<Result<void>>          // revendique ses besoins au catalogue
  start(): Promise<Result<void>>
  destroy(): Promise<Result<void>>

  play(input: { sequence: string } | { scenario: string }): Promise<Result<void>>  // demande de l'app
  goto(nodeId: string): Promise<Result<void>>            // aller directement à une vue
  pause(): Promise<Result<void>>
  resume(): Promise<Result<void>>
  seek(input: { nodeId: string; ms: number }): Promise<Result<void>>   // portée = le node

  send(input: { to: string; event: StoryEvent }): Promise<Result<void>>   // injection dans une instance
  amend(patch: ScenarioPatch): Promise<Result<void>>     // modification venue de l'app amont

  getState(): SightyStateSnapshot
  onEvent(listener: (e: { from: string; name: string; data?: unknown }) => void): () => void
  onChange(listener: (s: SightyStateSnapshot) => void): () => void
}
```

Ces méthodes sont la **couche de commodité** : la décision « events comme contrat primaire »
(`../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` §4) veut que chacune corresponde à un message, la
méthode n'en étant que la façade typée.

*Réserve de nom* : ne pas appeler `play` → `diffuse`, « diffusion » désignant déjà la mise en circulation
de l'œuvre.

### 7.6 Ce que l'esquisse a dû choisir

Points arbitraires, à corriger plutôt qu'à hériter :

- **`host` comme chemin `"<instance>/<perso>"`** — il fallait une syntaxe d'adressage, celle-ci est
  arbitraire.
- **`listen` énumère ses sources une par une** — aucun caractère générique pour « tous les membres du
  node » n'a été inventé. C'est verbeux, mais la verbosité appartient à la couche **produite** par la
  transcription (§7.0), non à ce qu'un auteur écrit.
- **La glu écrit dans l'état central via `state`**, calqué sur le `update` d'un strap. Une autre voie
  serait qu'elle émette et que Sighty enregistre.
- **`amend` n'a pas de forme** : `ScenarioPatch` n'est pas esquissé, faute de savoir quelles
  modifications l'app amont émet.
- **L'énumération coûte** : un carrousel de trente vues fait trente nodes. Problème d'outil de
  construction, pas de modèle — l'app amont est là pour ça.

## 8. Points ouverts

- **Politique de survie** (§4) — non écrite.
- **Forme du scénario** — l'esquisse du §7 est une base de raisonnement, pas une proposition arrêtée ;
  voir §7.6 pour ce qu'elle a dû choisir arbitrairement. Elle n'accueille **pas** de primitive de
  conjonction, de temporisation ou de garde : ce sont des calculs, confiés à une scène ou à une glu (§6.4).
- **Politique d'arrangement** — quand l'app demande une séquence, celle en cours est-elle coupée ou
  attend-on la fin de la vue courante ? Comment le défaut reprend-il ensuite ? Responsabilité de Sighty
  (§4), politique non écrite.
- **Un chapitre est-il simplement une séquence ?** Les deux sont un graphe de nodes nommé. Troisième
  réponse possible au fork « étiquette ou node composite » — et **c'est ce fork qui décide du coût de
  l'accès par profil** (§6.3 bis) : chapitre-séquence, un profil est un simple arrangement ; sinon, un
  graphe par profil.
- **Nom du champ `defaut`** — il se lit comme un repli, ce qui convient au carrousel mais pas à un parcours
  d'apprentissage. S'il porte bien l'arrangement des séquences, il porte mal son nom.
- **Plusieurs écrans** (§6.3 ter) — un Sighty pour N écrans ou N Sighty ? La synchronisation tranche. Et
  une réplication est-elle en miroir ou indépendante ? La configuration réseau (un appareil = un écran) est
  **hors V1**, mais la V1 ne doit pas la fermer.
- **Ce que « cohérent » signifie pour une page** — au-delà du cas cité (pas de chargement en cours), la
  liste des conditions reste à établir.
- **Édition d'auteur : quelle voie pour quelle modification** (§6.4) — mise à jour en place ou
  reconstruction, et le sort des compteurs en vol.
- **Chapitre** (§6.4) — regroupement ordonné de pages, à poser comme structure de scénario.
- **Surface publique d'entrée** (§6.4) — ce qu'une scène déclare réglable du dehors ; versant symétrique
  de la surface de sortie, développé côté codplay (`../../codplay-v2/notes/2026-07-28-decoupage…` §8).

## Statut

Première intention, non normatif. Recueil de notions apparues en discutant le découpage de codplay, en
attente du détail que l'auteur donnera à Sighty — détail attendu **avant** le figement des specs codplay
V2, dont il conditionne la préparation, et non après.

Lié : `2026-07-26-meta-orchestrateur-preambule.md` (le cadrage du concept, et les trois niveaux à ne pas
confondre), `../../codplay-v2/notes/2026-07-28-decoupage-engine-instances-pilotage.md` (le versant codplay de la même
discussion), `../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` (§5 frontière auteur/diffusion, §6 façade multi-canaux).
