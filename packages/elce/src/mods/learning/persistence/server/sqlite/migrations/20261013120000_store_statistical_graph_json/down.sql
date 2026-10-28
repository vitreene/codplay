CREATE TABLE statistical_graphs_relational (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  rendering TEXT NOT NULL,
  overline TEXT,
  title TEXT,
  category_axis_label TEXT,
  series_axis_label TEXT,
  editorial_text TEXT,
  pie_series_id TEXT,
  column_labels_enabled INTEGER NOT NULL DEFAULT 1 CHECK (column_labels_enabled IN (0, 1)),
  row_labels_enabled INTEGER NOT NULL DEFAULT 1 CHECK (row_labels_enabled IN (0, 1)),
  transpose_enabled INTEGER NOT NULL DEFAULT 1 CHECK (transpose_enabled IN (0, 1)),
  pie_category_id TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

INSERT INTO statistical_graphs_relational (
  project_id, content_block_id, rendering, overline, title,
  category_axis_label, series_axis_label, editorial_text, pie_series_id,
  column_labels_enabled, row_labels_enabled, transpose_enabled, pie_category_id
)
SELECT
  project_id,
  content_block_id,
  json_extract(content_json, '$.rendering'),
  json_extract(content_json, '$.overline'),
  json_extract(content_json, '$.title'),
  json_extract(content_json, '$.categoryAxisLabel'),
  json_extract(content_json, '$.seriesAxisLabel'),
  json_extract(content_json, '$.editorialText'),
  json_extract(content_json, '$.pieSeriesId'),
  COALESCE(json_extract(content_json, '$.columnLabelsEnabled'), 1),
  COALESCE(json_extract(content_json, '$.rowLabelsEnabled'), 1),
  COALESCE(json_extract(content_json, '$.transposeEnabled'), 1),
  json_extract(content_json, '$.pieCategoryId')
FROM statistical_graphs;

CREATE TABLE graph_categories (
  project_id TEXT NOT NULL,
  graph_content_block_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT,
  PRIMARY KEY (project_id, graph_content_block_id, category_id),
  UNIQUE (project_id, graph_content_block_id, position),
  FOREIGN KEY (project_id, graph_content_block_id)
    REFERENCES statistical_graphs_relational(project_id, content_block_id) ON DELETE CASCADE
);

INSERT INTO graph_categories (
  project_id, graph_content_block_id, category_id, position, label
)
SELECT
  graph.project_id,
  graph.content_block_id,
  json_extract(category.value, '$.id'),
  CAST(category.key AS INTEGER),
  json_extract(category.value, '$.label')
FROM statistical_graphs AS graph,
  json_each(graph.content_json, '$.categories') AS category;

CREATE TABLE graph_series (
  project_id TEXT NOT NULL,
  graph_content_block_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT,
  PRIMARY KEY (project_id, graph_content_block_id, series_id),
  UNIQUE (project_id, graph_content_block_id, position),
  FOREIGN KEY (project_id, graph_content_block_id)
    REFERENCES statistical_graphs_relational(project_id, content_block_id) ON DELETE CASCADE
);

INSERT INTO graph_series (
  project_id, graph_content_block_id, series_id, position, label
)
SELECT
  graph.project_id,
  graph.content_block_id,
  json_extract(series.value, '$.id'),
  CAST(series.key AS INTEGER),
  json_extract(series.value, '$.label')
FROM statistical_graphs AS graph,
  json_each(graph.content_json, '$.series') AS series;

CREATE TABLE graph_values (
  project_id TEXT NOT NULL,
  graph_content_block_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (project_id, graph_content_block_id, category_id, series_id),
  FOREIGN KEY (project_id, graph_content_block_id, category_id)
    REFERENCES graph_categories(project_id, graph_content_block_id, category_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, graph_content_block_id, series_id)
    REFERENCES graph_series(project_id, graph_content_block_id, series_id) ON DELETE CASCADE
);

INSERT INTO graph_values (
  project_id, graph_content_block_id, category_id, series_id, value
)
SELECT
  graph.project_id,
  graph.content_block_id,
  json_extract(value.value, '$.categoryId'),
  json_extract(value.value, '$.seriesId'),
  json_extract(value.value, '$.value')
FROM statistical_graphs AS graph,
  json_each(graph.content_json, '$.values') AS value;

DROP TABLE statistical_graphs;
ALTER TABLE statistical_graphs_relational RENAME TO statistical_graphs;
