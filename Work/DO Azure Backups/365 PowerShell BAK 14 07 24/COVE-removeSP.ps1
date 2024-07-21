<#
.SYNOPSIS
    Remove special permissions in SharePoint and any share links associated with the specified user.

.DESCRIPTION
    This script removes special permissions for a user in SharePoint to ensure the user no longer appears in Cove.
    It also removes any share links associated with the user.
    The script can simulate the operation using the -WhatIf parameter.

.PARAMETER adminURL
    The admin URL for the SharePoint site.

.PARAMETER userUPN
    The user principal name (UPN) of the user to be removed.

.PARAMETER whatIf
    Flag to indicate whether to perform a "WhatIf" operation (default is true).

.PARAMETER adminUPN
    The admin user principal name (UPN) to be temporarily added as a site collection admin.

.EXAMPLE
    .\deleteCoveLicenses.ps1 -adminURL https://contoso-admin.sharepoint.com/ -userUPN user@contoso.com -whatIf $false -adminUPN admin@contoso.com
    This command removes the user user@contoso.com from all SharePoint sites specified by the admin URL.

.EXAMPLE
    .\deleteCoveLicenses.ps1 -adminURL https://contoso-admin.sharepoint.com/ -userUPN user@contoso.com -adminUPN admin@contoso.com
    This command simulates the removal of the user user@contoso.com from all SharePoint sites specified by the admin URL.

.NOTES
    Version: 1.0
    Author: Jason Mcdill
#>

param(
    $adminURL, # The admin URL for the SharePoint site.
    $userUPN, # The UPN of the user to be removed.
    $whatIf = $true, # Flag WhatIf (default to true).
    $adminUPN # The admin UPN to be added as a site collection admin.
)

# Check if the adminURL parameter is provided.
if ($adminURL -eq $null) {
    # If not provided, display an error message with instructions.
    Write-Host "You must provide the following details:`n-adminURL`n-userUPN`n-whatIf`n-adminUPN`nI.E.: .\deleteCoveLicenses.ps1 -adminURL https://contoso-admin.sharepoint.com/ -userUPN user@contoso.com -whatIf \$false -adminUPN admin@contoso.com"
    Write-Host "`nCTRL-C to exit"
    Start-Sleep -seconds 30
} else {
    # Connect to the SharePoint Online service.
    Connect-SPOService -Url $adminURL

    # Retrieve all site URLs excluding personal sites.
    $siteUrls = (Get-SPOSite | Where-Object url -notlike *-my.sharepoint.com*).url

    # Iterate through each site URL.
    foreach ($site in $siteUrls) {
        # Add the admin user as a site collection admin.
        Write-Host "Adding Site Collection Admin for: `n"$Site
        Set-SPOUser -Site $Site -LoginName $adminUPN -IsSiteCollectionAdmin $True

        # Try to delete the user from the site.
        try {
            $user = Get-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
            Write-Host "User found in site $site"

            if ($whatIf -eq $false) {
                # If WhatIf is false, remove the user from the site.
                Remove-SPOUser -Site $site -LoginName $userUPN -ErrorAction Stop
                if ($?) {
                    Write-Output "Removed user from $site"
                } else {
                    Write-Output "Remove failed for $site"
                }
            } else {
                # If WhatIf is true, simulate the removal.
                Write-Host "Would remove" $user.loginname
            }
        } catch {
            # Catch and display any errors that occur.
            Write-Host "ERROR: $_"
        }
        # Remove the admin user from the site collection admin role.
        Set-SPOUser -Site $Site -LoginName $adminUPN -IsSiteCollectionAdmin $True
        Write-Host "Removed $adminUPN from site collection admin"
        Write-Host "_______________________________`n"
    }
}
