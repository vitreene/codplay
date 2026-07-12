# ed2 — Les axes d'architecture (vue d'ensemble)

Synthèse en clair des principes de conception d'ed2, pour avoir la vue globale des axes de développement. Document de référence pédagogique (il explique les principes, ne prescrit pas la structure — celle-ci est dans le modèle de données). Non normatif, mais stable : ces axes structurent tout le reste.

Chaque axe est un **principe** + sa **raison** + ce qu'il **rend possible**.

---

## 1. Un seul propriétaire du document

**Le contrôleur central (une machine d'état) possède le document** (l'`EditorScene`). Il existe en un seul exemplaire ; aucun module (timeline, éditeur de décor, éditeur de zones, cadre de sélection) n'en détient de copie. Les modules **lisent** une projection du document et **émettent des intentions** ; le contrôleur applique, puis rediffuse.

- **Pourquoi** : la dispersion de l'état entre modules et vues est l'erreur qui rendait le prototype antérieur ingérable. Un seul propriétaire = pas de synchronisation croisée, pas de divergence.
- **Rend possible** : la sélection commune (un item désigné depuis la timeline ou le player, c'est le même objet), la cohérence garantie entre toutes les vues, et tout ce qui suit (persistance, historique) branché en un seul point.

## 2. Une seule voie d'écriture : la façade de commandes

**Toute mutation du document passe par une façade de commandes** — jamais une écriture directe. Une commande = une entrée d'historique. Une transaction groupe plusieurs mutations en une seule action.

- **Pourquoi** : un point d'écriture unique rend gratuits l'annulation, la persistance et la composition — sinon chacun serait à recâbler partout.
- **Rend possible** : l'undo/redo (empiler au commit), les macros (transaction groupée), et le développement par composition (axe 3).

## 3. Développer par composition, pas par code spécial

**Une fonctionnalité se construit en composant des commandes de base**, pas en écrivant un chemin de code dédié. Le vrai investissement est un **jeu de commandes de base complet et orthogonal** (créer un item, l'attacher, poser un décor, créer une capsule, placer en zone…) ; les fonctionnalités de haut niveau en découlent.

- **Pourquoi** : composer des opérations existantes coûte moins et casse moins que multiplier des cas particuliers codés en dur.
- **Rend possible** : des features exprimées comme des séquences de commandes lisibles et testables (ex. « déposer un lot d'images → créer une capsule carousel + les items » = une macro). Les mutations sont **pures** (`document → document`), donc composables et testables sans écran.
- **Limite** : cet axe concerne les **mutations du document**. Les gestes (géométrie, aperçu) et l'éphémère restent en dehors.
- **À creuser** : les gestes d'**édition du décor** (déplacer, redimensionner, changer une couleur au curseur) sont les actions **les plus fréquentes** — cœur du ressenti utilisateur. Bien que « éphémère » techniquement, ce chemin (aperçu live + commit débouncé) mérite un **traitement de première importance**, peut-être un sous-traitement dédié à la partie décor (fluidité, latence, confort). À approfondir — cf. discussion, point A.

## 4. Le Builder est la frontière

**Le Builder transforme le document auteur en scène jouable** — et c'est le seul point de passage entre l'espace d'édition et le moteur de lecture (Codplay). C'est là, et nulle part ailleurs, que le vocabulaire de l'auteur (item, capsule, décor) devient le vocabulaire du moteur (composant visuel, CSS). La transformation est **pure** (rejouable, testable hors écran).

- **Pourquoi** : séparer nettement « ce que l'auteur manipule » de « ce que le moteur joue » permet à chacun d'évoluer sans contaminer l'autre.
- **Rend possible** : un moteur qui ne connaît rien du vocabulaire auteur (il ne reçoit qu'une scène compilée), et un modèle auteur qui ne dépend pas des détails du moteur.

## 5. Le moteur (Codplay) est un séquenceur aveugle au contexte

**Codplay orchestre des événements dans le temps** — rien de plus. Il ignore l'environnement où il se joue (taille, orientation, support). La résolution du contexte n'est pas dans le moteur : elle est portée par ce que le Builder produit (du CSS conditionnel), ou par des composants qui, eux, observent.

- **Pourquoi** : un séquenceur qui ne dépend pas de son contexte est autonome — la scène compilée se suffit à elle-même, sans l'app autour.
- **Rend possible** : la diffusion autonome (le player joue seul), et le fait que l'orientation, par exemple, se règle en amont (CSS) sans toucher au cœur.

## 6. Trois données séparées : contenu, aspect, capacités du type

L'item **relie** trois natures de données distinctes, chacune à un seul endroit :
- le **contenu** (ce qui est montré : texte, source média) → sa table propre ;
- l'**aspect** (comment c'est habillé, variable dans le temps : style, position) → sa table propre, par keyframe ;
- les **capacités propres au type** (statiques : ce qu'une capsule sait faire comme conteneur…) → un objet dédié sur l'item.

Trois données, trois interfaces d'édition distinctes (même barre d'édition possible, cibles séparées). L'assignation du contenu se fait **à la création de l'item**, pas dans l'éditeur d'aspect.

- **Pourquoi** : mélanger ces natures (mettre du contenu dans l'aspect, par ex.) recrée les doublons qu'on cherche à éviter — une même donnée à deux endroits finit par diverger.
- **Rend possible** : une édition claire (chaque panneau sait quelle donnée il touche) et l'extensibilité de l'axe 7.

## 7. Croître par ajout de types, chaque type ayant son objet de capacités

**Un type d'item différencié porte ses capacités propres dans un objet dédié** (la capsule est la première instance : ses réglages vivent dans un objet à part, séparé du contenu et de l'aspect). Ajouter un type à ed2 = ajouter cet objet de capacités **côté auteur**, et son composant de rendu **côté moteur** — les deux moitiés d'un même geste, reliées par le Builder.

Tout item **naît sans type arrêté** (un « bloc », le type sans contenu) puis se **différencie** ; les boutons de création ne sont que des raccourcis de cette opération. Le changement de type ultérieur n'est pas ouvert en v1, mais la structure le prépare.

- **Pourquoi** : donner une **forme régulière** à la croissance de l'app — enrichir n'est plus du cas par cas, mais toujours le même geste (type + objet + composant).
- **Rend possible** : de nouveaux types de rendu (un texte rendu en graphique, etc.) sans refondre le modèle, et un changement de type futur obtenu en levant une restriction plutôt qu'en reconstruisant.
- **Discipline** : l'objet de capacités décrit ce que le type sait faire de spécifique — jamais le contenu, l'aspect ou le temps, qui ont déjà leurs places (axe 6).
- **Instance validante à venir — la « story-comme-média »** : inclure une story Codplay (ex. la démo chrono) comme un item paramétrable (durée, couleur…), non modifiable dans son fonctionnement, seulement configurable. C'est une **nouvelle instance** de cet axe (type + objet de capacités + composant), pas une exception — preuve que le modèle tient. **Nouveauté à spécifier** : son objet de capacités est un **schéma auto-déclaré par le composant** (la story dit quels paramètres elle expose), là où `CapsuleDef` a des champs fixes. Cf. discussion, point B.
- **Portée bien plus large que « un type de plus »** : la story-média est un **mécanisme d'extension par briques métier clé en main** (ex. un module quiz : questions, réponses, logique succès/échec). L'**interactivité est résolue par Codplay** (il est fait pour ça). Côté ed2, ce n'est **pas « jamais »** mais **« pas encore »** : rien n'est écrit aujourd'hui pour tenir compte d'un composant qui interrompt le fil. Les **modules story sont une étape intermédiaire** (brique interactive clé en main, configurée sans qu'ed2 modélise l'interruption). Quand ed2 y viendra, l'**interruption du fil** touchera ce qu'il gère — le **fil temporel** (la timeline devra un jour représenter « le fil s'arrête et attend ») ; construire la logique restera à Codplay, interfacer l'interruption sera à ed2. À concevoir le moment venu, rien n'existe pour ça. Doctrine : **cacher la complexité de construction, laisser le bénéfice de l'usage** → trois couches d'acteurs (développeur Codplay construit les briques / ed2 les intègre par le patron / utilisateur grand public les configure sans voir la mécanique). Ouvre l'horizon « scène qui réagit » → parcours/chapitre. **Objectif éloigné — à garder en vue, pas à construire.** Cf. discussion, point C.

## 8. Le modèle est indépendant du substrat de rendu

**Un seul endroit est lié au HTML : l'aspect (`Decor`)**, parce que le HTML est l'espace de rendu naturel d'ed2. Tout le reste — le modèle d'item, les objets de capacités, les services du moteur, le Builder, les commandes — est **neutre vis-à-vis du substrat**.

- **Pourquoi** : c'est ce qui garde le modèle réutilisable et empêche l'intrusion de suppositions de rendu là où elles n'ont rien à faire. Un HTML introduit hors de `Decor` est une intrusion, pas une commodité.
- **Rend possible** : on pourrait imaginer un éditeur jumeau rendant tout en SVG, un autre en canvas — chacun avec **son** aspect (les capacités de son substrat), mais le **même modèle** pour tout le reste.
- **Symétrie côté moteur** : un composant déclare des **services** transverses (les capacités partagées, comme l'aspect) et garde sa logique propre (comme l'objet de capacités du type). Le découpage mutualisé/spécifique est le même des deux côtés de la frontière.

---

## Frontière document / éphémère (transverse)

Un fil traverse tous les axes : distinguer **ce qui entre dans le document** (persistable, annulable — les mutations via la façade) de **ce qui reste local et jetable** (les gestes, l'aperçu direct, le défilement, la position de lecture). Cette frontière est ce qui rend l'undo propre (seul le document s'annule), l'aperçu d'édition léger (il ne pollue pas la donnée), et la séparation des responsabilités tenable.

## Comment lire ces axes ensemble

- **1–3** disent comment l'app **agit** sur le document (propriété unique → voie d'écriture unique → composition).
- **4–5** disent comment l'auteur et le moteur **se parlent** (le Builder traduit ; le moteur reste aveugle au contexte).
- **6–8** disent comment le modèle **est structuré et croît** (trois données séparées → un objet de capacités par type → indépendance du substrat).

Les trois groupes se tiennent : agir par commandes composables, traduire par le Builder, croître par types+composants — sur un modèle qui ne présuppose ni son substrat de rendu ni son moteur.
