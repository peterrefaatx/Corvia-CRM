-- Setup Test Workflow
-- This creates a clean testing environment for the pipeline workflow

-- Step 1: Clear existing test data
DELETE FROM "Task" WHERE "status" IN ('pending', 'completed');
DELETE FROM "Notification" WHERE "type" IN ('task_assigned', 'stage_complete');

-- Step 2: Move a few leads to "Attempting Contact" for testing
UPDATE "Lead"
SET "pipelineStage" = 'Attempting Contact',
    "lastUpdated" = NOW()
WHERE id IN (
  SELECT id FROM "Lead"
  WHERE "pipelineStage" IS NOT NULL
  LIMIT 5
);

-- Step 3: Verify automation rules exist
SELECT 
  id,
  "pipelineStage",
  "isActive",
  "ruleConfig"
FROM "PipelineAutomationRule"
WHERE "isActive" = true
ORDER BY "pipelineStage";

-- Step 4: Verify team members with positions exist
SELECT 
  id,
  name,
  "positionTitle",
  status
FROM "ClientTeamMember"
WHERE status = 'active'
ORDER BY "positionTitle";

-- Step 5: Show leads ready for testing
SELECT 
  id,
  "serialNumber",
  "homeownerFirst",
  "homeownerLast",
  "pipelineStage",
  "lastUpdated"
FROM "Lead"
WHERE "pipelineStage" = 'Attempting Contact'
ORDER BY "lastUpdated" DESC
LIMIT 10;

-- Instructions:
-- 1. Run this script to prepare test environment
-- 2. Go to pipeline view
-- 3. Move a lead to "Contacted" stage
-- 4. Watch automation create task
-- 5. Team member completes task
-- 6. See green checkmark appear
-- 7. Get notification "Lead ready to progress"
-- 8. Move to next stage!
