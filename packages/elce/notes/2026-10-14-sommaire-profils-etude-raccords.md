# Elcé étude des raccords Sommaire et profil

## Objet

L’extension peut prolonger les circuits de document, scénario, saisie et rendu
existants. Les points les plus sensibles sont le montage du Sommaire externe,
la collecte sans score et la restauration des réponses persistées dans les
scènes. Ils demandent des contrats explicites avant réalisation.

Le [cadrage fonctionnel](2026-10-14-sommaire-profils-contraintes.md) fixe le
besoin. Les propositions de raccord et décisions ouvertes sont suivies dans
le [plan de construction](../plan/2026-10-01-elce-construction-plan.md#étude-des-raccords-sans-réalisation).
Cette étude analyse les contrats et leurs consommateurs ; elle ne certifie pas
les futures intégrations.

L’[inventaire technique](2026-10-14-sommaire-profils-inventaire-technique.md)
détaille les objets de stockage, éléments d’interface, formats et signatures
qui manquent encore pour rendre le plan exécutable.

## Document auteur et consultation

Le [document](../specs/document-model-spec.md) reste détenu par XState et
modifié par les commandes immuables. Les définitions de propriétés, options de
Sommaire et règles appartiennent à ce document et à son historique éditorial.
Les valeurs du lecteur, sa progression et ses réponses appartiennent à sa
consultation. Leur modification ne doit pas devenir une édition du projet ni
consommer son Undo documentaire.

La proposition est de dériver une représentation de consultation depuis le
document et les valeurs de profil. Cette représentation conserve les
identifiants et l’ordre documentaire ; elle n’est ni un second document
éditable ni un autre routeur. Les builders de scénario et de scènes doivent
consommer le même ensemble retenu. Filtrer uniquement le menu laisserait les
scènes, les routes et l’évaluation en désaccord.

Le filtrage doit couvrir les BDC racines et leurs enfants. Pour une Carte ou
un Graphe ancré, leur retrait de la consultation doit aussi retirer leur
réservation dans le texte projeté. Le circuit existant
[projectFluxPlayerMarkup](../src/builders/flux/flux-anchor-player-markup.ts)
possède cette projection des ancres : il est à prolonger, sans modifier le
JSON Tiptap auteur pour réaliser un masquage lecteur.

Un Carousel dont tous les enfants sont masqués est retiré de la consultation,
puis les pages et chapitres devenus vides sont retirés à leur tour. L’auteur
doit éviter ce cas limite dans la conception de ses règles ; son traitement
n’autorise pas un Carousel vide dans le document éditorial.

Deux décisions de compatibilité restent à fixer dans le plan : la version du
document enrichi et le traitement des documents existants sans ces réglages.
La lecture actuelle accepte la seule version 4 ; une migration ou une nouvelle
convention de défaut ne peut pas être supposée.

## Sommaire et scénario

Le [scenario-builder](../src/builders/scenario/scenario-builder.ts) rassemble
actuellement le graphe, les routes et les scènes persistantes de présentation.
Ses fonctions `createMenuScene`, `createPresentation` et `refreshPresentation`
constituent le circuit de liste et d’actualisation. Le menu expose l’entrée
active et le verrou d’accès ; les décisions proviennent de `canAccess` et
`canExit` du runtime Sighty. Les clics sont traduits en routes déclarées dans
le même scénario.

Cette extension nécessite de modifier le Sommaire actuel : affichage des
niveaux seuls, filtrage, présentation racine et nouvelles options d’accès.
Le déclencheur accepté pour le travail dérivé de composant externe est donc
présent. Son raccord doit être étudié avant de remplacer la liste.

Le composant externe devra recevoir les entrées et les décisions déjà
calculées, afficher la liste défilante en colonnes et transmettre les
intentions de sélection par `runtime.dispatch`. Le menu et la page racine
peuvent avoir des instances de présentation distinctes avec une source commune.
Le composant ne doit pas recalculer un accès, conserver un catalogue parallèle
ou rechercher la scène active dans le DOM.

Les propriétés actuelles à préserver comprennent l’ordre racine mixte, les
pages de chapitre, leur premier accès, les titres, l’entrée active, les verrous,
les intentions de sélection et le comportement responsive du menu. Le
[lecteur](../specs/player-preview-spec.md) conserve encore des points ARIA et
focus ouverts : l’extraction de la liste ne vaut pas leur résolution.

Le [slot](../../codplay/specs/slot-component-spec.md) possède une surface
`foreignContent` qui attache une représentation opaque sans posséder son
cycle de vie. La façade vérifiée `instances.mount` reçoit une instance CodPlay
enfant. Elle ne constitue pas un contrat public de montage pour un widget HTML
arbitraire. Il faut déterminer le raccord du fournisseur externe par les
surfaces prévues ; une recherche du slot dans le DOM ou un `appendChild` par
Sighty contournerait la frontière.

Le [plan foreign](../../codplay/plan/foreign-scene-component-plan.md) conserve
ce point ouvert. L’étude ne démontre ni qu’un changement du cœur est requis,
ni que ce raccord est déjà intégralement disponible. Une éventuelle évolution
du cœur devra faire l’objet d’un plan et d’une autorisation spécifiques.

La page Sommaire doit être une destination Sighty explicite, distincte de la
chaîne précédente/suivante des pages de contenu. Son défilement ne doit pas
produire une fin de page de contenu ni débloquer la progression. Le plan doit
préciser la portée des gardes sur cette destination et le paramètre d’accès
permanent, en conservant une seule admission de navigation.

## Conditions et ensemble retenu

Le constructeur actuel possède deux gardes Elcé : `createPageAccessGuard` et
`createPageExitGuard`. L’accès attend un préfixe de pages achevées ; la sortie
vers Suivant vérifie les conditions de page et le score éventuel du chapitre.
L’extension doit prolonger ces propriétaires avec les règles configurées,
les exceptions par famille et la désactivation explicite du test auteur.

L’ordre d’évaluation proposé est : résoudre les valeurs de profil et défauts,
déterminer le contenu retenu, retirer pages et chapitres vides, puis résoudre
les prérequis et les Questions de l’évaluation sur ce même contenu. La règle
générale du chapitre précédent désigne alors le précédent chapitre retenu.
Une dépendance explicite incompatible reste un diagnostic auteur.

Les gardes Sighty utilisent la condition la plus spécifique ; elles ne font
pas automatiquement une conjonction de tous les parents. La résolution des
règles Elcé doit respecter l’héritage accepté tout en conservant la fermeture
d’un chapitre masqué. La représentation de la règle effective reste une
décision à valider avant code, sans nouvelle API de gardes Sighty.

Le [cache de scènes](../src/player/elce-player-composition.ts) utilise
actuellement le contenu de page, ses BDC, médias et transitions dans sa
signature. Un profil qui change le contenu retenu ou les textes doit entrer
dans les dépendances de construction de cette scène. Une simple mise à jour
du contexte ne permet pas de réutiliser sans condition une scène construite
avec l’ancien profil. Les scènes non affectées doivent rester réutilisables.

## Page Profil et collecte

Le [contrat Question](../specs/question-bdc-spec.md) couvre une Question par
page, des choix et leur correction. Le
[builder Question](../src/builders/question/question-bdc-scene-builder.ts)
conserve la sélection dans l’état de story, valide puis publie les identifiants
sélectionnés et attendus avec le résultat juste/faux.

La page Profil demande plusieurs propriétés, des textes et nombres, et une
validation globale sans score. Deux voies restent à comparer dans le plan :
étendre le circuit Question avec une collecte sans correction, ou créer un
composant Formulaire externe dérivé des mécanismes du Quiz. La seconde voie
permet de conserver le rôle évaluatif de la Question sans lui imposer les
invariants d’une collecte de profil.

Le Quiz actuel est produit par un builder de story et ses fonctions de
sélection et validation ; il n’est pas une classe de formulaire à sous-classer.
La dérivation doit identifier les mécanismes réellement communs, notamment
les choix simples/multiples et le traitement des valeurs. Seule la logique
indépendante du rendu peut être partagée directement avec un formulaire
HTML externe. La correction et le score restent propres au Quiz.

Le Formulaire serait responsable de ses champs, défauts, erreurs et validation
globale. S’il est accueilli comme contenu foreign, son montage, son cycle de
vie et sa publication de valeurs doivent être définis par le raccord étudié
pour les composants externes. La validation aboutit au même contexte et à
l’admission Sighty, sans autre routeur ni autre propriétaire de profil. La
forme des données et de leur transmission est une décision à relire avant code.

Les composants `input` et le trajet
[Perso.emit](../../codplay/specs/perso-emit-v2-spec.md) fournissent les bases
de saisie. La valeur d’un contrôle est déjà transportée sur le parcours testé
de sélection. Cette preuve ne certifie pas encore toute la collecte texte,
nombre, choix et défauts de la page Profil ; l’acceptation doit suivre
`saisie → événement → validation globale → contexte → admission du parcours`.

Le modèle de propriétés doit être indépendant de l’affichage dans la page
Profil. Une propriété peut être cachée de cette page et alimentée plus tard
par évaluation. Les contraintes et étiquettes conservent les mêmes références
stables. La préparation des qualifications doit permettre ce futur amendement
du contexte sans réaliser maintenant le moteur de plages de résultats.

## Étiquettes et projection de texte

La [Section](../specs/section-editor-spec.md) conserve conjointement son JSON
Tiptap et son HTML exporté par la commande `bdc.section.update`. Les autres
champs de contenu sont principalement des chaînes. L’étiquette doit rester
une référence de propriété dans les données auteur ; la substitution appartient
à la projection de lecture.

La proposition est une résolution commune des références, avec un raccord
structuré au JSON Tiptap et un raccord aux champs textuels simples. Leur
représentation sérialisée est à choisir dans le plan. Une substitution globale
par expression régulière dans le HTML n’établirait ni l’identité des références,
ni la préservation des ancres et enrichissements.

Le service existant
[html-content-service](../../codplay/src/services/content/html-content-service.ts)
applique les chaînes avec `textContent`. Il fournit une voie de présentation
textuelle pour les valeurs de profil. Une substitution faite dans du markup
de Section doit préserver ce sens textuel et les éléments de mise en forme.
Elle ne doit jamais enregistrer le pseudo du lecteur à la place de l’étiquette
dans le document auteur.

La signature du cache et la projection des titres du menu et de la page doivent
suivre les valeurs réellement utilisées. Renommer une propriété ou un choix
doit conserver les références ; leur suppression alors qu’ils sont utilisés
demande une politique de diagnostic ou de refus à fixer au plan.

## Persistance et restitution

Sighty expose le contexte courant et accepte un contexte initial. Il ne
propose pas un format persistant du parcours complet. La responsabilité
revient à Elcé, selon le
[contrat Sighty](../../sighty/specs/authoring-library-spec.md).

Les données candidates à conserver sont les valeurs de profil, les pages
achevées, les réponses validées et les états métier nécessaires des tentatives.
Les horloges, instances, montages et journaux internes ne sont pas des données
utilisateur à sérialiser. La restitution devra restaurer à la fois les
décisions d’accès et la sélection visible des contrôles.

Les résultats de test sont précaires. Une modification des seuls libellés
d’une Question conserve sa réponse. Si les choix, leur identité ou la correction
changent, invalider seulement la réponse incompatible et ses résultats
dépendants. L’application de cette invalidation doit actualiser les gardes et
les contrôles, sans réinitialisation générale du test.

`createRecordQuestionResult` stocke un booléen par page dans `questionResults`.
Pour un chapitre Évaluation, `evaluationStates` conserve aussi les choix via
la machine métier. Le booléen seul d’un Quiz ordinaire ne permet pas de
retrouver les réponses sélectionnées. L’événement existant les transporte
déjà : le point de collecte est identifié, sans lecture du DOM ni extraction
du journal.

Le builder Question possède actuellement des actions de sélection, validation
et reset, mais pas de contrat dédié de restitution d’une réponse validée.
Il faut le définir avant de déclarer la reprise persistante complète. Restaurer
le contexte Sighty tout en affichant des contrôles vierges serait une
intégration incomplète ; rejouer une validation utilisateur pour les remplir
pourrait publier une seconde fois son résultat.

L’[API des projets](../specs/project-api-spec.md) et
[ProjectPersistence](../src/server/projects/project-persistence.ts) traitent
le document, les médias et le droit d’édition. Ils n’offrent pas de contrat de
stockage utilisateur. Le serveur, le routeur et les migrations existants sont
à réutiliser ; les données de consultation ont toutefois besoin d’une
frontière distincte de la sauvegarde du document.

Le [protocole popup](../src/app/player/popup-preview-messages.ts) transporte
actuellement le document et la page sélectionnée, pas l’utilisateur de test.
La modale auteur et le lecteur devront échanger son état par ce raccord ou
par une source persistante explicitement définie. Les deux fenêtres ne doivent
pas posséder des copies modifiables concurrentes du même état de consultation.

La preview réseau actuelle est autorisée en lecture seulement. La persistance
depuis ce lecteur et le mode anonyme autonome restent à définir si leur
extension est retenue ; le test auteur persistant ne justifie pas d’ouvrir
implicitement les écritures réseau existantes.

## Chemins de validation à porter au plan

| Frontière | Preuve attendue |
| --- | --- |
| Sommaire externe | Montage dans le slot, mise à jour active/verrou, clic admis ou refusé par Sighty, retour, défilement, colonnes, focus et destruction sans écouteurs survivants. |
| Profil | Texte, nombre et choix ; champs obligatoires, défaut, absence ; une validation globale, sans score, suivie de l’entrée dans le parcours retenu. |
| Filtrage | BDC racines et ancrés, conteneurs, page et chapitre vides, ordre retenu, précédent général et dépendance explicite ; document auteur intact. |
| Évaluation | Questions exclues absentes du calcul, réponses retenues, score réel et admission de l’issue avec les mêmes gardes que le menu. |
| Étiquettes | Référence stable après renommage, texte absent, caractères spéciaux, formatage Tiptap et ancres conservés ; cache et titres actualisés. |
| Restitution | Fermer et rouvrir : même profil, progression, accès et choix affichés ; les deux RAZ préservent l’autre catégorie ; reconfiguration sans perte indue. |

Les tests doivent posséder leurs propres documents et valeurs. Les preuves
d’intégration doivent employer le vrai scénario, le player et le materializer,
puis couvrir Play, Seek, relecture, reset, resize et cycle de vie selon la
frontière concernée. Les vérifications navigateur resteront nécessaires avant
certification ; l’étude seule ne les remplace pas.
