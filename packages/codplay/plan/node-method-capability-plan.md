# Capacité de projection HTML `htmlElementMethod`

> Statut : **En cours** — décisions Fixe ; projection CodPlay et avertissement
> auteur Elcé implémentés et vérifiés. L’intégration complète au menu et son
> acceptation Brave restent à terminer. Le core CodPlay demeure indépendant de
> la projection HTML.
> Version CodPlay : V2 foundation

## Décision et besoin

Le 5 octobre 2026, l’utilisateur a précisé que CodPlay n’a pas pour objectif
de gérer l’interface comme React ou comme le DOM. La couche de projection HTML
reçoit et interprète les réactions explicites d’un élément HTML demandées par
une action, via `htmlElementMethod`, par exemple :

```ts
actions: {
  ouvrir: { htmlElementMethod: ['focus', 'preventscroll'] },
  fermer: { htmlElementMethod: ['blur'] },
}
```

La projection HTML traite la méthode correspondante selon les valeurs
transmises, par exemple
`htmlElement.focus({ preventScroll: true })` pour `focus` avec `preventscroll`.
Cette interprétation reste dans la projection HTML ; aucune sémantique HTML ne
sera ajoutée au core CodPlay. Le code Elcé ne doit pas appeler directement les
méthodes du DOM.

La décision vérifiée actuelle couvre déjà `attr` et `emit` : la scène peut
changer l’état accessible d’un perso et émettre les événements d’interaction.
Ces opérations n’appellent pas une méthode de l’élément HTML matérialisé.

## Frontière de projection retenue et gate restant

La [spécification de matérialisation](../specs/component-materialization-v2-spec.md)
décrit la spécialisation `BaseHTMLComponent` et le materializer qui crée et
conserve les nœuds HTML. Le point d’intégration retenu est le materializer HTML :
il résout le nœud sélectionné, lui envoie la méthode demandée et ignore la valeur
de retour. Le contrat d’action reste une donnée indépendante du substrat dans
CodPlay ; aucune surface de nœud ou sémantique HTML ne sera ajoutée au core.

À l’activation d’une occurrence, le materializer résout le nœud sélectionné
dans son registre player-local. Aucun handle DOM ne traverse le core CodPlay.
La sélection absente n’est pas un cas du circuit fermé ; si le perso est
démonté, l’appel est ignoré. Le code Elcé n’appelle pas directement les
méthodes du DOM. Cette tranche n’utilise pas le DOM pour reconstruire l’état
logique d’un composant et ne dépend pas d’une identité de nœud entre sessions.

La [spécification de scène](../specs/scene-authoring-spec.md) impose une
déclaration compilable et sérialisable ; les fonctions auteur restent hors du
`CompiledScene`. La capacité doit préserver cette frontière.

## Portée décidée et détails à relire

- Les valeurs autorisées décidées pour cette tranche sont `focus`, `blur` et
  `preventscroll`. Aucun nom de méthode libre, fonction ou sélecteur DOM n’est
  accepté.
- La propriété est placée dans une action de perso. Le materializer HTML
  applique l’instruction au nœud sélectionné pour cette occurrence.
- Décision acceptée le 5 octobre 2026 :
  `htmlElementMethod: ['focus', 'preventscroll']` appelle
  `htmlElement.focus({ preventScroll: true })`, `['focus']` appelle
  `htmlElement.focus()`, et `['blur']` appelle `htmlElement.blur()`.
  `['preventscroll']` seul est invalide.
- Une méthode est appelée une seule fois à l’activation de l’occurrence en
  lecture normale, sans répétition par frame. Focus et blur ne sont pas exécutés
  pendant Seek ni pendant une reconstruction. La fin de l’occurrence n’annule
  pas le focus ; celui-ci change à la suite d’une action utilisateur, d’un
  autre appel ou d’un changement imposé par le navigateur.
- Les listes d’opérations ambiguës ou répétées produisent un avertissement
  auteur à la compilation, hors du core CodPlay. Une instruction ambiguë,
  répétée ou non reconnue est ignorée après avertissement. `['preventscroll']`
  seul reste invalide.
- Si le perso est démonté, l’appel est ignoré.
- Si le nœud sélectionné ne peut pas recevoir le focus, la projection appelle
  sa méthode directement et laisse le navigateur appliquer son comportement ;
  aucun résultat ni diagnostic de focusabilité n’est traité.
- Dans la présentation synchrone, les attributs d’ouverture sont appliqués
  avant le focus. À la fermeture, le focus de retour est appliqué avant
  `aria-hidden`/`inert`. Cette tranche n’ajoute pas de scheduler RAF à Elcé.

