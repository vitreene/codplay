# Audit V1 - composants, services et layout

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: required before V2 component implementation

## Perimetre

Audit du runtime V1 uniquement. Aucun changement n'est apporte au runtime V1.

Sources principales :

- `packages/codplay/src/runtime/components/lib/base-component.ts` ;
- `packages/codplay/src/runtime/components/lib/component-services.ts` ;
- `packages/codplay/src/runtime/components/layout-component.ts` ;
- `packages/codplay/src/runtime/components/runtime-component-orchestrator.ts` ;
- `packages/codplay/src/runtime/components/types.ts` ;
- `packages/codplay/tests/v1/layout-runtime.spec.ts` ;
- `packages/codplay/tests/v1/seek-layout-outlet.spec.ts` ;
- `packages/codplay/tests/v1/component-service-operations.spec.ts`.

## Forme V1 du composant

`RuntimeComponent` expose :

- `node` ;
- `render()` ;
- `init?()` ;
- `_init()` ;
- `update()` ;
- `destroy?()` ;
- `getOutletsSnapshot?()` ;
- `modules`.

`BaseComponent` implemente une partie de cette forme :

- il conserve `perso`, `services`, `modules` et `node` ;
- `_init()` appelle `render()`, affecte le resultat a `node`, puis appelle `init()` ;
- `buildNode()` construit ou reutilise le node racine ;
- `destroy()` retire les declarations runtime liees au node ;
- le registre prive `parts` conserve les nodes trouves dans les templates ;
- `getPart()` et `resolveRef()` donnent acces a ces nodes.

La forme V1 est donc deja un contrat de projection directe sur un node reel. Elle
n'est pas un contrat de `ViewNode` abstrait.

## Services V1

L'orchestrateur possede un registre global :

```text
service name -> ServiceInstance
```

Les services de base sont `className`, `style`, `attr` et `content`. Un composant
declare les noms qu'il veut utiliser. `createComponentServices()` lui remet une
facade locale, mais les objets `ServiceInstance` viennent du registre partage.

Un service V1 recoit :

- un `node: unknown` brut ;
- une valeur de patch non typee ;
- un `ServiceApplyContext` d'evenement ;
- une sortie mutable pour produire des operations d'animation.

Le service peut donc ecrire sur le node et produire une operation pour l'adapter
d'animation. Le contrat ne declare pas le type de node, la portee de l'ecriture,
la capacite requise par le composant ou une factory d'instance.

Le registre refuse un second service de meme nom et permet un override global. Il
n'existe pas de deux implementations independantes d'un meme nom dans ce registre.

## Parts V1

`BaseComponent` contient l'infrastructure generique suivante :

1. le template est parse ;
2. chaque `data-part` est collecte ;
3. le node est place dans le registre prive `parts` ;
4. l'attribut `data-part` est retire du DOM ;
5. `getPart()` et `resolveRef()` resolvent la valeur exacte de l'identifiant.

Le nom de part est une donnee opaque. Le runtime V1 ne donne pas de signification
au prefixe d'un identifiant.

Cette infrastructure sert aussi bien aux parts internes d'un composant qu'aux
outlets externes d'un layout. C'est le premier melange de responsabilites.

## Layout V1

`LayoutComponent` ajoute la semantique layout :

- il lit `initial.markup` ;
- il parse le HTML ou le SVG ;
- il collecte les parts et conserve leurs identifiants ;
- il conserve une baseline des attributs auteur ;
- il expose `getOutletsSnapshot()` ;
- il applique les patches DOM via `this.services`.

L'orchestrateur ne recoit pas une capacite declaree. Il inspecte le composant :

```text
component has getOutletsSnapshot()
  -> registerComponentOutlets()
```

Il copie ensuite les outlets dans ses registres globaux `nodeByPersoId` et
`componentIdByOutletId`. Les outlets et les racines de persos partagent donc le
meme espace d'adressage runtime.

Les collisions d'identifiants sont detectees par l'orchestrateur. Un outlet absent
est signale par un diagnostic. Les tests V1 couvrent le montage d'un enfant, le
format SVG, l'outlet absent, le detach/reattach et la persistance pendant les
seeks.

## Cycle V1 observe

```text
perso.type
  -> componentClassByType
  -> new Component({ services: createComponentServices(...) })
  -> component._init()
  -> component.render()
  -> component.node
  -> component.init()
  -> stockage du node dans l'orchestrateur
  -> inspection eventuelle de getOutletsSnapshot()
  -> enregistrement des outlets
```

Pour un update :

```text
resolved action
  -> creation du ServiceApplyContext
  -> hooks beforeUpdate
  -> component.update(input)
  -> services et mutations du node
  -> hooks afterUpdate
  -> operations d'animation remises au renderer
```

## Constats de frontiere

### BaseComponent

`BaseComponent` porte trop de choses pour servir de modele V2 direct :

- cycle de vie generique ;
- reference du node ;
- parsing de templates ;
- registre de parts ;
- resolution de refs ;
- facade de services ;
- nettoyage des declarations d'events.

