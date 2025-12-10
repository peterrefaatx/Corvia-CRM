function Clean-FileAggressive {
    param($filePath)
    
    $content = Get-Content $filePath -Raw
    if (-not $content) { return 0 }
    
    $lines = $content -split "`r?`n"
    $newLines = @()
    $inJSDoc = $false
    $removed = 0
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        
        if ($line -match '^\s*/\*\*') {
            $inJSDoc = $true
            $newLines += $line
            continue
        }
        
        if ($inJSDoc -and $line -match '\*/') {
            $inJSDoc = $false
            $newLines += $line
            continue
        }
        
        if ($inJSDoc) {
            $newLines += $line
            continue
        }
        
        if ($line -match '^\s*//') {
            $removed++
            continue
        }
        
        if ($line -match '^\s*/\*' -and $line -notmatch '^\s*/\*\*') {
            $removed++
            while ($i -lt $lines.Count -and $lines[$i] -notmatch '\*/') {
                $i++
                $removed++
            }
            continue
        }
        
        if ($line -match '(.+?)\s*//.*$') {
            $codePart = $Matches[1].TrimEnd()
            if ($codePart -notmatch '[''"].*//.*[''"]') {
                $newLines += $codePart
                $removed++
                continue
            }
        }
        
        $newLines += $line
    }
    
    if ($removed -gt 0) {
        $newContent = $newLines -join "`n"
        Set-Content $filePath $newContent -NoNewline
    }
    
    return $removed
}

$totalRemoved = 0
$filesProcessed = 0

Write-Host ""
Write-Host "Aggressive Comment Cleanup" -ForegroundColor Cyan
Write-Host "============================================================"
Write-Host "Keeping ONLY JSDoc comments" -ForegroundColor Yellow
Write-Host "============================================================"

Write-Host ""
Write-Host "Processing Backend..." -ForegroundColor Yellow
$backendFiles = Get-ChildItem -Path "backend/src" -Include "*.ts","*.js" -Recurse -File
foreach ($file in $backendFiles) {
    $removed = Clean-FileAggressive $file.FullName
    if ($removed -gt 0) {
        Write-Host "  OK $($file.Name): $removed comments removed" -ForegroundColor Green
        $totalRemoved += $removed
        $filesProcessed++
    }
}

Write-Host ""
Write-Host "Processing Frontend..." -ForegroundColor Yellow
$frontendFiles = Get-ChildItem -Path "frontend/src" -Include "*.ts","*.tsx","*.js","*.jsx" -Recurse -File
foreach ($file in $frontendFiles) {
    $removed = Clean-FileAggressive $file.FullName
    if ($removed -gt 0) {
        Write-Host "  OK $($file.Name): $removed comments removed" -ForegroundColor Green
        $totalRemoved += $removed
        $filesProcessed++
    }
}

Write-Host ""
Write-Host "============================================================"
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Files processed: $filesProcessed" -ForegroundColor Green
Write-Host "  Comments removed: $totalRemoved" -ForegroundColor Green
Write-Host ""
Write-Host "Kept: JSDoc comments only" -ForegroundColor Yellow
Write-Host "Removed: All other comments" -ForegroundColor Red
Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host ""
