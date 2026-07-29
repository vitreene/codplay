# Découpage de codplay — engine, instances, pilotage

Axe **V2**. Le préambule méta-orchestrateur (`../../sighty/notes/2026-07-26-meta-orchestrateur-preambule.md`) posait qu'un
orchestrateur — nommé ici **sighty** — est un *client* de codplay, et que la seule exigence portée sur
codplay est d'être « orchestrable proprement ». Cette page instruit cette exigence : elle découpe
codplay en étages, dit ce qui est commun à N instances et ce qui appartient à chacune, fixe la nature
du canal de pilotage, et recense les dispositifs actuels qui ne peuvent pas être repris tels quels.

**Répartition à tenir** : cette page ne contient que ce qui incombe à **codplay**. Ce qui appartient à
l'orchestrateur — la forme du scénario, les notions de *page* et de *groupe*, les politiques de portée et
de survie — est dans `../../sighty/notes/2026-07-28-sighty-premiere-intention.md`, et n'est repris ici que comme référence.
Codplay ne connaît ni le mot *page* ni le mot *groupe* : il reçoit des ensembles d'instances.

## 1. Les trois étages

- **L'engine** — déclare les capacités communes à toutes les instances et détient les ressources
  partagées. Modèle explicitement visé : three.js, anime.js.
- **La factory de `CompiledScene`** — la compilation, en amont du player. Déjà séparée dans le code
  (`BuilderFacade` est pure, et `BroadcastPlayer` consomme un `CompiledScene` sans jamais importer le
  builder) ; le travail restant est de **packaging**, pas de refactoring.
- **L'instance** — un player, une scène, une racine de montage. N instances coexistent, côte à côte ou
  imbriquées (§5).

## 2. L'engine — ce qu'il porte

**Le catalogue** : les capacités déclarées une fois, consommées par les instances — types de perso,
modules, services, adapters, stratégies de preload, bindings de librairies tierces. Déclaratif, sans
état, coût nul à partager.

**Les ressources partagées** : horloge, cache de preload, styles injectés. Nature différente du
catalogue — ce sont des objets vivants, comptés, dont l'engine est le propriétaire.

**Contrainte de coût** : la déclaration est empressée et gratuite ; le substrat coûteux qu'une capacité
requiert (librairie chargée, modèle décodé, contexte GPU) est instancié **paresseusement à la première
demande**. Une instance qui n'emploie pas une capacité n'en paie jamais le prix.

**Le cache de preload est un bien commun de l'engine — la stratégie ne l'est pas.** La ressource
préchargée est partagée entre instances et comptée par références ; la décision de *quoi* précharger et
*quand* revient à qui sait à l'avance : un orchestrateur, qui tient la suite du graphe, ou un éditeur, qui
sait avant codplay ce qui est disponible (`2026-07-26-conduite-chantier-v2.md` §10 #2 le notait déjà pour
l'éditeur). **Le preload de codplay ne sert que la diffusion autonome**, quand rien n'existe au-dessus.

**Une même posture, trois fois** : l'horloge délégable, le catalogue déclaré au-dessus, la stratégie de
preload cédée. À chaque fois, codplay fournit un **défaut autonome** et s'efface devant un étage supérieur
quand il existe. Ce n'est pas trois décisions séparées mais une seule figure, qui gagnerait à être écrite
comme telle plutôt que redécouverte canal par canal.

**Contrainte d'ordre** : l'horloge de l'engine ordonne les ticks des instances. Pour des instances
imbriquées, l'ordre est **hôte avant hébergé** (§5). Ce n'est pas une optimisation mais une condition
de correction : une seule horloge peut ordonner des instances qui ne se connaissent pas.

**Le ticker doit pouvoir être confié à une entité extérieure** — même procédé que celui exigé des
bibliothèques tierces, employé dans l'autre sens. `v1-third-party-runtime-spec.md` §1 impose au tiers de
ne pas lancer son propre RAF et d'être avancé par codplay via `RenderAdapter` (`tick`, `prepareSeek`,
`seek`, `pause`, `resume`, `rateChange`, `stop`). L'engine doit savoir être à son tour le tiers : exposer
**cette même silhouette** pour qu'un hôte le pilote. Un seul contrat employé dans les deux sens, pas un
second dispositif.

- *La règle §1 est reformulée, non affaiblie.* « CodPlay est l'unique source d'avancement temporel » porte
  sur l'**unicité** de la source, jamais sur la propriété de la boucle. Une source, une seule — qu'elle
  soit celle de codplay ou celle de l'hôte. Deux boucles concurrentes restent interdites.
- *À ne pas confondre avec la couture existante.* `TimeTicker` accepte déjà un `FrameScheduler` injecté
  (`{ request, cancel }`, employé pour retomber sur `MessageChannel`) : là, codplay possède la boucle et
  demande la frame. Confier le ticker, c'est l'inverse — l'extérieur possède la boucle et appelle
  l'engine. Deux niveaux distincts.
- *La délégation se fait au niveau de l'engine, une fois, jamais par player.* Sinon l'ordre « hôte avant
  hébergé » n'est plus garanti : l'hôte appelle une fois par frame, l'engine conserve son ordonnancement
  interne.
- *L'hôte fournit des frames, il ne décide pas du temps.* `rate` et `pause` restent à codplay, qui dérive
  son temps de timeline du delta reçu — distinction `deltaMs` / `timelineDeltaMs` déjà posée par
  `v1-rate-spec.md`.

**Ce que l'engine ne porte pas** : la racine de mesure. Le nœud résolu depuis `CompiledScene.rootNodeIds`
est le conteneur *de la scène* ; deux scènes ont deux racines, et ce qui se résout relativement à la
racine se résout contre la sienne. État d'instance, sans exception.

Portée à ne pas surestimer : les unités de requête de conteneur (`cqw`/`cqh`…) sont le cas le plus
visible parce que **l'éditeur les emploie systématiquement**, mais elles ne sont pas la voie canonique —
une scène écrite à la main emploie les unités que l'auteur choisit. Ce qui est per-instance est la
racine elle-même, indépendamment du mécanisme qui s'y réfère.

## 3. Les modules — déclarés par l'engine, instanciés par chaque player

