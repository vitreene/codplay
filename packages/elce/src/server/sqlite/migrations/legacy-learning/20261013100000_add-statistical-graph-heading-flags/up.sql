ALTER TABLE statistical_graphs
  ADD COLUMN column_labels_enabled INTEGER NOT NULL DEFAULT 1 CHECK (column_labels_enabled IN (0, 1));

ALTER TABLE statistical_graphs
  ADD COLUMN row_labels_enabled INTEGER NOT NULL DEFAULT 1 CHECK (row_labels_enabled IN (0, 1));
