# HTML runtime helpers

> Status: En cours
> CodPlay version: V2 foundation

This folder contains small HTML substrate guards shared by runtime runner
modules. `isMeasurableHtmlElement` is the single guard for the element geometry
surface used by layout snapshots and motion presentation. The folder does not
own layout policy, pointer event decoding, or matrix parsing; those contracts
remain beside their materialization and motion owners.
