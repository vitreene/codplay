# CodPlay V2 - plan de partie CompiledScene

## Perimetre et autorite

Ce document detaille la tranche `SceneDoc -> build -> CompiledScene`. Il applique le plan general
`./codplay-v2-plan.md` et ne redefinit ni son flux ni ses invariants. La tranche
reste autonome et ne dépend d'aucune ancienne implémentation.

## Etat

- Revue priorité 0 effectuée le 2026-08-20 : la frontière structurelle actuelle
  est relue et gelée pour les tranches qui la consomment.
- Diagnostics transversaux du plan general en place et testes.
- Squelette des contrats `SceneDoc` et `CompiledScene` relu sur la tranche initiale.
- Normalisation structurelle et premiers guards relus sur la tranche initiale.
- Premier builder, deriveurs de base et codec structurel en place; la tranche
  structurelle est gelée comme fondation de flux de rendu. La validation
  sémantique interne du codec est maintenant en place; les formes core des
  services et leur exposition au moteur de validation sont également en place.
  Les contrats initiaux des composants core présents (`tag`, `layout`, `list`,
  `media`, `img`, `input` et `polygon`) sont maintenant validés par leurs
  définitions de composant. Tout nouveau service ou toute nouvelle propriété
  est ajouté avec le composant qui le porte et sa validation dédiée.
- Preparation des paths SVG auteur en objets `Path` ACE en place, exportee comme primitive reutilisable et couverte par test.
- Mode actuel : implementation V2 incrementale, pas de prototype autonome.
- Source unique de declaration composant/services/modules en place via `RuntimeCapabilityCatalog.validationSnapshot()`; chaque composant core ou externe doit y être enregistré avec son profil d'entrée et son validateur. Les extensions futures suivent exactement ce même circuit.

## Principes

`CompiledScene` porte un contrat V2 explicite et peut s'étendre lorsque la
résolution est déterministe, sérialisable, indépendante de l'engine, du player,
du DOM, de l'horloge et des ressources effectivement chargées. Une résolution
supplémentaire ne doit pas changer la sémantique auteur; elle doit livrer au
player une décision déjà établie ou un manifeste exploitable.

La table fixe `CompiledPerso.actions` permet de dériver `actionTargetIndex` à la
compilation. Cet index ne crée aucune action et ne remplace pas les déclarations
des persos : il évite seulement une recherche de cibles pendant une capture live.

La tranche est conduite en deux temps complementaires :

1. Avant le code, examiner le builder, le schéma, le codec, les exports et les besoins du player pour classer
   chaque donnee en preservee, normalisee, derivee ou extraite. Chaque capacite resolue en amont doit avoir une
   raison et un test de contrat.
2. Pendant la construction du player, reevaluer chaque capacite au moment ou elle est introduite. Elle passe par
   la compilation si elle est deterministe depuis `SceneDoc` et si son resultat reste portable; elle reste dans
   le player si elle depend de `t`, d'un event, d'un etat runtime, de l'engine, d'une mesure ou d'un effet.
   La decision est inscrite dans le contrat et le test de la capacite, pas dans une branche implicite du player.

## Analyse des proprietes

La surface de proprietes traitables d'un `Perso` depend de son type de composant.
La classe du composant declare la liste de services qu'elle utilise; chaque
service porte ensuite le contrat des proprietes recevables, leur validation, leurs
defaults eventuels et leur mode temporel. `RuntimeCapabilityCatalog.validationSnapshot()`
expose cette declaration au build. Il n'existe pas de matrice globale independante des
types de composants et des services.

## Références de capacités dans `CompiledScene`

Chaque composant utilisé par une scène doit être identifiable dans l'artefact
compilé. Le `CompiledScene` conserve donc les références de capacités dérivées
de toutes les stories actives :

- les types de composants dans `requirements.components` ;
- les services déclarés par ces composants dans `requirements.services` ;
- les modules nécessaires à leur exécution dans `requirements.modules` ;
- les ressources réellement référencées dans `requirements.resources` et le
  manifeste `resources`.

Le builder vérifie les profils avec le snapshot du catalogue avant de produire
l'artefact. Le validateur sémantique vérifie ensuite la cohérence interne des
références compilées, puis l'engine confronte les requirements au catalogue
disponible avant l'initialisation du player. Les validateurs, factories et
classes runtime ne sont pas sérialisés dans `CompiledScene` : ils restent dans
le catalogue de l'instance. Les références de fonctions restent, elles aussi,
des références externes séparées de l'artefact JSON.

