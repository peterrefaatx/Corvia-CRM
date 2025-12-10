-- Clear Pipeline for Testing
-- This script removes leads from pipeline stages so you can test the workflow fresh

-- OPTION 1: Move all leads back to "Attempting Contact" (soft reset)
UPDATE "Lead"
SET "pipelineStage" = 'Attempting Contact',
    "lastUpdated" = NOW()
WHERE "pipelineStage" IS NOT NULL
  AND "pipelineStage" != 'Closed'
  AND "pipelineStage" != 'Dead';

-- OPTION 2: Delete all tasks (to test automation from scratch)
DELETE FROM "Task"
WHERE "status" = 'pending';

-- OPTION 3: Delete all completed tasks (clean slate)
DELETE FROM "Task"
WHERE "status" = 'completed';

-- OPTION 4: Delete ALL tasks (complete reset)
-- DELETE FROM "Task";

-- OPTION 5: Clear all automation rules (if you want to recreate them)
-- DELETE FROM "PipelineAutomationRule";

-- OPTION 6: Clear all notifications
DELETE FROM "Notification"
WHERE "type" IN ('task_assigned', 'stage_complete');

-- View current pipeline distribution
SELECT 
  "pipelineStage",
  COUNT(*) as lead_count
FROM "Lead"
WHERE "pipelineStage" IS NOT NULL
GROUP BY "pipelineStage"
ORDER BY lead_count DESC;

-- View current tasks
SELECT 
  t.id,
  t.title,
  t.status,
  l."serialNumber",
  l."homeownerFirst",
  l."homeownerLast",
  l."pipelineStage"
FROM "Task" t
JOIN "Lead" l ON t."leadId" = l.id
ORDER BY t."createdAt" DESC
LIMIT 20;
