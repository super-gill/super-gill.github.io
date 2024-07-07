#create a new user
New-Mailbox -name "Jess Webb" -Firstname Jess -LastName Webb -DisplayName "Jess Webb" -ResetPasswordOnNextLogon $false -MicrosoftOnlineServicesID jess@gaianet.org

#Set location
Set-MsolUser -UserPrincipalName "jess@gaianet.org" -UsageLocation GB

#check licenses
Get-MsolAccountSku

#or use AD to check licenses but will need to add "dominname:" to the beginning of the SKU (ie: gaiafoundation:o365_business_essentials)
Connect-AzureAD
Get-AzureADSubscribedSku | Select SkuPartNumber


#add a license
Connect-MsolService
Set-MsolUserLicense -UserPrincipalName "jess@gaianet.org" -AddLicenses "gaiafoundation:O365_BUSINESS_ESSENTIALS"

#convert mailbox
Set-Mailbox -Identity <MailboxIdentity> -Type <Regular | Room | Equipment | Shared>

#change password
Set-MsolUserPassword -UserPrincipalName "davidchew@consoso.com" -NewPassword "pa$$word"