Pour chaque propriete declaree par un service, le contrat indique sa presence dans
`initial`, sa presence dans une action, son mode temporel, sa serialisabilite, sa
participation a l'interpolation et sa valeur par defaut eventuelle. Le mode temporel
remplace la distinction ancienne statique/dynamique qui servait surtout a
reconstruire le runtime lors d'un seek.

- Une propriete est **constante** si sa valeur ne depend pas de `t`, **discrete** si elle change par faits ou
  fenetres de validite, **continue** si elle est une fonction preparee `f(t)`, ou **live/effet** si elle depend
  d'une entree ou d'un effet irreductible au modele temporel.
- La presence dans `initial` ou dans une action ne suffit pas a determiner le mode : une valeur `initial` peut etre
  la borne d'une behavior continue, et une action peut ouvrir une nouvelle plage discrete ou continue.
- `initial.style` peut etre separe en baseline constante et canaux temporels, mais aucune conversion automatique en
  classe CSS n'est admise sans contrat de composant. Les unites, la priorite inline, les refs internes et la
  portabilite hors DOM doivent rester explicites.
- La separation constante/variable sert a preparer les behaviors, les plages de validite, les defaults et les
  requirements. Elle ne doit pas reintroduire une reconstruction speciale au seek : l'etat logique reste evalue
  a `t` puis remis au composant.
- L'inventaire des canaux dynamiques peut aider a completer un `from` absent uniquement lorsque la valeur de
  depart est deterministe depuis la donnee compilee ou la sequence resolvable. Une valeur issue du runtime, d'une
  capture, d'un event dynamique ou d'un effet reste resolue par le player.
- Les proprietes normatives de `Scene`, `Story` et `Perso` sont definies par le contrat V2. L'auteur peut omettre
  une propriete seulement si le builder possede un default normatif et si la sortie compilee la rend explicite.
- L'option de rendre `actions` optionnel dans `SceneDoc` doit etre tranchee par le contrat V2. Si elle est retenue,
  le build produit la forme canonique et realise toujours l'auto-reference `actions[perso.id] = null`, sans rendre
  cette convention implicite dans le player.

## Precondition ACE et defaults

ACE ne recoit jamais une valeur absente : `prepareTween` exige `from` et `to`, et le noyau ne lit ni le DOM ni
un etat implicite. Toute valeur necessaire a une interpolation doit donc exister avant l'appel a ACE, soit dans
le `CompiledScene`, soit dans l'etat logique materialise par le player depuis des defaults deja declares.

Un catalogue de defaults courants est place dans `config/`, hors de la logique `CompiledScene`. Il couvre les
canaux usuels de pose et de rendu afin que la majorite des scenes soit completee sans declaration supplementaire.
Chaque entree du catalogue porte une valeur semantique en unite auteur, sa nature et sa politique de fallback; le
player n'y lit jamais une valeur CSS. `CompiledScene` ne consulte ce catalogue qu'en dernier recours, apres les
valeurs explicites et les defaults fournis par l'editeur ou la scene.

La resolution des defaults suit cette hierarchie :

1. valeur explicite de l'auteur dans `initial`;
2. valeur declaree dans un event ou une action, lorsqu'elle est disponible a la preparation;
3. override optionnel `SceneDoc.defaults`, uniquement pour les proprietes autorisees par le registre du type;
4. default du catalogue de propriete/composant, porte par `config/` ou le catalogue de capacites;
5. diagnostic si aucune valeur n'existe.

Les defaults CSS du navigateur ne sont pas lus comme une source implicite : la compilation et ACE doivent rester
portables et ne doivent pas interroger un substrat. Les identites `translateX/Y = 0`, `rotate = 0` et
`scaleX/Y = 1` sont des defaults du vocabulaire de pose CodPlay a declarer dans son contrat. Une couleur ne doit
pas etre arbitrairement remplacee par `black` si le contrat vise la valeur CSS `canvastext` ou une autre valeur
portable; elle doit etre explicite dans le contrat ou dans `SceneDoc.defaults`.

Un warning est produit lorsqu'une propriete potentiellement dynamique n'a pas de default declare. Cela devient une
erreur bloquante lorsque la compilation ou la materialisation doit effectivement preparer un tween et qu'aucun
`from` deterministe n'est disponible. Un `from` absent d'une action statique peut etre complete par le build; un
`from` dependant d'un event, d'une capture ou d'un effet est materialise depuis l'etat logique avant ACE, jamais
depuis le DOM.

