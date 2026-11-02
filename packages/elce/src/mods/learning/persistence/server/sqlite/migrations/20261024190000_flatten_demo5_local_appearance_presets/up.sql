UPDATE projects
SET revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id = 'demo5-elce-comparison'
  AND format_version = 6
  AND (
    EXISTS (
      SELECT 1
      FROM pages
      WHERE pages.project_id = projects.project_id
        AND json_extract(pages.appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate')
    )
    OR EXISTS (
      SELECT 1
      FROM content_blocks
      WHERE content_blocks.project_id = projects.project_id
        AND json_extract(content_blocks.appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate')
    )
  );

UPDATE pages
SET appearance_json = json_remove(
  json_set(
    appearance_json,
    '$.paletteId', COALESCE(
      json_extract(appearance_json, '$.paletteId'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'classic'
        WHEN 'ocean' THEN 'ocean'
        WHEN 'forest' THEN 'forest'
        WHEN 'plum' THEN 'plum'
        WHEN 'slate' THEN 'slate'
      END
    ),
    '$.typographyPairId', COALESCE(
      json_extract(appearance_json, '$.typographyPairId'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'crimson-dm-sans'
        WHEN 'ocean' THEN 'inter-krub'
        WHEN 'forest' THEN 'nunito-pt-sans'
        WHEN 'plum' THEN 'raleway-merriweather'
        WHEN 'slate' THEN 'instrument-sans-geist'
      END
    ),
    '$.density', COALESCE(
      json_extract(appearance_json, '$.density'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'normal'
        WHEN 'ocean' THEN 'normal'
        WHEN 'forest' THEN 'large'
        WHEN 'plum' THEN 'normal'
        WHEN 'slate' THEN 'compact'
      END
    )
  ),
  '$.presetId'
)
WHERE project_id = 'demo5-elce-comparison'
  AND json_extract(appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate');

UPDATE content_blocks
SET appearance_json = json_remove(
  json_set(
    appearance_json,
    '$.paletteId', COALESCE(
      json_extract(appearance_json, '$.paletteId'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'classic'
        WHEN 'ocean' THEN 'ocean'
        WHEN 'forest' THEN 'forest'
        WHEN 'plum' THEN 'plum'
        WHEN 'slate' THEN 'slate'
      END
    ),
    '$.typographyPairId', COALESCE(
      json_extract(appearance_json, '$.typographyPairId'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'crimson-dm-sans'
        WHEN 'ocean' THEN 'inter-krub'
        WHEN 'forest' THEN 'nunito-pt-sans'
        WHEN 'plum' THEN 'raleway-merriweather'
        WHEN 'slate' THEN 'instrument-sans-geist'
      END
    ),
    '$.density', COALESCE(
      json_extract(appearance_json, '$.density'),
      CASE json_extract(appearance_json, '$.presetId')
        WHEN 'classic' THEN 'normal'
        WHEN 'ocean' THEN 'normal'
        WHEN 'forest' THEN 'large'
        WHEN 'plum' THEN 'normal'
        WHEN 'slate' THEN 'compact'
      END
    )
  ),
  '$.presetId'
)
WHERE project_id = 'demo5-elce-comparison'
  AND json_extract(appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate');
