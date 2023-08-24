# Bespoke script that checks usage of a directory at a specified level

# Check if the reports folder already exists and create one if not

$reportsFolderPath = "C:\Usage Report"

if (Test-Path -path $reportsFolderPath -PathType Container) {
    # Write-Host "The directory c\Usage Reports alread exists"
} else {
        # Write-Host "Created the directory C:\Usage Reports"
        New-Item -ItemType Directory -path "c:\Usage Reports" | Out-Null
}

# Get the paths
#$directoryPath = Read-Host "Enter the directory path to check"
$directoryPath = "C:\Users\jason\Beyond Networks\Engineering - General"
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
Write-Host "`nScript done. The reports will open, if they dont they can be found: C:\Usage Reports." -ForegroundColor White -BackgroundColor Black

# Open the reports

# invoke-item "c:\usage report\CurrentReport.txt"
# invoke-item "c:\usage report\OppositeReport.txt"

$openCurrentReport = "c:\usage report\CurrentReport.txt"
$openOppositeReport = "c:\usage report\OppositeReport.txt"
Start-Process -FilePath "notepad.exe" -ArgumentList $openCurrentReport
Start-Process -FilePath "notepad.exe" -ArgumentList $openOppositeReport

# Delay window close

$delaySeconds = 10
Start-Sleep -Seconds $delaySeconds

# Jason Mcdill