ALTER TABLE items ADD COLUMN rotation_mode TEXT CHECK (rotation_mode IN ('manual', 'tangent'));
