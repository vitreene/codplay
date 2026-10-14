ALTER TABLE statistical_graphs
  ADD COLUMN transpose_enabled INTEGER NOT NULL DEFAULT 1 CHECK (transpose_enabled IN (0, 1));

ALTER TABLE statistical_graphs
  ADD COLUMN pie_category_id TEXT;
