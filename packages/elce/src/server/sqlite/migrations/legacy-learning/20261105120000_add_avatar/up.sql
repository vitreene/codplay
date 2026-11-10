CREATE TABLE avatars (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_json TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

ALTER TABLE content_block_placements ADD COLUMN cue_json TEXT;

UPDATE projects SET format_version = 11 WHERE format_version = 10;
