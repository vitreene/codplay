# Import ponctuel Rise — Nutrition & Santé

**Statut : En cours — import réalisé ; acceptation navigateur en attente.**

Résultat vérifié : [reprise Nutrition & Santé](../specs/nutrition-sante-rise-recovery-spec.md).

## Périmètre accepté

Créer un nouveau projet Elcé depuis l’export local `63690_Accueil-pour-le-personnel-interimaire-Nutrition-and-Sante`, sans modifier les projets existants ni le code de production. Récupérer les textes, titres, médias et quiz ; conserver les PDF séparément, sans OCR ni transcription.

## Circuit et invariants

- [Document v7](../specs/document-model-spec.md), [Sections](../specs/section-editor-spec.md), [ancres](../specs/anchor-spec.md), [Questions](../specs/question-bdc-spec.md), [Évaluation](../specs/chapter-evaluation-spec.md), [API projets](../specs/project-api-spec.md).
- Construire un document initial conforme aux services métier existants, le valider avec `assertDocumentInvariants`, puis créer le projet et transférer ses médias par l’API existante. Aucun SQL direct, nouvel importeur produit ou changement CodPlay.
- Conserver l’ordre du tableau `course.lessons` ; les valeurs `position` sont dupliquées dans la source. Regrouper les leçons en chapitres thématiques, développer les interactions en contenu linéaire et créer une page par Question.
- Reprendre les corrections réellement utilisées par Rise : `corrects` pour `MULTIPLE_RESPONSE`, `correct` pour `MULTIPLE_CHOICE`. Ne pas déduire les corrections depuis les anciens booléens des propositions.
- Conserver les seuils source (90 %, 90 %, 80 %). Les explications de correction sans champ Elcé sont seulement signalées comme limite, conformément à la précision utilisateur du 26 octobre ; aucun contenu de remplacement ni champ ou comportement d’évaluation n’est ajouté.
- Conserver le script ponctuel et les résultats dans `.elce-data/imports/nutrition-sante/`, avec les PDF à part et la traçabilité source → pages/blocs/médias.

## Actions et acceptation

| Action | Statut | Acceptation |
| --- | --- | --- |
| Inventorier la source et définir la transposition | Fait | 16 leçons, 11 questions, ressources rattachées ; exclusions motivées au manifeste. |
| Construire et vérifier le document et ses fichiers | Fait | 8 chapitres, 28 pages, 91 BDC ; invariants v7 et cycles Tiptap/HTML vérifiés ; 48 images et 11 vidéos dédupliquées ; 12 PDF séparés et comparés. |
| Créer le projet par l’API locale | Fait | Relecture des entités et des séquences à l’identique ; les 59 médias servis passent les comparaisons taille/MIME/SHA-256. Les révisions suivantes de l’éditeur sont conservées. |
| Vérifier les builders et l’évaluation | Fait | Les builders réels produisent 36 sources de scène ; seuils 90/90/80 vérifiés ; 68 tests existants Question/calcul/scénario/composition passent. |
| Vérifier l’éditeur et la preview dans Brave MCP | En attente | Le serveur Brave est configuré et exposé, mais `list_pages` échoue sur un profil déjà utilisé ; aucune application de remplacement. |
| Documenter le résultat et les limites | Fait | Preuves et transposition dans la spécification ; détail local au manifeste ; explications de correction simplement signalées comme limite. |

## Acceptation restante

- Dans le projet importé, vérifier les pages de contenu longues, les Cartes ancrées, les vidéos et le resize ; vérifier l’édition puis la réouverture d’une Section.
- Parcourir les trois Évaluations dans le vrai player, avec une réussite et un échec ; noter les limites existantes sans les masquer ni modifier les BDC.
- Les catégories Play/seek/reprise et lifecycle concernent cette acceptation de lecture ; elles ne sont pas déclarées vérifiées par les contrôles de données. Aucun code de production n’a changé : un typecheck/build général et de nouveaux tests de non-régression parent/enfant ne sont pas requis pour créer ce document ; les invariants d’ancres et les builders réels ont été exercés.
- Retirer ce plan seulement après cette acceptation et transfert de ses preuves dans la spécification. L’évolution future des champs d’explication Question reste hors périmètre de cette reprise.
