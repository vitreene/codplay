# Sighty SCORM — assembleur de package

## Rôle et frontière

`assembleScormPackage()` enveloppe un paquet Sighty autonome déjà produit dans
un package SCORM. Il appartient à `@codplay/sighty-scorm`, ne dépend pas des
modèles Elcé et ne démarre pas de session LMS. L’adaptateur du projet fournit
le titre, les SCO du manifeste, les lanceurs et les autres fichiers du lecteur.
L’assembleur ajoute les fichiers SCORM partagés et laisse la logique du lecteur
au projet appelant.

Le sous-chemin Node `@codplay/sighty-scorm/packaging` expose cet assembleur. Le
point d’entrée navigateur du package n’expose pas ce module qui lit les
schémas locaux et construit des archives.

## Contrat d’assemblage

L’entrée contient les octets d’un ZIP Sighty, les options SCORM résolues, un
titre, les éléments de SCO du manifeste et les fichiers complémentaires du
lecteur. Le projet appelant peut fournir les identifiants de manifeste et
d’organisation, puis ceux d’item et de ressource de chaque SCO. L’assembleur
les conserve tels quels. Le rendu générique utilise son générateur
d’identifiants lorsqu’ils sont absents ; le projet appelant fournit des
identifiants stables lorsqu’un LMS doit reconnaître une mise à jour.
En mode local, l’assembleur conserve chaque fichier du ZIP Sighty
avec son chemin et ses octets, vérifie la présence de `export-manifest.json`,
`scenario.mjs` et `loader.mjs`, puis ajoute le wrapper Pipwerks, tous les
schémas de l’édition choisie, les lanceurs fournis et `imsmanifest.xml` à la
racine.

L’assembleur vérifie que chaque `identifierref` du manifeste désigne une
ressource et que chaque `href` de ressource correspond à un fichier présent.
Il refuse les chemins absolus, les segments de traversée, les URL et les
collisions de chemin. Avec `zip=true`, il produit un ZIP dont
`imsmanifest.xml` est à la racine. Avec `zip=false`, il retourne uniquement
l’arborescence de fichiers pour que le projet appelant l’écrive en dossier.

En mode `absolutePath`, les fichiers du ZIP Sighty et le wrapper Pipwerks ne
sont pas embarqués ; l’application hôte doit publier le loader, le scénario,
le runtime et le wrapper aux chemins ciblés par le lanceur fourni. Les
schémas, le manifeste et les lanceurs restent assemblés localement.

L’assembleur accepte les éditions SCORM 1.2, 2004 3e et 2004 4e par le type
d’options partagé. Il n’interprète ni le scénario Sighty ni les états du
lecteur et ne tranche pas le découpage en SCO.

## Preuves et limites

- [`scorm-package-assembler.test.ts`](../src/packaging/scorm-package-assembler.test.ts)
  vérifie les trois éditions, le wrapper local, la racine du ZIP, le mode sans
  ZIP, le mode distant, les fichiers d’entrée obligatoires, les chemins sûrs,
  les collisions et les références de lancement. [`scorm-manifest.test.ts`](../src/packaging/scorm-manifest.test.ts)
  vérifie la conservation des identifiants fournis, y compris quand un item
  sans lanceur précède les SCO actifs.
- L’import et le parcours dans un LMS ne sont pas établis par ces tests.
  L’assembleur valide les références de lancement qu’il génère, pas chaque
  dépendance arbitraire ajoutée par un projet.
