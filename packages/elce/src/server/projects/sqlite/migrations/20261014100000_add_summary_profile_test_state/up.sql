ALTER TABLE projects
  ADD COLUMN summary_json TEXT NOT NULL DEFAULT '{"title":"Sommaire","description":"","backgroundMediaId":null,"showInMenu":true,"showAtRoot":false,"displayMode":"pages","permanentAccess":false,"endChapterDestination":"next"}';

ALTER TABLE projects
  ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{"properties":[],"fieldPropertyIds":[],"constraints":[],"readingConstraints":[]}';

CREATE TABLE project_test_states (
  project_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);
