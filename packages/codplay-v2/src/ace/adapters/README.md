# ACE Adapters

> Status: En cours
> CodPlay version: V2 foundation

This folder contains pure adapters from author-facing CSS-style values and
operations to ACE intermediate forms.

They do not read the DOM, convert render units, or project values to a target.

They run before ACE preparation. ACE resolution receives prepared values and must
not repeat author-syntax validation on its hot path.
