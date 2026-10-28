CREATE TABLE editor_scenes (
  scene_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  duration_source TEXT NOT NULL,
  time_unit TEXT NOT NULL,
  capsule_order TEXT NOT NULL,
  scene_state_json TEXT,
  hooks_json TEXT,
  root_capsule_json TEXT,
  root_decor_id TEXT,
  master_item_id TEXT,
  marker_tracks_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE media_resources (
  media_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  content_sha256 TEXT,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE contents (
  scene_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  source TEXT,
  media_id TEXT,
  text TEXT,
  text_auto_size_json TEXT,
  lang TEXT,
  waveform_json TEXT,
  cues_json TEXT,
  PRIMARY KEY (scene_id, content_id),
  FOREIGN KEY (scene_id) REFERENCES editor_scenes(scene_id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media_resources(media_id) ON DELETE RESTRICT
);

CREATE INDEX contents_media_lookup
  ON contents(media_id)
  WHERE media_id IS NOT NULL;

CREATE TABLE decors (
  scene_id TEXT NOT NULL,
  decor_id TEXT NOT NULL,
  decor_json TEXT NOT NULL,
  PRIMARY KEY (scene_id, decor_id),
  FOREIGN KEY (scene_id) REFERENCES editor_scenes(scene_id) ON DELETE CASCADE
);

CREATE TABLE items (
  scene_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  scene_ordinal INTEGER NOT NULL CHECK (scene_ordinal >= 0),
  item_type TEXT NOT NULL,
  label TEXT,
  visible INTEGER NOT NULL CHECK (visible IN (0, 1)),
  content_id TEXT,
  initial_decor_id TEXT NOT NULL,
  PRIMARY KEY (scene_id, item_id),
  UNIQUE (scene_id, scene_ordinal),
  FOREIGN KEY (scene_id) REFERENCES editor_scenes(scene_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, content_id) REFERENCES contents(scene_id, content_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (scene_id, initial_decor_id) REFERENCES decors(scene_id, decor_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE capsules (
  scene_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  distribution_json TEXT NOT NULL,
  grid_json TEXT,
  default_transition_in TEXT,
  default_transition_out TEXT,
  behavior TEXT,
  PRIMARY KEY (scene_id, item_id),
  FOREIGN KEY (scene_id, item_id) REFERENCES items(scene_id, item_id) ON DELETE CASCADE
);

CREATE TABLE capsule_items (
  scene_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  parent_capsule_id TEXT,
  order_key TEXT NOT NULL,
  PRIMARY KEY (scene_id, item_id),
  FOREIGN KEY (scene_id, item_id) REFERENCES items(scene_id, item_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, parent_capsule_id) REFERENCES capsules(scene_id, item_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX capsule_items_root_order
  ON capsule_items(scene_id, order_key)
  WHERE parent_capsule_id IS NULL;

CREATE UNIQUE INDEX capsule_items_child_order
  ON capsule_items(scene_id, parent_capsule_id, order_key)
  WHERE parent_capsule_id IS NOT NULL;

CREATE TABLE keyframes (
  scene_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  keyframe_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  time_ms REAL NOT NULL,
  channel TEXT,
  decor_id TEXT NOT NULL,
  transition_in_json TEXT,
  transition_out_json TEXT,
  name TEXT,
  marker_id TEXT,
  PRIMARY KEY (scene_id, item_id, keyframe_id),
  UNIQUE (scene_id, item_id, ordinal),
  FOREIGN KEY (scene_id, item_id) REFERENCES items(scene_id, item_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, decor_id) REFERENCES decors(scene_id, decor_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE zones (
  scene_id TEXT NOT NULL,
  capsule_id TEXT,
  zone_id TEXT NOT NULL,
  name TEXT NOT NULL,
  landscape_row INTEGER NOT NULL,
  landscape_col INTEGER NOT NULL,
  landscape_row_span INTEGER NOT NULL,
  landscape_col_span INTEGER NOT NULL,
  portrait_row INTEGER NOT NULL,
  portrait_col INTEGER NOT NULL,
  portrait_row_span INTEGER NOT NULL,
  portrait_col_span INTEGER NOT NULL,
  container_json TEXT,
  PRIMARY KEY (scene_id, zone_id),
  FOREIGN KEY (scene_id) REFERENCES editor_scenes(scene_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_id, capsule_id) REFERENCES capsules(scene_id, item_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (landscape_row >= 1 AND landscape_col >= 1),
  CHECK (landscape_row_span >= 1 AND landscape_col_span >= 1),
  CHECK (portrait_row >= 1 AND portrait_col >= 1),
  CHECK (portrait_row_span >= 1 AND portrait_col_span >= 1)
);

CREATE INDEX zones_capsule_lookup
  ON zones(scene_id, capsule_id);

CREATE TABLE editor_state (
  state_id INTEGER PRIMARY KEY CHECK (state_id = 1),
  active_scene_id TEXT,
  FOREIGN KEY (active_scene_id) REFERENCES editor_scenes(scene_id) ON DELETE SET NULL
);
