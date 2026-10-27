# Elcé — ressources réutilisables de la composition Learning

Date : 27 octobre 2026.

Cette analyse réexamine les attributions de l’étude du 20 octobre à partir des
spécifications actuelles et du principe demandé : Learning est la composition
de départ ; ses fonctionnalités doivent pouvoir être réemployées par d’autres
mods. Les décisions et le travail restant sont dans le
[plan unique](../plan/2026-10-20-elce-mods-reconfiguration-plan.md).

## Conclusion de l’examen

Aucune des capacités métier examinées n’exige, par sa fonction, d’être réservée
à Learning. Les candidats concernent aussi le parcours, la progression et
l’Évaluation, précédemment attribués en bloc à ce mod. Leur vocabulaire peut
rester spécialisé : une ressource de parcours avec chapitres ou d’Évaluation
reste réutilisable par les mods qui choisissent cette organisation.

Learning peut donc sélectionner, configurer et assembler ces capacités. Sa
composition documentaire actuelle, ses raccords et sa configuration forment
un ensemble cohérent sans lui réserver les règles des ressources assemblées.
La présence actuelle de `ElceDocument`, de constantes globales ou de types de
test dans une dépendance décrit un couplage à extraire ; elle ne démontre pas
une exclusivité métier.

Ce constat est une analyse de réemploi, pas une preuve d’indépendance déjà
obtenue. Les frontières physiques et les interfaces de l’extraction restent
suivies en D10–D13. Les groupes ci-dessous ne prescrivent pas un dossier,
une classe ou un acteur supplémentaire pour chaque ligne.

## Candidats fonctionnels

| Capacité actuelle | Métier réutilisable et circuit de départ | Raccord à la composition actuelle |
| --- | --- | --- |
| Organisation du parcours | Pages, regroupement en chapitres, ordre racine mixte, ordre interne, placements et déplacements. [Document](../../specs/document-model-spec.md), [organisation](../../specs/organization-editor-spec.md). | Learning sélectionne cette organisation, ses créations initiales et ses commandes assemblées ; le format v7 conserve `scenarioEntries` et les placements actuels. |
| Sommaire | Construction des entrées retenues, présentations menu/racine, titre, description, fond et destinations. [Sommaire](../../specs/summary-profile-spec.md), `builders/summary-profile/summary-scene-builder.ts`. | L’adaptation obtient les entrées du parcours choisi, leurs destinations et leurs états d’accès ; Learning choisit leur emploi dans son layout. |
| Profil et collecte par formulaire | Propriétés typées, choix stables, défauts, obligations, validation et collecte sans score. [Profil](../../specs/summary-profile-spec.md), `profile-rules.ts`, `profile-form-scene-builder.ts`. | Le document actuel rassemble définition, champs et contraintes ; la composition choisit quand collecter les valeurs et où poursuivre après soumission. |
| Conditions de visibilité | Comparaisons typées, priorité ET/OU, absence de valeur, héritage et effets Masquer/Verrouiller. [Règles de profil](../../specs/summary-profile-spec.md), `profileConditionMatches`, `profileVisibilityMatches`. | La ressource reçoit les valeurs et les cibles utiles ; l’adaptation actuelle résout chapitre/page/BDC et projette leurs effets sur le document et les routes existantes. |
| Prérequis | Dépendances, contrôle des cycles et vérification des complétions requises. [Prérequis](../../specs/summary-profile-spec.md), `assertNoReadingCycle`. | Le parcours choisi interprète « chapitre précédent » et fournit son ordre ; les guards Sighty conservent l’admission. |
| Progression et accès au parcours | Mémorisation des contenus terminés, modes `endpage`/`free`, conditions d’accès et de sortie, précédent/suivant. [Preview](../../specs/player-preview-spec.md), [Sommaire](../../specs/summary-profile-spec.md). | Les formats publient leur fin fonctionnelle ; le parcours et l’Évaluation contribuent leurs règles. Les actions/guards actuels les font appliquer par Sighty. |
| Évaluation et Résultat | Calcul du score et du seuil, tentatives, portée de reprise, relecture et représentation des issues. [Calcul](../../specs/chapter-evaluation-spec.md), [machine](../../specs/evaluation-machine-spec.md), `ElceChapterEvaluation`, `EvaluationMachine`, `ElceEvaluationResultService`. | Le parcours fournit les Questions concernées, les réponses et la destination Résultat ; ses actions appellent le métier et adressent l’issue aux stories. L’adaptateur SCORM fournit le seuil LMS lorsqu’il existe. |
| Personnalisation des textes | Références stables aux propriétés, résolution des valeurs et échappement du texte injecté. [Étiquettes](../../specs/summary-profile-spec.md), `resolveProfileTokens`. | La projection actuelle parcourt titres, Sections et BDC ; les éditeurs simples et Tiptap insèrent la même référence dans leurs formats respectifs. |
| État de lecture et réconciliation | Conservation des valeurs de profil, réponses et complétions ; invalidation ciblée après modification auteur ; resets distincts du profil et de la progression. [État test](../../specs/summary-profile-spec.md), `reconcileProjectTestState`. | `ProjectTestState` assemble aujourd’hui ces états. Le transport auteur et l’adaptation SCORM gardent leurs contextes distincts ; chaque ressource contribue la sémantique de son état. |
| Apparence et réglages de présentation | Résolution de l’héritage, palette, contraste, densité, typographie et réglages de transitions. [Apparence](../../specs/appearance-spec.md), [réglages](../../specs/editor-settings-spec.md), [texte responsive](../../specs/responsive-text-sizing-spec.md). | La hiérarchie documentaire fournit les ancêtres et les surfaces ; les ressources fournissent leurs rôles de rendu et leurs feuilles ; le mod choisit les contributions utilisées. |
| BDC et formats de page | Section, Carte, Carousel, Graphe, Question, Résultat ; Flux/Diapo ; presets, ancres, révélation et agrandissement. [Section](../../specs/section-editor-spec.md), [Carte/Carousel](../../specs/carousel-bdc-spec.md), [Graphe](../../specs/statistical-graph-spec.md), [Question](../../specs/question-bdc-spec.md), [Flux](../../specs/flux-scene-builder-spec.md), [Diapo](../../specs/diapo-scene-builder-spec.md), [ancres](../../specs/anchor-spec.md). | Les mêmes modèles, services, éditeurs et builders servent aux placements admis. Learning sélectionne l’offre et raccorde les contributions à son document et son scénario. |

