-- Remove communication permissions section from all positions
-- These permissions are now available to everyone by default
UPDATE positions
SET "permissionSet" = "permissionSet" - 'communication'
WHERE "permissionSet" ? 'communication';
