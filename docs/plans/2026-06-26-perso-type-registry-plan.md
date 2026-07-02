# Plan - Typage perso centralise par type (`PersoTypeRegistry`)

## Statut

Proposition de plan a valider avant implementation.

## Contexte

`v1-perso-spec.md` definit deja le contrat canonique cible:

- `PersoTypeRegistry` porte un couple `{ initial, action }` par type de perso
- `Perso<Id, T extends PersoType>` pointe sur `PersoTypeRegistry[T]["initial"]` et
  `PersoTypeRegistry[T]["action"]`

Le code reel n'implemente pas encore ce contrat:

- `PersoDoc` (`packages/codplay/src/player/types.ts`) et `ItemDoc`
  (`packages/codplay/src/runtime/types.ts`) restent plats: `type: string`, `initial: ItemState`,
  `actions: Record<string, ActionDoc | null>`
- ce modele plat masque des champs reellement supportes par certains composants, en particulier
  `input`
- les demos compensent deja par des casts du type `as unknown as PersoDoc["initial"]`, ce qui
  coupe la verification TS la ou elle devrait aider

Point utile: les composants `core` portent deja en pratique leur propre modele local de donnees,
via ce qu'ils lisent dans `render()` et `update()`.

## Perimetre

Chantier limite aux composants `core`:

- `tag`
- `text`
- `img`
- `input`
- `media`
- `list`
- `layout`

Hors scope pour ce chantier:

- composants extra ou tiers (`avatar`, `rive`, autres extensions custom)
- changement de comportement runtime
- tightening complet des valeurs au-dela de ce que le code supporte deja vraiment

## Principe de travail

La source de verite doit etre le code des composants `core`, pas une redescription abstraite dans
`runtime/types.ts`.

- `update()` est la source de verite de `action`: c'est le composant qui recoit et traite les
  donnees runtime
- `render()` est la cible normative naturelle pour `initial`, mais ce point doit etre verifie
  composant par composant avant de figer les types; on le traite comme une hypothese de travail,
  pas comme un axiome deja garanti par le code
- la centralisation doit donc etre une aggregation de types locaux exportes, pas un deplacement ni
  une redefinition concurrente

## Objectif

Centraliser le typage auteur/runtime des persos `core` autour d'un `PersoTypeRegistry`, tout en:

- gardant les definitions originelles dans les fichiers composants
- exposant un point central de composition pour `PersoDoc` et `ItemDoc`
- restant strictement aligne sur les champs reellement supportes par le code
- preservant l'ergonomie des tableaux heterogenes de persos

## Ligne de conception

1. Les types des composants `core` restent definis a la source, dans les fichiers composants.
2. Le fichier central ne fait que:
   - importer ces types
   - exposer les alias communs utiles
   - composer `PersoTypeRegistry`
3. Les champs communs ne doivent pas etre simplifies a tort:
   - `className` doit conserver sa forme reelle (`string` ou patch objet)
   - `style` doit conserver une forme compatible avec la pipeline runtime/anime existante
4. `initial` et `action` partagent probablement une base commune importante, mais `action` peut
   etre plus large sur certains champs; cet elargissement doit etre constate composant par
   composant, jamais suppose globalement.

## Etapes proposees

1. **Audit des 7 composants `core`**

   Pour chaque composant (`tag`, `text`, `img`, `input`, `media`, `list`, `layout`), relever:

   - les champs lus dans `render()`
   - les champs lus dans `update()`
   - les champs appliques via services (`className`, `style`, `attr`, etc.)
   - les champs presents dans les types locaux mais jamais consommes
   - les champs consommes sans type local exporte

   Sortie attendue: une petite matrice par composant:

   - `initial attendu par la spec`
   - `initial reellement lu dans render()`
   - `action reellement lue dans update()`
   - `ecarts / ambiguitees`

