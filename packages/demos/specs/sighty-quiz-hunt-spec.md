# Démo Sighty Quiz Hunt — contrat vérifié

## Périmètre

Cette spécification décrit les comportements vérifiés du catalogue, du menu,
des épreuves, du panier/minuteur et de la présentation responsive de Quiz Hunt
dans Sighty. Les critères de travail et les validations encore ouvertes restent
dans le [plan de reconstruction](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md).

La page hôte, son sélecteur, sa télécommande, son journal et son cycle de vie
restent ceux du [layout Sighty commun](./sighty-demo-layout-spec.md). Quiz Hunt
ajoute un scénario auteur qui possède la progression ; les scènes gardent leur
état d'interaction local.

## Catalogue et tirage

[`game-data.ts`](../src/sighty/quiz-hunt/game-data.ts) adapte le catalogue
SF spatiale partagé de la V1, sans copier ses questions. Il construit au
démarrage les 16 épreuves et les 16 questions finales. Chaque mot conserve sa
couleur, son indice, sa question d'épreuve et sa question finale.

Le tirage utilise la fonction pure V1
[`deriveGameDraw`](../src/v1/scenes/quiz-hunt/seed.ts). Avec la seed `1`, l'ordre
des tuiles est :

```text
arrakis, dave-bowman, discovery-one, cooper, lv-426, icarus-ii, xenomorphe,
leeloo, hal-9000, solaris, endurance, monolithe, ripley, pandora, nostromo,
ver-des-sables
```

Les quatre couleurs ont quatre épreuves chacune. Une création répétée avec la
même seed reproduit le même tirage. Les 16 scènes d'épreuve et les 16 scènes
finales sont fournies au catalogue `scenario.scenes` avant l'initialisation
Sighty. La génération des scènes finales est établie ici ; leur admission et
leurs conséquences de jeu relèvent du plan de reconstruction.

## Progression et accès

Le contexte `game` du scénario Sighty conserve, pour chaque épreuve, l'un des
statuts `available`, `success` ou `failed`, ainsi qu'un mot courant par couleur
et le temps restant du minuteur. L'état de sélection et de correction d'une
question reste dans sa scène.

Le menu ne décide pas de l'accès. Il émet l'intention publique d'ouvrir une
épreuve ; le guard Sighty autorise uniquement une épreuve dont le statut est
`available`. Une tentative refusée revient au menu. Les projections du scénario
affichent le numéro d'une épreuve disponible, `✓` pour une réussite et `✗` pour
un échec ; les deux statuts résolus désactivent leur tuile. Les attributs
d'identité et de libellé accessible restent présents après projection.

Une réponse n'est enregistrée que si le statut courant est `available`. Une
réussite passe l'épreuve à `success` et inscrit son mot dans la couleur
correspondante du panier. Une autre réussite de la même couleur remplace le mot
affiché, sans effacer les statuts des épreuves précédentes. Une réponse fausse
marque l'épreuve `failed` et ne modifie pas le panier. La réadmission des
épreuves échouées par le jeton n'est pas décrite ici.

## Scènes et présentation

Le scénario compose `scene-layout`, `scene-menu`, `scene-basket`, une scène
autonome par épreuve et une scène générée par question finale. `scene-basket`
porte ensemble le panier et le minuteur persistant. Les vues question et menu
occupent le même slot de contenu ; la grille menu n'est pas visible pendant une
épreuve.

La question Nostromo référence la vidéo V1 importée. Le préchargement Sighty la
rend disponible avant l'ouverture de la question ; le composant `media` adopte
le même nœud préparé à sa matérialisation, sans réassigner `src` ni rappeler
`load()`. Safari a confirmé ce handoff sur un onglet actif : le nœud était prêt
et en pause au menu, puis visible et décodé avant son premier `play()` dans la
question. La preuve et les gates encore ouverts pour cache froid, débit limité
et cycle de vie média sont suivis dans le
[plan de reconstruction](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md).

