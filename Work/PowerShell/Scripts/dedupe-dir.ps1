$dir1Path = read-host "Enter the first directory: "
$dir2Path = read-host "Enter the se3cond directory: "

$subfolders1 = Get-ChildItem -Path $dir1Path -Directory | ForEach-Object { $_.Name }
$subfolders2 = Get-ChildItem -Path $dir2Path -Directory | ForEach-Object { $_.Name }

$duplicatedRootFolders = $subfolders1 | Where-Object { $_ -in $subfolders2 }

if ($duplicatedRootFolders.Count -gt 0) {
    Write-Host "Duplicated folders found:"
    $duplicatedRootFolders | ForEach-Object {
        Write-Host $_
    }
} else {
    Write-Host "None found :)"
}
