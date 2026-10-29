UPDATE projects
SET revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id = 'demo5-elce-comparison'
  AND format_version = 6;

UPDATE projects
SET appearance_json = CASE json_extract(appearance_json, '$.typographyPairId')
  WHEN 'crimson-dm-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'crimson-text', '$.bodyFontId', 'dm-sans')
  WHEN 'inter-krub' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'inter', '$.bodyFontId', 'krub')
  WHEN 'montserrat-karla' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'montserrat', '$.bodyFontId', 'karla')
  WHEN 'nunito-pt-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'nunito', '$.bodyFontId', 'pt-sans')
  WHEN 'raleway-merriweather' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'raleway', '$.bodyFontId', 'merriweather')
  WHEN 'instrument-sans-geist' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'instrument-sans', '$.bodyFontId', 'geist')
  WHEN 'philosopher-mulish' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'philosopher', '$.bodyFontId', 'mulish')
  WHEN 'bubblegum-sans-open-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'bubblegum-sans', '$.bodyFontId', 'open-sans')
  ELSE json_remove(appearance_json, '$.typographyPairId')
END
WHERE project_id = 'demo5-elce-comparison'
  AND appearance_json IS NOT NULL;

UPDATE projects
SET appearance_json = json_set(json_remove(appearance_json, '$.background'), '$.density', 'none')
WHERE project_id = 'demo5-elce-comparison'
  AND json_extract(appearance_json, '$.background.kind') = 'transparent';

UPDATE pages
SET appearance_json = CASE json_extract(appearance_json, '$.typographyPairId')
  WHEN 'crimson-dm-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'crimson-text', '$.bodyFontId', 'dm-sans')
  WHEN 'inter-krub' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'inter', '$.bodyFontId', 'krub')
  WHEN 'montserrat-karla' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'montserrat', '$.bodyFontId', 'karla')
  WHEN 'nunito-pt-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'nunito', '$.bodyFontId', 'pt-sans')
  WHEN 'raleway-merriweather' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'raleway', '$.bodyFontId', 'merriweather')
  WHEN 'instrument-sans-geist' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'instrument-sans', '$.bodyFontId', 'geist')
  WHEN 'philosopher-mulish' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'philosopher', '$.bodyFontId', 'mulish')
  WHEN 'bubblegum-sans-open-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'bubblegum-sans', '$.bodyFontId', 'open-sans')
  ELSE json_remove(appearance_json, '$.typographyPairId')
END
WHERE project_id = 'demo5-elce-comparison'
  AND appearance_json IS NOT NULL;

UPDATE pages
SET appearance_json = json_set(json_remove(appearance_json, '$.background'), '$.density', 'none')
WHERE project_id = 'demo5-elce-comparison'
  AND json_extract(appearance_json, '$.background.kind') = 'transparent';

UPDATE content_blocks
SET appearance_json = CASE json_extract(appearance_json, '$.typographyPairId')
  WHEN 'crimson-dm-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'crimson-text', '$.bodyFontId', 'dm-sans')
  WHEN 'inter-krub' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'inter', '$.bodyFontId', 'krub')
  WHEN 'montserrat-karla' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'montserrat', '$.bodyFontId', 'karla')
  WHEN 'nunito-pt-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'nunito', '$.bodyFontId', 'pt-sans')
  WHEN 'raleway-merriweather' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'raleway', '$.bodyFontId', 'merriweather')
  WHEN 'instrument-sans-geist' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'instrument-sans', '$.bodyFontId', 'geist')
  WHEN 'philosopher-mulish' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'philosopher', '$.bodyFontId', 'mulish')
  WHEN 'bubblegum-sans-open-sans' THEN json_set(json_remove(appearance_json, '$.typographyPairId'), '$.headingFontId', 'bubblegum-sans', '$.bodyFontId', 'open-sans')
  ELSE json_remove(appearance_json, '$.typographyPairId')
END
WHERE project_id = 'demo5-elce-comparison'
  AND appearance_json IS NOT NULL;

UPDATE content_blocks
SET appearance_json = json_set(json_remove(appearance_json, '$.background'), '$.density', 'none')
WHERE project_id = 'demo5-elce-comparison'
  AND json_extract(appearance_json, '$.background.kind') = 'transparent';

UPDATE projects
SET format_version = 7
WHERE project_id = 'demo5-elce-comparison'
  AND format_version = 6;