`SceneDoc.defaults` est donc une capacite candidate, pas un sac de valeurs libre : sa forme doit etre typee,
validee par propriete et reservee aux valeurs sans default universel. Les defaults de base restent dans le contrat
de propriete ou de composant afin de ne pas obliger chaque scene a les redeclarer.

## Purification et architecture

- Les guards valident les formes, identites, references, tokens, valeurs et coherences admises.
- La sanitation normalise les representations autorisees et retire les donnees exclues de la diffusion.
- Les fonctions et autres valeurs non serialisables sont extraites avant la production de l'artefact.
- Les straps locaux de la scène et des stories suivent cette même frontière :
  leurs fonctions sont extraites dans la collection du builder et l'artefact
  ne conserve que leurs références. Une liste de noms reste une déclaration
  explicite de strap réutilisable fourni par l'hôte.
- Les deriveurs construisent les sections nommees de l'artefact depuis la donnee canonique.
- Les paths SVG auteur sont transformes une fois en objets `Path` ACE JSON-safe. `prepareSvgPath`, exporte par
  `src/ace/index.ts`, est la primitive pure partageable par le builder et les futurs straps; le runtime ne parse
  jamais la syntaxe SVG.
- Les proprietes de transformation sont la premiere verticale de defaults; leur contrat est detaille dans
  [`transform-properties-plan.md`](./transform-properties-plan.md).
- Les couleurs suivent une seconde frontiere de normalisation, documentee dans
  [`color-values-plan.md`](./color-values-plan.md), avant toute interpolation ACE.
- Les unites ne sont jamais converties pendant le build; ACE impose une unite compatible et `render` porte
  la conversion dependante du substrat, selon [`unit-values-plan.md`](./unit-values-plan.md).
- Le codec valide l'enveloppe et les artefacts serialises avant leur entree dans un player.
- Le player fait confiance au resultat compile et ne recree pas ces guards sur son chemin chaud.

`src/scene/compiled` est organise par responsabilites nommees : contrat et sections typees, guards/sanitation,
deriveurs, codec et finalisation immutable. Une nouvelle regle ajoute une section typee ou un deriveur de domaine
et ses tests; elle ne passe pas par un sac d'extensions generique, une seconde forme de `CompiledScene` ou une
logique defensive dispersee dans le player. L'enveloppe V2 reste stable, mais son contenu peut etre reordonne ou
regroupe pour la lecture tant que le codec et les dependances declarees preservent le contrat.

La preparation syntaxique `adapter -> ACE` n'appartient pas a `src/scene/compiled` :
elle est testee et maintenue dans `src/ace`. Pour les paths, `prepareSvgPath` est
la fonction publique de conversion d'une chaine SVG en `Path`; `compileMovePath`
ne fait que l'appliquer au payload `move.transition` pendant le build. La scene
compilee ne conserve donc pas la syntaxe auteur. Un strap futur qui produit un
path dynamique reutilise `prepareSvgPath` avant de retourner sa mise a jour.
Le codec ne parse ni couleur ni transform.
Le chemin chaud `resolve` recoit un intervalle deja prepare et ne revalide pas les
syntaxes auteur, les unites ou les espaces couleur.

## Catalogue de validations

Le `RuntimeCapabilityCatalog` est construit au moment ou CodPlay enregistre les declarations de composants. Une
declaration unique porte le type, la classe du composant, les modules et la definition de validation optionnelle.
La classe porte sa liste ordonnee de services declares. Son `validationSnapshot()` fournit la vue pure du build.
Cette vue ne contient ni classe instanciee, ni node, ni service runtime vivant ; le builder l'utilise pour valider
un `Perso`, ses actions et les services declares.

Un descripteur de composant peut fournir `validateInitial` et `validateAction`, mais ces fonctions ne sont pas
obligatoires au debut. Leur absence produit un warning auteur detaille avec le type, le perso et le chemin concernes.
Un service declare sans validateur produit le meme type de warning. Un service absent du catalogue ou un type de
composant inconnu reste une erreur de capacite, car le player ne saurait pas l'executer.

Les validateurs communs sont fournis avant les validateurs de composants : `style`, `className`, `attr` et `content`. Ils
valident les formes de leurs payloads sans connaitre le DOM. Un helper commun structure les warnings de validateur
manquant et garantit des references coherentes dans le rapport.

## API des validateurs et services

Un validateur declare explicitement la surface qu'il couvre. Le nom du service est le namespace de propriete
correspondant : `style`, `className`, `attr`, ou un service metier tel que `layout` ou `media`.

La validation suit trois niveaux :

