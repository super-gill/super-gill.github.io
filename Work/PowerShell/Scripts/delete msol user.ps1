Connect-MsolService
$user = Read-Host -promt 'enter the users email address'
Remove-MsolUser -UserPrincipalName $user
Remove-MsolUser -UserPrincipalName $user -RemoveFromRecycleBin
Get-Msoluser -ReturnDeletedUsers
disconnect-exchangeonline