CREATE TABLE list_bdcs (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

UPDATE projects
SET format_version = 16
WHERE mod_key = 'learning' AND format_version = 15;
