# Elcé — calcul du résultat d’un chapitre Évaluation

## Statut

**En cours — le calcul, la garde de scénario Sighty, les réglages du chapitre,
la machine métier et l’édition auteur du BDC Résultat sont vérifiés. Le
raccord de ses issues au player reste à réaliser.**

## Contrat

`ElceChapterEvaluation.evaluate(questionPageIds, questionResults, threshold)`
calcule le résultat d’un chapitre à partir des identifiants de ses pages
Question et des réponses validées reçues pendant la lecture. Chaque page
Question vaut un point. Une réponse absente ou fausse ne rapporte aucun point.
Le score est le nombre de réponses justes divisé par le nombre de Questions.
Le seuil par défaut est `DEFAULT_EVALUATION_THRESHOLD` (`0.8`), et la réussite
inclut l’égalité au seuil.

Sans Question, le service rend un résultat `score: null` et `passed: null` ;
il n’attribue pas un pourcentage fictif. La prévisualisation auteur et le
passage du chapitre vide restent lisibles et franchissables dans le player.

L’auteur crée un chapitre Évaluation avec l’icône dédiée à côté de la création
d’un chapitre standard dans l’en-tête « Scénario ». La commande conserve le
type dans le document et inscrit les défauts configurés : seuil `0.8`, aucune
limite d’essais et reprise de toutes les Questions. Les chapitres déjà stockés
sans les deux derniers champs utilisent aussi ces valeurs par défaut. Le
chapitre standard est identifié par son icône dossier seule. Le chapitre
d’évaluation se distingue par son icône presse-papiers et reçoit le nom
automatique « Évaluation », sans libellé de type répété dans l’arborescence.
Le titre reste modifiable. Une page Flux créée dans ce chapitre reçoit un BDC
Question initial ; l’auteur peut également ajouter des BDC Texte depuis la
barre de la page. L’icône de la page ajoute un BDC Résultat qui contient les
deux branches, Réussite et Échec, chacune avec un message et un choix d’action
facultatif dans les options configurées. L’icône d’ajout
est une règle de l’interface auteur ; elle ne crée aucun type de page et
n’ajoute pas de restriction au modèle métier.

Cliquer le chapitre ouvre ses réglages dans la zone centrale. Le seuil de 80 %
est affiché et reste fixe pour ce POC. L’auteur peut enregistrer une limite
d’essais positive ou laisser le champ vide pour des essais illimités. Il peut
choisir de reprendre toutes les Questions ou seulement celles dont la réponse
est fausse ou absente. Ces valeurs sont conservées dans le document par la
commande `chapter.evaluation.settings.update`.

La commande `bdc.evaluation-result.update` enregistre les deux branches et
leurs actions ; `bdc.evaluation-result.delete` retire le BDC de la page. Le
builder compile le BDC en une story CodPlay, mais n’affiche aucune branche tant
que le runtime n’a pas indiqué le résultat. La machine portable qui gère les
tentatives, la reprise après échec et la relecture après succès est décrite dans
la [spécification de la machine d’Évaluation](evaluation-machine-spec.md). Les
réglages du chapitre et les choix du BDC ne sont pas encore raccordés à cette
machine dans le player ; les Questions n’y suivent donc pas encore les règles
de reprise et de relecture.

`buildScenario` ajoute une garde au passage entre pages : chaque page doit
d’abord avoir atteint son repère bas, et une page Question doit aussi avoir
produit un résultat. La garde de score s’applique au départ de la dernière page
d’un chapitre Évaluation. Les pages précédentes de ce chapitre restent
franchissables après leurs conditions de page ; un chapitre sans Question ne
reçoit pas de score et reste franchissable en prévisualisation auteur.

## Preuves

[`chapter-evaluation.test.ts`](../src/domain/chapter-evaluation.test.ts)
vérifie 4/5 réussi, 3/5 échoué avec une réponse absente comptée incorrecte,
et le résultat sans score d’un chapitre sans Question.
[`scenario-builder.test.ts`](../src/builders/scenario-builder.test.ts) vérifie
le garde 4/5, 3/5, les conditions de page avant et après validation, et le cas
sans Question. [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx)
vérifie la création d’un chapitre Évaluation par la commande XState, ses
réglages par défaut, son nom « Évaluation », son icône, l’ouverture du
formulaire central et l’enregistrement de la limite d’essais et de la portée de
reprise. [`document-commands.test.ts`](../src/app/commands/document-commands.test.ts)
vérifie la conservation du seuil lors d’une modification et refuse une limite
invalide ou l’application de ces réglages à un chapitre standard. Safari MCP
confirme l’affichage des défauts sur un chapitre déjà présent dans le document.
Le passage refusé/réussi par le score cumulé dans le vrai player reste à valider
au plan. La machine métier est vérifiée par
[`evaluation-machine.test.ts`](../src/domain/evaluation/evaluation-machine.test.ts).
La création, l’édition et le retrait du BDC Résultat sont vérifiés dans
[`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) et
[`document-commands.test.ts`](../src/app/commands/document-commands.test.ts) ;
sa compilation CodPlay l’est dans
[`flux-scene-builder.test.ts`](../src/builders/flux-scene-builder.test.ts).
Safari MCP a également vérifié l’ajout puis le retrait du BDC sur une page
Flux d’Évaluation existante ; le bloc de test a été supprimé.