- forme du groupe : `style` est-il un objet, `className` une chaine ou un patch, `attr` une map ;
- proprietes du groupe : `style.opacity`, `style.x`, `layout.orientation`, etc., quand le groupe les declare ;
- coherence du composant : relations entre plusieurs services ou proprietes, via le validateur optionnel du type.

Le contrat d'un service doit donc pouvoir declarer son validateur et une liste de validateurs de proprietes internes.
Une propriete inconnue n'est pas automatiquement rejetee : le service declare s'il est ouvert ou ferme, et le
diagnostic depend de cette decision. `style` peut rester ouvert pour les proprietes de rendu transposables, tandis
qu'un service metier peut etre ferme.

Les définitions des composants core présents complètent cette validation sans
créer de namespace parallèle :

- `tag` valide le nom de balise lorsqu'il est fourni ; son absence conserve le
  défaut contractuel `div` ;
- `layout` exige un `markup` non vide avant la materialisation HTML ;
- `list` valide son nom de balise optionnel et les trois options booléennes de
  `config` (`reorderOnMove`, `reorderOnAdd`, `reorderOnRemove`) ;
- `media` porte déjà la validation de sa source, de sa balise et de ses options
  de synchronisation.

Ces règles restent des validateurs de payload auteur : elles ne lisent pas le
DOM, n'instancient pas le composant et ne remplacent pas la validation runtime
des capacités nécessaires au player.

Cette organisation encourage les composants a exposer des donnees par capacites semantiques (`layout: {...}`,
`media: {...}`) plutot qu'a laisser fuir une collection de methodes internes au niveau du perso. Elle ne force pas
la forme interne de la classe : elle fixe seulement la surface de donnees que le builder et les services peuvent
comprendre. La consequence runtime sera formalisee dans la tranche composants : `update` est l'unique distributeur
des valeurs recues; les methodes internes ne redistribuent pas elles-memes un patch et ne deviennent pas des points
d'entree concurrents.

Le catalogue ne remplace pas les guards structurels de `SceneDoc`; il les complete. Le builder garde la responsabilite
des defaults de forme (`undefined`, `[]`, `{}`), tandis que le descripteur de composant garde la responsabilite des
valeurs et proprietes propres au type.

`CompiledSceneValidationEngine` est le premier consommateur de ce catalogue. Il recoit le snapshot produit par
CodPlay, parcourt les payloads et appelle les validateurs de composants et de services sans instancier de composant.
Les validateurs core `style`, `className` et `attr` sont obligatoires dans le catalogue initial; les validateurs de
composants peuvent manquer temporairement et produisent alors les warnings prevus.

Un composant peut en plus declarer deux fonctions de sanitation pures dans le catalogue :
`sanitizeInitial` pour le profil d'entree du perso et `sanitizeAction` pour les actions partielles. La validation
reste responsable des diagnostics ; la sanitation applique uniquement les defaults et completions prevus par le
contrat du composant. Lors de la compilation, le builder execute `sanitizeInitial` avant l'extraction des chemins
et `sanitizeAction` avant la compilation d'une action. Le composant runtime recoit ainsi un profil compile complet,
et n'a pas a revalider les donnees auteur ni a reconstruire ses defaults.

## Socle minimal des guards

Le but initial n'est pas de recenser toutes les règles historiques. Il est de poser une architecture dans laquelle une regle
se comprend, se teste et s'ajoute sans modifier le pipeline ni disperser des conditions dans le builder.

Le socle comporte :

- un contrat `GuardRule` nomme, avec un identifiant stable, une cible de domaine, une phase et une fonction de
  verification ou de completion;
- un `GuardPipeline` qui execute une liste ordonnee de regles et transmet un contexte commun;
- un contexte de regle qui porte le chemin de donnee, les references scene/story/perso et le
  `DiagnosticCollector` du general;
- les chemins structurels et constantes de validation sont declares dans `src/scene/config/`, pas dans les
  conditions du moteur;
- des regles regroupees par domaine (`scene`, `story`, `perso`, `property`, `compiled`) plutot qu'un validateur
  monolithique;
- une separation nette entre guard de forme, normalisation, completion par default et deriveur. Une regle ne doit
  pas faire les quatre a la fois.

`GuardPipeline` fournit ce socle d'execution et ne porte encore aucune connaissance complete de `SceneDoc`. Les
regles de domaine sont ajoutees au fur et a mesure des contrats effectivement construits.