Un module est **déclaré par l'engine** et **instancié par chaque player**. Le partage d'une instance de
module entre players supposerait qu'il soit sans état, à la manière d'un strap ; ce n'est pas
souhaitable en pratique.

Conséquence : la duplication des petits modules est sans enjeu ; ce qui gagne à ne pas être redéclaré
est le substrat lourd d'une capacité (un avatar), et c'est précisément ce que la déclaration au niveau
engine règle.

## 4. Le canal de pilotage — les events comme contrat primaire

**Décision** : pour les canaux de la façade multi-canaux qui concernent l'orchestration — diffusion/telco,
injection externe, cycle de vie, observation — le **message est le contrat primaire**, non un transport
posé sur une façade de méthodes. Les appels de méthode restent possibles comme commodité écrite
par-dessus ; ce sont les events qui font foi.

**Motif** : codplay est déjà événementiel à l'intérieur. Faire sortir ce vocabulaire plutôt qu'exposer
une seconde surface de forme différente évite deux contrats à tenir synchronisés — la concurrence de
canaux que la conduite de chantier V2 (§4bis) veut éliminer. Le chemin retour (fin d'épreuve, résultat)
emprunte alors le même canal que l'aller, sans mécanisme supplémentaire.

**Le canal authoring est hors protocole.** Il rend des nœuds, des poses, des références vivantes ; il
est local et réservé à l'éditeur. La frontière du protocole rend structurelle une règle qui n'était que
documentaire.

**Règle de relecture** : *ce qui traverse le protocole est ce qui pourrait traverser un worker.* Si un
canal réclame une charge non sérialisable, ou bien c'est de l'authoring, ou bien il est mal placé.

**Prix assumé** : l'accusé de réception est un event de retour, jamais une valeur rendue. Un pilote
s'écrit donc comme une machine réagissant à des events, non comme un script linéaire.

### Le multi-scénario — une capacité émergente à rendre intentionnelle

**Émergente** : le track manager ne l'a pas prévue en soi. Elle existe parce que les pistes sont des séries
indépendantes et que les actions répondent à des noms — c'est une conséquence de deux propriétés, pas une
fonctionnalité conçue. Une capacité qui existe sans avoir de nom, cas voisin de la règle qui fait d'un
dédoublement le signe d'un concept manquant (`conduite-chantier-v2.md` §4.4). **La déclarer permet de la
structurer comme concept plutôt que de la subir comme effet de bord.**

**Application première : le multi-langue.** Les mêmes actions parcourent un **trajet distinct** d'une
langue à l'autre — durées différentes (une phrase n'a pas la longueur de sa traduction), placement des mots
différent. Ce qui varie n'est pas *ce qui est fait* mais *quand et où*. C'est la démonstration la plus nette
que l'action est indépendante de son émission, et que le multi-scénario relève de la production, non de
l'outillage.

**L'acquis, à rendre intentionnel** : une action répond à un **nom d'event**, jamais à un émetteur. Une
série d'events émettant les mêmes noms qu'un utilisateur pilote donc la scène à l'identique, sans que
celle-ci sache qui parle. C'est cette indépendance qui autorise **plusieurs lectures d'une même scène**.

**Le mécanisme de sélection existe déjà** : `track:activate` — celui qu'emploient les deux précédents
ci-dessous. Choisir une variante revient à choisir quelles pistes sont actives ; rien à construire de ce
côté.

**Le placement de la série est libre** : une piste ou plusieurs, au niveau d'une scène ou d'une story, ou
**injectée de l'extérieur**. Ce n'est donc pas une propriété de la piste que la lecture tient, c'est la
série d'events elle-même ; la piste n'en est qu'un support parmi d'autres.

