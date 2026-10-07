# Elcé — étude de faisabilité d’une transposition vers Remix 3

**État : faisabilité établie ; migration engagée le 7 octobre 2026 ; intégration Remix non éprouvée.** Les informations de version ont été revérifiées le 7 octobre 2026.

## Conclusion

Le remplacement React par Remix concerne l’interface auteur de l’éditeur. Il est techniquement faisable sans déplacer le modèle métier : seules les vues de l’éditeur et leur raccord au contrôleur sont remplacés. Le volet routes/API du projet reste décrit dans le plan local-first. Les classes métier, commandes, façades, machine XState, modèle documentaire et stockage IndexedDB gardent leurs responsabilités. Le rendu et la lecture du player restent dans le circuit Sighty/CodPlay, hors du portage de l’interface.

La cible fonctionnelle acceptée est **Remix 3**. Au 7 octobre 2026, le changelog officiel et le registre npm indiquent encore `3.0.0-rc.4` sous le tag `next`; le tag `latest` reste `2.17.5`. La version 3 stable n’est donc pas publiée. L’auteur a choisi de commencer le portage avec `3.0.0-rc.4`, fixé dans le workspace Elcé. Ce workspace déclare Node `>=24.3.0`, satisfait par le Node local `26.10.0`.

Remix 3 apporte un runtime de composants JSX qui ne dépend pas de React : un composant reçoit un handle, rend une vue et peut recevoir des événements via les interfaces du framework. Les noms d’exports ont évolué pendant les versions préliminaires ; la documentation de la RC actuelle utilise `remix/ui`. Vérifier les imports contre la version effectivement choisie avant l’implémentation. Le runtime ne fournit pas à lui seul le design system d’Elcé ; l’interface auteur conserve ses styles et ses éléments HTML natifs.

## Correspondance avec Elcé

| Responsabilité actuelle | Transposition envisagée |
| --- | --- |
| React affiche l’état reçu du contrôleur XState. | Les composants Remix rendent l’état de l’acteur ; une souscription demande une mise à jour de rendu. Les actions métier continuent d’envoyer les événements et commandes existants à XState. |
| @xstate/react fournit le raccord React à XState. | Le raccord est une petite frontière d’affichage utilisant les mécanismes Remix, sans créer une seconde source d’état. |
| @tiptap/react crée et affiche l’éditeur. | @tiptap/core expose directement Editor en JavaScript sans framework. L’extension d’ancre actuelle repose déjà sur ProseMirror et des NodeView DOM ; elle n’impose pas React. Le montage, la destruction, la sélection de toolbar et le dépôt d’images doivent être éprouvés dans le runtime Remix. |
| lucide-react affiche les icônes. | Le paquet lucide fournit des SVG pour JavaScript sans framework ; il peut remplacer l’adaptateur React en conservant les mêmes dessins. |
| L’éditeur ouvre une prévisualisation lue par Sighty/CodPlay. | Garder cette frontière de lecture telle quelle ; Remix ne remplace ni le player, ni sa composition, ni ses scènes. |
| Le serveur Elcé doit stocker les documents SQLite et les fichiers média. | Utiliser les routes, contrôleurs, middlewares, migrations SQLite, stockage de fichiers et réponses HTTP de Remix derrière les adaptateurs d’infrastructure Elcé. |

Le modèle, le contenu du document et les commandes demeurent indépendants de Remix. Les classes de domaine ne doivent pas importer de types Remix, SQLite, Tiptap ou DOM. Les contrôleurs Remix traduisent les requêtes HTTP vers les services et interfaces de stockage d’Elcé ; ils ne contiennent pas les règles du document.

## Faisabilité du raccord XState et de l’éditeur

Le raccord XState dispose d’un chemin direct dans le runtime Remix. Le point de
composition SPA du navigateur crée et démarre l’acteur une seule fois, puis le
fournit aux composants descendants par leur contexte commun. Une vue s’abonne
aux snapshots de l’acteur ; son callback conserve uniquement le snapshot à
rendre et demande le rafraîchissement Remix avec `handle.update()`. À
l’annulation de `handle.signal`, l’adaptateur désabonne l’observateur XState.
Cette projection de snapshot n’est pas un second état métier : les changements
persistants continuent de passer par les façades et les événements XState.
L’acteur ne doit pas être passé comme propriété à `clientEntry`, dont les
propriétés sont sérialisées ; le mode SPA permet de le créer dans la frontière
navigateur commune.

