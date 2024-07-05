#delete a user then also remove it from the recyclebin

param(
    $user
)

Connect-MsolService

    Remove-MsolUser -UserPrincipalName $user
    Remove-MsolUser -UserPrincipalName $user -RemoveFromRecycleBin
    Get-Msoluser -ReturnDeletedUsers