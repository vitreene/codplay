UPDATE pages
SET appearance_json = CASE
  WHEN json_extract(appearance_json, '$.paletteId') = 'classic'
    AND json_extract(appearance_json, '$.typographyPairId') = 'crimson-dm-sans'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'classic')
  WHEN json_extract(appearance_json, '$.paletteId') = 'ocean'
    AND json_extract(appearance_json, '$.typographyPairId') = 'inter-krub'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'ocean')
  WHEN json_extract(appearance_json, '$.paletteId') = 'forest'
    AND json_extract(appearance_json, '$.typographyPairId') = 'nunito-pt-sans'
    AND json_extract(appearance_json, '$.density') = 'large'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'forest')
  WHEN json_extract(appearance_json, '$.paletteId') = 'plum'
    AND json_extract(appearance_json, '$.typographyPairId') = 'raleway-merriweather'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'plum')
  WHEN json_extract(appearance_json, '$.paletteId') = 'slate'
    AND json_extract(appearance_json, '$.typographyPairId') = 'instrument-sans-geist'
    AND json_extract(appearance_json, '$.density') = 'compact'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'slate')
  ELSE appearance_json
END
WHERE project_id = 'demo5-elce-comparison'
  AND json_type(appearance_json, '$.presetId') IS NULL;

UPDATE content_blocks
SET appearance_json = CASE
  WHEN json_extract(appearance_json, '$.paletteId') = 'classic'
    AND json_extract(appearance_json, '$.typographyPairId') = 'crimson-dm-sans'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'classic')
  WHEN json_extract(appearance_json, '$.paletteId') = 'ocean'
    AND json_extract(appearance_json, '$.typographyPairId') = 'inter-krub'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'ocean')
  WHEN json_extract(appearance_json, '$.paletteId') = 'forest'
    AND json_extract(appearance_json, '$.typographyPairId') = 'nunito-pt-sans'
    AND json_extract(appearance_json, '$.density') = 'large'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'forest')
  WHEN json_extract(appearance_json, '$.paletteId') = 'plum'
    AND json_extract(appearance_json, '$.typographyPairId') = 'raleway-merriweather'
    AND json_extract(appearance_json, '$.density') = 'normal'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'plum')
  WHEN json_extract(appearance_json, '$.paletteId') = 'slate'
    AND json_extract(appearance_json, '$.typographyPairId') = 'instrument-sans-geist'
    AND json_extract(appearance_json, '$.density') = 'compact'
    THEN json_set(json_remove(appearance_json, '$.paletteId', '$.typographyPairId', '$.density'), '$.presetId', 'slate')
  ELSE appearance_json
END
WHERE project_id = 'demo5-elce-comparison'
  AND json_type(appearance_json, '$.presetId') IS NULL;

UPDATE projects
SET revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE project_id = 'demo5-elce-comparison'
  AND format_version = 6
  AND (
    EXISTS (
      SELECT 1 FROM pages
      WHERE pages.project_id = projects.project_id
        AND json_extract(pages.appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate')
    )
    OR EXISTS (
      SELECT 1 FROM content_blocks
      WHERE content_blocks.project_id = projects.project_id
        AND json_extract(content_blocks.appearance_json, '$.presetId') IN ('classic', 'ocean', 'forest', 'plum', 'slate')
    )
  );
