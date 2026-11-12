UPDATE projects
SET format_version = 12
WHERE mod_key = 'learning' AND format_version = 13;

ALTER TABLE projects
  DROP COLUMN custom_appearance_colors_json;
