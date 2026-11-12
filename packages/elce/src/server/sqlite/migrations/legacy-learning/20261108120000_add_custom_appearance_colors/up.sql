ALTER TABLE projects
  ADD COLUMN custom_appearance_colors_json TEXT NOT NULL DEFAULT '[]';

UPDATE projects
SET format_version = 13
WHERE mod_key = 'learning' AND format_version = 12;
