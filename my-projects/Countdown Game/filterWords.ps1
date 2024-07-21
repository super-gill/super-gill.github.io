$filePath = ".\words.txt"
$count = 0

$words = Get-Content $filePath
$filteredWords = @()

foreach ($word in $words) {
    if ($word -notmatch '\d' -and $word.Length -gt 3 -and $word -notlike '*-*' -and $word -notlike '*.') {
        $filteredWords += $word
    }
    $count++
    Write-Host "Processing word count: $count" -NoNewline -ForegroundColor Green
    Write-Host "`r" -NoNewline
}

$filteredWords | Set-Content ".\words-filtered.txt"
Write-Host ""
