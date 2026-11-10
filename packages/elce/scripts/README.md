# Scripts du package Elcé

Ce dossier contient les commandes qui démarrent Elcé en développement,
préparent ses fichiers générés, vérifient les dépendances entre ses modules et
fabriquent des paquets SCORM. Le code des fonctionnalités de l’application reste
dans `src/` ; ces scripts servent à travailler sur le package ou à produire ses
livrables.

Lancer les commandes depuis `packages/elce` :

```sh
cd packages/elce
npm run dev
```

`npm run dev` démarre l’éditeur sur `http://localhost:5175` et l’API locale sur
le port `5181`. Pour démarrer seulement l’API, utiliser `npm run dev:api`.
`npm run dev:network` active en plus le lien de prévisualisation sur le réseau
local ; l’éditeur auteur reste local à la machine.

## Commandes utiles

| Commande | Usage |
| --- | --- |
| `npm run check:architecture` | Vérifie que le code partagé ne dépend pas des mods et qu’un mod ne dépend pas d’un autre. Affiche les fichiers et les imports responsables si une règle est enfreinte. |
| `npm test` | Lance les tests du package, y compris les tests des scripts. |
| `npm run generate:appearance` | Régénère les couleurs utilisées par le sélecteur d’apparence à partir des feuilles CSS des palettes. |
| `npm run package-scorm -- /chemin/formation.sighty.zip` | Ajoute le lecteur SCORM à un paquet Sighty existant. Les résultats sont placés à côté du fichier source dans `-=scorm_packages=-`. |
| `node scripts/package-quiz-hunt-scorm.mjs /chemin/jeu.sighty.zip /chemin/jeu.zip` | Produit l’archive SCORM monoSCO de Quiz Hunt à l’emplacement indiqué. |

La génération d’apparence est aussi lancée automatiquement avant `dev`, `build`,
`test`, `typecheck`, `preview` et `package-scorm`. Le fichier
`src/config/appearance/appearance-palette-colors.generated.ts` est donc une
sortie générée : pour changer une couleur, modifier la palette CSS puis lancer
`npm run generate:appearance`.

## À quoi servent les fixtures de frontières ?

`check-mod-boundaries-fixtures/` contient de petits exemples de code réservés
aux tests. Ils représentent quatre dépendances interdites : un import direct du
core vers un mod, un réexport d’une ressource vers un mod, un import de type
entre deux mods, et un chemin indirect du core vers un mod en passant par une
ressource. Le test `check-mod-boundaries.test.mjs` vérifie que le contrôle les
repère et montre le chemin complet.

Ces exemples ne sont pas utilisés par l’application. Ils rendent le contrôle
vérifiable : si sa détection cesse de repérer l’un de ces cas, le test échoue.
Pour vérifier les vrais fichiers d’Elcé, lancer `npm run check:architecture`.

`scorm-manifest-identities.mjs` est un utilitaire appelé par les deux scripts
SCORM. Il garde les identifiants de manifeste stables entre deux exports ; il
n’a pas besoin d’être lancé directement.