**Ce que ça produit** — pour quiz-hunt : répondre à une question sur deux (lecture par l'absurde), ou
répondre tout-faux (lecture de test). Ce sont des **lectures** de l'œuvre, pas des modes de mise au point.

**Le précédent existe, doublé et déjà factorisé** : `QUIZ_HUNT_DEBUG_QUESTION_TRACK_ID` d'un côté, le
bouton « Auto » de `quiz-series-fame-scene.ts` de l'autre — « same model as quiz-hunt's Debug toggle », dit
le code. Dans les deux cas, une piste dédiée, inactive par défaut, activée par `track:activate`, émettant
les events qu'un utilisateur émettrait.

**Ce qui manque est l'intention, pas le mécanisme.** Le dispositif porte aujourd'hui le nom de « debug » et
tient à un bouton de démo, alors qu'il exprime une capacité générale du modèle. La rendre intentionnelle
suppose de pouvoir la **déclarer** ; où et comment reste ouvert, le placement libre de la série interdisant
d'en faire d'emblée une propriété d'un seul support.

**Rien à modifier en aval.** L'**horizon** — dont on pourrait croire qu'il dépend de la variante active,
puisque la durée d'une scène en dépend — est déjà traité en pratique : l'implémentation couvre le cas, seule
l'expression du concept est nouvelle. Et les **ressources** ne sont pas concernées du tout : le manifeste
est dérivé des persos de la scène et de leurs `src` (§2), un scénario change le trajet et non l'inventaire ;
le cache d'une ressource relève du preload, jamais du scénario.

C'est le propre d'une capacité émergente : **il n'y a rien à implémenter, il y a quelque chose à nommer.**

*Réserve de nom* : « scénario » désignerait deux choses — celui de l'orchestrateur, **entre** scènes, et
celui d'une série d'events, **dans** une scène. Même précaution que pour « diffusion ».

### La portée d'un event — du booléen à une échelle nommée

> **Termes provisoires.** `scope` et `world` désignent la forme, ils ne la nomment pas. **Proposition en
> attente d'arbitrage** : `visibility: 'story' | 'scene' | 'public'` — voir le critère de nommage plus bas.

`v1-event-spec.md` pose aujourd'hui un booléen : « `cascade: false` ou absent : domaine local story » ;
« `cascade: true` : publication globale vers `Scene` ». C'est **déjà une échelle à deux crans**, encodée en
booléen. La remplacer par une échelle nommée (`story` | `scene` | …) ne change rien au comportement
existant ; seul le cran supplémentaire est neuf. Un booléen ne pouvait pas l'accueillir — il aurait fallu
un second booléen, soit deux booléens pour trois niveaux ordonnés, le dédoublement que
`conduite-chantier-v2.md` §4.4 traite comme un concept manquant.

**Le cran supplémentaire signifie « sort de la scène », jamais « atteint les autres scènes ».** Position
confirmée par l'auteur : *les scènes ne communiquent pas entre elles, seul Sighty le fait — c'est sa
raison d'être.* Le cran rend l'event **visible du dehors** ; l'orchestrateur ou l'hôte applicatif décide
d'en faire quelque chose.

Dans cette lecture, ce cran **répond au point ouvert de la surface publique d'une scène** (§8) : un event
qui le porte est public, les autres ne le sont pas. Pas de mécanisme supplémentaire à inventer.

**Critère de nommage** : le cran supérieur n'a **pas de destinataire**. Tout vocabulaire de propagation —
`cascade`, `broadcast`, `diffusion` — suggère un trajet vers quelqu'un et induit en erreur. Ce que le cran
décrit est une **exposition** : l'event devient visible, rien n'est envoyé. Le mot est à chercher du côté
de la visibilité, pas du transport. Deux mots sont par ailleurs déjà pris : `world` a un sens spatial dans
codplay — `overlay-world` (mode de FLIP), `worldDeltaToLocalDelta`, `worldSizeToLocalSize`, l'espace de
coordonnées de mesure — et « diffusion » appartient à la frontière auteur/diffusion
(`2026-07-27-emetteurs-et-events-user-complexes.md` §6.6).

**Proposition** (non tranchée) : `visibility: 'story' | 'scene' | 'public'`.
- `public` dit exactement « visible du dehors, sans destinataire », et sa connotation de modificateur
  d'accès sert la sémantique — un membre public n'est envoyé à personne, il est accessible. Il reprend le
  vocabulaire de « surface publique d'une scène » (§8), si bien que le point ouvert et sa réponse portent
  le même mot.
- `visibility` nomme l'axe sans évoquer de trajet, là où `scope` glisse vers « où un nom se résout » et
  « portée » vers la distance.
- *Réserve* : le registre est mixte — `story` et `scene` sont des noms de structure quand `public` est un
  adjectif. Cohérent si les trois se lisent comme des niveaux ; un registre homogène demanderait trois
  noms de lieux (`story | scene | dehors`), au prix d'un cran supérieur plus vague.

**Verrou à préserver** : `v1-event-spec.md` pose que `transform` ne modifie jamais `cascade`. Une portée
réécrivable en aval ne garantirait plus rien — c'est ce verrou qui la rend digne de confiance.

### Fins narrative et technique — vocabulaire déjà normatif

`v1-scene-spec.md` §9 distingue déjà les deux fins qu'une narration demande, et il faut employer ses noms :

- **`scene:end`** — event auteur explicite, **fin métier**, qui « n'implique pas nécessairement l'arrêt des
  events restants » : une scène peut l'émettre puis continuer avec des stories de fin, **des attentes
  d'interaction**, d'autres events techniques.
- **`sequence:end`** — **fin technique**, terminale, point de départ du cleanup implicite (dont l'arrêt des
  médias actifs). `Scene.onSequenceEnd(scene, options)` est le point d'accroche prévu pour l'application
  hôte ; la spec précise qu'il ne sert pas à monter une story de fin, ce qui relève de `scene:end`.

Le retrait DOM est un **acte de nettoyage** : il suit la fin narrative, qui peut se produire bien avant.
L'intervalle entre les deux peut être une boucle d'attente — et il n'exige aucun mécanisme neuf :
`v1-strap-helpers-spec.md` pose que `sequence:end` interrompt toujours tous les loops actifs, donc
l'action utilisateur qui émet `sequence:end` arrête la boucle de suspend sans `until` explicite.

**Conséquences pour l'orchestration** (reprises côté Sighty) : c'est `sequence:end` que l'orchestrateur
écoute, `scene:end` restant interne ; l'intervalle entre les deux n'étant pas connaissable d'avance, la
durée d'une page ne l'est pas non plus ; et passé `sequence:end` le player rejette `pause` et `emit`
(`player/create-player.ts:2216` et `:2254`), donc une instance n'est plus pilotable — seulement
destructible.

### L'event de fin d'une séquence — `endEmit` libéré de `endOn`

Autre échelle que les deux fins ci-dessus — la sortie d'un **élément**, pas de la scène — mais **même
mécanisme logique**, ce que l'exemple de `scene:end` sert à montrer. Une transition de sortie s'anime par
chaînage d'actions, puis retire l'élément. Le chaînage existe : `v1-action-sequence-spec.md` définit
`ActionSequence`, primitive de chaînage par durée propre où chaque étape démarre où la précédente s'est
terminée. **Ce qui lui manque est de déclarer sa fin.**

Déclarer cette fin comme une source d'`emit` **n'est pas un concept neuf** : c'est `endEmit` libéré de
`endOn`, mécanisme central de `2026-07-27-emetteurs-et-events-user-complexes.md` §2.3. Aujourd'hui
`endEmit` n'existe que sur la capture, déclenché par un event natif listé dans `endOn`
(`v1-capture-spec.md`). Généralisé, il devient : *émettre sur la transition d'une phase déclarée* — et la
fin d'une `ActionSequence` est une telle phase.

**Deux formes envisagées, et l'arbitrage.**

*Forme 1 — la propriété comme déclencheur.* L'action reste telle quelle (un tableau d'actions enchaînées)
et `move:off` est ajouté dans `emit` : une propriété d'action devient un event émis. Exige de **déclarer
quelles propriétés peuvent émettre**.

*Forme 2 — le nom d'action comme déclencheur*, calquée sur la capture :

```
actions: { sortie: [ ..., { move: off } ] }
emit:    { sortie: { onStart, onEnd } }
```

**La forme 2 est retenue.** Argument décisif : la forme 1 exige un concept neuf — une liste blanche de
propriétés émettrices, dont la justification (« une propriété terminale ») serait un concept caché à
nommer et maintenir. La forme 2 n'en exige aucun : ce qui peut émettre est une **séquence déclarée**, donc
l'ensemble des sources admissibles est défini par construction, pas par énumération.

