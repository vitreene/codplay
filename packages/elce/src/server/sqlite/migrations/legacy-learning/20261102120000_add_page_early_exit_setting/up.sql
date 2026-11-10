ALTER TABLE pages
  ADD COLUMN allow_early_exit INTEGER CHECK (allow_early_exit IN (0, 1));

UPDATE projects
SET format_version = 9
WHERE format_version = 8;
