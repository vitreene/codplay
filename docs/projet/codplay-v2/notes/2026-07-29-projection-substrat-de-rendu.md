# Espace désigné et substrat de rendu canvas

Note de réflexion (2026-07-29). Cette page circonscrit le problème et inventorie les moyens.

> **Réserve de terme.** Le mot **« Projection » est retiré de cette désignation** : le concept n'y est
> plus, et le terme est réservé au haut niveau, pour la communication publique, où il aura un autre sens.
> Ce qui reste se dit avec des mots ordinaires — un composant qui héberge, une cible de rendu, un
> substrat. « Substrat » est un mot de travail, pas un nom retenu. Le terme demeure employé ailleurs dans
> le corpus V2 ; l'y reprendre est une décision distincte, non engagée ici (§8).

**Ce sujet est une extension de codplay, pas son cœur.** Le moteur tourne très bien sans. C'est la
première chose à tenir : rien de ce qui suit ne conditionne la V2.

**Deux usages du même mot, très inégalement pressants :**

| usage | horizon | où |
|---|---|---|
| **l'espace désigné** dans une scène — un emplacement où un contenu se projette | **direct, prototypé aujourd'hui** | §0 |
| **le substrat de rendu** — une cible canvas qui remplace le DOM | **v2.5 / v3**, après certitude que la V2 fonctionne parfaitement | §1 à §8 |