Raisons secondaires convergentes :
- *Granularité juste.* Émettre sur `move:off` émet au moment où cette étape s'applique, non à la fin de la
  séquence ; les deux coïncident seulement parce que l'étape est la dernière. Réordonner la chaîne
  déplacerait l'émission en silence. `onEnd` est la fin quelle que soit la dernière étape.
- *Un seul patron.* Même silhouette que la capture, donc pas deux dispositifs d'émission dans le code. Et
  c'est littéralement la formule du doc émetteurs : émettre sur la transition d'une phase déclarée.
- *`onStart` inexprimable en forme 1* — une propriété qui s'applique n'a pas de début.

**La forme 2 donne une place à l'interruption, sans la résoudre encore.** Ce que vaut « fini » quand la
séquence est remplacée en vol cesse d'être une ambiguïté de convention pour devenir une **phase** —
`onAbort`. C'est là que la réponse se logera ; elle n'est pas écrite.

**Jeu de phases retenu pour l'instant : `onStart` et `onEnd`.** Le reste (`onAbort`, et au-delà) est
possible mais non retenu — surdimensionné à ce stade.

**Règle d'admission d'une phase** : *seules les transitions d'une phase déclarée émettent.* Elle tranche
les candidats sans discussion au cas par cas :

- `onStart`, `onEnd`, `onAbort` sont des **transitions** — admissibles.
- `onError` est une **issue**, non une transition : codplay a déjà un canal pour elle, le moteur de warning
  que §4.7 place hors du chemin chaud, orienté compréhension auteur. L'ajouter par symétrie de nom
  ouvrirait un second canal d'erreur, soit la concurrence que §4bis veut éliminer.
- `onUpdate` est un **échantillonnage**, non une transition — refusé. Un `onEnd` dit déjà « ce temps est
  écoulé » ; signaler chaque changement de la valeur affichée d'un compteur rouvrirait le **canal continu**
  que le doc émetteurs refuse par principe, avec le risque évident d'un détournement à 60 events/seconde.
  Ce dont il tient lieu s'exprime autrement : une action de **segment répétée N fois**, dont chaque
  `onEnd` marque une unité (§8). La cadence est alors **déclarée** — un compte visible dans la donnée — au
  lieu d'être liée au rythme d'affichage.

**Et la raison de fond** : *ce qui s'évalue ne s'émet pas.* La valeur affichée est `f(t)`, lue par la
projection à chaque tick ; émettre « la valeur a changé » ferait transiter par le canal d'events ce qui est
déjà disponible par évaluation. Le canal d'events porte des **transitions**, l'évaluation porte des
**valeurs**.

**Un cycle d'émission se détecte au build.** `emit: { sortie: { onEnd: <event qui redéclenche sortie> } }`
est un **arc du graphe d'émission** : une fois les émissions déclarées, le cycle est dans la donnée. Le
trou existe déjà et le motif est facile à écrire par mégarde ; il se ferme **à la compilation**, jamais par
une garde au runtime (§4.7 interdit le code défensif sur le chemin chaud — une boucle infinie n'a pas à
être rattrapée à chaud, elle a à ne pas être livrée). Nuance : un cycle **différé** est un métronome
légitime, relevant du warning en mode auteur ; un cycle **immédiat** est toujours un défaut, relevant d'un
rejet franc.

**Deux régimes selon la phase** :
- *Déterminable à la compilation* — `onEnd` d'une séquence par durées est une somme d'offsets, donc le
  builder peut **placer** l'event comme un eventime ordinaire. Alimente la question ouverte §4.6 de la
  conduite de chantier (jusqu'où la compilation résout).
- *Indéterminé jusqu'à l'exécution* — un `onAbort` le serait, comme la clôture d'une capture ou d'un
  émetteur.

**Forme à préciser** : la valeur d'une phase devrait être un `StoryEvent`, comme l'est `endEmit`, et non un
nom nu — même contrat d'event que partout, et le nom émis reste choisi par l'auteur, sans dériver
`sortie:end` du nom de la séquence (ce serait une convention de nommage non déclarée). Lecture retenue de
l'exemple : `emit` est un frère d'`actions` sur le perso, indexé par nom d'action.

**Simplification à la clé** : le retrait de l'élément cesse d'être une étape spéciale de la chaîne — il
devient une réaction ordinaire à l'event de fin. La séquence anime et déclare sa fin ; autre chose retire.

**Bénéfice collatéral du nommage** : `sortie` devient adressable. L'interruption par remplacement prévue
par `v1-action-sequence-spec.md` cesse d'être « remplacer ce qui tournait » pour devenir « remplacer
`sortie` ».

### Ce que la nature du pilote impose ici

L'orchestrateur est une **machine à états**, pas une fonction du temps (développé dans
`../../sighty/notes/2026-07-28-sighty-premiere-intention.md`). Deux conséquences portent sur codplay, et seulement deux :

- **Aucune demande ne traverse une transition d'état du pilote.** Il n'existe donc pas de portée de seek
  au-delà d'un ensemble d'instances simultanément montées (§6) ; codplay n'a pas à prévoir de « seek
  global ».
- **La forme du scénario ne le concerne pas.** Que le pilote lise un objet sérialisable et nomme des
  "straps" à la manière de codplay est son affaire ; codplay ne voit que des events entrants et
  sortants.

## 5. Le mode hôte — une instance jouée dans une autre

Un composant est désigné pour héberger une instance codplay. Il est géré par sa scène comme tout perso
— positionné, animé, montré, caché — et **ignore la nature de son contenu**. Cas d'usage : une scène
sert de *layout* à d'autres scènes qui jouent chacune de façon indépendante ; l'ensemble est géré par
sighty.

**Le concept et son nom existent déjà** : `2026-07-27-emetteurs-et-events-user-complexes.md` §6 pose le
**perso hôte** pour le flux direct — « seul l'hôte du flux suit les conditions ordinaires d'un perso »,
« le perso hôte ne fait pas la différence ». L'instance imbriquée est un remplisseur de plus, pas un
mécanisme rival.

