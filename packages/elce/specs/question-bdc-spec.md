# Elcé — bloc de contenu Question

## Statut

**En cours — modèle, édition, projection CodPlay et Quiz simple sont couverts
par tests et un essai Safari. La machine métier d’Évaluation est vérifiée ; son
raccord aux résultats et à l’affichage du player reste à réaliser.**

## Contrat auteur

Une Question est un BDC unique dans la séquence d’une page Flux ; l’auteur la
place à l’endroit voulu dans cette séquence. Une page ne peut contenir qu’une
Question dans le POC. Une page Diapo peut aussi accueillir une Question comme
son unique BDC direct ; elle n’est pas une carte enfant de Carousel. Le titre
et l’illustration sont facultatifs ; l’énoncé, les réponses et la validation
sont requis par le preset Question.

Une page Flux créée dans un chapitre Évaluation reçoit un BDC Question par
défaut ; une page de chapitre standard ou une page racine reçoit un BDC
Section. Le format de page reste Flux dans les deux cas. L’icône Quiz en haut
de l’éditeur permet aussi d’ajouter une Question à une page qui n’en contient
pas encore ; elle utilise le symbole ListChecks, sans point d’interrogation.
L’icône Texte ajoute un BDC Section ; l’auteur peut ensuite réordonner les BDC
dans la page. La corbeille du BDC Question permet de le supprimer ; l’icône
Quiz est alors de nouveau disponible.

L’auteur choisit un type dans les constantes déclarées en configuration :

- **Vrai/Faux** présente les réponses « Oui » et « Non », éditables, avec une
  seule réponse juste.
- **Choix** permet d’ajouter, supprimer, éditer et réordonner les réponses ;
  exactement une doit être marquée juste.
- **Choix multiple** permet les mêmes opérations, exige au moins une réponse
  juste et autorise plusieurs réponses justes. La note « Plusieurs réponses
  possibles » est ajoutée automatiquement.

Changer le type remplace les réponses par les valeurs par défaut de ce type et
garde le titre et l’énoncé. Les invariants sont contrôlés par
`ElceQuestionService` et lors des commandes documentaires, pas par le composant
de rendu.

La zone Illustration du preset accepte une ressource image ou vidéo du
catalogue, ou un fichier local. Un fichier suit l’import média partagé et la
Question conserve la référence réutilisable ; l’opération n’ajoute pas un BDC
média séparé. L’import d’octets déjà présents sous la même catégorie réutilise
la ressource existante après vérification SHA-256, même si le nom diffère.

## Commandes et projection

`EditorActionsFacade` (`app/facades/editor-actions-facade.ts`) appelle la façade
applicative `ElceQuestionFacade` (`app/facades/question/`) pour transformer les
gestes auteur en commandes documentaires envoyées au contrôleur XState. La
création est insérée dans la position
ordonnée de la page ; l’édition des réponses, du texte et de la référence média
modifie le document par la même façade et les mêmes commandes. La vue Remix
affiche le modèle et ne porte pas une copie de son état métier.

