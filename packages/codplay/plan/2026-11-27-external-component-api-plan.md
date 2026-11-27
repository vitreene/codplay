# API des composants externes — plan de travail

> Statut : **En attente** — document de travail de l'agent, pas une
> référence. La conception avance par questions à l'utilisateur, depuis ses
> intentions jusqu'à un contrat stable. Rien n'est implémenté.
>
> 2026-11-27 : scroll-container n'est pas un bon candidat pour concevoir le
> composant externe (imbrication forte dans le cœur, pas assez de recul).
> L'API externe sera conçue sur des exemples plus simples. scroll-container
> est devenu un type du cœur : voir sa [spécification](../specs/scroll-container-spec.md).

## Intention de départ (utilisateur, 2026-11-27)

- Un composant est externe parce qu'il répond à un besoin spécifique et n'a pas
  besoin d'être appelé fréquemment.
- Il n'est pas limité par le fait d'être externe.
- Il doit pouvoir être développé dans un dépôt externe, sans autre accès à
  CodPlay qu'une API.
- Tout lien direct entre un composant externe et CodPlay est une erreur de
  conception.

## Constat (revue du 2026-11-27)

- Les quatre intégrations de `authoring/component-v2` (scroll-container,
  Three.js, Rive, Avatar) franchissent la frontière : 6 imports internes pour
  les aides de validation (Three.js, Rive, Avatar), 11 pour scroll-container
  (scène compilée et résolue, `resolveAncestorChain`, constantes de cycle de
  vie, port HTML, gardes DOM, types de capture).
- `ScrollContainerComponent` hérite de `TagComponent`.
- Le cœur compile `emit.observe`, format propre à scroll-container
  (`scene/compiled/scroll-observation-validation.ts`, compilateur de capture,
  codec, validateur sémantique, types d'auteur).
- Une capacité demande trois enregistrements (composant, module jeton vide,
  adaptateur HTML) raccordés par des structures internes.
- `BaseHTMLComponent.node` est `unknown` ; `ValidationContext` n'a pas de
  méthode de rapport ; `package.json` exporte `./*`.

## Pistes de travail (non validées)

1. Une entrée dédiée aux extensions, complète : mêmes moyens qu'un composant du
   cœur, par ports et contrats.
2. Des ports par requêtes (persos désignés par `{ storyId, persoId }`), sans
   structure interne.
3. Un format d'auteur détenu par l'extension (déclencheurs `emit` enregistrés,
   résultat compilé opaque pour le cœur).
4. Un paquet d'extension enregistré une fois.
5. Une racine typée pour les composants HTML et une validation à méthodes ;
   reprise d'un profil du cœur sans héritage.
6. Preuve : `component-v2` se construit contre l'API seule, comme un dépôt
   externe.

## Réponses acquises

- **Arrivée** (documentée, démos et Sighty) : l'application fournit une
  configuration d'engine (`engineCapabilities` : `components` et `modules`
  enregistrés) et des options d'hôte (`htmlHost.sourceAdapterFactories`) ; les
  builders d'export et la distribution autonome réutilisent ce fichier
  (`--engine-config`, `runtime/engine.js`). scroll-container y occupe trois
  entrées dans deux endroits (cf. piste 4).
- **Auteurs** : l'utilisateur, d'autres développeurs sans connaissance de
  l'intérieur de CodPlay, et un agent IA guidé par le skill dédié. L'API doit
  donc se suffire avec sa documentation.
- **Reprise** : un composant externe part presque de zéro ; les fonctions
  communes viennent des capacités qu'il déclare, pas d'un héritage de composant
  du cœur (invalide `ScrollContainerComponent extends TagComponent`).
- **Évolution** : en pré-production, on met à jour les composants quand l'API
  change ; à la sortie finalisée, l'API sera versionnée.

- **Capacités externes** : un paquet externe peut fournir ses propres
  capacités, partagées par ses composants, au même titre que celles du cœur.
- **Rôle d'un composant** : sa vocation est de *rendre*, pas d'*agir* ; la
  logique est dans la scène. Un composant ne pilote donc pas d'autres persos.

## Déjà fixé par les specs (ne pas redemander)

- `observe` est une règle de `Perso.emit` portée par le perso observé,
  exclusive de `event` et `capture` (spec scroll-container ; Elcé Flux et Diapo :
  racines de Carte et marqueur de fin observent le scrollport).
- La capture est indépendante de sa source ; une source passe par le port borné
  `RuntimeCaptureSourcePort` et le circuit `RuntimeCaptureSourceCircuit`.
- Un composant ne crée pas de circuit parallèle ; les transitions `enter` /
  `leave` sont des events ordinaires, `liveAction` passe par le circuit live.

## Points de la spec scroll-container en tension avec « API seule »

1. Les types sont importés par sous-chemins (`codplay/runtime/runner-html`,
   `codplay/runtime/components`), que la spec désigne explicitement.
2. Le contexte de l'adaptateur de source HTML donne la lecture de la scène
   compilée et de la scène résolue.
3. La validation et la compilation d'`emit.observe` sont dans le cœur
   (`scroll-observation-validation.ts`).
4. `ScrollContainerInitial` reprend `TagInitial` et le composant hérite de
   `TagComponent`, alors que l'utilisateur veut partir presque de zéro et
   s'appuyer sur les capacités.

## Questions ouvertes

- Confirmer lesquels des quatre points ci-dessus sont à revoir.
- Les déclencheurs `emit` du cœur (`click`, `change`, clavier) doivent-ils
  passer par le même mécanisme qu'un déclencheur fourni par une capacité
  externe (`observe`) ? À discuter.

Tenues à jour au fil des réponses ; chaque réponse remplace la piste qu'elle
tranche.
