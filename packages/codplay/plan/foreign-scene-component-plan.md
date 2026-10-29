# Acceptation du contenu foreign et du composant `slot`

> Statut : **En cours**. Le profil `slot`, la surface HTML de rattachement,
> `replace-slot` et la première façade `instances.mount` ont des
> comportements vérifiés décrits dans les spécifications liées ci-dessous.
> L'intégration générale du contenu foreign et ses parcours complets restent
> à accepter.

## Autorité des contrats

Ce plan ne redéfinit pas les comportements déjà vérifiés. Leur interprétation
fait foi dans :

- la [spécification du composant `slot`](../specs/slot-component-spec.md) ;
- la [spécification du pont runtime `rel`](../specs/third-party-target-bridge-spec.md) ;
- la [spécification de façade et des instances](../specs/facade-v2-spec.md) ;
- les spécifications des bibliothèques qui possèdent une représentation native.

Les scénarios d'application Sighty restent des preuves de consommation ; ils ne
modifient pas le contrat générique de CodPlay. Les modifications du cœur restent
conditionnées par un plan accepté et une autorisation explicite.

## Décisions encore ouvertes

| Sujet | État | Travail requis |
|---|---|---|
| Référence sérialisable pour un contenu foreign générique | **À décider** | Arrêter sa forme avec le propriétaire de représentation concerné. Ne pas ajouter une forme universelle au composant `slot`. La valeur ne doit pas transporter de nœud DOM, de player, de fonction ni d'objet runtime mutable. |
| Disponibilité asynchrone | **Décision prise, application à valider** | Une disponibilité tardive réentre par le circuit déterministe du runtime avec l'identité de cible et la génération de session ; une réponse périmée est ignorée ou diagnostiquée. Définir et prouver le raccord du propriétaire de représentation sans callback qui écrit directement dans le DOM. |
| Remplacement d'une iframe ou d'une représentation non clonable | **À décider** | Choisir, pour la capacité concernée, entre remplacement sans transition et élément visuel de substitution. Le clone DOM de `slot` ne prouve pas la reproduction d'un rendu natif. |
| Enfants interinstances à plusieurs racines | **À valider** | Vérifier le comportement public de `codplay.instances.mount` avec plusieurs racines de premier niveau et documenter sa limite. La surface `foreignContent` multi-racines ne suffit pas à certifier ce parcours façade. |

`split` est un réglage des remplacements texte et média porté depuis V1,
pas une capacité autonome. Pour `slot`, `replace.split` reste accepté puis
ignoré : le contenu opaque n'est pas découpé. Les contrats vérifiés de
[`replace-text`](../specs/replace-text-v2-spec.md),
[`replace-media`](../specs/replace-media-v2-spec.md) et du
[circuit partagé](../specs/replace-presentation-v2-spec.md) définissent ces
capacités indépendamment du cycle foreign.

## Tranche acceptée — module `replace-slot`

Cette tranche implémente un modèle de remplacement propre aux vues d'un `slot`,
sans mêler les sources d'image ou de texte. Le module d'image conserve son
comportement existant sous `replace-media`. Les transitions d'actions `slot`
restent échantillonnées sur la timeline et rejouables par seek ; le remplacement
externe de `codplay.instances.mount` démarre sur son propre temps d'opération et
ne se recale ni ne s'annule pendant le seek/replay des players.

Profils retenus pour `slot.replace` et `instances.mount({ replace })` :

| Transition | Présentation dans le rectangle du slot | Durée par défaut |
|---|---|---:|
| `fade`, `fade-in` | Comportement V2 existant, conservé. | 300 ms |
| `mask-reveal` | La vue entrante est révélée par un masque CSS qui grandit depuis le centre. Formes `circle` (défaut), `star`, `diamond`, ou chemin SVG personnalisé `{ path, viewBox }`. | 900 ms |
| `curtain` | Les deux vues glissent verticalement : la sortante monte, l'entrante arrive du bas. | 1000 ms |
| `wipe` | La vue entrante fixe se révèle de droite à gauche par un masque rectangulaire. | 900 ms |
| `slide-over` | La vue entrante glisse du bas sur la sortante, qui recule et s'assombrit. | 1100 ms |
| `stack` | La sortante recule et s'assombrit ; l'entrante monte comme un panneau puis s'efface pour révéler la racine entrante persistante. | 2000 ms |

Les durées explicites continuent d'utiliser `duration`. Les valeurs ci-dessus
reprennent les durées Interlude pour les effets concernés ; `mask-reveal` prend
la durée locale de 900 ms. Ces effets utilisent uniquement des instantanés
visuels du slot et ne changent ni l'ordre ni le cycle de vie des instances
préparées par Sighty. Les contenus dont le rendu ne peut pas être cloné restent
la limite déjà connue. Aucun split de texte ou de contenu n'est introduit.

Fichiers concernés : `src/runtime/capabilities/replace-slot/`, le contrat des
surfaces de composant et du montage externe, le validateur/types `slot`, la
façade d'instances, et les tests runtime/façade correspondants.

Critères d'acceptation de cette tranche :

- les profils et formes sont validés à leur frontière, et chaque effet respecte
  le rectangle du slot, y compris après un resize ;
- le parcours public `instances.mount` remplace une instance existante, survit
  à un seek/replay du player hôte sans modifier son avancement, et nettoie ses
  instantanés lors d'un remplacement, d'un détachement ou d'une destruction ;
