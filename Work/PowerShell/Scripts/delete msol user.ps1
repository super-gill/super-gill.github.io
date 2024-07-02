param(
    $user,
    $whatIf = $true
)

Connect-MsolService

if ($user) {}

if ($whatIf -eq $false) {
    Remove-MsolUser -UserPrincipalName $user
    Remove-MsolUser -UserPrincipalName $user -RemoveFromRecycleBin
    Get-Msoluser -ReturnDeletedUsers
}
else {}