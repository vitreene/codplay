# Conception proposée — paquet standard réimportable Elcé

Cette note étaye le [plan actif](../plan/2026-10-26-elce-standard-export-import-plan.md).
Elle décrit des choix proposés pour sa revue ; elle ne spécifie aucun nouveau
comportement déjà réalisé. Les décisions et leurs statuts restent dans le plan.

## Point de départ et raison du complément auteur

L’[export actuel](../specs/sighty-export-spec.md) reçoit déjà le document Elcé,
mais livre des scènes compilées, leurs ressources et les modules d’exécution.
Le catalogue et les fichiers inutilisés par les scènes ne sont pas livrés ;
le document éditable n’est pas dans `scenario.mjs`. Une Section a notamment
un JSON Tiptap éditable et un HTML de projection : le second ne remplace pas
le premier. Un import fiable doit donc être prévu dans le producteur du paquet.

Proposition : ajouter le document auteur complet au paquet standard existant.
Réutiliser `ElceDocument.toJSON()` évite un deuxième modèle de chaque BDC et
une reconstruction à partir de leurs formes compilées. Les métadonnées ne
sont pas calculées par différence entre deux projections.

## Forme proposée et facultativité

```text
export-manifest.json          # manifeste Sighty existant
distribution-manifest.json   # distribution existante
loader.mjs
scenario.mjs
runtime/...
scenes/...
authoring/project.json       # enveloppe de reprise Elcé
authoring/media/media-0.svg   # originaux nécessaires au document complet
```

Extrait illustratif de l’enveloppe ; `document` contient en pratique le
document complet, pas seulement les trois propriétés montrées :

```json
{
  "format": "elce.project-package.v1",
  "document": { "version": 7, "id": "source-project", "name": "Formation" },
  "mediaFiles": [
    { "mediaId": "source-media", "file": "authoring/media/media-0.svg" }
  ]
}
```

`format` versionne l’enveloppe ; `document.version` reste la version du modèle
métier. « v1 » désigne le premier format de reprise et ne certifie pas tous les
modules Elcé comme finis. Pas de version artificielle par BDC aujourd’hui.

| Donnée | Règle proposée à l’import |
| --- | --- |
| Enveloppe, version courante, identité/nom source, tableaux d’entités et séquences, types, contenus métier et relations | Requis. Ne pas inventer une Section, une réponse correcte, une relation ou un contenu manquant. |
| `appearance` projet/page/BDC et ses propriétés | Facultatif ; conserver l’absence pour que le résolveur existant applique l’héritage et les défauts. Ne pas matérialiser des valeurs effectives en exceptions locales. |
| `revelationDefaults`, `summary` et leurs réglages absents | Compléter les propriétés absentes depuis `ELCE_EDITOR_SETTINGS.revelation.projectDefaults` et `INITIAL_SUMMARY_SETTINGS`, avant validation du document. Ne pas utiliser le document initial comme contenu de remplacement. |
| `profile` absent | Utiliser `INITIAL_PROFILE_DEFINITION` ; les invariants refusent alors une référence orpheline dans les contenus ou contraintes. Si présent, conserver sa définition complète et ses références. |
| Paramètres d’Évaluation facultatifs et autres champs déjà optionnels du modèle | Conserver les valeurs explicites et les absences que leurs services savent déjà résoudre. Reprendre les constantes métier existantes, sans nouvelle table parallèle de défauts. |
| Contenu Tiptap, HTML de Section, données des BDC et références requises par leurs services | Requis suivant le type ; ne pas rendre facultatifs les champs métier obligatoires sous prétexte de métadonnées. |
| `mediaFiles` et octets | Une entrée pour chaque média documenté, y compris inutilisé ; tableau vide si aucun média. MIME, taille, nom et légende restent dans `document.medias`. Un fichier absent ou de mauvaise taille est une erreur. |

L’absence seule déclenche un défaut. Préserver `false`, `0`, les chaînes vides
permises et les `null` ayant un sens métier. Une référence de preset/palette
inconnue ou une valeur invalide est refusée ; elle ne devient pas une absence.
Les champs inconnus non prévus par l’enveloppe ne valent pas promesse de prise
en charge d’un futur BDC ; les versions et types inconnus sont refusés clairement.