Les scènes reprennent les classes de présentation de la V1. Le panneau
question conserve l'indice, le média éventuel, la question, les réponses, la
correction et le feedback. Le layout de jeu ne rend ni le titre global
« Choisis une épreuve » ni le libellé « Panier ». Les cases du panier gardent
leur présentation V1, avec un texte légèrement réduit (`0,9 em`). Elles sont
insérées au repère commentaire de la racine panier, qui porte leur grille 2×2 ;
les points d'inclusion sans boîte propre restent des commentaires. Le badge
conserve son polygone coloré V1, réduit à un format puce de `2,5 rem`.

Le résultat reste monté dans `slot-result`, séparé du slot qui alterne entre
menu et question. Sa racine est masquée jusqu'au verdict. Sur la branche de
victoire validée, le slot de contenu revient au menu puis le scénario projette
le résultat. La racine couvre toute la scène layout avec le fond translucide
V1, laissant visibles le menu et le panier sous-jacents. Safari a validé cette
composition sur le parcours réel : après quatre réponses correctes, la finale
ouverte depuis le menu et la fin de son feedback, le menu était toujours
sélectionné derrière le verdict ; la racine résultat, son host et le layout
mesuraient chacun `370,4 × 517,5 px` CSS. Les branches d'échec et d'expiration
restent en cours de validation dans le
[plan P3](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#état-dimplémentation-p3--2026-10-09).

La règle responsive place la scène panier/minuteur à droite de la question en
orientation paysage et sous la question en orientation portrait. Dans la
colonne paysage, les cases occupent toute la largeur du panier et le cadran de
`8 rem` se place au-dessous. En portrait, la zone question/quiz prend la place
principale et le panier/minuteur restent après cette zone, accessibles par
défilement ; le cadran reste à côté des cases et s'étire à la hauteur de leurs
deux rangées. Le panneau question défile verticalement si son contenu dépasse
l'espace disponible. Les mesures du formulaire déroulé, du panier, du cadran et
des colonnes paysage dans Safari sont consignées dans la section de validation P1 du
[plan](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#état-des-validations-p1--2026-10-09).

Sur les viewports de largeur inférieure ou égale à `860 px`, la feuille de style
Quiz Hunt borne le cadre à la hauteur de l'écran et donne au stage l'espace
restant sous l'en-tête ; la télécommande reste à sa hauteur naturelle en bas
de page. Cette règle n'est active que lorsque le layout Quiz Hunt est monté,
et laisse le contenu interne défiler si nécessaire. À `390 × 841 px`, Safari
a mesuré un document de `841 px`, un stage de `661 px` et une télécommande
terminant à `832 px`, sans bande vide sous celle-ci. La mesure complète figure
dans le [plan P1](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#état-des-validations-p1--2026-10-09).

Au breakpoint mobile `40 em`, le bouton de validation et les cases couleur
partagent une taille de bloc fluide (`clamp(2rem, 10.7vw, 2.375rem)`). Le texte
des cases reste légèrement réduit (`0,9 em`). La réserve à l'emplacement de
l'extra varie avec le viewport
(`clamp(2.5rem, 14.36vw, 3.5rem)`) ; elle ne met pas en œuvre le jeton ni son
dépôt. En portrait, les cases et le cadran partagent une rangée de grille et le
cadran carré s'étire sur la hauteur des deux lignes de cases et leur espacement.
Dans Safari, à `390 px` de large,
les cases et le bouton mesurent `38 px`, les rangées et le cadran `84 px`, la
réserve `56 px` et le bloc panier/minuteur `108 px`. À `336 px`, les mêmes
mesures deviennent `36 px`, `80 px`, `48 px` et `104 px`, sans débordement
horizontal. Les mesures et les limites de cette vérification sont consignées
dans la [validation P1](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#état-des-validations-p1--2026-10-09).

## Éléments de preuve

Le parcours Safari, les comptes du catalogue, la stabilité du tirage, les
statuts, le remplacement de couleur et les refus d'accès sont documentés dans
la section [validations P2](../plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#état-des-validations-p2--2026-10-09). Les contrôles de build et de types
restent consignés dans le suivi de la tâche.
