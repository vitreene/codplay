# Text advanced - pre-spec

## Statut

Note de pre-specification pour l'evolution du composant `text`.

## Intention

Le composant `text` V1 couvre le texte simple. La prochaine etape doit couvrir des usages narratifs plus riches:

- texte enrichi
- micro-animations typographiques
- paragraphes et textes longs
- transitions de texte avec persistance temporaire de l'ancien contenu

## Objectifs fonctionnels

Le composant avance devra:

1. accepter du texte enrichi (structure inline/block)
2. permettre des micro-animations (mot/lettre)
3. accepter paragraphes et longs textes
4. supporter une transition de texte ou l'ancien texte persiste pendant la transition

## Positionnement V1 -> V2

- `text` V1 reste la brique minimale
- `text advanced` est une evolution indispensable du type `text` (pas un nouveau type)
- pour une granularite de controle tres fine (items multiples, orchestration complexe), `list` reste l'outil cible

## Perimetre pre-spec

Cette note cadre:

- le besoin metier
- le perimetre technique probable
- les choix a arbitrer avant spec normative

Cette note ne fixe pas encore:

- le schema final de donnees
- le contrat runtime final
- le comportement animation final exact

## Capacites candidates

## 1) Texte enrichi

Capacite visee:

- support inline (emphase, lien, span style)
- support block (paragraphes, sauts, blocs)
- format canonique runtime en JSON structure

Contraintes:

- rendu deterministic
- pas d'execution HTML arbitraire
- sanitization stricte en contexte DOM
- s'appuyer sur une spec existante et un module specialise (pas de format maison)

Entree auteur:

- l'interface auteur permet la saisie riche
- la saisie est convertie vers le format JSON canonique

## 2) Micro-animations

Capacite visee:

- split par mots
- split par lettres
- animations stagger et presets simples

Contraintes:

- respecter accessibilite (lecture continue possible)
- limiter le cout runtime sur textes longs
- activer les micro-animations uniquement sur textes de longueur limitee

Definition de travail:

- une micro-animation est une animation d'un contenu pour lequel l'auteur n'a acces qu'a des proprietes pre-definies

Note Unicode:

- support emoji requis en priorite
- segmentation grapheme a activer au minimum sur cas emoji

## 3) Paragraphes et longs textes

Capacite visee:

- contenu long multi-paragraphes dans un composant unique
- mode "fine control" externalisable vers `list` quand necessaire

Strategie d'affichage candidate:

- texte court: possibilite d'adapter la taille du texte au conteneur
- texte long: reduction de taille jusqu'a une limite basse
- au-dela de la limite basse: activation d'un scrolling texte

Contraintes:

- politique perf claire (seuils, degradation)
- structure stable pour replay/rebuild

## 4) Transition de texte (old/new)

Capacite visee:

- un update de texte peut declencher une transition
- le texte precedent persiste le temps de la transition
- swap final explicite vers le texte courant

Positionnement:

- la transition old/new est traitee dans le cadre des micro-animations

Regles validees:

- une micro-transition capture l'etat initial des positions au moment exact de son demarrage
- la transition va de cet etat initial capture vers son etat final cible
- une nouvelle transition interrompt immediatement la transition en cours
- la nouvelle transition repart depuis l'etat courant (au moment de l'interruption)

Contraintes:

- pas de clignotement
- coherence avec `eventSeq` et l'ordre canonique
- gestion claire des updates concurrents pendant une transition

## Modele de rendu (hypothese)

Une structure a 2 couches est envisagee:

- layer `current`
- layer `outgoing` (temporaire pendant transition)

Flux cible:

1. recevoir `nextText`
2. copier `current` -> `outgoing`
3. appliquer `nextText` sur `current`
4. animer `outgoing/current`
5. detruire `outgoing` a la fin

## Liaison avec le contrat composant base