- les transitions d'actions du slot gardent leur lecture timeline, leur seek,
  leur interruption et leur nettoyage ; les images gardent `fade`/`fade-in` via
  leur module séparé ;
- le parcours public `instances.mount` exerce au moins un profil nouveau sans
  changer la préparation des scènes Sighty ; la fixture Sighty existante reste
  vérifiée indépendamment. Les tests runtime, façade, typecheck, suite, build et
  validation navigateur applicables passent avant le transfert du contrat dans
  la spec.

Validation consignée : typecheck CodPlay, typecheck démos V2, build démos et
parcours navigateur Brave passés. Le bilan du 2026-10-28 a relancé les six
fichiers ciblés : **33 tests réussis**. La suite
CodPlay complète garde cinq échecs FLIP déjà présents sur l'état de référence ;
la clôture reste ouverte jusqu'à leur résolution ou leur acceptation distincte.

## Acceptation restante

### Démo Sighty avec un profil différent par passage — Vérifiée

Demande du 2026-10-28 : reprendre le modèle de navigation de Demo 4 et proposer
une suite de scènes CodPlay dans le même slot Sighty, avec un profil
`replace-slot` différent à chaque passage. Le prototype en grille ne
correspondait pas à cette demande et a été retiré.

Décision acceptée : l'auteur déclare `replace` sur la vue entrante. Lorsqu'une
sélection entrante remplace la relation active qui occupe le même slot physique,
Sighty transmet ce profil à `instances.mount`. En l'absence de réglage sur la
vue entrante, le profil déclaré par le slot hôte reste la valeur par défaut.
Ce contrat est transféré dans la
[spécification runtime Sighty](../../sighty/specs/authoring-library-spec.md).

La démo utilise le runtime Sighty réel : un slot, un menu et une suite linéaire
de scènes CodPlay, avec les sept profils répartis sur les passages. Chaque
navigation est déclenchée par un événement public émis par la scène active.
Elle n'ajoute aucun circuit de montage parallèle.

Acceptation : tests ciblés Sighty du choix du profil entrant et de sa valeur de
repli vers le slot ; typechecks et build ; contrôle navigateur de chaque profil,
de la création puis du nettoyage des vues transitoires, et d'un aller-retour
répété ; absence d'erreur de composition ou de cible dans le journal Sighty.
Les vues enfants de cette démo ont une seule racine CodPlay clonable.

Preuves du 2026-10-28 : les typechecks CodPlay, Sighty et démos ainsi que le
build démos passent. Les tests `replace-presentation.spec.ts` (1) et
`slot-manifest.spec.ts` (3) passent. Dans Brave, le parcours a exercé chaque
profil entrant, confirmé deux instantanés pendant chaque transition, puis leur
nettoyage ; le bouton précédent est aussi revenu à la page portant son profil
`fade`. Le journal Sighty ne rapporte aucune erreur de composition. La suite
complète Sighty passe avec 52 tests après alignement de deux fixtures de tag
sans effet sur le contrat actuel (`actions: {}`).

Le périmètre générique des représentations non CodPlay, leur clonage et le
montage façade à plusieurs racines restent ouverts indépendamment.

| Gate | Preuve attendue |
|---|---|
| Manifeste et diagnostics d'intégration | Exercer la correspondance exacte des portées utilisées par les intégrations, avec références inconnues, ambiguës ou sans déclaration correspondante ; vérifier que l'erreur de composition est actionnable et ne choisit jamais une cible par approximation. |
| Propriétaire de représentation asynchrone | Exercer disponibilité tardive, remplacement concurrent, annulation et destruction par le vrai propriétaire ; prouver que les réponses anciennes ne réattachent pas de contenu et que les ressources restent possédées par leur fournisseur. |
| Montage interinstances | Valider les racines simples et multiples, leur ordre, le détachement, le remontage et la destruction d'une instance sans détruire l'autre. Garder les players hôte et enfant indépendants pendant les opérations publiques. |
| Modules de remplacement | Préserver le contrat slot et son indépendance de cycle. Les capacités replace sont vérifiées dans leurs spécifications texte, média et présentation. Le plan foreign ne traite que les frontières propres au propriétaire de contenu foreign. |
| Cycle de vie consommateur | Compléter le parcours A/B avec pause/reprise, replay, fins de séquence, interruptions et ressources, en conservant la propriété du cycle de chaque instance chez son appelant. |
| Validation navigateur | Rejouer les parcours réellement touchés dans Safari et un navigateur complémentaire, avec Play, Seek, resize et teardown selon le composant et le propriétaire validés. |

Chaque ligne est un gate distinct. Une fixture Sighty ne remplace pas les tests
de contrat du composant ou du pont ; un test unitaire de surface ne clôt pas le
cycle d'une représentation native réelle.

## Critères de clôture

- Les décisions de référence et de transition propres aux représentations
  concernées sont arrêtées ou explicitement exclues de la tranche.
- Les parcours asynchrones et multi-racines effectivement retenus sont testés
  par leur propriétaire jusqu'au montage CodPlay.
- Chaque module ne traite que sa source de contenu. Les capacités replace
  suivent les contrats vérifiés de leurs spécifications propres ; la clôture de
  la tranche foreign ne vaut pas validation de ses parcours indépendants.
- Le cycle consommateur et les contrôles navigateur applicables sont validés.
- Les comportements vérifiés sont transférés dans leurs spécifications ; le
  présent plan ne conserve ensuite que les gates restantes, ou est retiré si
  aucun travail ne subsiste.
