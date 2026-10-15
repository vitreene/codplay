# Export d'une scène CodPlay — feuille de route d'exécution

> Périmètre demandé : **une scène CodPlay V2**. Sighty et Elcé hors tranche.
> Statut : **A relire** pour les choix nouveaux. Aucune implémentation autorisée
> par la seule rédaction de ce document. Précision demandée le 2026-10-15.
> Cocher une opération seulement avec un fichier ou une commande de preuve.

## 1. Livrable

- [ ] Produire sur disque la bibliothèque construite et le paquet d'une scène.
- [ ] Charger ce paquet depuis un site HTTP dans un conteneur fourni par le site.
- [ ] Entrée de diffusion demandée : `new CodPlay(root, scenePath)`,
  `await cp.init()`, puis `await cp.play()` ; `cp` reste l'objet CodPlay public.
- [ ] Lire le compilé ; aucun appel à `CodPlay.build` à destination.
- [ ] Embarquer les fichiers des états initiaux **et des actions futures**.
- [ ] Préserver les fonctions CodPlay et les capacités effectivement utilisées.
- [ ] Ne modifier ni les sources auteur ni un artefact gelé en place.

Hors tranche : scénario/fonctions Sighty, document Elcé, menu d'éditeur, ZIP,
publication et persistance d'une session de lecture. L'utilisateur indique que
le compilateur Sighty suivra ensuite le même principe ; ne pas modifier son
implémentation pendant cette tranche.

