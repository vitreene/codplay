# Elcé — preview mobile sur le réseau local

**Statut : En cours.** Le mode réseau, le lecteur autonome et les vérifications
Brave sont appliqués. Il reste à confirmer l’accès depuis un téléphone réel.

## Objectif

Lire sur un téléphone le document Elcé en cours d’édition, dans le lecteur
Sighty/CodPlay déjà utilisé par la preview.

## Décisions acceptées

- La preview ouvre la dernière version du projet confirmée par la synchronisation
  serveur. Un rechargement de l’URL relit la version la plus récente.
- L’URL identifie le document et la page de départ choisie dans l’éditeur.
- Le lecteur autonome ne montre ni titre de contexte, ni barre de synchronisation,
  ni commandes propres à l’éditeur. Il occupe l’écran disponible ; le sommaire
  et la navigation propres au lecteur Sighty/CodPlay restent utilisables.
- La machine sert le lecteur et son API en mode réseau local opt-in ; les ports
  applicatifs restent `5175` et `5181`. Le lancement normal conserve les adresses
  de boucle locale. Aucun serveur sur `5173` n’est lancé ni modifié.
- L’accès réseau est en lecture seule : le lecteur peut charger le document et
  ses médias confirmés, sans lister, créer, modifier ou supprimer des projets.
  L’éditeur reste destiné à l’usage local.
- Le lien est produit depuis l’action de preview existante ; le stockage local du
  navigateur éditeur n’est pas transféré au téléphone.

## Travail et acceptation

1. [x] Le mode de lancement choisit l’adresse IPv4 privée active, garde les
   ports `5175` et `5181` et fournit les origines réseau à Remix.
2. [x] L’action Preview ouvre l’identifiant du document et la page sélectionnée ;
   le lecteur autonome relit le document et ses médias depuis le serveur.
3. [x] Les clients réseau ne peuvent pas lister ni modifier les projets ;
   l’éditeur reste inaccessible sur l’origine LAN.
4. [x] Brave vérifie la route LAN en émulation mobile à 390 × 844, le chargement
   des médias et du document à la révision 10, ainsi que les refus API `403`.
   [ ] Confirmer depuis un téléphone réel connecté au même réseau ; garder deux
   pages Brave au plus et ne pas lancer Firefox.
5. [x] Les spécifications `player-preview`, `project-api` et `remix-spa`
   reflètent le comportement vérifié. Le plan reste ouvert jusqu’à l’essai sur
   téléphone.

## Invariants

- Le document du serveur reste la seule source lue par le téléphone ; aucun
  second document ni canal de synchronisation parallèle n’est créé.
- La navigation et les gardes restent ceux de la composition Sighty/CodPlay.
- Le lecteur n’obtient aucun droit d’écriture sur le projet.
- Les modifications non encore confirmées au serveur ne sont pas présentées
  comme faisant partie de la preview mobile.
