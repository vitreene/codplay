ALTER TABLE cards
  ADD COLUMN intro_transition_ref TEXT;

ALTER TABLE cards
  ADD COLUMN outro_transition_ref TEXT;

UPDATE projects
SET format_version = 10
WHERE format_version = 9;
