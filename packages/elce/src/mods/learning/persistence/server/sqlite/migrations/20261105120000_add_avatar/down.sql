ALTER TABLE content_block_placements DROP COLUMN cue_json;
DROP TABLE avatars;
UPDATE projects SET format_version = 10 WHERE format_version = 11;
