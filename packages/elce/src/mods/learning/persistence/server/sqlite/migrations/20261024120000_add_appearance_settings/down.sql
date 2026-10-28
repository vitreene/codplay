UPDATE projects
SET format_version = 5,
    revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id = 'demo5-elce-comparison' AND format_version = 6;

ALTER TABLE content_blocks DROP COLUMN appearance_json;
ALTER TABLE pages DROP COLUMN appearance_json;
ALTER TABLE projects DROP COLUMN appearance_json;
