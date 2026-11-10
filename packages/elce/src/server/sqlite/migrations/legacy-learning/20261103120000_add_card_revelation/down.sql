UPDATE projects
SET format_version = 9
WHERE format_version = 10;

ALTER TABLE cards DROP COLUMN outro_transition_ref;
ALTER TABLE cards DROP COLUMN intro_transition_ref;
