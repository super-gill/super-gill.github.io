param(
    $adminURL,
    $adminUPN,
    $userUPN,
    $whatIf = $true
)

if ($adminURL -eq $null) {
    Write-Host "You must provide the following details:`n-adminURL`n-userUPN`n-whatIf`n-adminUPN`nI.E.: .\deleteCoveLicenses.ps1 -adminURL https://pecan-admin.sharepoint.com/ -userUPN user@pecan.org.uk -whatIf $false -adminUPN admin@pecan.org.uk"
    Write-Host "`nCTRL-C to exit"
    Start-Sleep -seconds 30
}

$credential = Get-Credential

    Connect-SPOService -Url $adminURL -Credential $credential
    $siteUrls = (Get-SPOSite | Where-Object url -notlike *-my.sharepoint.com*).url

    foreach ($site in $siteUrls) {
        if ($whatIf -eq $false) {
            try {
                # try add the site collection admin
                Write-Host "Added $adminUPN as admin to: $site"
                # add the site collection admin
                Set-SPOUser -site $site -LoginName $adminUPN -IsSiteCollectionAdmin $True
            }
            catch {
                # catch if the admin already exists
                Write-Host "Could not add the admin permission: $_"
            }        
        } else {
            # if whatif response
            Write-Host "Would have: Added $adminUPN as admin to: $site"
        }

        # try delete the user
        try {
            # look for the user
            $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
            Write-Host "User found in site $site"
            
            # if exist delete it
            if ($whatIf -eq $false) {
                Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                if ($?) {
                    Write-Output "Removed user from $site"
                } else {
                    Write-Output "Remove failed for $site"
                }
            } else {
                # if whatif response
                Write-Host "Would remove $user.loginname"
            }
        }
        catch {
            # quit out if the user isn't found
            Write-Host "No user found in site $site or an error occurred: $_"
        }

        # remove the site collection admin
        if ($whatIf -eq $false) {
            Remove-SPOUser -Site $site -LoginName $adminUPN -IsSiteCollectionAdmin $false
        } else {
            Write-Host "Would have: Removed $adminUPN as admin to: $site"
        }

        Write-Host "_______________________________`n"
    }