2. **Exporter les types locaux source de verite depuis chaque composant**

   Sans deplacer les definitions, exporter ou aliaser les formes locales de reference:

   - `TagInitial`, `TagAction`
   - `TextInitial`, `TextAction`
   - `ImgInitial`, `ImgAction`
   - `InputInitial`, `InputAction`
   - `MediaInitial`, `MediaAction`
   - `ListInitial`, `ListAction`
   - `LayoutInitial`, `LayoutAction`

   Remarques:

   - si un nom local actuel diverge (`ImageState`, `LayoutState`, `InputState`), preferer un alias
     d'export ou un renommage local minimal
   - `media` devra expliciter sa forme locale si elle n'est pas encore nommee proprement
   - a cette etape, on ne force pas encore un tightening complet des valeurs si le code consomme
     encore du `unknown`

3. **Formaliser les alias partages pour les payloads transverses**

   Creer quelques alias communs fondes sur les formes reellement acceptees par la pipeline runtime:

   - `ClassNameValue`
   - `StyleValue`
   - `ActionStyleValue` si `action.style` est plus large que `initial.style`
   - `AttrValue`
   - `MoveValue`
   - `BroadcastAction`

   Point d'attention:

   - ne pas reduire `style` a `Record<string, unknown>` si la pipeline supporte plus large
   - ne pas reduire `className` a `string` seul

4. **Construire un fichier central d'agregation**

   Ajouter un fichier de composition, par exemple:

   - `packages/codplay/src/runtime/perso-type-registry.ts`

   Ce fichier doit:

   - importer les types exportes par les composants `core`
   - exposer `PersoTypeRegistry`
   - exposer `PersoType`
   - exposer des unions ergonomiques du type `AnyPersoDoc` / `AnyItemDoc`

   Ce fichier ne doit pas devenir une deuxieme source de verite metier.

5. **Rendre `PersoDoc` generique sur `PersoTypeRegistry`**

   Faire evoluer `packages/codplay/src/player/types.ts` vers un typage par type:

   - `type: T`
   - `initial: PersoTypeRegistry[T]["initial"]`
   - `actions: Record<string, PersoTypeRegistry[T]["action"] | null>`

   Garder une forme union pour les usages heterogenes, au lieu de reintroduire `string` partout.

6. **Rendre `ItemDoc` generique sur la meme registry**

   Faire evoluer `packages/codplay/src/runtime/types.ts` de la meme facon, en restant coherent avec
   le modele auteur.

7. **Valider l'ergonomie des tableaux heterogenes**

   Verifier sur des stories reelles qu'un tableau mixte reste simple a ecrire et type-checke bien,
   par exemple sur un cas melangeant deja `list`, `tag`, `layout`, `input`.

8. **Retirer les casts devenus inutiles dans les demos `core`**

   Priorite a `quiz-hunt`, qui a revele le probleme, afin de verifier empiriquement que la registry
   couvre bien les champs reels utilises par les auteurs.

## Strategie d'implementation recommandee

Ordre prudent:

1. audit `core`
2. exports locaux
3. alias partages
4. fichier central `perso-type-registry.ts`
5. migration `PersoDoc`
6. migration `ItemDoc`
7. validation stories heterogenes
8. nettoyage des casts

## Risques / points a surveiller

- **`render()` n'est peut-etre pas parfaitement egal a `initial` dans le code reel**:
  l'audit doit confirmer ou documenter les divergences avant de figer la registry
- **`action` peut etre plus large que `initial`** sur certains champs: il faut constater ces cas
  composant par composant, pas les inventer ni les lisser globalement
- **tableaux heterogenes**: la discrimination par `type` doit rester ergonomique a l'ecriture
- **cycles de types** possibles, surtout autour de `input-component.ts` qui importe deja des types
  runtime generaux
- **risque de faux durcissement** si on remplace trop tot des `unknown` par des valeurs plus etroites
  sans preuve dans le code

## Criteres de validation du chantier

- les types `core` sont centralises dans un registre unique sans deplacer leur definition d'origine
- `PersoDoc` et `ItemDoc` sont discrimines par `type`
- les stories heterogenes compilent proprement
- les casts `as unknown as PersoDoc["initial"]` reculent nettement ou disparaissent sur les demos
  `core`
- aucun changement de comportement runtime n'est introduit

## Hors scope explicite

- integration des composants extra (`avatar`, `rive`, autres custom)
- refonte du systeme d'extension de registry runtime
- changements de spec opportunistes non verifies par le code
