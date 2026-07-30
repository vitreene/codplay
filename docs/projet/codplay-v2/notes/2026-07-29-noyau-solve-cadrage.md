# Noyau de calcul pur — cadrage avant écriture

Note de cadrage (2026-07-29). Fixe le statut, le périmètre et le contrat du **noyau de calcul pur**
(`solve`, courbes, composition de tweens) dont la conduite §3 dit qu'il « reste valable » après avoir
écarté la route « moteur injecté en V1 d'abord ». **Aucun code écrit à ce jour.**

Objet de cette page : empêcher le mélange des niveaux d'intervention constaté en discussion. Elle ne
décide que ce qui est listé ci-dessous ; le reste est explicitement laissé ouvert.

## 1. Statut et périmètre — arrêtés

| point | décision |
|---|---|
| **Nom** | **`ace`** — *anime codplay extension*. |
| **Statut** | **Bibliothèque préalable, hors chantier V2.** Elle se conçoit depuis le modèle V2, mais n'est pas la V2 : pas de spec V2 requise avant de l'écrire, elle se pilote par ses tests et son contrat propre. Le chantier V2 commence après, et la consomme. |
| **Emplacement** | **Nouveau package dédié.** Indépendance réelle, dépendances nulles, testable seul. |
| **Rapport à la V1** | **V1 strictement intouchée.** Aucun point d'intégration, aucun site d'appel migré. La V1 garde anime jusqu'à sa mise hors service, et reste l'étalon de fiabilité intact. |
| **Géométrie matricielle** | Le paquet porte la sienne, **écrite depuis zéro**, et **en 2D**. |

**L'absence de 3D dans le calcul transform/matrix est une limite assumée** — le même retrait que fait
anime.js. Pas un oubli, pas un manque à combler : une limite tenue.

**Sauf si le coût d'obtention est faible.** C'est le seul critère : là où la 3D vient à peu de frais, on la
prend, sans attendre. Elle n'est écartée que dans la mesure où elle coûte.

Si elle coûte, l'horizon est **V2.5 — l'amélioration une fois la base établie**. Et même là, sans
engagement : il y a **tout un circuit à réfléchir**, et **si la 3D s'avère trop spécifique ou trop
différente de la 2D, on n'y va pas**.

La route « écrire le moteur et l'injecter dans la V1 » est écartée par la conduite §3, qui en donne le
motif. Elle n'a pas à être rediscutée ici : sans point d'intégration, le noyau n'a aucune forme existante
à satisfaire.

**Comment la V1 peut être citée dans ce chantier — et seulement ainsi :**

- comme **source de documentation** : quelles features existent, lesquelles sont réellement employées,
  quel comportement est attendu ;
- comme **moyen de vérification** : un oracle, au sens du §5.

Jamais comme implémentation à reprendre, fichier à déplacer, contrat à satisfaire, compatibilité à
préserver, ni forme contre laquelle se défendre. Le corollaire d'écriture : **énoncer des exigences
positives**. Si une phrase a besoin de nommer un interne V1 pour se tenir, elle définit le noyau par
rapport à la V1 au lieu de le définir par lui-même — elle est à réécrire.

## 2. Ce que le corpus établit déjà sur la frontière du noyau

À reconnaître, pas à réinstruire. Ces trois points bornent ce que le noyau fait — et surtout ce qu'il n'a
pas à faire.

- **Il rend une valeur native, dans l'unité d'auteur, sans aucune résolution vers le substrat.** C'est la
  séparation `solve (interpole → état natif)` / `project (état natif → node)` de S2. **La résolution
  d'unité n'est pas son affaire** : elle appartient à `project` (S3).
- **Il accepte les valeurs que la sémantique de codplay autorise** — dont les longueurs relatives négatives
  et les nombres nus. C'est une exigence positive sur le noyau, pas une compatibilité à préserver.
- **Il n'a pas de pose composée à produire.** §5 sépare deux étages : par nœud, le stockage canonique est
  en **propriétés CSS discrètes** (`translate`/`rotate`/`scale`), donc aucune chaîne à composer ; entre
  nœuds, c'est la matrice — un problème géométrique distinct.