## Ce que les dépendances actuelles révèlent

Les contrats décrivent les capacités ci-dessus. Une inspection limitée des
imports, types et signatures précise les couplages que ces contrats laissent
ouverts pour l’extraction :

- `domain/summary-profile/summary-profile-types.ts` rassemble profil, conditions,
  prérequis et Sommaire. `SummarySettings` contient aussi
  `pageContinuationMode`, qui agit sur la navigation. Le rangement actuel
  ne constitue donc pas une frontière de ressource suffisante.
- `profile-rules.ts` rassemble les calculs de conditions et les résolutions
  qui consomment `ElceDocument`. `reader-projection.ts` importe ce modèle et
  reconstruit sa projection complète. Séparer les règles réutilisables de la
  traversée de l’agrégat préserve le circuit existant.
- `buildSummaryEntries(document)` consomme directement `ElceDocument` ;
  `buildProfileFormScene` consomme les propriétés et valeurs de profil. Ces
  signatures montrent des degrés de couplage différents dans un même dossier.
- `EvaluationMachine` appelle déjà `ElceChapterEvaluation`. La spécification
  établit que ses transitions pures retournent un état conservé par l’hôte.
  Le calcul du score reçoit déjà des identifiants, des résultats et un seuil ;
  son défaut vient encore de la configuration documentaire globale.
- `test-state-types.ts` assemble profil, progression, réponses et états
  d’Évaluation. `test-state-reconciliation.ts` connaît le document et ces
  fonctionnalités ; l’agrégat complet ne doit pas devenir une exigence pour
  toute ressource de lecture.
- `appearance-resolver.ts` consomme le document et les cibles de commandes ;
  `appearance-color-generator.ts` importe son type résolu. Le générateur et
  le raccord à la hiérarchie documentaire ont des responsabilités distinctes.
- `ElcePlayerComposition` assemble formats, parcours, apparence, état test et
  service SCORM optionnel. Ce rôle d’assemblage ne donne pas au mod la
  propriété des ressources qu’il utilise.

Les modules mentionnés sont les circuits existants à faire évoluer. Cette
analyse n’introduit aucune API de remplacement ni logique parallèle.

## Mécanismes communs et dépendances déjà réutilisables

Le noyau conserve les mécanismes déjà identifiés : admission et file des
changements, commit, historique, gestion technique des médias, catalogue,
sessions, synchronisation, transport et cycle de vie de lecture. Leur
réemploi est distinct du choix d’une ressource métier par un mod. Le codec,
les invariants et l’adaptateur SQL de l’agrégat actuel restent raccordés à sa
composition ; cette situation ne rend pas les données de ses ressources
exclusives à Learning.

Le réemploi de diffusion dispose aussi de circuits établis :

- L’[export Sighty](../../specs/sighty-export-spec.md) emploie le même
  producteur de scénario que la preview, puis le CLI Sighty existant.
- La [session SCORM](../../specs/scorm-session-spec.md) s’appuie déjà sur
  `@codplay/sighty-scorm`. `ElceScormAdapter` traduit l’état assemblé actuel ;
  les classes du package partagé fournissent le mécanisme SCORM réutilisable.
- [Sighty](../../../sighty/specs/authoring-library-spec.md) possède routes,
  admission, contexte et composition des vues ; CodPlay possède l’exécution
  des scènes. Les ressources de parcours contribuent leurs données, actions
  et guards à cette chaîne.

## Limites de la conclusion

L’indépendance future devra être démontrée avec des données de test propres
aux ressources et avec les raccords réels Learning. Les spécifications
documentent déjà leurs preuves et leurs limites ; cette étude n’ajoute aucune
validation runtime. Elle conserve notamment les intégrations inachevées de
Recommencer/Relire et de la visibilité des corrections, ainsi que les limites
actuelles de persistance et de reprise.

Une ressource réutilisable conserve son métier concret et ses dépendances
utiles. Le formulaire actuel collecte un profil sans score ; la Question
actuelle comporte correction et résultat. Leur proximité visuelle ne prouve
pas un métier unique à fusionner. De même, la fin fonctionnelle d’une Diapo,
la progression de lecture et les signaux techniques CodPlay gardent leurs
contrats distincts.

La cible de composition permet à un futur mod de choisir les ressources dont
il a besoin. Le chantier actuel fait fonctionner cette composition dans
Learning et n’implémente aucun autre mod ni le scheduler.
