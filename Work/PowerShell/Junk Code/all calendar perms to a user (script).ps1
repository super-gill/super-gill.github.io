﻿# $Cred = Get-Credential
# $Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://ps.outlook.com/powershell/ -Credential $Cred -Authentication Basic -AllowRedirection
# Import-PSSession $Session

$userToAdd = "susanne.j@womanstrust.org.uk"
$users = Get-Mailbox | Select-object -ExpandProperty PrimarySmtpAddress
Foreach ($user in $users)
{
$ExistingPermission = Get-MailboxFolderPermission -Identity $u":\calendar" -User $userToAdd -EA SilentlyContinue
if ($ExistingPermission) {Remove-MailboxFolderPermission -Identity $u":\calendar" -User $userToAdd -Confirm:$False}
if ($user -ne $userToAdd) {Add-MailboxFolderPermission $u":\Calendar" -user $userToAdd -accessrights Editor}
}

# Remove-PSSession $Session