# Use this to remove special permissions in SharePoint so it no longer appears in Cove, it will also remove any share links
# Jason Mcdill for updates
# 1
 
param(
    $adminURL,
    $userUPN,
    $whatIf = $true,
    $adminUPN
)

if ($env:USERNAME.ToLower() = "daniel.whitford") {
    Write-Host ""
    Write-Host "WARNING: A DANIEL IS DETECTED" -ForegroundColor Red
    Write-Host ""
}

$version = 1
Write-Host "Version "$version
 
if ( $adminURL -eq $null ) {
    Write-Host "You must provide the following details`n-adminURL`n-userUPN`n-whatIf`n-adminUPN`nI.E.: .\deleteCoveLicenses.ps1 -adminURL https://pecan-admin.sharepoint.com/ -userUPN user@pecan.org.uk -whitIf $false -adminUPN admin@pecan.org.uk"
    Write-Host "`n CTRL-C to exit"
    Start-Sleep -seconds 30
}
else {

    #$credential = Get-Credential
 
    Connect-SPOService -Url $adminURL #-Credential $credential
    $siteUrls = (Get-SPOSite | Where-Object url -notlike *-my.sharepoint.com*).url
 
    foreach ($site in $siteUrls) {
        #check or add the site collection admin
        Write-host "Adding Site Collection Admin for: `n"$Site
        Set-SPOUser -site $Site -LoginName $adminUPN -IsSiteCollectionAdmin $True
   
        #try delete the user
        try {
            $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
            Write-Host "User found in site $site"
       
            if ( $whatif -eq $false ) {
                Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                if ($?) { Write-Output "Removed user from $site" } else { Write-Output "Remove failed for $site" }
            }
            else { Write-Host "Would remove" $user.loginname }
        }
        catch {
            Write-Host "ERROR: $_"
        }
        Set-SPOUser -site $Site -LoginName $adminUPN -IsSiteCollectionAdmin $True
        Write-Host "Removed $adminUPN from site collection admin"
        Write-Host "_______________________________`n"
    }

}