## 3. Le contrat — conséquence des décisions

**Deux enrichissements de §6 entrent dans le contrat dès la conception :**

- **`spatialCurve`** — **optionnel, la droite linéaire par défaut.** Déclaré, il définit une trajectoire
  courbe et **couple alors les propriétés** : `x` et `y` cessent d'être deux résolutions indépendantes.
  Absent, chaque propriété se résout seule, par lerp droit `A→B`.

  **La trajectoire est de la donnée, normalisée.** Deux matérialisations côté auteur — une **fonction
  quadratique** (un point de contrôle), ou **un chemin lu**, produit par un éditeur par exemple. Les deux
  se ramènent à une seule représentation interne : un chemin paramétré dans un espace normalisé, **mis à
  l'échelle pour aller du point A au point B quelle que soit l'échelle**. Un même chemin d'auteur sert
  donc tout déplacement, quelle que soit sa distance ou son orientation.

  *Conséquence de frontière* : le noyau **ne parse aucun format de substrat**. Convertir un chemin
  d'éditeur vers la représentation normalisée appartient à l'étage d'autorat, jamais au noyau.

### 3.2 La surface — forme d'objet et méthodes

Esquisse non normative. Elle assemble les décisions ci-dessus, elle n'en ajoute aucune.

**Pas de classe, pas d'instance, pas de cycle de vie** : des fonctions libres et des objets préparés
opaques. C'est ce qu'implique « bibliothèque pure testée en isolation », et l'absence d'horloge le
confirme. La coupure passe là où les deux faces la placent (§3bis).

