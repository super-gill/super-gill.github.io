Import-Module AzureAd
 
$UserID = "sgallagher@reachactive.com"
$CSVFile = "C:\Temp\GroupMemberships.csv"
 
Try {
    #Connect-AzureAD -Credential (Get-Credential) | Out-Null
    $User = Get-AzureADUser -ObjectId $UserID
    $Memberships = Get-AzureADUserMembership -ObjectId $User.ObjectId | Where-object { $_.ObjectType -eq "Group" }
    $Memberships | Select DisplayName, Mail, ObjectId | Export-Csv -LiteralPath $CSVFile -NoTypeInformation
}
Catch {
    write-host -f Red "`tError:" $_.Exception.Message
}