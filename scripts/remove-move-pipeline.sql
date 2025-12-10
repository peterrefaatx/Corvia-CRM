-- Remove move_pipeline from pipeline permissions in all positions
UPDATE positions
SET "permissionSet" = "permissionSet" #- '{pipeline,move_pipeline}'
WHERE "permissionSet"->'pipeline' ? 'move_pipeline';