- reste sur `constructor/init/render/update`
- `update` continue a recevoir une action agregee unique
- warnings dedoublonnes par `eventSeq`
- `emit` continue a suivre `17-user-events-emit-v1.md`

## Risques techniques identifies

- split lettre: gestion unicode (emoji, accents combines, ligatures)
- textes longs: inflation DOM si split agressif
- transition old/new: collisions si plusieurs updates consecutifs rapides
- interop avec transitions style existantes (`style.to`) et FLIP eventuel

## Pistes de mitigation

- segmentation sur graphemes (pas seulement `string.split('')`)
- policies perf par preset (`author` vs `user`)
- appliquer une politique d'interruption immediate avec reprise depuis etat courant
- mode fallback texte simple pour degradations

## Decisions a prendre avant spec normative

1. Choix de la spec/module de texte riche utilise comme socle (standard externe)
2. Niveau d'animation natif (mot/lettre/ligne)
3. Regles perf et seuils de degradation
4. Strategie precise d'adaptation texte court vs texte long (seuils, limite basse, scrolling)

## Questions de cadrage

1. Pour le texte enrichi, quel socle standard veux-tu privilegier (spec + module) ?
2. En micro-animation, niveau natif V1:
   - mot
   - lettre
   - mot + lettre
3. Pour les longs textes, confirmer les seuils de policy:
   - seuil texte court (adaptation auto)
   - taille minimale avant scrolling
   - policy de scrolling (auto / user-driven)

## Preset candidat adapte de l'exemple fourni

Preset micro-animation candidate: `zoom-in-stagger`.

Comportement cible:

- split texte en unites animees (lettres/graphemes selon policy)
- chaque unite demarre avec `scale(0)` et `opacity: 0`
- animation vers `scale(1)` et `opacity: 1`
- delai progressif par index (`stagger`)

Regles runtime:

- ce preset reste interne au composant + librairie animation
- aucune emission d'event public
- en cas de relance pendant animation, interruption immediate puis relance depuis etat courant
- pilotage temporel aligne runtime (`Ticker`/frame scheduler), sans timers legacy

## Frontiere micro-interactions

Regle de cadrage:

- les micro-interactions ne generent pas d'events publics
- elles concernent uniquement le composant et la librairie d'animation

## Shortlist spec + module (preparee)

### Option A - Portable Text (recommande si priorite "spec externe")

Socle:

- spec ouverte Portable Text (JSON structure)
- module d'edition/rendu dedie

Points forts:

- format JSON canonique deja standardise
- independant du framework
- modele block/inline propre pour paragraphes et contenus longs

Points de vigilance:

- ecosysteme animation plus limite que ProseMirror/Tiptap
- necessite un mapping clair vers les micro-animations (mot/lettre)

### Option B - ProseMirror schema + Tiptap (recommande si priorite "ecosysteme")

Socle:

- schema ProseMirror (document JSON structure)
- edition via Tiptap (wrapper mature)

Points forts:

- ecosysteme riche et stable
- schema strict et validable
- bon support de conversion auteur -> JSON canonique

Points de vigilance:

- moins "spec independante" que Portable Text
- gouvernance du schema a fixer pour eviter la derive

### Option C - Lexical editor state

Socle:

- etat JSON Lexical + plugins Lexical

Points forts:

- bonnes perfs edition
- modele moderne pour interactions riches

Points de vigilance:

- format davantage lie au moteur Lexical
- portabilite inter-outils plus faible

## Recommendation pre-spec

- si contrainte principale = "spec externe + pas de format maison": Option A (Portable Text)
- si contrainte principale = "integration rapide + ecosysteme mature": Option B (ProseMirror + Tiptap)

Dans les deux cas:

- conserver un sous-ensemble V1 ferme (paragraph, text, strong, em, link, lineBreak)
- convertir l'entree auteur vers un JSON canonique unique avant runtime

## Lien spec micro-animations

- `21-text-micro-animations-v1.md` formalise le contrat micro-animations (preset, interruption, transport animation)
