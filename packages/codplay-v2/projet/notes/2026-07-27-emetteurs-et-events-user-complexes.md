# Émetteurs et events user complexes — réduire une captation à l'intention

Note de réflexion (2026-07-27). Périmètre V2. Comment codplay peut accueillir des events
utilisateur **complexes** (gestes filmés, signaux continus d'un capteur, reconnaissance amont
par un modèle) sans jamais ouvrir de canal d'events continu. Aucun code : la note fixe la
direction, pas l'API.

Point de départ : la question « le concept de capture pourrait-il s'élargir pour parler de
*stream* (flux) ? ». La réponse est non — l'axe n'était pas celui-là. Ce qui manque est ailleurs,
et c'est l'objet de cette note.

---

## 1. Problématique

### 1.1 Le manque, en une ligne

**Codplay a un canal d'events qui ne sait pas observer, et un canal d'observation qui ne sait pas
émettre.**

- `perso.emit` transforme un event natif en `StoryEvent` : un coup, sans mémoire, sans historique.
  Un `keyCode` et un `preventDefault` pour toute condition.
- `capture` a la mémoire (`captureState`), l'historique (`samples`) et le temps, mais
  `CaptureTickResult` ne comporte aucun champ `events` : structurellement, `trackCommand` ne peut
  rien émettre.

Un event utilisateur complexe a besoin des deux **à la fois** : il se reconnaît sur une durée, et
il conclut par un event discret. Le seul endroit où on peut le reconnaître est le seul endroit qui
ne peut pas le dire.

### 1.2 La contrainte qui gouverne tout

Par construction, **ne jamais créer de canal d'events codplay continu** : ce n'est pas un mode de
fonctionnement soutenable à haute intensité. Une captation doit toujours se réduire à quelque
chose que codplay sait gérer.

La réduction visée n'est pas « moins de données » — c'est **l'intention**. L'abondance saisie
(trente frames par seconde, vingt-et-un points de main) se réduit à quelques events qui décrivent
ce que l'utilisateur veut : « geste OK », « main ouverte », « visée engagée ».

Corollaire : la rareté doit être **structurelle**, pas une discipline d'auteur. Un mécanisme où
l'auteur *peut* écrire l'émission continue est un mécanisme qui la produira.

### 1.3 Deux régimes à ne jamais confondre

| | nature | traitement |
|---|---|---|
| **Signaux continus** | 21 landmarks de main à 30 fps, une pose de tête, une position normalisée | capture au sens strict : haute fréquence, pilote un node en direct, jamais matérialisé, commit à la fin |
| **Gestes reconnus discrets** | « swipe gauche », « pouce levé » | events ordinaires : `emit`/`listen`, matérialisés, rejouables |

Le second cas n'est **pas** une capture : quelques occurrences par seconde au maximum, donc la
justification même du canal de tracking — des émissions qui saturent la track — disparaît.

Et le sens de l'erreur compte : faire transiter un geste reconnu par le canal de tracking
**détruirait activement** ce qu'on veut. Un « swipe gauche » reconnu à t=3 s doit être dans la
track, parce que c'est la chose signifiante de la scène. Le passer en tracking, c'est le jeter.

### 1.4 L'appartenance, qui n'a plus d'ancre

`v1-capture-spec.md` règle 9 : une capture appartient au perso qui la déclare, portée par
`perso.emit[...]`. Le raisonnement — « pas de capture de scène, faute d'un perso qui vivrait hors
story » — était juste pour un clic : un clic atterrit sur un node, donc sur un perso.

Un geste filmé n'atterrit sur rien. Quel perso possède « l'utilisateur a levé la main » ? Aucun.
Il ne manquait pas une capture de niveau scène : il manquait un **porteur**.

### 1.5 Deux durées de vie sans commune mesure

Un pipeline caméra + modèle a un coût — permission, chargement, warmup (mise en température) —
sans rapport avec la fenêtre capturée. Il tourne avant et après toute capture. Une capture n'est
qu'une **fenêtre ouverte dessus**, jamais sa propriétaire.

