#############
############# Exchange Online #############
# https://docs.microsoft.com/en-us/powershell/exchange/exchange-online/connect-to-exchange-online-powershell/connect-to-exchange-online-powershell?view=exchange-ps

#mailboz size report
Get-Mailbox | Get-MailboxStatistics | Format-List displayname,totalitemsi 

#Connect to Exchange Online PS
Set-ExecutionPolicy RemoteSigned
$UserCredential = Get-Credential
$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $UserCredential -Authentication  Basic -AllowRedirection
Import-PSSession $Session
Get-Mailbox

#End the session
Remove-PSSession $Session

#Useful commands for Exhchange Online

#Add calendar permission, also works for public folder access
Add-Mailboxfolderpermission -Identity [user id]:\calendar -user [user id] -Accessrights [level]
Add-Mailboxfolderpermission -Identity [user id]:\contacts -user [user id] -Accessrights [level]

#enable unlimited archive
Set-OrganizationConfig -AutoExpandingArchive

#List Mailboxes and show forards
Get-Mailbox | select UserPrincipalName,ForwardingSmtpAddress,DeliverToMailboxAndForward
#As above but export to CSV
Get-Mailbox | select UserPrincipalName,ForwardingSmtpAddress,DeliverToMailboxAndForward | Export-csv .\users.csv -NoTypeInformation

#Remove / set a forward
Set-Mailbox paulie -ForwardingAddress $NULL -ForwardingSmtpAddress $NULL

#Get permissions that a specific user has
Get-Mailbox | Get-MailboxPermission -User [username]
Get-MailboxFolderPermission -Identity [user] -User [user]

#Add mailbox permission with automap tag, inhertiance
Add-Mailboxpermission -Identity [target mailbox] -user [user id] -AccessRights [level] -InheritanceType All -Automapping $false
Add-Mailboxpermission -Identity ben -user kally -AccessRights editor -InheritanceType All

#Delete MSOL user
Connect-MsolService
Remove-MsolUser -UserPrincipalName "alison.gamble@cila.co.uk" -Force -RemoveFromRecycleBin
Get-MsolUser -All -ReturnDeletedUsers 
Get-MsolUser -ReturnDeletedUsers | Remove-MsolUser -RemoveFromRecycleBin -Force

Remove-MsolUser -UserPrincipalName "davidchew@contoso.com"
Remove-MsolUser -UserPrincipalName "davidchew@contoso.com" -Force
Remove-MsolUser -UserPrincipalName "davidchew@contoso.com" -RemoveFromRecycleBin

#Add and remove aliases comma seperated for multiple addresses
Set-Mailbox "john nyota" -EmailAddresses @{remove="john@micentre.com"}
Set-Mailbox "Dan Jump" -EmailAddresses @{add="dan.jump@northamerica.contoso.com"}

#Add user to a group
Connect-MsolService
$groupid = Get-MsolGroup | Where-Object {$_.DisplayName -eq “GROUP NAME”}

############
# GROUPS

Get-UnifiedGroup #365 groups
Get-DistributionGroup #distr groups


set-MailboxAutoReplyConfiguration -Identity agill@frg.org.uk -ExternalMessage "Andrea Gill no longer works for Family Rights Group. Kindly direct any correspondence to Louise Craggs-Tripp or Joanna Harris-Tench." -InternalMessage "Andrea Gill no longer works for Family Rights Group. Kindly direct any correspondence to Louise Craggs-Tripp or Joanna Harris-Tench." -AutoReplyState Enable