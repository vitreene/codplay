UPDATE projects
SET summary_json = json_set(summary_json, '$.pageContinuationMode', 'endpage')
WHERE json_type(summary_json, '$.pageContinuationMode') IS NULL;