---

## 2. Déroulé de la feature

### 2.1 L'émetteur — une capacité déclarée

Un **émetteur** se déclare comme on déclare un composant : il ajoute une capacité à la scène et
met à disposition un dispositif de captation. Il n'a pas de présence visuelle, pas de node.

Ce qu'il porte :

- **la ressource et son cycle de vie** — s'initialise avec la scène, se démonte avec elle ; le
  `preload` est de l'infrastructure codplay, conforme à la doctrine existante ;
- **le vocabulaire déclaré** — la liste finie des intentions que cette capacité peut produire.
  La capacité devient auto-descriptive : on lit ce qu'elle sait dire sans ouvrir de fonction ;
- **la mutualisation** — deux persos qui répondent au swipe n'instancient pas deux
  reconnaisseurs.

Un émetteur doit pouvoir faire **deux choses distinctes**, et la déclaration doit les séparer :

- **produire des events directement** — cas discret et ambiant, sans fenêtre : un geste est
  reconnu, il entre dans le pipeline normal, point. Pas de capture du tout.
- **produire des échantillons** — cas continu et borné : une capture s'y abonne pour une fenêtre,
  pilote un node en direct, commit à la fin.

C'est le partage du §1.3, devenu une propriété de l'émetteur au lieu d'un choix d'auteur au cas
par cas.

### 2.2 Réduction vers l'intention — émettre sur transition, pas sur appel

Un `trackCommand` qui retournerait `events: [...]` émettrait soixante fois par seconde, et rien ne
l'en empêcherait.

Un `trackCommand` qui retourne **le nom d'une phase déclarée** ne le peut pas : codplay n'émet que
lorsque ce nom **change**. Retourner `"main_ouverte"` soixante fois de suite produit un event. Un
seul.

Le nombre d'events cesse d'être borné par la cadence d'échantillonnage : il est borné par le
nombre de transitions dans un vocabulaire fini, déclaré dans la scène. L'auteur ne peut pas
dépasser ce budget sans inventer une phase par frame, ce que la déclaration lui interdit.

C'est la forme naturelle du domaine : une intention est un **état**, pas une occurrence. « Geste
OK », « main ouverte », « visée en cours » sont des phases dans lesquelles on entre et dont on
sort. Le flux brut ne franchit jamais le canal — il reste dans `captureState`, comme aujourd'hui.

### 2.3 Ce n'est pas un mécanisme neuf : c'est `endEmit` libéré de `endOn`

`endEmit` est déjà un `StoryEvent` **déclaré** dans `CaptureDeclaration` — pas construit par une
fonction — dont le `data` absent retombe sur `captureState` à l'instant du déclenchement
(`v1-capture-spec.md` règle 3). Son seul cas particulier est son déclencheur : « la capture s'est
terminée ».

Généraliser ce déclencheur, de « la fin » à « changement de phase déclarée », fait de `endEmit`
une **instance** de la règle générale plutôt qu'un mécanisme à part.

La symétrie tient aussi côté routage : le tracking cible déjà une `actionName` prise dans un
ensemble déclaré (`perso.actions`), jamais une cible libre. L'intention cible un nom d'event
déclaré, jamais un event construit à la volée. Même discipline, deux canaux.

### 2.4 Le reconnaisseur — un module, pas un concept

La reconnaissance d'un geste demande trois choses, dont la troisième est celle qu'on
sous-estime :

1. **de l'historique** — un swipe, c'est une trajectoire, une vélocité et une direction, pas un
   point ;
2. **le droit d'échouer** — un reconnaisseur démarre, la contrainte est violée, il n'émet rien ;
   une capture, elle, va toujours jusqu'à `endOn` ;
3. **la concurrence et l'ambiguïté** — tap, appui long et drag sont indiscernables au
   `pointerdown` ; un double-tap n'est connu qu'en attendant qu'il ne soit pas un simple ; deux
   reconnaisseurs sur la même entrée doivent s'arbitrer et l'un doit perdre.