Ce schéma s’appuie sur des mécanismes documentés par Remix — état local de
composant dans la phase d’installation, mises à jour par `handle.update()`,
nettoyage par signal, et partage d’un modèle depuis la frontière commune. La
documentation avertit aussi que `handle.update()` doit être appelé après le
montage initial. Le point à éprouver est donc le cycle de vie réel de l’acteur
à travers les navigations Remix : ni acteur dupliqué, ni abonnement orphelin,
ni commande qui contourne le contrôleur.

Tiptap est également portable hors React. `@tiptap/core` construit un `Editor`
sur un élément DOM, expose ses commandes et événements de sélection, et les
NodeViews JavaScript sont prévues sans adaptateur React. L’extension d’ancre
Elcé peut donc rester dans son circuit ProseMirror actuel. Le travail porte
sur le cycle de montage/destruction de l’instance et le raccord des événements
de toolbar à l’interface Remix ; ni le modèle Tiptap, ni le HTML exporté, ni
les commandes métier n’ont besoin d’être réécrits.

Le player n’est pas une surface à porter vers Remix. Le parcours de prévisualisation reste celui que l’éditeur utilise déjà pour lancer Sighty/CodPlay ; son rendu, son protocole et son cycle de vie ne font pas partie de l’étude de faisabilité de l’interface auteur.

## Utilisation du backend Remix

Le mode SPA et l’API serveur utilisent deux parcours de requête distincts. Dans le navigateur, `remix/spa` démarre un routeur Fetch client ; ses routes rendent des arbres Remix dans la fenêtre auteur. Côté serveur, un routeur Fetch Remix déclare les routes API et ses contrôleurs répondent avec des objets `Request` et `Response`. L’éditeur appelle ces API explicitement depuis le synchroniseur ; une réponse d’API ne remplace pas l’état XState. Il s’agit de deux tables de routes avec des responsabilités distinctes, pas d’un rendu serveur de l’état éditorial.

Pour SQLite, la première voie à éprouver est `remix/data-table/sqlite` avec les migrations Remix. Les lignes suivent la proposition relationnelle de la [note de tables](./2026-10-06-premier-etat-modele-donnees-bdd.md) : aucun enregistrement ne contient le document Elcé complet en JSON. Le JSON Tiptap et son HTML exporté restent seulement dans les lignes de Section prévues à cet effet. L’adaptateur reconstruit le modèle Elcé depuis les tables et préserve le contrat de révision du plan local-first. Les types SQL et Remix restent dans l’infrastructure, pas dans le modèle métier.

Pour les médias, Remix fournit le parsing multipart avec transfert en flux, une interface FileStorage avec implémentation filesystem, ainsi qu’une réponse fichier prenant en charge ETag, requêtes conditionnelles, HEAD et Range. Cela correspond au stockage des octets hors SQLite déjà retenu. Les contrôleurs doivent garder l’ordre établi dans le plan local-first : recevoir et finaliser le fichier, puis publier sa référence en base ; les règles de déduplication, les noms et le cache restent ceux du projet.

Le document actif reste local : IndexedDB le restaure, XState accepte les commandes, puis le synchroniseur envoie l’instantané stabilisé au serveur. Les réponses de route Remix ne remplacent pas silencieusement l’état de l’acteur. En particulier, les rechargements de données automatiques associés à un parcours de formulaire ne doivent pas devenir un second circuit de mise à jour du document. L’API de synchronisation reste appelée explicitement depuis le circuit existant.

## Rendu SPA retenu

Le mode choisi est SPA Remix. Le routeur de `remix/spa` rend l’interface auteur
dans le navigateur ; celle-ci restaure son document depuis IndexedDB et démarre
l’acteur XState. Un routeur serveur indépendant expose les contrôleurs de
synchronisation, SQLite et médias ; il ne devient pas une seconde source du
document affiché. Cette forme suit l’architecture locale d’Elcé et évite de
faire dépendre le rendu initial des données du serveur.

