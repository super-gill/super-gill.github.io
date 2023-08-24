# Function to recursively find the most recently edited file within a folder
function Get-MostRecentlyEditedFile {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FolderPath
    )

    $latestFile = $null
    $latestDate = [DateTime]::MinValue

    Get-ChildItem -Path $FolderPath -Recurse -File | ForEach-Object {
        $fileDate = $_.LastWriteTime
        if ($fileDate -gt $latestDate) {
            $latestFile = $_
            $latestDate = $fileDate
        }
    }

    return $latestFile
}

# List of project directories
$projectDirectories = @(
    "P:\projects\competition",
    "P:\projects\discrimination",
    "P:\projects\finlit",
    "P:\projects\securities"
)

# Create a report string
$report = "Subfolder Report:`n`n"

# Iterate over each project directory
foreach ($directory in $projectDirectories) {
    $report += "Project Directory: $directory`n"

    # Get subfolders within the project directory
    $subfolders = Get-ChildItem -Path $directory -Directory

    # Iterate over each subfolder
    foreach ($subfolder in $subfolders) {
        $latestFile = Get-MostRecentlyEditedFile -FolderPath $subfolder.FullName

        if ($latestFile) {
            $report += "Subfolder: $($subfolder.Name)`tLast Edited: $($latestFile.LastWriteTime)`n"
        }
    }

    $report += "`n"
}

# Save the report to a CSV file
$reportPath = "C:\temp\SubfolderReport.csv"
$reportData | Export-Csv -Path $reportPath -NoTypeInformation

# Open the CSV file
Invoke-Item -Path $reportPath

# Display completion message
Write-Host "Report generation completed. The report file has been saved and opened."


# Display completion message
Write-Host "Report generation completed. The report file has been saved and opened."
