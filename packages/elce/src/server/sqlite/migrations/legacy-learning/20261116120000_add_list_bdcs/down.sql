UPDATE projects
SET format_version = 15
WHERE mod_key = 'learning' AND format_version = 16;

DROP TABLE list_bdcs;
