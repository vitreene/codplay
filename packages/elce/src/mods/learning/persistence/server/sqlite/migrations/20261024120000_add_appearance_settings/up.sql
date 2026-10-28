ALTER TABLE projects ADD COLUMN appearance_json TEXT;
ALTER TABLE pages ADD COLUMN appearance_json TEXT;
ALTER TABLE content_blocks ADD COLUMN appearance_json TEXT;

UPDATE projects
SET format_version = 6,
    revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id = 'demo5-elce-comparison' AND format_version = 5;
