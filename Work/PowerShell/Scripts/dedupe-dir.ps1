# Compares 2 directories and reports on duplicate names
# operate either from cli with parameters or leave the parameters empty for a ui
$appVersion = 1

param (
    [string]$dir1Path,
    [string]$dir2Path,
    [bool]$checkOnlyFolders
)

function pathValidation {
    param (
        $path
    )

    # Regex pattern to validate Windows directory path
    $regex = '^[a-zA-Z]:\\.*$'
    return $path -match $regex
}

function ShowHeader {
    Clear-Host
    Write-Host "##############################################################" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Discover duplicates in 2 directories" -ForegroundColor Yellow -NoNewline; Write-Host "                     #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-host "Written by Jason Prime" -ForegroundColor Yellow -NoNewline; Write-host "                                   #" -ForegroundColor Cyan
    Write-Host "#   " -ForegroundColor Cyan -NoNewline; Write-Host "Version $appVersion" -ForegroundColor Yellow -NoNewline; Write-Host "                                                #" -ForegroundColor Cyan
    Write-Host "#                                                            #" -ForegroundColor Cyan
    Write-Host "##############################################################" -ForegroundColor Cyan
    Write-Host ""
}

function extraInfo {
    Write-Host ""
    Write-Host "This module can be run from the CLI using parameters I.E.:" -ForegroundColor Green
    Write-Host ".\dedupe-dir.ps1 -dir1Path c:\temp -dir2Path c:\temp2 -checkOnlyFolders $false" -ForegroundColor Green
    Write-Host ""
}

function deDupe {
    param (
        [string]$dir1Path,
        [string]$dir2Path,
        [bool]$checkOnlyFolders
    )

    try {

        ShowHeader
        Write-Host ""
        Write-Host "Path 1: $dir1Path"
        Write-Host "Path 2: $dir2Path"
        Write-Host ""

        if ($dir1Path -eq $dir2Path) {
            Write-Host ""
            Write-Host "The target and reference directories are the same, the script" -ForegroundColor Red
            Write-Host "will still run. See above for details." -ForegroundColor Red
            Write-Host ""
        }

        if ($checkOnlyFolders) {

            # Get list of subfolders in each directory
            $subfolders1 = Get-ChildItem -Path $dir1Path -Directory | ForEach-Object { $_.FullName }
            $subfolders2 = Get-ChildItem -Path $dir2Path -Directory | ForEach-Object { $_.FullName }

        } else {
            # Get list of all child items in each directory
            $subfolders1 = Get-ChildItem -Path $dir1Path -Recurse | ForEach-Object { $_.FullName }
            $subfolders2 = Get-ChildItem -Path $dir2Path -Recurse | ForEach-Object { $_.FullName }
        }

            # Find duplicated folder names
            $duplicatedRootFolders = $subfolders1 | Where-Object { $_ -in $subfolders2 }

            if ($duplicatedRootFolders.Count -gt 0) {
                Write-Host ""
                Write-Host "Duplicates found:" -ForegroundColor Yellow
                Write-Host ""
                $duplicatedRootFolders | ForEach-Object {
                    Write-Host $_ -ForegroundColor Yellow
                    Write-Host ""
                }
            }
            else {
                Write-Host "No duplicates found" -ForegroundColor Green
                Write-Host ""
            }
    }
    catch { Write-Host "deDupe() failed with: "$_ }
}

function runScript {
    param (
        [string]$path1,
        [string]$path2,
        [bool]$checkOnlyFolders
    )

    ShowHeader
    extraInfo
    Write-Host ""

    function directoryOne {

        try {
            if (-not $path1) {
                $dir1Path = Read-Host "Enter the first directory"
                if (pathValidation -path $dir1Path -and (Test-Path -Path $dir1Path)) {
                    Write-Host "Valid path 1: $dir1Path" -ForegroundColor Green
                    return $dir1Path
                }
                else {
                    Write-Host "Invalid path or it could not be found/accessed" -ForegroundColor Red
                    Start-Sleep -Seconds 3
                    directoryOne
                }
            }
            else {
                return $path1
            }
        }
        catch { Write-Host "directoryOne() failed with: " $_ }
    }

    function directoryTwo {

        try {
            if (-not $path2) {
                $dir2Path = Read-Host "Enter the second directory"
                if (pathValidation -path $dir2Path -and (Test-Path -Path $dir2Path)) {
                    Write-Host "Valid path 2: $dir2Path" -ForegroundColor Green
                    return $dir2Path
                }
                else {
                    Write-Host "Invalid path or it could not be found/accessed" -ForegroundColor Red
                    Start-Sleep -Seconds 3
                    directoryTwo
                }
            }
            else {
                return $path2
            }
        }
        catch { Write-Host "directoryTwo() failed with: " $_ }
    }

    # Get paths from user if not provided as parameters
    $path1 = directoryOne
    $path2 = directoryTwo

    # Perform deduplication if paths are valid
    try {
        if ($path1 -and $path2) {
            deDupe -dir1Path $path1 -dir2Path $path2
        }
    }
    catch { Write-Host "triggering deDupe in runScript() failed with: "$_ }
}

if ($null -eq $dir1Path) {
    runScript -path1 $dir1Path -path2 $dir2Path
}
else { deDupe -dir1Path $dir1Path -dir2Path $dir2Path }