Le dossier `authoring/` reste facultatif pour le loader de lecture. Son absence
complète n’a pas été arbitrée par l’utilisateur pour l’import ; la proposition
du plan est un refus explicite, sans désassembler les modules compilés. Le
nouvel export et son import forment le socle commun ; aucune reprise générale
des anciens exports ou documents v1–v6 n’est annoncée.

## Export : adaptation du circuit existant

L’appel standard et l’appel SCORM partagent actuellement
`requestElceSightyPackage`. D’où la proposition d’un paramètre explicite
`includeAuthoring` dans ce même circuit : `true` pour le standard dans
`ProjectApplication`, `false` pour l’intermédiaire SCORM ; champ absent = `false`
au serveur. Ne pas modifier les manifestes ou CLI Sighty/CodPlay.

- Sans complément : garder la sélection actuelle par `scenarioExportMediaIds`.
- Avec complément : transmettre tous les médias du document. Pour une source
  absente de `mediaSources`, relire d’abord le Blob du store existant, puis
  l’URL API du projet si le fichier est déjà publié. Ne pas créer un résolveur
  média autonome : réutiliser le raccord source/cache/API propriétaire et
  figer les sources disponibles avec le snapshot d’export.
- Le contrôleur garde la validation multipart et délègue à l’exporteur.
  Celui-ci utilise le même document pour le builder et le JSON auteur, puis
  ajoute `authoring/` après la CLI et avant `zipSightyPackage`.
- Les originaux auteur sont copiés depuis les octets reçus, avec des noms
  générés sûrs. Cette copie peut répéter un média déjà présent dans une scène.
  Elle sert la reprise indépendante du catalogue et évite de coupler les IDs
  Elcé aux noms d’assets compilés ; aucune déduplication globale des scènes ni
  nouvelle logique de paquetage runtime n’est introduite dans cette tranche.
- Ne livrer ni chemins serveur/temporaires, ni clés FileStorage, droits,
  checkpoints, Undo/Redo ou progression/réponses du test auteur. Le projet
  importé démarre un état test neuf par le mécanisme existant.

## Entrées ZIP et dossier : même frontière de lecture

Le nouveau reader appartient à `src/project-package/`. Pour le dossier,
retirer uniquement le préfixe du dossier sélectionné via `webkitRelativePath` ;
pour le ZIP standard, les chemins sont déjà relatifs à sa racine. Le reste du
codec reçoit dans les deux cas une même collection chemin → fichier/octets.
Un contrôle de support du sélecteur dossier est nécessaire ; le ZIP reste
l’entrée disponible si le navigateur ne propose pas ce sélecteur.

Lire uniquement les données et les fichiers désignés, sans `import()`, `eval`
ou initialisation du paquet choisi. Résoudre les chemins média sous
`authoring/media/` ; refuser chemins absolus, segments `..`, séparateurs
ambigus, entrées dupliquées et références média ambiguës. Ces contrôles
protègent la correspondance des fichiers du format, sans extraction disque.
Les fichiers runtime sont ignorés par l’importeur, pas exécutés ni réécrits.

Valider une fois la structure inconnue à l’entrée du codec ; normaliser les
réglages autorisés, puis appeler `ElceDocument.fromJSON()` et
`assertDocumentInvariants()`. `fromJSON()` seul ne contrôle actuellement que
la version et ne constitue pas un validateur complet. Passer ensuite des
valeurs typées aux frontières intérieures ; l’API garde sa propre validation
de requêtes comme aujourd’hui.

## Identité et publication : prolonger les copies indépendantes

SQLite utilise des clés composées projet/entité. Le store IndexedDB média
utilise seulement `MediaId`. Renouveler uniquement l’ID du projet, comme une
copie partageant déjà ses sources, ne suffit donc pas pour un paquet externe.

Proposition : nouvel ID de projet et nouveaux IDs média à chaque import ;
réécrire `medias[].id`, `card.mediaId`, `question.mediaId` et
`summary.backgroundMediaId` avec une même table. Conserver IDs de chapitres,
pages, BDC, propriétés/choix de profil et réponses : ils restent dans leur
document et leurs références Tiptap, Carousel et contraintes restent intactes.
Conserver le nom source ; aucun renommage automatique n’est nécessaire puisque
les noms de projets ne sont pas leur identité. Toute référence média trouvée
hors de cette liste lors de l’implémentation impose de compléter ce tableau
dans le plan avant de coder sa réécriture.

Séquence proposée pour la nouvelle opération `kind: 'import'` :

