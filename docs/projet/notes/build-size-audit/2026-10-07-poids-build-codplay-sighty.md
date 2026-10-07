# Mesure des builds CodPlay et Sighty — 7 octobre 2026

## Résultats

Builds réellement exécutés depuis les entrées publiques de `packages/codplay`
(CodPlay V2) et `packages/sighty`. Les valeurs ZIP sont les tailles des archives
complètes, en-têtes compris. Un Kio vaut 1 024 octets.

| Bibliothèque / périmètre | JavaScript non minifié | ZIP du non minifié | JavaScript minifié | ZIP du minifié |
| --- | ---: | ---: | ---: | ---: |
| CodPlay V2 | 851,35 Kio | 188,89 Kio | 387,24 Kio | **104,00 Kio** |
| Sighty seul, dépendance CodPlay externe | 125,81 Kio | 27,49 Kio | 62,95 Kio | **15,34 Kio** |
| Sighty avec CodPlay inclus | 976,57 Kio | 215,32 Kio | 450,02 Kio | **118,83 Kio** |

Tailles exactes, en octets :

| Bibliothèque / périmètre | JavaScript non minifié | ZIP du non minifié | JavaScript minifié | ZIP du minifié |
| --- | ---: | ---: | ---: | ---: |
| CodPlay V2 | 871 780 | 193 420 | 396 531 | 106 491 |
| Sighty seul | 128 831 | 28 153 | 64 465 | 15 711 |
| Sighty avec CodPlay inclus | 1 000 010 | 220 488 | 460 824 | 121 684 |

Le poids propre de Sighty est donc de 62,95 Kio de JavaScript minifié, soit
15,34 Kio en ZIP. Cette version conserve un import de `codplay` et nécessite
que l'application fournisse cette dépendance. Le build de Sighty qui embarque
CodPlay représente 450,02 Kio, soit 118,83 Kio en ZIP.

Ces deux modes sont des alternatives. Le total avec CodPlay inclus est mesuré
sur un build distinct ; il n'est pas obtenu en additionnant les ZIP séparés.
Le bundler et la compression traitent ensemble le code inclus.

## Périmètre et méthode

Les manifestes de ces deux packages exposent actuellement `src/index.ts` et
n'ont pas de script `build`. La commande `npm run build` à la racine cible
`codplay-v1` ; elle ne mesure pas les bibliothèques demandées ici. Aucun format
de distribution de ces deux packages n'est établi par leurs spécifications.

La mesure utilise donc une configuration de bibliothèque réservée à cet audit,
avec Vite et les alias de chaque `vite.config.ts` existant. Elle ne modifie ni
les sources, ni les manifestes, ni la configuration de distribution du projet.
Les frontières publiques relues sont celles de la
[façade CodPlay](../../../../packages/codplay/specs/facade-v2-spec.md) et de
[Sighty](../../../../packages/sighty/specs/authoring-library-spec.md).

- Entrée : `src/index.ts` de chaque package, avec conservation des exports
  publics JavaScript de cette entrée. Les sous-chemins de CodPlay ne sont pas
  construits comme autant de bibliothèques supplémentaires.
- Format : ESM pour navigateur, cible `es2023`, mode production, élimination
  du code inutilisé par le bundler. Aucun scénario consommateur ne réduit la
  surface publique de l'entrée mesurée.
- Deux sorties : sans minification, puis avec minification Oxc. La minification
  des espaces est activée explicitement par
  `rolldownOptions.output.minify: true`, car Vite la désactive par défaut pour
  les bibliothèques ESM afin de conserver leur formatage.
- Compression : Info-ZIP 3.0, `zip -X -9`, méthode Deflate. Les dates des fichiers
  générés sont fixées au 1er janvier 2000 en UTC pour stabiliser les archives.
- Chaque build émet un seul fichier JavaScript. Les source maps, déclarations
  TypeScript, sources, tests, documentation, démos et ressources de scènes ne
  sont pas inclus. Ce n'est pas une archive de publication npm.
- CodPlay inclut les modules ACE effectivement utilisés. Aucun module de
  `node_modules` ni de `codplay-v1` n'apparaît dans les bundles. Les intégrations
  facultatives et leurs ressources, telles que Three.js ou Rive, ne sont pas
  importées par ces entrées et ne sont donc pas incluses.
- Les ZIP sont de véritables fichiers `.zip` ; leurs tailles ne sont pas les
  estimations gzip affichées habituellement par Vite. Une compression HTTP
  gzip ou Brotli donnera d'autres valeurs.

Le graphe produit contient 236 modules CodPlay et 31 modules Sighty. Le build
Sighty seul conserve uniquement `codplay` comme import externe ; les builds
CodPlay et Sighty avec CodPlay inclus n'ont aucun import externe ni différé.

## Environnement et vérifications

- Révision : `ba07c4125b7714013fea29d2459af2f3498b4dd8`.
- Les répertoires `packages/codplay` et `packages/sighty` ne présentent aucune
  modification Git au moment de la mesure. D'autres travaux préexistent dans
  le dépôt et ne font pas partie de cet audit.
- Node.js `26.10.0`, Vite `8.1.0`, Rolldown `1.1.3`, TypeScript `6.0.3`.
- Six builds réussis ; syntaxe JavaScript vérifiée sur chaque fichier produit.
- Exports identiques entre les versions minifiée et non minifiée : neuf exports
  JavaScript pour CodPlay, `Sighty` pour les deux variantes Sighty.
- Six ZIP vérifiés par `unzip -t`, puis par comparaison octet par octet entre
  leur contenu extrait et les fichiers produits. Empreintes SHA-256 enregistrées.
- `npm run typecheck --workspace=codplay` : réussi.
- `npm run typecheck --workspace=@codplay/sighty` : réussi.
- `git diff --check` : réussi.

Cette vérification porte sur la production et le poids des artefacts. Elle ne
constitue pas une nouvelle validation des parcours runtime ou navigateur et
ne change aucun statut de module ni contrat fonctionnel.

## Reproduction et artefacts

Depuis la racine du dépôt, avec les dépendances déjà installées et `zip` /
`unzip` disponibles :

```sh
node docs/projet/notes/build-size-audit/measure-builds.mjs
```

Le [script de mesure](./measure-builds.mjs) crée un nouveau répertoire
`dist/build-size-audit-*` à chaque exécution, affiche les tailles et y écrit
`measurements.json`, les six fichiers JavaScript et leurs six ZIP.

Les [mesures conservées](./2026-10-07-measurements.json) comprennent les tailles,
les empreintes, les imports, les exports et les paramètres. L'inventaire complet
des modules reste dans le JSON du répertoire d'artefacts.

Artefacts locaux de cette exécution, dans `dist/build-size-audit-UiEyRN/`
(répertoire ignoré par Git) :

- [CodPlay minifié, ZIP](../../../../dist/build-size-audit-UiEyRN/codplay/minified.zip).
- [Sighty seul minifié, ZIP](../../../../dist/build-size-audit-UiEyRN/sighty/minified.zip).
- [Sighty avec CodPlay inclus, minifié, ZIP](../../../../dist/build-size-audit-UiEyRN/sighty-with-codplay/minified.zip).
- [Inventaire et mesures complets](../../../../dist/build-size-audit-UiEyRN/measurements.json).