Le second est consigné pour n'être pas réinstruit plus tard, pas pour être traité maintenant. Deux
précisions le concernant : l'usage visé en pratique, ce sont les **effets de décor**, et à ce niveau
**aucune gestion avancée des conflits de rendu n'est requise avant une V3 au minimum** — ce qui commande
la lecture du §1 (il pose le problème général, l'usage ne l'atteint pas) et du §3 (il répond au besoin
différé ; voir §4, où l'usage tranche).

## 0. L'espace désigné — l'usage direct

Un **espace désigné dans une scène** : un emplacement déclaré où un contenu vient se projeter, un peu
comme un emplacement qui autorise l'import d'une scène. C'est l'usage immédiat, et il ne
demande aucun substrat de rendu nouveau.

### 0.1 Pas un concept neuf — un hôte de plus, derrière la même interface

L'analogie est directe et suffit : **un layout héberge d'autres persos ; un composant qui porte un
environnement de rendu aussi.**
L'`outlet` n'est pas un concept parallèle à étendre — c'est la face *déclaration du perso*, celle qui dit
où il va.

**`move` reste l'interface.** Un perso s'y monte comme il se monte dans un layout, par la même propriété. Le prototype le fait déjà : `move: { parentId: 'threejs-stage' }`.

*Détail à résoudre* : un composant de ce genre peut avoir une constitution interne — par exemple un `div`
encadrant un canvas. `move` doit alors se résoudre vers la bonne cible, qui n'est pas nécessairement un
nœud DOM. Le précédent existe : un composant layout expose déjà des points de montage internes, un par
partie.

**Ce qui change, ce sont les valeurs — pas l'interface.** Placer un perso dans un environnement three.js
demande des valeurs relatives à cet environnement. C'est du **vocabulaire du contexte**, porté par l'hôte
et non par codplay.

**Et ce vocabulaire n'appelle pas davantage de mécanisme neuf.** Un **composant déclare ses capacités et
un type TS**, auquel le perso est lié — le perso étant l'objet descriptif du comportement du composant.
Le vocabulaire de placement propre à un environnement three arrive par là, comme toute autre propriété
d'un type de composant.

**Où se place-t-elle ? Comme tout perso** : c'est sa boîte, résolue par le layout ordinaire. « Un canvas
sur toute la surface » et « une portion » ne sont pas deux cas, ce sont deux dimensionnements du même
perso. Plusieurs de ces espaces dans une scène se placent donc comme n'importe quoi d'autre.

Une seule chose reste ouverte, et ce n'est pas une question de déclaration : **la frontière de mesure**.
La boîte de l'hôte relève de la cible de rendu ambiante, son contenu du substrat — deux régimes de mesure se
rencontrent exactement là.

### 0.2 Le prototype existant, et ce qu'il fait à la main

`threejs-anime-grid-scene.ts` (repris par la démo mashup) tient déjà la forme :

- `threejs-stage`, type `tag` — l'espace, un simple `div` dimensionné ;
- `threejs-grid`, type `threejs` — le contenu, monté dedans par `move: { parentId: 'threejs-stage' }`.

Ce qui est écrit à la main n'est pas un strap mais **deux fonctions passées en données** : `build`, qui
construit la scène three.js, et `simulate`, qui l'anime image par image. **Les paramètres de la grille y
sont enfouis** — nombre de cubes, espacement, délai depuis le centre, facteur d'expansion — au lieu d'être
déclarés.

Et l'espace n'est qu'un `div` incident : rien ne le désigne comme un espace de rendu.

### 0.3 La direction

**Un composant grille paramétré comme tout perso**, qui se projette dans **un composant qui porte
l'environnement**.
Autrement dit : sortir les paramètres des fonctions `build`/`simulate` pour les déclarer sur le perso, et
faire de l'espace une chose déclarée plutôt qu'un `div` qui se trouve là.

C'est le même geste que partout ailleurs dans le corpus — déclarer plutôt qu'inférer — appliqué à un cas
où le contenu n'est pas du DOM.

## 1. Le DOM masque le problème

Ce que le DOM apporte, et que le canvas n'a pas, n'est pas une meilleure API de dessin : c'est un **arbre
retenu** (*retained mode* — une structure de nœuds qui persiste entre deux images, porte des propriétés
mutables, et qu'un moteur recompose). Le canvas est en **mode immédiat** : on peint, et il ne reste rien à
interroger ni à réordonner.

C'est cet arbre qui résout les conflits de rendu — ordre d'empilement, recouvrement, régions à repeindre,
composition. Un composant peut construire quelques primitives à la main ; dès que le rendu visé dépasse
ces primitives, il faut confier la résolution des conflits à un moteur, comme le DOM le fait.

**Le critère de choix n'est donc pas « quelle bibliothèque dessine bien »**, mais **« laquelle tient un
arbre retenu au-dessus du canvas »**.

**Mais ce problème n'est pas celui de la V2.** Des effets de décor ne mettent pas en concurrence un grand
nombre d'objets adressables : il n'y a pas d'arbitrage d'empilement à déléguer. Le §1 décrit le problème
tel qu'il se posera **quand la cible canvas portera du contenu adressable** — V3 au minimum. Ce qui suit
distingue donc systématiquement ce qui répond au besoin V2 (effets) de ce qui répond au besoin différé
(arbre retenu).

## 2. Skia n'est jamais la couche que codplay adresse

Point pivot, et il vaut réponse à la question « en Flutter, l'argument tient-il encore, puisqu'il adresse
directement le canvas ? ».

| cible | couche retenue que codplay adresse | rastériseur, jamais adressé |
|---|---|---|
| navigateur, DOM | le DOM | Blink → Skia |
| Flutter | l'arbre de RenderObjects (widgets → RenderObjects → arbre de calques) | Skia, et Impeller selon les plateformes |
| **navigateur, canvas** | **aucune — c'est le trou** | Skia, via Canvas2D ou WebGL |

Flutter **est** déjà la couche retenue : une cible de rendu Flutter adresserait son arbre, jamais le canvas
ni Skia. Le besoin d'une bibliothèque tierce est donc **propre à la cible canvas dans un navigateur** — le
seul cas où rien ne s'interpose entre la cible de rendu et le rastériseur.

Conséquence pratique : ce choix de bibliothèque n'engage pas le portage. Il comble un trou local, il ne
fixe pas un modèle que Flutter devrait ensuite reproduire.

**Et ça écarte une famille tentante.** CanvasKit (Skia compilé en WASM, le moteur même de Chrome et de
Flutter) séduit doublement, puisque ce serait le moteur de la cible Flutter. Mais Skia est une API de
dessin en mode immédiat : elle donne un rendu de meilleure qualité, pas la résolution des conflits. Elle ne
répond pas à la question posée, et coûte plusieurs Mo de WASM. Même verdict pour les couches minces sur
WebGL (OGL, regl) et pour three.js, dont le modèle est 3D et qu'il faudrait tordre.

## 3. Les candidats qui qualifient — inventaire du besoin différé

**Cet inventaire répond à l'arbre retenu, donc au besoin V3.** Il est consigné ici pour n'être pas
réinstruit plus tard, non pour être choisi maintenant.

| | modèle | résolution des conflits | surface hors rendu |
|---|---|---|---|
| **PixiJS** | arbre retenu, WebGL / WebGPU | ordre dans le graphe, *batching*, *culling* | large : horloge, chargeur, filtres, interaction |
| **Konva** | arbre retenu, Canvas2D | **calques** — chacun est un canvas séparé | modérée : détection de survol, events, drag |
| **Two.js** | arbre retenu, backends SVG / Canvas2D / WebGL | ordre simple | faible — c'est son intérêt |
| **Fabric.js** | arbre retenu, Canvas2D | ordre | orientée éditeur (poignées, sélection) |

Le modèle de **Konva** est le plus proche du DOM : un calque est un canvas distinct, donc l'équivalent d'un
contexte d'empilement ; la résolution des conflits y est structurelle et lisible plutôt qu'un tri interne.
Il fournit en outre une détection de cible réelle (canvas de détection séparé), ce dont une cible de rendu
a besoin pour router les events.

**Trois contraintes du corpus tranchent plus que ce tableau :**

- **Pas de RAF propre** — codplay est l'unique source d'avancement temporel. Se règle partout de la même
  façon : Pixi par son `Renderer` appelé à la main plutôt que par son `Application` qui possède l'horloge ;
  Konva par le dessin explicite d'un calque ; Two.js par sa mise à jour manuelle. C'est la discipline déjà
  appliquée à rive et lottie, transposable sans invention.
- **`measure`** — c'est là que la cible canvas se jouera, et le corpus le classe déjà comme
  irréductible. Les métriques de texte sont ce que le DOM donne gratuitement et que le canvas fait payer.
  À éprouver tôt, pas à découvrir tard.
- **Portabilité** — un arbre retenu de transformations et de peintures se transpose bien ; les quatre
  candidats partagent ce modèle, ce critère ne départage pas.

## 4. Le critère retenu aujourd'hui : l'accès à WebGPU

**Décision d'orientation, s'il fallait choisir maintenant** : l'accès à WebGPU en priorité, parce que les
possibilités de rendu qu'il ouvre sont **très distinctes de celles du DOM et le complètent**. Ce n'est pas
un critère de performance mais de **complémentarité** — faire ce que le DOM ne sait pas faire.

Parmi les candidats, **PixiJS est le seul à viser WebGPU** ; Konva est Canvas2D, Two.js a un backend WebGL.
Ce critère sélectionne donc Pixi.

**Deux motifs qui ne pointent pas au même endroit :**

- « résoudre les conflits de rendu » demande **plus** d'abstraction retenue ;
- « faire ce que le DOM ne peut pas » demande souvent **moins** d'abstraction, puisque c'est elle qui
  s'interpose entre l'auteur et le shader.

**L'usage tranche, et il tranche pour le second.** Puisque la V2 vise des effets de décor sans gestion
avancée des conflits, l'abstraction retenue n'a rien à porter : elle serait du poids sans emploi. La
priorité va donc à l'accès direct — une couche mince sur WebGPU, ou Pixi employé étroitement pour son
`Renderer` et ses shaders, sans son graphe.

Ce qui déplace la nature du travail : la cible canvas de V2 n'a pas à **choisir une bibliothèque d'arbre
retenu**, elle a à **définir sa notion** et à l'expérimenter sur des effets. Le §3 redevient
pertinent le jour où la cible canvas devra porter du contenu adressable.

Bénéfice secondaire de Pixi, sur un point que le corpus a déjà relevé : il possède un module
d'accessibilité qui projette les objets interactifs en éléments DOM superposés — donc une couverture
partielle là où le corpus écrit qu'une cible canvas n'a rien, faute de document.

## 5. `html-to-canvas` — la piste qui refermerait le trou

À tester dans une démo (horizon v2.5).

Deux choses distinctes portent ce nom, et elles n'ont pas la même portée :

- une **bibliothèque** qui réimplémente le rendu CSS vers un canvas — partielle et coûteuse par
  construction, puisqu'elle refait le travail du navigateur ;
- une **capacité native expérimentale** du navigateur, qui dessinerait un sous-arbre DOM vivant dans un
  canvas.

C'est la seconde qui compte ici, et pour une raison structurelle : elle **refermerait le trou du §2**. La
cible canvas hériterait de l'arbre retenu du DOM au lieu d'avoir à s'en fabriquer un, et toute la question
de la bibliothèque changerait de forme.

*Réserve* : l'état, le nom exact de l'API et la disponibilité de cette capacité sont à vérifier avant d'en
faire un appui — la présente note ne les affirme pas.

## 6. Deux modèles pour une même bibliothèque

**Toute bibliothèque tierce est potentiellement un substrat de rendu** — et c'est le point qui commande le
reste. La distinction n'oppose pas des bibliothèques entre elles, elle oppose **deux façons d'adresser la
même bibliothèque**.

Three.js le montre en un seul exemple :

- **en média** — un composant embarque une scène three.js, comme un composant embarque une vidéo. La
  bibliothèque est la ressource de rendu d'**un seul** perso. C'est l'usage actuel, celui de l'avatar ;
- **en substrat** — l'espace three.js **est** la cible de rendu. Les persos deviennent caméra, cube, lumière,
  et codplay adresse cet espace par `set`, `measure`, `mount`.

**Ce qui sépare les deux n'est pas un degré de complexité, c'est le sens de la possession de l'arbre.**
En média, la bibliothèque possède son arbre interne et codplay n'adresse qu'un nœud — le perso hôte. En
substrat, **codplay possède l'arbre** et la bibliothèque le réalise. Le contrôle s'inverse ; ce n'est
pas la même intégration poussée plus loin.

**Faut-il deux modèles ? Oui, et il faut disposer des deux.** Ce sont deux échelles de besoin
différentes : le mode média traite une bibliothèque comme un **média**, au même titre que la vidéo et le
son — c'est ce que fait la doctrine d'injection de tiers aujourd'hui. Le mode substrat va beaucoup plus
loin, au prix d'une complexité bien supérieure. Aucun ne remplace l'autre, et rien n'interdit qu'une même
bibliothèque serve dans les deux modes au sein d'un même projet.

Conséquence sur la dépendance : une bibliothèque employée en média se remplace comme toute dépendance de
composant ; employée en substrat de rendu, beaucoup moins.

**Attention à ne pas transporter ça sur le perso hôte.** Le corpus définit le perso hôte comme « un perso
dont le contenu **n'est pas fonction de son `t`** » — flux direct, instance imbriquée, composant tiers. Un
perso qui héberge d'autres **persos** n'en est pas un : son contenu est pleinement `f(t)`. Le prototype
actuel, lui, en est un — son contenu vient de `build`/`simulate`, étrangers à la timeline. La distinction
tient au contenu, jamais au fait d'héberger.

**Plusieurs scènes peuvent partager une même cible de rendu.** C'est le cas du DOM, et c'est valable pour
toutes. Ça la range dans la famille de l'engine — « il fournit les instances, ne lit pas la
scène » : une ressource déclarée que N consommateurs revendiquent, soit l'invariant #4 (catalogue déclaré /
consommateurs qui revendiquent / arrangement au-dessus). Elle cesse d'appartenir à une scène.

Ce que le partage force à trancher, et qui ne se pose pas pour une cible exclusive : `measure` et
`mount` s'exercent alors dans un espace commun — deux scènes qui mesurent et montent au même endroit se
voient. Question ouverte.

**Et le partage entre en tension avec le placement.** Un substrat placé par un perso d'une scène, mais
employé aussi par une autre scène : qui le place ? Non tranché.

## 7. La greffe d'un substrat — ce qui ne se déduit pas du modèle tiers

**Ne concerne que l'usage substrat.** Pour l'espace désigné (§0), il n'y a rien à greffer : un composant
three.js s'enregistre déjà par le binding tiers ordinaire, et c'est tout.

Le modèle des bibliothèques tierces (`v1-third-party-runtime-spec.md`) s'applique **intégralement et sans
amendement** — déclaration unique par factory, interdictions normatives, preload déclaré dans le binding,
besoin extrait par le Builder. Inutile de le recopier ici. Ne restent que les points qu'il ne couvre pas :

- **La nature de la contribution.** Un binding tiers fournit des `components` ; un binding de substrat
  fournit l'implémentation de `set`, `measure`, `mount`. Autre nature, pas une entrée de plus dans le même
  champ — d'où la conséquence du §6 sur la dépendance.
- **Le grain du hub de rendu.** Pour des composants, l'adapter délègue à N instances ; pour un substrat, il
  y aurait **une passe par cible de rendu**, partagée entre scènes comme elle. *Déduction à confirmer : le
  corpus n'a pas de cas antérieur d'adapter partagé entre scènes.*
- **Qui résout la disponibilité.** L'auteur, en maîtrise ; le composant **aide** en signifiant son besoin.
  Deux voies non départagées — l'identification, ou le chargement conditionnel des composants selon la
  disponibilité du substrat. L'implémentation réelle départagera. Dans les deux cas, « à la demande » ≠ « au
  dernier moment » : le besoin est statique, extrait par le Builder, chargé avant montage.
- **Le DOM reste hors critère.** Un composant DOM ne déclare rien, et cette absence n'est pas une omission :
  le DOM est le défaut autonome (invariant #1). Ça évite de faire payer à tout le corpus existant une
  déclaration qui n'a de sens que devant un substrat non ambiant.

## 8. Le terme « Projection » est retiré d'ici

**Décision.** Le mot est **réservé au haut niveau**, pour la communication publique, où il aura un sens
différent. Il ne désigne plus rien dans cette page : le concept s'y est dégonflé, et ce qui reste se dit
avec des mots ordinaires — un composant qui héberge, une cible de rendu, un substrat.

Deux conséquences à connaître :

- **« substrat » est un mot de travail, pas un nom retenu.** Il tient la place en attendant, sans plus.
- **Le terme reste employé ailleurs dans le corpus V2** — une centaine d'occurrences, dont « Projection
  (cible de rendu déclarée) » parmi les points-clés de `2026-07-16-solve-project-moteur-custom.md`. Les y
  reprendre est une décision distincte, non engagée ici.

## Statut

Non normatif.

**Le sujet se dégonfle, et c'est le résultat principal.** C'est une **extension**, pas le cœur —
codplay tourne sans. Et son usage direct **se range comme un élément de scène ordinaire** : un composant
qui héberge des persos comme un layout, `move` pour interface, capacités et type TS pour vocabulaire.
**Rien de nouveau n'est demandé au moteur — seulement des composants** (§0). Le travail réel sur le
prototype est du travail de composant : sortir les paramètres enfouis dans `build`/`simulate`.

**Acté, pour l'usage substrat** — différé en v2.5 / v3, après certitude que la V2 fonctionne parfaitement :
effets de décor, sans gestion avancée des conflits avant une V3 au minimum ; orientation vers l'accès à
WebGPU pour la complémentarité avec le DOM ; le modèle tiers s'applique sans amendement.

**Acté, transversal** : **deux modèles coexistent** (§6) — une même bibliothèque s'adresse en média ou en
substrat, selon le sens de possession de l'arbre. Il faut disposer des deux.

**Ouvert** : la frontière de mesure hôte/substrat (§0.1) ; le partage d'une cible de rendu entre scènes et
qui la place (§6) ; qui résout la disponibilité d'un substrat, identification ou chargement conditionnel (§7) ;
le grain du hub de rendu (§7, déduction à confirmer) ; le nom (§8) ; l'état réel de `html-to-canvas`
natif (§5). **Différé** : le choix d'une bibliothèque à arbre retenu (§3).
