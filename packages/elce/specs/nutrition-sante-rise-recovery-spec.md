# Elcé — reprise de contenu Nutrition & Santé

## Rôle et périmètre vérifié

Cette reprise ponctuelle crée le projet local
`nutrition-sante-accueil-interimaires`, nommé « Accueil pour le personnel
intérimaire Nutrition & Santé », à partir de l’export Rise fourni le
26 octobre 2026. Elle utilise le [document v7](document-model-spec.md), les
Sections, Cartes Photo, Questions et Résultats existants, puis l’[API des
projets](project-api-spec.md). Elle ne crée pas un importeur produit et ne
modifie aucun code de production Elcé ou CodPlay.

Les résultats et scripts ponctuels sont conservés dans
[`.elce-data/imports/nutrition-sante/`](../.elce-data/imports/nutrition-sante/).
Ce dossier local est exclu de Git ; il contient les données de ce cours, pas
des fixtures de tests du produit.

## Document produit

Les 16 leçons Rise sont reprises dans 8 chapitres et 28 pages Flux :

| Chapitre | Pages | Particularité |
| --- | ---: | --- |
| Découvrir Nutrition & Santé | 10 | Présentation du module et 9 premières leçons |
| La Sécurité chez Nutrition & Santé | 1 | Contenu de la leçon |
| Quiz sécurité | 5 | 4 Questions et un Résultat ; seuil 90 % |
| La Qualité chez Nutrition & Santé | 1 | Contenu de la leçon |
| Quiz qualité | 6 | 5 Questions et un Résultat ; seuil 90 % |
| L’Environnement chez Nutrition & Santé | 1 | Contenu de la leçon |
| Quiz environnement | 3 | 2 Questions et un Résultat ; seuil 80 % |
| Conclusion | 1 | Contenu de la leçon |

L’ordre des leçons provient du tableau `course.lessons`, pas des attributs
`position` dupliqués dans cet export. Les Questions respectent la limite
existante d’une Question par page. Les descriptions de quiz précèdent leur
première Question. Le document comporte 91 BDC et 59 médias : 48 images
distinctes et 11 vidéos. Les octets identiques réutilisent la ressource trouvée
par `ElceMediaResourceService.findDuplicate`.

## Transposition

- Les champs textuels actifs sont conservés sans les styles Rise. Les titres
  d’éléments et les champs `heading` des variantes de titre deviennent des
  titres de Section. Les mises en évidence compatibles restent des marques
  Tiptap. Les listes deviennent des paragraphes à puces ou numérotés, formats
  pris en charge par la Section existante.
- Les onglets et accordéons sont développés dans leur ordre source. Le
  processus historique suit introduction, étapes, synthèse. Les cartes
  recto/verso deviennent du texte successif. L’activité de tri devient des
  listes sous les catégories source ; aucun exercice de tri Elcé n’est ajouté.
- Les images et vidéos sont des Cartes Photo enfants de leur Section et
  utilisent les ancres existantes. Les vignettes de vidéos ne deviennent pas
  des illustrations supplémentaires. Les images décoratives par défaut et les
  contrôles de présentation/navigation Rise sont écartés.
- Le JSON éditable et le HTML de chaque Section sont produits par le schéma
  réel de `SECTION_EDITOR_EXTENSIONS` et `ElceAnchorExtension`, puis vérifiés
  par relecture de ce schéma.
- `MULTIPLE_RESPONSE` devient le choix multiple Elcé et conserve `corrects`.
  `MULTIPLE_CHOICE` devient le choix simple Elcé et conserve `correct`. Les
  fonctions `iF`/`E3` et `oF`/`y3` du lecteur Rise embarqué
  `scormcontent/lib/rise/594c4316.js` confirment ces règles. Les anciens
  booléens des propositions divergent pour 10 questions sur 11 et ne sont pas
  utilisés pour remplacer ces corrections.
- Les 12 PDF sont copiés à l’identique dans `pdfs/`, avec rattachement à leur
  leçon dans le manifeste. Ils ne sont pas des médias du document Elcé.
- Aucun OCR ni transcription n’est effectué. Les explications de correction
  sans champ dans Question sont uniquement signalées comme limite ; aucun
  champ, contenu de remplacement ou annexe d’explications n’est ajouté.

## Preuves

Le [manifeste local](../.elce-data/imports/nutrition-sante/import-manifest.json)
conserve les correspondances source, les exclusions motivées et les résultats
des contrôles. Le [JSON initial](../.elce-data/imports/nutrition-sante/nutrition-sante.elce.json)
et l’[instantané courant relu](../.elce-data/imports/nutrition-sante/nutrition-sante-current.elce.json)
sont conservés séparément.

- `assertDocumentInvariants` accepte le document v7 ; toutes les Sections
  passent le cycle JSON → HTML → JSON du schéma réel.
- `createElcePlayerScenario` construit les pages par les builders réels et
  produit 36 sources de scène. Le calcul métier réussit avec toutes les
  Questions justes et échoue avec une erreur pour chacun des trois seuils.
- Le projet est créé par `POST /api/projects`, ses 59 fichiers sont transférés
  par les routes média existantes, puis relus et comparés par taille, MIME et
  SHA-256. La relecture à la révision 0 conserve les valeurs de toutes les
  entités et toutes les séquences de lecture. L’ordre des tableaux-entités
  `pages`/`bdcs` n’est pas un ordre de lecture ; la comparaison se fait par
  identifiant, avec les détails optionnels absents équivalents à `null`.
- `audit-content.mjs` vérifie les paragraphes et libellés source sur les pages
  correspondantes ainsi que les octets des 12 PDF. Son compteur exact est dans
  le manifeste ; aucun contenu couvert n’est manquant.
- Les dimensions des 48 images sont lues dans les fichiers réels. La révision
  2 observée pendant la tâche contient le ratio carré `100%` du visuel d’accueil
  et le réglage `summary.pageContinuationMode: 'free'`. Cette évolution est
  conservée ; l’import n’a pas remplacé cette révision.
- Les quatre fichiers de tests existants Question, calcul d’Évaluation,
  scénario et composition player passent : **68 tests**. Ces tests gardent
  leurs propres fixtures et ne dépendent pas de cet export.

## Limites et validation restante

Les explications détaillées après réponse ne sont pas importées : le BDC
Question n’a pas ces champs. Cet ajout est différé à la demande de l’utilisateur.
Les interactions Rise, le tirage aléatoire et leurs navigations propres ne
sont pas transposés en comportements ; leur contenu est présenté en lecture
linéaire et les quiz conservent un ordre fixe.

Les limitations existantes de reprise/relecture et de révélation des réponses
en Évaluation restent celles des [Questions](question-bdc-spec.md) et du
[chapitre Évaluation](chapter-evaluation-spec.md). Les Résultats créés n’ajoutent
pas de boutons pour ces parcours incomplets.

La validation visuelle de ce cours, du scroll, du resize et des parcours
complets d’Évaluation reste ouverte au
[plan de reprise](../plan/2026-10-26-nutrition-sante-rise-import-plan.md).
Le serveur Brave est configuré et ses outils sont exposés, mais `list_pages`
échoue parce que son profil est déjà utilisé. Les contrôles de données,
builders et tests ne remplacent pas cette acceptation dans le navigateur.
