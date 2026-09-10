# Méta-orchestrateur — le framework au-dessus de codplay (préambule)

Page concept, **préambule** (2026-07-26). Ouvre un horizon **distinct de la V2 codplay** : la suite
logique de codplay, probablement un **framework** plutôt qu'une app. À détailler ultérieurement par
l'auteur — plusieurs situations en tête, pas encore posées. Cette page ne fait que **cadrer le
concept** pour que le détail vienne s'y accrocher. Aucun code, aucun engagement.

## D'où ça vient — l'exemple déclencheur

quiz-hunt + space-bubble : space-bubble pourrait être une **épreuve incorporée** à quiz-hunt à la place
d'une question (potentiellement 16 questions, dont certaines sont des scènes à part entière). Cet
exemple a révélé que ce besoin n'est **ni** un widget-dans-scène (build/factory) **ni** un segment
async — c'est de l'**orchestration multi-scènes**, un niveau **au-dessus** de codplay.

## Les trois niveaux à ne pas confondre

- **Q1 — widget dans scène** (résolu au *build*, factory `(variables)→SceneDoc`) : le widget est
  *fondu* dans une scène unique, un seul `CompiledScene`. Perd l'autonomie du widget. Ressort de la
  **scène**, pas du player. (Patron `scene-factory` existant ; enjeu = namespacing des ids.)
- **Q2 — segment async** (chargement différé d'un segment au runtime) : hors axe V2 sauf besoin avéré
  (scène lourde à streamer, contenu conditionnel/distant). Se range dans preload/segment, effet à
  side-effect hors chemin chaud.
- **Q3 — orchestration multi-scènes** (CE préambule) : chaque scène reste **entière et autonome** ; un
  **méta-orchestrateur** les pilote, les relaie, distribue lectures/interruptions. C'est le niveau
  au-dessus.

## Le principe cadre — le méta-orchestrateur est un CLIENT de codplay, pas une fonction de codplay

Ce que le méta-orchestrateur fait : **piloter plusieurs scènes simultanément**, **distribuer les
lectures/interruptions** (lancer quiz-hunt, suspendre, lancer space-bubble comme épreuve, récupérer un
résultat, reprendre), gérer le **flux entre scènes** — pas le contenu d'une scène.

C'est **précisément ce que codplay a décidé de ne PAS être.** Codplay joue **une** scène et *se laisse
piloter* (façade multi-canaux : telco + injection + observation ; « le player est conçu pour être
piloté »). Le méta-orchestrateur **est le pilote** — au-dessus du player, il en instancie plusieurs,
les commande via leurs canaux. Faire entrer cette orchestration *dans* codplay violerait la frontière
tracée en V2.

**Pourquoi c'est heureux (et non une limitation)** :
- **Autonomie préservée** : space-bubble reste réutilisable partout (épreuve de quiz-hunt, jouée seule,
  incorporée ailleurs) — ce que l'incorporation Q1 aurait détruit.
- **S'appuie sur des acquis V2 déjà posés**, aucun canal neuf : façade multi-canaux (piloter/paramétrer/
  observer), player pilotable, lecture de segment + chargement async si les scènes sont lourdes.
- **Frontière nette du périmètre codplay** : codplay = *un player pour une scène, pilotable* ; le
  multi-scène = couche d'orchestration **au-dessus**.

## La seule exigence que Q3 pose SUR codplay

Codplay ne résout pas l'orchestration, mais doit être **orchestrable proprement** — critère de qualité
de la façade multi-canaux, pas fonctionnalité neuve :
- instancier/détruire des players proprement (lifecycle net — N scènes montées/démontées) ;
- suspendre/reprendre (une scène en pause pendant qu'une autre joue) — `pause`/`resume` existent ;
- signal de **fin d'épreuve** + résultat (« space-bubble résolue, voici le score ») → canal observation
  + event de fin ;
- passer un **résultat entre scènes** (le score remonte à quiz-hunt) → injection externe.

Tout existe déjà dans la façade conçue. L'exigence = que cette façade soit **assez propre pour qu'un
orchestrateur pilote N instances**. Consommateur naturel de la pilotabilité telco (revue I/O §5).

## Statut

**Préambule — horizon distinct de la V2, pas un chantier.** À détailler par l'auteur (plusieurs
situations en tête). Probablement un **framework**, pas une app. Ne rien engager dans codplay à ce
titre au-delà de « garder la façade orchestrable ». Validation externe du cahier des charges V2 : comme
le portage Flutter, ce méta-niveau *confirme* la façade multi-canaux (il en est le consommateur type)
et la frontière « codplay joue une scène, ne pilote pas un ensemble ». Lié :
`../../codplay-v2/notes/2026-07-26-conduite-chantier-v2.md` (§6 façade, §10 #5 telco), `../../codplay-v2/notes/2026-07-26-etat-fonction-de-t.md`
(lecture de segment).
