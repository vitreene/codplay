CREATE TABLE statistical_graphs (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  rendering TEXT NOT NULL,
  overline TEXT,
  title TEXT,
  category_axis_label TEXT,
  series_axis_label TEXT,
  editorial_text TEXT,
  pie_series_id TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE graph_categories (
  project_id TEXT NOT NULL,
  graph_content_block_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT,
  PRIMARY KEY (project_id, graph_content_block_id, category_id),
  UNIQUE (project_id, graph_content_block_id, position),
  FOREIGN KEY (project_id, graph_content_block_id)
    REFERENCES statistical_graphs(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE graph_series (
  project_id TEXT NOT NULL,
  graph_content_block_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT,
  PRIMARY KEY (project_id, graph_content_block_id, series_id),
  UNIQUE (project_id, graph_content_block_id, position),
  FOREIGN KEY (project_id, graph_content_block_id)
    REFERENCES statistical_graphs(project_id, content_block_id) ON DELETE CASCADE
);

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