## Application et acceptation restantes

### Travail vérifié

- [x] Le materializer HTML applique `focus`, `blur` et `preventscroll` depuis
      une nouvelle occurrence montée, une fois par activation.
- [x] Seek, reconstruction et refresh ne relancent pas l’action ; les
      attributs d’ouverture précèdent le focus et les attributs de fermeture le
      suivent dans la même présentation synchrone.
- [x] Elcé émet un avertissement auteur avant la compilation Sighty/CodPlay
      pour les listes invalides, répétées ou ambiguës.
- [x] Les tests ciblés CodPlay (player, runner HTML, materializer et méthodes)
      passent : 4 fichiers, 63 tests ; le typecheck CodPlay passe.
- [x] Le test de validation auteur Elcé passe : 1 fichier, 2 tests ; le
      typecheck Elcé passe.

### Travail restant

- [ ] Placer les méthodes dans les actions de la scène `layout` et retirer
      `ElcePlayerComposition.bindMenuDrawer()` sans réintroduire de logique DOM
      impérative. Définir d’abord l’état accessible du menu de bureau avec les
      capacités actuelles : sans le binding, l’état initial de la scène laisse
      le menu visible mais `inert`. L’écart 800/801 reste différé ; aucun patch
      Elcé ou HTML ne remplace une évolution CodPlay générique des media query.
- [ ] Tester le parcours de menu réel avec Brave aux tailles concernées par le
      transfert de focus, puis fermer l’acceptation Elcé. Garder l’incohérence
      800/801 hors de ce critère de sortie.

### Chemin d’implémentation retenu

- Lire `htmlElementMethod` dans les occurrences d’action résolues reçues par le
  materializer HTML. Comparer à la scène précédente pour n’exécuter que les
  occurrences qui viennent de s’activer ; le nœud est celui du perso courant
  dans le registre du materializer. Aucun service, handle de nœud ou champ
  HTML n’est ajouté au solveur ni au core.
- Le player transmet le mode générique `geometry-capture` à la projection lors
  d’un Seek/reconstruction. Le materializer HTML ne déclenche alors aucune
  méthode. Cette adaptation reste indépendante des règles HTML.
- Le service HTML `attr` diffère uniquement l’écriture de fermeture de
  `aria-hidden` et `inert` jusqu’au passage synchrone du materializer. Celui-ci
  exécute les méthodes d’action puis applique ces attributs. Les suppressions
  d’ouverture restent immédiates, avant le focus. Aucun scheduler RAF n’est
  introduit.
- L’avertissement auteur est produit hors du core, pendant l’assemblage des
  scènes Elcé avant leur compilation Sighty/CodPlay. Le materializer ignore
  aussi toute instruction invalide reçue dans une scène compilée.

## Parcours d’acceptation requis

- La validation du compilateur auteur, hors du core CodPlay, couvre les formes
  d’opération retenues et émet un avertissement pour les listes ambiguës ou
  répétées.
- Une intégration du vrai runner HTML vérifie l’application par la projection,
  l’isolation entre deux players, l’omission lorsque le perso est démonté et
  l’absence d’effet pendant Seek/reconstruction.
- Une intégration `HtmlPlayerRunner` exerce une scène à plusieurs persos :
  ouverture, fermeture, Échap, clic extérieur et sélection d’une page. Elle
  vérifie l’ordre focus/attributs et l’absence d’avertissement navigateur.
- Le parcours Elcé utilise ensuite la capacité dans la scène `layout`, sans
  accès DOM dans `ElcePlayerComposition`, puis rejoue les contrôles Brave aux
  tailles concernées par le transfert de focus. La lacune media query à
  800/801 est différée à une évolution CodPlay indépendante de la
  matérialisation, qui devra considérer les cibles HTML et canvas ; elle
  n’est pas un correctif de cette capacité. Ne pas supprimer le binding avant
  que l’état accessible du menu de bureau dans la version courante soit décidé.
- Après validation, transférer le contrat vérifié dans la spécification de
  matérialisation/projection HTML, mettre à jour la spécification Elcé, et
  fermer ce plan seulement quand les validations concernées sont terminées.

## Limites d’implémentation

L’intégration appartient au materializer HTML et au compilateur auteur, hors du
core CodPlay. Le materializer résout le nœud courant au moment de chaque
occurrence ; aucun état HTML n’est relu pour reconstruire l’état logique et
aucune identité de nœud n’est conservée entre sessions. Le plan général de
représentation HTML reste indépendant de cette tranche.