Le troisième point est un problème résolu ailleurs, et c'est la raison de ne pas écrire soi-même
le reconnaisseur. Codplay n'a pas à savoir ce qu'est un geste : il enregistre un module, et le
module dit quand il a reconnu.

### 2.5 Ce que la capture devient

Rien ne bouge dans son cœur : le canal de tracking, `captureState`, la non-matérialisation, le
routage par `actionName` — inchangés. Ce qui change est à sa périphérie : **ses bornes et son
point d'ancrage cessent d'être des events DOM sur un node.**

---

## 3. Implémentation

### 3.1 Le déclencheur d'un `emit` cesse d'être supposé natif

Aujourd'hui `perso.emit` associe un nom d'event DOM à un `StoryEvent`. Il suffit que ce nom soit
**résolu par le registre** — natif, ou reconnaisseur enregistré.

Esquisse illustrative, non normative :

```
emit: { swipe: { event: { name: "carte:suivante" } } }
```

C'est une seule indirection, pas un concept : toute la chaîne en aval de `emit` est inchangée.
Un `RuntimeEmitEvent` porte déjà `source: 'module'` — le canal existe, `list-dnd` l'emprunte
déjà en transformant une capture pointeur en action `move`.

Deux propriétés en découlent :

- **l'autorat reste dans la scène** : l'auteur déclare « ce perso répond à un swipe » dans son
  `SceneDoc`. Un reconnaisseur purement externe marcherait aussi, mais la configuration du geste
  partirait vivre ailleurs — c'est précisément ce qu'on ne veut pas ;
- **ça compose avec la capture** sans la toucher : un `emit` déclenché par un reconnaisseur peut
  porter un `capture` comme n'importe quel autre. « Le swipe démarre, puis on suit en continu »
  s'écrit sans rien inventer.

### 3.2 L'émetteur s'enregistre comme un composant

Même mécanique que le registre existant (composants, services, modules). Il est déclaré au niveau
de la scène, initialisé avec elle, démonté avec elle. Il n'a pas de cible : ses events entrent
dans le pipeline normal, routés par nom — la symétrie `emit`/`listen` que la spec capture invoque
déjà pour `endEmit`/`endCapture`.

### 3.3 L'émission d'intention

Le retour de `trackCommand` s'enrichit d'un nom de phase pris dans l'ensemble déclaré. Le runtime
compare à la phase précédente ; à l'identique, il ne se passe rien ; au changement, il émet
l'event déclaré correspondant, avec le fallback `data ?? captureState` déjà en vigueur pour
`endEmit`.

### 3.4 Le garde-fou de séjour minimal

La garantie du §2.2 est « borné par les transitions », pas « borné par les intentions ». Un signal
amont qui vacille — des landmarks qui oscillent autour du seuil entre « ouverte » et « fermée » —
produit trente transitions par seconde, et la saturation revient par la porte de derrière.

Deux réponses, toutes deux nécessaires :

- **la stabilité appartient au reconnaisseur** : un signal qui vacille est un défaut amont, pas
  quelque chose que codplay doit rattraper ;
- **un garde-fou déclaratif tout de même** : une durée minimale de séjour dans une phase avant que
  la transition soit émise. Déclarative, donc vérifiable sans lire les fonctions, donc structurelle
  comme le reste. **Sans valeur par défaut** — absente, elle reste absente.

### 3.5 Matérialisation et seek

- les events d'intention sont des events normaux : matérialisés, routés par `listen`, rejouables ;
- le flux brut n'est jamais matérialisé, conformément à la règle existante ;
- **la capacité est nécessaire pour jouer, jamais pour rejouer.** Reconstituer « main_ok à 3 s » au
  seek ne rallume pas la caméra. C'est le meilleur argument en faveur de ce découpage, et une
  conséquence directe du fait qu'on réduit vers l'intention plutôt que vers moins de données.