Le builder instancie le markup fixe du preset Question. Sa story autonome
contient les persos CodPlay nécessaires : des `input` natifs, le bouton de
validation, le texte de retour et, si elle existe, l’illustration. Les réponses
à choix simple utilisent des boutons radio ; le choix multiple utilise des
cases à cocher. Les straps de la story gèrent la sélection et la validation.
Les zones de montage du preset sont des commentaires `<!-- data-part="…" -->`,
pas des attributs sur des balises-hôtes vides. Le titre, l’énoncé et les
contrôles sont insérés directement dans leur conteneur sémantique ; la zone de
validation est un commentaire après le `fieldset`, sans `div` intermédiaire.
Les conteneurs de l’illustration et des réponses restent parce qu’ils portent
leur cadrage et leur mise en page.
Le builder ne crée le `header` de titre que si le titre existe, et la zone
illustration que si une référence média existe. Le paragraphe vide de retour
est l’exception fonctionnelle : il reste caché avec `aria-live` afin que
CodPlay puisse y afficher le résultat au moment de la validation.
La bonne réponse est déterminée en comparant l’ensemble sélectionné à
l’ensemble des identifiants marqués justes. Avant validation, aucune correction
n’est affichée. Dans le parcours Quiz simple, la validation affiche le résultat
et les corrections directement dans la liste, verrouille les contrôles et
transmet le booléen de résultat au scénario Sighty. Cette révélation après
réponse reprend la démo 5. Dans un chapitre Évaluation, la machine métier garde
les corrections cachées après un échec et pendant la reprise ; seules les
Questions fausses ou absentes peuvent être reprises si cette portée est
choisie. Après une réussite, l’action de relecture choisie dans la branche
Réussite du BDC Résultat ouvre toutes les Questions avec leurs réponses
sélectionnées et attendues. Ce contrat est détaillé dans la
[spécification de la machine d’Évaluation](evaluation-machine-spec.md). Le
raccord du BDC Résultat et de l’affichage des Questions à la machine reste à
faire ; le player actuel ne valide pas encore ce parcours.

Pour une page Flux avec Question, Sighty autorise « Suivant » seulement après
le repère bas et la validation de la réponse ; la réponse peut être fausse.
L’évaluation cumulative, lorsqu’elle existe, est un garde séparé du chapitre
Évaluation sur sa dernière page. Elle n’est pas portée par chaque Question.

## Preuves

- [`question-service.test.ts`](../src/domain/question/question-service.test.ts) vérifie
  les réponses par défaut, l’unicité de la réponse juste en Choix, au moins une
  réponse juste et plusieurs choix justes en Choix multiple, ainsi que l’ordre
  et la suppression des réponses.
- [`document-commands.test.ts`](../src/domain/commands/document-commands.test.ts)
  vérifie la création d’une Question unique dans l’ordre de la page, les
  invariants de réponse, et la référence d’illustration.
- [`controller-machine.test.ts`](../src/app/controller/controller-machine.test.ts)
  vérifie que le réimport d’une illustration identique depuis un autre nom de
  fichier rattache une seconde Question au même média et ne sauvegarde pas un
  second blob.
- [`app-layout.test.tsx`](../src/app/layout/app-layout.test.tsx) exerce l’édition
  auteur à travers le contrôleur XState, le changement de type, l’énoncé, les
  marques de correction, le réordonnancement et la présence de l’icône Quiz
  ListChecks.
- [`workspace/page-editor.test.tsx`](../src/app/remix/workspace/page-editor.test.tsx)
  vérifie l’édition Question dans la page Remix de production ainsi que
  l’import d’une illustration par la file média XState existante.
- Le 4 octobre, Safari MCP confirme qu’une page créée dans un chapitre
  Évaluation est une page Flux avec un BDC Question, et que la preview réelle
  CodPlay affiche cette Question avec ses réponses Oui/Non. La page et le
  chapitre temporaires du test ont été supprimés ensuite.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie le preset, les zones et les persos produits par le builder ;
  [`scenario-builder.test.ts`](../src/builders/scenario/scenario-builder.test.ts)
  vérifie la progression de page et le garde d’évaluation.
- [`card-preset-builder.test.ts`](../src/builders/card/card-preset-builder.test.ts)
  vérifie les cibles de zones par commentaires, la cible du prompt dans le
  `fieldset`, l’absence de conteneur de validation intermédiaire et l’omission
  des hôtes de titre/illustration facultatifs quand leur contenu est absent.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  valide les trois types dans CodPlay : aucune correction n’apparaît avant la
  validation, puis les états justes et faux se révèlent dans la liste.
- Safari MCP vérifie dans le player réel une réponse Vrai/Faux fausse : avant
  validation, les deux icônes sont vides ; après, « Réponse incorrecte. »,
  « ✓ » sur Oui et « × » sur Non sont visibles et les choix sont verrouillés.
  La Question temporaire a ensuite été supprimée.
- Le test du seuil cumulé dans le player réel reste ouvert dans le plan de
  construction.
