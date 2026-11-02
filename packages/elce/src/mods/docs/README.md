# Comprendre Elcé pour développer un mod

Elcé transforme un document éditable en une expérience de lecture. Des builders
produisent le scénario Sighty et les scènes CodPlay à partir des contenus et de
leur organisation. Learning est le mod utilisé par l’application.

Ce guide donne les repères de développement. Les liens renvoient aux
spécifications pour le détail des contrats.

## Les grandes parties

| Dossier | Ce qu’on y trouve |
| --- | --- |
| [`src/core/`](../../core/) | Les mécanismes communs : contrôleur, historique, session projet, synchronisation, stockage technique, cadre éditeur et cycle de lecture. |
| [`src/resources/`](../../resources/) | Les capacités réutilisables : BDC, formats de page, ancrage, apparence, progression, profil ou évaluation, avec leurs données, services et contributions d’édition ou de lecture. |
| [`src/mods/learning/`](../learning/) | Le document Learning, son parcours, ses commandes spécifiques et l’assemblage des capacités choisies. |
| [`src/app/remix/`](../../app/remix/) et [`src/server/`](../../server/) | Les points de lancement navigateur et serveur. Ils appellent les compositions du mod. |

Le mod peut utiliser le noyau et les ressources ; les ressources peuvent
utiliser le noyau. Le noyau reçoit les adaptations nécessaires par ses ports
et paramètres, sans importer Learning. Les responsabilités du document sont
détaillées dans la [spécification Document](../../../specs/document-model-spec.md).

## Le vocabulaire utile

- Un **BDC** est un bloc de contenu : Section de texte, Carte, Question,
  Carousel ou Graphe, par exemple.
- Un **format de page**, comme Flux ou Diapo, organise les BDC et leur lecture.
- Un **preset** décrit une présentation et ses zones ; le **builder** combine
  cette présentation et le contenu pour produire une scène.
- Une **classe métier** porte les règles d’une capacité. Une **façade** donne
  à l’interface des actions adaptées à ses gestes ; la **machine XState**
  coordonne leur exécution et les changements de document.
- Une **composition** instancie ces éléments et raccorde leurs dépendances
  pour un contexte précis : édition, preview ou serveur.

## Du geste d’édition au document

```text
Vue Remix / saisie Tiptap → façade → acteur XState
  → commande et services métier → document validé → vues et persistance
```

Remix présente les valeurs et relaie les intentions ; Tiptap gère la saisie et
le DOM du texte des Sections. Un seul acteur XState possède le document, et les
vues se mettent à jour depuis ses snapshots.

Par exemple, renommer une page transmet `page.rename` par la façade au
contrôleur. Le service vérifie le nom non vide et transforme le document. Si la
commande réussit, le contrôleur installe la nouvelle valeur : le titre affiché,
l’historique et la persistance suivent ce résultat. Annuler et Rétablir passent
par ce même contrôleur. Voir [SPA Remix](../../../specs/remix-spa-spec.md) et
[Historique](../../../specs/document-history-spec.md).

## Sauvegarde et synchronisation

IndexedDB conserve le cache documentaire, les blobs média et le checkpoint de
synchronisation. Le mod fournit le codec qui relie son document au stockage
commun. La session projet et la synchronisation organisent les échanges avec
l’API ; le serveur Learning persiste le document dans SQLite et les fichiers
média séparément.

Une seule fenêtre à la fois détient le droit d’éditer un projet. Voir
[Cache IndexedDB](../../../specs/document-store-spec.md),
[Session projet](../../../specs/project-session-spec.md) et [API](../../../specs/project-api-spec.md).

## Du document au lecteur

```text
Document auteur → projection du mod et builders des ressources
  → scénario Sighty + scènes CodPlay → lecteur
```

Sighty conduit le parcours et la navigation ; CodPlay exécute les scènes et
leur rendu. La projection prépare aussi les actions et guards qui relient le
parcours aux services métier du mod et des ressources.

La preview utilise ce vrai lecteur dans un contexte distinct de l’éditeur.
Elle reçoit un instantané du document ; une synchronisation explicite le
remplace. Son état de consultation — navigation, réponses, progression,
profil et évaluations — reste en mémoire, séparé des ressources mises en cache.
Une preview n’enregistre jamais cet état sur le serveur. Voir la
[spécification Preview](../../../specs/player-preview-spec.md).

## Comment Learning est assemblé

| Élément | Point d’entrée à lire |
| --- | --- |
| Identité et types de contenus proposés | [`learning-definition.ts`](../learning/learning-definition.ts) |
| Store, session projet, acteur, façades et racine de l’éditeur | [`authoring-composition.tsx`](../learning/composition/authoring-composition.tsx) |
| Session et racine de preview | [`preview-composition.tsx`](../learning/composition/preview-composition.tsx) |
| SQLite, services média et routes API | [`server-composition.ts`](../learning/composition/server/server-composition.ts) |

La définition énumère les capacités proposées ; les compositions construisent
les objets qui les font fonctionner et exposent leur fermeture (`dispose` ou
`close`). Les points de lancement actuels choisissent Learning explicitement.

## Travailler sur un mod

Pour lancer l’exemple Learning depuis la racine du dépôt :

```sh
npm run dev:elce
```

Pour créer un mod ou modifier son assemblage avec Codex, suivre le
[skill Elcé Mod fourni dans ce dossier](SKILL.md).
