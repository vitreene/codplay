ALTER TABLE quiz_hunt_settings
ADD COLUMN authoring_grid_debug INTEGER NOT NULL DEFAULT 0 CHECK (authoring_grid_debug IN (0, 1));
