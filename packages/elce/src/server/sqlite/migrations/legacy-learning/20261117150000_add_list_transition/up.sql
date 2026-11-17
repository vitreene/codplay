UPDATE list_bdcs
SET content_json = json_set(content_json, '$.transition', 'fade')
WHERE json_valid(content_json)
  AND json_type(content_json, '$.transition') IS NULL;