La reference `node` et le cycle `render/init/update` sont generiques. La publication
d'outlets ne l'est pas.

### ServiceRegistry V1

Le registre V1 convient a des operations stateless comme `style` ou `attr`. Il ne
convient pas directement a `layout` :

- le service est un objet partage par nom ;
- son contexte recoit un node brut ;
- sa valeur d'entree est arbitraire ;
- aucune instance de service n'est creee par composant ;
- aucun contrat de sortie structural n'existe ;
- le runtime ne connait pas la dependance d'un type vers un service.

Un service layout doit avoir une instance scopee, un contrat de cibles et une
frontiere de lecture pour le placement.

### LayoutComponent

Le layout V1 porte directement la publication de ses outlets dans
`getOutletsSnapshot()`. L'orchestrateur depend d'une introspection de methode au
lieu de dependre d'une declaration de capacite.

La methode n'est donc pas le probleme principal. Le probleme est l'absence d'un
contrat nomme entre :

```text
composant layout
  -> service layout
  -> registre de placement
```

## Frontieres V2 a construire

### Contrat composant

La forme normative retenue est :

- `render()` obligatoire, avec template string ou JSX integre ;
- `update()` obligatoire ;
- `init()` optionnelle apres materialisation ;
- `node` conserve par l'instance comme cible de projection.

### Service layout

Le service layout doit etre declare dans la definition runtime du type ou injecte
par cette definition. Il ne doit pas etre une propriete auteur arbitraire du perso.

Son contrat devra definir :

- decouverte des `data-part` ;
- identifiants opaques exacts ;
- portee d'une instance ;
- creation et mise a jour des cibles ;
- lecture par le placement ;
- collisions et outlets absents ;
- destruction de l'instance de service avec le composant.

Le nom d'un identifiant d'outlet, par exemple `page-layout:content`, n'est pas le
nom du service et ne porte aucune semantique normative.

### Autres composants

Un autre composant peut utiliser le meme service layout s'il respecte son contrat.
Deux instances du service doivent rester separees. Deux services portant le meme
nom ne peuvent coexister que s'ils implementent exactement le meme contrat ; sinon
le registre doit refuser la collision ou utiliser une identite de contrat distincte.

## Conclusion de l'audit

V1 possede un registre de services, mais pas un service layout explicite. Il possede
une infrastructure generique de parts dans `BaseComponent`, puis un pont layout
specialise dans `LayoutComponent` et l'orchestrateur.

Le chantier V2 doit donc conserver la reference `node` et le cycle composant, tout
en separant :

```text
infrastructure de composant
  != service layout
  != registre de placement
```

## Analyse service ou module pour V2

La question est de savoir si `layout` doit reutiliser le comportement des services
V2 ou celui des `RuntimeModuleService` existants. L'ajout d'un troisieme mecanisme
de runtime est exclu.

### Service V2

Le service V2 actuel est adapte a une operation de projection ou de validation :

- un nom de service est associe a une definition ;
- le builder valide les proprietes du service ;
- le builder derive le nom dans `CompiledRequirements.services` ;
- aucune instance runtime stateful de service n'est encore creee par player ou par
  composant.

Le modele service ne suffit donc pas directement a `layout`. Il faudrait lui
ajouter une factory, un scope, un cycle de vie, un registre d'instances et une
interface de sortie vers le placement. Cela reviendrait a creer un second
comportement runtime a l'interieur du systeme des services.

### RuntimeModuleService

Le module V2 existant porte deja le comportement requis :

- definition enregistree dans un catalogue engine ;
- instance creee par player ;
- etat mutable et testable ;
- cycle `initializeScene`, `prepareSeek`, `onMoveDelta`, `destroy` ;
- disponibilite verifiee par `CompiledRequirements.modules`.

`layout` peut donc etre un `RuntimeModuleService` player-scoped. Son instance
maintient une table interne indexee par composant layout :

```text
LayoutModuleService(player)
  -> componentId A -> root et outlets de A
  -> componentId B -> root et outlets de B
```

Il n'y a pas de partage d'etat entre players. Le scope player est celui du module ;
le scope composant est une entree interne de son etat.

### Conclusion proposee

`layout` doit reutiliser le comportement `RuntimeModuleService`, et non le
registre V1 des services de proprietes.

Le type `layout` declarera une dependance au module `layout` dans sa definition
runtime. La declaration `ComponentValidationDefinition.modules` existe deja pour
faire remonter cette dependance vers `CompiledRequirements.modules`.

Le composant `LayoutComponent` restera proprietaire de `this.node` et de son
template. Apres materialisation, il remettra au module les informations de sa
projection ; le module enregistrera les outlets et fournira la resolution au
placement.

Cette option exige encore de specifier :

- la definition de l'instance `LayoutModuleService` ;
- l'enregistrement et le retrait d'un composant layout ;
- la forme de la vue scopee remise au composant ;
- la lecture des cibles par le placement ;
- les diagnostics de collision et d'outlet absent ;
- le lien entre la definition de composant runtime et `modules: ['layout']`.
