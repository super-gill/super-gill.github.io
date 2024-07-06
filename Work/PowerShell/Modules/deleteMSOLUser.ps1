#delete a user then also remove it from the recyclebin

param(
    $UPN
)

Connect-MsolService

try {

    if (Get-Msoluser -UserPrincipalName $UPN) {
        Remove-MsolUser -UserPrincipalName $UPN
        Remove-MsolUser -UserPrincipalName $UPN -RemoveFromRecycleBin
        Get-Msoluser -ReturnDeletedUsers
    }
    else { Write-Host "Error removing user or user not found: "$_ }

}
catch { Write-Host "Error: "$_ }



