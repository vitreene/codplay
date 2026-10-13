# Elcé — preview mobile sur le réseau local

**Statut : En cours.** Le contrat est accepté ; l’entrée réseau, le lecteur
autonome et sa validation restent à appliquer.

## Objectif

Lire sur un téléphone le document Elcé en cours d’édition, dans le lecteur
Sighty/CodPlay déjà utilisé par la preview.

## Décisions acceptées

- La preview ouvre la dernière version du projet confirmée par la synchronisation
  serveur. Un rechargement de l’URL relit la version la plus récente.
- L’URL identifie le document et la page de départ choisie dans l’éditeur.
- Le lecteur autonome ne montre ni titre de contexte, ni barre de synchronisation,
  ni commandes propres à l’éditeur. Il occupe l’écran disponible.
- La machine sert le lecteur et son API en mode réseau local opt-in ; les ports
  applicatifs restent `5175` et `5181`. Le lancement normal conserve les adresses
  de boucle locale. Aucun serveur sur `5173` n’est lancé ni modifié.
- L’accès réseau est en lecture seule : le lecteur peut charger le document et
  ses médias confirmés, sans lister, créer, modifier ou supprimer des projets.
  L’éditeur reste destiné à l’usage local.
- Le lien est produit depuis l’action de preview existante ; le stockage local du
  navigateur éditeur n’est pas transféré au téléphone.

## Travail et acceptation

1. Ajouter un mode de lancement réseau qui choisit l’adresse IPv4 active, garde
   les ports `5175` et `5181`, et fournit les origines publique de preview et
   d’API au document Remix.
2. Ouvrir depuis l’éditeur une route autonome portant l’identifiant du document
   et la page de départ. Elle lit le document serveur, emploie les URL de médias
   déjà servies par l’API et réutilise la composition de lecteur existante.
3. Réserver l’accès non local à cette route et aux lectures API nécessaires ;
   refuser les mutations réseau et ne pas rendre l’éditeur sur l’origine LAN.
4. Vérifier sur l’origine LAN que l’URL affiche la page choisie sans bandeau ni
   commandes, que les médias confirmés chargent, qu’un rechargement lit la
   dernière révision serveur et que l’API refuse les écritures réseau. Garder
   deux pages Brave au plus ; ne pas lancer Firefox.
5. Mettre à jour les spécifications `player-preview` et `remix-spa` uniquement
   après vérification du comportement. Mettre le présent plan à jour avec les
   preuves restantes.

## Invariants

- Le document du serveur reste la seule source lue par le téléphone ; aucun
  second document ni canal de synchronisation parallèle n’est créé.
- La navigation et les gardes restent ceux de la composition Sighty/CodPlay.
- Le lecteur n’obtient aucun droit d’écriture sur le projet.
- Les modifications non encore confirmées au serveur ne sont pas présentées
  comme faisant partie de la preview mobile.
