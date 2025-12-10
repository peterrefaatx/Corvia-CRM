-- Migration script to move mark_closed and mark_dead permissions from leads to pipeline
-- Run this script to update existing positions

-- This updates the permissionSet JSON field to move mark_closed and mark_dead
-- from leads section to pipeline section

UPDATE positions
SET "permissionSet" = jsonb_set(
  jsonb_set(
    "permissionSet",
    '{pipeline,mark_closed}',
    COALESCE("permissionSet"->'leads'->'mark_closed', 'false'::jsonb)
  ),
  '{pipeline,mark_dead}',
  COALESCE("permissionSet"->'leads'->'mark_dead', 'false'::jsonb)
)
WHERE "permissionSet" ? 'leads' 
  AND ("permissionSet"->'leads' ? 'mark_closed' OR "permissionSet"->'leads' ? 'mark_dead');

-- Remove mark_closed and mark_dead from leads section
UPDATE positions
SET "permissionSet" = "permissionSet" #- '{leads,mark_closed}' #- '{leads,mark_dead}'
WHERE "permissionSet"->'leads' ? 'mark_closed' OR "permissionSet"->'leads' ? 'mark_dead';

-- Also remove move_pipeline from leads if it exists
UPDATE positions
SET "permissionSet" = jsonb_set(
  "permissionSet" #- '{leads,move_pipeline}',
  '{pipeline,move_pipeline}',
  COALESCE("permissionSet"->'leads'->'move_pipeline', 'false'::jsonb)
)
WHERE "permissionSet"->'leads' ? 'move_pipeline';
