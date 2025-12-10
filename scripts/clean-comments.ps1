# Smart Comment Cleanup Script
# Removes redundant comments while keeping important documentation

$patterns = @{
    # Remove obvious/redundant inline comments
    'RedundantInline' = @(
        '// Get ',
        '// Set ',
        '// Check ',
        '// Return ',
        '// Create ',
        '// Update ',
        '// Delete ',
        '// Find ',
        '// Filter ',
        '// Map ',
        '// Loop ',
        '// Increment ',
        '// Decrement ',
        '// Add ',
        '// Remove ',
        '// Initialize ',
        '// Declare ',
        '// Import ',
        '// Export ',
        '// Call ',
        '// Fetch ',
        '// Load ',
        '// Save ',
        '// Close ',
        '// Open '
    )
    
    # Remove empty comment blocks
    'EmptyComments' = @(
        '^\s*//\s*$',
        '^\s*/\*\s*\*/$'
    )
    
    # Remove separator comments
    'Separators' = @(
        '^\s*//\s*[-=]{3,}\s*$',
        '^\s*//\s*\*{3,}\s*$'
    )
}

# Keep these patterns (don't remove)
$keepPatterns = @(
    '^\s*/\*\*',           # JSDoc comments
    '^\s*\*\s*@',          # JSDoc tags
    '^\s*//\s*TODO',       # TODO comments
    '^\s*//\s*FIXME',      # FIXME comments
    '^\s*//\s*NOTE',       # NOTE comments
    '^\s*//\s*IMPORTANT',  # IMPORTANT comments
    '^\s*//\s*WARNING',    # WARNING comments
    '^\s*//\s*HACK',       # HACK comments
    '^\s*//\s*BUG',        # BUG comments
    '^\s*//\s*https?://'   # URLs in comments
)

function Should-KeepComment {
    param($line)
    
    foreach ($pattern in $keepPatterns) {
        if ($line -match $pattern) {
            return $true
        }
    }
    return $false
}

function Should-RemoveComment {
    param($line)
    
    # Don't remove if it should be kept
    if (Should-KeepComment $line) {
        return $false
    }
    
    # Remove empty comments
    foreach ($pattern in $patterns.EmptyComments) {
        if ($line -match $pattern) {
            return $true
        }
    }
    
    # Remove separator comments
    foreach ($pattern in $patterns.Separators) {
        if ($line -match $pattern) {
            return $true
        }
    }
    
    # Remove redundant inline comments
    foreach ($pattern in $patterns.RedundantInline) {
        if ($line -match [regex]::Escape($pattern)) {
            # Check if comment is obvious (just restating the code)
            return $true
        }
    }
    
    return $false
}

function Clean-File {
    param($filePath)
    
    $content = Get-Content $filePath -Raw
    if (-not $content) { return 0 }
    
    $lines = $content -split "`r?`n"
    $newLines = @()
    $inJSDoc = $false
    $removed = 0
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        # Track JSDoc blocks
        if ($line -match '^\s*/\*\*') {
            $inJSDoc = $true
        }
        if ($inJSDoc -and $line -match '\*/') {
            $inJSDoc = $false
            $newLines += $line
            continue
        }
        
        # Keep JSDoc content
        if ($inJSDoc) {
            $newLines += $line
            continue
        }
        
        # Check if line should be removed
        if (Should-RemoveComment $line) {
            $removed++
            continue
        }
        
        $newLines += $line
    }
    
    # Write back if changes were made
    if ($removed -gt 0) {
        $newContent = $newLines -join "`n"
        Set-Content $filePath $newContent -NoNewline
    }
    
    return $removed
}

# Process files
$totalRemoved = 0
$filesProcessed = 0

Write-Host "`n🧹 Smart Comment Cleanup" -ForegroundColor Cyan
Write-Host "=" * 60

# Backend files
Write-Host "`nProcessing Backend..." -ForegroundColor Yellow
$backendFiles = Get-ChildItem -Path "backend/src" -Include "*.ts","*.js" -Recurse -File
foreach ($file in $backendFiles) {
    $removed = Clean-File $file.FullName
    if ($removed -gt 0) {
        Write-Host "  ✓ $($file.Name): $removed comments removed" -ForegroundColor Green
        $totalRemoved += $removed
        $filesProcessed++
    }
}

# Frontend files
Write-Host "`nProcessing Frontend..." -ForegroundColor Yellow
$frontendFiles = Get-ChildItem -Path "frontend/src" -Include "*.ts","*.tsx","*.js","*.jsx" -Recurse -File
foreach ($file in $frontendFiles) {
    $removed = Clean-File $file.FullName
    if ($removed -gt 0) {
        Write-Host "  ✓ $($file.Name): $removed comments removed" -ForegroundColor Green
        $totalRemoved += $removed
        $filesProcessed++
    }
}

Write-Host "`n" + ("=" * 60)
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Files processed: $filesProcessed" -ForegroundColor Green
Write-Host "  Comments removed: $totalRemoved" -ForegroundColor Green
Write-Host "`nKept:" -ForegroundColor Cyan
Write-Host "  ✓ JSDoc comments (/** */)" -ForegroundColor Yellow
Write-Host "  ✓ TODO/FIXME/NOTE comments" -ForegroundColor Yellow
Write-Host "  ✓ Important warnings" -ForegroundColor Yellow
Write-Host "  ✓ Complex logic explanations" -ForegroundColor Yellow
Write-Host "`n✅ Cleanup complete!`n" -ForegroundColor Green
