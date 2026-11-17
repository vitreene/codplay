INSERT INTO list_bdcs (project_id, content_block_id, content_json)
SELECT child.project_id, child.content_block_id, parent_card.list_json
FROM content_blocks AS child
JOIN content_block_placements AS placement
  ON placement.project_id = child.project_id
  AND placement.content_block_id = child.content_block_id
JOIN cards AS parent_card
  ON parent_card.project_id = placement.project_id
  AND parent_card.content_block_id = placement.parent_content_block_id
WHERE child.content_block_type = 'list'
  AND parent_card.list_json IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM list_bdcs AS detail
    WHERE detail.project_id = child.project_id
      AND detail.content_block_id = child.content_block_id
  );
