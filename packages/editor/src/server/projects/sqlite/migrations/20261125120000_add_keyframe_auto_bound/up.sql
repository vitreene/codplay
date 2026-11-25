ALTER TABLE keyframes ADD COLUMN auto_bound TEXT CHECK (auto_bound IN ('intro', 'outro'));
