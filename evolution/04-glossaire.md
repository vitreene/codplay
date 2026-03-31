# Glossaire (francais simple)

## Scene

Le conteneur principal. Regroupe stories, pistes et regles de scenario.

## Story

Bloc narratif autonome. Peut etre joue, masque, stoppe, instancie.

## Instance

Copie runtime d'une story. A son propre etat et ses propres IDs.

## Perso

Element rendu (texte, image, video, html, module 3D, etc.) avec actions et emits.

## List

Type de perso conteneur. Gere des enfants ordonnes et peut auto-animer `add/remove/move`.

## Strap

Composant logique sans rendu direct. Produit des donnees dans le temps.

## Playable

Objet pilotable par les commandes de lecture (`play`, `pause`, `seek`, `rewind`).
Une story et un media sont des playables.

## Eventime

Evenement date en ms, pouvant contenir des sous-evenements relatifs.

## Event plat

Version runtime d'un eventime, avec temps absolu et ordre stable.

## Piste (track)

Couche d'evenements activable/desactivable (langue, user, system, etc.).

## Bus d'events

Canal de diffusion: un event peut etre ecoute par plusieurs cibles.

## Transition

Evolution animee d'un etat vers un autre (position, opacite, classe, etc.).

## Transition derivee

Transition generee automatiquement a partir d'une action (ex: FLIP).

## Plugin

Module branche sur le pipeline pour enrichir des side-effects.

## NodeRef

Reference opaque du node rendu, exposee a l'editeur pour inspection/outils.

## Runtime revision

Version numerique du runtime. Incrementee sur `rebuild=full`.

## Legacy input

Ancien format d'entree player (`persos` + `eventtimes`).

## Convertisseur legacy

Outil externe qui transforme un `Legacy input` en `SceneDoc` V1.

## Rejeu

Relancer la scene en rejouant les events (base + user enregistres).

## Determinisme

Meme donnees d'entree => meme deroulement et meme resultat.

## Mode player

Mode execution normal, leger, peu verbeux.

## Mode debug

Mode analyse avec traces detaillees des ticks, events et transitions.

## Machine d'etat

Modele qui decrit quels etats sont possibles et quelles transitions sont autorisees selon un event.

## Trace machine

Journal ordonne des transitions appliquees ou refusees (`from`, `event`, `to`) pour expliquer le comportement runtime.
