$LinkTypes = "Members","Owners"
$Outfile = "C:\Temp\" + $Group + ".csv"
$LinkTypes | Foreach {
    $LinkType = $_
    $Links += (Get-UnifiedGroupLinks -Identity $Group -LinkType $LinkType | Select DisplayName, PrimarySmtpAddress, ExternalEmailAddress, @{n='LinkType';e={$LinkType}})
}
$Links | Export-Csv $Outfile -NoTypeInformation
Remove-Variable Links