**Règle de nommage : on garde les désignations d'anime**, sauf pour ce qui est un ajout ou une
modification substantielle. Les noms ci-dessous sont relevés dans les types d'`animejs` 4.5.0, pas
supposés. Deux écarts assumés, et ce sont bien des modifications de fond : **`path`** (chez anime, un
chemin de mouvement passe par le module SVG ; le nôtre est normalisé, mis à l'échelle sur le segment, et
ignore tout substrat) et **`blend`** (poids et mode, absents d'anime sous cette forme).

```
── préparation — une fois, hors chemin chaud ──────────────

preparePath(cheminNormalisé, { parcours }) → Path
    construit ce qui coûte : table de reparamétrisation
    si le parcours est par longueur d'arc

prepareTween({
  from, to,          VALEURS DE MESURE AVEC LEUR UNITÉ, telles que
                     l'auteur les a écrites — y compris relatives
                     (cq*) et négatives, y compris nombres nus.
                     Scalaires, ou PAIRE ORDONNÉE si un path est déclaré
  duration,
  delay,             attente avant le départ
  loop,              nombre d'itérations (ou booléen)
  loopDelay,         attente entre deux itérations
  reversed,          parcours inversé
  alternate,         sens inversé une itération sur deux
  ease,              nom de courbe
  path?,             un Path préparé
  blend?             { poids, mode }
}) → Tween

── résolution — par image, chemin chaud ───────────────────

resolve(groupes: Tween[][], instant) → (valeur | [valeur, valeur])[]
    une entrée par groupe, dans l'ordre

── catalogue ─────────────────────────────────────────────

easings            courbes empruntées à anime, fonctions pures 0→1
```

**L'unité est dans le champ — et c'est le cœur du sujet.** `ace` **porte** l'unité sans jamais la
**résoudre** : il accepte `-8.62cqw`, interpole vers `12cqw`, rend `3.4cqw`. La conversion vers des pixels
reste à `project`, qui a le conteneur.

C'est là qu'est la justification même du chantier. Anime manipule mal les unités relatives — il rejette
les `cqw` négatifs, il laisse tomber un nombre nu — et le code actuel en porte les **cicatrices** :
parser contre une propriété de substitution, renvoyer une chaîne déjà convertie. Un noyau qui n'accepterait
que des nombres nus **ne supprimerait pas ces contournements, il les déplacerait** : il faudrait retirer
l'unité avant l'appel et la remettre après. Écrire `ace` n'aurait alors plus d'objet.

Donc : **aucune valeur d'auteur n'est refusée ni massée.** Unités relatives, valeurs négatives, nombres
nus — tout entre tel quel. L'unité ne participe pas à l'arithmétique, mais elle traverse et ressort.

Deux préconditions, tenues **à la préparation**, jamais par `ace` :

- **`from` et `to` partagent la même unité.** `0px → 50%` n'est pas interpolable sans résolution, et la
  résolution vient après.
- **Aucun `from` manquant.** Le corpus retient l'intention d'anime (compléter un `from` absent) et rejette
  son implémentation (lire le nœud) : il se complète depuis l'état amont. `ace` exige les deux valeurs et
  n'a pas de notion de valeur absente.

**Deux propriétés distinctes, `ease` et `path`.** Les regrouper sous un même champ masquerait ce qui fait
leur intérêt : ce sont **deux axes orthogonaux**, composables indépendamment. Un `path` sans `ease`
particulier reste possible, un `ease` sans `path` est le cas courant.

**Ce que `resolve` fait, dans l'ordre :**

```
  1. par tween   progression brute
                 → delay / loop / loopDelay / reversed / alternate
                 → ease
                 → progression easée

  2. par tween   progression easée → valeur(s)
                 sans path : interpolation par valeur, indépendamment
                 avec path : parcours du chemin, mis à l'échelle
                             uniformément sur le segment from→to

  3. dans un groupe   remplacement (défaut)
                      | pondéré  — compose des POSITIONS
                      | additif  — compose des ÉCARTS
```

**Pourquoi `groupes` et non `tweens`.** Composer suppose de savoir quels tweens sont concurrents sur la
même cible — or `ace` est aveugle aux noms et ne peut pas le déduire. **C'est l'appelant qui groupe**, et
le groupement est précalculé comme le reste. `ace` compose à l'intérieur d'un groupe sans jamais savoir sur
quoi.

**Trois propriétés à lire dans cette surface**, chacune conséquence d'une décision et non d'un choix
d'écriture : le noyau **ne voit aucun nom de propriété** ; il **porte les unités sans les résoudre, et
n'en refuse aucune** ; il **n'a pas d'horloge**. Aucune forme codplay n'y apparaît — pas de perso, pas de propriété, pas de nœud,
pas de temps de scène. Un instant nu.

**Conséquence sur la crainte du code parasite** : rien n'est à retraduire à l'exécution, **à condition que
le compilé porte déjà des `Tween` préparés et leurs groupes**. La traduction existe — elle est le prix de
la cécité aux noms — mais elle a lieu une fois, à la préparation. Une façade qui la referait par image
serait exactement le parasite à éviter.

## 3bis. La boîte à outils de transposition — seconde face du paquet

Cette conversion n'est pas un détail à improviser au moment venu : elle appelle une **boîte à outils de
fonctions utilitaires** pour réaliser les transpositions et faire passer de l'**autorat** au **contexte de
résolution**. Le cas d'exemple est celui qu'on vient de poser : un chemin produit par un éditeur devenant
la courbe normalisée que le noyau sait parcourir.

**Le paquet a donc deux faces, à tenir distinctes :**

| face | quand elle s'exécute | ce qu'elle fait |
|---|---|---|
| **le noyau de résolution** | à chaque image, chemin chaud | évalue à `t`, sans rien valider ni convertir |
| **la boîte à outils de transposition** | une fois, à l'autorat ou à la construction | normalise, convertit, prépare — produit ce que le noyau consomme |

**Ce n'est pas une commodité d'organisation, c'est l'invariant #8** : *sanitiser une fois hors chemin
chaud, faire confiance ensuite*. La boîte à outils est le « une fois hors chemin chaud » ; le noyau est le
« faire confiance ». Les fondre reviendrait à faire valider le noyau à chaque image.
- **`blend`** — **optionnel, le remplacement par défaut.** Déclaré, plusieurs tweens concurrents sur une
  même propriété se composent au lieu que le dernier remplace le précédent.

  **Option réservée à un auteur averti, donc fournie complète.** Pas un sous-ensemble minimal qu'on
  étendrait plus tard : la complétude coûte peu quand on **transpose un modèle éprouvé** au lieu d'en
  concevoir un.

  *Pourquoi ce n'est pas une « surface non exercée »* — la conduite §10 #4 écarte de reconduire ce qui
  n'a pas de consommateur, et `blend` n'en a pas aujourd'hui. Mais cette règle vise les **hooks** sans
  consommateur, poids mort. Une **capacité d'auteur** est un point d'extension : sa justesse vient de sa
  **forme**, pas de son usage courant, puisque l'usage est ailleurs. §10 #4 ne s'y applique pas.

  **Ordre arrêté : chaque tween résout d'abord, la composition vient ensuite.** Raison structurelle, pas
  de commodité : c'est le seul ordre qui compose avec `spatialCurve`. Mélanger les progressions *avant*
  résolution rendrait incombinables deux tweens suivant des chemins différents — il n'existe pas de
  progression moyenne entre deux trajectoires distinctes. Résoudre d'abord donne des grandeurs de même
  nature, combinables quels que soient les chemins.

  **Direction pour la composition elle-même : un poids par contributeur, plus un mode** — sur le modèle
  de three.js, où chaque contribution porte un poids et où le mode décide si les contributions se
  moyennent (pondéré, normalisé) ou s'additionnent. Ça évite d'imposer une sémantique unique à tout le
  noyau : « les effets se tempèrent » et « les effets s'accumulent » deviennent deux modes déclarés.
  *Le détail du modèle three.js est à vérifier avant adoption ; seule la forme est retenue ici.*

  *Conséquence à tenir* : en mode additif, ce sont des **écarts** qui se composent, jamais des positions
  absolues — additionner deux positions absolues n'a pas de sens. En mode pondéré, ce sont bien des
  positions. Le mode décide donc aussi de la grandeur composée.

**Conséquence directe, à énoncer parce qu'elle contredit une esquisse du corpus :** la conduite §3 écrit
`solve(from,to,ease,t)→valeur`. Cette forme décrivait le noyau minimal. Elle ne tient plus — ni « une
propriété à la fois », ni « un tween à la fois ». Le contrat porte au minimum : *un ensemble de tweens
actifs, dont certains portent une trajectoire sur des propriétés couplées, évalués à `t`, produisant un
ensemble de valeurs natives.*

**Ce qui ne change pas :** `temporalEase` (quand la progression accélère) et `spatialCurve` (où passe la
valeur dans l'espace) restent **deux axes orthogonaux composables**, jamais un hook générique unique —
formulation de §6.

### 3.1 Autres éléments du contrat — arrêtés

**La bibliothèque de courbes : empruntée exactement à anime.js.** Pas de sélection, pas de réduction, pas
de catalogue à réétablir. C'est le cas d'école de ce que le corpus autorise à copier — une fonction sans
état.

**`delay`, `repeat`, `direction` restent dans le noyau.** Anime les traite en interne, et ça fonctionne
parce que **c'est nous qui pilotons le ticker** — la même raison vaut ici. Ces propriétés **ne génèrent
aucun event** et ne sont pas à ce niveau de cycle : elles transforment la progression, elles n'ordonnancent
rien. On garde ce fonctionnement pour maintenant ; on pourrait chercher à les résoudre autrement, et ça
peut évoluer plus tard.

**Les valeurs interpolables comprennent les valeurs de mesure, les couleurs et les valeurs composées.**
Le chemin chaud ne classe rien : il reçoit des valeurs déjà préparées et les interpole.

### Couleurs — orientation retenue pour une étape ultérieure

L'auteur fournit des couleurs dans les syntaxes CSS qu'il emploie. Leur reconnaissance et leur
normalisation se font à l'édition ou à la compilation, jamais dans le chemin chaud d'`ace`.
La référence à étudier pour ce normaliseur est [`colorjs.io`](https://github.com/color-js/color.js) :
elle sait reconnaître les formats CSS et préparer une interpolation dans un espace choisi, notamment
OKLCH. `ace` ne l'importe pas au runtime : il reçoit deux couleurs internes déjà exprimées dans le même
espace et n'interpole que leurs coordonnées et leur alpha. Cette coupure garde le lecteur de diffusion
léger et laisse l'auteur libre d'écrire des couleurs CSS ordinaires.

Le support d'espaces supplémentaires se déclare au normaliseur selon les besoins réels ; il ne doit pas
faire entrer un espace ou un convertisseur inutile dans le lecteur.

Une écriture CSS n'est pas nécessairement un espace de couleur : les noms, les hexadécimaux et `rgb()`
désignent tous l'espace sRGB et sont normalisés vers ses coordonnées avant interpolation. À l'inverse,
une couleur déclarée en OKLCH reste en OKLCH : aucun repli implicite vers sRGB ni correction de gamut
ne sont prévus. Un intervalle porte deux bornes dans le même espace interne ; un passage entre espaces
est une transformation explicite de préparation, jamais une interpolation de texte.

*Où se fait la classification.* Hors chemin chaud, en amont — mais pas n'importe où : **analyser le CSS
hors navigateur n'est à la portée de personne**, vu sa richesse et sa diversité. Deux voies, non
départagées :

| voie | où elle peut vivre |
|---|---|
| **liste déclarée en configuration** | au Builder — c'est de la donnée, la transformation reste pure |
| **sondage par le navigateur** | à l'initialisation du player, une fois ; jamais au Builder, qui n'a pas de navigateur et doit rester pur |
| **liste générée par un utilitaire d'éditeur, à la demande** | génération dans le navigateur de l'éditeur, consommation comme donnée au Builder |

**La troisième voie ne tranche pas la tension, elle la dissout.** La génération vit là où il y a un
navigateur — l'éditeur — et s'appuie sur les valeurs qu'il manipule et sur celles qui sont accessibles ; la
consommation redevient de la donnée, donc le test au Builder se simplifie et sa pureté est préservée. La
liste n'est ni codée en dur ni figée : elle a une **procédure de régénération**, invocable à la demande.

*Conséquence à connaître* : une liste ainsi produite a une **provenance** — un navigateur, un moment. Elle
ne garantit rien pour un navigateur différent de celui qui l'a générée, et sa portée est bornée par ce que
l'éditeur expose (une scène écrite à la main hors éditeur n'est pas couverte par construction). Approche à
limites propres, retenue comme **compromis acceptable**.

**Forme retenue : un paquet utilitaire**, ce qui le rend facile à porter — et cette forme n'est pas qu'une
commodité. La classification des valeurs est **spécifique au substrat** par nature : c'est de la validité
CSS. Un autre substrat ne demande pas un générateur modifié, il en demande **un autre**. L'isoler dans son
propre paquet est donc la bonne frontière, pas seulement un rangement.

*À ne pas confondre avec la boîte à outils du §3bis* : celle-ci est indépendante du substrat (un chemin
d'auteur devient une courbe normalisée). Loger la classification avec elle ferait entrer la connaissance
du CSS dans le paquet du noyau, dont on a posé qu'il **ne parse aucun format de substrat**.

*Pour la seconde voie, une piste et un piège.* Le piège est documenté : sonder en parsant contre une
propriété de référence biaise le verdict — `width` rejette les longueurs négatives, d'où le contournement
par `margin-left`. La piste est l'**aller-retour par le CSSOM** sur la **propriété réelle** : assigner,
relire ; vide au retour = invalide, sinon on obtient validité *et* forme normalisée, sans proxy. À
vérifier avant adoption.

## 4. À instruire avant d'écrire

### 4.1 Le groupement des propriétés couplées — arrêté

**Une trajectoire vise quasi exclusivement un couple de positions** — `x`/`y`, ou ses équivalents en
`top`/`left`. Deux conséquences en découlent, et elles ferment le point bloquant.

**Le couple est commensurable par construction** — deux longueurs dans le même espace. La mise à l'échelle
**uniforme** a donc un sens : la similitude sur le segment A→B est bien définie, et la courbe garde sa
forme. Sa conséquence visuelle suit au lieu d'être choisie : un long déplacement donne une grande arche,
ce qui est la fidélité géométrique attendue d'une trajectoire. À revisiter si le rendu dément.

**Le mapping est positionnel, jamais nominal.** Si le même chemin sert indifféremment un couple `transform`
ou un couple de position, le noyau **ne peut pas connaître les propriétés** : il reçoit une **paire
ordonnée de valeurs**, et la correspondance vers des noms appartient à l'amont. Cohérent avec le fait qu'il
ne parse aucun format de substrat.

*Le « quasi »* : rien n'interdit de coupler autre chose, mais l'échelle uniforme n'a alors plus de sens
métrique. C'est une responsabilité d'auteur, pas une vérification du noyau.

### 4.2 À trancher par l'œil — se décide sur le rendu, pas avant

**Le parcours du chemin : par paramètre, ou par longueur d'arc ?** L'argument structurel penche pour la
longueur d'arc — c'est elle qui garde `temporalEase` et `spatialCurve` réellement indépendants, un Bézier
parcouru par paramètre n'avançant pas à vitesse constante et ré-easant donc le temps par sa seule courbure.
Mais ce ralentissement dans les virages peut être exactement l'effet recherché. **Perceptuel : à
implémenter en options comparables et à trancher en regardant, pas à déduire.**
- **L'ordre de résolution entre `blend` et `spatialCurve`** quand les deux s'appliquent à la même
  propriété.

### 4.3 Capacités d'anime écartées du noyau — justification

Cette section ne répète pas les exclusions déjà posées au lancement du chantier : rendu DOM, SVG,
horloge, timeline, callbacks de bibliothèque, adaptateurs ou écriture de cible. Elle traite seulement
des capacités d'anime qui paraissent pouvoir entrer dans un noyau pur, mais dont l'admission créerait une
frontière moins nette que leur traitement ailleurs.

**Règle commune : ACE reçoit une seule forme normalisée, pas une langue auteur.** Une forme pratique à
écrire n'est pas pour autant une forme utile à calculer par image. Le Builder ou une boîte de préparation
peut accueillir plusieurs écritures, puis produit les valeurs préparées que ACE résout sans interpréter.

| capacité anime | décision | justification |
|---|---|---|
| paire courte `[from, to]` | hors ACE | C'est un raccourci d'écriture. La forme interne exige toujours deux champs explicites `from` et `to`, ce qui distingue sans heuristique une borne d'intervalle d'une propriété dont la valeur est elle-même un tableau. |
| `from` absent | hors ACE | Anime le complète en lisant sa cible. ACE ne lit ni rendu ni état implicite. L'état logique amont fournit une borne complète avant la préparation. |
| `from` ou `to` fonction | hors ACE au runtime | Une fonction anime reçoit une cible, un index et des voisins, donc ne représente pas une donnée préparée, sérialisable et réévaluable. Si une convenance auteur appelle une fonction, elle le fait pendant la préparation et livre ensuite des valeurs concrètes. |
| `stagger` | préparation, pas résolution | La formule de décalage peut rester une fonction pure réutilisable. Mais elle dépend du groupe, de son ordre, de son éventuelle grille et de son origine : l'amont calcule un délai explicite par tween. ACE ne connaît ni groupe auteur ni cible. |
| listes de keyframes | préparation temporelle | Elles ne sont pas rejetées du système. L'amont les transforme en intervalles explicites et ordonnés avec leurs bornes, durées et easings. Le résolveur d'un intervalle n'a pas à deviner leur découpage. |
| `modifier` générique | hors ACE | Un hook arbitraire qui modifie chaque valeur masque la nature du calcul et contredit une résolution préparée et typée. Les besoins retenus ont des axes nommés : easing temporel, puis trajectoire spatiale. Tout autre besoin doit être nommé et justifié avant admission. |
| `utils.set()` | remplacé | Chez anime, c'est une animation de durée nulle qui mute une cible et renvoie un handle. ACE conserve seulement l'opération utile : appliquer un patch immuable à l'état logique, sans animation, handle ni écriture de rendu. |
| `get()` qui force une valeur absente à `0` | remplacé | Le défaut dépend de la propriété : `scale` illustre immédiatement que `0` n'est pas universel. ACE retourne `undefined`; les composants ou la construction de l'état portent leurs propres défauts. |
| `replace` et son portillon de chevauchement | hors ACE | Anime déduit le propriétaire d'une valeur à partir d'une histoire d'animations, de parents et de voisins. Codplay connaît ses tweens actifs et les groupe avant ACE. Le remplacement simple relève de cet amont; la composition explicite `blend` reste un sujet distinct, différé. |
| callbacks `onBegin`, `onLoop`, `onUpdate`, `onComplete` | hors ACE | Une résolution peut être appelée plusieurs fois au même instant et dans les deux sens : elle ne peut pas déclencher d'effet. Les franchissements de bornes en lecture avant sont des événements du Player; l'observation continue passe par son canal d'observation. |
| defaults et globales mutables d'anime | hors ACE | Une globale rend le résultat dépendant d'un état extérieur. Les paramètres utiles sont portés explicitement par le tween préparé ou par sa préparation; aucune précision, échelle de temps ou valeur par défaut cachée ne modifie ACE pendant la lecture. |

**Ce qui est différé n'est pas abandonné.** `spatialCurve` reste dans le contrat mais attend sa validation
visuelle; `blend` attend une étape ultérieure, potentiellement post-V2. Leur absence actuelle ne justifie
pas de faire entrer à leur place un hook générique ou la résolution de chevauchement d'anime.

## 4bis. Cadrage de l'extraction — établi par lecture directe du code

Relevé dans `animejs` 4.5.0 installé. Le build est de l'ESM lisible et non minifié : extractible tel quel.

### L'interpolation réelle fait une quarantaine de lignes

Dans `core/render.js`, tout le calcul tient là :

```js
const p = tween._ease(newTime / tween._updateDuration);

if (NUMBER)      value = modifier(round(lerp(from, to, p), precision));
else if (UNIT) { number = modifier(round(lerp(from, to, p), precision));
                 value = `${number}${tween._unit}`; }
else if (COLOR)    … lerp gamma-corrigé — hors périmètre
else if (COMPLEX)  composeComplexValue(tween, p, precision)
```

`lerp(from, to, ease(p))`, un modificateur, un arrondi, l'unité recollée.

### Le portillon est sans objet — c'est la trouvaille principale

Les ~150 lignes qui précèdent sont une condition géante décidant *si* un tween a le droit d'écrire :
`_isOverridden`, `_isOverlapped`, chaînages `_prevRep`/`_nextRep`, reprises entre parents, points de
bascule, réversions au seek arrière.

**Ce portillon existe parce qu'anime ne possède pas la timeline de ses consommateurs** : il doit *déduire*
quel tween détient la valeur à cet instant. Codplay **possède** la sienne et sait quels tweens sont actifs
à `t`. Le portillon n'est donc pas à réécrire — il est sans objet. La partie la plus volumineuse et la plus
retorse d'anime est exactement celle dont on n'a pas besoin.

Même remarque pour `composition.js` : le mode `replace` n'y est pas « le dernier gagne », c'est une
résolution de chevauchement qui tronque la durée du tween précédent et remonte annuler animations et
timelines parentes. Inséparable de l'architecture d'anime, donc non extractible — et inutile.

En revanche le mode `blend` tient dans une **astuce de valeurs** indépendante du reste : chaque tween mêlé
voit son `to` mis à 0 et son `from` transformé en écart, un « tween de tête » partagé portant la base, que
`additive.js` recompose en sommant. Extractible tel quel.

### Le tableau

| couche | volume | |
|---|---|---|
| interpolation (`lerp` + ease + modifier + arrondi + unité) | ~40 l. | **extraire tel quel** |
| `core/values.js` — décomposition `{type, nombre, unité, opérateur}` | 266 l. | **extraire** |
| `easings/` — courbes, cubic-bezier, spring, steps, irregular, linear | ~640 l. | **extraire en entier** |
| `core/units.js` — conversions génériques (angles, rapports) | 65 l. | **extraire** ; la partie `cq*` reste la nôtre |
| `animation/additive.js` + le bloc blend de `composition.js` | ~80 l. | **extraire** |
| portillon `replace` (gate de `render.js` + `composition.js`) | ~200 l. | **sans objet** |
| écriture au substrat (setter/style/transform/`buildTransformString`) | ~60 l. | **non** — c'est `project` |
| `animation/animation.js` — keyframes, valeurs fonctionnelles, `Timer`, cibles | 743 l. | **non** — parsing et ordonnancement |
| `engine/`, `core/clock.js`, `timer/`, `timeline/` | — | **non** — l'horloge, qu'on pilote |
| `svg/` | — | **hors périmètre** — autre composant |
| `draggable/`, `text/`, `layout/`, `scope/`, `waapi/`, `events/`, `adapters/three/` | — | **non** |

Le noyau à extraire est de l'ordre de **1000 lignes**, dont l'essentiel est le catalogue de courbes et la
manipulation de valeurs — pas l'interpolation.

### Deux relevés qui corrigent des idées reçues

- **La décomposition d'anime accepte `-8.62cqw`** : c'est un regex nombre+unité, sans validation par
  propriété. Le blocage sur `width` vient du Typed OM employé côté codplay, pas d'anime.
- **Anime classe les propriétés par `prop in target.style`** — un test d'appartenance, pas un parse de
  valeur. Bien plus léger que ce qu'on envisageait pour la liste du §3.1.

## 5. L'oracle de parité

Il n'a besoin d'aucune V1 et survit au retrait de la dépendance : **les valeurs produites par anime sur
les mêmes entrées, calculées une fois et figées en fixtures.** Une table `(from, to, ease, t) → valeur`
suffit à prouver l'iso sur les courbes.

À noter : cet oracle ne couvre que le portage des courbes. `spatialCurve` et `blend` n'ont pas
d'équivalent exercé dans le code actuel — leur justesse se prouve par leurs propres tests, pas par
comparaison.

## Statut

Non normatif.

**Arrêté** : statut, emplacement, rapport à la V1 (§1) ; `spatialCurve` optionnel avec droite par défaut,
trajectoire en **donnée normalisée** mise à l'échelle sur le segment réel (§3) ; `blend` optionnel avec
remplacement par défaut, **fourni complet** parce que capacité d'auteur averti transposée d'un modèle
éprouvé — et non « surface non exercée » au sens de la conduite §10 #4 (§3) ; composition **après**
résolution de chaque tween, avec **poids par contributeur et mode** (§3) ; **deux faces du paquet** —
noyau en chemin chaud, **boîte à outils de transposition** hors chemin chaud, par l'invariant #8 (§3bis).
Frontière reconnue depuis le corpus (§2).

**Arrêté aussi** (§3.1) : courbes empruntées exactement à anime ; `delay`/`repeat`/`direction` dans le
noyau, comme anime, parce qu'ils ne génèrent pas d'events et que nous pilotons le ticker — provisoire,
peut évoluer ; valeurs interpolables = **mesures, couleurs et valeurs composées**, et le chemin chaud ne
classe pas.

**Arrêté, hors noyau** (§3.1) : la classification des valeurs passe par une **liste générée à la demande
par un utilitaire d'éditeur**, consommée en donnée au Builder — compromis acceptable, limites connues.
Forme : **un paquet utilitaire séparé**, parce que la classification est spécifique au substrat, à ne pas
confondre avec la boîte à outils du §3bis.

**Arrêté** (§4.1) : une trajectoire vise un **couple de positions**, donc commensurable — mise à l'échelle
**uniforme**, et **mapping positionnel** : le noyau reçoit une paire ordonnée de valeurs, jamais des noms
de propriétés. **Plus rien ne bloque l'écriture de la signature.**

**Ouvert, par l'œil** (§4.2) : parcours par paramètre ou par longueur d'arc. Perceptuel — à implémenter en
**options comparables** et à trancher sur le rendu. Ne bloque pas le démarrage ; exige seulement qu'on ne
le fige pas d'emblée.