**Ce que les remplisseurs partagent** : le contenu n'est pas fonction du `t` de l'hôte. Ils diffèrent
en aval, et cette différence ne regarde pas l'hôte.

| remplisseur | contenu | connu de sighty |
|---|---|---|
| instance imbriquée | à son propre `t`, indépendant de celui de l'hôte | oui — adressable, pilotable, seekable |
| flux direct | à `now`, aucun `t` | non — hors du modèle, ni seek ni `rate` |
| composant tiers, avatar | selon sa librairie | selon le composant |

**Discriminant à ne pas confondre avec le précédent** : *hors du `t` de l'hôte* n'implique pas *hors du
modèle*. Une instance imbriquée échappe au `t` de son hôte tout en restant entièrement dans le modèle —
sighty la connaît, l'adresse et la pilote. Un flux direct échappe aux deux : rien ne le pilote hors du
couper/lire adressé à son perso hôte. C'est cette seconde ligne, non la première, qui commande la
reproductibilité (ci-dessous) et la portée d'un seek de page (§6).

**Effet sur le montage** : la cible de montage devient adressable dans le modèle (le scénario nomme un
hôte, pas un nœud). Il subsiste exactement une échappatoire DOM, à la racine : la scène-layout, que
l'application monte.

**Invariant** : rien ne traverse l'hôte. Il expose une *surface*, pas une API de son contenu. La scène
hôte n'émet pas vers l'intérieur, la scène hébergée ne remonte pas par le parent ; tout le trafic entre
scènes passe par sighty. Sans cet invariant, l'hôte redevient un tuyau et l'autonomie des scènes —
l'acquis que le préambule protège — est perdue.

