# Elcé — export SCORM

## Rôle

L’action « Exporter en SCORM » est distincte de l’export Sighty simple. Elle
construit d’abord le paquet Sighty existant, puis le transmet avec les options
SCORM à `POST /api/exports/scorm`. La génération ne persiste rien dans le
projet. En monoSCO, le téléchargement contient l’archive des packages par
chapitre à extraire avant leur import dans le LMS.

Chaque SCO de chapitre utilise le nom auteur du chapitre dans le titre de son
item de manifeste et dans le titre de l’onglet de son lanceur. L’identifiant
technique du chapitre continue de déterminer le nom du lanceur et les
identifiants stables du manifeste ; changer le libellé ne change donc pas
l’identité LMS du chapitre.

## Nom du téléchargement

L’API construit le nom de base à partir du nom du document, de l’édition,
de l’option monoSCO et de la date UTC :

```text
[nom]-scorm[-monosco]-[YYYY-MM-DD]([version]).zip
```

Par exemple, `Demo-5-comparaison-Elce-scorm-2026-10-22(2004v4).zip` ou
`Demo-5-comparaison-Elce-scorm-monosco-2026-10-22(1.2).zip`. Le nom de
document est normalisé en ASCII, sans accents, avec les séparateurs regroupés
en tirets. La version SCORM reste entre parenthèses après la date ; le nom de
base n’invente pas de numéro de révision. Si un fichier identique existe déjà
dans la destination de téléchargement, le navigateur ajoute son suffixe de
collision, comme `(1)` ou `(2)`.

`Content-Disposition` et `X-Elce-Scorm-Filename` portent le même nom. Le client
utilise `X-Elce-Scorm-Filename` pour le lien de téléchargement ; l’API expose
ces en-têtes aux origines locales de l’éditeur.

## Preuves

- [`scorm-archive-filename.test.ts`](../src/server/export/scorm-archive-filename.test.ts)
  vérifie la normalisation, l’édition, le suffixe monoSCO et la date.
- [`scorm-export-api-controller.test.ts`](../src/server/export/scorm-export-api-controller.test.ts)
  vérifie les en-têtes HTTP et l’absence de persistance.
- [`elce-scorm-export-client.test.ts`](../src/export/elce-scorm-export-client.test.ts)
  vérifie le nom transmis à l’API et repris par le client.
- [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
  vérifie que le nom fourni par l’API est celui remis au téléchargement.
- [`scorm-package-runner.test.ts`](../src/server/export/scorm-package-runner.test.ts)
  génère un vrai package SCORM et vérifie le nom auteur du chapitre dans le
  manifeste et le lanceur, tout en conservant le chemin technique fondé sur
  son identifiant.
- [`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts)
  vérifie l’exposition CORS de l’en-tête de nom de fichier.
