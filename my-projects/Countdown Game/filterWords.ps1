param (
    $filePath = ".\words.txt",
    $outputPath = ".\words-filtered.txt"
)

$count = 0
Clear-Host

$words = Get-Content $filePath
$filteredWords = @()

$totalWords = $words.Count

foreach ($word in $words) {
    if ($word -notmatch '\d' -and $word.Length -gt 3 -and $word -notlike '*-*' -and $word -notlike '*.' -and $word.Substring(1) -notmatch '[A-Z]') {
        $filteredWords += $word
    }
    $count++
    $percent = [math]::Round(($count / $totalWords) * 100, 2)
    Write-Host "Processing words: $percent%" -NoNewline -ForegroundColor Green
    Write-Host "`r" -NoNewline
}

$filteredWords | Set-Content $outputPath
Write-Host ""

# Jason Mcdill