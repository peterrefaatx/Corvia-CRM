# Reset Pipeline for Testing
# Quick script to clear pipeline and prepare for workflow testing

Write-Host "🧹 Resetting Pipeline for Testing..." -ForegroundColor Cyan
Write-Host ""

# Get database connection from .env
$envFile = Get-Content ".env" -ErrorAction SilentlyContinue
$databaseUrl = ($envFile | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "DATABASE_URL=", ""

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL not found in .env file" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Choose an option:" -ForegroundColor Yellow
Write-Host "1. Soft Reset - Move all leads to 'Attempting Contact' (recommended)"
Write-Host "2. Clear Tasks - Delete all pending tasks"
Write-Host "3. Clear Completed Tasks - Delete completed tasks only"
Write-Host "4. Full Reset - Delete ALL tasks (clean slate)"
Write-Host "5. Setup Test Environment - Prepare 5 leads for testing"
Write-Host ""

$choice = Read-Host "Enter choice (1-5)"

switch ($choice) {
    "1" {
        Write-Host "🔄 Moving all leads to 'Attempting Contact'..." -ForegroundColor Cyan
        $sql = @"
UPDATE "Lead"
SET "pipelineStage" = 'Attempting Contact',
    "lastUpdated" = NOW()
WHERE "pipelineStage" IS NOT NULL
  AND "pipelineStage" != 'Closed'
  AND "pipelineStage" != 'Dead';
"@
    }
    "2" {
        Write-Host "🗑️  Deleting pending tasks..." -ForegroundColor Cyan
        $sql = 'DELETE FROM "Task" WHERE "status" = ''pending'';'
    }
    "3" {
        Write-Host "🗑️  Deleting completed tasks..." -ForegroundColor Cyan
        $sql = 'DELETE FROM "Task" WHERE "status" = ''completed'';'
    }
    "4" {
        Write-Host "⚠️  Deleting ALL tasks..." -ForegroundColor Red
        $sql = 'DELETE FROM "Task";'
    }
    "5" {
        Write-Host "🎯 Setting up test environment..." -ForegroundColor Cyan
        $sql = Get-Content "scripts/setup-test-workflow.sql" -Raw
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

# Execute SQL using psql (if available) or npx prisma db execute
try {
    # Try using Prisma
    Write-Host "Executing SQL..." -ForegroundColor Gray
    $sql | npx prisma db execute --stdin
    
    Write-Host ""
    Write-Host "✅ Pipeline reset complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Go to your pipeline view"
    Write-Host "2. Move a lead to 'Contacted' stage"
    Write-Host "3. Watch the magic happen! ✨"
    Write-Host ""
} catch {
    Write-Host "❌ Error executing SQL: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Try running the SQL manually:" -ForegroundColor Yellow
    Write-Host "   npx prisma studio"
    Write-Host "   Or use: scripts/clear-pipeline-for-testing.sql"
}