Le runtime Remix et les routes backend cohabitent sans modifier la frontière
de lecture existante. L’éditeur garde son accès actuel à la prévisualisation ;
Sighty/CodPlay continue de prendre en charge le player.

## Enjeu et limites

- L’enjeu principal est de reprendre l’interface auteur de l’éditeur avec le runtime Remix : remplacer les composants React, raccorder les snapshots XState et réécrire les tests d’interaction. Le modèle de document, ses invariants, les façades de commandes et les builders restent en place.
- Le point technique le plus sensible dans l’éditeur est Tiptap : la création et le nettoyage de Editor, la toolbar liée à la sélection, les NodeView, l’ancrage et le drag-and-drop doivent être validés dans un petit parcours avant de porter toute l’interface.
- Remix 3 utilise Node 24.3.0 ou plus récent selon son manifeste. Le workspace Elcé déclare ce minimum et le Node local est 26.10.0.
- Remix 3 reste en préversion à cette date ; le workspace Elcé fixe explicitement la RC acceptée. Le runtime peut remplacer React ; il ne remplace pas le design Elcé.
- Les interactions de l’éditeur et Tiptap doivent rester vérifiées dans Safari, Firefox et Chromium. Le player conserve son parcours d’acceptation Sighty/CodPlay existant et n’est pas un critère de migration Remix.

La conclusion de faisabilité est positive. Le préalable technique qui reste à
démontrer avant un portage complet est un parcours vertical dans le vrai
runtime : démarrage SPA, acteur unique, commande par la façade, rendu d’une
mise à jour et montage/démontage de Tiptap avec l’extension d’ancre. Le
`Handle` Remix fournit `context`, `signal`, `queueTask()` et `update()` ; une
tâche différée reçoit le nœud DOM après mise à jour. Pour Tiptap, le petit
parcours doit vérifier ce cycle de vie réel et le sort du DOM détenu par
ProseMirror lors d’une navigation de frame. Si `data-rmx-preserve-dom` est
nécessaire, éprouver ce mécanisme documenté sur le plus petit hôte Tiptap avant
d’étendre le portage. Ne pas remplacer cette preuve par une recherche DOM
globale. Le contrôle de prévisualisation doit continuer à appeler le player
existant sans porter son rendu dans Remix. Le minimum Node est maintenant
déclaré dans le workspace ; la version Remix doit être choisie avant son
installation.

## Sources officielles consultées

- [Remix 3 changelog — versions RC et changements d’API](https://github.com/remix-run/remix/blob/main/packages/remix/CHANGELOG.md)
- [Versions et tags npm de Remix](https://www.npmjs.com/package/remix?activeTab=versions)
- [Manifeste du paquet Remix — moteur Node requis](https://github.com/remix-run/remix/blob/main/packages/remix/package.json)
- [Remix — Rendering UI](https://guides.remix.run/rendering-ui/)
- [Remix — Interactivity and clientEntry](https://guides.remix.run/interactivity/)
- [Remix — SPA runtime](https://api.remix.run/api/remix/spa/overview/)
- [Remix — SPA `run()`](https://api.remix.run/api/remix/spa/function/run/)
- [Remix — `Handle` du runtime UI](https://api.remix.run/api/remix/ui/interface/Handle/)
- [Remix — contexte du runtime UI](https://api.remix.run/api/remix/ui/interface/Context/)
- [Remix — préservation du DOM client](https://api.remix.run/api/remix/ui/overview/)
- [Remix — Routing and Controllers](https://guides.remix.run/routing-and-controllers/)
- [Remix — Data and Validation, SQLite and migrations](https://guides.remix.run/data-and-validation/)
- [Remix — Files and Assets](https://guides.remix.run/files-and-assets/)
- [Remix — Browser and end-to-end tests](https://guides.remix.run/testing/)
- [Tiptap — Vanilla JavaScript](https://tiptap.dev/docs/editor/getting-started/install/vanilla-javascript)
- [Tiptap — JavaScript NodeViews](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/javascript)
- [Lucide — Vanilla JavaScript](https://lucide.dev/guide/lucide)
