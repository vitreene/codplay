UPDATE projects
SET summary_json = json_remove(summary_json, '$.pageContinuationMode');
