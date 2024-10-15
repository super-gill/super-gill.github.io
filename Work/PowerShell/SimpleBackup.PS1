param (
    [string]$sourcePath,
    [string]$destinationPath,
    [int]$versionsToKeep
)

# Check if the source and dest exist
if (not(test-path $sourcePath)) {
    Write-Host "Source path not found: $($sourcePath)" -ForegroundColor Red
    return
}

