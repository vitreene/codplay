CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format_version INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  default_intro_transition_ref TEXT NOT NULL,
  default_outro_transition_ref TEXT NOT NULL
);

CREATE TABLE chapters (
  project_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  chapter_type TEXT NOT NULL,
  evaluation_threshold REAL,
  evaluation_attempt_limit INTEGER,
  evaluation_retry_scope TEXT,
  PRIMARY KEY (project_id, chapter_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE pages (
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  page_type TEXT NOT NULL,
  PRIMARY KEY (project_id, page_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE scenario_entries (
  entry_row_id INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_chapter_id TEXT,
  page_id TEXT,
  chapter_id TEXT,
  position INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_chapter_id)
    REFERENCES chapters(project_id, chapter_id) ON DELETE NO ACTION,
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, chapter_id)
    REFERENCES chapters(project_id, chapter_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX scenario_root_order
  ON scenario_entries(project_id, position)
  WHERE parent_chapter_id IS NULL;
CREATE UNIQUE INDEX scenario_chapter_page_order
  ON scenario_entries(project_id, parent_chapter_id, position)
  WHERE parent_chapter_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_page_once
  ON scenario_entries(project_id, page_id)
  WHERE page_id IS NOT NULL;
CREATE UNIQUE INDEX scenario_chapter_once
  ON scenario_entries(project_id, chapter_id)
  WHERE chapter_id IS NOT NULL;

CREATE TABLE catalog_pages (
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, page_id),
  UNIQUE (project_id, position),
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE CASCADE
);

CREATE TABLE media_resources (
  project_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  media_caption TEXT,
  content_sha256 TEXT,
  storage_key TEXT,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, media_id),
  UNIQUE (project_id, position),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX media_storage_key
  ON media_resources(project_id, storage_key)
  WHERE storage_key IS NOT NULL;
CREATE UNIQUE INDEX media_content_identity
  ON media_resources(project_id, size_bytes, content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE content_blocks (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  content_block_type TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE content_block_placements (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  page_id TEXT,
  parent_content_block_id TEXT,
  position INTEGER,
  duration_ms INTEGER,
  intro_transition_ref TEXT,
  outro_transition_ref TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE NO ACTION,
  FOREIGN KEY (project_id, parent_content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX content_block_page_order
  ON content_block_placements(project_id, page_id, position)
  WHERE page_id IS NOT NULL;
CREATE UNIQUE INDEX content_block_catalog_order
  ON content_block_placements(project_id, position)
  WHERE page_id IS NULL AND parent_content_block_id IS NULL;
CREATE UNIQUE INDEX content_block_child_order
  ON content_block_placements(project_id, parent_content_block_id, position)
  WHERE parent_content_block_id IS NOT NULL;

CREATE TABLE sections (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  title TEXT,
  content_json TEXT NOT NULL,
  markup_html TEXT NOT NULL,
  default_intro_transition_ref TEXT,
  default_outro_transition_ref TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE questions (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  media_id TEXT,
  question_type TEXT NOT NULL,
  title TEXT,
  prompt TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, media_id)
    REFERENCES media_resources(project_id, media_id) ON DELETE RESTRICT
);

CREATE TABLE question_answers (
  project_id TEXT NOT NULL,
  question_content_block_id TEXT NOT NULL,
  answer_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  PRIMARY KEY (project_id, question_content_block_id, answer_id),
  UNIQUE (project_id, question_content_block_id, position),
  FOREIGN KEY (project_id, question_content_block_id)
    REFERENCES questions(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE evaluation_result_branches (
  project_id TEXT NOT NULL,
  result_content_block_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  message TEXT,
  action TEXT,
  PRIMARY KEY (project_id, result_content_block_id, branch),
  FOREIGN KEY (project_id, result_content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE carousels (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  default_view_duration_ms INTEGER NOT NULL,
  playback_mode TEXT NOT NULL,
  repeat_count INTEGER,
  aspect_ratio_width REAL NOT NULL,
  aspect_ratio_height REAL NOT NULL,
  default_intro_transition_ref TEXT,
  default_outro_transition_ref TEXT,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE
);

CREATE TABLE cards (
  project_id TEXT NOT NULL,
  content_block_id TEXT NOT NULL,
  media_id TEXT,
  overline TEXT,
  title TEXT,
  description TEXT,
  message TEXT,
  note TEXT,
  caption TEXT,
  image_position TEXT NOT NULL,
  image_fit TEXT NOT NULL,
  PRIMARY KEY (project_id, content_block_id),
  FOREIGN KEY (project_id, content_block_id)
    REFERENCES content_blocks(project_id, content_block_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, media_id)
    REFERENCES media_resources(project_id, media_id) ON DELETE RESTRICT
);
