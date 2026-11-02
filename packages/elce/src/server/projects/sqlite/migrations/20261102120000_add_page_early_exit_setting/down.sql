UPDATE projects
SET format_version = 8
WHERE format_version = 9;

ALTER TABLE pages DROP COLUMN allow_early_exit;
