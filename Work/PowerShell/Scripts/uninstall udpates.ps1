$updates = @(
    "KB5035853",
    "KB5035967"
)

foreach ($update in $updates) {
    $installedUpdate = Get-WmiObject -Class Win32_QuickFixEngineering | Where-Object {$_.HotFixID -eq $update}
    
    if ($installedUpdate -ne $null) {
        Write-Host "Uninstalling update $update..."
        
        $uninstallResult = wusa /uninstall /kb:$update /quiet /norestart
        
        if ($uninstallResult -eq 0) {
            Write-Host "Update $update uninstalled successfully."
        } else {
            Write-Host "Failed to uninstall update $update. Error code: $uninstallResult"
        }
    } else {
        Write-Host "Update $update is not installed."
    }
}
