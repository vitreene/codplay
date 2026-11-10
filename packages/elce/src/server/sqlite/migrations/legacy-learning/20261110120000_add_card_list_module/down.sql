ALTER TABLE cards DROP COLUMN list_json;

UPDATE projects
SET format_version = 14
WHERE mod_key = 'learning' AND format_version = 15;
