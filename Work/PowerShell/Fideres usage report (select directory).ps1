$reportsFolderPath = "C:\Usage Report"

# Check if the reports folder already exists and create one if not
if (-not (Test-Path -path $reportsFolderPath -PathType Container)) {
    New-Item -ItemType Directory -path "c:\Usage Reports" | Out-Null
}

# Get the paths

Add-Type -AssemblyName System.Windows.Forms

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select a folder."
$dialog.RootFolder = [System.Environment+SpecialFolder]::Desktop

$result = $dialog.ShowDialog()


if ($result -eq 'OK') {
    $directoryPath = $dialog.SelectedPath
    Write-Host "Selected directory: $directoryPath"
} else {
    Write-Host "No directory selected."
}

$reportFolderPath = "C:\Usage Report"
$currentReportPath = Join-Path -Path $reportFolderPath -ChildPath "CurrentReport.txt"
$oppositeReportPath = Join-Path -Path $reportFolderPath -ChildPath "OppositeReport.txt"

# Do the math
$currentDate = Get-Date
$sixMonthsAgo = $currentDate.AddMonths(-6)

# Make storage for the output
$unmodifiedItems = @()

# Check the directory
Get-ChildItem -Path $directoryPath | ForEach-Object {
    $item = $_

    # Check if it's a file or folder
    if ($item.PSIsContainer) {
        # Check if the folder contains any items not modified within the last 6 months
        $unmodifiedItems += Get-ChildItem -Path $item.FullName | Where-Object { $_.LastWriteTime -lt $sixMonthsAgo }
    }
    elseif ($item.LastWriteTime -lt $sixMonthsAgo) {
        $unmodifiedItems += $item
    }
}

# Generate the current report and save it
$currentReportContent = "Unmodified items in $directoryPath (not edited within the last 6 months):`r`n`r`n"
$currentReportContent += $unmodifiedItems.FullName -join "`r`n"
$currentReportContent | Out-File -FilePath $currentReportPath

# Generate the opposite report and save it
$oppositeUnmodifiedItems = Get-ChildItem -Path $directoryPath | Where-Object { $_.LastWriteTime -ge $sixMonthsAgo }
$oppositeReportContent = "Modified items in $directoryPath (edited within the last 6 months):`r`n`r`n"
$oppositeReportContent += $oppositeUnmodifiedItems.FullName -join "`r`n"
$oppositeReportContent | Out-File -FilePath $oppositeReportPath

# Create the report folder if it doesn't exist
if (-not (Test-Path -Path $reportFolderPath)) {
    New-Item -ItemType Directory -Path $reportFolderPath | Out-Null
}

# Output to the terminal that I'm done
Write-Host "`nScript done. The reports will open, if they don't, they can be found at: C:\Usage Reports." -ForegroundColor White -BackgroundColor Black

# Open the reports

$openCurrentReport = "c:\usage report\CurrentReport.txt"
$openOppositeReport = "c:\usage report\OppositeReport.txt"
Start-Process -FilePath "notepad.exe" -ArgumentList $openCurrentReport
Start-Process -FilePath "notepad.exe" -ArgumentList $openOppositeReport

# Delay window close

$delaySeconds = 10
Start-Sleep -Seconds $delaySeconds

# Jason Mcdill