**Ce qui traverse par nature, et sa discipline** :
- *Géométrie* — la surface change de taille. L'instance hébergée **observe sa propre racine**
  (comportement qu'elle a déjà) ; le parent ne la notifie pas.
- *Cycle de vie* — l'hôte **signale sa surface** (apparaît, disparaît, se redimensionne) sans jamais
  désigner un contenu. Sighty décide de la conséquence sur l'instance hébergée.

**Le régime se déclare, il ne s'infère pas** — règle de §6.4 du doc émetteurs, appliquée telle quelle.
Ce qui y désactive la resynchronisation de `currentTime` du composant media vaut ici contre toute
prétention de l'hôte à piloter le temps de l'instance hébergée.

**Au seek, la part de l'hôte est déjà arrêtée** (§6.3 du même doc) : le seek rétablit l'état de l'hôte
et ne touche pas au contenu. Ce qui reste ouvert est la politique de sighty, pas la frontière (§8).

**Une transition ne dédouble jamais une instance vivante.** La simultanéité de deux contenus se règle par
codplay, à deux échelles :
- *Dans un élément* — le **clone transitoire**, déjà en place : le module `replace` ouvre une
  `CloneSession` (`runtime/modules/replace/apply-simple.ts` : `cloneA`/`cloneB`, original masqué,
  positionnés dans le parent le temps de l'animation), employée par `replace-carousel-scene.ts` avec
  `{ transition: "swipe-left", duration: 500 }`. Le clone **ne reçoit plus d'events** : élément neutralisé,
  figé dans son apparence, voué à disparaître très vite.
- *D'une vue à l'autre* — la **succession de deux conteneurs**. Maintenir deux instances, passée et future,
  n'est pas la bonne méthode : c'est un carrousel dont deux éléments conteneurs se succèdent, persos
  ordinaires du layout.

Conséquence pour le multi-instances : aucune superposition d'instances n'est requise par une transition.

**Reproductibilité — l'hébergement ne l'entame pas.** §6.3 note qu'une scène portant un flux direct
n'est pas reproductible d'une lecture à l'autre, donc ne peut servir de scène de référence
anti-régression. La conséquence ne se transpose **pas** à l'hébergement : tous les membres d'une
scène-layout sont `f(t)` et connus, donc la composition est reproductible dès lors que le séquencement de
sighty est lui-même déterministe. Ce qui interdit la scène de référence est le contenu hors modèle (le
flux), pas le contenu hors du `t` de l'hôte.

## 6. Seek à instances multiples — la capacité que codplay doit fournir

Le telco admet des **portées** : une instance, ou un ensemble d'instances. Codplay ignore la provenance
d'un ensemble — déclaré par un scénario (*page*) ou composé à la demande par un éditeur (*groupe*), c'est
pour lui la même chose. Les deux notions appartiennent à l'orchestrateur et à l'atelier ; voir
`../../sighty/notes/2026-07-28-sighty-premiere-intention.md`.

**La capacité, en une phrase** : seeker **atomiquement** un ensemble d'instances vers **une cible par
membre**, et ne présenter qu'une fois.

**Cible par membre, jamais cible commune.** Chaque instance a son `t` et sa durée. Codplay reçoit les
cibles, il ne les calcule pas : la comptabilité qui les produit (origine de temps de l'ensemble, décalage
de chaque membre, inscrits au montage) est hors de lui.

**Pourquoi le niveau engine.** L'atomicité. N events `telco:seek` indépendants feraient atterrir les
membres sur des frames différentes. Seul l'engine tient l'horloge et l'ordre de tick, donc seul lui peut
reconstruire N instances *puis* présenter une seule fois. L'engine fournit le mécanisme et ne devient pas
orchestrateur pour autant — même partage qu'au §5 : l'engine exécute, l'orchestrateur décide.

**Le fan-out est hétérogène, et déjà résolu.** L'ordre se diffuse ; chaque membre applique le régime
qu'il déclare (§6.4 du doc émetteurs) : une instance imbriquée seeke, un flux direct reste à `now`. Aux
bornes, deux comportements distincts et non symétriques : une cible **au-delà** de la fin technique du
membre le **borne** — `v1-scene-spec.md` §9 pose qu'en seek `sequence:end` n'est pas jouée, elle borne
seulement la projection du replay — tandis qu'une cible **antérieure à son montage** demande un
démontage. Rien à arbitrer dans le mécanisme — l'axe qui
gouverne cette hétérogénéité est celui du §5, un ensemble est seekable à la mesure de ce que
l'orchestrateur **connaît** de lui ; un flux y est un trou sans invalider le seek des autres membres.

**La disponibilité est un statut par portée, pas un booléen.** Un ensemble n'est seekable que **stable** :
tous les membres montés, aucun chargement en vol, aucune transition pendante. Sinon le seek est refusé ou
mis en file, jamais exécuté à moitié. C'est le remplacement du `commandInFlight` du telco (§7.8) — un
booléen par player suffit à un doigt humain, pas à une portée.

**Le démontage est exécuté ici, décidé ailleurs.** Un membre dont la cible précède son montage ne peut
aller à un `t` négatif. Codplay sait démonter ; qui doit disparaître est une politique d'orchestrateur,
et c'est la même que celle déjà ouverte au §8 pour le mode hôte — réclamée par deux chemins indépendants.

**Un membre passé sa fin technique n'est plus pilotable.** Le player rejette `pause` et `emit` après
`sequence:end` (`player/create-player.ts:2216` et `:2254`) et verrouille la séquence. Une portée peut donc
contenir des membres devenus inatteignables par ordre ; le seul geste qui leur reste est la destruction.
À prendre en compte dans la disponibilité par portée plutôt qu'à découvrir par un rejet.

**Prérequis déjà acquis, à reconnaître comme tel.** `2026-07-26-portabilite-contrainte-redaction.md`
tranche que le seek V2 est **synchrone**, l'asynchronisme étant une dette V1 du rejeu que `f(t)` solde.
Le seek d'ensemble en fait une *condition* : N instances ne sont atomiquement cohérentes que si leur
reconstruction ne rend pas la main entre-temps. La décision se trouve renforcée par un second motif,
indépendant du premier.

## 7. Points risqués — à ne pas reprendre tels quels

Constats vérifiés dans le code V1. Ce sont des dispositifs à refaire, pas des bugs à corriger sur place.

1. **Racine de mesure en portée de module** (`runtime/components/lib/container-query-units.ts:16`, écrite
   depuis `player/player.ts:288`). La seconde instance écrase la racine de la première. Faux entre
   instances côte à côte, faux aussi entre instances imbriquées — où le mauvais nœud est celui du parent.
   Le symptôme se manifeste aujourd'hui par les unités `cq*`, mais le défaut porte sur la racine, pas
   sur ce mécanisme.
2. **`activeListDndModule`, singleton de module** (`runtime/modules/list-dnd/create-list-dnd-module.ts:635`).
   Deux scènes employant le glisser-déposer se marchent dessus.
3. **Cache de preload global sans compteur de références** (`preload/preload-cache.ts:3`). Le partage
   entre instances est souhaitable ; c'est la libération qui manque de propriétaire —
   `create-preload-module.ts:162` libère des URLs qu'une autre instance peut encore employer.
4. **Une horloge par player** (`player/create-player.ts:204`). N boucles indépendantes, donc aucun ordre
   garanti entre instances — rédhibitoire pour le mode hôte (§5).
5. **Catalogue câblé en dur** (`runtime/components/runtime-component-orchestrator.ts:117-135`) : services,
   classes de composants et quatre `registerModule` littéraux. Le mécanisme d'enregistrement existe,
   c'est son alimentation qui est figée.
6. **`RuntimeModule` nomme deux types distincts** — `runtime/components/types.ts:348` (déclaration avec
   `install(host)` : `move`, `list`, `replace`, `list-dnd`) et `runtime/module-system/types.ts:44`
   (instance par item, cycle `init/start/update/render/destroy`, cas de l'avatar). Le second n'est
   importé par aucun code, bien que spécifié (`v1-author-api-spec.md`). L'homonymie fusionne déclaration
   et instance : la règle du §3 n'est aujourd'hui pas même exprimable dans le vocabulaire du code.
7. **`ThirdPartyBinding` déclaré au niveau player** (`player/third-party-binding.ts`, via
   `CreatePlayerOptions.bindings`). C'est le point d'injection des librairies tierces, donc matière
   d'engine, déclaré à l'étage du dessous : deux instances enregistrent la librairie deux fois.
8. **`commandInFlight`, booléen de garde du telco** (`telco/types.ts`). Suffisant pour un pilote humain
   qui clique, insuffisant pour un orchestrateur envoyant plusieurs events d'affilée à plusieurs
   instances. L'ordonnancement doit devenir une règle déclarée, et la disponibilité un statut **par
   portée** (§6), pas un booléen par player.

9. **Le builder infère au lieu de déclarer** (`builder/extract-resource-manifest.ts`). `inferType(url)`
   déduit le type d'une ressource de son **extension de fichier**, via une table `TYPE_BY_EXT` **codée en
   dur** — sur le chemin même de la déclaration de besoins (§2). Contredit deux invariants directeurs
   (`conduite-chantier-v2.md` §11.2 « déclarer, jamais inférer » et §8 « rien en dur »). **Décision** : la
   table va en configuration.

Rappel de la conduite de chantier V2 (§4.3) : trois des six modules runtime échappent au contrat et sont
appelés **nominativement** depuis `create-player`. On ne peut pas déclarer au niveau engine ce que le
player appelle par son nom — **cet audit est un prérequis du catalogue**, pas un chantier parallèle.

## 8. Points ouverts

- **`context.live` face à `f(t)`** — la dissonance la plus centrale relevée (§9). Le couple
  `planned`/`live` précède la décision « l'état est une fonction de `t` » et n'a pas été relu contre elle :
  un helper `live` se déclenche occurrence par occurrence au runtime, donc **n'est pas évaluable**.
  - *Pourquoi la V1 s'en sort* : chaque occurrence est **matérialisée quand elle tombe**, et le seek rejoue
    les entrées de piste dans l'ordre. Le rejeu séquentiel fait le travail à la place du calcul. La V2
    supprime ce rejeu : il n'y a plus rien à reproduire, seulement un état à évaluer — et une suite
    d'occurrences n'est pas un état.
  - *Le modèle de remplacement existe et il est normatif* : **`TweenAction`**
    (`v1-tween-action-spec.md`) — action animée par une **fonction pure du progrès**, déclarée dans les
    `actions` d'un perso, évaluée à chaque tick par le `TweenRunner`, et « seek-compatible **par
    construction** », le seek ré-évaluant la fonction à la position cible sans ré-exécuter de strap. Or
    `live` est **principalement destiné aux compteurs et chronomètres** : un chronomètre est
    `fn(progress) → temps écoulé` sur une durée déclarée ; un compteur est `fn(progress) → floor(progress
    × n)`, la discrétisation vivant **dans la fonction** et non dans une suite d'events.
  - *La substitution, en une phrase* : `live` émet N events pour faire bouger un nombre ; un tween fait du
    nombre une **fonction de `t`**. Les events n'ont jamais été l'objet — la valeur affichée l'était.
  - *Et si des tops sont nécessaires, ils se déclarent en segments.* Deux actions sur le même perso, pour
    deux natures : l'une **possède le compteur** et porte sa valeur (`f(t)`, évaluée, aucun event) ;
    l'autre ne couvre qu'un **segment**, action atomique **répétée N fois**, dont chaque `onEnd` dit
    « une unité s'est écoulée ». La valeur s'évalue, les tops se déclarent — ni `onUpdate` ni `live`.
    - *La cadence devient déclarée, plus subie.* `onUpdate` aurait lié l'émission au rythme d'affichage,
      propriété du runtime et sans borne ; un segment répété la lie à un **compte**, propriété d'auteur
      et visible. Pour obtenir 60 events/seconde il faudrait déclarer soixante segments par seconde :
      l'absurdité est dans la donnée, inspectable et signalable au build.
    - *La répétition est du `planned`* — matérialisée en avant, évaluable, compatible au seek ; le
      vocabulaire l'a déjà (helpers `planned`, chaînage d'étapes au niveau perso). La forme exacte est un
      détail d'écriture ; ce qui compte est que les bornes soient déclarées, l'horizon en devenant juste.
    - *Alternative sûre au cycle d'émission* (§4) : un segment répété N fois n'est pas un `onEnd` qui se
      redéclenche, c'est une répétition bornée déclarée d'un coup. Le motif dangereux dispose donc d'une
      expression exacte de la même intention — meilleure protection qu'un garde-fou.
  - *L'interruption existe* : un chronomètre s'arrêtant sur une action utilisateur se déclare avec une
    durée maximale et s'interrompt par `tween:stop` (référencé par `v1-action-sequence-spec.md`).
  - *Frontière à tenir* : `fn` est pure et ne lit pas l'état runtime. Un compteur **de temps** est un
    tween ; un compteur **d'occurrences** (trois bonnes réponses, deux tentatives) n'en est pas un — c'est
    du `state`, mis à jour par events. Le mot « compteur » confond deux choses.
  - *L'horizon se retourne* : un tween a une fin connue, donc il repousse l'horizon là où `live` ne le
    faisait pas. Ce n'est pas une perte — ce que `live` protégeait n'était pas « ne pas repousser
    l'horizon » comme objectif, mais « ne pas projeter une fin qu'on ignore ». Une fin déclarée *doit*
    compter dans l'horizon.
  - *Reste alors un seul cas* pour lequel un `live` serait encore nécessaire : une périodicité dont la loi
    dépend d'un état calculé au fil de l'eau. Ni chronomètre ni compteur — à vérifier en listant les usages
    réels dans les démos, pas en spéculant. Si un tel cas subsiste, il rejoint les **irréductibles** : le
    modèle général l'accueille alors par une **fenêtre de validité** (ouverture matérialisée, fermeture
    résolue par l'event d'arrêt, compte calculé entre les deux), mécanisme que
    `2026-07-26-etat-fonction-de-t.md` réserve déjà aux dimensions discrètes.

- **Frontière de bundle de la factory** : sighty envoie-t-il des `SceneDoc` (chaque instance compile,
  le builder est dans le bundle de diffusion) ou des `CompiledScene` (le builder est chez
  l'orchestrateur, ou hors-ligne) ? Décide aussi qui porte le `ResourceManifest` quand N scènes
  partagent des ressources.
- **Surface publique d'une scène** : une scène doit pouvoir signaler « épreuve terminée, score 42 » sans
  savoir que Sighty existe. Cela suppose qu'elle déclare **quels de ses events remontent**, distincts de
  son vocabulaire interne. C'est l'interface d'une scène réutilisable ; question symétrique de celle des
  émetteurs (quels events entrent). **Piste retenue** : le cran supérieur de `scope` (§4) *est* cette
  déclaration ; reste à en fixer le nom. Les cas d'usage
  (`../../sighty/notes/2026-07-28-sighty-premiere-intention.md` §6.4) montrent qu'un enchaînement peut porter sur la fin
  narrative comme sur la fin technique — constat d'usage, sans conclusion sur la répartition de la
  décision, que les conventions d'écoute de l'orchestrateur trancheront.
- **Surface publique d'entrée** — versant symétrique du précédent, non traité : par quoi une scène qui joue
  est-elle réglable du dehors (changer une valeur, une image) ? Deux voies, non tranchées — l'**injection
  directe** visant un élément, pour laquelle une convention existe déjà (`v1-event-spec.md` : « le cas
  `event.name === perso.id` reste la convention la plus directe pour désigner sans ambiguïté un perso
  cible »), ou une **déclaration explicite** par la scène de ce qui est réglable. Cas d'usage à l'origine :
  `../../sighty/notes/2026-07-28-sighty-premiere-intention.md` §6.1.
- **Seek du parent en mode hôte** : la part de l'hôte est arrêtée (le seek rétablit son état, sans
  toucher au contenu — §6.3 du doc émetteurs). Reste la politique de sighty : ce qu'il advient de
  l'instance hébergée quand la surface disparaît (détruire, recréer, laisser). La frontière est tranchée,
  la politique reste à écrire. **Réclamée aussi par le seek d'ensemble** (§6), qui démonte un membre dont
  la cible précède son montage. Politique d'orchestrateur, hors de cette page.
- **État central et portées** — non tranché, noté au stade de la remarque. Un état central tenu par
  l'orchestrateur (`../../sighty/notes/2026-07-28-sighty-premiere-intention.md` §4), injecté par events et lu en seule
  lecture par les scènes, pose trois questions côté codplay :
  - *Ce qui est déjà acquis* : la lecture seule n'est pas une discipline neuve — un strap reçoit déjà son
    `state` en `DeepReadonly`. Ce qui change est la **provenance** des valeurs, pas la forme d'accès.
  - *Le risque structurant* : un état lisible par toutes les scènes est un canal partagé, soit ce que
    l'invariant du §5 interdit. Ce qui le rend acceptable est le mode d'arrivée. **Par event**, la valeur
    est matérialisée sur la piste, donc rejouée au seek et restée dans `f(t)` — et la scène demeure
    rejouable seule, son autonomie préservée. **Par abonnement direct** à un magasin vivant, elle échappe
    à la piste et devient une seconde source de vérité hors timeline. La ligne est là.
  - *Les portées* : le niveau central gagne à être un **espace de noms distinct** plutôt qu'un maillon
    d'une chaîne de résolution — sinon un renommage en amont change silencieusement ce qu'une scène lit.
    Cas à part : l'**état de capture** n'est pas une variable mais un tampon de travail, ouvert au geste et
    clos à `endCapture` ; le ranger dans le même espace fusionnerait deux durées de vie et deux
    propriétaires.
- **La lecture arrière comme capacité** — à examiner, sur le modèle de ce qu'autorise anime.js, ce qui
  s'inscrit dans le rapport que la V2 entretient déjà avec cette bibliothèque (emprunter la forme d'API,
  rejeter le runtime à état). État actuel : le telco offre saut, pause et multiplicateur de vitesse ;
  `setRate` ne garde pas contre une valeur négative mais rien n'en établit le support, et un élément média
  ne se lit pas à l'envers.
  - *Le modèle V2 la rend structurellement bon marché.* Si l'état est `f(scène, t)`, lire à l'envers c'est
    évaluer avec un `t` décroissant : rien à rembobiner, une variable qui décroît. La V1 la rendait
    difficile parce que le seek y est un rejeu ; la V2, où il est une évaluation, la met à portée.
  - *C'est un régime de lecture à concessions déclarées*, non une tentative de fidélité :
    - **Les events utilisateur n'y ont pas d'objet.** Dans le modèle `f(t)`, une interaction résout une
      indétermination en écrivant dans la scène ; en marche arrière on retraverse un temps **déjà
      déterminé**, il n'y a plus rien à résoudre. Fermer le canal d'interaction est la conséquence du
      régime, pas une amputation — la lecture arrière est un phénomène de lecture, pas d'interaction.
    - **Le média se simule.** Aucun élément média ne se lit à l'envers ; un échantillonnage
      stroboscopique le remplace — quelques images fixes par seconde prises à reculons (ex. 3 im/s). C'est
      le geste que le seek pratique déjà, une assignation de position, simplement répétée. La cadence
      relève de la configuration, pas du code.
    - **Le reste est déjà réglé** : les effets à side-effect ne se rejouent pas (vrai du seek, vrai à
      reculons) ; un flux direct reste à `now`, son régime déclaré ne change pas.

    D'où le seul apport neuf réellement exigé : **déclarer ces concessions**, comme le flux direct déclare
    les siennes.
  - *Ce que la capacité remplacerait.* `mashup-back-and-fore-scene.ts` produit aujourd'hui un faux
    aller-retour sans jamais seeker : `buildReverseIllusionSchedule` **réécrit l'horaire** — duplication de
    la fenêtre, mime du retour, rejeu en avant, décalage de toute la queue
    (`SEQUENCE_END_MS = MASHUP_END_MS + TOTAL_SHIFT_MS`). Quatre séries y passent séparément, chaque média
    reçoit des ordres de rembobinage à `startAt` calculé, le tout codé en dur. **L'effet allonge la durée
    de l'œuvre** : c'est cette déformation qu'une capacité de lecture arrière supprimerait.
  - *Détail de mécanique* : un seek arrière reconstruit l'état sans réexécuter straps ni effets. Le visuel
    revient ; ce qui doit se refaire entendre passe par la piste et le média, jamais par un strap.
  - *À ne pas confondre avec l'usage méta qui l'a fait surgir* : cet effet d'aller-retour ne se justifie
    que dans une démo expliquant le fonctionnement de codplay. L'exception n'entame pas la prémisse de
    `2026-07-27-emetteurs-et-events-user-complexes.md` §6.3 (« l'œuvre diffusée se joue en avant »), qui
    tient pour les œuvres.
- **Authoring hors protocole** : un éditeur ne pilote que des instances locales. Acquis pour ed2 ; ferme
  la porte à un éditeur distant, horizon non tranché.

## Statut

Axe V2 ouvert, non engagé en code. Tranchés par l'auteur : modules déclarés par l'engine et instanciés
par chaque player (§3) ; events comme contrat primaire (§4) ; mode hôte par composant ignorant son
contenu (§5) ; telco à portées et seek atomique sur un ensemble d'instances (§6). Le §7 est à traiter
dans tous les cas — ces dispositifs sont déjà faux dès qu'un éditeur monte un second player,
indépendamment de l'orchestrateur.

Lié : `../../sighty/notes/2026-07-26-meta-orchestrateur-preambule.md` (le niveau au-dessus, dont cette page instruit
l'exigence), `2026-07-26-conduite-chantier-v2.md` (§4.3 audit des modules, §4bis concurrence de canaux,
§6 façade multi-canaux, §4.7 le builder sanitise / le player fait confiance),
`2026-07-27-emetteurs-et-events-user-complexes.md` (§1-§5 les events qui entrent, symétrique de la
surface publique ; **§6 le perso hôte**, dont le mode hôte du §5 ci-dessus est un remplisseur de plus —
avec la règle « le régime se déclare » et la part de l'hôte au seek),
`2026-07-26-portabilite-contrainte-redaction.md` (la sérialisabilité comme critère de relecture, même
rôle que la contrainte de portage), `2026-07-26-etat-fonction-de-t.md` (la catégorie des irréductibles,
où le contenu d'un hôte n'est pas fonction du `t` de la scène).