1. Recevoir la sélection par façade → `project.operation`. Décoder, valider
   tout le document et tous ses fichiers, préparer les nouveaux IDs, sans
   encore modifier le store ou le projet actif.
2. Attendre les commandes déjà acceptées et la synchronisation du projet
   courant par `ensureCurrentProjectSynced`, comme lors d’une ouverture.
   Un conflit conserve le projet courant et annule l’installation de la copie.
3. Écrire document, blobs et checkpoint de la copie dans une seule transaction
   des stores existants. Proposition : méthode `saveImportedProject` sur
   `ElceDocumentStore`, reprenant `saveProjectDocument` et le même modèle de
   checkpoint, avec `remoteRevision: null`, `uploadedMediaIds: []`, `pending`.
   Un échec transactionnel ne laisse aucun fragment du projet importé.
4. Étendre le circuit de copies indépendantes de `ProjectSessionCoordinator`
   pour un projet importé sans source distante : marqueur optionnel proposé
   `DocumentSyncState.localOrigin: 'package-import'`. Le marqueur ne contient
   pas l’ancien ID comme projet source ; ne pas détourner `independentCopyOf`.
   Les conditions de `bootstrap`, `prepareProject`, `startLock` et de reprise
   reconnaissent ce cas dans le circuit existant, avec les copies actuelles
   inchangées. Ne pas créer un second coordinateur de publication.
5. Après le commit local, effectuer la transition habituelle vers la copie.
   Le circuit existant crée/confirme le projet serveur, acquiert son droit,
   publie les médias et confirme la révision. `ProjectSyncCoordinator` garde
   l’upload, la déduplication et les reprises ; aucun POST d’import n’est ajouté.
6. Tant que le checkpoint n’est pas `synced` avec une révision distante,
   annoncer une copie préparée/en attente, pas un import confirmé en base.
   Une interruption après commit conserve la copie pour reprise au bootstrap.
   Ne jamais supprimer le projet source pour annuler ou récupérer cet import.

Le marqueur local est une extension proposée du checkpoint interne, sans
nouvelle version documentaire. Les tests doivent prouver sa reprise avant
et après création distante, y compris si la réponse de création est perdue.
Ne pas annoncer une transaction globale SQLite/fichiers : les uploads restent
progressifs avec le checkpoint existant.

Pour plusieurs IDs média portant les mêmes octets, réutiliser les règles
actuelles du service média et le retour canonique de l’API. Ne pas créer une
seconde politique de fusion dans le codec. Inclure dans l’acceptation les
références Carte/Question/fond Sommaire ; si le circuit de fusion ne couvre
pas un usage, enregistrer l’écart au plan propriétaire et arrêter ce cas,
sans retirer le fond ou modifier silencieusement le catalogue pour le faire passer.

## Socle de compatibilité et preuve d’aller-retour

Conserver une fixture JSON et ses petits médias dans
`src/project-package/fixtures/baseline-v1/`, propriété des tests. Elle couvre
les six BDC actuels, leurs placements, contenus masqués par un layout, valeurs
de quiz et de graphe, contraintes, réglages et catalogue. Le test compare à
cette valeur figée ; il ne la régénère pas depuis les défauts du code courant.

Le test d’aller-retour part du vrai exporteur et passe par le reader, l’acteur,
la session, le client HTTP et les persistances réelles dans des ressources
isolées. La comparaison remplace seulement les nouveaux IDs projet/média
selon la table préparée ; elle ne trie pas les séquences et n’ignore aucun
champ métier. Les fichiers sont comparés par octets et SHA-256, pas par URL.
La reprise après fermeture/réouverture de SQLite doit rendre le même document.

Les prochaines évolutions d’un BDC devront conserver la lecture de cette
fixture et ajouter les cas propres à leurs nouvelles propriétés. Si un jour
une conversion devient nécessaire, son plan devra décider de sa frontière et
de sa version. Aucun registre de migrations vide ni circuit V1 parallèle
n’est justifié aujourd’hui. Les réglages absents suivent les défauts de
l’application réceptrice ; compatibilité d’édition ne promet pas un rendu
pixel identique entre deux versions du player.

La preuve navigateur reste distincte des comparaisons de données. Les limites
déjà suivies dans les plans Style, Évaluation, Sommaire et Mods ne deviennent
pas des fonctionnalités certifiées par cet import. Un symptôme de lecture
dans un projet importé doit être attribué à sa frontière réelle avant toute
correction.