L'étude de la composition Sighty est demandée ; sa proposition reste dans le
[plan Sighty](../../sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md#export-de-scénario--projection-à-relire).
L'implémentation de cette tranche reste limitée à CodPlay.

## 2. Contrats et propriétaires

| Sujet | Contrat actuel | Circuit à prolonger |
|---|---|---|
| Compilation | [Scène auteur](../specs/scene-authoring-spec.md) | `src/scene/compiled/scene-builder.ts`, `src/scene/config/scene-build.ts` |
| Sérialisation | [Codec](../specs/compiled-codec-v2-spec.md) | `src/scene/compiled/codec.ts`, `types.ts`, `semantic-validator.ts` |
| Fonctions | [Scène](../specs/scene-authoring-spec.md), [straps](../specs/strap-execution-v2-spec.md), [cycle player](../specs/engine-player-v2-spec.md) | `src/scene/compiled/function-extractor.ts`, `capture-compiler.ts` |
| Composition | [Façade](../specs/facade-v2-spec.md), [composants](../specs/component-materialization-v2-spec.md) | `src/facade/facade-types.ts`, catalogue et registres existants |
| Ressources | [Preload](../specs/preload-v2-spec.md) | Découverte du builder ; `src/runtime/preload/` pour les comportements de chargement concernés |
| Bibliothèques | [Préparation tierce](../specs/third-party-library-spec.md) | Requirements, `engine.prepareScene`, intégration propriétaire |
| Rive | [Rive](../specs/third-party-rive-spec.md) | `packages/authoring/component-v2/src/rive/` |
| Three.js | [Three.js](../specs/third-party-threejs-spec.md) | `packages/authoring/component-v2/src/threejs/core/` |
| Avatar | [Avatar](../specs/third-party-avatar-spec.md) | `packages/authoring/component-v2/src/avatar/` |
| Décisions runtime ouvertes | [CompiledScene](./compiled-scene-plan.md), [média](./media-preload-plan.md) | Les référencer ici ; ne pas les remplacer par un contournement d'export |
| Build disponible | [Audit de build](../../../docs/projet/notes/build-size-audit/2026-10-07-poids-build-codplay-sighty.md) | Configuration du [script Vite](../../../docs/projet/notes/build-size-audit/measure-builds.mjs) |

Les chemins `src/…` sont relatifs à `packages/codplay`.
Avant reprise : lire le [guide V2](./notes/2026-08-26-decouverte-etat-codplay-v2.md).

## 3. P0 — décisions à fixer avant le code dépendant

**Sortie obligatoire :** décisions acceptées, signatures et exemples minimaux.
Les propositions ci-dessous ne sont pas des contrats implémentés.

| ID | Décision | Proposition à examiner | Débloque |
|---|---|---|---|
| D1 | Entrée et commande | Module source `scene-export.ts`, racine de ressources, destination. Option `--export` de la commande V2. Outillage Node dans `tools/scene-export/`, sans IO disque dans `CodPlay.build`. | E1/E2 |
| D2 | Découverte unique | Enrichir la découverte du builder pour produire les occurrences contextualisées ; en dériver manifeste preload et données de préparation du paquet. Dépendances CSS/binaires rattachées au même graphe de construction. Aucun second scanner de scène dans l'outil. | E3–E10 |
| D3 | Données hors preload | Décider où exposer occurrences et fichiers non préchargeables : résultat de build ou enveloppe d'export. Ne pas ajouter silencieusement des champs à `CompiledScene`. Si son schéma change, décider version et codec ensemble. | E3/E4 |
| D4 | Fonctions | Association exacte entre référence extraite et code reconstruisant la fonction avec ses imports/closures. Cas acceptés/refusés, portée des états capturés et straps externes. Prototype E11 avant API définitive. | E11/E12 avec fonctions |
| D5 | Intégration du paquet | Forme utilisateur retenue : `new CodPlay(root, scenePath)`, `await cp.init()`, `await cp.play()`. Préparation asynchrone explicite, voir §8. Restent à fixer : export du module interne au paquet et distribution du codec ; règles de cycle complémentaires à relire. | E2/E12 |
| D6 | Adresses | Relatives depuis leur source ; `/…` depuis la racine déclarée ; HTTP(S) matérialisées ; `data:` conservé ; `blob:` avec fournisseur d'octets explicite, sinon refus ; navigation externe distinguée des fichiers. | E4 |
| D7 | Capacités | Modules sources de composition déclarés dans l'entrée, même composition au build et à la lecture, un seul core CodPlay. Adaptateurs de dépendances des intégrations définis à leur propriétaire. | E8–E10 |
| D8 | Sortie | Dossier final nouveau ; construction dans un dossier temporaire voisin, publication après vérifications ; bibliothèque et scène séparées ; aucun écrasement implicite. | E1/E13 |

- [ ] Obtenir l'acceptation des décisions concernées et l'autorisation explicite
  des changements core, conformément à AGENTS.md, avant leur implémentation.
- [ ] D1/D5/D8 suffisent pour la verticale sans fonction ni ressource E1/E2.
- [ ] Une décision non acceptée bloque sa tranche ; ne pas inventer l'API manquante.

Pour chaque décision acceptée, inscrire ici : date, portée, signatures retenues,
exemple d'entrée/sortie, fichiers core autorisés et première preuve exigée.
Ne pas remplacer ces informations par « faire au plus simple ».

## 4. Format cible proposé

```text
<destination>/
  lib/codplay.js
  scene/index.js
  scene/scene.json
  scene/functions.js       # si fonctions utilisées
  scene/capabilities.js    # si capacités facultatives
  scene/scene.css          # si feuille associée
  scene/assets/…
  scene/chunks/…           # imports différés nécessaires
  export-manifest.json     # preuve de composition, aucun rôle runtime
```

- [ ] Fixer le format en P0 ; émettre uniquement les fichiers utiles.
- [ ] Outillage et tests : `tools/scene-export/` et `tools/scene-export/tests/`.
- [ ] Fixtures propres à ces tests, sans dépendance aux scènes/valeurs des démos.
- [ ] Régressions core dans les suites propriétaires de `packages/codplay/tests/`.
- [ ] Réutiliser la configuration Vite utile de l'audit ; ne pas exécuter les
  six mesures/ZIP à chaque export et ne pas créer un second circuit de build identique.
- [ ] Déclarer directement les parseurs retenus : leur présence transitive
  dans Vite/jsdom ne constitue pas une dépendance garantie du nouvel outil.

### Découpage des tests à créer après P0

Noms prévus, pas des fichiers déjà disponibles. Réutiliser une suite propriétaire
existante lorsqu'elle couvre le même circuit, plutôt que la dupliquer.

| Emplacement | Suite ou ajout | Couverture |
|---|---|---|
| `packages/codplay/tests/scene/compiled/` | Compléter `scene-builder.spec.ts` et `codec.spec.ts` | Découverte unique, occurrences, actions imbriquées, sérialisation, cohérence requirements |
| `tools/scene-export/tests/` | `resource-resolution.spec.ts` | §5 étapes 1–7 et R13 ; bases, HTTP, query/fragment, collisions, cycles |
| Idem | `resource-rewrite.spec.ts` | §5 étapes 8–12 ; copies immuables, cohérence de chaque occurrence, erreur contextualisée |
| Idem | `markup-resources.spec.ts` | R2/R4, SVG et srcset, préservation IDs/parts/multi-racine |
| Idem | `css-font-resources.spec.ts` | R5/R6, imports conditionnels, sources de fontes et familles |
| Idem | `function-module.spec.ts` | R8, identités/références/closures/imports/portées et refus |
| Idem | `capability-bundle.spec.ts` | R9/R10, composition, imports différés, absence de deuxième core |
| Idem | `scene-export.spec.ts` | Dossier réel, réimport, source intacte, relocalisation, déterminisme, annulation/échec |
| `packages/codplay/tests/facade/` | `scene-package.spec.ts` prévu | Constructeur de diffusion, init async, play délégué, erreurs, concurrence/init répété et destruction ; conservation du constructeur existant |
| `packages/codplay/tests/runtime/preload/` et `tests/facade/` | Compléter les suites propriétaires concernées | Chargement/handoff/CSS/fontes seulement si leur comportement est modifié |
| `packages/authoring/component-v2/tests/` | Suites Rive/Three/Avatar existantes et régressions ciblées | Préparation, dépendances, consommation et destruction dans l'intégration propriétaire |

Les fixtures de fichiers proviennent des tests : images, fontes avec droit de
redistribution, courts médias, documents et modèles possédés par la fixture.
Ne pas télécharger des assets de démo pour remplir les assertions. La fixture
navigateur composite appartient au nouvel outil et importe ses sorties construites.

## 5. Procédure commune à chaque référence de fichier

Exécuter dans cet ordre pour chaque famille du §6.

1. **Localiser** : source, scène/story/perso/action, propriété ou plage HTML/CSS,
   valeur brute, base et rôle du consommateur. Ne pas détecter un fichier sur
   la seule présence d'une extension dans une chaîne quelconque.
2. **Classifier** : média préchargeable, dépendance CSS, téléchargement, module
   exécutable, binaire d'intégration ou lien de navigation. Copier ne signifie
   pas ajouter une entrée preload.
3. **Résoudre** : base propre à la source ; refuser une base inconnue. Séparer
   chemin, query et fragment. Ne pas passer query/fragment comme nom disque.
4. **Lire** : octets locaux ou fournisseur accepté. Pour HTTP(S), contrôler le
   statut et prendre l'URL finale après redirection comme base des dépendances.
5. **Identifier** : dédupliquer par source canonique ; conserver la query HTTP
   si elle sélectionne la représentation. Même nom dans deux dossiers = deux
   sources. CSS identiques à bases différentes restent distincts avant résolution.
6. **Fermer les dépendances** : parseur du propriétaire, ensemble visité, cycles
   détectés, provenance complète jusqu'à une dépendance en erreur.
7. **Nommer** : destination stable sans collision sous `scene/assets/`, attribuée
   avant réécriture, indépendante du hash final ; éviter les boucles de nommage
   entre fichiers se référençant mutuellement.
8. **Réécrire** : seulement les occurrences reconnues, sur une copie. Préserver
   fragments SVG/média. La query HTTP sélectionnant des octets est consommée
   lors de leur matérialisation ; toute query encore sémantique à la lecture
   exige une règle acceptée.
9. **Fixer la base de lecture** : URL effective du paquet, jamais la page hôte.
   Le CSS injecté en mémoire ne bénéficie pas de l'URL de sa feuille source.
10. **Vérifier** : même URL effective dans payload, manifeste preload,
    `requirements.resources`, cache et composant. Codec valide après réécriture ;
    IDs, relations, placements et index temporels inchangés.
11. **Écrire et tracer** : octets finaux, source, consommateurs, destination,
    MIME, taille, SHA-256 final. Rapport de construction uniquement, aucun
    catalogue/registre runtime supplémentaire.
12. **Refuser l'incomplet** : fichier absent, référence non relocalisable,
    dépendance non traitée ou capacité manquante = erreur avec propriétaire
    et cause ; aucun dossier final annoncé réussi.

## 6. Matrice par ressource

### R1 — artefact compilé

- [ ] Compiler par le catalogue configuré ; ne pas reconstruire le compilé à la lecture.
- [ ] Conserver schéma, date de build, racines, requirements et index.
- [ ] Relocaliser une copie en maintenant payload/manifeste/requirements cohérents.
- [ ] Exécuter le codec existant `encode` puis `decode` sur la sortie finale.
- [ ] Tester source et premier artefact gelé inchangés ; incohérence ressources
  et requirements refusée ; même état logique avant/après transport.

**Propriétaires :** builder/codec. **Étapes :** E2/E3/E12.

### R2 — images raster et SVG

- [ ] Recenser `img.initial.src`, actions correspondantes et occurrences R4/R5.
- [ ] Copier sans conversion ni perte de qualité.
- [ ] Inspecter les références fichier/CSS d'un SVG externe ; préserver `#id`.
- [ ] Tester image initiale, remplacement tardif, réemploi, basenames identiques,
  SVG avec fragment et SVG dépendant d'un fichier.
- [ ] Navigateur : chargement/décodage, dimensions, URL, Seek arrière et replay.

**Arrêt :** dépendance SVG inconnue ou source dynamique sans règle acceptée.

### R3 — audio et vidéo

- [ ] Recenser `media.initial.src`, actions `src`, `attr.src`, `poster`,
  éléments HTML `source`/`track` et sous-titres selon R4.
- [ ] Classer par consommateur/format ; ne pas perdre une URL sans extension.
- [ ] Copier les octets ; préserver `sync`, contrôles, broadcasts et paramètres.
- [ ] Réutiliser preload et `resources.register` existants.
- [ ] Distinguer le handoff au composant `media` du chargement natif `tag`/markup :
  le second n'a pas de handoff certifié aujourd'hui.
- [ ] Tester vidéo initiale, changement de source, audio, poster, sources multiples,
  sous-titres, MIME et Range depuis le serveur HTTP statique.
- [ ] Navigateur : cache froid, Play/Pause/Seek/replay, identité du nœud adopté,
  absence de réassignation/redémarrage parasite, destruction/réinitialisation.
- [ ] Distinguer les requêtes Range normales d'un double chargement dû à deux
  consommateurs ; ne pas exiger artificiellement une requête vidéo unique.

**Arrêt :** direct, playlist segmentée, DRM ou flux sans fin sans contrat accepté.
Un succès tolérant `broadcast` ne prouve pas la disponibilité.

### R4 — attributs HTML et markup

- [ ] Parcourir `initial` et toutes les actions, y compris séquences imbriquées,
  selon les champs reconnus par le profil. Ne pas interpréter `SceneDoc.defaults`.
- [ ] Fixer en D2 la table par balise : `src`, `srcset`, `poster`, `href`,
  `xlink:href`, `data` d'un objet et styles incorporés.
- [ ] Utiliser un parseur HTML/SVG et la grammaire de `srcset` ; pas de regex
  pour parser HTML ni de découpage naïf sur les virgules de `srcset`.
- [ ] Remplacer seulement les plages URL ; préserver structure, IDs, commentaires
  `data-part`, espaces significatifs, fragments et ordre des racines.
- [ ] Distinguer ancre locale, navigation externe et fichier à embarquer.
- [ ] Tester multi-racine, source imbriquée, `srcset` contenant `data:`, marqueur
  d'insertion, attribut modifié par action et téléchargement tardif.

**Arrêt :** page iframe ou script HTML sans règle acceptée ; réécriture modifiant
les parts ou la matérialisation réelle.

### R5 — CSS associé, importé et incorporé

- [ ] Recevoir `styleSheet` à côté de la scène ; aucun champ CSS dans `SceneDoc`.
- [ ] Affecter une base source à chaque texte ; couvrir `style`, attribut
  `style`, `<style>` et CSS des composants retenus.
- [ ] Parser `url()`, images de `image-set()`, `@font-face`, `@import`.
- [ ] Charger récursivement les imports depuis chaque feuille ; traiter cycles,
  ordre, conditions média/supports et couches sans modifier leur sémantique.
- [ ] Fixer et tester le traitement de `@import` avant `preload.css.set` : ne pas
  laisser un import invalidé par son insertion dans `@scope` ; arrêter si
  l'aplatissement ou la solution retenue altère sa sémantique.
- [ ] Relocaliser les URLs du CSS injecté depuis la base du paquet.
- [ ] Installer/nettoyer par `preload.css.set`/`clear`, sans service CSS concurrent.
- [ ] Tester imports imbriqués/cycliques, query, espaces, fragment SVG, image-set,
  variable CSS contenant une URL et absence de fuite hors conteneur.
- [ ] Navigateur : styles identiques dans une autre page hôte ; destruction et
  second montage sans accumulation de slots.

**Arrêt :** dépendance CSS non identifiée ; test CSS en mémoire présenté comme
certification du chargement CSS par URL.

### R6 — fontes

- [ ] Partir des `@font-face` R5 et des dépendances explicites acceptées,
  jamais d'une recherche disque par `font-family`.
- [ ] Copier WOFF/WOFF2/TTF/OTF utilisées ; conserver famille, poids, style,
  stretch, axes variables, `unicode-range`, `font-display` et ordre des sources.
- [ ] Ne pas déduire la famille du fichier renommé : la stratégie native actuelle
  le fait et n'est pas certifiée pour cette association typographique.
- [ ] Fixer chargement/cycle dans le plan média ; éviter une seconde inscription
  de la fonte CSS sous une famille inventée par le preload.
- [ ] Signaler une famille métier fournie seulement par `local()` : autonomie
  non prouvée. Les familles génériques de repli restent des choix CSS.
- [ ] Tester nom de famille différent du fichier, normal/gras, variable,
  sous-ensembles Unicode, source manquante.
- [ ] Navigateur sans fonte locale de fixture : attendre sa disponibilité,
  vérifier face effective/mesures puis Seek/resize pour la géométrie des layouts.

**Arrêt :** validation fondée sur une substitution système silencieuse.

### R7 — documents et fichiers génériques

- [ ] Identifier téléchargements, documents, JSON/binaires déclarés par leur
  consommateur ; ne pas ignorer un fichier parce que son extension est inconnue.
- [ ] Copier octets/extension utile/MIME ; relocaliser le consommateur.
- [ ] Ne pas créer de stratégie preload pour un simple téléchargement.
- [ ] Tester PDF, fichier sans extension, basenames identiques, binaire inconnu
  de la table actuelle et lien révélé par une action tardive.
- [ ] Comparer les octets récupérés depuis le site consommateur avec la source.

**Arrêt :** génération indispensable par une API métier sans règle acceptée
pour matérialiser son résultat dans le paquet.

### R8 — fonctions CodPlay et imports

- [ ] Couvrir l'extraction existante : `scene.init`, `onStart`, `onSequenceEnd`,
  `story.init`, straps locaux scène/story, transforms `listen`, capture et
  autres fonctions effectivement extraites dans les données d'action.
- [ ] Inclure les `strapCollections` externes nommées avec leur portée exacte.
- [ ] Associer chaque référence à son code exécutable ; préserver imports,
  closures, valeurs capturées et durée de vie des états partagés.
- [ ] Préserver l'identité lorsque deux références utilisent le même objet fonction.
- [ ] Vérifier toutes les références contre la collection produite : absences,
  mauvais appariements et collisions empêchent l'export.
- [ ] Bundler imports statiques/différés et assets déclarés, avec un seul CodPlay.
- [ ] Interdire `toString`, `eval`, compilation de scène à la lecture, IDs devinés
  depuis un parcours recopié et suppression de fonctions pour faire passer l'export.
- [ ] Tester fonction exportée, helper importé, closure de factory, même fonction
  réutilisée, état capturé partagé, async, straps externes et cas refusé.
- [ ] Navigateur : DOM → transform → strap → événement/action via le journal
  existant ; lifecycle, capture, Seek et replay depuis le paquet exporté.

**Arrêt :** closure non reconstructible ou dépendance à l'éditeur, au DOM de
construction, à un objet natif vivant ou à une API absente.
Une scène sans fonction ne constitue pas une preuve R8.

### R9 — composants, services et modules

- [ ] Croiser requirements et composition de capacités de l'entrée.
- [ ] Associer chaque ID à sa définition/module source ; préserver overrides,
  providers de cibles et stratégies preload.
- [ ] Résoudre les dépendances déclarées des classes/modules via le circuit existant.
- [ ] Enregistrer avant `instances.create` et verrouillage du catalogue.
- [ ] Résoudre tous les imports `codplay`, sous-chemins inclus, sur une bibliothèque
  partagée ; aucun TS brut ni bare import laissé au navigateur sans résolution.
- [ ] Tester core seul, composant externe simple, override, service/module requis,
  type manquant et deux instances aux états locaux distincts.
- [ ] Vérifier le graphe bundlé et l'identité des bases de classes : un seul core.

**Arrêt :** ID sans module source ou dépendance de classe non déclarée.

### R10 — bibliothèques JS tierces et binaires d'exécution

- [ ] Partir des `RuntimeLibraryDefinition` de R9.
- [ ] Inclure JS statique/différé, workers, WASM effectivement nécessaires.
- [ ] Configurer base et URLs de secours vers le paquet.
- [ ] Garder `engine.prepareScene` comme barrière et partage par engine ; aucun
  chargement déplacé dans un constructeur de composant.
- [ ] Tester préparation unique par engine, deux engines indépendants,
  module/binaire manquant, destruction et libération déclarée.

**Arrêt :** CDN, worker, WASM ou import requis encore hors paquet.

### R11 — fichiers Rive

- [ ] Réutiliser `RIVE_LIBRARY`, `RIVE_COMPONENTS`, `RIVE_PRELOAD_STRATEGIES`.
- [ ] Copier `.riv`, JS et WASM principal/de secours de la version installée ;
  configurer leurs chemins avant préparation.
- [ ] Identifier images/fontes externes éventuelles du document : les embarquer
  par le mécanisme propriétaire ou refuser le document non autonome.
- [ ] Vraie fixture possédée par les tests : load, artboard, animation, state
  machine, inputs, Seek, destruction.
- [ ] Interdire les CDN pendant la preuve ; couvrir le secours s'il est activé.

**Arrêt :** seul un runtime synthétique a été testé.

### R12 — modèles, textures et animations Three.js/Avatar

- [ ] Réutiliser bibliothèque, stratégies `three-glb`/`three-fbx`, composants et
  cache existants ; ne pas ajouter opportunément GLB/FBX à la table core.
- [ ] Lister buffers, textures, animations et décodeurs ; distinguer fichiers
  incorporés et externes.
- [ ] Fixer découverte/réécriture avec l'intégration ; pas de parseur binaire
  improvisé dans le collecteur core.
- [ ] Préserver les bases des loaders ou réécrire les URI à leur propriétaire.
- [ ] Valider GLB incorporé puis modèle multi-fichiers séparément.
- [ ] Prouver consommation des octets préchargés, deux instances natives
  indépendantes, temps absolu, Seek/replay, destruction WebGL.
- [ ] Avatar : suites modèle/animation concernées ; gates existantes de pose/release
  toujours ouvertes tant qu'elles ne sont pas réellement exercées.

**Arrêt :** format/décodeur sans mécanisme de dépendances accepté.

### R13 — adresses spéciales et ressources calculées

- [ ] `data:` : conserver incorporé, vérifier le consommateur.
- [ ] `blob:` : obtenir octets/identité durable du fournisseur accepté, sinon refus.
- [ ] `#fragment` : référence interne, aucun fichier à copier.
- [ ] `mailto:`, `tel:`, navigation externe : conserver selon leur rôle de lien.
- [ ] URL calculée par fonction : association explicite à une ressource/fournisseur,
  sinon refus ; ne pas jouer les actions pour deviner tous leurs futurs résultats.
- [ ] Import JS calculé : fermer l'ensemble de possibilités avec le bundler ou refuser.
- [ ] Un cas réussi et un cas refusé pour chaque forme prise en charge.

## 7. Ordre d'exécution

Toutes les étapes restent **À faire après acceptation des décisions P0 concernées**.

| Étape | Prérequis | Opérations | Sortie exigée avant la suite |
|---|---|---|---|
| E0 | Aucun code | État Git, specs §2, baseline tests et circuits | Échecs initiaux consignés, propriétaires identifiés |
| E1 | D1/D8 | Build depuis `packages/codplay/src/index.ts`, configuration dédiée, CLI `tools/scene-export/` | `--export` cible V2 ; vrais ESM, imports/exports/syntaxe vérifiés |
| E2 | E1 + D5 | R1, scène core sans ressource ni fonction, consommateur utilisant `new CodPlay(root, scenePath)` | `await cp.init()` puis `cp.play()` ; paquet déplacé, HTTP, Seek/replay/destroy, aucun build à lecture |
| E3 | E2 + D2/D3 | Découverte propriétaire, types décidés, tests builder/codec | Occurrences contextualisées et actions imbriquées ; politique preload inchangée sauf décision explicite |
| E4 | E3 + D6 | Procédure §5 et R7/R13 ; graphe et preuve d'export | Copie/relocalisation stables ; erreur précise sans sortie finale partielle |
| E5 | E4 | R2/R4, parseurs et fixtures | Images initiales/tardives, SVG, attrs et parts dans le vrai runtime |
| E6 | E5 | R5 puis R6 ; décisions de chargement au plan média | CSS transitif/fontes effectives indépendants de la page hôte, cycle vérifié |
| E7 | E6 | R3 et tests preload/media concernés | Audio/vidéo/sous-titres, Range, handoff, Seek/replay/lifecycle |
| E8 | E7 + D7 | R9 avec une capacité facultative simple | Même catalogue et un seul core à la lecture |
| E9 | E8 | R10 puis R11 | JS différé/WASM locaux, vraie fixture Rive sans CDN |
| E10 | E8 + dépendances E9 nécessaires | R12, incorporé puis multi-fichiers | Vrais loaders/preload ; périmètre Three/Avatar réellement prouvé |
| E11 | E2 + D4 à instruire | Prototype R8, décision acceptée, puis implémentation | Liaisons/closures/imports exacts ; DOM/player/capture vérifiés |
| E12 | E3–E11 pour familles annoncées | Fixture composite et chargement §8 | Familles fonctionnelles ensemble après déplacement du paquet |
| E13 | E12 | Vérification statique, publication, erreur/annulation/relance | Uniquement un paquet complet publié, sources et sorties antérieures préservées |
| E14 | E13 | Checks §9, specs, README, suivi | Implémentation/contrats/tests/statuts alignés |

Ne pas ouvrir une famille facultative pendant qu'une verticale plus simple échoue.
Une livraison intermédiaire annonce sa matrice exacte : toute famille non
implémentée rencontrée est refusée et reste À faire ici. E2/E5 ne clôturent
pas l'export complet. E11 peut être étudiée après E2 sans attendre les tiers.

### Gate E11 — prototype obligatoire des fonctions

1. Produire trois petites entrées indépendantes : fonction importée avec helper,
   fonction issue d'une factory capturant une valeur, deux hooks partageant un
   état mutable. Ajouter un cas non exportable dépendant d'un objet natif vivant.
2. Passer par l'extraction actuelle ; relever chaque référence et l'identité
   d'origine. Ne pas réimplémenter son ordre d'extraction dans l'exporteur.
3. Démontrer l'origine source ou la factory portable de chaque fonction ; si
   l'entrée actuelle ne la fournit pas, écrire la forme minimale proposée en D4
   et faire accepter ce changement d'entrée avant d'implémenter le générateur.
4. Produire le module par le bundler avec le contexte lexical retenu. Réimporter
   le module dans un contexte neuf sans accès au module auteur vivant du test.
5. Comparer valeurs produites, état partagé, identité réutilisée et portées ;
   le cas non exportable doit être refusé avec son emplacement.
6. Seulement après cette preuve et la validation de D4 : raccorder lifecycle,
   transforms, straps et capture ; lancer le parcours DOM/player décrit en R8.

Un prototype échoué laisse E11 ouverte ; il n'autorise ni une sérialisation
approximative ni l'annonce du support des fonctions.

## 8. Initialisation côté site à prouver

### Forme de diffusion demandée — retenue, non implémentée

Précision utilisateur du 2026-10-15 : le dossier exporté doit se charger et
se lancer par une entrée standardisée, directement portée par `cp`, l'objet
CodPlay. L'orthographe existante de l'export de classe est `CodPlay`.

```js
import { CodPlay } from '/exports/ma-scene/lib/codplay.js'

const root = document.getElementById('scene')
const cp = new CodPlay(root, '/exports/ma-scene/')

await cp.init()
await cp.play()
```

- `root` est le conteneur DOM de la scène ; il est vérifié avant montage.
- `scenePath` est l'URL HTTP du dossier exporté complet, pas celle d'un fichier
  source. Avec le format §4, l'entrée conventionnelle est `scene/index.js`.
  Le site ne doit fournir ni la liste des ressources ni les modules du paquet.
- Le constructeur est synchrone. Retenir `init(): Promise<void>` explicite
  plutôt qu'une préparation réseau lancée dans le constructeur : le consommateur
  peut attendre la disponibilité et intercepter une erreur à un endroit unique.
- Le constructeur associe root et adresse. `init()` charge le paquet, prépare
  ses dépendances, précharge, enregistre les ressources et initialise l'occurrence.
- Après résolution de `init()`, `cp` est prêt. `init()` ne démarre pas la lecture.
- `play(): Promise<void>` démarre cette occurrence via sa telco existante.
- `cp` est l'instance publique `CodPlay`, pas un autre player à récupérer ou une
  seconde classe qui reproduit le moteur. La sélection de son occurrence de
  diffusion reste interne au raccord de façade.
- Le constructeur existant `new CodPlay(options)` et les APIs multi-instances
  restent régis par leur spec. Prévoir une surcharge de la même façade et des
  tests de non-régression ; toute autre forme exige une décision explicite.
- Pour sa future réutilisation par Sighty, séparer dans le circuit de cette
  feature la lecture/validation/relocalisation du paquet et la création de son
  occurrence. Le constructeur de diffusion compose ces opérations ; la lecture
  d'un paquet ne doit pas créer obligatoirement un propriétaire ou démarrer une
  scène. Sighty pourra alors utiliser les données préparées avec son propriétaire
  CodPlay existant, sans parseur d'export ou loader concurrent. La forme de cette
  réutilisation est à fixer en D5 ; aucune API publique supplémentaire présumée.

### Règles complémentaires proposées — A relire avant implémentation

- Le constructeur ne déclenche ni requête de paquet ni preload ni lecture.
- Deux `init()` concurrents attendent une seule préparation ; après succès,
  un nouvel `init()` ne recharge pas et ne remonte pas la scène.
- `play()` avant la fin d'un `init()` réussi rejette explicitement ; aucune
  lecture ou initialisation implicite ne masque une préparation manquante.
- Une erreur de chargement, codec, fonction, capacité, CSS ou preload fait
  rejeter `init()` avec l'étape et la cause. Un état partiellement monté n'est
  jamais présenté comme prêt. Préserver les ressources déjà possédées ailleurs.
- `destroy()` pendant la préparation empêche le montage tardif, annule les
  opérations annulables et ignore proprement les résultats devenus inutiles.
- Fixer avant code la politique après échec : nouvel `init()` après nettoyage
  ou nouvel objet requis. Ne pas déduire de retry automatique de cette forme d'API.

### Séquence interne de `cp.init()`

1. Le site a importé la bibliothèque ; `cp.init()` résout `scenePath` une seule
   fois en URL de dossier, normalise la barre finale et importe `scene/index.js`.
2. Résoudre la base des ressources depuis ce paquet, pas depuis la page hôte.
3. Charger/décoder le compilé ; contrôler version de schéma et identité du
   build compatible. `codplay` version `0.0.0` seule ne suffit pas : décider
   l'identité de distribution et les empreintes des artefacts associés.
4. Importer fonctions/capacités ; vérifier références, portées et requirements.
5. Utiliser le propriétaire `cp` déjà construit et enregistrer sa composition
   avant le verrouillage ; ne pas créer un deuxième propriétaire derrière `cp`.
6. Préparer les bibliothèques par `engine.prepareScene`.
7. Appliquer la même base aux données/CSS ; installer CSS par le canal existant,
   attendre les fontes selon le contrat R6 accepté.
8. Charger le manifeste preload, contrôler le résultat puis `resources.register`
   avec métadonnées et handles.
9. `instances.create` avec compilé, fonctions, straps externes nécessaires et root.
10. Conserver cette occurrence dans le raccord de façade et terminer `cp.init()`
    sans lecture. `cp.play()` rejoint ensuite son `instance.telco.play()` existant.
11. En échec partiel, libérer les ressources possédées et le CSS installé.
12. À la fin, destruction selon la propriété acceptée ; deux montages simultanés
    ne doivent pas supprimer les ressources/CSS de l'autre.

Aucun journal, dispatcher, telco ou cache média concurrent. Aucun sous-chemin
interne rendu public implicitement pour simplifier le chargement.

### Acceptation spécifique de la forme publique

- [ ] Exécuter l'exemple ci-dessus dans le consommateur construit, depuis le
  dossier exporté, sans imports manuels des ressources par le site.
- [ ] Avant `init()` : aucune requête/matérialisation ; après résolution :
  ressources prêtes et scène initialisée, temps logique sans lecture lancée.
- [ ] Après `cp.play()` : progression réelle et événements du même player,
  pas un appel global démarrant d'autres occurrences du propriétaire.
- [ ] Vérifier import/package/codec/preload défaillants, init répété/concurrent,
  play trop tôt, destroy pendant init et deux objets `cp` indépendants.
- [ ] L'URL de dossier avec/sans barre finale et son déplacement donnent le même
  résultat ; aucune dépendance à une liste HTTP du répertoire.
- [ ] Vérifier le constructeur historique, les registres et le multi-instance.
- [ ] Ne transférer cette nouvelle API dans la spec façade qu'après ces preuves.

### Audit de compatibilité avec le mode auteur — 2026-10-15

**Conclusion de lecture :** aucune collision de méthode existante. La classe
publique et `CodPlayApi` n'exposent actuellement ni `init()` ni `play()` ;
le constructeur n'accepte qu'un objet d'options. L'ajout proposé n'est pas
encore implémenté : son innocuité runtime n'est donc pas certifiée.

| Usage actuel vérifié dans les sources | Appels à préserver |
|---|---|
| `packages/editor/src/app/bridges/scene-player-bridge.ts` | `new CodPlay({ pauseOnDocumentHidden: false })`, build, preload auteur, CSS, ressources et remplacement des occurrences |
| `packages/editor/src/app/commands/editor-player-command-facade.ts` | Lecture/pause/Seek via `instance.telco`, avec adaptation `preRollMs` et contrôle des postconditions |
| `packages/sighty/src/runtime/state.ts` | `new CodPlay(options.codplay)` ; les occurrences restent sélectionnées par Sighty |
| `packages/demos/src/v2/layout/layout.ts` | Construction par options/capacités ; lecture de l'occurrence via sa telco |
| `src/facade/engine-facade/instance-registry.ts` | Création et initialisation existantes ; aucune obligation d'appeler un nouvel init public |
| `src/facade/instance-facade.ts`, `clock-controller.ts` | La telco cible son runner ; le contrôleur existant arbitre ensuite le ticker partagé |

**Contraintes de raccord à accepter avant code :**

- [ ] Sélectionner le mode de diffusion uniquement par la signature explicite
  `(root, scenePath)`. Préserver `new CodPlay()`, `new CodPlay(undefined)` et
  `new CodPlay(options)`, y compris options moteur, scheduler, preload et
  `pauseOnDocumentHidden`. Aucun chargement implicite dans ces formes.
- [ ] Ne pas imposer `cp.init()` avant le build, la préparation, le preload,
  les registres ou `instances.create` du mode auteur. Ne pas déplacer dans ce
  nouvel init les initialisations aujourd'hui effectuées par le constructeur.
- [ ] Associer `cp.play()` seulement à l'occurrence chargée depuis `scenePath`.
  Ne jamais sélectionner la première/dernière occurrence du registre ; ne
  jamais remplacer cet appel par `engine.start()` ou une lecture de groupe.
- [ ] Sur un propriétaire construit par options, proposer un refus explicite
  de `cp.init()`/`cp.play()` sans cible de diffusion, sans modifier ses occurrences.
  Ce comportement de refus reste à valider avec les règles de cycle D5.
- [ ] Préserver le circuit auteur de rebuild : staging, publication atomique,
  retrait de l'ancienne occurrence, preRoll, Seek et lecture. Aucun appel des
  nouvelles commandes injecté dans le bridge ou sa façade de commandes.
- [ ] Conserver la sémantique existante de `cp.destroy()` : destruction de tout
  ce que possède cet objet. Ne pas la réduire à sa scène de diffusion ; ne pas
  réutiliser l'objet de l'éditeur comme propriétaire d'une diffusion autonome.
- [ ] Conserver catalogue/preload/CSS/ressources/ticker par propriétaire ; tout
  partage explicitement fourni reste soumis à son contrat existant. Ne pas
  appeler un nettoyage global de ressources appartenant à l'autre propriétaire.
- [ ] Contrôler aussi les signatures et types publics exportés ; l'absence
  actuelle de mock `CodPlayApi` dans les consommateurs du dépôt ne remplace
  pas la vérification de l'interface après ajout des nouvelles méthodes.

**Tests d'acceptation supplémentaires :**

| Cas | Assertion |
|---|---|
| Constructeurs auteur sans argument/options/undefined | Comportement actuel, aucun chargement de paquet |
| Auteur sans init public | Build, preload, création, lecture, Seek, remplacement et destruction restent opérationnels |
| Auteur multi-occurrences | Aucune sélection implicite pour les commandes de diffusion ; ses telcos gardent leurs cibles |
| Diffusion avec autre occurrence dans le même propriétaire | `cp.play()` ne démarre que l'occurrence de diffusion ; si celle-ci est retirée, aucun fallback vers l'autre |
| Auteur et diffusion dans deux objets simultanés | Init/play/échec/destroy de la diffusion préservent état, CSS, ressources et transport auteur |
| Diffusion sans init réussi | Refus sans mutation de l'auteur ni montage tardif |

**Vérifications exécutées, sans modification de source :**

```sh
npm run typecheck --workspace=codplay
node node_modules/typescript/bin/tsc --noEmit -p packages/editor/tsconfig.json
```

Le typecheck CodPlay passe. Celui de l'éditeur échoue actuellement à
`packages/editor/src/builder-v2/build-scene.ts:580` : le builder émet encore
`master`, refusé par les types et la spec media-sync actuels. Cet écart ne
provient pas de `init()`/`play()`, qui n'existent pas encore.

Depuis `packages/editor` :

```sh
node ../../node_modules/vitest/vitest.mjs run \
  tests/scene-player-bridge-v2.spec.ts \
  tests/editor-player-command-facade-v2.spec.ts
```

Résultat : **11 succès et 1 échec sur 12**. L'échec existant est
`scene-player-bridge-v2.spec.ts:420` : présentation finale absente là où le
test attend `timeMs = 5000` après des keyframes déplacées. Sa cause n'est pas
établie par cette revue. Le signal et l'écart média sont suivis au
[plan éditeur](../../editor/plan/2026-09-01-editor-v2-organization-plan.md#matrice-de-validation).
Ne pas accepter ces résultats comme une baseline entièrement verte ; ne pas
les corriger opportunément dans l'export. Les tests de la nouvelle signature
et de coexistence restent à écrire après acceptation, puis à exécuter sur le
vrai runtime et dans le navigateur.

## 9. Acceptation finale

### V1 — dossier et publication

- [ ] Imports statiques/différés et fichiers requis tous résolus dans la sortie.
- [ ] Aucun chemin workspace, TS source, bare import non résolu ou CDN requis.
- [ ] Une seule copie CodPlay ; fonctions et données du même build.
- [ ] Cohérence payload/manifeste/requirements et hashes des octets finaux.
- [ ] Liens externes explicitement distingués des dépendances requises.
- [ ] Deux exports avec entrée et `createdAt` fixés : chemins/références et hashes
  fonctionnels stables ; timestamps du rapport séparés des artefacts comparés.
- [ ] Échec/annulation sans publication partielle ni écrasement ; relance possible.

### V2 — navigateur

- [ ] Avant MCP : configuration locale + inventaire vivant **complet**, noms et
  descriptions ; comparer serveurs configurés et outils exposés. Sans outil
  exposé d'un serveur configuré, garder sa validation en attente.
- [ ] Servir uniquement sortie et consommateur statique distinct, sans Vite de
  développement, API du projet ou accès aux sources.
- [ ] Paquet `/exports/cas-a/`, page `/site/test/`, puis déplacement et répétition.
- [ ] Bloquer les origines source ; contrôler requêtes/console/réponses, cache froid.
- [ ] Fixture composite : image initiale/tardive, CSS importé, fonte nommée,
  audio/vidéo, téléchargement, closure et capacité facultative ; chaque
  intégration annoncée ajoute sa vraie fixture.
- [ ] Vrais événements DOM → player/journal → matérialisation/actions tardives.
- [ ] Play/Pause, Seek avant/après action, replay/reset, resize, destruction,
  réinitialisation et deux occurrences ; masquage/reprise si concernés.
- [ ] Parent/enfant, ordre et reparent lorsque les champs réécrits ou chargements
  affectent géométrie ou références de montage ; motiver toute exclusion.
- [ ] Pas de persistance de parcours ajoutée ; prouver un second chargement
  indépendant de l'éditeur et du cache de la première session.

### V3 — commandes

Existantes depuis la racine :

```sh
npm run typecheck --workspace=codplay
npm run test --workspace=codplay
git diff --check
```

Si `component-v2` est affecté :

```sh
npm run typecheck --workspace=@codplay/component-v2
npm run test --workspace=@codplay/component-v2
```

- [ ] E1/E2 : inscrire ici les commandes **réelles** du nouvel outil, de ses tests,
  du build V2 et du consommateur ; ne pas annoncer de script inexistant.
- [ ] Lancer régressions ciblées, suites touchées puis checks requis ; consigner
  les échecs initiaux reproduits séparément des régressions nouvelles.
- [ ] Construire/typechecker les consommateurs touchés par une surface publique
  modifiée, sans corriger leurs symptômes par un circuit local parallèle.

### V4 — documentation et statut

- [ ] Après chaque tranche : spec propriétaire avec comportement vérifié et
  preuves ; décisions acceptées mais non appliquées gardées ici.
- [ ] Créer une spec d'export ciblée après la première verticale vérifiée ; ne
  pas publier la feuille de route comme contrat implémenté.
- [ ] README : commande réelle et exemple concret d'intégration dans un site.
- [ ] Fini seulement après V1–V4 pour le périmètre annoncé. Retirer le plan
  seulement sans décision/acceptation restante, puis corriger liens et index.

## 10. État initial connu — preuves du 15 octobre 2026

- `npm run build` racine cible codplay-v1 ; `codplay` V2 n'a pas de script build.
- Audit Vite : six builds/ZIP vérifiés. CodPlay minifié **397 492 octets**,
  ZIP **106 731**, aucun import externe ; sans ressources ni intégrations.
  [Mesures locales](../../../dist/build-size-audit-tSwVrc/measurements.json).
- Sonde : `img.initial.src` découvert ; `tag.initial.attr.src`, fond CSS et
  PDF lié absents du manifeste. Binaire inconnu ignoré par le test builder.
- Fonctions extraites vivantes ; leur JSON produit `{}`. Closure fonctionnelle
  en mémoire, aucun module portable encore produit.
- Baseline builder/codec/engine/façade : **67 succès, 4 échecs sur 71** avant code,
  révision `fb1e9515329d4a56773af536a8743331fef850c9`.
  `tests/facade/facade.spec.ts:450`, `480`, `508`, `590` : overlay motion au Seek,
  préparation après reset, resize et reset story.
- Commande depuis `packages/codplay` :

```sh
node ../../node_modules/vitest/vitest.mjs run \
  tests/scene/compiled/scene-builder.spec.ts \
  tests/scene/compiled/codec.spec.ts \
  tests/facade/facade.spec.ts \
  tests/runtime/engine/runtime-engine.spec.ts
```

Ces preuves ne certifient aucun export ni chargement navigateur. Cette rédaction
ne modifie aucune source, aucun test et aucune spec de comportement vérifié.