Une nouvelle regle doit declarer : la condition qu'elle protege, la source de la valeur attendue, le default
applicable, la severite du diagnostic et un test de succes/echec. Une propriete encore non couverte par une regle
ne peut pas etre envoyee a ACE comme si elle etait validee; elle est preservee seulement si son contrat l'autorise,
avec un diagnostic lorsque son usage exige une completion.

La premiere tranche de regles se limite au contrat necessaire pour commencer : enveloppe `CompiledScene`, identites
scene/story/perso, structures obligatoires, `actions` optionnel avec completion de l'auto-reference si la decision
V2 est retenue, defaults courants de pose et preparation d'un `from` deterministe. Les regles de composants et de
proprietes supplementaires sont ajoutees avec les verticales qui les consomment.

## Execution

| Etape | Livrable | Dependance | Etat |
|---|---|---|---|
| 1. Contrats | Types separes `SceneDoc`, donnee canonique, sections `CompiledScene`, requirements et registre de proprietes par services | Diagnostics generaux | Tranche initiale relue; formes core des services couvertes |
| 2. Catalogue | Descripteurs composants, services et proprietes recevables, `RuntimeCapabilityCatalog.validationSnapshot()` transmis au build, validators communs et obligation d'un validateur de profil par composant | Contrats + diagnostics | Contrat core en place; tout nouveau composant, core ou externe, doit fournir son profil et son système de validation au moment de son enregistrement |
| 3. Guards | `GuardPipeline`, normalisation structurelle, guards d'entree, defaults auteur et refus des valeurs non admises | Contrats + catalogue | Socle structurel en place; refus des payloads propres aux composants core présents couvert par leurs validateurs |
| 4. Deriveurs | Extraction des fonctions, stories actives, ressources, requirements, modes temporels de proprietes, candidats `rootNodeIds` et `actionTargetIndex` | Contrats + guards | Références de capacités dérivées de toutes les stories actives; périmètre gelé avant le player |
| 5. Codec | Encode/decode interne, validation d'import et finalisation immutable | Contrats + deriveurs | Enveloppe, invariants sémantiques internes et immutabilite en place; migrations de schema hors tranche |
| 6. Fixtures et couverture | Fixtures représentatives et tests du contrat V2, sans reintroduire les fonctions dans l'artefact | Etapes 1 a 5 | Corpus structurel S1-S4 et couverture des validateurs core; aucune nouvelle couverture player |
| 7. Revue player | Pour chaque capacite player, decision compile ou runtime et test associe | Artefact V2 | Frontière Engine/Player relue dans [`player-engine-plan.md`](./player-engine-plan.md); capacités supplémentaires restent à ouvrir |
| 8. Documentation | Spec `CompiledScene`, invariants et suivi final; retrait des seuls points temporaires resolus | Implementation complete | A faire en cloture |

## Points de vigilance

> Registre de travail des trous a verifier pendant la tranche. Une fois la tranche implementee, supprimer
> uniquement les points devenus inutiles ou purement historiques. Les decisions, invariants et situations
> resolues doivent rester dans la spec du concept et dans le suivi d'implementation; cette section ne constitue
> pas un second plan.

- `rootNodeIds` est une valeur generee, jamais une entree de `SceneDoc` ni une autorisation auteur.
- `rootNodeIds` est le manifeste compile des candidats pouvant atteindre la racine de montage; le player
  reconcilie le montage reel depuis l'etat resolu a l'instant `t`, y compris lorsqu'une action `move: '@root'`
  ajoute ou retire un candidat.
- La liste ne doit pas etre interpretee comme une photographie immuable des seuls noeuds montes a `t=0`.
- Le montage page-level a un seul proprietaire dans V2; une facade de diffusion ne remonte pas une seconde fois
  les memes noeuds.
- Le contrat decide explicitement si les entrees sont des IDs de persos ou de story hosts; aucun noeud de story
  synthetique ne peut etre introduit pour masquer cette decision.
- Les IDs sont opaques et uniques dans une scene. Leur origine est portee par les declarations internes du
  registre de cibles, pas par une convention de nommage ; une factory externe d'instanciation garantit
  l'unicite lorsqu'une story ou un perso est cree plusieurs fois.

### Criteres de cloture

- Une action `move: '@root'` est visible sous le point de montage exactement dans sa fenetre de validite.
- Un seek avant et apres cette action reconstruit le meme montage sans relecture d'effet ni lecture du DOM.
- `@off` et les placements non racine retirent le noeud du point de montage.
- Plusieurs racines conservent leur ordre compile et leur ordre resolu.
- Un seul composant de player effectue le montage page-level; les facades deleguent.
