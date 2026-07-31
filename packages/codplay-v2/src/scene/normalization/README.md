# Scene Normalization

> Status: En cours
> CodPlay version: V2 foundation

This module creates canonical scene data without mutating the authoring document.
It owns structural defaults only; component values are completed by their service
and capability contracts.

The canonical perso shape always contains the internal self-reference
`actions[perso.id] = null`. This is a reserved targeting entry, not an authored
action payload to reject.
