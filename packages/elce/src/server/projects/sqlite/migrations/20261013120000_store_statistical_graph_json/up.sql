CREATE TABLE statistical_graphs_json (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

INSERT INTO statistical_graphs_json (project_id, content_block_id, content_json)
SELECT
  graph.project_id,
  graph.content_block_id,
  json_object(
    'rendering', graph.rendering,
    'transposeEnabled', json(CASE WHEN COALESCE(graph.transpose_enabled, 1) = 0 THEN 'false' ELSE 'true' END),
    'columnLabelsEnabled', json(CASE WHEN COALESCE(graph.column_labels_enabled, 1) = 0 THEN 'false' ELSE 'true' END),
    'rowLabelsEnabled', json(CASE WHEN COALESCE(graph.row_labels_enabled, 1) = 0 THEN 'false' ELSE 'true' END),
    'overline', COALESCE(graph.overline, ''),
    'title', COALESCE(graph.title, ''),
    'categoryAxisLabel', COALESCE(graph.category_axis_label, ''),
    'seriesAxisLabel', COALESCE(graph.series_axis_label, ''),
    'editorialText', COALESCE(graph.editorial_text, ''),
    'pieSeriesId', graph.pie_series_id,
    'pieCategoryId', COALESCE(
      graph.pie_category_id,
      (
        SELECT category.category_id
        FROM graph_categories AS category
        WHERE category.project_id = graph.project_id
          AND category.graph_content_block_id = graph.content_block_id
        ORDER BY category.position
        LIMIT 1
      )
    ),
    'categories', json(COALESCE(
      (
        SELECT json_group_array(
          json_object('id', category.category_id, 'label', COALESCE(category.label, ''))
          ORDER BY category.position
        )
        FROM graph_categories AS category
        WHERE category.project_id = graph.project_id
          AND category.graph_content_block_id = graph.content_block_id
      ),
      '[]'
    )),
    'series', json(COALESCE(
      (
        SELECT json_group_array(
          json_object('id', series.series_id, 'label', COALESCE(series.label, ''))
          ORDER BY series.position
        )
        FROM graph_series AS series
        WHERE series.project_id = graph.project_id
          AND series.graph_content_block_id = graph.content_block_id
      ),
      '[]'
    )),
    'values', json(COALESCE(
      (
        SELECT json_group_array(
          json_object(
            'categoryId', value.category_id,
            'seriesId', value.series_id,
            'value', value.value
          )
          ORDER BY category.position, series.position
        )
        FROM graph_values AS value
        JOIN graph_categories AS category
          ON category.project_id = value.project_id
          AND category.graph_content_block_id = value.graph_content_block_id
          AND category.category_id = value.category_id
        JOIN graph_series AS series
          ON series.project_id = value.project_id
          AND series.graph_content_block_id = value.graph_content_block_id
          AND series.series_id = value.series_id
        WHERE value.project_id = graph.project_id
          AND value.graph_content_block_id = graph.content_block_id
      ),
      '[]'
    ))
  )
FROM statistical_graphs AS graph;

DROP TABLE graph_values;
DROP TABLE graph_series;
DROP TABLE graph_categories;
DROP TABLE statistical_graphs;

ALTER TABLE statistical_graphs_json RENAME TO statistical_graphs;