Gain collatéral : aujourd'hui une capture longue ne se reconstruit qu'à partir de son commit
final — tout ce qui s'est passé pendant n'a aucun ancrage. Avec des events d'intention, le seek
récupère des points intermédiaires gratuitement, et exactement aux instants qui comptaient. Ça
vaut au-delà des gestes : un drag qui entre dans une zone de dépôt est la même chose.

---

## 4. À trancher

**L'indisponibilité — le point dur.** Un perso dont le type n'est pas enregistré échoue à la
construction. Un émetteur dont la caméra est refusée échoue **à l'exécution, sur la machine du
spectateur, au milieu de la scène**. Codplay n'a aujourd'hui aucune classe d'échec de cette
nature. Une scène qui déclare une capacité gestuelle doit dire ce qu'elle devient sans elle — et
ça se déclare, ça ne s'improvise pas au moment où ça casse.

**Scène ou story.** Une caméra est plausiblement une ressource de scène : rare, singleton. Mais la
question se pose à l'autre niveau, et la capture a déjà un précédent avec
`stateScope: 'scene' | 'story'`. À décider explicitement, pas à hériter par défaut.

**Le nom.** `perso.emit` désigne déjà « ce déclencheur natif produit cet event ». Un « émetteur »
qui désigne une capacité déclarée produisant events *et* échantillons est autre chose. Choisir en
sachant.

**La frontière du séjour minimal.** Où s'arrête le devoir de stabilité du reconnaisseur, où
commence le garde-fou codplay.

---

## 5. Écarté, et pourquoi

**Laisser `trackCommand` émettre des events libres.** Chemin court apparent, mais toute la
garantie de seek de la capture repose sur « rien de ce qui traverse le cycle n'atteint la track ».
Percer ce trou rendrait le comportement au seek de chaque capture dépendant de ce que son auteur a
écrit dedans : on échangerait une règle vérifiable contre une convention. L'émission sur transition
(§2.2) obtient le même résultat en gardant la garantie.

**Un budget ou un throttle (limitation de débit) côté runtime**, abandonnant les events au-delà de
N par seconde. La track cesserait d'être un enregistrement fidèle de ce que l'auteur a exprimé, et
le seek deviendrait fonction du temps machine.

**Une émission périodique déclarée** (« tous les 200 ms »). C'est une cadence déguisée : elle
réduit le volume, mais pas vers l'intention — or c'est bien vers l'intention que la réduction doit
se faire.

**Un concept frère « stream » à côté de la capture.** Voir l'annexe : un flux ambiant sans fin n'a
pas de commit, donc pas de réponse à « que reconstruit le seek ? », « que se passe-t-il au
pause ? », « que fait le rate ? ». Ces questions sont celles du runtime tiers, pas celles de la
capture — et l'émetteur y répond en séparant la ressource (permanente) de la fenêtre (bornée).

---

## 6. Complément — flux direct : l'hôte est dans la timeline, le contenu n'y est pas

**Distinct du sujet de l'`emit`**, mais capacité à employer pour codplay, et voisine par sa nature :
la diffusion d'un flux direct (webcam, TV, tout signal reçu en temps réel). Là où les §1-§5
traitent d'un flux *entrant* qu'il faut réduire à l'intention, il s'agit ici d'un flux *sortant*
— affiché dans la scène — dont il n'y a rien à réduire.

### 6.1 Le principe

**Un flux direct est toujours à `now`, jamais à `t`.** Tout le reste de codplay est fonction de
`t` ; c'est la seule dimension qui, délibérément, ne l'est pas.

Ça lui donne sa place dans la table des origines (annexe Q1) : c'est le bout de l'axe. Une capture
se réduit vers l'intention ; un flux direct n'a **aucune intention à extraire** — sa cible de
réduction est vide, et il n'a donc pas de commit du tout.

