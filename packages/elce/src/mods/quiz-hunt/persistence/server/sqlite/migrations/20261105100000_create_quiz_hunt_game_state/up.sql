CREATE TABLE quiz_hunt_game_state (
  project_id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL CHECK (seed >= 0 AND seed <= 4294967295),
  state_json TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);
