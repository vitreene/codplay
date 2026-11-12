CREATE TABLE quiz_hunt_settings (
  project_id TEXT PRIMARY KEY,
  menu_presentation TEXT NOT NULL CHECK (menu_presentation IN ('grid', 'diapo')),
  success_card_bdc_id TEXT NOT NULL,
  failure_card_bdc_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  random INTEGER NOT NULL CHECK (random IN (0, 1)),
  time_budget_ms INTEGER NOT NULL,
  clue_delay_ms INTEGER NOT NULL,
  feedback_delay_ms INTEGER NOT NULL,
  extra_enabled INTEGER NOT NULL CHECK (extra_enabled IN (0, 1)),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE quiz_hunt_groups (
  project_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (project_id, group_id),
  UNIQUE (project_id, position),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE quiz_hunt_page_options (
  project_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  color_id TEXT,
  mandatory INTEGER NOT NULL CHECK (mandatory IN (0, 1)),
  PRIMARY KEY (project_id, page_id),
  FOREIGN KEY (project_id, page_id)
    REFERENCES pages(project_id, page_id) ON DELETE CASCADE
);
