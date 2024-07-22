param (
    [string]$filePath = ".\words.txt",
    [string]$outputPath = ".\words-filtered.txt"
)

[int32]$count = 0
Clear-Host

[array]$words = Get-Content $filePath
[array]$filteredWords = @()

[int32]$totalWords = $words.Count

foreach ($word in $words) {
    if ($word -notmatch '\d' -and $word.Length -gt 3 -and $word -notlike '*-*' -and $word -notlike '*.' -and $word.Substring(1) -notmatch '[A-Z]') {
        [void]$filteredWords.Add($word)
    }
    $count++
    [int32]$percent = [math]::Round(($count / $totalWords) * 100, 2)
    Write-Host "Processing words: $percent%" -NoNewline -ForegroundColor Green
    Write-Host "`r" -NoNewline
}

$filteredWords | Set-Content $outputPath
Write-Host ""

# Jason Mcdill