Ça lui donne aussi une famille déjà nommée dans le cahier V2 :
[`2026-07-26-etat-fonction-de-t.md`](./2026-07-26-etat-fonction-de-t.md) classe les dimensions par
mode d'interrogation et réserve une catégorie aux **irréductibles**, jusqu'ici les effets à
side-effect. Un flux direct en est le second membre : ce n'est pas un side-effect, mais ce n'est
pas davantage une fonction de `t`.

### 6.2 Le partage qui rend la chose sûre

**Seul l'hôte du flux — un tag vidéo, par exemple — suit les conditions ordinaires d'un perso.**
Son état à `t` (monté ou non, sa boîte, son style, coupé ou lu) *est* fonction de `t`, parce qu'il
ne provient que d'events ordinaires, matérialisés, rejouables. Seul le contenu ne l'est pas.

Et la bonne réponse à « quelle image passait à t=3 s ? » n'est pas « on ne sait pas » : c'est
« celle de maintenant ». Pour un direct, c'est la réponse **correcte**, pas une approximation — un
flux n'a pas d'image à t=3 s, il n'a qu'un maintenant.

Le versant contrôle ne coûte rien : couper, lire, masquer sont des events ordinaires adressés au
perso hôte. Un event rejoué au seek peut donc lui avoir demandé d'être coupé ou lu — il rétablit
cette consigne sans conserver aucun contenu.

### 6.3 Ce qui est arrêté

- **Le seek continue de diffuser.** Il ne rembobine rien : il rétablit l'état de l'hôte, le flux
  reste à maintenant.
- **Le `rate` est ignoré.** Un direct est en temps réel par définition ; le suivre est
  structurellement impossible, pas mal supporté.
- **Pas de tampon, pas de rattrapage.** La pause ne gèle pas la source, et la reprise ne repart pas
  de l'instant gelé : elle montre maintenant. Un tampon serait un choix d'auteur, jamais quelque
  chose que codplay fournit d'office.

Ces concessions sont **sans conséquence pour la diffusion** de l'œuvre : le seek y est
principalement un instrument d'**auteur**, dont l'objet est de vérifier que le projet fonctionne.
L'œuvre diffusée, elle, se joue en avant. Ce qu'on abandonne ici est une commodité d'atelier, pas
une propriété de l'œuvre.

Seule conséquence côté atelier, à connaître : une scène portant un flux direct n'est pas
reproductible d'une lecture à l'autre, donc ne peut pas servir de scène de référence
anti-régression.

### 6.4 La non-relecture se déclare, elle ne se détecte pas

Point d'implémentation, et il n'est pas cosmétique : le composant media **pilote activement** le
temps de lecture — il force `currentTime` à se resynchroniser dès que l'écart dépasse une
tolérance, et met la lecture à l'échelle du `rate`. Cette machinerie existe et tourne ; appliquée à
un direct, elle le combattrait.

Le même tag sert donc deux régimes — un enregistrement, qui a une timeline et que codplay pilote ;
un direct, qui n'en a pas. Et le régime ne s'infère pas de façon fiable (une adresse réseau ne dit
pas si elle sert du direct ou du différé). Il se **déclare** sur le perso hôte, et sa fonction
première est de **désactiver** le pilotage temporel, pas de documenter une limite.

### 6.5 Convergence partielle avec l'émetteur

Une webcam est exactement ce que le §2.1 décrit : permission, cycle de vie, warmup. Le même objet a
alors deux faces — il produit des échantillons pour une capture (entrée) et expose une source pour
un perso hôte (sortie).

Mais tous les flux ne sont pas des émetteurs : une TV en HLS est une adresse, sans permission ni
dispositif. L'unification serait forcée. La formulation juste : **quand la source est une capacité
de l'appareil, c'est un émetteur ; quand c'est une adresse réseau, c'est une simple source — et le
perso hôte ne fait pas la différence.**

### 6.6 Réserve de nom

