ALTER TABLE cards ADD COLUMN list_json TEXT;

UPDATE projects
SET format_version = 15
WHERE mod_key = 'learning' AND format_version = 14;
