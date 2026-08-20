# Capture, DnD et authoring V2

## Statut

`A relire` — contrat V2 proposé, implementation non engagee.

Ce plan couvre la capture continue, le drag-and-drop entre listes et le canal
d'authoring. Il ne cree pas un second moteur de lecture : ces capacites doivent
rester branchees sur le flux `materialize -> resolve -> solve -> project`.

## Probleme structurel a resoudre

La V1 possede les bons comportements observables, mais sa capture est branchee
sur le canal d'animation et contourne le parcours normal des transitions. Le
DnD ajoute ensuite un hit-test DOM et un ghost autour de cette capture. Enfin,
l'AuthorApi V1 expose directement des poses de nodes et des caches anime.js.

Ces trois points ne peuvent pas etre portes tels quels en V2 :

- la capture est un troisieme producteur de `PersoState`, au meme niveau que
  l'evaluation temporelle, pas une variante d'animation ;
- le DnD est un adaptateur de materialisation HTML qui conclut par un event `move`,
  pas une logique de placement parallele ;
- l'authoring est un canal distinct, qui observe et demande des transactions,
  sans relire le DOM pour reconstruire l'etat logique.

## Architecture cible

```text
CompiledScene + RuntimeTrackJournal + RuntimeCaptureStore + t
        |                 |                  |
        +------ materialize / resolve / solve --------+
                                                     |
                                             one SolvedScene
                                                     |
                                         project / components
```

### 1. Capture : source d'etat live ephemere

`RuntimeCaptureStore` porte les sessions ouvertes et leur `captureState`. Une
session contient son identite, son perso hote, son instant d'ouverture, ses
echantillons et sa derniere presentation live. Le store n'est pas le journal :
les echantillons et les mises a jour live ne sont jamais rejoues au seek.

Le contrat V2 conserve les invariants V1 :

- `initCaptureState` est appele une fois a l'ouverture ;
- `trackCommand` ne produit ni `StoryEvent`, ni strap, ni acces a un node ;
- une `CaptureAction` est resolue par le player dans le meme `PersoState` que
  le reste de la scene ;
- `endEmit` passe par le dispatcher d'events normal ;
- les sorties `endCapture` sont inserees en `persist-only`, puis deviennent
  des faits ordinaires de la reconstruction ulterieure ;
- un seek ferme/annule les sessions live, car une capture reelle n'est pas un
  fait historique a rejouer.

Le player doit donc exposer une facade capture source-agnostique (`begin`,
`track`, `end`, `cancel`) et reconstruire sa presentation par le meme appel
`reconstructScene(t)` que Play et Seek. Aucun listener DOM n'appartient au
coeur.

### 2. Compilation : fonctions hors artefact

Les declarations de capture restent authoring-friendly, mais leur compilation
produit exclusivement des references dans `CompiledScene` :

- `initCaptureStateRef` ;
- `trackCommandRef` ;
- `endCaptureRef` ;
- les `StoryEvent` declares, eux aussi compiles recursivement.

Les fonctions reelles vivent dans `CompiledFunctionCollection`, comme les
straps et transforms deja implementes. Le runtime ne resout jamais une
fonction depuis le DOM ou depuis un nom arbitraire.

### 3. Journal : distinguer application live et persistance

Le journal doit porter explicitement le mode d'insertion d'un fait :

- `apply-now` : le fait entre dans la reconstruction courante ;
- `persist-only` : le fait est conserve pour les evaluations futures, mais ne
  redevient pas une cause de double application au moment de sa production.

Cette distinction est une propriete du journal et du materializer, pas un
special-case de capture. Toute future capacite qui produit un fait deja rendu
live pourra reutiliser le meme mode.

### 4. DnD : adaptateur de materialisation HTML

Le coeur ne connait ni `HTMLElement`, ni `getBoundingClientRect`, ni ghost.
L'adaptateur HTML :

1. ouvre une session capture avec `dropIn` ;
2. mesure les enfants montes des listes candidates ;
3. resout localement la liste et l'index avec hysteresis ;
4. présente un ghost hors du registre des persos ;
5. ferme la capture avec un `move` standard portant `parentId`, `index`, le
   mode `reparent` et le `flipMode` choisi ;
6. detruit le ghost sans modifier l'ordre logique pendant la preview.

Le commit DnD est donc un event/action `move` normal. Le resolver de placement,
le journal, le solve et le graphe de mouvement ne possedent aucune branche DnD.

### 5. Authoring : canal local et types V2

Le canal authoring ne doit pas reutiliser `PlayerApi` V1. Il recevra des
snapshots immuables de `SolvedScene`/`PersoState`, des notifications de montage
et des diagnostics, et demandera des operations explicites au player ou au
builder. Il ne reconstruira jamais un `PersoState` depuis une pose DOM.

L'ancienne operation `setNodePose` est le point encore ouvert : elle peut etre
soit une présentation temporaire d'atelier, soit une operation persistante de
scene. Ces deux semantiques ne doivent pas partager la meme methode, car la
premiere ne doit pas polluer le journal et la seconde doit produire un fait
rejouable.

## Tranche d'implementation apres relecture

1. figer le type compile de capture et le resultat `RuntimeCaptureStore` ;
2. ajouter le mode d'insertion du journal et les tests `persist-only` ;
3. integrer la facade capture au `RuntimePlayer` et partager son resultat avec
   le runner de mesure ;
4. ajouter l'adaptateur HTML DnD sans logique DnD dans le coeur ;
5. definir puis implementer le canal authoring V2 ;
6. couvrir chaque operation par des tests froids Play/Seek et une fixture
   HTML, puis mettre a jour les README de modules.

## Decision requise avant le code authoring

Pour `setNodePose`/les poses manipulees dans l'atelier, choisir explicitement
entre :

- **présentation temporaire** : visible dans l'instance authoring, absente du
  journal et discardee au seek/reload ;
- **commit de scene** : transforme la pose en operation authoring persistante,
  distincte du journal de lecture et rejouable apres recompilation.

Le noyau capture/DnD peut etre implemente independamment de cette decision. Le
canal authoring, lui, ne doit pas etre code avant que cette frontiere soit
fixee.