Comme pour « émetteur » : « diffusion » désigne déjà, dans le vocabulaire V2, la mise en
circulation de l'œuvre (frontière auteur/diffusion). « Diffuser un flux » et « diffuser une œuvre »
dans le même corpus finiront par se cogner.

---

## Annexe — Questions / réponses de la discussion

### Q1. Pourrait-on élargir le concept de capture pour parler de *stream* (flux) ?

Une capture, débarrassée de sa peau « périphérique d'entrée », est quatre mécanismes dont aucun ne
parle de souris ni de clavier : un cycle borné ; une mémoire éphémère hors `state` ; un canal de
tracking qui court-circuite events/track/seek ; un commit à la fermeture qui ré-entre dans le
pipeline normal.

Le couplage DOM est mince : `trackOn`/`endOn` sont des noms d'events natifs posés sur `window`, le
handler de tracking filtre en dur sur `PointerEvent`, et le déclencheur vit sous `perso.emit`.
Surtout, **le clavier a déjà cassé l'équation « event natif = échantillon »** : ne produisant rien
entre `keydown` et `keyup`, il fait fabriquer les échantillons par le tick du player. L'axe
« source » est donc déjà abstrait une fois, à moitié.

Mais l'élargissement ne vient pas gratuitement, et ce n'est pas la plomberie qui coince : c'est
**la borne de fin**. Toute l'histoire du seek d'une capture tient à ceci — le geste est terminé,
donc le commit peut se substituer au trajet. Sans bornes, cette justification tombe.

Le vocabulaire existant couvre déjà trois régimes, séparés non par « continu vs discret » mais par
**l'origine des valeurs** :

| origine | concept existant | matérialisation |
|---|---|---|
| fonction déterministe du temps | `TweenAction` | un descripteur, ré-évaluable à tout T |
| moteur interne cadencé par codplay | runtime tiers | rien (le moteur est rejouable) |
| source externe non reproductible | **capture** | rien pendant, un commit à la fin |
| flux diffusé en direct | **hôte + flux** (§6) | rien, et **pas de commit non plus** — toujours à `now`, jamais à `t` |

**Réponse** : oui pour élargir, mais sur le seul axe de l'origine des échantillons. Non pour un
concept frère « stream » au sens flux ambiant sans fin — ce n'est pas une capture plus large,
c'est un autre objet.

### Q2. Exemple : une saisie vidéo, analysée à `endCapture` pour être transformée en quelque chose de rejouable.

Bornée, déclenchée par un perso, non matérialisée pendant, commit à la fin : c'est la forme exacte
d'une capture. Mais quatre points du contrat cèdent :

1. **`samples` accumule tout, brut, et interdit de transformer en route** (règle 2). Écrite pour
   des échantillons à quelques nombres. Une frame vidéo n'est pas ça : 30 fps × 10 s retenus en
   mémoire, et une frame non fermée bloque le décodeur. La règle est à l'envers pour cette charge
   utile — et rien ne permet aujourd'hui de **ne pas** accumuler.
2. **La cadence de la source est une horloge externe.** Le pointeur suit la main, le clavier suit
   le tick. Une vidéo suit son propre débit. Question neuve : que se passe-t-il si le player est
   mis en pause pendant la capture ? Un geste ne survit pas à une pause ; un enregistrement, si.
3. **Analyse asynchrone = perte de l'ancrage temporel.** `endCapture` n'est jamais async, donc
   l'analyse part dans un strap, qui émet au curseur courant : une analyse de 400 ms pose son
   résultat 400 ms trop tard, hors de la fenêtre réellement occupée. Toute la machinerie
   `duration`/`durationMode` devient inaccessible dès que le commit est différé.
4. **Le commit de fin est ponctuel, pas distribué.** Une seule valeur de `duration` pour tout
   `CaptureEndOutput` : tous les events retournés atterrissent au même `ms`. Le régime prévu est
   « une transition de substitution, d'un point A à un point B », alors qu'une analyse produit une
   séquence répartie. Le vocabulaire existant répond ici : une `TweenAction` est un descripteur
   ré-évaluable à tout T, donc un seul descripteur couvrant toute la fenêtre.

