Set-ExecutionPolicy RemoteSigned
Install-Module -Name ExchangeOnlineManagement -force
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline
#$UserCredential = Get-Credential
#$Session = New-PSSession -ConfigurationName Microsoft.Exchange -ConnectionUri https://outlook.office365.com/powershell-liveid/ -Credential $UserCredential -Authentication  Basic -AllowRedirection
#Import-PSSession $Session
#Connect-MsolService
get-mailbox | format-list displayname,userprincipalname

#disconnect-exchangeonline

# https://docs.microsoft.com/en-us/powershell/exchange/connect-to-exchange-online-powershell?view=exchange-ps#connect-to-exchange-online-powershell-using-modern-authentication-with-or-without-mfa&preserve-view=true
# Import-Module ExchangeOnlineManagement
# Connect-ExchangeOnline -UserPrincipalName admin@youdandrewsltd.onmicrosoft.com

# Dehydrate: 
# Get-OrganizationConfig | ft Identity,IsDehydrated
# Enable-OrganizationCustomization
# Get-OrganizationConfig | ft Identity,IsDehydrated

#disable DIRSYNC
#connect-msolservice
#Set-MsolDirSyncEnabled -EnableDirSync $false
#  If you use this command, you must wait 72 hours before you can turn directory synchronization back on.
#  https://docs.microsoft.com/en-us/microsoft-365/enterprise/turn-off-directory-synchronization?view=o365-worldwide