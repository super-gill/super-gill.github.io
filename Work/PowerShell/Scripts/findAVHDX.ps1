# Searches all available ntfs directories for avhdx
# Returns location and number found
# Returns drive capacity

# Get all disks
$disks = Get-Disk
$drives = @()

# Gather all drive letters for NTFS partitions
foreach ($disk in $disks) {
    $partitions = Get-Partition -DiskNumber $disk.Number
    
    foreach ($partition in $partitions) {
        # If drive letter is a single capital letter between A and Z
        if ($partition.DriveLetter -match '^[A-Z]$') {
            $fsType = (Get-Volume -DriveLetter $partition.DriveLetter).FileSystem
            if ($fsType -eq 'NTFS') {
                Write-Output "Drive Letter: $($partition.DriveLetter)"
                $drives += $partition.DriveLetter
            }
        }
    }
}

# Initialize counters
$totalFilesFound = 0
$filesFound = @()

# Search for .avhdx files in all NTFS drives
foreach ($drive in $drives) {
    [string]$dir = "$($drive):\"
    [string]$fileType = "avhdx"
    
    $files = Get-ChildItem -Path $dir -Filter "*.$fileType" -Recurse -ErrorAction SilentlyContinue
    $count = $files.Count
    $totalFilesFound += $count
    $filesFound += $files

    # Get drive capacity information
    $driveInfo = Get-Volume -DriveLetter $drive
    $capacity = [math]::Round($driveInfo.Size / 1GB, 2)
    $freeSpace = [math]::Round($driveInfo.SizeRemaining / 1GB, 2)

    Write-Output "Drive $drive - Total Capacity: $capacity GB, Free Space: $freeSpace GB"
    Write-Output "Number of .avhdx files found on $($drive): $($count)"
    Write-Output ""
}

# Output total results
Write-Output "Total number of .avhdx files found: $totalFilesFound"

# List all found files
if ($totalFilesFound -gt 0) {
    Write-Output "List of all found .avhdx files:"
    $filesFound | ForEach-Object { Write-Output $_.FullName }
} else {
    Write-Output "No .avhdx files found on any drive."
}