### Q3. Autre exemple : vidéo analysée en temps réel par une IA qui suit des gestes filmés — l'intéressant est dans les signaux/gestes, pas dans la vidéo.

Cet exemple **dissout** la plupart des problèmes du précédent : la vidéo n'entre jamais dans
codplay, ce qui entre est déjà sémantique. Échantillons légers, analyse déjà faite en amont,
`endCapture` synchrone et bon marché.

Mais « signaux / gestes » recouvre deux régimes opposés — c'est le §1.3 de cette note. Et le vrai
blocage se déplace sur **l'ouverture** : « lever la main pour démarrer » est inexprimable, le
déclencheur devant être un event DOM sur un node. Ouverture *et* fermeture sont ici sémantiques,
décidées par le contenu du flux ; `endOn` ne sait nommer que des events natifs, et
`initCaptureState` ne sait que refuser (`false`) une ouverture déjà déclenchée.

Cet exemple ne rouvre donc pas « stream vs capture » : il rouvre **la règle 9, l'appartenance**.

Quant à la source, elle n'appartient pas à la capture : le pipeline IA tourne en continu, avec un
coût sans commune mesure avec la fenêtre capturée. C'est un runtime tiers auquel la capture
**s'abonne**. Un nom de source à citer, pas une source à déclarer.

### Q4. Comment gérer les events user complexes tels que les gestes ?

C'est le §1.1 : un canal d'events qui ne sait pas observer, un canal d'observation qui ne sait pas
émettre. D'où la proposition du §3.1 (le nom du déclencheur résolu par le registre) et du §2.4 (le
reconnaisseur est un module).

Réponse initiale écartée ensuite : « ne pas laisser `trackCommand` émettre ». L'objection portait
sur la dépendance à la discipline de l'auteur — elle tombe dès lors que la rareté est rendue
structurelle.

### Q5. Il faut éviter par construction un canal d'events continu ; la captation doit se réduire à quelques events d'intention. Il manque un système où la capture fournit des events dans la continuité d'une capture, sans saturer codplay.

C'est le §1.2 et le §2.2. La bonne réponse n'est pas d'interdire l'émission, c'est de rendre la
rareté structurelle : émettre **sur transition d'une phase déclarée**, pas sur appel. Avec sa
limite honnête — les transitions ne sont pas les intentions si le signal vacille (§3.4).

### Q6. Un émetteur pourrait être déclaré comme un composant, pour ajouter une capacité à la scène et mettre à disposition un dispositif de captation.

C'est ce qui referme le point laissé ouvert en Q3. L'émetteur est le porteur qui manquait :
appartenance (§1.4), séparation des deux durées de vie (§1.5), lieu naturel du vocabulaire déclaré
(§2.2), mutualisation. Et la propriété qui rend le découpage juste : la capacité est nécessaire
pour **jouer**, jamais pour **rejouer** (§3.5).

### Q7. Complément : la diffusion d'un flux (webcam, TV) est acceptable à condition de lui refuser toute capacité de relecture. Seul l'hôte du flux suit les conditions ordinaires d'un perso.

Sujet distinct de l'`emit`, développé au §6. Le partage hôte/contenu est ce qui rend la chose
sûre : l'état de l'hôte est fonction de `t`, le contenu ne l'est pas et n'a pas à l'être.

Trois questions soulevées en réponse, tranchées dans le même échange : **`rate` ignoré**, **pas de
tampon ni de rattrapage**, on reste à `now`. Leur justification : le seek est principalement un
instrument d'**auteur**, destiné à vérifier le bon fonctionnement du projet ; ces concessions sont
sans conséquence pour la diffusion de l'œuvre, qui se joue en avant.

Quatrième point, d'implémentation : la non-relecture doit se **déclarer**, parce que le pilotage
temporel du composant media existe, tourne, et combattrait un direct (§6.4).
